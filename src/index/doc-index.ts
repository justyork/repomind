import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import matter from 'gray-matter';
import {
  DIR_TO_TYPE,
  type DocFrontmatter,
  type DocRecord,
  type DocStatus,
  type DocType,
  isDocStatus,
  isDocType,
} from './types.js';

export const KNOWLEDGE_DIR = '.project-knowledge';

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

function parseDoc(filePath: string, knowledgeRoot: string): DocRecord | null {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = matter(raw);
  const data = parsed.data as Record<string, unknown>;

  const relative = path.relative(knowledgeRoot, filePath);
  const [typeDir] = relative.split(path.sep);
  const inferredType = DIR_TO_TYPE[typeDir];

  const type = isDocType(data.type) ? data.type : inferredType;
  const slugFromFile = path.basename(filePath, '.md');
  const slug = typeof data.slug === 'string' ? data.slug : slugFromFile;
  const status: DocStatus = isDocStatus(data.status) ? data.status : 'draft';
  const title = typeof data.title === 'string' ? data.title : slug;

  if (!type) {
    return null;
  }

  const frontmatter: DocFrontmatter = {
    type,
    slug,
    status,
    title,
    tags: normalizeStringArray(data.tags),
    related: normalizeStringArray(data.related),
    owner: typeof data.owner === 'string' ? data.owner : undefined,
    updated: typeof data.updated === 'string' ? data.updated : undefined,
  };

  return {
    path: filePath,
    slug,
    type,
    status,
    title,
    tags: frontmatter.tags ?? [],
    related: frontmatter.related ?? [],
    body: parsed.content.trim(),
    frontmatter,
  };
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

    const pattern = path.join(this.knowledgeRoot, '**/*.md').replace(/\\/g, '/');
    const files = fg.sync(pattern, {
      absolute: true,
      onlyFiles: true,
      ignore: ['**/README.md'],
    });

    const seen = new Set<string>();

    for (const filePath of files) {
      seen.add(filePath);
      const stat = fs.statSync(filePath);
      const cached = this.cache.get(filePath);

      if (cached && cached.mtimeMs === stat.mtimeMs) {
        continue;
      }

      const record = parseDoc(filePath, this.knowledgeRoot);
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

  getDocsByType(type: DocType): DocRecord[] {
    this.refresh();
    return this.getDocs().filter((doc) => doc.type === type);
  }
}

export function firstParagraph(body: string): string {
  const paragraphs = body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return paragraphs[0] ?? '';
}
