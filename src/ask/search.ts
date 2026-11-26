import type { DocIndex } from '../index/doc-index.js';
import { searchDocs, type SearchDocsResult } from '../tools/search-docs.js';
import { extractAskSearchTerms } from '../search/terms.js';

export { extractAskSearchTerms };

function scoreDocForTerms(
  doc: { title: string; tags: string[]; body: string },
  terms: string[],
): number | null {
  const titleLower = doc.title.toLowerCase();
  const bodyLower = doc.body.toLowerCase();
  const tagsLower = doc.tags.map((tag) => tag.toLowerCase());

  let score = 0;
  let matches = 0;

  for (const term of terms) {
    let termScore = 0;
    if (tagsLower.some((tag) => tag.includes(term))) {
      termScore = 3;
    }
    if (titleLower.includes(term)) {
      termScore = Math.max(termScore, 2);
    }
    if (bodyLower.includes(term)) {
      termScore = Math.max(termScore, 1);
    }
    if (termScore > 0) {
      matches += 1;
      score += termScore;
    }
  }

  if (matches === 0) {
    return null;
  }

  if (matches === terms.length) {
    score += 2;
  }

  return score;
}

export function searchDocsWithOrTerms(index: DocIndex, terms: string[]): SearchDocsResult[] {
  if (terms.length === 0) {
    return [];
  }

  const docs = index.refresh();
  const results: SearchDocsResult[] = [];

  for (const doc of docs) {
    const score = scoreDocForTerms(doc, terms);
    if (score === null) {
      continue;
    }

    const snippetSource = terms.find((term) => doc.body.toLowerCase().includes(term)) ?? terms[0]!;
    const lowerBody = doc.body.toLowerCase();
    const indexOf = lowerBody.indexOf(snippetSource);
    const snippet =
      indexOf >= 0
        ? doc.body
            .slice(Math.max(0, indexOf - 40), Math.min(doc.body.length, indexOf + snippetSource.length + 40))
            .replace(/\s+/g, ' ')
            .trim()
        : doc.body.slice(0, 120).replace(/\s+/g, ' ').trim();

    results.push({
      slug: doc.slug,
      title: doc.title,
      snippet,
      score,
    });
  }

  return results
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
    .slice(0, 20);
}

/** Relaxed search tuned for natural-language ask questions. */
export function searchDocsForAsk(index: DocIndex, question: string): SearchDocsResult[] {
  const trimmed = question.trim();
  if (!trimmed) {
    return [];
  }

  const strict = searchDocs(index, { query: trimmed });
  if (strict.length > 0) {
    return strict;
  }

  const terms = extractAskSearchTerms(trimmed);
  if (terms.length === 0) {
    return [];
  }

  const andQuery = searchDocs(index, { query: terms.join(' ') });
  if (andQuery.length > 0) {
    return andQuery;
  }

  return searchDocsWithOrTerms(index, terms);
}
