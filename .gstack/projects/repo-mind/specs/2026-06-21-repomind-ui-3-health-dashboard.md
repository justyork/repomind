# Spec: RepoMind UI-3 — Health Dashboard, Diff Preview, Export

**Status:** APPROVED  
**Generated:** 2026-06-21  
**Branch:** main  
**Depends on:** UI-2 (`b242ba1`), layout redesign, design `york-main-design-20260621-203318-ui-knowledge-workspace.md`

## Context

UI-2 ships SQLite drafts and Publish. Dogfood polish items (search↔graph sync, graph labels, new-draft modal, related autocomplete) land alongside UI-3 so the workspace feels complete before push.

## Goal

Humans see knowledge health at a glance, preview publish diffs, batch-publish from a queue, and export `agents.md` without leaving the UI.

## Out of Scope

- MCP write tools (`create_draft`)
- Auth, remote bind
- Full git diff / merge UI
- PR automation

## Backend

### Refactor

- `collectCheckReport(index)` in `src/check/collect-violations.ts` — shared by CLI `check` and UI

### New read API

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/check` | `{ ok, violations[], warnings[] }` |
| GET | `/api/drafts/:id/diff` | `{ targetPath, isNew, diff }` |

### New write API

| Method | Path | Behavior |
|--------|------|----------|
| POST | `/api/export` | Runs `repo-mind export --force` → `{ ok, path: 'agents.md' }` |

`computeDraftDiff` builds unified-style diff between on-disk markdown and draft publish output.

## Frontend

### Polish (UI-2.1)

- Search / doc select → open graph drawer + focus node
- Graph labels: slug on canvas, full `slug + title` on hover (`<title>`)
- New draft: modal (no `prompt()`)
- Related field: `<datalist>` from published slugs

### Health dashboard

- Topbar **Health** toggle
- Schema check panel (violations + warnings from `/api/check`)
- Publish queue: active drafts with Edit / Publish
- **Export agents.md** button

### Publish diff

- Editor Publish modal loads `/api/drafts/:id/diff` before confirm

## Acceptance Criteria

- [ ] `GET /api/check` mirrors `repo-mind check` results
- [ ] Publish modal shows diff for new and overwrite drafts
- [ ] Health view lists drafts and can publish inline
- [ ] `POST /api/export` writes `agents.md`
- [ ] Search result opens graph and highlights node
- [ ] +6 tests; all prior tests pass

## Files

| Area | Files |
|------|-------|
| Check | `src/check/collect-violations.ts`, `src/commands/check.ts` |
| Diff | `src/ui/diff.ts` |
| API | `src/ui/api-handlers.ts`, `src/ui/draft-api.ts` |
| UI | `ui/src/dashboard.ts`, `ui/src/new-draft-modal.ts`, `ui/src/graph.ts`, `ui/src/main.ts`, `ui/src/editor.ts` |
