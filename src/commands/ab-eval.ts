import fs from 'node:fs';
import path from 'node:path';
import { mergeHumanScores, runLiveEval } from '../ab-demo/live-eval.js';
import { resolveAbDemoRoot, resultsDir } from '../ab-demo/paths.js';
import { defaultSkyforgeQuestionsPath } from '../ab-demo/validate-questions.js';
import type { HumanScoreEntry } from '../ab-demo/types.js';

export interface AbEvalOptions {
  cwd?: string;
  questions?: string;
  output?: string;
  dryRun?: boolean;
  recordScores?: string;
  scoresFile?: string;
  baselineTranscript?: string;
  repomindTranscript?: string;
}

function printUsage(): void {
  console.log(`repo-mind ab-eval — live A/B eval on a project docs/ corpus

Usage:
  repo-mind ab-eval --cwd <project> [--questions <path>] [--output <path>] [--dry-run]
  repo-mind ab-eval --record-scores <results.json> [--scores <scores.json>] [--output <path>]

Options:
  --cwd <dir>              Project root with docs/ (required for eval run)
  --questions <path>       Questions JSON (default: ab-demo/skyforge-questions.json)
  --output <path>          Results JSON (default: ab-demo/results/skyforge-<date>.json)
  --dry-run                Validate questions + anchors only
  --record-scores <file>   Merge humanScores into results and compute pass
  --scores <file>          JSON array of { questionId, baseline, repomind } scores
  --baseline-transcript    Optional transcript JSONL for baseline token override
  --repomind-transcript    Optional transcript JSONL for repomind token override
`);
}

function parseScoresFile(filePath: string): HumanScoreEntry[] {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error('--scores file must be a JSON array');
  }

  return parsed.map((raw, index) => {
    if (!raw || typeof raw !== 'object') {
      throw new Error(`scores[${index}] must be an object`);
    }
    const record = raw as Record<string, unknown>;
    if (typeof record.questionId !== 'string' || typeof record.baseline !== 'number') {
      throw new Error(`scores[${index}] requires questionId and baseline`);
    }
    if (typeof record.repomind !== 'number') {
      throw new Error(`scores[${index}] requires repomind`);
    }
    return {
      questionId: record.questionId,
      baseline: record.baseline,
      repomind: record.repomind,
      reviewer: typeof record.reviewer === 'string' ? record.reviewer : undefined,
      notes: typeof record.notes === 'string' ? record.notes : undefined,
    };
  });
}

function defaultOutputPath(abRoot: string): string {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return path.join(resultsDir(abRoot), `skyforge-${stamp}.json`);
}

export function runAbEval(options: AbEvalOptions = {}): number {
  if (options.recordScores) {
    const scoresPath = options.scoresFile;
    if (!scoresPath) {
      console.error('--record-scores requires --scores <file>');
      return 1;
    }
    try {
      const scores = parseScoresFile(scoresPath);
      const merged = mergeHumanScores(options.recordScores, scores, options.output);
      console.log(`pass: ${merged.pass}`);
      console.log(`tokenPass: ${merged.tokenPass}, hallucinationPass: ${merged.hallucinationPass}`);
      if (merged.categoryWins) {
        for (const row of merged.categoryWins) {
          console.log(
            `  ${row.category}: repomindWins=${row.repomindWins} (hallucination ${row.repomindHallucinationTotal} vs ${row.baselineHallucinationTotal})`,
          );
        }
      }
      console.log(`wrote ${options.output ?? options.recordScores}`);
      return 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      return 1;
    }
  }

  const cwd = options.cwd;
  if (!cwd) {
    console.error('--cwd is required for live eval');
    printUsage();
    return 1;
  }

  const abRoot = resolveAbDemoRoot(cwd);
  const questionsFile = options.questions ?? defaultSkyforgeQuestionsPath(abRoot);
  const outputPath = options.output ?? defaultOutputPath(abRoot);

  try {
    return runLiveEval({
      cwd,
      questionsFile,
      outputPath,
      dryRun: options.dryRun,
      baselineTranscript: options.baselineTranscript,
      repomindTranscript: options.repomindTranscript,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }
}
