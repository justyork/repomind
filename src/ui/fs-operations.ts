import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { DocIndex } from '../index/doc-index.js';
import { slugFromRelativePath } from '../index/slug.js';
import type { DocType } from '../index/types.js';
import { DIR_TO_TYPE } from '../index/types.js';
import {
  isValidFsName,
  joinRelativePath,
  normalizeRelativePath,
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
