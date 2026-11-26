import type { DocIndex } from '../index/doc-index.js';
import type { DocDomain, DocRecord, DocStatus, DocType } from '../index/types.js';
import {
  TERM_PATTERN,
  extractAskSearchTerms,
  stemPrefix,
  tokenizeWords,
  wordsMatchTerm,
} from '../search/terms.js';

export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 50;
/** Default `limit` advertised by the MCP search_docs tool (agents rarely need more). */
export const MCP_DEFAULT_SEARCH_LIMIT = 5;

export interface SearchDocsInput {
  query: string;
  type?: DocType;
  domain?: DocDomain;
  status?: DocStatus;
  limit?: number;
}

export interface SearchDocsResult {
  slug: string;
  title: string;
  snippet: string;
  score: number;
  type?: DocType;
  domain?: DocDomain;
  status?: DocStatus;
  relativePath?: string;
  updated?: string;
  /** `all`: every query term matched; `any`: relaxed fallback (some terms matched). */
  matchMode?: 'all' | 'any';
}

interface DocWords {
  doc: DocRecord;
  title: string[];
  tags: string[];
  body: string[];
}

function toDocWords(doc: DocRecord): DocWords {
  return {
    doc,
    title: tokenizeWords(doc.title),
    tags: doc.tags.flatMap((tag) => tokenizeWords(tag)),
    body: tokenizeWords(doc.body),
  };
}

/** Returns the score for one term, or 0 when the term does not match. */
function termScore(words: DocWords, term: string): number {
  let score = 0;
  if (wordsMatchTerm(words.tags, term)) score = Math.max(score, 3);
  if (wordsMatchTerm(words.title, term)) score = Math.max(score, 2);
  if (wordsMatchTerm(words.body, term)) score = Math.max(score, 1);
  return score;
}

function scoreAll(words: DocWords, terms: string[]): number | null {
  let total = 0;
  for (const term of terms) {
    const score = termScore(words, term);
    if (score === 0) return null;
    total += score;
  }
  return total;
}

function scoreAny(words: DocWords, terms: string[]): number | null {
  let total = 0;
  let matches = 0;
  for (const term of terms) {
    const score = termScore(words, term);
    if (score > 0) {
      matches += 1;
      total += score;
    }
  }
  return matches === 0 ? null : total + matches;
}

function makeSnippet(body: string, terms: string[]): string {
  const stems = terms.map(stemPrefix);
  for (const match of body.toLowerCase().matchAll(TERM_PATTERN)) {
    if (stems.some((stem) => match[0].startsWith(stem))) {
      const index = match.index ?? 0;
      const start = Math.max(0, index - 40);
      const end = Math.min(body.length, index + match[0].length + 40);
      return body.slice(start, end).replace(/\s+/g, ' ').trim();
    }
  }
  return body.slice(0, 120).replace(/\s+/g, ' ').trim();
}

function clampLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return DEFAULT_SEARCH_LIMIT;
  return Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.floor(limit)));
}

function collect(
  candidates: DocWords[],
  terms: string[],
  mode: 'all' | 'any',
): SearchDocsResult[] {
  const results: SearchDocsResult[] = [];
  for (const words of candidates) {
    const score = mode === 'all' ? scoreAll(words, terms) : scoreAny(words, terms);
    if (score === null) continue;
    const { doc } = words;
    results.push({
      slug: doc.slug,
      title: doc.title,
      snippet: makeSnippet(doc.body, terms),
      score,
      type: doc.type,
      domain: doc.domain,
      status: doc.status,
      relativePath: doc.relativePath,
      ...(doc.frontmatter.updated ? { updated: doc.frontmatter.updated } : {}),
      matchMode: mode,
    });
  }
  return results;
}

/** Compact hit shape returned over MCP (drops score/path; matchMode only when relaxed). */
export function toMcpSearchHit(hit: SearchDocsResult): Record<string, unknown> {
  return {
    slug: hit.slug,
    title: hit.title,
    type: hit.type,
    status: hit.status,
    domain: hit.domain,
    ...(hit.updated ? { updated: hit.updated } : {}),
    snippet: hit.snippet,
    ...(hit.matchMode === 'any' ? { matchMode: 'any' } : {}),
  };
}

export function searchDocs(index: DocIndex, input: SearchDocsInput): SearchDocsResult[] {
  if (!index.getKnowledgeRoot()) {
    return [];
  }

  const terms = [...new Set(tokenizeWords(input.query))];
  if (terms.length === 0) {
    return [];
  }

  let docs = index.refresh();
  if (input.type) docs = docs.filter((doc) => doc.type === input.type);
  if (input.domain) docs = docs.filter((doc) => doc.domain === input.domain);
  if (input.status) docs = docs.filter((doc) => doc.status === input.status);

  const candidates = docs.map(toDocWords);
  const meaningful = extractAskSearchTerms(input.query);
  const relaxedTerms = meaningful.length > 0 ? meaningful : terms;

  // Strict AND -> stop words dropped -> any-term fallback.
  const attempts: Array<{ terms: string[]; mode: 'all' | 'any' }> = [{ terms, mode: 'all' }];
  if (relaxedTerms.length < terms.length) {
    attempts.push({ terms: relaxedTerms, mode: 'all' });
  }
  if (relaxedTerms.length > 1) {
    attempts.push({ terms: relaxedTerms, mode: 'any' });
  }

  let results: SearchDocsResult[] = [];
  for (const attempt of attempts) {
    results = collect(candidates, attempt.terms, attempt.mode);
    if (results.length > 0) break;
  }

  return results
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
    .slice(0, clampLimit(input.limit));
}
