import fs from 'node:fs';
import path from 'node:path';
import type { DocIndex } from '../index/doc-index.js';
import { isKnowledgeFileName } from '../index/knowledge-file.js';
import type { LinkEdge } from '../index/link-index.js';
import { DOC_DOMAINS, DOMAIN_LABELS, type DocDomain } from '../index/types.js';
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
  /** Sibling folder `{parent}/{name}/` when Confluence-style page+folder pair exists. */
  childFolderPath?: string;
  children?: TreeNode[];
}

export interface TreeFolderNode {
  kind: 'folder';
  name: string;
  relativePath: string;
  emoji: string | null;
  /** Slug of README.md index page for this folder. */
  indexPageSlug: string | null;
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

function findSiblingDirName(dirNames: string[], fileName: string): string | null {
  const base = knowledgeFileDisplayName(fileName);
  const exact = dirNames.find((name) => name === base);
  if (exact) {
    return exact;
  }
  const lower = base.toLowerCase();
  return dirNames.find((name) => name.toLowerCase() === lower) ?? null;
}

function hasSiblingKnowledgePage(entries: Array<{ name: string; isDirectory: boolean }>, dirName: string): boolean {
  return entries.some(
    (entry) =>
      !entry.isDirectory &&
      isKnowledgeFileName(entry.name) &&
      knowledgeFileDisplayName(entry.name).toLowerCase() === dirName.toLowerCase(),
  );
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
  const dirNames = entries.filter((entry) => entry.isDirectory).map((entry) => entry.name);

  const readmeRel = readmeIndexRelativePath(relativePath);

  let indexPageSlug: string | null = null;
  let indexPageType: string | null = null;
  let indexPageContentKind: 'markdown' | 'yaml' | 'json' | null = null;
  const readmeDoc = ctx.docsByRelative.get(readmeRel);
  if (readmeDoc) {
    indexPageSlug = readmeDoc.slug;
    indexPageType = readmeDoc.type;
    indexPageContentKind = readmeDoc.contentKind;
  }

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      if (hasSiblingKnowledgePage(entries, entry.name)) {
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
    const doc = ctx.docsByRelative.get(fileRel);
    if (!doc) {
      continue;
    }

    const siblingDir = findSiblingDirName(dirNames, entry.name);
    if (siblingDir) {
      const childFolderRel = joinRelativePath(relativePath, siblingDir);
      const nested = buildFolder(childFolderRel, path.join(absPath, siblingDir), ctx);
      children.push({
        kind: 'page',
        name: knowledgeFileDisplayName(entry.name),
        relativePath: fileRel,
        slug: doc.slug,
        title: doc.title,
        status: doc.status,
        type: doc.type,
        contentKind: doc.contentKind,
        childFolderPath: childFolderRel,
        children: nested.children,
      });
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
    indexPageSlug,
    indexPageType,
    indexPageContentKind,
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
        if (child.children) {
          const nested = search(child.children);
          if (nested) {
            return nested;
          }
        }
        continue;
      }
      const nested = findTreePageSlug(child, normalized);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  return search(node.children);
}

export function collectParentOfEdges(_tree: TreeFolderNode | null): LinkEdge[] {
  return [];
}
