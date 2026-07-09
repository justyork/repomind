import type { DocIndex } from '../index/doc-index.js';
import { searchDocs, type SearchDocsResult } from '../tools/search-docs.js';

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'what',
  'how',
  'why',
  'when',
  'where',
  'who',
  'which',
  'do',
  'does',
  'did',
  'can',
  'could',
  'should',
  'would',
  'will',
  'to',
  'of',
  'in',
  'on',
  'at',
  'for',
  'and',
  'or',
  'but',
  'not',
  'with',
  'about',
  'from',
  'into',
  'me',
  'my',
  'i',
  'you',
  'your',
  'we',
  'our',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'there',
  'tell',
  'please',
  'explain',
  'describe',
  'как',
  'что',
  'где',
  'когда',
  'почему',
  'кто',
  'какой',
  'какая',
  'какие',
  'какое',
  'каков',
  'какова',
  'каково',
  'это',
  'этот',
  'эта',
  'эти',
  'тот',
  'та',
  'те',
  'в',
  'во',
  'на',
  'с',
  'со',
  'по',
  'для',
  'из',
  'у',
  'о',
  'об',
  'от',
  'до',
  'при',
  'про',
  'над',
  'под',
  'и',
  'или',
  'не',
  'ни',
  'ли',
  'же',
  'бы',
  'мне',
  'меня',
  'мой',
  'моя',
  'мои',
  'твой',
  'твоя',
  'твои',
  'наш',
  'наша',
  'наши',
  'расскажи',
  'рассказать',
  'объясни',
  'объяснить',
  'покажи',
  'показать',
  'найди',
  'найти',
  'есть',
  'быть',
  'был',
  'была',
  'были',
]);

const TERM_PATTERN = /[a-z0-9\u0400-\u04ff]+/gi;

function uniqueTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const term of terms) {
    const normalized = term.toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

/** Extracts meaningful search terms from a natural-language question. */
export function extractAskSearchTerms(question: string): string[] {
  const raw = question.match(TERM_PATTERN) ?? [];
  const meaningful = raw.filter((term) => term.length >= 3 && !STOP_WORDS.has(term.toLowerCase()));
  if (meaningful.length > 0) {
    return uniqueTerms(meaningful);
  }

  return uniqueTerms(raw.filter((term) => term.length >= 2 && !STOP_WORDS.has(term.toLowerCase())));
}

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
