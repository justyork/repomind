import type { DocIndex } from '../index/doc-index.js';
import type { DocRecord, DocStatus, DocType } from '../index/types.js';

export interface ListDocsInput {
  type?: DocType;
  status?: DocStatus;
  tag?: string;
}

export interface ListDocsItem {
  slug: string;
  type: DocType;
  title: string;
  status: DocStatus;
}

export function listDocs(index: DocIndex, input: ListDocsInput = {}): ListDocsItem[] {
  const root = index.getKnowledgeRoot();
  if (!root) {
    return [];
  }

  let docs = index.refresh();

  if (input.type) {
    docs = docs.filter((doc) => doc.type === input.type);
  }
  if (input.status) {
    docs = docs.filter((doc) => doc.status === input.status);
  }
  if (input.tag) {
    const tagLower = input.tag.toLowerCase();
    docs = docs.filter((doc) =>
      doc.tags.some((tag) => tag.toLowerCase() === tagLower),
    );
  }

  return docs.map((doc) => ({
    slug: doc.slug,
    type: doc.type,
    title: doc.title,
    status: doc.status,
  }));
}

export function getDocRecord(index: DocIndex, slug: string): DocRecord | null {
  if (!index.getKnowledgeRoot()) {
    return null;
  }
  return index.getDocBySlug(slug);
}
