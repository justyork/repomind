import type { DocIndex } from '../index/doc-index.js';
import { getDoc } from '../tools/get-doc.js';
import { searchDocs } from '../tools/search-docs.js';
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

  const searchInput = { query: question.prompt };
  tokens += estimateJsonTokens({ tool: 'search_docs', input: searchInput });

  const hits = searchDocs(index, searchInput);
  tokens += estimateJsonTokens(hits);

  const slugsToFetch = hits.slice(0, GET_DOC_LIMIT).map((hit) => hit.slug);
  let docsFetched = 0;

  for (const slug of slugsToFetch) {
    tokens += estimateJsonTokens({ tool: 'get_doc', input: { slug } });
    const doc = getDoc(index, slug);
    if (doc.found && doc.body) {
      tokens += estimateJsonTokens({
        slug: doc.slug,
        title: doc.frontmatter?.title,
        body: doc.body,
      });
      docsFetched += 1;
    }
  }

  return {
    arm: 'repomind',
    questionId: question.id,
    tokens,
    searchHits: hits.length,
    docsFetched,
  };
}
