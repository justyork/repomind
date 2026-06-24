import fs from 'node:fs';
import path from 'node:path';
import { DocIndex } from '../index/doc-index.js';
import {
  computeCategoryWins,
  computeHallucinationPass,
  computeTokenPass,
  mergePassFlags,
  summarizeArmTokens,
} from './compute-pass.js';
import { loadQuestions } from './load-questions.js';
import { buildBaselineAnswer, buildRepomindAnswer } from './live-answer.js';
import { parseTranscriptTokensSync } from './record-transcript.js';
import type {
  AbQuestionComparison,
  HumanScoreEntry,
  LiveEvalResult,
  LiveQuestionResult,
} from './types.js';
import { validateQuestionsAgainstIndex } from './validate-questions.js';
import type { AbQuestion } from './types.js';

export interface RunLiveEvalOptions {
  cwd: string;
  questionsFile: string;
  outputPath: string;
  dryRun?: boolean;
  baselineTranscript?: string;
  repomindTranscript?: string;
}

function tokenWinner(
  baseline: number,
  repomind: number,
): 'baseline' | 'repomind' | 'tie' {
  if (repomind < baseline) {
    return 'repomind';
  }
  if (repomind > baseline) {
    return 'baseline';
  }
  return 'tie';
}

function assignBlindLabels(seed: number): { baseline: 'A' | 'B'; repomind: 'A' | 'B' } {
  return seed % 2 === 0
    ? { baseline: 'A', repomind: 'B' }
    : { baseline: 'B', repomind: 'A' };
}

function applyTranscriptTokens(
  answer: { tokens: number; transcriptSource?: 'transcript' | 'simulated' },
  transcriptPath: string | undefined,
): void {
  if (!transcriptPath) {
    answer.transcriptSource = 'simulated';
    return;
  }
  const usage = parseTranscriptTokensSync(transcriptPath);
  if (usage.source === 'transcript' && usage.totalTokens > 0) {
    answer.tokens = usage.totalTokens;
    answer.transcriptSource = 'transcript';
  } else {
    answer.transcriptSource = 'simulated';
  }
}

function toComparison(row: LiveQuestionResult): AbQuestionComparison {
  return {
    questionId: row.questionId,
    prompt: row.prompt,
    anchorSlugs: row.anchorSlugs,
    baseline: {
      arm: 'baseline',
      questionId: row.questionId,
      tokens: row.baseline.tokens,
      filesRead: row.baseline.filesRead,
      strategy: row.baseline.strategy as 'grep-then-read' | 'read-all',
    },
    repomind: {
      arm: 'repomind',
      questionId: row.questionId,
      tokens: row.repomind.tokens,
      searchHits: row.repomind.searchHits,
      docsFetched: row.repomind.docsFetched,
    },
    tokenWinner: row.tokenWinner,
  };
}

export function runLiveEvalQuestions(
  index: DocIndex,
  questions: AbQuestion[],
  options: Pick<RunLiveEvalOptions, 'baselineTranscript' | 'repomindTranscript'>,
): LiveQuestionResult[] {
  return questions.map((question, questionIndex) => {
    const baseline = buildBaselineAnswer(index, question);
    const repomind = buildRepomindAnswer(index, question);

    applyTranscriptTokens(baseline, options.baselineTranscript);
    applyTranscriptTokens(repomind, options.repomindTranscript);

    const winner = tokenWinner(baseline.tokens, repomind.tokens);

    return {
      questionId: question.id,
      prompt: question.prompt,
      anchorSlugs: question.anchorSlugs,
      tags: question.tags,
      baseline,
      repomind,
      tokenWinner: winner,
      blindLabels: assignBlindLabels(questionIndex),
    };
  });
}

