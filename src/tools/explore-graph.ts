import { isValidSlug } from '../index/slug.js';
import type { DocIndex } from '../index/doc-index.js';
import {
  buildLinkIndex,
  getOutboundSlugs,
  type LinkIndexSnapshot,
} from '../index/link-index.js';
import type { DocType } from '../index/types.js';
import { buildDocsTree, collectParentOfEdges } from '../ui/fs-tree.js';

export const DEFAULT_GRAPH_DEPTH = 2;

export type GraphDirection = 'out' | 'in' | 'both';

export interface ExploreGraphInput {
  slug: string;
  /** Hops from the root slug (0 = root only). Default 2. */
  depth?: number;
  /** out: links the doc makes; in: backlinks; both: either. Default out. */
  direction?: GraphDirection;
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

  if (!index.getKnowledgeRoot() || !isValidSlug(input.slug)) {
    return empty;
  }

  const rootDoc = index.getDocBySlug(input.slug);
  if (!rootDoc) {
    return empty;
  }

  // depth = number of hops from the root (0 = root only).
  const maxDepth = Math.max(0, Math.floor(input.depth ?? DEFAULT_GRAPH_DEPTH));
  const direction = input.direction ?? 'out';

  const linkIndex = buildSnapshot(index);
  const nodes = new Map<string, ExploreGraphNode>();
  const edgeKeys = new Set<string>();
  const edges: ExploreGraphEdge[] = [];
  const brokenLinks = new Set<string>(linkIndex.brokenTargets);
  const seen = new Set<string>([rootDoc.slug]);
  let maxDepthReached = 0;
  let truncated = false;

  function addEdge(from: string, to: string): void {
    const key = `${from}\0${to}`;
    if (!edgeKeys.has(key)) {
      edgeKeys.add(key);
      edges.push({ from, to });
    }
  }

  function neighbours(slug: string): Array<{ other: string; from: string; to: string }> {
    const result: Array<{ other: string; from: string; to: string }> = [];
    if (direction === 'out' || direction === 'both') {
      for (const to of getOutboundSlugs(linkIndex, slug)) {
        result.push({ other: to, from: slug, to });
      }
    }
    if (direction === 'in' || direction === 'both') {
      for (const entry of linkIndex.backlinks.get(slug) ?? []) {
        result.push({ other: entry.from, from: entry.from, to: slug });
      }
    }
    return result;
  }

  const queue: Array<{ slug: string; depth: number }> = [{ slug: rootDoc.slug, depth: 0 }];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const doc = index.getDocBySlug(current.slug);
    if (!doc) {
      continue;
    }

    nodes.set(doc.slug, { slug: doc.slug, type: doc.type, title: doc.title });
    maxDepthReached = Math.max(maxDepthReached, current.depth);

    for (const link of neighbours(doc.slug)) {
      if (!index.getDocBySlug(link.other)) {
        brokenLinks.add(link.other);
        continue;
      }
      if (seen.has(link.other)) {
        addEdge(link.from, link.to);
        continue;
      }
      if (current.depth >= maxDepth) {
        truncated = true;
        continue;
      }
      seen.add(link.other);
      addEdge(link.from, link.to);
      queue.push({ slug: link.other, depth: current.depth + 1 });
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
