# Changelog

All notable changes to this project are documented in this file.

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
