# Spec: RepoMind UI-2 — SQLite Draft Layer + Publish

**Status:** APPROVED (accelerated from design + dogfood)  
**Generated:** 2026-06-21  
**Branch:** main  
**Depends on:** UI-1 (`45a8ca7`), design `york-main-design-20260621-203318-ui-knowledge-workspace.md`  
**Dogfood input:** `.gstack/projects/repo-mind/ui-1-dogfood-skyforge-2026-06-21.md`

## Context

UI-1 ships read-only graph workspace. Dogfood on skyforge-caravan confirmed graph/search work but **#1 pain is no edit path**. UI-2 adds SQLite drafts and Publish to markdown so humans get Notion-like editing while git + MCP stay canonical for published knowledge.

## Goal

Humans create/edit drafts in the UI; **Publish** writes `.project-knowledge/<type-dir>/<slug>.md`. MCP read tools unchanged (published files only). Drafts live in gitignored SQLite.

## Out of Scope

- UI-3 check dashboard, batch publish, diff preview (separate issue)
- `create_draft` MCP tool (M3 / kill-switch)
- Auth, remote bind, PR automation (`publish --pr` = v1.1 design only)
- UI-1.1 polish (graph label truncation, search↔graph sync) unless trivial alongside editor

## Storage

Path: `.project-knowledge/.repo-mind/drafts.db` (gitignored via `init` update)

```sql
CREATE TABLE drafts (
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
CREATE UNIQUE INDEX idx_drafts_active_slug ON drafts(slug) WHERE published_path IS NULL;
CREATE TABLE publish_log (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  git_path TEXT NOT NULL,
  published_at TEXT NOT NULL
);
```

## Write API

| Method | Path | Behavior |
|--------|------|----------|
| GET | `/api/drafts` | List drafts where `published_path IS NULL` |
| POST | `/api/drafts` | Create draft `{ slug, type, title?, body?, tags?, related? }` OR `{ forkFrom: slug }` |
| PUT | `/api/drafts/:id` | Autosave fields; reject if already published |
| DELETE | `/api/drafts/:id` | Discard unpublished draft |
| POST | `/api/drafts/:id/publish` | Validate A1 slug + schema → write markdown → set `published_path` |

Publish uses `resolveDocPath` + `TYPE_TO_DIR`. On duplicate slug file without draft fork: 409. After publish, `DocIndex` sees file on next `refresh()`.

## UI Additions

- Sidebar: **New draft** + drafts list (chip `draft`)
- Doc panel: **Edit as draft** on published docs (fork)
- Editor tab: title, type, status, tags, related (comma-separated), body textarea, live preview
- **Publish** → confirm modal with target path
- Autosave debounce 800ms on PUT

## Acceptance Criteria

- [ ] `init` adds `.repo-mind/` to `.project-knowledge/.gitignore`
- [ ] Create draft → edit → publish creates correct `.md` on disk
- [ ] Fork published doc → edit → publish overwrites same path
- [ ] `repo-mind check` passes on published output
- [ ] Invalid slug blocked at create and publish
- [ ] MCP `get_doc` returns new content after publish (same session, index refresh)
- [ ] +10 tests; all prior tests pass
- [ ] README documents draft workflow

## Failure Modes

| Case | Response |
|------|----------|
| Slug collision (active draft) | 409 |
| Invalid slug/type/status | 400 |
| Publish to occupied path (not fork) | 409 with path |
| better-sqlite3 missing | clear install error at first DB open |

## Implementation Order

1. `src/ui/db/drafts-db.ts` + tests
2. `src/ui/publish.ts` + tests
3. Extend `api-handlers` + `server.ts` (POST/PUT/DELETE + body)
4. `init.ts` gitignore
5. Frontend editor + publish modal
6. README
