import fs from 'node:fs';
import matter from 'gray-matter';
import type { DocIndex } from '../index/doc-index.js';
import { parseWikilinkTargets, resolveWikilinkTarget } from '../index/link-index.js';
import { slugForMarkdownHref } from '../index/resolve-md-href.js';
import type { DocRecord } from '../index/types.js';

const MARKDOWN_LINK_PATTERN = /\[([^\]]*)\]\(([^)]+)\)/g;

export interface SyncLinksOptions {
  dryRun?: boolean;
  /** Rewrite `[text](page.md)` as `[[slug]]` when the target resolves. */
  convertMarkdownLinks?: boolean;
  /** Merge outbound link slugs into frontmatter `related`. */
  syncRelated?: boolean;
}

export interface SyncLinksFileResult {
  relativePath: string;
  convertedLinks: number;
  addedRelated: string[];
  changed: boolean;
  skipped: boolean;
  reason?: string;
}

export interface SyncLinksResult {
  files: SyncLinksFileResult[];
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function buildSlugByRelative(docs: DocRecord[]): Map<string, string> {
  return new Map(docs.map((doc) => [doc.relativePath, doc.slug]));
}

function buildSlugLookups(docs: DocRecord[]): {
  slugSet: Set<string>;
  titleToSlug: Map<string, string>;
} {
  const slugSet = new Set(docs.map((doc) => doc.slug));
  const titleToSlug = new Map<string, string>();
  for (const doc of docs) {
    titleToSlug.set(doc.slug.toLowerCase(), doc.slug);
    titleToSlug.set(doc.title.toLowerCase(), doc.slug);
  }
  return { slugSet, titleToSlug };
}

function collectOutboundSlugs(
  body: string,
  fromDoc: DocRecord,
  docs: DocRecord[],
): string[] {
  const slugByRelative = buildSlugByRelative(docs);
  const lookups = buildSlugLookups(docs);
  const seen = new Set<string>();
  const result: string[] = [];

  function addSlug(slug: string | null | undefined): void {
    if (!slug || slug === fromDoc.slug || seen.has(slug)) {
      return;
    }
    seen.add(slug);
    result.push(slug);
  }

  for (const raw of parseWikilinkTargets(body)) {
    const resolved = resolveWikilinkTarget(raw, lookups);
    addSlug(resolved.slug);
  }

  for (const match of body.matchAll(MARKDOWN_LINK_PATTERN)) {
    const href = match[2]?.trim() ?? '';
    addSlug(slugForMarkdownHref(fromDoc.relativePath, href, slugByRelative));
  }

  return result;
}

function convertMarkdownLinksToWikilinks(
  body: string,
  fromRelative: string,
  slugByRelative: Map<string, string>,
): { body: string; count: number } {
  let count = 0;
  const nextBody = body.replace(MARKDOWN_LINK_PATTERN, (full, text: string, href: string) => {
    const slug = slugForMarkdownHref(fromRelative, href.trim(), slugByRelative);
    if (!slug) {
      return full;
    }
    count += 1;
    const label = text.trim();
    if (!label || label.toLowerCase() === slug.toLowerCase()) {
      return `[[${slug}]]`;
    }
    return `[[${label}|${slug}]]`;
  });
  return { body: nextBody, count };
}

export function syncDocLinks(
  index: DocIndex,
  doc: DocRecord,
  docs: DocRecord[],
  options: SyncLinksOptions = {},
): SyncLinksFileResult {
  const convertMarkdownLinks = options.convertMarkdownLinks ?? true;
  const syncRelated = options.syncRelated ?? true;

  if (doc.contentKind !== 'markdown') {
    return {
      relativePath: doc.relativePath,
      convertedLinks: 0,
      addedRelated: [],
      changed: false,
      skipped: true,
      reason: 'not markdown',
    };
  }

  const raw = fs.readFileSync(doc.path, 'utf8');
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  let body = parsed.content;
  const currentRelated = normalizeStringArray(data.related);
  const slugByRelative = buildSlugByRelative(docs);

  let convertedLinks = 0;
  if (convertMarkdownLinks) {
    const converted = convertMarkdownLinksToWikilinks(body, doc.relativePath, slugByRelative);
    body = converted.body;
    convertedLinks = converted.count;
  }

  const outbound = collectOutboundSlugs(body, doc, docs);
  const relatedSet = new Set(currentRelated);
  const addedRelated: string[] = [];
  if (syncRelated) {
    for (const slug of outbound) {
      if (!relatedSet.has(slug)) {
        relatedSet.add(slug);
        addedRelated.push(slug);
      }
    }
  }

  const nextRelated = syncRelated ? [...relatedSet] : currentRelated;
  const relatedChanged =
    syncRelated &&
    (nextRelated.length !== currentRelated.length ||
      nextRelated.some((slug, index) => slug !== currentRelated[index]));

  const bodyChanged = convertedLinks > 0;
  const changed = bodyChanged || relatedChanged;

  if (changed && !options.dryRun) {
    const frontmatter = {
      ...data,
      related: nextRelated,
    };
    fs.writeFileSync(doc.path, matter.stringify(body, frontmatter), 'utf8');
    index.refresh();
  }

  return {
    relativePath: doc.relativePath,
    convertedLinks,
    addedRelated,
    changed,
    skipped: false,
  };
}

export function syncAllDocLinks(
  index: DocIndex,
  options: SyncLinksOptions = {},
): SyncLinksResult {
  const docs = index.refresh().filter((doc) => doc.contentKind === 'markdown');
  const files = docs.map((doc) => syncDocLinks(index, doc, docs, options));
  return { files };
}
