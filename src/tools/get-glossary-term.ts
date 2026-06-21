import { firstParagraph } from '../index/doc-index.js';
import type { DocIndex } from '../index/doc-index.js';
import { searchDocs } from './search-docs.js';

export interface GetGlossaryTermResult {
  found: boolean;
  slug?: string;
  definition?: string;
  related?: string[];
  suggestions?: string[];
}

function substringMatch(
  name: string,
  slug: string,
  title: string,
): boolean {
  const needle = name.toLowerCase();
  return slug.toLowerCase().includes(needle) || title.toLowerCase().includes(needle);
}

export function getGlossaryTerm(
  index: DocIndex,
  name: string,
): GetGlossaryTermResult {
  if (!index.getKnowledgeRoot()) {
    return { found: false };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { found: false, suggestions: [] };
  }

  const glossaryDocs = index.getDocsByType('glossary-term');

  const exact = glossaryDocs.find(
    (doc) => doc.slug.toLowerCase() === trimmed.toLowerCase(),
  );
  if (exact) {
    return {
      found: true,
      slug: exact.slug,
      definition: firstParagraph(exact.body),
      related: exact.related,
    };
  }

  const substringHits = glossaryDocs.filter((doc) =>
    substringMatch(trimmed, doc.slug, doc.title),
  );
  if (substringHits.length === 1) {
    const hit = substringHits[0];
    return {
      found: true,
      slug: hit.slug,
      definition: firstParagraph(hit.body),
      related: hit.related,
    };
  }

  const ranked = searchDocs(index, { query: trimmed, type: 'glossary-term' });
  const suggestions = ranked.slice(0, 3).map((result) => result.slug);

  return {
    found: false,
    suggestions,
  };
}
