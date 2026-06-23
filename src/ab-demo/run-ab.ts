#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DocIndex } from '../index/doc-index.js';
import { loadQuestions } from './load-questions.js';
import {
  corpusPath,
  questionsPath,
  resolveAbDemoRoot,
  resultsDir,
  scoreRubricPath,
} from './paths.js';
import { runArmsComparison } from './run-arms.js';
import type { AbRunResult } from './types.js';
import { materializeCorpusRepo, validateCorpusAgainstQuestions } from './validate-corpus.js';

export interface RunAbOptions {
  cwd?: string;
  dryRun?: boolean;
  outputPath?: string;
}

function printUsage(): void {
  console.log(`repo-mind A/B demo harness (kill-switch eval)

Usage:
  npm run ab-demo -- [--dry-run] [--output <path>]

Options:
  --dry-run   Validate corpus + questions only (no agent runs)
  --output    Write results JSON (default: ab-demo/results/latest.json)
`);
}

function parseCliArgs(argv: string[]): RunAbOptions {
  const options: RunAbOptions = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--output') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('--output requires a path');
      }
      options.outputPath = value;
      i += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

export function runAbDemo(options: RunAbOptions = {}): number {
  const abRoot = resolveAbDemoRoot(options.cwd);
  const corpus = corpusPath(abRoot);
  const questionsFile = questionsPath(abRoot);
  const rubric = scoreRubricPath(abRoot);

  if (!fs.existsSync(rubric)) {
    console.error(`missing rubric: ${rubric}`);
    return 1;
  }

  let questions;
  try {
    questions = loadQuestions(questionsFile);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }

  let report;
  try {
    report = validateCorpusAgainstQuestions(corpus, questions.questions);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    return 1;
  }

  if (report.missingAnchors.length > 0) {
    console.error('corpus missing anchor slugs:');
    for (const missing of report.missingAnchors) {
      console.error(`  ${missing.questionId}: ${missing.slug}`);
    }
    return 1;
  }

  console.log(
    `corpus ok: ${report.docCount} docs, ${report.questionCount} questions`,
  );

  if (options.dryRun) {
    console.log('dry-run complete — agent arms not executed');
    return 0;
  }

  const workDir = materializeCorpusRepo(corpus);
  try {
    const index = new DocIndex(workDir);
    const arms = runArmsComparison(index, questions.questions);

    const outDir = resultsDir(abRoot);
    fs.mkdirSync(outDir, { recursive: true });
    const outputPath =
      options.outputPath ?? path.join(outDir, 'latest.json');

    const payload: AbRunResult = {
      runAt: new Date().toISOString(),
      corpusPath: corpus,
      questionsVersion: questions.version,
      arms,
      pass: arms.pass,
    };

    fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

    console.log(
      `baseline median tokens: ${arms.baseline.medianTokens} | repomind: ${arms.repomind.medianTokens}`,
    );
    console.log(
      `token wins: repomind ${arms.repomindTokenWins}/${questions.questions.length} (need ${arms.passThreshold})`,
    );
    console.log(`token pass: ${arms.tokenPass ? 'yes' : 'no'}`);
    console.log(`wrote ${outputPath}`);

    if (!arms.tokenPass) {
      return 1;
    }
    return 0;
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

function main(): void {
  try {
    const code = runAbDemo(parseCliArgs(process.argv.slice(2)));
    process.exit(code);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}

const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  main();
}
