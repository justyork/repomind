import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { DocIndex } from '../index/doc-index.js';
import { getBacklinksForSlug } from '../index/link-index.js';
import { inferTypeFromRelative, resolveDomain } from '../index/path-inference.js';
import { slugFromRelativePath } from '../index/slug.js';
import type { DocType } from '../index/types.js';
import { buildLinkIndexForDocs } from '../tools/explore-graph.js';
import { readPageTemplate } from './templates.js';
import {
  isValidFsName,
  joinRelativePath,
  normalizeRelativePath,
  parentRelativePath,
  resolveRelativeMdPath,
  resolveUnderKnowledgeRoot,
} from './safe-path.js';
import { cascadeSlugDelete, cascadeSlugRename, toRelativePaths } from './link-cascade.js';

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
  cascadeUpdated: string[];
}

export interface FsDeletePageResult {
  relativePath: string;
  slug: string;
  inboundWarnings: Array<{ slug: string; title: string }>;
  cascadeUpdated: string[];
}

export interface FsDeleteFolderResult {
  relativePath: string;
  deletedSlugs: string[];
  inboundWarnings: Array<{ slug: string; title: string }>;
  cascadeUpdated: string[];
}

export interface CreatePageOptions {
  title?: string;
  templateId?: string;
}

function inferTypeFromParent(parentPath: string): DocType {
  return inferTypeFromRelative(`${parentPath}/page.md`);
}

export interface PromotePageResult extends FsPageMutationResult {
  folderPath: string;
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
  options: CreatePageOptions = {},
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

  const relativeNorm = normalizeRelativePath(relativePath);
  const type = inferTypeFromParent(parentPath);
  const slug = slugFromRelativePath(relativeNorm);
  const domain = resolveDomain(relativeNorm, undefined);
  const pageTitle = options.title?.trim() || baseName.replace(/[-_]/g, ' ');

  let body = `# ${pageTitle}\n\n`;
  if (options.templateId) {
    const template = readPageTemplate(options.templateId);
    body = template.body || body;
    if (!options.title?.trim() && template.title) {
      options.title = template.title;
    }
  }

  const resolvedTitle = options.title?.trim() || pageTitle;
  const frontmatter = {
    type,
    slug,
    status: 'draft',
    domain,
    title: resolvedTitle,
    tags: [],
    related: [],
    updated: new Date().toISOString().slice(0, 10),
  };

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, matter.stringify(body, frontmatter), 'utf8');
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

/** Creates sibling folder `{parent}/{basename}/` for a leaf page (Confluence-style); page file stays in place. */
export function promotePageToFolder(index: DocIndex, pagePath: string): PromotePageResult {
  const knowledgeRoot = index.getKnowledgeRoot();
  if (!knowledgeRoot) {
    throw new Error('no docs/ directory found');
  }

  const normalizedFrom = normalizeRelativePath(pagePath);
  if (normalizedFrom === 'README.md') {
    throw new Error('cannot promote docs root index');
  }

  const fileName = path.posix.basename(normalizedFrom);
  if (fileName.toLowerCase() === 'readme.md') {
    throw new Error('page is already inside a folder');
  }

  const sourceAbsolute = resolveRelativeMdPath(knowledgeRoot, normalizedFrom);
  if (!sourceAbsolute || !fs.existsSync(sourceAbsolute)) {
    throw new Error(`page not found: ${pagePath}`);
  }

  const parentPath = parentRelativePath(normalizedFrom);
  const baseName = knowledgeFileDisplayName(fileName);
  if (!isValidFsName(baseName)) {
    throw new Error(`invalid page name: ${baseName}`);
  }

  const folderRelative = joinRelativePath(parentPath, baseName);
  const folderAbsolute = resolveUnderKnowledgeRoot(knowledgeRoot, folderRelative);
  if (!folderAbsolute) {
    throw new Error('path escapes docs/');
  }

  if (fs.existsSync(folderAbsolute)) {
    if (!fs.statSync(folderAbsolute).isDirectory()) {
      throw new Error(`already exists: ${folderRelative}`);
    }
  } else {
    fs.mkdirSync(folderAbsolute, { recursive: true });
  }

  const previousSlug = readPageSlug(sourceAbsolute);
  index.refresh();

  return {
    relativePath: normalizedFrom,
    absolutePath: sourceAbsolute,
    slug: previousSlug,
    previousSlug,
    slugChanged: false,
    inboundWarnings: [],
    cascadeUpdated: [],
    folderPath: normalizeRelativePath(folderRelative),
  };
}

