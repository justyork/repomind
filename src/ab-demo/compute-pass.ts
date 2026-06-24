import type { AbArmSummary, AbQuestionComparison, HumanScoreEntry } from './types.js';

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

export function summarizeArmTokens(
  arm: 'baseline' | 'repomind',
  comparisons: AbQuestionComparison[],
): AbArmSummary {
  const tokens = comparisons.map((row) =>
    arm === 'baseline' ? row.baseline.tokens : row.repomind.tokens,
  );
  return {
    arm,
    medianTokens: median(tokens),
    perQuestionTokens: tokens,
  };
}

export function computeTokenPass(
  comparisons: AbQuestionComparison[],
  baseline: AbArmSummary,
  repomind: AbArmSummary,
): { tokenPass: boolean; repomindWins: number; passThreshold: number } {
  const n = comparisons.length;
  const repomindWins = comparisons.filter((row) => row.tokenWinner === 'repomind').length;
  const passThreshold = Math.ceil((n * 2) / 3);
  const tokenPass =
    repomind.medianTokens < baseline.medianTokens && repomindWins >= passThreshold;
  return { tokenPass, repomindWins, passThreshold };
}

export type EvalCategory = 'factual' | 'synthesis' | 'glossary-adr';

export function categoryFromTags(tags: string[] | undefined): EvalCategory {
  if (!tags || tags.length === 0) {
    return 'factual';
  }
  if (tags.some((t) => t === 'synthesis' || t === 'open-question')) {
    return 'synthesis';
  }
  if (tags.some((t) => t === 'glossary' || t === 'adr')) {
    return 'glossary-adr';
  }
  return 'factual';
}

export interface CategoryWin {
  category: EvalCategory;
  questionIds: string[];
  baselineHallucinationTotal: number;
  repomindHallucinationTotal: number;
  baselineMedianTokens: number;
  repomindMedianTokens: number;
  repomindWins: boolean;
}

/** RepoMind wins a category when hallucination total is lower and median tokens are lower or equal. */
export function computeCategoryWins(
  scores: HumanScoreEntry[],
  comparisons: AbQuestionComparison[],
  questionsById: Map<string, { tags?: string[] }>,
): CategoryWin[] {
  const byCategory = new Map<EvalCategory, HumanScoreEntry[]>();

  for (const score of scores) {
    const question = questionsById.get(score.questionId);
    const category = categoryFromTags(question?.tags);
    const list = byCategory.get(category) ?? [];
    list.push(score);
    byCategory.set(category, list);
  }

  const results: CategoryWin[] = [];

  for (const [category, categoryScores] of byCategory) {
    const questionIds = categoryScores.map((s) => s.questionId);
    const baselineHallucinationTotal = categoryScores.reduce((sum, s) => sum + s.baseline, 0);
    const repomindHallucinationTotal = categoryScores.reduce((sum, s) => sum + s.repomind, 0);

    const compRows = comparisons.filter((c) => questionIds.includes(c.questionId));
    const baselineTokens = compRows.map((c) => c.baseline.tokens);
    const repomindTokens = compRows.map((c) => c.repomind.tokens);

    const repomindWins =
      repomindHallucinationTotal < baselineHallucinationTotal &&
      median(repomindTokens) <= median(baselineTokens);

    results.push({
      category,
      questionIds,
      baselineHallucinationTotal,
      repomindHallucinationTotal,
      baselineMedianTokens: median(baselineTokens),
      repomindMedianTokens: median(repomindTokens),
      repomindWins,
    });
  }

  return results;
}

export function computeHallucinationPass(categoryWins: CategoryWin[]): boolean {
  const wins = categoryWins.filter((row) => row.repomindWins).length;
  return wins >= 2 && categoryWins.length >= 2;
}

export function mergePassFlags(
  tokenPass: boolean,
  hallucinationPass: boolean | null,
): boolean | null {
  if (hallucinationPass === null) {
    return tokenPass ? null : false;
  }
  return tokenPass && hallucinationPass;
}
