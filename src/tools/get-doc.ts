import { isValidSlug } from '../index/slug.js';
import type { DocIndex } from '../index/doc-index.js';
import type { DocFrontmatter } from '../index/types.js';

export interface GetDocResult {
  found: boolean;
  slug?: string;
  frontmatter?: DocFrontmatter;
  body?: string;
}

export function getDoc(index: DocIndex, slug: string): GetDocResult {
  if (!index.getKnowledgeRoot()) {
    return { found: false };
  }

  if (!isValidSlug(slug)) {
    return { found: false };
  }

  const doc = index.getDocBySlug(slug);
  if (!doc) {
    return { found: false };
  }

  return {
    found: true,
    slug: doc.slug,
    frontmatter: doc.frontmatter,
    body: doc.body,
  };
}
