# RepoMind docs — reference

See **[structure.md](structure.md)** for the full documentation tree and domain×type matrix.

## Frontmatter schema

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `type` | string | yes (structured) | Must be one of `DOC_TYPES` below |
| `domain` | string | yes (structured) | Must be one of `DOC_DOMAINS` below; should match path prefix |
| `slug` | string | yes | `^[a-z0-9][a-z0-9-]*$`; unique across all indexed files |
| `status` | string | yes | Must be one of `DOC_STATUSES` below |
| `title` | string | recommended | Used in UI, search snippets, wikilink fallback |
| `tags` | string[] | optional | Flat list; used for MCP `list_docs` filter |
| `related` | string[] | optional | Each entry must match an existing doc slug |
| `owner` | string | optional | Free text |
| `updated` | string | optional | ISO date `YYYY-MM-DD` |

### Documentation domains (`domain`)

| Value | Label | Primary content |
|-------|-------|-----------------|
| `product` | Product | PRD, roadmap, user value, product open questions |
| `technical` | Technical | ADR, API, architecture, infra |
| `game-design` | Game design | Mechanics, balance, system specs |
| `analytics` | Analytics | Events, metrics, experiments |
| `art` | Art | Visual style, asset guidelines |
| `narrative` | Narrative | Lore, story, dialogue |
| `ops` | Operations | Runbooks, release, liveops |
| `shared` | Shared | Global glossary, agent rules, cross-domain wiki |

Path inference: first segment under `docs/` if it matches a domain id; otherwise `shared`.

MCP filters: `list_docs({ domain: "game-design" })`, `search_docs({ query, domain: "technical" })`.

### Doc types (`type`)

| Value | Folder | Typical use |
|-------|--------|-------------|
| `adr` | `adr/` | Architecture Decision Records |
| `feature-spec` | `specs/` | Feature/product specifications |
| `glossary-term` | `glossary/` | Domain vocabulary definitions |
| `open-question` | `open-questions/` | Unresolved decisions |
| `agent-instruction` | `agents/` | Rules/workflows for AI agents |
| `wiki-page` | `wiki/` | General wiki content |

### Status values (`status`)

| Value | Meaning |
|-------|---------|
| `draft` | Work in progress; may be incomplete |
| `proposed` | Ready for review; not yet accepted |
| `accepted` | Current, authoritative content |
| `superseded` | Replaced by another doc; keep for history, link to successor |

## Slug rules

- Pattern: `^[a-z0-9][a-z0-9-]*$`
- Lowercase only; hyphens allowed; no underscores or spaces
- Globally unique across markdown + yaml/json under `docs/`
- Explicit `slug:` in frontmatter survives file renames better than path inference
- Path inference (`slugFromRelativePath`): tries `segments.join('-')` then last segment basename

## Link kinds (LinkIndex)

| Kind | Source | Notes |
|------|--------|-------|
| `related` | frontmatter `related:` array | Directed edge; used by `explore_graph` |
| `wikilink` | body `[[target]]` or `[[label\|target]]` | Backlinks computed automatically |
| `parent_of` | folder README → child pages | Tree navigation edges |

### Wikilink syntax

```
[[slug]]
[[Human Title|slug]]
```

Regex: `\[\[([^\]|]+)(?:\|([^\]]+))?\]\]`

Resolution order:

1. `target` matches a known slug exactly
2. Case-insensitive match on slug or document `title`

Broken wikilinks: warning in `repo-mind check` (not a hard violation for `related:`-level errors on wikilinks — check implementation warns on broken wikilink targets).

## Structured files

| Extension | contentKind | Frontmatter | Slug example |
|-----------|-------------|-------------|--------------|
| `.md` | markdown | yes (structured) | from frontmatter or path |
| `.yaml`, `.yml` | yaml | no | `config-app` from `config/app.yaml` |
| `.json` | json | no | path-derived |

