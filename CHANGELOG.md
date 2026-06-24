# Changelog

All notable changes to this project are documented in this file.

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
