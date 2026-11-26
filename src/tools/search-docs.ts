import type { SemanticHit } from '../embeddings/types.js';
import type { DocIndex } from '../index/doc-index.js';
import type { DocDomain, DocRecord, DocStatus, DocType } from '../index/types.js';
import {
  extractSection,
  kebab,
  parseHeadings,
  splitFlatSections,
} from '../search/sections.js';
import {
  TERM_PATTERN,
  extractAskSearchTerms,
  stemWord,
  stemsCompatible,
  tokenizeWords,
} from '../search/terms.js';

export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 50;
/** Default `limit` advertised by the MCP search_docs tool (agents rarely need more). */
export const MCP_DEFAULT_SEARCH_LIMIT = 5;
export const DEFAULT_TOP_CHARS = 1200;

const BM25_K1 = 1.2;
const BM25_B = 0.75;
/** Small k keeps a #1 hit in either list worth much more than a mid-table hit in both. */
const RRF_K = 10;
/** After fusion a stale status only breaks near-ties; the hit still carries its status for the agent to judge. */
const FUSED_STATUS_MULTIPLIER: Record<DocStatus, number> = {
  accepted: 1,
  proposed: 1,
  draft: 0.97,
  superseded: 0.95,
};
/** A semantic section hint wins over the lexical one when the page ranks this high semantically. */
const SEMANTIC_SECTION_RANK = 5;
const TITLE_WEIGHT = 3;
const TAG_WEIGHT = 3;
const STATUS_MULTIPLIER: Record<DocStatus, number> = {
  accepted: 1,
  proposed: 0.95,
  draft: 0.85,
  superseded: 0.6,
};

export interface SearchDocsInput {
  query: string;
  type?: DocType;
  domain?: DocDomain;
  status?: DocStatus;
  limit?: number;
  /** Attach the best-matching section text to the top hit. */
  includeTop?: boolean;
  topChars?: number;
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
  /** Heading of the best-matching section (omitted for intro text or headingless pages). */
  section?: string;
  /** Best section text, only on the first hit and only when includeTop is set. */
  top?: { section?: string; text: string };
  /** `all`: every query term matched; `any`: relaxed fallback (some terms matched). */
  matchMode?: 'all' | 'any' | 'semantic';
}

interface WordStats {
  length: number;
  counts: Map<string, number>;
}

interface IndexedDoc {
  doc: DocRecord;
  title: WordStats;
  tags: WordStats;
  body: WordStats;
}

// Records are replaced when a file changes (mtime cache in DocIndex), so this stays fresh.
const indexedCache = new WeakMap<DocRecord, IndexedDoc>();

function statsOf(words: string[]): WordStats {
  const counts = new Map<string, number>();
  for (const word of words) {
    const stem = stemWord(word);
    counts.set(stem, (counts.get(stem) ?? 0) + 1);
  }
  return { length: words.length, counts };
}

function indexDoc(doc: DocRecord): IndexedDoc {
  const cached = indexedCache.get(doc);
  if (cached) return cached;
  const indexed: IndexedDoc = {
    doc,
    // Slug words count as title words: English slugs are a strong signal for non-English titles.
    title: statsOf([...tokenizeWords(doc.title), ...tokenizeWords(doc.slug)]),
    tags: statsOf(doc.tags.flatMap((tag) => tokenizeWords(tag))),
    body: statsOf(tokenizeWords(doc.body)),
  };
  indexedCache.set(doc, indexed);
  return indexed;
}

function countPrefix(stats: WordStats, stem: string): number {
  let total = 0;
  for (const [docStem, count] of stats.counts) {
    if (stemsCompatible(docStem, stem)) total += count;
  }
  return total;
}

function weightedTf(indexed: IndexedDoc, stem: string): number {
  return (
    TAG_WEIGHT * countPrefix(indexed.tags, stem) +
    TITLE_WEIGHT * countPrefix(indexed.title, stem) +
    countPrefix(indexed.body, stem)
  );
}

interface Scored {
  indexed: IndexedDoc;
  score: number;
  matched: number;
}

/**
 * Single-pass BM25F-style scoring. Docs matching more of the query rank higher via a mild
 * coverage factor, but a missing filler word never removes a precise page from the results.
 */
