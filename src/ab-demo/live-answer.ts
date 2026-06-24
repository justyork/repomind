import type { DocIndex } from '../index/doc-index.js';
import { getDoc } from '../tools/get-doc.js';
import { searchDocs } from '../tools/search-docs.js';
import { runArmBaseline } from './arm-baseline.js';
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

function queryTerms(prompt: string): string[] {
  return prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3);
}

function docMatchesTerms(doc: { title: string; tags: string[]; body: string }, terms: string[]): boolean {
  if (terms.length === 0) {
    return true;
  }
  const haystack = `${doc.title}\n${doc.tags.join(' ')}\n${doc.body}`.toLowerCase();
  return terms.some((term) => haystack.includes(term));
}

/** Build a grounded answer excerpt from baseline grep-then-read retrieval. */
export function buildBaselineAnswer(index: DocIndex, question: AbQuestion): LiveArmAnswer {
  const docs = index.refresh();
  const terms = queryTerms(question.prompt);
  let matched = docs.filter((doc) => docMatchesTerms(doc, terms));
  let strategy: LiveArmAnswer['strategy'] = 'grep-then-read';

  if (matched.length === 0) {
    matched = docs.slice(0, 5);
    strategy = 'read-all';
  } else {
    matched = matched.slice(0, 5);
  }

  const listing = docs.map((doc) => doc.relativePath).join('\n');
  const sessionOverhead = estimateTokens(BASELINE_CLAUDE_SNIPPET) + estimateTokens(listing);
  const perQuestionOverhead = Math.ceil(sessionOverhead / Math.max(docs.length, 1));

  const simulated = runArmBaseline(index, question, perQuestionOverhead);

  const parts = matched.map((doc) => {
    const title = doc.title || doc.slug;
    return `## ${title} (${doc.slug})\n\n${excerpt(doc.body)}`;
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
export function buildRepomindAnswer(index: DocIndex, question: AbQuestion): LiveArmAnswer {
  const docs = index.refresh();
  const sessionOverhead = mcpToolSchemaTokenEstimate();
  const perQuestionOverhead = Math.ceil(sessionOverhead / Math.max(docs.length, 1));

  const simulated = runArmRepomind(index, question, perQuestionOverhead);

  const hits = searchDocs(index, { query: question.prompt });
  const slugsToFetch = hits.slice(0, GET_DOC_LIMIT).map((hit) => hit.slug);
  const parts: string[] = [];

  for (const slug of slugsToFetch) {
    const doc = getDoc(index, slug);
    if (doc.found && doc.body) {
      const title =
        typeof doc.frontmatter?.title === 'string' ? doc.frontmatter.title : doc.slug;
      parts.push(`## ${title} (${doc.slug})\n\n${excerpt(doc.body)}`);
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
