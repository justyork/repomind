import { isValidSlug } from '../index/slug.js';
import type { DocIndex } from '../index/doc-index.js';
import {
  buildLinkIndex,
  getOutboundSlugs,
  type LinkIndexSnapshot,
} from '../index/link-index.js';
import type { DocType } from '../index/types.js';
import { buildDocsTree, collectParentOfEdges } from '../ui/fs-tree.js';

export interface ExploreGraphInput {
  slug: string;
  depth?: number;
}

export interface ExploreGraphNode {
  slug: string;
  type: DocType;
  title: string;
}

export interface ExploreGraphEdge {
  from: string;
  to: string;
}

export interface ExploreGraphResult {
  nodes: ExploreGraphNode[];
  edges: ExploreGraphEdge[];
  maxDepthReached: number;
  truncated: boolean;
  broken_links: string[];
}

function buildSnapshot(index: DocIndex): LinkIndexSnapshot {
  const docs = index.refresh();
  const tree = buildDocsTree(index);
  return buildLinkIndex(docs, collectParentOfEdges(tree));
}

export function exploreGraph(
  index: DocIndex,
  input: ExploreGraphInput,
): ExploreGraphResult {
  const empty: ExploreGraphResult = {
    nodes: [],
    edges: [],
    maxDepthReached: 0,
    truncated: false,
    broken_links: [],
  };

  if (!index.getKnowledgeRoot()) {
    return empty;
  }

  if (!isValidSlug(input.slug)) {
    return empty;
  }

  const rootDoc = index.getDocBySlug(input.slug);
  if (!rootDoc) {
    return empty;
  }

  let maxDepth = input.depth ?? 3;
  if (maxDepth <= 0) {
    maxDepth = 1;
  }

  const linkIndex = buildSnapshot(index);
  const nodes = new Map<string, ExploreGraphNode>();
  const edges: ExploreGraphEdge[] = [];
  const brokenLinks = new Set<string>(linkIndex.brokenTargets);
  const visited = new Set<string>();
  let maxDepthReached = 0;
  let truncated = false;

  type QueueItem = { slug: string; depth: number };
  const queue: QueueItem[] = [{ slug: rootDoc.slug, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.slug)) {
      continue;
    }

    visited.add(current.slug);
    const doc = index.getDocBySlug(current.slug);
    if (!doc) {
      continue;
    }

    nodes.set(doc.slug, {
      slug: doc.slug,
      type: doc.type,
      title: doc.title,
    });
    maxDepthReached = Math.max(maxDepthReached, current.depth);

    const outbound = getOutboundSlugs(linkIndex, doc.slug);

    if (current.depth + 1 >= maxDepth) {
      if (outbound.length > 0) {
        truncated = true;
      }
      continue;
    }

    for (const targetSlug of outbound) {
      edges.push({ from: doc.slug, to: targetSlug });
      const targetDoc = index.getDocBySlug(targetSlug);
      if (!targetDoc) {
        brokenLinks.add(targetSlug);
        continue;
      }
      if (!visited.has(targetSlug)) {
        queue.push({ slug: targetSlug, depth: current.depth + 1 });
      }
    }
  }

  return {
    nodes: [...nodes.values()],
    edges,
    maxDepthReached,
    truncated,
    broken_links: [...brokenLinks],
  };
}

export function buildLinkIndexForDocs(index: DocIndex): LinkIndexSnapshot {
  return buildSnapshot(index);
}
