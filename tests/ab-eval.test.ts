import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DocIndex } from '../src/index/doc-index.js';
import {
  categoryFromTags,
  computeCategoryWins,
  computeHallucinationPass,
  computeTokenPass,
  mergePassFlags,
  summarizeArmTokens,
} from '../src/ab-demo/compute-pass.js';
import { parseTranscriptTokensSync } from '../src/ab-demo/record-transcript.js';
import {
  buildLiveEvalResult,
  exportBlindPack,
  mergeHumanScores,
  runLiveEvalQuestions,
} from '../src/ab-demo/live-eval.js';
import { loadQuestions } from '../src/ab-demo/load-questions.js';
import { validateQuestionsAgainstIndex } from '../src/ab-demo/validate-questions.js';
import type { AbQuestionComparison, HumanScoreEntry } from '../src/ab-demo/types.js';

const tmpDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-ab-eval-'));
  tmpDirs.push(dir);
  return dir;
}

function writeDoc(root: string, relativePath: string, body: string): void {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `---
type: wiki-page
domain: technical
slug: ${path.basename(relativePath, '.md')}
status: accepted
title: ${path.basename(relativePath, '.md')}
related: []
---

${body}
`,
    'utf8',
  );
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('compute-pass', () => {
  const comparisons: AbQuestionComparison[] = [
    {
      questionId: 'q1',
      prompt: 'p1',
      anchorSlugs: ['a'],
      baseline: { arm: 'baseline', questionId: 'q1', tokens: 100, filesRead: 2, strategy: 'grep-then-read' },
      repomind: { arm: 'repomind', questionId: 'q1', tokens: 50, searchHits: 2, docsFetched: 1 },
      tokenWinner: 'repomind',
    },
    {
      questionId: 'q2',
      prompt: 'p2',
      anchorSlugs: ['b'],
      baseline: { arm: 'baseline', questionId: 'q2', tokens: 80, filesRead: 1, strategy: 'grep-then-read' },
      repomind: { arm: 'repomind', questionId: 'q2', tokens: 40, searchHits: 1, docsFetched: 1 },
      tokenWinner: 'repomind',
    },
    {
      questionId: 'q3',
      prompt: 'p3',
      anchorSlugs: ['c'],
      baseline: { arm: 'baseline', questionId: 'q3', tokens: 90, filesRead: 1, strategy: 'grep-then-read' },
      repomind: { arm: 'repomind', questionId: 'q3', tokens: 60, searchHits: 1, docsFetched: 1 },
      tokenWinner: 'repomind',
    },
  ];

  it('computes token pass when repomind median is lower and wins threshold', () => {
    const baseline = summarizeArmTokens('baseline', comparisons);
    const repomind = summarizeArmTokens('repomind', comparisons);
    const { tokenPass, repomindWins } = computeTokenPass(comparisons, baseline, repomind);
    expect(tokenPass).toBe(true);
    expect(repomindWins).toBe(3);
  });

  it('maps tags to eval categories', () => {
    expect(categoryFromTags(['factual'])).toBe('factual');
    expect(categoryFromTags(['synthesis'])).toBe('synthesis');
    expect(categoryFromTags(['glossary'])).toBe('glossary-adr');
    expect(categoryFromTags(['adr'])).toBe('glossary-adr');
  });

  it('computes hallucination pass when repomind wins two categories', () => {
    const scores: HumanScoreEntry[] = [
      { questionId: 'q1', baseline: 2, repomind: 0 },
      { questionId: 'q2', baseline: 1, repomind: 0 },
      { questionId: 'q3', baseline: 3, repomind: 1 },
    ];
    const questionsById = new Map([
      ['q1', { tags: ['factual'] }],
      ['q2', { tags: ['synthesis'] }],
      ['q3', { tags: ['glossary'] }],
    ]);
    const wins = computeCategoryWins(scores, comparisons, questionsById);
    expect(wins.filter((w) => w.repomindWins).length).toBeGreaterThanOrEqual(2);
    expect(computeHallucinationPass(wins)).toBe(true);
  });

  it('mergePassFlags returns null when token pass but no hallucination scores', () => {
    expect(mergePassFlags(true, null)).toBe(null);
    expect(mergePassFlags(false, null)).toBe(false);
    expect(mergePassFlags(true, true)).toBe(true);
    expect(mergePassFlags(true, false)).toBe(false);
  });
});

