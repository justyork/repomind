import type { DocIndex } from '../index/doc-index.js';
import { DOC_STATUSES, DOC_TYPES, type DocStatus, type DocType } from '../index/types.js';

export interface KnowledgeStats {
  byType: Record<DocType, number>;
  byStatus: Record<DocStatus, number>;
  brokenRelatedCount: number;
  totalDocs: number;
}

export function computeKnowledgeStats(index: DocIndex): KnowledgeStats {
  const byType = Object.fromEntries(DOC_TYPES.map((t) => [t, 0])) as Record<DocType, number>;
  const byStatus = Object.fromEntries(DOC_STATUSES.map((s) => [s, 0])) as Record<
    DocStatus,
    number
  >;

  const docs = index.refresh();
  const slugSet = new Set(docs.map((doc) => doc.slug));
  let brokenRelatedCount = 0;

  for (const doc of docs) {
    byType[doc.type] += 1;
    byStatus[doc.status] += 1;
    for (const related of doc.related) {
      if (!slugSet.has(related)) {
        brokenRelatedCount += 1;
      }
    }
  }

  return {
    byType,
    byStatus,
    brokenRelatedCount,
    totalDocs: docs.length,
  };
}