export function exportBlindPack(
  live: LiveQuestionResult[],
  outputPath: string,
  meta: { corpusCwd: string; runAt: string },
): void {
  const lines: string[] = [
    '# RepoMind live eval — blind review pack',
    '',
    `Generated: ${meta.runAt}`,
    `Corpus: ${meta.corpusCwd}`,
    '',
    'Score each answer 0–3 using `ab-demo/score-hallucination.md`.',
    'Do not look up slugs until scoring is complete.',
    '',
  ];

  for (const row of live) {
    const labels = row.blindLabels ?? { baseline: 'A', repomind: 'B' };
    const answerA = labels.baseline === 'A' ? row.baseline.answer : row.repomind.answer;
    const answerB = labels.baseline === 'B' ? row.baseline.answer : row.repomind.answer;

    lines.push(`## ${row.questionId}`, '', `**Prompt:** ${row.prompt}`, '');
    lines.push(`### Answer A`, '', answerA, '');
    lines.push(`### Answer B`, '', answerB, '');
    lines.push('---', '');
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
}

export function buildLiveEvalResult(
  options: RunLiveEvalOptions,
  questionsFile: AbQuestion[],
  questionsVersion: number,
  live: LiveQuestionResult[],
  humanScores: HumanScoreEntry[] | null = null,
): LiveEvalResult {
  const comparisons = live.map(toComparison);
  const baseline = summarizeArmTokens('baseline', comparisons);
  const repomind = summarizeArmTokens('repomind', comparisons);
  const { tokenPass, repomindWins, passThreshold } = computeTokenPass(
    comparisons,
    baseline,
    repomind,
  );

  const questionsById = new Map(questionsFile.map((q) => [q.id, q]));
  let hallucinationPass: boolean | null = null;
  let categoryWins: LiveEvalResult['categoryWins'];

  if (humanScores && humanScores.length > 0) {
    const wins = computeCategoryWins(humanScores, comparisons, questionsById);
    categoryWins = wins.map((row) => ({
      category: row.category,
      repomindWins: row.repomindWins,
      baselineHallucinationTotal: row.baselineHallucinationTotal,
      repomindHallucinationTotal: row.repomindHallucinationTotal,
    }));
    hallucinationPass = computeHallucinationPass(wins);
  }

  const pass = mergePassFlags(tokenPass, hallucinationPass);

  return {
    runAt: new Date().toISOString(),
    evalKind: 'live',
    corpusCwd: path.resolve(options.cwd),
    questionsFile: options.questionsFile,
    questionsVersion,
    comparisons,
    live,
    baseline,
    repomind,
    repomindTokenWins: repomindWins,
    passThreshold,
    tokenPass,
    humanScores,
    hallucinationPass,
    categoryWins,
    pass,
    note:
      humanScores === null
        ? 'Token comparison complete. Add humanScores and re-run with --record-scores to compute hallucinationPass.'
        : 'Token and hallucination gates evaluated.',
  };
}

export function runLiveEval(options: RunLiveEvalOptions): number {
  const cwd = path.resolve(options.cwd);
  const questionsPayload = loadQuestions(options.questionsFile);
  const index = new DocIndex(cwd);

  const report = validateQuestionsAgainstIndex(index, questionsPayload.questions, cwd);
  if (report.missingAnchors.length > 0) {
    for (const missing of report.missingAnchors) {
      console.error(
        `missing anchor: question=${missing.questionId} slug=${missing.slug}`,
      );
    }
    return 1;
  }

  console.log(
    `corpus ok: ${report.docCount} docs, ${report.questionCount} questions (${cwd})`,
  );

  if (options.dryRun) {
    console.log('dry-run complete — eval arms not executed');
    return 0;
  }

  const live = runLiveEvalQuestions(index, questionsPayload.questions, options);
  const result = buildLiveEvalResult(
    options,
    questionsPayload.questions,
    questionsPayload.version,
    live,
    null,
  );

  const blindPath = options.outputPath.replace(/\.json$/i, '-blind.md');
  exportBlindPack(live, blindPath, { corpusCwd: cwd, runAt: result.runAt });
  result.blindPackPath = blindPath;

  fs.mkdirSync(path.dirname(options.outputPath), { recursive: true });
  fs.writeFileSync(options.outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  console.log(`wrote ${options.outputPath}`);
  console.log(`wrote ${blindPath}`);
  console.log(
    `tokenPass: ${result.tokenPass} (repomind wins ${result.repomindTokenWins}/${result.comparisons.length}, median ${result.repomind.medianTokens} vs ${result.baseline.medianTokens})`,
  );
  console.log('Next: blind-score answers, then `repo-mind ab-eval --record-scores <results.json>`');

  return 0;
}

export function mergeHumanScores(
  resultsPath: string,
  scores: HumanScoreEntry[],
  outputPath?: string,
): LiveEvalResult {
  const raw = JSON.parse(fs.readFileSync(resultsPath, 'utf8')) as LiveEvalResult;
  if (!raw.live || raw.evalKind !== 'live') {
    throw new Error('results file is not a live eval output');
  }

  const questions = raw.live.map((row) => ({
    id: row.questionId,
    prompt: row.prompt,
    anchorSlugs: row.anchorSlugs,
    tags: row.tags,
  }));

  const merged = buildLiveEvalResult(
    {
      cwd: raw.corpusCwd,
      questionsFile: raw.questionsFile,
      outputPath: outputPath ?? resultsPath,
    },
    questions,
    raw.questionsVersion,
    raw.live,
    scores,
  );

  merged.blindPackPath = raw.blindPackPath;
  merged.runAt = raw.runAt;

  const dest = outputPath ?? resultsPath;
  fs.writeFileSync(dest, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  return merged;
}