describe('record-transcript', () => {
  it('parses usage blocks from JSONL', () => {
    const dir = makeTempDir();
    const file = path.join(dir, 't.jsonl');
    fs.writeFileSync(
      file,
      JSON.stringify({ usage: { input_tokens: 100, output_tokens: 50 } }) + '\n',
      'utf8',
    );
    const usage = parseTranscriptTokensSync(file);
    expect(usage.totalTokens).toBe(150);
    expect(usage.source).toBe('transcript');
  });

  it('returns unavailable for missing file', () => {
    const usage = parseTranscriptTokensSync('/nonexistent/transcript.jsonl');
    expect(usage.source).toBe('unavailable');
    expect(usage.totalTokens).toBe(0);
  });
});

describe('live-eval integration', () => {
  it('validates skyforge questions file anchors against temp corpus', () => {
    const root = makeTempDir();
    const questionsPath = path.resolve('ab-demo/skyforge-questions.json');
    const questions = loadQuestions(questionsPath);

    for (const question of questions.questions) {
      for (const slug of question.anchorSlugs) {
        writeDoc(root, `docs/technical/wiki/${slug}.md`, `Body for ${slug}`);
      }
    }

    const index = new DocIndex(root);
    const report = validateQuestionsAgainstIndex(index, questions.questions, root);
    expect(report.missingAnchors).toEqual([]);
  });

  it('runs live arms and exports blind pack', () => {
    const root = makeTempDir();
    writeDoc(root, 'docs/technical/wiki/caravan.md', 'A caravan is a mobile trade convoy.');
    writeDoc(root, 'docs/technical/wiki/expedition.md', 'Expeditions depart from the home port.');

    const q = [
      {
        id: 'caravan-definition',
        prompt: 'What is a caravan?',
        anchorSlugs: ['caravan'],
        tags: ['factual', 'glossary'],
      },
      {
        id: 'expedition-flow',
        prompt: 'How do expeditions work?',
        anchorSlugs: ['expedition'],
        tags: ['factual'],
      },
    ];

    const index = new DocIndex(root);
    const live = runLiveEvalQuestions(index, q, {});
    expect(live).toHaveLength(2);
    expect(live[0]!.baseline.answer).toContain('caravan');
    expect(live[0]!.repomind.answer.length).toBeGreaterThan(0);

    const out = path.join(root, 'blind.md');
    exportBlindPack(live, out, { corpusCwd: root, runAt: new Date().toISOString() });
    const blind = fs.readFileSync(out, 'utf8');
    expect(blind).toContain('Answer A');
    expect(blind).toContain('Answer B');
    expect(blind).not.toContain('repomind');
  });

  it('merges human scores into results file', () => {
    const root = makeTempDir();
    writeDoc(root, 'docs/technical/wiki/caravan.md', 'Caravan lore.');
    const index = new DocIndex(root);
    const questions = [
      {
        id: 'caravan-definition',
        prompt: 'What is a caravan?',
        anchorSlugs: ['caravan'],
        tags: ['factual', 'glossary'],
      },
      {
        id: 'expedition-flow',
        prompt: 'Expedition?',
        anchorSlugs: ['expedition'],
        tags: ['synthesis'],
      },
    ];
    writeDoc(root, 'docs/technical/wiki/expedition.md', 'Expedition text.');

    const live = runLiveEvalQuestions(index, questions, {});
    const resultPath = path.join(root, 'results.json');
    const built = buildLiveEvalResult(
      { cwd: root, questionsFile: 'q.json', outputPath: resultPath },
      questions,
      1,
      live,
      null,
    );
    fs.writeFileSync(resultPath, JSON.stringify(built), 'utf8');

    const scores: HumanScoreEntry[] = [
      { questionId: 'caravan-definition', baseline: 2, repomind: 0 },
      { questionId: 'expedition-flow', baseline: 2, repomind: 0 },
    ];
    const merged = mergeHumanScores(resultPath, scores);
    expect(merged.humanScores).toHaveLength(2);
    expect(merged.categoryWins).toBeDefined();
    expect(merged.hallucinationPass).toBeTypeOf('boolean');
    if (merged.hallucinationPass === true) {
      expect(merged.pass).toBe(merged.tokenPass);
    }
  });
});
