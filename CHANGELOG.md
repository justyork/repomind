# Changelog

All notable changes to this project are documented in this file.

## [0.8.0] - 2026-07-09

### Added

- **UI password auth** — optional `REPOMIND_UI_PASSWORD` protects workspace, graph, and API with session login
- **Doc outline navigation** — Notion-like right-side heading track with hover menu in reader view
- **`repo-mind install-skill`** — copies `repomind-docs` Cursor skill into `.cursor/skills/` (or `--global`)
- **Workspace scroll reset** — opening another page or draft scrolls `#workspace` back to the top

### Changed

- **Folder index pages** — `README.md` inside a folder powers the folder row (hidden from children); legacy same-name sibling pairs still supported
- **Promote page** — leaf promotion moves the page to `{folder}/README.md`
- **Tree icons** — folder icon by default; page icon when the folder has a `README.md` index

## [0.7.1.1] - 2026-06-26

### Added

- **Favicon** — RepoMind icon in browser tab for workspace and graph pages

### Changed

- **Tree folder icons** — catalog rows show a folder icon; page icon only on file rows and Confluence page+folder pairs
- **Read mode** — editing starts only from the Edit button (removed click-to-edit on title and body)

## [0.7.1.0] - 2026-06-24

### Added

- **Tree drag-and-drop** — reorder pages and folders in the sidebar; folder moves keep Confluence-style sibling `.md` files in sync
- **Resizable sidebar** — drag handle with persisted width (220–420px)
- **Confluence page+folder rows** — same-named `page.md` + `page/` merge into one expandable tree row; create-on-page adds children inside the sibling folder
- **Template modals** — blank page and template picker replace inline prompts in the tree ⋯ menu

### Changed

- **Dark theme links** — brighter link tokens and solid underlines in reader, editor, and wikilink chips
- **Mermaid preview** — explicit refresh on theme toggle via plugin state (no DOM re-wrap loop)
- **`.gstack/` gitignore** — local gstack state no longer tracked in the repo

## [0.7.0] - 2026-06-24

### Added

- **Unified read/edit page workspace** — click title or body on a published page to fork a draft and edit in-place with TipTap (no layout swap)
- **Confluence-style formatting toolbar** — sticky toolbar with grouped actions, overflow menu, and Lucide icons
- **Selection bubble menu** — Bold, Italic, Link, headings, and lists on text selection
- **Wikilink picker** — modal search UI and `[[` inline autocomplete with keyboard navigation (replaces `window.prompt`)
- **Flat tree icons** — folders with a readable `README.md` show a page icon instead of a folder icon

### Changed

- **Mermaid preview** — ProseMirror widget decorations (fixes infinite block insertion on re-render)
- **Editor action bar** — Editing badge, primary Publish, ghost secondary actions
- **Reader hover targets** — padded editable title/body regions in read mode
- **Dark theme links** — improved link contrast in reader and editor

## [0.6.1] - 2026-06-24

### Added

- **`repo-mind ab-eval` CLI** — live A/B eval on a real `docs/` tree (baseline vs RepoMind retrieval)
- **Skyforge question pack** (`ab-demo/skyforge-questions.json`) — 8 anchors across factual, synthesis, glossary/ADR categories
- **Blind pack export** — `*-blind.md` for human hallucination scoring; `--record-scores` merges rubric JSON
- **Transcript token parser** — `record-transcript` for agent-run JSONL token accounting
- **`npm run ab-eval:live`** — convenience script for skyforge-caravan dogfood target

## [0.6.0] - 2026-06-24

### Added

- **`create_draft` MCP tool** — agents create SQLite drafts with typed errors; gated on ab-demo kill-switch (`REPOMIND_AGENT_WRITE=1` override for local dev)
- **`repo-mind publish` CLI** — batch publish active drafts to `docs/`; `--pr` creates branch, commit, and opens GitHub PR via `gh`
- **Agent write gate** (`agent-write-gate.ts`) — reads `ab-demo/results/latest.json` before enabling write tools
- **UI draft deep links** — `/?draft=<id>` opens draft in workspace from MCP `editUrl`
- **`slugFromTitle`** helper for kebab-case slug derivation

### Changed

- MCP server registers `create_draft` with structured error responses
- CLI help documents `publish` command and flags
