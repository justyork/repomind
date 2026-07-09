import type { DocIndex } from '../index/doc-index.js';
import { getDoc } from '../tools/get-doc.js';
import { searchDocsForAsk } from './search.js';
import type { AskSource } from './types.js';

const TOP_N = 5;
const EXCERPT_CHARS = 1200;

function excerpt(body: string, maxChars: number = EXCERPT_CHARS): string {
  const trimmed = body.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxChars)}…`;
}

function titleFromDoc(
  slug: string,
  frontmatter: { title?: unknown } | undefined,
): string {
  if (typeof frontmatter?.title === 'string' && frontmatter.title.trim()) {
    return frontmatter.title.trim();
  }
  return slug;
}

/** Retrieves top matching published docs for an ask question. */
export function retrieveAskContext(index: DocIndex, question: string): AskSource[] {
  const query = question.trim();
  if (!query) {
    return [];
  }

  const hits = searchDocsForAsk(index, query);
  const sources: AskSource[] = [];

  for (const hit of hits.slice(0, TOP_N)) {
    const doc = getDoc(index, hit.slug);
    if (!doc.found || !doc.body) {
      continue;
    }
    sources.push({
      slug: hit.slug,
      title: titleFromDoc(hit.slug, doc.frontmatter),
      excerpt: excerpt(doc.body),
    });
  }

  return sources;
}
