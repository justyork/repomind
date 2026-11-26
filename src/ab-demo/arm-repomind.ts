import type { DocIndex } from '../index/doc-index.js';
import { MCP_GET_DOC_OPTIONS, getDoc } from '../tools/get-doc.js';
import { MCP_DEFAULT_SEARCH_LIMIT, searchDocs, toMcpSearchHit } from '../tools/search-docs.js';
import { estimateJsonTokens } from './estimate-tokens.js';
import type { ArmRepomindResult } from './types.js';
import type { AbQuestion } from './types.js';

const GET_DOC_LIMIT = 3;

/**
 * Arm B: RepoMind MCP — search_docs then get_doc on top hits.
 */
export function runArmRepomind(
  index: DocIndex,
  question: AbQuestion,
  sessionOverheadPerQuestion: number,
): ArmRepomindResult {
  let tokens = sessionOverheadPerQuestion;

  const searchInput = { query: question.prompt, limit: MCP_DEFAULT_SEARCH_LIMIT };
  tokens += estimateJsonTokens({ tool: 'search_docs', input: searchInput });

  const hits = searchDocs(index, searchInput);
  tokens += estimateJsonTokens(hits.map(toMcpSearchHit));

  const slugsToFetch = hits.slice(0, GET_DOC_LIMIT).map((hit) => hit.slug);
  let docsFetched = 0;
  let anchorFound = false;

  for (const slug of slugsToFetch) {
    tokens += estimateJsonTokens({ tool: 'get_doc', input: { slug } });
    const doc = getDoc(index, slug, MCP_GET_DOC_OPTIONS);
    if (doc.found && doc.body) {
      tokens += estimateJsonTokens({
        slug: doc.slug,
        title: doc.frontmatter?.title,
        body: doc.body,
        outline: doc.outline,
        backlinks: doc.backlinks,
      });
      docsFetched += 1;
      if (question.anchorSlugs.includes(slug)) {
        anchorFound = true;
      }
    }
  }

  return {
    arm: 'repomind',
    questionId: question.id,
    tokens,
    searchHits: hits.length,
    docsFetched,
    anchorFound,
  };
}
