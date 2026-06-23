export interface AbQuestion {
  id: string;
  prompt: string;
  /** Slugs that a grounded answer should cite or retrieve. */
  anchorSlugs: string[];
  tags?: string[];
}

export interface AbQuestionsFile {
  version: number;
  questions: AbQuestion[];
}

export interface AbDryRunReport {
  corpusPath: string;
  docCount: number;
  questionCount: number;
  missingAnchors: Array<{ questionId: string; slug: string }>;
}

export interface ArmBaselineResult {
  arm: 'baseline';
  questionId: string;
  tokens: number;
  filesRead: number;
  strategy: 'grep-then-read' | 'read-all';
}

export interface ArmRepomindResult {
  arm: 'repomind';
  questionId: string;
  tokens: number;
  searchHits: number;
  docsFetched: number;
}

export interface AbQuestionComparison {
  questionId: string;
  prompt: string;
  anchorSlugs: string[];
  baseline: ArmBaselineResult;
  repomind: ArmRepomindResult;
  tokenWinner: 'baseline' | 'repomind' | 'tie';
}

export interface AbArmSummary {
  arm: 'baseline' | 'repomind';
  medianTokens: number;
  perQuestionTokens: number[];
}

export interface AbArmsRunResult {
  comparisons: AbQuestionComparison[];
  baseline: AbArmSummary;
  repomind: AbArmSummary;
  repomindTokenWins: number;
  passThreshold: number;
  tokenPass: boolean;
  hallucinationPass: boolean | null;
  pass: boolean | null;
  note: string;
}

export interface AbRunResult {
  runAt: string;
  corpusPath: string;
  questionsVersion: number;
  arms: AbArmsRunResult;
  pass: boolean | null;
}
