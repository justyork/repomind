# Spec: RepoMind v1 Core — scaffold, MCP read tools, check, export, setup

**Status:** APPROVED  
**Generated:** 2026-06-21 via `/spec`  
**Branch:** main  
**Milestone:** 1 of 3 (core — no `create_draft`, no A/B harness)

## Context

RepoMind is an open-source MCP-first project memory layer. Developers add
`.project-knowledge/` to a repo so AI agents query structured knowledge
(search, glossary, graph) instead of ingesting whole markdown files. Design
doc APPROVED; CEO plan and eng-review test plan exist. **No application code
yet** — greenfield TypeScript package.

## Current State

- Repo contains: `idea.md`, `CLAUDE.md`, `README.md`, `.gstack/` artifacts
- No `package.json`, no `src/`, no tests
- No git remote configured
- Prior decisions in:
  - `.gstack/projects/repo-mind/york-repomind-design-20260621.md`
  - `.gstack/projects/repo-mind/ceo-plans/2026-06-21-repomind-v1-scaffold.md`
  - `.gstack/projects/repo-mind/york-repomind-eng-review-test-plan-20260621.md`

## Proposed Change

Ship npm package `repo-mind` with CLI commands `init`, `setup`, `check`,
`export`, `mcp` and MCP server exposing 5 read-only tools over
`.project-knowledge/` (plain Markdown + YAML frontmatter, runtime index).

### Architecture

```
repo-mind (npm)
├── src/cli.ts              # dispatcher: init|setup|check|export|mcp
├── src/mcp/server.ts       # stdio MCP, lifecycle handlers (A2 minus create_draft)
├── src/index/doc-index.ts  # shared: discoverRoot, cache, parse, slug safety (A1)
├── src/tools/
│   ├── list-docs.ts
│   ├── search-docs.ts
│   ├── get-doc.ts
│   ├── get-glossary-term.ts
│   └── explore-graph.ts
├── src/commands/
│   ├── init.ts
│   ├── setup.ts
│   ├── check.ts
│   └── export.ts
└── templates/              # per-type frontmatter scaffolds for init
```

```
Agent (Cursor/Claude)
    │ stdio MCP
    ▼
repo-mind mcp
    │ DocIndex (walk-up find .project-knowledge/)
    ▼
.project-knowledge/
    ├── adr/
    ├── specs/
    ├── glossary/
    ├── open-questions/
    └── agents/
```

### Dependencies (pin versions in package.json)

- `@modelcontextprotocol/sdk`
- `gray-matter`
- `fast-glob`
- `minimatch`
- Dev: `typescript`, `vitest`, `@types/node`

### Package layout

```
package.json          # bin: repo-mind → dist/cli.js
tsconfig.json
vitest.config.ts
src/                  # as architecture above
templates/            # 5 generic + 1 game example
tests/                # mirrors src/tools/ + doc-index adversarial suite
README.md             # install, MCP config, CI check snippet
```

### CLI: `repo-mind init`

- Creates `.project-knowledge/` with subdirs: `adr/`, `specs/`, `glossary/`,
  `open-questions/`, `agents/`
- Writes `.project-knowledge/README.md` explaining convention
- Writes `.project-knowledge/.gitignore` with `.worktrees/`
- Scaffolds **6 example docs** (5 generic types + 1 game-themed `feature-spec`
  e.g. `specs/combat-system.md` with realistic game-design content)
- **Idempotent:** re-run adds missing dirs/templates only; never clobbers
  existing user docs
- Warns on stderr if `.git` absent (non-fatal)

### CLI: `repo-mind setup`

- Detects host: `--cursor`, `--claude`, or auto (both if flags omitted)
- **Cursor:** merge into MCP config (try `~/.cursor/mcp.json` then project
  `.cursor/mcp.json`; document which path was used)
- **Claude Code:** merge into `~/.claude.json` under `mcpServers.repo-mind`:
  `{ "command": "npx", "args": ["-y", "repo-mind", "mcp"] }`
- **CLAUDE.md snippet:** append (if not present) steering block:
  `Prefer repo-mind search_docs/get_doc over reading docs/ directly.`
- Never overwrite existing `repo-mind` MCP entry without `--force`
- Print summary of what was written

### CLI: `repo-mind check`

- Validates all docs under knowledge root:
  - Required frontmatter: `type`, `slug`, `status`
  - `type` ∈ enum; `status` ∈ enum
  - Slug uniqueness across all docs
  - Every `related:` slug resolves to existing doc
- Orphan worktree warning (>7 days, non-fatal, exit 0)
- Schema/dup/broken-link violations → exit 1, one line per violation with path

### CLI: `repo-mind export`

- Writes `./agents.md` at repo root (knowledge root parent or cwd)
- One `##` section per doc type; each doc: title, slug, status, fenced YAML
  frontmatter + body
