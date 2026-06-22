# Spec: RepoMind v3 — Multi-format docs & images

Status: **DRAFT** (next iteration after v2 Link Layer)
Branch: `main` (planning)
Prior: `2026-06-22-repomind-v2-link-layer.md` (P0–P3)

## Goal

Humans and agents can **browse and read** common knowledge files beyond Markdown: `yaml`/`yml`, `json`, plus **images** embedded in pages — still rooted in `docs/`, git-native, no external CMS.

## Context (v2 shipped)

- Confluence tree, LinkIndex, editor, move/rename/delete, templates, link health, live reload
- DocIndex indexes `**/*.md` only
- UI serves static bundle only; no asset URLs under `docs/`

## P1 — Structured file reading (yaml, yml, json)

### 1.1 Index & tree

- Extend discovery: `**/*.{md,yml,yaml,json}` under `docs/` (same ignores: `.repo-mind`, `.worktrees`)
- New record shape `KnowledgeFile`:
  - `relativePath`, `kind: 'markdown' | 'yaml' | 'json'`
  - For `.md`: existing `DocRecord` + frontmatter
  - For yaml/json: optional frontmatter **not required**; infer `title` from filename; `slug` from path (existing `slugFromRelativePath` rules)
- Tree: show yaml/json as page rows with distinct icon (e.g. `{ }`, `⚙`)
- MCP `list_docs` / `get_doc`: return raw body + `contentType` for non-markdown files

### 1.2 Reader UI

- Route by extension in `doc-panel`:
  - **JSON:** pretty-print, monospace, collapsible (optional phase 2)
  - **YAML:** pretty-print or structured tree view (start with highlighted pre)
- No wikilink/backlinks in non-md bodies (link index skips non-md)
- `repo-mind check`: optional warning for invalid JSON/YAML syntax

### 1.3 APIs

```
GET /api/files/:encodedRelativePath   → { kind, path, body, title }
```

Or extend `GET /api/docs/:slug` when slug maps to non-md file.

### Tests

- `tests/knowledge-files.test.ts` — glob, parse, slug for `config/app.yaml`
- UI smoke: open json file in reader

**Effort:** M (1–2 days)

## P2 — Images in knowledge base

### 2.1 Static asset serving

```
GET /api/assets/*relativePath   → file bytes from under docs/
```

- `safe-path` guards (no traversal)
- MIME map: png, jpg, jpeg, gif, webp, svg
- Cache-Control for dev

### 2.2 Markdown integration

- On `renderMarkdown`, rewrite relative `![](path)` and `<img src="...">` to `/api/assets/{path}` resolved from **current doc directory**
- Wikilinks unchanged
- Editor preview uses same rewriter

### 2.3 Tree & create (optional v3.1)

- Show image files in tree as attachments (read-only) or hide from tree, only inline
- Upload / paste image → save under `docs/assets/` or sibling folder (defer to v3.1)

### Tests

- Asset path resolution unit tests
- Serve png from fixture via HTTP test

**Effort:** M (1–2 days)

## P3 — Polish backlog (from v2 deferred)

| Item | Notes |
|------|-------|
| E8 Keyboard nav | j/k tree, `/` search, `e` edit |
| E2 Drag-drop move | tree DnD |
| E6 Git history | blame panel on page |
| Link cascade | auto-fix `[[slug]]` / `related:` on move/rename/delete |
| Editor properties | hide Page properties by default (parity with reader) |
| `npm publish` v0.2.x | after dogfood sign-off |

## P4 — Strategic (unchanged)

- M2 A/B kill-switch harness
- M3 `create_draft` MCP (if kill-switch passes)
- `publish --pr`, GitHub Action

## Acceptance (v3 done)

1. Open `docs/config/settings.json` in UI — formatted readable view
2. Open `docs/.../diagram.yaml` — readable yaml view
3. Markdown page with `![](../assets/foo.png)` renders image in light and dark theme
4. `repo-mind check` flags broken asset paths (stretch)
5. MCP `get_doc` returns non-md files with correct body

## Out of scope

- Binary editors, Excel, PDF preview
- Image upload UI (v3.1 candidate)
- Obsidian import (skipped)

## Suggested order

```
Week 1   P1 yaml/json index + reader
Week 2   P2 asset serving + markdown images
Week 3   dogfood + P3 cherry-picks as needed
```
