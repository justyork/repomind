import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { estimateTokens } from '../src/ab-demo/estimate-tokens.js';
import { loadQuestions } from '../src/ab-demo/load-questions.js';
import { corpusPath, questionsPath, resolveAbDemoRoot } from '../src/ab-demo/paths.js';
import { runAbDemo } from '../src/ab-demo/run-ab.js';
import { runArmsComparison } from '../src/ab-demo/run-arms.js';
import { materializeCorpusRepo, validateCorpusAgainstQuestions } from '../src/ab-demo/validate-corpus.js';
import { DocIndex } from '../src/index/doc-index.js';

describe('ab-demo harness', () => {
  const abRoot = resolveAbDemoRoot();
  const corpus = corpusPath(abRoot);
  const questionsFile = questionsPath(abRoot);

  it('loads questions.json', () => {
    const file = loadQuestions(questionsFile);
    expect(file.version).toBe(1);
    expect(file.questions.length).toBeGreaterThanOrEqual(5);
  });

  it('validates seeded corpus anchor slugs', () => {
    const questions = loadQuestions(questionsFile);
    const report = validateCorpusAgainstQuestions(corpus, questions.questions);
    expect(report.docCount).toBeGreaterThanOrEqual(15);
    expect(report.missingAnchors).toEqual([]);
  });

  it('runAbDemo --dry-run exits 0', () => {
    expect(runAbDemo({ cwd: abRoot, dryRun: true })).toBe(0);
  });

  it('repomind arm retrieves every anchor doc at near-baseline tokens on the toy corpus', () => {
    // The toy corpus has ~80-token docs, so fixed MCP overhead dominates. The real
    // token verdict comes from `repo-mind ab-eval` on a real docs/ corpus (skyforge).
    const workDir = materializeCorpusRepo(corpus);
    try {
      const index = new DocIndex(workDir);
      const questions = loadQuestions(questionsFile);
      const result = runArmsComparison(index, questions.questions);

      // A token win only counts when the arm actually retrieved the anchor doc.
      for (const row of result.comparisons) {
        expect(row.repomind.anchorFound, row.questionId).toBe(true);
      }
      expect(result.repomind.medianTokens).toBeLessThanOrEqual(result.baseline.medianTokens * 1.1);
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true });
    }
  });

  it('estimateTokens rounds up by character length', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });
});
