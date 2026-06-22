import type { IncomingMessage } from 'node:http';
import type { DocIndex } from '../index/doc-index.js';
import { runExport } from '../commands/export.js';
import { isValidSlug } from '../index/slug.js';
import { DOC_TYPES, isDocStatus, isDocType } from '../index/types.js';
import { writeCatalogEmoji, readCatalogMeta } from './catalog-meta.js';
import { createFolder, createPageFile } from './fs-operations.js';
import { prepareDocFile } from '../prepare/prepare-docs.js';
import { getDoc } from '../tools/get-doc.js';
import type { DraftsDb } from './db/drafts-db.js';
import { computeDraftDiff } from './diff.js';
import { publishDraft } from './publish.js';

export interface DraftApiResponse {
  status: number;
  body: unknown;
}

function jsonError(status: number, message: string): DraftApiResponse {
  return { status, body: { error: message } };
}

function parseJsonBody(raw: string): Record<string, unknown> | null {
  if (!raw.trim()) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function stringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === 'string');
}

export function handleDraftApi(
  index: DocIndex,
  db: DraftsDb | undefined,
  method: string,
  pathname: string,
  bodyRaw: string,
): DraftApiResponse | null {
  if (pathname === '/api/export' && method === 'POST') {
    const code = runExport({ force: true });
    if (code !== 0) {
      return jsonError(500, 'export failed');
    }
    return { status: 200, body: { ok: true, path: 'agents.md' } };
  }

  if (pathname === '/api/catalog-meta' && method === 'PUT') {
    const body = parseJsonBody(bodyRaw);
    if (body === null) {
      return jsonError(400, 'invalid JSON body');
    }
    const folderPath = typeof body.path === 'string' ? body.path : '';
    const emoji = typeof body.emoji === 'string' ? body.emoji : '';
    const knowledgeRoot = index.getKnowledgeRoot();
    if (!knowledgeRoot) {
      return jsonError(404, 'no docs/ directory found');
    }
    const meta = writeCatalogEmoji(knowledgeRoot, folderPath, emoji);
    return { status: 200, body: { meta } };
  }

  if (pathname === '/api/fs/folder' && method === 'POST') {
    const body = parseJsonBody(bodyRaw);
    if (body === null) {
      return jsonError(400, 'invalid JSON body');
    }
    const parentPath = typeof body.parentPath === 'string' ? body.parentPath : '';
    const name = typeof body.name === 'string' ? body.name : '';
    try {
      const result = createFolder(index, parentPath, name);
      return { status: 201, body: { result } };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return jsonError(400, message);
    }
  }

  if (pathname === '/api/fs/page' && method === 'POST') {
    const body = parseJsonBody(bodyRaw);
    if (body === null) {
      return jsonError(400, 'invalid JSON body');
    }
    const parentPath = typeof body.parentPath === 'string' ? body.parentPath : '';
    const name = typeof body.name === 'string' ? body.name : '';
    const title = typeof body.title === 'string' ? body.title : undefined;
    if (!db) {
      return jsonError(503, 'drafts database unavailable');
    }
    try {
      const page = createPageFile(index, parentPath, name, title);
      const existing = db.getActiveBySlug(page.slug);
      if (existing) {
        return { status: 200, body: { page, draft: existing } };
      }
      const doc = getDoc(index, page.slug);
      const tags = Array.isArray(doc.frontmatter?.tags)
        ? doc.frontmatter.tags.filter((tag): tag is string => typeof tag === 'string')
        : [];
      const related = Array.isArray(doc.frontmatter?.related)
        ? doc.frontmatter.related.filter((item): item is string => typeof item === 'string')
        : [];
      const draft = db.create({
        slug: page.slug,
        type: page.type,
        title: typeof doc.frontmatter?.title === 'string' ? doc.frontmatter.title : page.slug,
        body: doc.body ?? '',
        tags,
        related,
        target_path: page.relativePath,
      });
      return { status: 201, body: { page, draft } };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return jsonError(400, message);
    }
  }

  if (pathname === '/api/drafts/open' && method === 'POST') {
    if (!db) {
      return jsonError(503, 'drafts database unavailable');
    }
    const body = parseJsonBody(bodyRaw);
    if (body === null) {
      return jsonError(400, 'invalid JSON body');
    }
    const slug = typeof body.slug === 'string' ? body.slug : '';
    if (!isValidSlug(slug)) {
      return jsonError(400, `invalid slug: ${slug}`);
    }
    const existing = db.getActiveBySlug(slug);
    if (existing) {
      return { status: 200, body: { draft: existing } };
    }
    const doc = getDoc(index, slug);
    if (!doc.found || !doc.slug || !doc.frontmatter) {
      return jsonError(404, `document not found: ${slug}`);
    }
    const docRecord = index.getDocBySlug(slug);
    try {
      const draft = db.create({
        slug: doc.slug,
        type: doc.frontmatter.type,
        title: doc.frontmatter.title ?? doc.slug,
        body: doc.body ?? '',
        tags: doc.frontmatter.tags ?? [],
        related: doc.frontmatter.related ?? [],
        forked_from: doc.slug,
        target_path: docRecord?.relativePath ?? null,
      });
      return { status: 201, body: { draft } };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return jsonError(409, message);
    }
  }

  if (pathname === '/api/prepare' && method === 'POST') {
    const body = parseJsonBody(bodyRaw);
    if (body === null) {
      return jsonError(400, 'invalid JSON body');
    }
    const relativePath = typeof body.path === 'string' ? body.path : '';
    if (!relativePath.trim()) {
      return jsonError(400, 'path is required');
    }
    const typeParam = typeof body.type === 'string' ? body.type : undefined;
    if (typeParam && !isDocType(typeParam)) {
      return jsonError(400, `invalid type — expected one of: ${DOC_TYPES.join(', ')}`);
    }
    const slugParam = typeof body.slug === 'string' ? body.slug : undefined;
    if (slugParam && !isValidSlug(slugParam)) {
      return jsonError(400, `invalid slug: ${slugParam}`);
    }
    const statusParam = typeof body.status === 'string' ? body.status : undefined;
    if (statusParam && !isDocStatus(statusParam)) {
      return jsonError(400, `invalid status: ${statusParam}`);
    }
    const titleParam = typeof body.title === 'string' ? body.title : undefined;

    try {
      const result = prepareDocFile(index, relativePath, {
        type: typeParam && isDocType(typeParam) ? typeParam : undefined,
        slug: slugParam,
        title: titleParam,
        status: statusParam && isDocStatus(statusParam) ? statusParam : undefined,
      });
      return { status: 200, body: { result } };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return jsonError(400, message);
    }
  }

  if (!db) {
    if (pathname.startsWith('/api/drafts')) {
      return jsonError(503, 'drafts database unavailable');
    }
    return null;
  }

  if (!pathname.startsWith('/api/drafts')) {
    return null;
  }

  if (pathname === '/api/drafts' && method === 'GET') {
    return { status: 200, body: { drafts: db.listActive() } };
  }

  const diffMatch = pathname.match(/^\/api\/drafts\/([^/]+)\/diff$/);
  if (diffMatch && method === 'GET') {
    const id = decodeURIComponent(diffMatch[1] ?? '');
    const draft = db.getById(id);
    if (!draft) {
      return jsonError(404, 'draft not found');
    }
    return { status: 200, body: computeDraftDiff(index, draft) };
  }

  if (pathname === '/api/drafts' && method === 'POST') {
    const body = parseJsonBody(bodyRaw);
    if (body === null) {
      return jsonError(400, 'invalid JSON body');
    }

    const forkFrom = typeof body.forkFrom === 'string' ? body.forkFrom : undefined;
    if (forkFrom) {
      if (!isValidSlug(forkFrom)) {
        return jsonError(400, `invalid forkFrom slug: ${forkFrom}`);
      }
      const existing = db.getActiveBySlug(forkFrom);
      if (existing) {
        return jsonError(409, `active draft already exists for slug: ${forkFrom}`);
      }
      const doc = getDoc(index, forkFrom);
      if (!doc.found || !doc.slug || !doc.frontmatter) {
        return jsonError(404, `document not found: ${forkFrom}`);
      }
      const docRecord = index.getDocBySlug(forkFrom);
      try {
        const draft = db.create({
          slug: doc.slug,
          type: doc.frontmatter.type,
          title: doc.frontmatter.title ?? doc.slug,
          body: doc.body ?? '',
          tags: doc.frontmatter.tags ?? [],
          related: doc.frontmatter.related ?? [],
          forked_from: doc.slug,
          target_path: docRecord?.relativePath ?? null,
        });
        return { status: 201, body: { draft } };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonError(409, message);
      }
    }

    const slug = typeof body.slug === 'string' ? body.slug : '';
    const type = typeof body.type === 'string' ? body.type : '';
    if (!isValidSlug(slug)) {
      return jsonError(400, `invalid slug: ${slug}`);
    }
    if (!isDocType(type)) {
      return jsonError(400, `invalid type — expected one of: ${DOC_TYPES.join(', ')}`);
    }

    try {
      const draft = db.create({
        slug,
        type,
        title: typeof body.title === 'string' ? body.title : slug,
        body: typeof body.body === 'string' ? body.body : '',
        tags: stringArray(body.tags),
        related: stringArray(body.related),
      });
      return { status: 201, body: { draft } };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return jsonError(409, message);
    }
  }

  const publishMatch = pathname.match(/^\/api\/drafts\/([^/]+)\/publish$/);
  if (publishMatch && method === 'POST') {
    const id = decodeURIComponent(publishMatch[1] ?? '');
    const draft = db.getById(id);
    if (!draft) {
      return jsonError(404, 'draft not found');
    }
    try {
      const result = publishDraft(index, draft);
      const published = db.markPublished(id, result.path);
      return { status: 200, body: { published, result } };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('already exists') || message.includes('broken related')) {
        return jsonError(409, message);
      }
      return jsonError(400, message);
    }
  }

  const idMatch = pathname.match(/^\/api\/drafts\/([^/]+)$/);
  if (idMatch) {
    const id = decodeURIComponent(idMatch[1] ?? '');

    if (method === 'PUT') {
      const body = parseJsonBody(bodyRaw);
      if (body === null) {
        return jsonError(400, 'invalid JSON body');
      }
      const type = typeof body.type === 'string' ? body.type : undefined;
      if (type && !isDocType(type)) {
        return jsonError(400, `invalid type: ${type}`);
      }
      const slug = typeof body.slug === 'string' ? body.slug : undefined;
      if (slug && !isValidSlug(slug)) {
        return jsonError(400, `invalid slug: ${slug}`);
      }

      const status = typeof body.status === 'string' ? body.status : undefined;
      if (status && !isDocStatus(status)) {
        return jsonError(400, `invalid status: ${status}`);
      }

      try {
        const draft = db.update(id, {
          slug,
          type: type && isDocType(type) ? type : undefined,
          status: status && isDocStatus(status) ? status : undefined,
          title: typeof body.title === 'string' ? body.title : undefined,
          body: typeof body.body === 'string' ? body.body : undefined,
          tags: stringArray(body.tags),
          related: stringArray(body.related),
        });
        return { status: 200, body: { draft } };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        const status = message.includes('not found') ? 404 : 409;
        return jsonError(status, message);
      }
    }

    if (method === 'DELETE') {
      try {
        const deleted = db.delete(id);
        if (!deleted) {
          return jsonError(404, 'draft not found');
        }
        return { status: 200, body: { deleted: true } };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        return jsonError(400, message);
      }
    }
  }

  return jsonError(405, 'method not allowed');
}
