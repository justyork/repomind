import type { DocIndex } from '../index/doc-index.js';
import { runArmBaseline } from './arm-baseline.js';
import { runArmRepomind } from './arm-repomind.js';
import {
  BASELINE_CLAUDE_SNIPPET,
  mcpToolSchemaTokenEstimate,
} from './session-overhead.js';
import { estimateTokens } from './estimate-tokens.js';
import type {
  AbArmSummary,
  AbArmsRunResult,
  AbQuestion,
  AbQuestionComparison,
} from './types.js';

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
  }
  return sorted[mid]!;
}

function summarizeArm(
  arm: 'baseline' | 'repomind',
  perQuestion: AbQuestionComparison[],
): AbArmSummary {
  const tokens = perQuestion.map((row) =>
    arm === 'baseline' ? row.baseline.tokens : row.repomind.tokens,
  );
  return {
    arm,
    medianTokens: median(tokens),
    perQuestionTokens: tokens,
  };
}

export function runArmsComparison(
  index: DocIndex,
  questions: AbQuestion[],
): AbArmsRunResult {
  const n = questions.length;
  const listing = index
    .refresh()
    .map((doc) => doc.relativePath)
    .join('\n');

  const baselineSession = estimateTokens(BASELINE_CLAUDE_SNIPPET) + estimateTokens(listing);
  const repomindSession = mcpToolSchemaTokenEstimate();
  const baselineOverhead = Math.ceil(baselineSession / n);
  const repomindOverhead = Math.ceil(repomindSession / n);

  const comparisons: AbQuestionComparison[] = questions.map((question) => {
    const baseline = runArmBaseline(index, question, baselineOverhead);
    const repomind = runArmRepomind(index, question, repomindOverhead);
    return {
      questionId: question.id,
      prompt: question.prompt,
      anchorSlugs: question.anchorSlugs,
      baseline,
      repomind,
      tokenWinner:
        repomind.tokens < baseline.tokens
          ? 'repomind'
          : repomind.tokens > baseline.tokens
            ? 'baseline'
            : 'tie',
    };
  });

  const baselineSummary = summarizeArm('baseline', comparisons);
  const repomindSummary = summarizeArm('repomind', comparisons);

  const repomindWins = comparisons.filter((row) => row.tokenWinner === 'repomind').length;
  const passThreshold = Math.ceil((n * 2) / 3);
  const tokenPass =
    repomindSummary.medianTokens < baselineSummary.medianTokens &&
    repomindWins >= passThreshold;

  return {
    comparisons,
    baseline: baselineSummary,
    repomind: repomindSummary,
    repomindTokenWins: repomindWins,
    passThreshold,
    tokenPass,
    hallucinationPass: null,
    pass: tokenPass ? null : false,
    note:
      'Automated token comparison only. Set humanScores in results JSON; pass becomes true when hallucination rubric also passes.',
  };
}
