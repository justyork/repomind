import fs from 'node:fs';
import path from 'node:path';
import type { DocIndex } from '../index/doc-index.js';
import { isKnowledgeFileName } from '../index/knowledge-file.js';
import type { LinkEdge } from '../index/link-index.js';
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
  contentKind: 'markdown' | 'yaml' | 'json';
}

export interface TreeFolderNode {
  kind: 'folder';
  name: string;
  relativePath: string;
  emoji: string | null;
  /** Slug of README.md index page for this folder. */
  indexPageSlug: string | null;
  children: TreeNode[];
}

export type TreeNode = TreePageNode | TreeFolderNode;

interface BuildContext {
  docsByRelative: Map<
    string,
    { slug: string; title: string; status: string; type: string; contentKind: 'markdown' | 'yaml' | 'json' }
  >;
  meta: Record<string, string>;
}

function knowledgeFileDisplayName(fileName: string): string {
  return fileName.replace(/\.(md|ya?ml|json)$/i, '');
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

export function readmeIndexRelativePath(folderRelativePath: string): string {
  const base = normalizeRelativePath(folderRelativePath);
  return base ? `${base}/README.md` : 'README.md';
}

function buildFolder(relativePath: string, absPath: string, ctx: BuildContext): TreeFolderNode {
  const entries = listDirEntries(absPath);
  const children: TreeNode[] = [];

  const readmeRel = readmeIndexRelativePath(relativePath);

  let indexPageSlug: string | null = null;
  const readmeDoc = ctx.docsByRelative.get(readmeRel);
  if (readmeDoc) {
    indexPageSlug = readmeDoc.slug;
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

    if (!isKnowledgeFileName(entry.name)) {
      continue;
    }

    const fileRel = joinRelativePath(relativePath, entry.name);
    if (fileRel === readmeRel && indexPageSlug) {
      continue;
    }

    const doc = ctx.docsByRelative.get(fileRel);
    if (!doc) {
      continue;
    }

    children.push({
      kind: 'page',
      name: knowledgeFileDisplayName(entry.name),
      relativePath: fileRel,
      slug: doc.slug,
      title: doc.title,
      status: doc.status,
      type: doc.type,
      contentKind: doc.contentKind,
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
    { slug: string; title: string; status: string; type: string; contentKind: 'markdown' | 'yaml' | 'json' }
  >();
  for (const doc of index.refresh()) {
    docsByRelative.set(doc.relativePath, {
      slug: doc.slug,
      title: doc.title,
      status: doc.status,
      type: doc.type,
      contentKind: doc.contentKind,
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

export function collectParentOfEdges(tree: TreeFolderNode | null): LinkEdge[] {
  if (!tree) {
    return [];
  }
  const edges: LinkEdge[] = [];

  function walk(folder: TreeFolderNode): void {
    if (folder.indexPageSlug) {
      for (const child of folder.children ?? []) {
        if (child.kind === 'page' && child.slug !== folder.indexPageSlug) {
          edges.push({
            from: folder.indexPageSlug,
            to: child.slug,
            kind: 'parent_of',
          });
        }
      }
    }
    for (const child of folder.children ?? []) {
      if (child.kind === 'folder') {
        walk(child);
      }
    }
  }

  walk(tree);
  return edges;
}
