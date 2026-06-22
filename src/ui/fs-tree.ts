import fs from 'node:fs';
import path from 'node:path';
import type { DocIndex } from '../index/doc-index.js';
import { catalogEmoji, readCatalogMeta } from './catalog-meta.js';
import { joinRelativePath, normalizeRelativePath } from './safe-path.js';

const IGNORED_DIRS = new Set(['.repo-mind', '.worktrees']);

export interface TreePageNode {
  kind: 'page';
  name: string;
  relativePath: string;
  slug: string;
  title: string;
  status: string;
  type: string;
}

export interface TreeFolderNode {
  kind: 'folder';
  name: string;
  relativePath: string;
  emoji: string | null;
  /** Slug of sibling index page (e.g. architecture.md for architecture/ folder). */
  indexPageSlug: string | null;
  children: TreeNode[];
}

export type TreeNode = TreePageNode | TreeFolderNode;

interface BuildContext {
  docsByRelative: Map<string, { slug: string; title: string; status: string; type: string }>;
  meta: Record<string, string>;
}

function listDirEntries(dirPath: string): Array<{ name: string; isDirectory: boolean }> {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .map((entry) => ({ name: entry.name, isDirectory: entry.isDirectory() }));
}

function buildFolder(relativePath: string, absPath: string, ctx: BuildContext): TreeFolderNode {
  const entries = listDirEntries(absPath);
  const folderNames = new Set(
    entries.filter((entry) => entry.isDirectory).map((entry) => entry.name),
  );
  const children: TreeNode[] = [];

  const indexRel = relativePath ? `${relativePath}/${path.basename(relativePath)}.md` : '';
  // index page: parent/foo.md when folder is parent/foo/
  const folderName = path.basename(relativePath);
  const parentRel = relativePath.includes('/')
    ? relativePath.slice(0, relativePath.lastIndexOf('/'))
    : '';
  const siblingIndexRel = parentRel
    ? `${parentRel}/${folderName}.md`
    : `${folderName}.md`;

  let indexPageSlug: string | null = null;
  const indexDoc = ctx.docsByRelative.get(siblingIndexRel);
  if (indexDoc && folderNames.has(folderName)) {
    indexPageSlug = indexDoc.slug;
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      const childRel = joinRelativePath(relativePath, entry.name);
      children.push(buildFolder(childRel, path.join(absPath, entry.name), ctx));
      continue;
    }

    if (!entry.name.endsWith('.md')) {
      continue;
    }

    const fileRel = joinRelativePath(relativePath, entry.name);
    if (fileRel === siblingIndexRel && folderNames.has(folderName)) {
      continue;
    }

    const doc = ctx.docsByRelative.get(fileRel);
    if (!doc) {
      continue;
    }

    children.push({
      kind: 'page',
      name: entry.name.replace(/\.md$/i, ''),
      relativePath: fileRel,
      slug: doc.slug,
      title: doc.title,
      status: doc.status,
      type: doc.type,
    });
  }

  return {
    kind: 'folder',
    name: relativePath ? path.basename(relativePath) : 'Knowledge',
    relativePath,
    emoji: catalogEmoji(ctx.meta, relativePath),
    indexPageSlug,
    children,
  };
}

export function buildDocsTree(index: DocIndex): TreeFolderNode | null {
  const knowledgeRoot = index.getKnowledgeRoot();
  if (!knowledgeRoot) {
    return null;
  }

  const docsByRelative = new Map<
    string,
    { slug: string; title: string; status: string; type: string }
  >();
  for (const doc of index.refresh()) {
    docsByRelative.set(doc.relativePath, {
      slug: doc.slug,
      title: doc.title,
      status: doc.status,
      type: doc.type,
    });
  }

  const ctx: BuildContext = {
    docsByRelative,
    meta: readCatalogMeta(knowledgeRoot),
  };

  return buildFolder('', knowledgeRoot, ctx);
}

export function findTreePageSlug(
  node: TreeFolderNode,
  relativePath: string,
): string | null {
  const normalized = normalizeRelativePath(relativePath);
  for (const child of node.children) {
    if (child.kind === 'page' && child.relativePath === normalized) {
      return child.slug;
    }
    if (child.kind === 'folder') {
      const found = findTreePageSlug(child, normalized);
      if (found) {
        return found;
      }
    }
  }
  return null;
}
