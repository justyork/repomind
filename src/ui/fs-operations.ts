import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { DocIndex } from '../index/doc-index.js';
import { getBacklinksForSlug } from '../index/link-index.js';
import { slugFromRelativePath } from '../index/slug.js';
import type { DocType } from '../index/types.js';
import { DIR_TO_TYPE } from '../index/types.js';
import { buildLinkIndexForDocs } from '../tools/explore-graph.js';
import {
  isValidFsName,
  joinRelativePath,
  normalizeRelativePath,
  parentRelativePath,
  resolveRelativeMdPath,
  resolveUnderKnowledgeRoot,
} from './safe-path.js';

export interface CreateFolderResult {
  relativePath: string;
  absolutePath: string;
}

export interface CreatePageResult {
  relativePath: string;
  absolutePath: string;
  slug: string;
  type: DocType;
}

export interface FsPageMutationResult {
  relativePath: string;
  absolutePath: string;
  slug: string;
  previousSlug: string;
  slugChanged: boolean;
  inboundWarnings: Array<{ slug: string; title: string }>;
}

function inferTypeFromParent(parentPath: string): DocType {
  const top = parentPath.split('/')[0] ?? '';
  return DIR_TO_TYPE[top] ?? 'wiki-page';
}

export function createFolder(
  index: DocIndex,
  parentPath: string,
  name: string,
): CreateFolderResult {
  const knowledgeRoot = index.getKnowledgeRoot();
  if (!knowledgeRoot) {
    throw new Error('no docs/ directory found');
  }
  if (!isValidFsName(name)) {
    throw new Error(`invalid folder name: ${name}`);
  }

  const relativePath = joinRelativePath(parentPath, name);
  const absolutePath = resolveUnderKnowledgeRoot(knowledgeRoot, relativePath);
  if (!absolutePath) {
    throw new Error('path escapes docs/');
  }
  if (fs.existsSync(absolutePath)) {
    throw new Error(`already exists: ${relativePath}`);
  }

  fs.mkdirSync(absolutePath, { recursive: true });
  return { relativePath: normalizeRelativePath(relativePath), absolutePath };
}

export function createPageFile(
  index: DocIndex,
  parentPath: string,
  name: string,
  title?: string,
): CreatePageResult {
  const knowledgeRoot = index.getKnowledgeRoot();
  if (!knowledgeRoot) {
    throw new Error('no docs/ directory found');
  }

  const baseName = name.endsWith('.md') ? name.slice(0, -3) : name;
  if (!isValidFsName(baseName)) {
    throw new Error(`invalid page name: ${name}`);
  }

  const relativePath = joinRelativePath(parentPath, `${baseName}.md`);
  const absolutePath = resolveRelativeMdPath(knowledgeRoot, relativePath);
  if (!absolutePath) {
    throw new Error('path escapes docs/');
  }
  if (fs.existsSync(absolutePath)) {
    throw new Error(`already exists: ${relativePath}`);
  }

  const type = inferTypeFromParent(parentPath);
  const slug = slugFromRelativePath(relativePath);
  const pageTitle = title?.trim() || baseName.replace(/[-_]/g, ' ');
  const frontmatter = {
    type,
    slug,
    status: 'draft',
    title: pageTitle,
    tags: [],
    related: [],
    updated: new Date().toISOString().slice(0, 10),
  };

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, matter.stringify(`# ${pageTitle}\n\n`, frontmatter), 'utf8');
  index.refresh();

  return {
    relativePath: normalizeRelativePath(relativePath),
    absolutePath,
    slug,
    type,
  };
}

function readPageSlug(absolutePath: string): string {
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const parsed = matter(raw);
  const slug = parsed.data.slug;
  if (typeof slug === 'string' && slug.trim()) {
    return slug.trim();
  }
  const relative = path.basename(absolutePath, '.md');
  return slugFromRelativePath(`${relative}.md`);
}

function collectInboundWarnings(index: DocIndex, slug: string): Array<{ slug: string; title: string }> {
  const docs = index.refresh();
  const snapshot = buildLinkIndexForDocs(index);
  const docsBySlug = new Map(docs.map((doc) => [doc.slug, doc]));
  return getBacklinksForSlug(snapshot, slug, docsBySlug).map((entry) => ({
    slug: entry.slug,
    title: entry.title,
  }));
}

