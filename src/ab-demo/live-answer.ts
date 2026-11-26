import type { DocIndex } from '../index/doc-index.js';
import { extractAskSearchTerms, stemWord, stemsCompatible, tokenizeWords } from '../search/terms.js';
import { parseHeadings, splitFlatSections } from '../search/sections.js';
import { getDoc } from '../tools/get-doc.js';
import { MCP_DEFAULT_SEARCH_LIMIT, searchDocs } from '../tools/search-docs.js';
import { runArmBaseline, selectBaselineDocs } from './arm-baseline.js';
import { runArmRepomind } from './arm-repomind.js';
import {
  BASELINE_CLAUDE_SNIPPET,
  mcpToolSchemaTokenEstimate,
} from './session-overhead.js';
import { estimateTokens } from './estimate-tokens.js';
import type { AbQuestion, LiveArmAnswer } from './types.js';

const SNIPPET_CHARS = 1200;
const GET_DOC_LIMIT = 3;

function excerpt(body: string, maxChars: number = SNIPPET_CHARS): string {
  const trimmed = body.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxChars)}…`;
}

/**
 * Excerpt for the blind pack: the section of the page that best matches the question.
 * Used for both arms so neither is shown a page's irrelevant first lines.
 */
export function relevantExcerpt(body: string, prompt: string, maxChars: number = SNIPPET_CHARS): string {
  const headings = parseHeadings(body);
  if (headings.length === 0) {
    return excerpt(body, maxChars);
  }
  const stems = extractAskSearchTerms(prompt).map(stemWord);
  let best = '';
  let bestScore = -1;
  for (const section of splitFlatSections(body, headings)) {
    const wordStems = tokenizeWords(`${section.heading ?? ''} ${section.text}`).map(stemWord);
    const score = stems.filter((stem) => wordStems.some((wordStem) => stemsCompatible(wordStem, stem))).length;
    if (score > bestScore) {
      bestScore = score;
      best = section.text;
    }
  }
  return excerpt(best || body, maxChars);
}

/** Build a grounded answer excerpt from baseline grep-then-read retrieval. */
export function buildBaselineAnswer(
  index: DocIndex,
  question: AbQuestion,
  questionCount?: number,
): LiveArmAnswer {
  const docs = index.refresh();
  const { docs: matched, strategy } = selectBaselineDocs(index, question);

  const listing = docs.map((doc) => doc.relativePath).join('\n');
  const sessionOverhead = estimateTokens(BASELINE_CLAUDE_SNIPPET) + estimateTokens(listing);
  const perQuestionOverhead = Math.ceil(sessionOverhead / Math.max(questionCount ?? docs.length, 1));

  const simulated = runArmBaseline(index, question, perQuestionOverhead);

  const parts = matched.map((doc) => {
    const title = doc.title || doc.slug;
    return `## ${title} (${doc.slug})\n\n${relevantExcerpt(doc.body, question.prompt)}`;
  });

  return {
    arm: 'baseline',
    questionId: question.id,
    answer: parts.join('\n\n---\n\n'),
    retrievedSlugs: matched.map((doc) => doc.slug),
    tokens: simulated.tokens,
    filesRead: matched.length,
    strategy,
    searchHits: matched.length,
    docsFetched: matched.length,
  };
}

/** Build a grounded answer excerpt from RepoMind search_docs + get_doc retrieval. */
export function buildRepomindAnswer(
  index: DocIndex,
  question: AbQuestion,
  questionCount?: number,
): LiveArmAnswer {
  const docs = index.refresh();
  const sessionOverhead = mcpToolSchemaTokenEstimate();
  const perQuestionOverhead = Math.ceil(sessionOverhead / Math.max(questionCount ?? docs.length, 1));

  const simulated = runArmRepomind(index, question, perQuestionOverhead);

  const hits = searchDocs(index, { query: question.prompt, limit: MCP_DEFAULT_SEARCH_LIMIT });
  const slugsToFetch = hits.slice(0, GET_DOC_LIMIT).map((hit) => hit.slug);
  const parts: string[] = [];

  for (const slug of slugsToFetch) {
    const doc = getDoc(index, slug);
    if (doc.found && doc.body) {
      const title =
        typeof doc.frontmatter?.title === 'string' ? doc.frontmatter.title : doc.slug;
      parts.push(`## ${title} (${doc.slug})\n\n${relevantExcerpt(doc.body, question.prompt)}`);
    }
  }

  return {
    arm: 'repomind',
    questionId: question.id,
    answer: parts.length > 0 ? parts.join('\n\n---\n\n') : '_No matching documents retrieved._',
    retrievedSlugs: slugsToFetch,
    tokens: simulated.tokens,
    filesRead: slugsToFetch.length,
    strategy: 'search-then-get_doc',
    searchHits: hits.length,
    docsFetched: parts.length,
  };
}
