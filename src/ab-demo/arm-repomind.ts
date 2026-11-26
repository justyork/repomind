import type { DocIndex } from '../index/doc-index.js';
import { MCP_GET_DOC_OPTIONS, getDoc, toMcpDoc } from '../tools/get-doc.js';
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

  const toFetch = hits.slice(0, GET_DOC_LIMIT);
  let docsFetched = 0;
  let anchorFound = false;
  let toolCalls = 1;

  // Policy: an agent follows the best-section hint from search_docs when there is one.
  for (const hit of toFetch) {
    const input = { slug: hit.slug, ...(hit.section ? { section: hit.section } : {}) };
    tokens += estimateJsonTokens({ tool: 'get_doc', input });
    toolCalls += 1;
    const doc = getDoc(index, hit.slug, { ...MCP_GET_DOC_OPTIONS, section: hit.section });
    if (doc.found && doc.body) {
      tokens += estimateJsonTokens(toMcpDoc(doc));
      docsFetched += 1;
      if (question.anchorSlugs.includes(hit.slug)) {
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
    toolCalls,
  };
}