function rewritePageFrontmatter(
  absolutePath: string,
  newRelativePath: string,
): { newSlug: string; newType: DocType } {
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const parsed = matter(raw);
  const parentPath = parentRelativePath(newRelativePath);
  const newSlug = slugFromRelativePath(newRelativePath);
  const newType = inferTypeFromParent(parentPath);
  const nextData = {
    ...parsed.data,
    slug: newSlug,
    type: newType,
    updated: new Date().toISOString().slice(0, 10),
  };
  fs.writeFileSync(absolutePath, matter.stringify(parsed.content, nextData), 'utf8');
  return { newSlug, newType };
}

export function movePageFile(
  index: DocIndex,
  fromPath: string,
  toDir: string,
): FsPageMutationResult {
  const knowledgeRoot = index.getKnowledgeRoot();
  if (!knowledgeRoot) {
    throw new Error('no docs/ directory found');
  }

  const normalizedFrom = normalizeRelativePath(fromPath);
  const sourceAbsolute = resolveRelativeMdPath(knowledgeRoot, normalizedFrom);
  if (!sourceAbsolute || !fs.existsSync(sourceAbsolute)) {
    throw new Error(`page not found: ${fromPath}`);
  }

  const destDirRelative = normalizeRelativePath(toDir);
  const destDirAbsolute = resolveUnderKnowledgeRoot(knowledgeRoot, destDirRelative);
  if (!destDirAbsolute || !fs.existsSync(destDirAbsolute)) {
    throw new Error(`destination folder not found: ${toDir}`);
  }
  if (!fs.statSync(destDirAbsolute).isDirectory()) {
    throw new Error(`destination is not a folder: ${toDir}`);
  }

  const fileName = path.basename(sourceAbsolute);
  const destRelative = joinRelativePath(destDirRelative, fileName);
  const destAbsolute = resolveRelativeMdPath(knowledgeRoot, destRelative);
  if (!destAbsolute) {
    throw new Error('path escapes docs/');
  }
  if (fs.existsSync(destAbsolute)) {
    throw new Error(`already exists: ${destRelative}`);
  }

  const previousSlug = readPageSlug(sourceAbsolute);
  const inboundWarnings = collectInboundWarnings(index, previousSlug);

  fs.mkdirSync(path.dirname(destAbsolute), { recursive: true });
  fs.renameSync(sourceAbsolute, destAbsolute);

  const { newSlug } = rewritePageFrontmatter(destAbsolute, destRelative);
  index.refresh();

  return {
    relativePath: normalizeRelativePath(destRelative),
    absolutePath: destAbsolute,
    slug: newSlug,
    previousSlug,
    slugChanged: newSlug !== previousSlug,
    inboundWarnings: previousSlug !== newSlug ? inboundWarnings : [],
  };
}

export function renamePageFile(
  index: DocIndex,
  pagePath: string,
  newName: string,
): FsPageMutationResult {
  const knowledgeRoot = index.getKnowledgeRoot();
  if (!knowledgeRoot) {
    throw new Error('no docs/ directory found');
  }

  const baseName = newName.endsWith('.md') ? newName.slice(0, -3) : newName;
  if (!isValidFsName(baseName)) {
    throw new Error(`invalid page name: ${newName}`);
  }

  const normalizedFrom = normalizeRelativePath(pagePath);
  const sourceAbsolute = resolveRelativeMdPath(knowledgeRoot, normalizedFrom);
  if (!sourceAbsolute || !fs.existsSync(sourceAbsolute)) {
    throw new Error(`page not found: ${pagePath}`);
  }

  const parentPath = parentRelativePath(normalizedFrom);
  const destRelative = joinRelativePath(parentPath, `${baseName}.md`);
  const destAbsolute = resolveRelativeMdPath(knowledgeRoot, destRelative);
  if (!destAbsolute) {
    throw new Error('path escapes docs/');
  }
  if (destAbsolute === sourceAbsolute) {
    throw new Error('new name matches current name');
  }
  if (fs.existsSync(destAbsolute)) {
    throw new Error(`already exists: ${destRelative}`);
  }

  const previousSlug = readPageSlug(sourceAbsolute);
  const inboundWarnings = collectInboundWarnings(index, previousSlug);

  fs.renameSync(sourceAbsolute, destAbsolute);

  const { newSlug } = rewritePageFrontmatter(destAbsolute, destRelative);
  index.refresh();

  return {
    relativePath: normalizeRelativePath(destRelative),
    absolutePath: destAbsolute,
    slug: newSlug,
    previousSlug,
    slugChanged: newSlug !== previousSlug,
    inboundWarnings: previousSlug !== newSlug ? inboundWarnings : [],
  };
}