## CLI commands

```bash
repo-mind init [--cwd <dir>]
repo-mind setup [--cursor] [--claude] [--force]
repo-mind check [--cwd <dir>]
repo-mind export [--force] [--cwd <dir>]
repo-mind prepare [--all] [--dry-run] [--cwd <dir>] [relative-path]
repo-mind sync-links [--dry-run] [--no-convert-body] [--no-sync-related] [--cwd <dir>]
repo-mind mcp
repo-mind ui [--port <n>] [--cwd <dir>]
```

### prepare

- Single file: `repo-mind prepare wiki/legacy-page.md`
- Batch: `repo-mind prepare --all`
- Skips files that already have valid `type:`
- Infers `type` from folder; generates `slug`, `title`, empty `tags`/`related`, sets `updated` to today

### sync-links

Default behavior:

1. Convert resolvable `[text](relative.md)` in body to `[[slug]]`
2. Merge outbound wikilink + markdown-link slugs into frontmatter `related` (deduplicated)

Flags:

- `--dry-run` — report changes without writing
- `--no-convert-body` — only sync `related`, leave markdown links
- `--no-sync-related` — only convert body links to wikilinks

## MCP tools

| Tool | Input | Output highlights |
|------|-------|-------------------|
| `list_docs` | optional type, status, tag filters | slug list |
| `search_docs` | query string | ranked matches |
| `get_doc` | slug | frontmatter + body |
| `get_glossary_term` | name | definition + related |
| `explore_graph` | slug, depth | nodes, edges, broken_links |

## repo-mind check

**Violations (fail):**

- Invalid `type` or `status`
- Missing slug
- Broken `related:` slug (target doc not found)
- Duplicate slug across docs

**Warnings (pass with notice):**

- Broken wikilink targets in body
- Missing image assets referenced in markdown
- Orphaned `.worktrees/` older than 7 days

## Anti-patterns

| Problem | Why it hurts | Fix |
|---------|--------------|-----|
| Duplicate slug | MCP/UI cannot disambiguate | Rename slug or merge docs |
| Uppercase or spaced slug | Fails validation | Use kebab-case |
| `related: [missing-slug]` | CI check fails | Create target doc or remove entry |
| Wikilink by title only | Breaks if title changes | Use `[[slug]]` or `[[Label\|slug]]` |
| Wrong folder for type | Confusing tree | Use `docs/{domain}/{type-folder}/` |
| `domain` mismatch with path | check warning | Align frontmatter and path |
| Product content under wrong domain | Wrong ownership in tree | Move to `product/`, `game-design/`, etc. |
| Every inline link in `related:` | Noisy graph | Keep 2–5 strategic `related:` entries |
| Editing only drafts forever | MCP never sees content | Publish to `docs/` |
| Hard-coded absolute paths in links | Break on move | Use wikilinks or relative md paths |
| Skipping `updated` | Stale metadata in exports/search | Set date on substantive edits |

## File layout convention

```
docs/
├── README.md
├── assets/
├── product/
│   ├── README.md
│   ├── specs/
│   ├── wiki/
│   └── open-questions/
├── technical/
│   ├── README.md
│   ├── adr/
│   ├── specs/
│   ├── glossary/
│   └── wiki/
├── game-design/
│   ├── README.md
│   ├── specs/
│   ├── glossary/
│   └── wiki/
├── analytics/
│   ├── README.md
│   ├── specs/
│   └── wiki/
├── art/ … narrative/ … ops/ …
└── shared/
    ├── README.md
    ├── agents/
    ├── glossary/
    └── wiki/
```

Legacy flat layout (`docs/adr/`, `docs/specs/` without domain prefix) → `domain: shared`.

## Skill installation

- **Project copy:** `.cursor/skills/repomind-docs/` (versioned in repo)
- **Personal copy:** copy to `~/.cursor/skills/repomind-docs/` for use in any RepoMind project