function knowledgeFileDisplayName(fileName: string): string {
  return fileName.replace(/\.(md|ya?ml|json)$/i, '');
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

  let cascadeUpdated: string[] = [];
  if (newSlug !== previousSlug) {
    cascadeUpdated = toRelativePaths(
      knowledgeRoot,
      cascadeSlugRename(knowledgeRoot, previousSlug, newSlug, {
        excludeAbsolutePath: destAbsolute,
      }),
    );
  }

  index.refresh();

  return {
    relativePath: normalizeRelativePath(destRelative),
    absolutePath: destAbsolute,
    slug: newSlug,
    previousSlug,
    slugChanged: newSlug !== previousSlug,
    inboundWarnings: previousSlug !== newSlug ? inboundWarnings : [],
    cascadeUpdated,
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

  let cascadeUpdated: string[] = [];
  if (newSlug !== previousSlug) {
    cascadeUpdated = toRelativePaths(
      knowledgeRoot,
      cascadeSlugRename(knowledgeRoot, previousSlug, newSlug, {
        excludeAbsolutePath: destAbsolute,
      }),
    );
  }

  index.refresh();

  return {
    relativePath: normalizeRelativePath(destRelative),
    absolutePath: destAbsolute,
    slug: newSlug,
    previousSlug,
    slugChanged: newSlug !== previousSlug,
    inboundWarnings: previousSlug !== newSlug ? inboundWarnings : [],
    cascadeUpdated,
  };
}

function listMarkdownFilesRecursive(absoluteDir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(absoluteDir)) {
    return files;
  }

  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    if (entry.name === '.repo-mind' || entry.name === '.worktrees') {
      continue;
    }
    const fullPath = path.join(absoluteDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listMarkdownFilesRecursive(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function mergeInboundWarnings(
  lists: Array<Array<{ slug: string; title: string }>>,
): Array<{ slug: string; title: string }> {
  const seen = new Set<string>();
  const merged: Array<{ slug: string; title: string }> = [];
  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item.slug)) {
        continue;
      }
      seen.add(item.slug);
      merged.push(item);
    }
  }
  return merged;
}

export interface FsMoveFolderResult {
  relativePath: string;
  previousPath: string;
  siblingPagePath?: string;
  cascadeUpdated: string[];
}

function isDescendantOrEqual(ancestor: string, candidate: string): boolean {
  const a = normalizeRelativePath(ancestor);
  const c = normalizeRelativePath(candidate);
  if (!a) {
    return true;
  }
  return c === a || c.startsWith(`${a}/`);
}

function absoluteToDocsRelative(knowledgeRoot: string, absolutePath: string): string {
  return normalizeRelativePath(path.relative(knowledgeRoot, absolutePath));
}

