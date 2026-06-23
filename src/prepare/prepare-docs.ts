import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { DocIndex } from '../index/doc-index.js';
import { inferTypeFromRelative, resolveDomain } from '../index/path-inference.js';
import { isValidSlug, slugFromRelativePath } from '../index/slug.js';
import { isDocType, type DocDomain, type DocStatus, type DocType } from '../index/types.js';

export interface UnpreparedFile {
  relativePath: string;
  path: string;
  suggestedType: DocType;
  suggestedSlug: string;
  suggestedTitle: string;
}

export interface PrepareOptions {
  type?: DocType;
  slug?: string;
  title?: string;
  status?: DocStatus;
  domain?: DocDomain;
}

export interface PrepareResult {
  path: string;
  relativePath: string;
  slug: string;
  type: DocType;
  domain: DocDomain;
}

function titleFromSlug(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function listUnpreparedFiles(index: DocIndex): UnpreparedFile[] {
  return index
    .listUnprepared()
    .filter((doc) => doc.contentKind === 'markdown')
    .map((doc) => ({
      relativePath: doc.relativePath,
      path: doc.path,
      suggestedType: doc.type,
      suggestedSlug: doc.slug,
      suggestedTitle: doc.title,
    }));
}

export function prepareDocFile(
  index: DocIndex,
  relativePath: string,
  options: PrepareOptions = {},
): PrepareResult {
  const knowledgeRoot = index.getKnowledgeRoot();
  if (!knowledgeRoot) {
    throw new Error('no docs/ directory found');
  }

  const normalized = relativePath.replace(/\\/g, '/').replace(/^\.\//, '');
  const absolutePath = path.resolve(knowledgeRoot, normalized);
  const rootWithSep = knowledgeRoot.endsWith(path.sep)
    ? knowledgeRoot
    : `${knowledgeRoot}${path.sep}`;

  if (!absolutePath.startsWith(rootWithSep) || !fs.existsSync(absolutePath)) {
    throw new Error(`file not found: ${relativePath}`);
  }

  const raw = fs.readFileSync(absolutePath, 'utf8');
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;

  if (typeof data.type === 'string' && isDocType(data.type)) {
    throw new Error(`file already prepared: ${relativePath}`);
  }

  const inferredType = options.type ?? inferTypeFromRelative(normalized);
  const domain = options.domain ?? resolveDomain(normalized, data.domain);
  const slug =
    options.slug ??
    (typeof data.slug === 'string' && isValidSlug(data.slug)
      ? data.slug
      : slugFromRelativePath(normalized));
  const title =
    options.title ??
    (typeof data.title === 'string' ? data.title : titleFromSlug(slug));
  const status = options.status ?? 'accepted';

  const frontmatter = {
    type: inferredType,
    slug,
    status,
    domain,
    title,
    tags: Array.isArray(data.tags)
      ? data.tags.filter((item): item is string => typeof item === 'string')
      : [],
    related: Array.isArray(data.related)
      ? data.related.filter((item): item is string => typeof item === 'string')
      : [],
    updated: new Date().toISOString().slice(0, 10),
  };

  const markdown = matter.stringify(parsed.content, frontmatter);
  fs.writeFileSync(absolutePath, markdown, 'utf8');
  index.refresh();

  return {
    path: absolutePath,
    relativePath: normalized,
    slug,
    type: inferredType,
    domain,
  };
}

export interface PrepareAllOptions extends PrepareOptions {
  dryRun?: boolean;
}

export interface PrepareAllResult {
  prepared: PrepareResult[];
  skipped: Array<{ relativePath: string; reason: string }>;
}

export function prepareAllDocs(
  index: DocIndex,
  options: PrepareAllOptions = {},
): PrepareAllResult {
  const unprepared = listUnpreparedFiles(index);
  const prepared: PrepareResult[] = [];
  const skipped: Array<{ relativePath: string; reason: string }> = [];

  for (const file of unprepared) {
    if (options.dryRun) {
      prepared.push({
        path: file.path,
        relativePath: file.relativePath,
        slug: file.suggestedSlug,
        type: file.suggestedType,
        domain: resolveDomain(file.relativePath, undefined),
      });
      continue;
    }

    try {
      prepared.push(
        prepareDocFile(index, file.relativePath, {
          type: options.type,
          slug: options.slug,
          title: options.title,
          status: options.status,
        }),
      );
    } catch (error) {
      skipped.push({
        relativePath: file.relativePath,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { prepared, skipped };
}