function scoreCandidates(
  candidates: IndexedDoc[],
  terms: string[],
  boosts: (doc: DocRecord) => number,
): Scored[] {
  if (candidates.length === 0) return [];
  const stems = terms.map(stemWord);
  const tfs = candidates.map((indexed) => stems.map((stem) => weightedTf(indexed, stem)));
  const n = candidates.length;
  const idf = stems.map((_, t) => {
    const df = tfs.reduce((sum, row) => sum + (row[t]! > 0 ? 1 : 0), 0);
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  });
  const avgLength = Math.max(
    1,
    candidates.reduce((sum, c) => sum + c.body.length + c.title.length, 0) / n,
  );

  const scored: Scored[] = [];
  candidates.forEach((indexed, i) => {
    const row = tfs[i]!;
    const matched = row.filter((tf) => tf > 0).length;
    if (matched === 0) return;
    const length = indexed.body.length + indexed.title.length;
    const norm = BM25_K1 * (1 - BM25_B + (BM25_B * length) / avgLength);
    let score = 0;
    row.forEach((tf, t) => {
      if (tf > 0) score += idf[t]! * ((tf * (BM25_K1 + 1)) / (tf + norm));
    });
    score *= 0.5 + (0.5 * matched) / terms.length;
    score *= boosts(indexed.doc);
    scored.push({ indexed, score, matched });
  });
  return scored;
}

function clampLimit(limit: number | undefined): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) return DEFAULT_SEARCH_LIMIT;
  return Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.floor(limit)));
}

function snippetFrom(text: string, terms: string[]): string {
  const stems = terms.map(stemWord);
  for (const match of text.toLowerCase().matchAll(TERM_PATTERN)) {
    const wordStem = stemWord(match[0]);
    if (stems.some((stem) => stemsCompatible(wordStem, stem))) {
      const index = match.index ?? 0;
      const start = Math.max(0, index - 40);
      const end = Math.min(text.length, index + match[0].length + 40);
      return text.slice(start, end).replace(/\s+/g, ' ').trim();
    }
  }
  return text.slice(0, 120).replace(/\s+/g, ' ').trim();
}

interface SectionPick {
  heading: string | null;
  text: string;
}

