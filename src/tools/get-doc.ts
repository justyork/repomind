import { isValidSlug } from '../index/slug.js';
import type { DocIndex } from '../index/doc-index.js';
import { getBacklinksForSlug } from '../index/link-index.js';
import type { DocFrontmatter } from '../index/types.js';
import { extractSection, kebab, parseHeadings, type DocHeading } from '../search/sections.js';
import { buildLinkIndexForDocs } from './explore-graph.js';

export type { DocHeading };

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
  /** Bodies longer than this are cut to `previewChars` unless a section/maxChars was requested. */
  autoTruncateAbove?: number;
  previewChars?: number;
}

/** Options the MCP get_doc tool always applies (cheap, agent-useful extras). */
export const MCP_GET_DOC_OPTIONS: GetDocOptions = {
  outline: true,
  backlinks: true,
  suggestions: true,
  autoTruncateAbove: 3000,
  previewChars: 1500,
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
  hint?: string;
  backlinks?: Array<{ slug: string; title: string; kind: string }>;
  suggestions?: string[];
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

  if (
    result.body !== undefined &&
    !options.section &&
    options.maxChars === undefined &&
    options.autoTruncateAbove !== undefined &&
    result.body.length > options.autoTruncateAbove
  ) {
    const preview = options.previewChars ?? options.autoTruncateAbove;
    result.total_chars = result.body.length;
    result.body = result.body.slice(0, preview);
    result.truncated = true;
    result.hint = `Long page (${result.total_chars} chars): showing the first ${preview}. Pass section=<heading> (see outline) or full=true.`;
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

/** Compact projection returned over MCP: no filesystem path, no duplicated slug, no empty arrays. */
export function toMcpDoc(result: GetDocResult): Record<string, unknown> {
  if (!result.found) {
    return { found: false, ...(result.suggestions ? { suggestions: result.suggestions } : {}) };
  }
  const { slug: _slug, tags, related, ...frontmatter } = result.frontmatter ?? ({} as DocFrontmatter);
  const projected: Record<string, unknown> = {
    found: true,
    slug: result.slug,
    ...(result.contentKind && result.contentKind !== 'markdown' ? { contentKind: result.contentKind } : {}),
    frontmatter: {
      ...frontmatter,
      ...(tags && tags.length > 0 ? { tags } : {}),
      ...(related && related.length > 0 ? { related } : {}),
    },
    body: result.body,
  };
  for (const key of ['section', 'section_found', 'truncated', 'total_chars', 'hint', 'outline', 'backlinks'] as const) {
    const value = result[key];
    if (value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    projected[key] = value;
  }
  return projected;
}
