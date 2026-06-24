import type { DocIndex } from '../index/doc-index.js';
import { isValidSlug, slugFromTitle } from '../index/slug.js';
import { DOC_TYPES, isDocType } from '../index/types.js';
import { getAgentWriteGate } from '../agent-write-gate.js';
import { getDoc } from './get-doc.js';
import { openDraftsDb } from '../ui/db/drafts-db.js';

export type CreateDraftErrorCode =
  | 'AGENT_WRITE_DISABLED'
  | 'BAD_TYPE'
  | 'BAD_SLUG'
  | 'BAD_TITLE'
  | 'DRAFT_EXISTS'
  | 'DOC_NOT_FOUND'
  | 'NO_KNOWLEDGE_ROOT'
  | 'SLUG_CONFLICT'
  | 'WRITE_CONFLICT';

export interface CreateDraftError {
  code: CreateDraftErrorCode;
  message: string;
  hint?: string;
}

export interface CreateDraftSuccess {
  draftId: string;
  slug: string;
  title: string;
  type: string;
  editUrl: string;
  editHint: string;
}

export type CreateDraftResult =
  | { ok: true; data: CreateDraftSuccess }
  | { ok: false; error: CreateDraftError };

export interface CreateDraftInput {
  type: string;
  title: string;
  body: string;
  slug?: string;
  related?: string[];
  tags?: string[];
  forked_from?: string;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function normalizeInput(raw: CreateDraftInput): CreateDraftInput {
  return {
    type: raw.type.trim(),
    title: raw.title.trim(),
    body: raw.body,
    slug: typeof raw.slug === 'string' && raw.slug.trim() ? raw.slug.trim() : undefined,
    related: stringArray(raw.related),
    tags: stringArray(raw.tags),
    forked_from:
      typeof raw.forked_from === 'string' && raw.forked_from.trim()
        ? raw.forked_from.trim()
        : undefined,
  };
}

function fail(
  code: CreateDraftErrorCode,
  message: string,
  hint?: string,
): CreateDraftResult {
  return { ok: false, error: { code, message, hint } };
}

function success(draft: {
  id: string;
  slug: string;
  title: string;
  type: string;
}): CreateDraftResult {
  const editUrl = `/?draft=${encodeURIComponent(draft.id)}`;
  return {
    ok: true,
    data: {
      draftId: draft.id,
      slug: draft.slug,
      title: draft.title,
      type: draft.type,
      editUrl,
      editHint: `Run \`repo-mind ui\` and open draft "${draft.title}" in the sidebar (${editUrl}).`,
    },
  };
}

function slugTaken(index: DocIndex, slug: string, allowExistingDoc: boolean): boolean {
  if (index.getDocBySlug(slug) && !allowExistingDoc) {
    return true;
  }
  return false;
}

function resolveAvailableSlug(
  index: DocIndex,
  db: ReturnType<typeof openDraftsDb>,
  base: string,
  options: { autoSuffix: boolean; allowExistingDoc: boolean },
): string | CreateDraftError {
  if (!isValidSlug(base)) {
    return { code: 'BAD_SLUG', message: `invalid slug: ${base}` };
  }

  const isFree = (slug: string) =>
    !db.getActiveBySlug(slug) && !slugTaken(index, slug, options.allowExistingDoc);

  if (isFree(base)) {
    return base;
  }

  if (!options.autoSuffix) {
    if (db.getActiveBySlug(base)) {
      return {
        code: 'DRAFT_EXISTS',
        message: `active draft already exists for slug: ${base}`,
      };
    }
    return {
      code: 'SLUG_CONFLICT',
      message: `published document already exists for slug: ${base}`,
      hint: 'Use forked_from to edit an existing page, or omit slug to auto-assign a suffix.',
    };
  }

  for (let suffix = 2; suffix <= 9; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (isValidSlug(candidate) && isFree(candidate)) {
      return candidate;
    }
  }

  return {
    code: 'WRITE_CONFLICT',
    message: `could not allocate slug for base: ${base}`,
    hint: 'All slug suffixes -2 through -9 are taken.',
  };
}

export function createDraft(
  index: DocIndex,
  rawInput: CreateDraftInput,
  cwd: string = process.cwd(),
): CreateDraftResult {
  const gate = getAgentWriteGate(cwd);
  if (!gate.enabled) {
    return fail('AGENT_WRITE_DISABLED', gate.reason, 'Set REPOMIND_AGENT_WRITE=1 for local override.');
  }

  const knowledgeRoot = index.getKnowledgeRoot();
  if (!knowledgeRoot) {
    return fail('NO_KNOWLEDGE_ROOT', 'no docs/ knowledge root found');
  }

  const input = normalizeInput(rawInput);
  const db = openDraftsDb(knowledgeRoot);

  try {
    if (input.forked_from) {
      if (!isValidSlug(input.forked_from)) {
        return fail('BAD_SLUG', `invalid forked_from slug: ${input.forked_from}`);
      }

      const existing = db.getActiveBySlug(input.forked_from);
      if (existing) {
        return fail('DRAFT_EXISTS', `active draft already exists for slug: ${input.forked_from}`);
      }

      const doc = getDoc(index, input.forked_from);
      if (!doc.found || !doc.slug || !doc.frontmatter) {
        return fail('DOC_NOT_FOUND', `document not found: ${input.forked_from}`);
      }

      const docRecord = index.getDocBySlug(input.forked_from);
      try {
        const draft = db.create({
          slug: doc.slug,
          type: doc.frontmatter.type,
          title: input.title || doc.frontmatter.title || doc.slug,
          body: input.body || doc.body || '',
          tags: (input.tags ?? []).length > 0 ? input.tags ?? [] : (doc.frontmatter.tags ?? []),
          related:
            (input.related ?? []).length > 0 ? input.related ?? [] : (doc.frontmatter.related ?? []),
          forked_from: doc.slug,
          target_path: docRecord?.relativePath ?? null,
        });
        return success(draft);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('already exists')) {
          return fail('DRAFT_EXISTS', message);
        }
        throw error;
      }
    }

    if (!input.title) {
      return fail('BAD_TITLE', 'title is required');
    }
    if (!isDocType(input.type)) {
      return fail('BAD_TYPE', `invalid type — expected one of: ${DOC_TYPES.join(', ')}`);
    }

    const baseSlug = input.slug ?? slugFromTitle(input.title);
    const resolved = resolveAvailableSlug(index, db, baseSlug, {
      autoSuffix: !input.slug,
      allowExistingDoc: false,
    });
    if (typeof resolved !== 'string') {
      return { ok: false, error: resolved };
    }

    try {
      const draft = db.create({
        slug: resolved,
        type: input.type,
        title: input.title,
        body: input.body,
        tags: input.tags,
        related: input.related,
      });
      return success(draft);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('already exists')) {
        return fail('DRAFT_EXISTS', message);
      }
      throw error;
    }
  } finally {
    db.close();
  }
}