/** Picks the flat section whose words match the most query terms (earliest wins ties). */
function pickBestSection(doc: DocRecord, terms: string[]): SectionPick | null {
  if (doc.contentKind !== 'markdown') return null;
  const headings = parseHeadings(doc.body);
  if (headings.length === 0) return null;
  const stems = terms.map(stemWord);
  let best: SectionPick | null = null;
  let bestScore = -1;
  for (const section of splitFlatSections(doc.body, headings)) {
    const wordStems = tokenizeWords(`${section.heading ?? ''} ${section.text}`).map(stemWord);
    let score = 0;
    for (const stem of stems) {
      if (wordStems.some((wordStem) => stemsCompatible(wordStem, stem))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = section;
    }
  }
  return bestScore > 0 ? best : null;
}

interface Ranked {
  indexed: IndexedDoc;
  score: number;
  /** Query terms matched lexically (0 = found only by meaning). */
  matched: number;
  semantic?: SemanticHit;
  semanticRank?: number;
}

/** Reciprocal-rank fusion of the BM25 ordering and the vector ordering. */
function fuseRankings(scored: Scored[], semanticHits: SemanticHit[], candidates: IndexedDoc[]): Ranked[] {
  const bySlug = new Map(candidates.map((candidate) => [candidate.doc.slug, candidate]));
  const entries = new Map<string, Ranked>();
  scored.forEach((entry, rank) => {
    entries.set(entry.indexed.doc.slug, {
      indexed: entry.indexed,
      score: 1 / (RRF_K + rank + 1),
      matched: entry.matched,
    });
  });
  let semanticRank = 0;
  for (const hit of semanticHits) {
    const indexed = bySlug.get(hit.slug);
    if (!indexed) continue; // removed by type/domain/status filters
    const entry = entries.get(hit.slug) ?? { indexed, score: 0, matched: 0 };
    entry.score += 1 / (RRF_K + semanticRank + 1);
    entry.semantic = hit;
    entry.semanticRank = semanticRank;
    entries.set(hit.slug, entry);
    semanticRank += 1;
  }
  for (const entry of entries.values()) {
    entry.score *= FUSED_STATUS_MULTIPLIER[entry.indexed.doc.status];
  }
  return [...entries.values()];
}

function sectionText(doc: DocRecord, heading: string): string | undefined {
  if (doc.contentKind !== 'markdown') return undefined;
  return splitFlatSections(doc.body, parseHeadings(doc.body)).find((section) => section.heading === heading)?.text;
}

export function searchDocs(index: DocIndex, input: SearchDocsInput): SearchDocsResult[] {
  if (!index.getKnowledgeRoot()) {
    return [];
  }

  const terms = [...new Set(tokenizeWords(input.query))];
  if (terms.length === 0) {
    return [];
  }

  const allDocs = index.refresh();
  let docs = allDocs;
  if (input.type) docs = docs.filter((doc) => doc.type === input.type);
  if (input.domain) docs = docs.filter((doc) => doc.domain === input.domain);
  if (input.status) docs = docs.filter((doc) => doc.status === input.status);

  const inbound = new Map<string, number>();
  for (const doc of allDocs) {
    for (const target of new Set(doc.related)) {
      if (target !== doc.slug) inbound.set(target, (inbound.get(target) ?? 0) + 1);
    }
  }
  const queryKebab = kebab(input.query);
  const queryStems = terms.map(stemWord);
  const queryNamesTitle = (title: string): boolean => {
    const words = tokenizeWords(title).map(stemWord);
    return words.length > 0 && words.every((word) => queryStems.some((stem) => stemsCompatible(word, stem)));
  };
  const queryLower = input.query.trim().toLowerCase();
  // With a vector index the status penalty is applied once, after fusion.
  const semanticHits = index.semantic?.lookup(input.query) ?? null;
  const fused = semanticHits !== null && semanticHits.length > 0;
  const boosts = (doc: DocRecord): number => {
    let multiplier = fused ? 1 : STATUS_MULTIPLIER[doc.status];
    multiplier *= 1 + 0.1 * Math.min(inbound.get(doc.slug) ?? 0, 5);
    if (doc.slug === queryKebab || doc.title.toLowerCase() === queryLower) {
      multiplier *= 2;
    } else if (queryNamesTitle(doc.title)) {
      // The query mentions every word of the page title: the page is probably the subject.
      multiplier *= 2;
    }
    return multiplier;
  };

  const candidates = docs.map(indexDoc);
  const meaningful = extractAskSearchTerms(input.query);
  const usedTerms = meaningful.length > 0 ? meaningful : terms;
  const scored = scoreCandidates(candidates, usedTerms, boosts);

  scored.sort((a, b) => b.score - a.score || a.indexed.doc.slug.localeCompare(b.indexed.doc.slug));

  const ranked: Ranked[] = fused
    ? fuseRankings(scored, semanticHits, candidates)
    : scored.map((entry) => ({ ...entry }));
  ranked.sort((a, b) => b.score - a.score || a.indexed.doc.slug.localeCompare(b.indexed.doc.slug));

  const topChars = input.topChars ?? DEFAULT_TOP_CHARS;
  return ranked.slice(0, clampLimit(input.limit)).map((entry, rank) => {
    const { doc } = entry.indexed;
    const lexicalPick = entry.matched > 0 ? pickBestSection(doc, usedTerms) : null;
    const semanticSection = entry.semantic?.section;
    const preferSemantic =
      semanticSection !== undefined &&
      (lexicalPick === null || (entry.semanticRank ?? Infinity) < SEMANTIC_SECTION_RANK);
    const section = preferSemantic ? semanticSection : lexicalPick?.heading ?? undefined;
    const sectionBody = preferSemantic ? sectionText(doc, semanticSection) : lexicalPick?.text;
    const result: SearchDocsResult = {
      slug: doc.slug,
      title: doc.title,
      snippet: snippetFrom(sectionBody || doc.body, usedTerms),
      score: fused ? Math.round(entry.score * 1e4) / 1e4 : Math.round(entry.score * 100) / 100,
      type: doc.type,
      domain: doc.domain,
      status: doc.status,
      relativePath: doc.relativePath,
      ...(doc.frontmatter.updated ? { updated: doc.frontmatter.updated } : {}),
      ...(section ? { section } : {}),
      matchMode: entry.matched === 0 ? 'semantic' : entry.matched === usedTerms.length ? 'all' : 'any',
    };
    if (input.includeTop && rank === 0) {
      const full = section
        ? extractSection(doc.body, parseHeadings(doc.body), section)?.text ?? sectionBody ?? doc.body
        : doc.body;
      result.top = { ...(section ? { section } : {}), text: full.slice(0, topChars) };
    }
    return result;
  });
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
    ...(hit.section ? { section: hit.section } : {}),
    snippet: hit.snippet,
    ...(hit.matchMode && hit.matchMode !== 'all' ? { matchMode: hit.matchMode } : {}),
    ...(hit.top ? { top: hit.top } : {}),
  };
}
