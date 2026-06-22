import fs from 'node:fs';
import matter from 'gray-matter';
import { listMarkdownFiles } from '../index/doc-index.js';

const WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function replaceWikilinksInBody(body: string, fromSlug: string, toSlug: string): string {
  return body.replace(WIKILINK_PATTERN, (full, display: string, slugPart?: string) => {
    const target = (slugPart ?? display).trim();
    if (target !== fromSlug) {
      return full;
    }
    const label = display.trim();
    if (slugPart) {
      return `[[${label}|${toSlug}]]`;
    }
    if (label === fromSlug) {
      return `[[${toSlug}]]`;
    }
    return `[[${label}|${toSlug}]]`;
  });
}

function removeWikilinksInBody(body: string, slug: string): string {
  return body.replace(WIKILINK_PATTERN, (full, display: string, slugPart?: string) => {
    const target = (slugPart ?? display).trim();
    if (target !== slug) {
      return full;
    }
    const label = display.trim();
    return label || slug;
  });
}

function replaceInRelated(related: string[], fromSlug: string, toSlug: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of related) {
    const next = entry === fromSlug ? toSlug : entry;
    if (seen.has(next)) {
      continue;
    }
    seen.add(next);
    result.push(next);
  }
  return result;
}

function removeFromRelated(related: string[], slug: string): string[] {
  return related.filter((entry) => entry !== slug);
}

function updateMarkdownFile(
  absolutePath: string,
  mutate: (body: string, related: string[]) => { body: string; related: string[] },
): boolean {
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;
  const related = normalizeStringArray(data.related);
  const next = mutate(parsed.content, related);
  const bodyChanged = next.body !== parsed.content;
  const relatedChanged =
    next.related.length !== related.length || next.related.some((slug, index) => slug !== related[index]);
  if (!bodyChanged && !relatedChanged) {
    return false;
  }
  fs.writeFileSync(
    absolutePath,
    matter.stringify(next.body, {
      ...data,
      related: next.related,
    }),
    'utf8',
  );
  return true;
}

/** Rewrites inbound wikilinks and related frontmatter after a slug rename. */
export function cascadeSlugRename(
  knowledgeRoot: string,
  fromSlug: string,
  toSlug: string,
  options: { excludeAbsolutePath?: string } = {},
): string[] {
  if (fromSlug === toSlug) {
    return [];
  }

  const updated: string[] = [];
  for (const absolutePath of listMarkdownFiles(knowledgeRoot)) {
    if (options.excludeAbsolutePath && absolutePath === options.excludeAbsolutePath) {
      continue;
    }
    const changed = updateMarkdownFile(absolutePath, (body, related) => ({
      body: replaceWikilinksInBody(body, fromSlug, toSlug),
      related: replaceInRelated(related, fromSlug, toSlug),
    }));
    if (changed) {
      updated.push(absolutePath);
    }
  }
  return updated;
}

/** Removes inbound references to a deleted slug. */
export function cascadeSlugDelete(
  knowledgeRoot: string,
  deletedSlug: string,
  options: { excludeAbsolutePaths?: string[] } = {},
): string[] {
  const excluded = new Set(options.excludeAbsolutePaths ?? []);
  const updated: string[] = [];

  for (const absolutePath of listMarkdownFiles(knowledgeRoot)) {
    if (excluded.has(absolutePath)) {
      continue;
    }
    const changed = updateMarkdownFile(absolutePath, (body, related) => ({
      body: removeWikilinksInBody(body, deletedSlug),
      related: removeFromRelated(related, deletedSlug),
    }));
    if (changed) {
      updated.push(absolutePath);
    }
  }
  return updated;
}

export function toRelativePaths(knowledgeRoot: string, absolutePaths: string[]): string[] {
  const rootWithSep = knowledgeRoot.endsWith('/') ? knowledgeRoot : `${knowledgeRoot}/`;
  return absolutePaths.map((absolutePath) =>
    absolutePath.startsWith(rootWithSep)
      ? absolutePath.slice(rootWithSep.length).replace(/\\/g, '/')
      : absolutePath,
  );
}
