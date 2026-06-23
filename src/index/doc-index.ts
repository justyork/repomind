import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import matter from 'gray-matter';
import { contentKindFromRelativePath } from './knowledge-file.js';
import { inferTypeFromRelative, resolveDomain } from './path-inference.js';
import { isValidSlug, slugFromRelativePath } from './slug.js';
import {
  type DocFrontmatter,
  type DocRecord,
  type DocStatus,
  type DocType,
  isDocStatus,
  isDocType,
} from './types.js';

/** Primary project knowledge directory — single source of truth for humans and agents. */
export const KNOWLEDGE_DIR = 'docs';

const GLOB_IGNORE = ['**/.repo-mind/**', '**/.worktrees/**'];

interface CacheEntry {
  mtimeMs: number;
  record: DocRecord;
}

export function discoverKnowledgeRoot(startDir: string): string | null {
  let current = path.resolve(startDir);

  while (true) {
    const candidate = path.join(current, KNOWLEDGE_DIR);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function inferSlug(relative: string, data: Record<string, unknown>, inferredType: DocType): string {
  if (typeof data.slug === 'string' && isValidSlug(data.slug)) {
    return data.slug;
  }

  const basename = path.basename(relative).replace(/\.(md|ya?ml|json)$/i, '');
  if (inferredType !== 'wiki-page' && isValidSlug(basename)) {
    return basename;
  }

  return slugFromRelativePath(relative);
}

function titleFromBasename(basename: string): string {
  return basename
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildFrontmatter(
  relativeNorm: string,
  data: Record<string, unknown>,
  type: DocType,
  slug: string,
  status: DocStatus,
  title: string,
): DocFrontmatter {
  return {
    type,
    slug,
    status,
    domain: resolveDomain(relativeNorm, data.domain),
    title,
    tags: normalizeStringArray(data.tags),
    related: normalizeStringArray(data.related),
    owner: typeof data.owner === 'string' ? data.owner : undefined,
    updated: typeof data.updated === 'string' ? data.updated : undefined,
  };
}

function parseStructuredFile(
  filePath: string,
  knowledgeRoot: string,
  contentKind: 'yaml' | 'json',
): DocRecord {
  const raw = fs.readFileSync(filePath, 'utf8');
  const relative = path.relative(knowledgeRoot, filePath).replace(/\\/g, '/');
  const inferredType = inferTypeFromRelative(relative);
  const slug = slugFromRelativePath(relative);
  const basename = path.basename(relative).replace(/\.(ya?ml|json)$/i, '');
  const title = titleFromBasename(basename);
  const domain = resolveDomain(relative, undefined);

  const frontmatter: DocFrontmatter = {
    type: inferredType,
    slug,
    status: 'accepted',
    domain,
    title,
    tags: [],
    related: [],
  };

  return {
    path: filePath,
    relativePath: relative,
    slug,
    type: inferredType,
    domain,
    status: 'accepted',
    title,
    tags: [],
    related: [],
    body: raw,
    frontmatter,
    prepared: false,
    contentKind,
  };
}

function parseKnowledgeFile(filePath: string, knowledgeRoot: string): DocRecord | null {
  const relative = path.relative(knowledgeRoot, filePath).replace(/\\/g, '/');
  const contentKind = contentKindFromRelativePath(relative);
  if (contentKind === 'markdown') {
    return parseDoc(filePath, knowledgeRoot);
  }
  if (contentKind === 'yaml' || contentKind === 'json') {
    return parseStructuredFile(filePath, knowledgeRoot, contentKind);
  }
  const _exhaustive: never = contentKind;
  return _exhaustive;
}

function parseDoc(filePath: string, knowledgeRoot: string): DocRecord | null {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;

  const relative = path.relative(knowledgeRoot, filePath);
  const relativeNorm = relative.replace(/\\/g, '/');
  const inferredType = inferTypeFromRelative(relativeNorm);
  const type = isDocType(data.type) ? data.type : inferredType;
  const slug = inferSlug(relativeNorm, data, type);
  const status: DocStatus = isDocStatus(data.status) ? data.status : 'accepted';
  const title =
    typeof data.title === 'string'
      ? data.title
      : slug.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

  const prepared = typeof data.type === 'string' && isDocType(data.type);

  const frontmatter = buildFrontmatter(relativeNorm, data, type, slug, status, title);

  return {
    path: filePath,
    relativePath: relativeNorm,
    slug,
    type,
    domain: frontmatter.domain ?? resolveDomain(relativeNorm, undefined),
    status,
    title,
    tags: frontmatter.tags ?? [],
    related: frontmatter.related ?? [],
    body: parsed.content.trim(),
    frontmatter,
    prepared,
    contentKind: 'markdown',
  };
}

export function listKnowledgeFiles(knowledgeRoot: string): string[] {
  const pattern = path.join(knowledgeRoot, '**/*.{md,yml,yaml,json}').replace(/\\/g, '/');
  return fg.sync(pattern, {
    absolute: true,
    onlyFiles: true,
    ignore: GLOB_IGNORE,
  });
}

export function listMarkdownFiles(knowledgeRoot: string): string[] {
  const pattern = path.join(knowledgeRoot, '**/*.md').replace(/\\/g, '/');
  return fg.sync(pattern, {
    absolute: true,
    onlyFiles: true,
    ignore: GLOB_IGNORE,
  });
}

export class DocIndex {
  private readonly startDir: string;
  private knowledgeRoot: string | null;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(startDir: string = process.cwd()) {
    this.startDir = path.resolve(startDir);
    this.knowledgeRoot = discoverKnowledgeRoot(this.startDir);
  }

  getKnowledgeRoot(): string | null {
    return this.knowledgeRoot;
  }

  rediscover(): void {
    this.knowledgeRoot = discoverKnowledgeRoot(this.startDir);
    this.cache.clear();
  }

  refresh(): DocRecord[] {
    if (!this.knowledgeRoot) {
      this.cache.clear();
      return [];
    }

    const files = listKnowledgeFiles(this.knowledgeRoot);
    const seen = new Set<string>();

    for (const filePath of files) {
      seen.add(filePath);
      const stat = fs.statSync(filePath);
      const cached = this.cache.get(filePath);

      if (cached && cached.mtimeMs === stat.mtimeMs) {
        continue;
      }

      const record = parseKnowledgeFile(filePath, this.knowledgeRoot);
      if (record) {
        this.cache.set(filePath, { mtimeMs: stat.mtimeMs, record });
      } else {
        this.cache.delete(filePath);
      }
    }

    for (const filePath of [...this.cache.keys()]) {
      if (!seen.has(filePath)) {
        this.cache.delete(filePath);
      }
    }

    return this.getDocs();
  }

  getDocs(): DocRecord[] {
    return [...this.cache.values()].map((entry) => entry.record);
  }

  getDocBySlug(slug: string): DocRecord | null {
    this.refresh();
    const matches = this.getDocs().filter((doc) => doc.slug === slug);
    if (matches.length !== 1) {
      return null;
    }
    return matches[0] ?? null;
  }

  getDocByRelativePath(relativePath: string): DocRecord | null {
    this.refresh();
    const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const matches = this.getDocs().filter((doc) => doc.relativePath === normalized);
    if (matches.length !== 1) {
      return null;
    }
    return matches[0] ?? null;
  }

  getDocsByType(type: DocType): DocRecord[] {
    this.refresh();
    return this.getDocs().filter((doc) => doc.type === type);
  }

  listUnprepared(): DocRecord[] {
    this.refresh();
    return this.getDocs().filter((doc) => !doc.prepared);
  }
}

export function firstParagraph(body: string): string {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return paragraphs[0] ?? '';
}
