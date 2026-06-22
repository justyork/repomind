# Spec: docs/ as unified knowledge root

**Status:** Implemented (v0.1.2 pivot)  
**Date:** 2026-06-21

## North star

> **RepoMind wraps the project's `docs/` directory** — the single source of truth in git for wiki, architecture, ADR, stack, glossary, and agent rules. Humans edit via Confluence-style UI; agents query the same files via MCP.

Confluence/Notion are not required. One repo, one truth, two interfaces.

## Storage

| Layer | Location | Visible to MCP |
|-------|----------|----------------|
| Published | `docs/**/*.md` | Yes |
| Working drafts | `docs/.repo-mind/drafts.db` | No |
| Tooling | `docs/.repo-mind/`, `docs/.worktrees/` | No (gitignored) |

## Document types

- **Structured:** `adr`, `feature-spec`, `glossary-term`, `open-question`, `agent-instruction` — live under typed subdirs (`docs/adr/`, `docs/specs/`, …).
- **Wiki:** `wiki-page` — default for markdown anywhere in `docs/` without explicit frontmatter.

## Prepare flow

Existing markdown (no `type` in frontmatter) is indexed with inferred defaults but marked **unprepared**.

1. UI **Health → Prepare docs** lists unprepared files recursively.
2. **Add frontmatter** writes YAML (`type`, `slug`, `status`, `title`) in place.
3. `repo-mind check` validates prepared docs.

API: `GET /api/unprepared`, `POST /api/prepare` `{ path, type?, slug?, title? }`.

## Migration from `.project-knowledge/`

Greenfield: `repo-mind init` scaffolds `docs/`.  
Existing projects: move `.project-knowledge/*` → `docs/` or symlink during transition (manual).

## Out of scope (this spec)

- Confluence/Notion import
- Arbitrary non-markdown assets in index
- Cloud hosting / RBAC
