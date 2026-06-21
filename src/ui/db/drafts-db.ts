import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { DocType, DocStatus } from '../../index/types.js';
import { isDocStatus, isDocType } from '../../index/types.js';

export interface DraftRow {
  id: string;
  slug: string;
  type: DocType;
  status: DocStatus;
  title: string;
  body: string;
  tags: string[];
  related: string[];
  published_path: string | null;
  forked_from: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDraftInput {
  slug: string;
  type: DocType;
  title?: string;
  body?: string;
  tags?: string[];
  related?: string[];
  forked_from?: string | null;
}

export interface UpdateDraftInput {
  slug?: string;
  type?: DocType;
  status?: DocStatus;
  title?: string;
  body?: string;
  tags?: string[];
  related?: string[];
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  related_json TEXT NOT NULL DEFAULT '[]',
  published_path TEXT,
  forked_from TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_drafts_active_slug ON drafts(slug) WHERE published_path IS NULL;
CREATE TABLE IF NOT EXISTS publish_log (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  git_path TEXT NOT NULL,
  published_at TEXT NOT NULL
);
`;

function rowToDraft(row: Record<string, unknown>): DraftRow {
  return {
    id: String(row.id),
    slug: String(row.slug),
    type: row.type as DocType,
    status: row.status as DocStatus,
    title: String(row.title),
    body: String(row.body),
    tags: JSON.parse(String(row.tags_json)) as string[],
    related: JSON.parse(String(row.related_json)) as string[],
    published_path: row.published_path ? String(row.published_path) : null,
    forked_from: row.forked_from ? String(row.forked_from) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export class DraftsDb {
  private readonly db: Database.Database;

  constructor(knowledgeRoot: string) {
    const dbDir = path.join(knowledgeRoot, '.repo-mind');
    fs.mkdirSync(dbDir, { recursive: true });
    const dbPath = path.join(dbDir, 'drafts.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(SCHEMA_SQL);
  }

  close(): void {
    this.db.close();
  }

  listActive(): DraftRow[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM drafts WHERE published_path IS NULL ORDER BY updated_at DESC`,
      )
      .all() as Record<string, unknown>[];
    return rows.map(rowToDraft);
  }

  getById(id: string): DraftRow | null {
    const row = this.db.prepare(`SELECT * FROM drafts WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToDraft(row) : null;
  }

  getActiveBySlug(slug: string): DraftRow | null {
    const row = this.db
      .prepare(`SELECT * FROM drafts WHERE slug = ? AND published_path IS NULL`)
      .get(slug) as Record<string, unknown> | undefined;
    return row ? rowToDraft(row) : null;
  }

  create(input: CreateDraftInput): DraftRow {
    if (!isDocType(input.type)) {
      throw new Error(`invalid type: ${input.type}`);
    }

    const existing = this.getActiveBySlug(input.slug);
    if (existing) {
      throw new Error(`active draft already exists for slug: ${input.slug}`);
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    const tags = JSON.stringify(input.tags ?? []);
    const related = JSON.stringify(input.related ?? []);

    this.db
      .prepare(
        `INSERT INTO drafts (id, slug, type, status, title, body, tags_json, related_json, forked_from, created_at, updated_at)
         VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.slug,
        input.type,
        input.title ?? input.slug,
        input.body ?? '',
        tags,
        related,
        input.forked_from ?? null,
        now,
        now,
      );

    const created = this.getById(id);
    if (!created) {
      throw new Error('failed to create draft');
    }
    return created;
  }

  update(id: string, input: UpdateDraftInput): DraftRow {
    const current = this.getById(id);
    if (!current) {
      throw new Error('draft not found');
    }
    if (current.published_path) {
      throw new Error('cannot update published draft');
    }

    if (input.slug && input.slug !== current.slug) {
      const collision = this.getActiveBySlug(input.slug);
      if (collision && collision.id !== id) {
        throw new Error(`active draft already exists for slug: ${input.slug}`);
      }
    }

    if (input.type && !isDocType(input.type)) {
      throw new Error(`invalid type: ${input.type}`);
    }
    if (input.status && !isDocStatus(input.status)) {
      throw new Error(`invalid status: ${input.status}`);
    }

    const next = {
      slug: input.slug ?? current.slug,
      type: input.type ?? current.type,
      status: input.status ?? current.status,
      title: input.title ?? current.title,
      body: input.body ?? current.body,
      tags: input.tags ?? current.tags,
      related: input.related ?? current.related,
      updated_at: new Date().toISOString(),
    };

    this.db
      .prepare(
        `UPDATE drafts SET slug = ?, type = ?, status = ?, title = ?, body = ?, tags_json = ?, related_json = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        next.slug,
        next.type,
        next.status,
        next.title,
        next.body,
        JSON.stringify(next.tags),
        JSON.stringify(next.related),
        next.updated_at,
        id,
      );

    const updated = this.getById(id);
    if (!updated) {
      throw new Error('failed to update draft');
    }
    return updated;
  }

  delete(id: string): boolean {
    const current = this.getById(id);
    if (!current) {
      return false;
    }
    if (current.published_path) {
      throw new Error('cannot delete published draft');
    }
    const result = this.db.prepare(`DELETE FROM drafts WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  markPublished(id: string, gitPath: string): DraftRow {
    const current = this.getById(id);
    if (!current) {
      throw new Error('draft not found');
    }
    if (current.published_path) {
      throw new Error('draft already published');
    }

    const now = new Date().toISOString();
    this.db
      .prepare(`UPDATE drafts SET published_path = ?, updated_at = ? WHERE id = ?`)
      .run(gitPath, now, id);

    this.db
      .prepare(`INSERT INTO publish_log (id, draft_id, git_path, published_at) VALUES (?, ?, ?, ?)`)
      .run(randomUUID(), id, gitPath, now);

    const published = this.getById(id);
    if (!published) {
      throw new Error('failed to mark published');
    }
    return published;
  }
}

export function openDraftsDb(knowledgeRoot: string): DraftsDb {
  return new DraftsDb(knowledgeRoot);
}