- Refuses overwrite unless `--force` (F14)
- Empty knowledge root → minimal `agents.md` with empty sections

### CLI: `repo-mind mcp`

- Starts stdio MCP server
- Registers 5 tools per design doc Tool Contracts (read tools only)
- SIGTERM/SIGINT/stdin-close: stop accepting calls, exit cleanly (no
  create_draft mutex in this milestone — lifecycle test deferred)
- Knowledge-root walk-up (A3); cache invalidated by mtime

### Frontmatter schema (enforce in check + parse)

Required: `type`, `slug`, `status`  
Types: `adr`, `feature-spec`, `glossary-term`, `open-question`, `agent-instruction`  
Status: `draft`, `proposed`, `accepted`, `superseded`  
Optional: `title`, `tags[]`, `related[]`, `owner`, `updated` (ISO date)

### Security (A1) — mandatory

All slug/path operations: validate `^[a-z0-9][a-z0-9-]*$`, resolve under
knowledge root with prefix check. Adversarial test suite required before ship.

## Acceptance Criteria

1. `npm run build` produces working `dist/cli.js` with all 5 commands
2. `npx repo-mind init` in empty dir creates `.project-knowledge/` with 6
   example docs including game-themed `feature-spec`
3. `npx repo-mind setup --cursor` writes MCP config without destroying
   existing entries; `npx repo-mind setup --claude` writes `~/.claude.json` entry
4. `npx repo-mind mcp` serves all 5 read tools; `search_docs` returns ranked
   results per scoring formula; invalid slugs return `{found:false}` never throw
5. `npx repo-mind check` exits non-zero on schema violation; exit 0 on orphan
   worktree warning only
6. `npx repo-mind export` writes `agents.md`; refuses without `--force` if exists
7. `npm test` passes: unit tests per tool + DocIndex + adversarial slug suite (A1)
8. `create_draft` is NOT implemented in this milestone
9. README documents manual CI: `npx repo-mind check` in GitHub Actions YAML

## Testing Plan

| Layer | What | Ref |
|-------|------|-----|
| Unit | `doc-index.test.ts` — discoverRoot, cache, slug validation, prefix check | eng-review |
| Unit | `list_docs`, `search_docs`, `get_doc`, `get_glossary_term`, `explore_graph` | eng-review |
| Unit | `check.test.ts`, `export.test.ts`, `init.test.ts` | eng-review |
| Unit | Adversarial slugs: `../x`, `a/../../b`, `..%2f..`, absolute, empty | A1 gate |
| E2E | Deferred to milestone 2 (install-to-whoa, subdir walk-up) | design step 6 |

## Rollback Plan

Revert PR / delete package. No persistent state beyond files `init` creates.
`export` and `setup` changes are user-local config — document manual undo in README.

## Effort Estimate

| Component | Human | CC+gstack |
|-----------|-------|-----------|
| Package scaffold + DocIndex | 4h | 30m |
| 5 MCP read tools | 6h | 45m |
| init + templates (incl. game example) | 2h | 20m |
| setup (Cursor + Claude) | 3h | 30m |
| check + export | 3h | 25m |
| Tests (full eng-review coverage) | 6h | 45m |
| README + first commit | 1h | 15m |

## Files Reference

| File | Change |
|------|--------|
| `package.json` | CREATE — bin, deps, scripts |
| `tsconfig.json` | CREATE |
| `vitest.config.ts` | CREATE |
| `src/cli.ts` | CREATE |
| `src/index/doc-index.ts` | CREATE |
| `src/mcp/server.ts` | CREATE |
| `src/tools/*.ts` | CREATE (5 files) |
| `src/commands/*.ts` | CREATE (4 files) |
| `templates/*.md` | CREATE (6 scaffolds) |
| `tests/**/*.test.ts` | CREATE |
| `README.md` | UPDATE — usage, MCP, CI snippet |

## Out of Scope (this milestone)

- `create_draft` write tool (milestone 3, after P2 A/B)
- A/B demo harness `ab-demo/` (milestone 2)
- `repo-mind try` bundled demo corpus
- GitHub Action marketplace entry
- `llms.txt`, `docs-index.json` export
- SQLite index (Approach B)
- Web UI, game-design new types
- gstack integration (dev tooling only)
- npm publish / GitHub remote setup (separate chore)

## Related

- Design: `.gstack/projects/repo-mind/york-repomind-design-20260621.md`
- CEO plan: `.gstack/projects/repo-mind/ceo-plans/2026-06-21-repomind-v1-scaffold.md`
- Test plan: `.gstack/projects/repo-mind/york-repomind-eng-review-test-plan-20260621.md`

## Sequencing (follow-on milestones)

1. **M1 (this spec):** scaffold + read MCP + check/export/setup + unit tests
2. **M2:** A/B harness + demo corpus seed + E2E install-to-whoa
3. **M3:** `create_draft` (only if P2 kill-switch passes)
