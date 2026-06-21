import type { DocIndex } from '../index/doc-index.js';
import type { ExploreGraphResult } from '../tools/explore-graph.js';

export const ALL_GRAPH_SLUG = '__all__';
export const MAX_ALL_GRAPH_NODES = 200;

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
  const slugSet = new Set(docs.map((doc) => doc.slug));
  const brokenLinks = new Set<string>();
  const edgeKeys = new Set<string>();
  const edges: ExploreGraphResult['edges'] = [];

  let truncated = false;
  const limitedDocs = docs.length > MAX_ALL_GRAPH_NODES ? docs.slice(0, MAX_ALL_GRAPH_NODES) : docs;
  if (docs.length > MAX_ALL_GRAPH_NODES) {
    truncated = true;
  }

  const limitedSlugs = new Set(limitedDocs.map((doc) => doc.slug));

  for (const doc of limitedDocs) {
    for (const relatedSlug of doc.related) {
      if (!slugSet.has(relatedSlug)) {
        brokenLinks.add(relatedSlug);
        continue;
      }
      if (!limitedSlugs.has(relatedSlug)) {
        continue;
      }
      const key = `${doc.slug}\0${relatedSlug}`;
      if (edgeKeys.has(key)) {
        continue;
      }
      edgeKeys.add(key);
      edges.push({ from: doc.slug, to: relatedSlug });
    }
  }

  return {
    nodes: limitedDocs.map((doc) => ({
      slug: doc.slug,
      type: doc.type,
      title: doc.title,
    })),
    edges,
    maxDepthReached: 0,
    truncated,
    broken_links: [...brokenLinks],
  };
}
