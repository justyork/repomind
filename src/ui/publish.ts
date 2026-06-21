import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { DocIndex } from '../index/doc-index.js';
import { isValidSlug, resolveDocPath } from '../index/slug.js';
import { TYPE_TO_DIR, isDocStatus, isDocType } from '../index/types.js';
import type { DraftRow } from './db/drafts-db.js';

export interface PublishResult {
  path: string;
  slug: string;
}

export interface PublishError {
  code: 'invalid_slug' | 'invalid_type' | 'invalid_status' | 'path_conflict' | 'broken_related';
  message: string;
}

export function validateDraftForPublish(
  index: DocIndex,
  draft: DraftRow,
): PublishError | null {
  if (!isValidSlug(draft.slug)) {
    return { code: 'invalid_slug', message: `invalid slug: ${draft.slug}` };
  }
  if (!isDocType(draft.type)) {
    return { code: 'invalid_type', message: `invalid type: ${draft.type}` };
  }
  if (!isDocStatus(draft.status)) {
    return { code: 'invalid_status', message: `invalid status: ${draft.status}` };
  }

  const knowledgeRoot = index.getKnowledgeRoot();
  if (!knowledgeRoot) {
    return { code: 'path_conflict', message: 'no knowledge root' };
  }

  const typeDir = TYPE_TO_DIR[draft.type];
  const targetPath = resolveDocPath(knowledgeRoot, typeDir, draft.slug);
  if (!targetPath) {
    return { code: 'invalid_slug', message: `cannot resolve path for slug: ${draft.slug}` };
  }

  const slugSet = new Set(index.refresh().map((doc) => doc.slug));
  for (const related of draft.related) {
    if (!slugSet.has(related) && related !== draft.slug) {
      return {
        code: 'broken_related',
        message: `broken related slug: ${related}`,
      };
    }
  }

  if (fs.existsSync(targetPath) && !draft.forked_from) {
    return {
      code: 'path_conflict',
      message: `file already exists: ${targetPath}`,
    };
  }

  return null;
}

export function buildMarkdownFromDraft(draft: DraftRow): string {
  const frontmatter = {
    type: draft.type,
    slug: draft.slug,
    status: draft.status,
    title: draft.title,
    tags: draft.tags,
    related: draft.related,
    updated: new Date().toISOString().slice(0, 10),
  };
  return matter.stringify(draft.body, frontmatter);
}

export function publishDraft(index: DocIndex, draft: DraftRow): PublishResult {
  const validation = validateDraftForPublish(index, draft);
  if (validation) {
    throw new Error(validation.message);
  }

  const knowledgeRoot = index.getKnowledgeRoot()!;
  const typeDir = TYPE_TO_DIR[draft.type];
  const targetPath = resolveDocPath(knowledgeRoot, typeDir, draft.slug)!;

  const markdown = buildMarkdownFromDraft(draft);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, markdown, 'utf8');
  index.refresh();

  return { path: targetPath, slug: draft.slug };
}
