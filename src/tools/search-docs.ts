import type { DocIndex } from '../index/doc-index.js';
import type { DocType, DocDomain } from '../index/types.js';

export interface SearchDocsInput {
  query: string;
  type?: DocType;
  domain?: DocDomain;
}

export interface SearchDocsResult {
  slug: string;
  title: string;
  snippet: string;
  score: number;
}

function tokenize(query: string): string[] {
  return query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => term.toLowerCase());
}

function haystack(doc: { title: string; tags: string[]; body: string }): string {
  return `${doc.title}\n${doc.tags.join(' ')}\n${doc.body}`.toLowerCase();
}

function scoreDoc(
  doc: { title: string; tags: string[]; body: string },
  terms: string[],
): number | null {
  const titleLower = doc.title.toLowerCase();
  const bodyLower = doc.body.toLowerCase();
  const tagsLower = doc.tags.map((tag) => tag.toLowerCase());

  for (const term of terms) {
    const inTitle = titleLower.includes(term);
    const inBody = bodyLower.includes(term);
    const inTags = tagsLower.some((tag) => tag.includes(term));
    if (!inTitle && !inBody && !inTags) {
      return null;
    }
  }

  let score = 0;
  for (const term of terms) {
    if (tagsLower.some((tag) => tag.includes(term))) {
      score += 3;
    }
    if (titleLower.includes(term)) {
      score += 2;
    }
    if (bodyLower.includes(term)) {
      score += 1;
    }
  }

  return score;
}

function makeSnippet(body: string, terms: string[]): string {
  const lowerBody = body.toLowerCase();
  for (const term of terms) {
    const index = lowerBody.indexOf(term);
    if (index >= 0) {
      const start = Math.max(0, index - 40);
      const end = Math.min(body.length, index + term.length + 40);
      return body.slice(start, end).replace(/\s+/g, ' ').trim();
    }
  }
  return body.slice(0, 120).replace(/\s+/g, ' ').trim();
}

export function searchDocs(
  index: DocIndex,
  input: SearchDocsInput,
): SearchDocsResult[] {
  if (!index.getKnowledgeRoot()) {
    return [];
  }

  const terms = tokenize(input.query);
  if (terms.length === 0) {
    return [];
  }

  let docs = index.refresh();
  if (input.type) {
    docs = docs.filter((doc) => doc.type === input.type);
  }
  if (input.domain) {
    docs = docs.filter((doc) => doc.domain === input.domain);
  }

  const results: SearchDocsResult[] = [];

  for (const doc of docs) {
    const score = scoreDoc(doc, terms);
    if (score === null) {
      continue;
    }
    results.push({
      slug: doc.slug,
      title: doc.title,
      snippet: makeSnippet(doc.body, terms),
      score,
    });
  }

  return results
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug))
    .slice(0, 20);
}
