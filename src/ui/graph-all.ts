import type { DocIndex } from '../index/doc-index.js';
import type { LinkIndexSnapshot } from '../index/link-index.js';
import { buildLinkIndexForDocs, type ExploreGraphResult } from '../tools/explore-graph.js';

export const ALL_GRAPH_SLUG = '__all__';
export const MAX_ALL_GRAPH_NODES = 200;

function edgesForLimitedSlugs(
  linkIndex: LinkIndexSnapshot,
  limitedSlugs: Set<string>,
): ExploreGraphResult['edges'] {
  const edgeKeys = new Set<string>();
  const edges: ExploreGraphResult['edges'] = [];

  for (const edge of linkIndex.edges) {
    if (!limitedSlugs.has(edge.from) || !limitedSlugs.has(edge.to)) {
      continue;
    }
    const key = `${edge.from}\0${edge.to}`;
    if (edgeKeys.has(key)) {
      continue;
    }
    edgeKeys.add(key);
    edges.push({ from: edge.from, to: edge.to });
  }

  return edges;
}

export function exploreGraphAll(index: DocIndex): ExploreGraphResult {
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

  const docs = index.refresh();
  const linkIndex = buildLinkIndexForDocs(index);

  let truncated = false;
  const limitedDocs = docs.length > MAX_ALL_GRAPH_NODES ? docs.slice(0, MAX_ALL_GRAPH_NODES) : docs;
  if (docs.length > MAX_ALL_GRAPH_NODES) {
    truncated = true;
  }

  const limitedSlugs = new Set(limitedDocs.map((doc) => doc.slug));

  return {
    nodes: limitedDocs.map((doc) => ({
      slug: doc.slug,
      type: doc.type,
      title: doc.title,
    })),
    edges: edgesForLimitedSlugs(linkIndex, limitedSlugs),
    maxDepthReached: 0,
    truncated,
    broken_links: [...linkIndex.brokenTargets],
  };
}
