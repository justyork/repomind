import fs from 'node:fs';
import path from 'node:path';
import type { DocIndex } from '../index/doc-index.js';
import { isKnowledgeFileName } from '../index/knowledge-file.js';
import type { LinkEdge } from '../index/link-index.js';
import { DOC_DOMAINS, DOMAIN_LABELS, type DocDomain } from '../index/types.js';
import { catalogEmoji, readCatalogMeta } from './catalog-meta.js';
import { joinRelativePath, normalizeRelativePath, parentRelativePath } from './safe-path.js';

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
  /** Slug of the folder index page (README.md or legacy sibling page). */
  indexPageSlug: string | null;
  indexPageTitle: string | null;
  indexPageRelativePath: string | null;
  indexPageType: string | null;
  indexPageContentKind: 'markdown' | 'yaml' | 'json' | null;
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

/** Legacy index path: `{parent}/{folderName}.md` next to `{folderName}/`. */
export function siblingPageIndexRelativePath(folderRelativePath: string): string | null {
  const base = normalizeRelativePath(folderRelativePath);
  if (!base) {
    return null;
  }
  const folderName = path.basename(base);
  return joinRelativePath(parentRelativePath(base), `${folderName}.md`);
}

interface FolderIndexMeta {
  indexPageSlug: string | null;
  indexPageTitle: string | null;
  indexPageRelativePath: string | null;
  indexPageType: string | null;
  indexPageContentKind: 'markdown' | 'yaml' | 'json' | null;
}

function resolveFolderIndex(relativePath: string, ctx: BuildContext): FolderIndexMeta {
  const empty: FolderIndexMeta = {
    indexPageSlug: null,
    indexPageTitle: null,
    indexPageRelativePath: null,
    indexPageType: null,
    indexPageContentKind: null,
  };

  const readmeRel = readmeIndexRelativePath(relativePath);
  const readmeDoc = ctx.docsByRelative.get(readmeRel);
  if (readmeDoc) {
    return {
      indexPageSlug: readmeDoc.slug,
      indexPageTitle: readmeDoc.title,
      indexPageRelativePath: readmeRel,
      indexPageType: readmeDoc.type,
      indexPageContentKind: readmeDoc.contentKind,
    };
  }

  const siblingRel = siblingPageIndexRelativePath(relativePath);
  if (!siblingRel) {
    return empty;
  }
  const siblingDoc = ctx.docsByRelative.get(siblingRel);
  if (!siblingDoc) {
    return empty;
  }

  return {
    indexPageSlug: siblingDoc.slug,
    indexPageTitle: siblingDoc.title,
    indexPageRelativePath: siblingRel,
    indexPageType: siblingDoc.type,
    indexPageContentKind: siblingDoc.contentKind,
  };
}

function isDocDomain(name: string): name is DocDomain {
  return (DOC_DOMAINS as readonly string[]).includes(name);
}

/** Human label for domain folders at `docs/{domain}/`; otherwise basename. */
export function folderDisplayName(relativePath: string): string {
  if (!relativePath) {
    return 'Knowledge';
  }
  const segments = normalizeRelativePath(relativePath).split('/').filter(Boolean);
  if (segments.length === 1 && isDocDomain(segments[0]!)) {
    return DOMAIN_LABELS[segments[0]];
  }
  return path.basename(relativePath);
}

function buildFolder(relativePath: string, absPath: string, ctx: BuildContext): TreeFolderNode {
  const entries = listDirEntries(absPath);
  const children: TreeNode[] = [];
  const folderIndex = resolveFolderIndex(relativePath, ctx);

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
    if (fileRel === folderIndex.indexPageRelativePath) {
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
    name: folderDisplayName(relativePath),
    relativePath,
    emoji: catalogEmoji(ctx.meta, relativePath),
    indexPageSlug: folderIndex.indexPageSlug,
    indexPageTitle: folderIndex.indexPageTitle,
    indexPageRelativePath: folderIndex.indexPageRelativePath,
    indexPageType: folderIndex.indexPageType,
    indexPageContentKind: folderIndex.indexPageContentKind,
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

  function search(nodes: TreeNode[]): string | null {
    for (const child of nodes) {
      if (child.kind === 'page') {
        if (child.relativePath === normalized) {
          return child.slug;
        }
        continue;
      }
      if (child.indexPageRelativePath === normalized && child.indexPageSlug) {
        return child.indexPageSlug;
      }
      const nested = findTreePageSlug(child, normalized);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  if (node.indexPageRelativePath === normalized && node.indexPageSlug) {
    return node.indexPageSlug;
  }

  return search(node.children);
}

export function collectParentOfEdges(_tree: TreeFolderNode | null): LinkEdge[] {
  return [];
}
