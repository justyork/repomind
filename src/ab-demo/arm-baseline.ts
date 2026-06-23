import type { DocIndex } from '../index/doc-index.js';
import type { DocRecord } from '../index/types.js';
import { estimateTokens } from './estimate-tokens.js';
import type { ArmBaselineResult } from './types.js';
import type { AbQuestion } from './types.js';

function queryTerms(prompt: string): string[] {
  return prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3);
}

function docMatchesTerms(doc: DocRecord, terms: string[]): boolean {
  if (terms.length === 0) {
    return true;
  }
  const haystack = `${doc.title}\n${doc.tags.join(' ')}\n${doc.body}`.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

/**
 * Arm A: plain markdown + minimal CLAUDE.md.
 * Simulates grep-then-read; falls back to reading the full corpus when nothing matches.
 */
export function runArmBaseline(
  index: DocIndex,
  question: AbQuestion,
  sessionOverheadPerQuestion: number,
): ArmBaselineResult {
  const docs = index.refresh();
  const terms = queryTerms(question.prompt);
  let matched = docs.filter((doc) => docMatchesTerms(doc, terms));
  let strategy: ArmBaselineResult['strategy'] = 'grep-then-read';

  if (matched.length === 0) {
    matched = docs;
    strategy = 'read-all';
  }

  let tokens = sessionOverheadPerQuestion;
  for (const doc of matched) {
    tokens += estimateTokens(doc.body);
    tokens += estimateTokens(doc.relativePath);
  }

  return {
    arm: 'baseline',
    questionId: question.id,
    tokens,
    filesRead: matched.length,
    strategy,
  };
}