/** Moves a folder and its Confluence sibling page file when present. */
export function moveFolder(
  index: DocIndex,
  fromPath: string,
  toParentDir: string,
): FsMoveFolderResult {
  const knowledgeRoot = index.getKnowledgeRoot();
  if (!knowledgeRoot) {
    throw new Error('no docs/ directory found');
  }

  const normalizedFrom = normalizeRelativePath(fromPath);
  if (!normalizedFrom) {
    throw new Error('cannot move docs root');
  }

  const sourceAbsolute = resolveUnderKnowledgeRoot(knowledgeRoot, normalizedFrom);
  if (!sourceAbsolute || !fs.existsSync(sourceAbsolute)) {
    throw new Error(`folder not found: ${fromPath}`);
  }
  if (!fs.statSync(sourceAbsolute).isDirectory()) {
    throw new Error(`not a folder: ${fromPath}`);
  }

  const destParent = normalizeRelativePath(toParentDir);
  if (isDescendantOrEqual(normalizedFrom, destParent)) {
    throw new Error('cannot move folder into itself');
  }

  const folderName = path.posix.basename(normalizedFrom);
  const destRelative = joinRelativePath(destParent, folderName);
  const destAbsolute = resolveUnderKnowledgeRoot(knowledgeRoot, destRelative);
  if (!destAbsolute) {
    throw new Error('path escapes docs/');
  }
  if (fs.existsSync(destAbsolute)) {
    throw new Error(`already exists: ${destRelative}`);
  }

  const fromParent = parentRelativePath(normalizedFrom);
  const siblingRelative = joinRelativePath(fromParent, `${folderName}.md`);
  const siblingAbsolute = resolveRelativeMdPath(knowledgeRoot, siblingRelative);
  let siblingDestRelative: string | undefined;

  if (siblingAbsolute && fs.existsSync(siblingAbsolute)) {
    siblingDestRelative = joinRelativePath(destParent, `${folderName}.md`);
    const siblingDestAbsolute = resolveRelativeMdPath(knowledgeRoot, siblingDestRelative);
    if (!siblingDestAbsolute) {
      throw new Error('path escapes docs/');
    }
    if (fs.existsSync(siblingDestAbsolute)) {
      throw new Error(`already exists: ${siblingDestRelative}`);
    }
    fs.renameSync(siblingAbsolute, siblingDestAbsolute);
  }

  fs.renameSync(sourceAbsolute, destAbsolute);

  const movedMarkdownAbsolutes: string[] = [];
  if (siblingDestRelative) {
    const siblingDestAbsolute = resolveRelativeMdPath(knowledgeRoot, siblingDestRelative);
    if (siblingDestAbsolute) {
      movedMarkdownAbsolutes.push(siblingDestAbsolute);
    }
  }
  movedMarkdownAbsolutes.push(...listMarkdownFilesRecursive(destAbsolute));

  const cascadeUpdated = new Set<string>();
  for (const absolutePath of movedMarkdownAbsolutes) {
    const relativePath = absoluteToDocsRelative(knowledgeRoot, absolutePath);
    const previousSlug = readPageSlug(absolutePath);
    const { newSlug } = rewritePageFrontmatter(absolutePath, relativePath);
    if (newSlug === previousSlug) {
      continue;
    }
    for (const updatedPath of cascadeSlugRename(knowledgeRoot, previousSlug, newSlug, {
      excludeAbsolutePath: absolutePath,
    })) {
      cascadeUpdated.add(updatedPath);
    }
  }

  index.refresh();

  return {
    relativePath: destRelative,
    previousPath: normalizedFrom,
    siblingPagePath: siblingDestRelative,
    cascadeUpdated: toRelativePaths(knowledgeRoot, [...cascadeUpdated]),
  };
}

export function deletePageFile(index: DocIndex, pagePath: string): FsDeletePageResult {
  const knowledgeRoot = index.getKnowledgeRoot();
  if (!knowledgeRoot) {
    throw new Error('no docs/ directory found');
  }

  const normalized = normalizeRelativePath(pagePath);
  const absolutePath = resolveRelativeMdPath(knowledgeRoot, normalized);
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    throw new Error(`page not found: ${pagePath}`);
  }

  const slug = readPageSlug(absolutePath);
  const inboundWarnings = collectInboundWarnings(index, slug);

  const cascadeUpdated = toRelativePaths(
    knowledgeRoot,
    cascadeSlugDelete(knowledgeRoot, slug, { excludeAbsolutePaths: [absolutePath] }),
  );

  fs.unlinkSync(absolutePath);
  index.refresh();

  return {
    relativePath: normalized,
    slug,
    inboundWarnings,
    cascadeUpdated,
  };
}

export function deleteFolder(index: DocIndex, folderPath: string): FsDeleteFolderResult {
  const knowledgeRoot = index.getKnowledgeRoot();
  if (!knowledgeRoot) {
    throw new Error('no docs/ directory found');
  }

  const normalized = normalizeRelativePath(folderPath);
  if (!normalized) {
    throw new Error('cannot delete docs root');
  }

  const absolutePath = resolveUnderKnowledgeRoot(knowledgeRoot, normalized);
  if (!absolutePath || !fs.existsSync(absolutePath)) {
    throw new Error(`folder not found: ${folderPath}`);
  }
  if (!fs.statSync(absolutePath).isDirectory()) {
    throw new Error(`not a folder: ${folderPath}`);
  }

  const markdownFiles = listMarkdownFilesRecursive(absolutePath);
  const deletedSlugs = markdownFiles.map((filePath) => readPageSlug(filePath));
  const inboundWarnings = mergeInboundWarnings(
    deletedSlugs.map((slug) => collectInboundWarnings(index, slug)),
  );

  const cascadeUpdated = new Set<string>();
  for (const deletedSlug of deletedSlugs) {
    for (const updatedPath of cascadeSlugDelete(knowledgeRoot, deletedSlug, {
      excludeAbsolutePaths: markdownFiles,
    })) {
      cascadeUpdated.add(updatedPath);
    }
  }

  fs.rmSync(absolutePath, { recursive: true, force: true });
  index.refresh();

  return {
    relativePath: normalized,
    deletedSlugs,
    inboundWarnings,
    cascadeUpdated: toRelativePaths(knowledgeRoot, [...cascadeUpdated]),
  };
}
