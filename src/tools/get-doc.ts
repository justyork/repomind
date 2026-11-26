import { isValidSlug } from '../index/slug.js';
import type { DocIndex } from '../index/doc-index.js';
import { getBacklinksForSlug } from '../index/link-index.js';
import type { DocFrontmatter } from '../index/types.js';
import { tokenizeWords } from '../search/terms.js';
import { buildLinkIndexForDocs } from './explore-graph.js';

export interface DocHeading {
  level: number;
  heading: string;
}

export interface GetDocOptions {
  /** Include the heading outline of the body. */
  outline?: boolean;
  /** Return only this section (matched by heading text or its kebab-case form). */
  section?: string;
  /** Truncate the returned body to this many characters. */
  maxChars?: number;
  /** Include documents that link to this one. */
  backlinks?: boolean;
  /** On a miss, suggest similar slugs. */
  suggestions?: boolean;
}

/** Options the MCP get_doc tool always applies (cheap, agent-useful extras). */
export const MCP_GET_DOC_OPTIONS: GetDocOptions = {
  outline: true,
  backlinks: true,
  suggestions: true,
};

export interface GetDocResult {
  found: boolean;
  slug?: string;
  path?: string;
  contentKind?: 'markdown' | 'yaml' | 'json';
  frontmatter?: DocFrontmatter;
  body?: string;
  outline?: DocHeading[];
  /** Heading of the returned section when `section` was requested and found. */
  section?: string;
  section_found?: boolean;
  truncated?: boolean;
  total_chars?: number;
  backlinks?: Array<{ slug: string; title: string; kind: string }>;
  suggestions?: string[];
}

const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE_PATTERN = /^\s*(```|~~~)/;

interface ParsedHeading extends DocHeading {
  line: number;
}

function parseHeadings(body: string): ParsedHeading[] {
  const headings: ParsedHeading[] = [];
  let inFence = false;
  body.split('\n').forEach((text, line) => {
    if (FENCE_PATTERN.test(text)) {
      inFence = !inFence;
      return;
    }
    if (inFence) {
      return;
    }
    const match = HEADING_PATTERN.exec(text);
    if (match) {
      headings.push({ level: match[1]!.length, heading: match[2]!.trim(), line });
    }
  });
  return headings;
}

function kebab(text: string): string {
  return tokenizeWords(text).join('-');
}

function extractSection(
  body: string,
  headings: ParsedHeading[],
  wanted: string,
): { heading: string; text: string } | null {
  const needle = wanted.trim().toLowerCase();
  const needleKebab = kebab(wanted);
  const index = headings.findIndex(
    (h) => h.heading.toLowerCase() === needle || kebab(h.heading) === needleKebab,
  );
  if (index < 0) {
    return null;
  }
  const start = headings[index]!;
  const next = headings.slice(index + 1).find((h) => h.level <= start.level);
  const lines = body.split('\n');
  const text = lines.slice(start.line, next ? next.line : lines.length).join('\n').trim();
  return { heading: start.heading, text };
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length]!;
}

function suggestSlugs(index: DocIndex, requested: string): string[] {
  const query = kebab(requested);
  if (!query) {
    return [];
  }
  return index
    .refresh()
    .map((doc) => {
      const slug = doc.slug;
      const contains = slug.includes(query) || query.includes(slug) || kebab(doc.title).includes(query);
      const distance = editDistance(slug, query);
      return { slug, rank: contains ? 0 : distance <= 2 ? distance : Number.POSITIVE_INFINITY };
    })
    .filter((entry) => Number.isFinite(entry.rank))
    .sort((a, b) => a.rank - b.rank || a.slug.localeCompare(b.slug))
    .slice(0, 5)
    .map((entry) => entry.slug);
}

export function getDoc(index: DocIndex, slug: string, options: GetDocOptions = {}): GetDocResult {
  if (!index.getKnowledgeRoot()) {
    return { found: false };
  }

  const doc = isValidSlug(slug) ? index.getDocBySlug(slug) : null;
  if (!doc) {
    if (options.suggestions) {
      return { found: false, suggestions: suggestSlugs(index, slug) };
    }
    return { found: false };
  }

  const result: GetDocResult = {
    found: true,
    slug: doc.slug,
    path: doc.path,
    contentKind: doc.contentKind,
    frontmatter: doc.frontmatter,
    body: doc.body,
  };

  const isMarkdown = doc.contentKind === 'markdown';
  const headings = isMarkdown ? parseHeadings(doc.body) : [];
  const plainOutline = headings.map(({ level, heading }) => ({ level, heading }));

  if (options.outline) {
    result.outline = plainOutline;
  }

  if (options.section) {
    const section = extractSection(doc.body, headings, options.section);
    if (section) {
      result.body = section.text;
      result.section = section.heading;
      result.section_found = true;
    } else {
      result.section_found = false;
      result.outline = plainOutline;
    }
  }

  if (typeof options.maxChars === 'number' && options.maxChars > 0 && result.body !== undefined) {
    const total = result.body.length;
    if (total > options.maxChars) {
      result.body = result.body.slice(0, Math.floor(options.maxChars));
      result.truncated = true;
      result.total_chars = total;
    }
  }

  if (options.backlinks) {
    const docsBySlug = new Map(index.refresh().map((record) => [record.slug, record]));
    const seenSlugs = new Set<string>();
    result.backlinks = getBacklinksForSlug(buildLinkIndexForDocs(index), doc.slug, docsBySlug).filter(
      (entry) => {
        if (entry.kind === 'parent_of' || seenSlugs.has(entry.slug)) {
          return false;
        }
        seenSlugs.add(entry.slug);
        return true;
      },
    );
  }

  return result;
}
