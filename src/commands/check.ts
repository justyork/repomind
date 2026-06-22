import path from 'node:path';
import { collectCheckReport, type CheckViolation } from '../check/collect-violations.js';
import { DocIndex } from '../index/doc-index.js';

export type { CheckViolation };

export interface CheckOptions {
  cwd?: string;
}

export function runCheck(options: CheckOptions = {}): number {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const index = new DocIndex(cwd);
  const report = collectCheckReport(index);

  if (!report) {
    console.error('no docs/ found — run `repo-mind init` or create a docs/ directory');
    return 1;
  }

  for (const violation of report.violations) {
    console.error(`${violation.path}: ${violation.message}`);
  }
  for (const warning of report.warnings) {
    console.warn(`warning: ${warning}`);
  }

  return report.ok ? 0 : 1;
}
