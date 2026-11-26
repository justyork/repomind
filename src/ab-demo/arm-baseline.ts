import type { DocIndex } from '../index/doc-index.js';
import type { DocRecord } from '../index/types.js';
import { extractAskSearchTerms, stemWord } from '../search/terms.js';
import { estimateTokens } from './estimate-tokens.js';
import type { ArmBaselineResult } from './types.js';
import type { AbQuestion } from './types.js';

/** A grep-driven agent opens the few best-matching files, not every hit. */
export const BASELINE_MAX_FILES = 3;

interface GrepHit {
  doc: DocRecord;
  distinct: number;
  occurrences: number;
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return count;
    count += 1;
    from = at + needle.length;
  }
}

/** Greps each meaningful term (as a stem, like `grep -i`) and ranks files by distinct terms, then hits. */
function grepDocs(docs: DocRecord[], terms: string[]): GrepHit[] {
  // A grepping agent searches a word root (e.g. "топлив"), so cap the pattern at 6 chars.
  const stems = terms.map((term) => stemWord(term).slice(0, 6));
  const hits: GrepHit[] = [];
  for (const doc of docs) {
    const haystack = `${doc.title}\n${doc.tags.join(' ')}\n${doc.body}`.toLowerCase();
    let distinct = 0;
    let occurrences = 0;
    for (const stem of stems) {
      const found = countOccurrences(haystack, stem);
      if (found > 0) {
        distinct += 1;
        occurrences += found;
      }
    }
    if (distinct > 0) hits.push({ doc, distinct, occurrences });
  }
  return hits.sort(
    (a, b) => b.distinct - a.distinct || b.occurrences - a.occurrences || a.doc.slug.localeCompare(b.doc.slug),
  );
}

/** Files a grep-driven agent would open for this question (shared by the token arm and live answers). */
export function selectBaselineDocs(
  index: DocIndex,
  question: AbQuestion,
): { docs: DocRecord[]; strategy: ArmBaselineResult['strategy'] } {
  const all = index.refresh();
  const hits = grepDocs(all, extractAskSearchTerms(question.prompt));
  if (hits.length === 0) {
    return { docs: all, strategy: 'read-all' };
  }
  return { docs: hits.slice(0, BASELINE_MAX_FILES).map((hit) => hit.doc), strategy: 'grep-then-read' };
}

/**
 * Arm A: plain markdown + minimal CLAUDE.md.
 * Simulates grep-then-read of the top few files (whole files, as an agent's Read would);
 * falls back to reading the full corpus when nothing matches.
 */
export function runArmBaseline(
  index: DocIndex,
  question: AbQuestion,
  sessionOverheadPerQuestion: number,
): ArmBaselineResult {
  const { docs: matched, strategy } = selectBaselineDocs(index, question);

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
    anchorRead: matched.some((doc) => question.anchorSlugs.includes(doc.slug)),
  };
}
