---
name: repomind-docs
description: >-
  Guides authoring RepoMind knowledge in docs/: documentation domains (product,
  technical, game-design, analytics), YAML frontmatter, doc types, wikilinks,
  folder structure, prepare/sync-links/check workflow. Use when creating docs/,
  writing PRD/ADR/specs, organizing project documentation, or fixing links.
---

# RepoMind — authoring docs, frontmatter, links

## Documentation architecture (read first)

Project knowledge uses **two axes**:

| Axis | Field | Examples |
|------|-------|----------|
| **Domain** | `domain:` | `product`, `technical`, `game-design`, `analytics`, `art`, `narrative`, `ops`, `shared` |
| **Type** | `type:` | `adr`, `feature-spec`, `glossary-term`, `open-question`, `agent-instruction`, `wiki-page` |

**Path pattern:** `docs/{domain}/{type-folder}/{slug}.md`

Full taxonomy, domain×type matrix, folder tree: **[structure.md](structure.md)**.

```
docs/
├── README.md
├── assets/
├── product/specs/ …          # PRD, roadmap
├── technical/adr/ …          # ADR, architecture
├── game-design/specs/ …      # mechanics, balance
├── analytics/specs/ …        # events, metrics
├── art/wiki/ …               # visual guidelines
├── narrative/wiki/ …         # lore, story
├── ops/specs/ …              # runbooks
└── shared/glossary/ …        # global terms, agents/
```

Legacy flat paths (`docs/adr/foo.md`) still work → `domain: shared`. Prefer domain folders for new work.

## Mental model

- **`docs/`** is the single source of truth. Humans edit via `repo-mind ui`; agents read via MCP.
- MCP reads **published files only** — not SQLite drafts.
- **Prepared page** = valid `type:` in frontmatter.
- **LinkIndex** connects pages via `related:`, wikilinks `[[slug]]`, folder edges.

## When to use this skill

- Creating or reorganizing project documentation
- Writing product specs, ADRs, game design docs, analytics dictionaries
- Choosing domain + type + folder for a new page
- Frontmatter, wikilinks, `related:`, migration from legacy markdown

## Agent workflow checklist

```
- [ ] Read structure.md — pick domain then type
- [ ] MCP: search_docs → get_doc (filter by domain when scoped)
- [ ] Path: docs/{domain}/{type-folder}/{name}.md
- [ ] Frontmatter: type, domain, slug, status, title, tags, related, updated
- [ ] Body: type template + wikilinks [[slug]]
- [ ] Update domain or subfolder README.md for major additions
- [ ] repo-mind check
- [ ] Legacy: prepare [--all]; sync-links [--dry-run]
```

## Frontmatter rules

### Required fields

| Field | Rule |
|-------|------|
| `type` | `adr` \| `feature-spec` \| `glossary-term` \| `open-question` \| `agent-instruction` \| `wiki-page` |
| `domain` | `product` \| `technical` \| `game-design` \| `analytics` \| `art` \| `narrative` \| `ops` \| `shared` |
| `slug` | Lowercase `[a-z0-9-]*`, globally unique |
| `status` | `draft` \| `proposed` \| `accepted` \| `superseded` |

### Recommended / optional

| Field | Rule |
|-------|------|
| `title` | Human-readable name |
| `tags` | YAML string array |
| `related` | Existing slugs only — `check` fails on broken |
| `owner`, `updated` | Owner string; date `YYYY-MM-DD` |

`domain` must match the first path segment when using domain folders (e.g. file under `game-design/` → `domain: game-design`).

### Type → subfolder

| type | subfolder |
|------|-----------|
| `adr` | `adr/` |
| `feature-spec` | `specs/` |
| `glossary-term` | `glossary/` |
| `open-question` | `open-questions/` |
| `agent-instruction` | `agents/` |
| `wiki-page` | `wiki/` |

Templates: `templates/*-example.md` (after `repo-mind init`).

## Body structure by type

| type | Sections |
|------|----------|
| `adr` | Context / Decision / Consequences |
| `feature-spec` | Summary / Requirements / Open Questions |
| `glossary-term` | Definition (1–2 paragraphs) |
| `open-question` | Question / Options / Decision criteria |
| `agent-instruction` | Numbered agent workflow |
| `wiki-page` | Freeform with clear headings |

See [examples.md](examples.md). Domain-specific examples: product PRD in `product/specs/`, ADR in `technical/adr/`, combat spec in `game-design/specs/`.

### Folder indexes

- `docs/README.md` — root hub listing domains
- `docs/{domain}/README.md` — domain index
- `docs/{domain}/{type-folder}/README.md` — optional section index

### Structured files & images

- `*.yaml`, `*.json` under `docs/` — no frontmatter; domain from path
- Images: `![](../assets/file.png)` relative to the markdown file

## Linking between articles

| Mechanism | Where | Purpose |
|-----------|-------|---------|
| `related:` | frontmatter | Graph / `explore_graph` — 2–5 key edges |
| `[[slug]]` | body | Inline links + backlinks |
| `[[Label\|slug]]` | body | Custom display text |

**Cross-domain links are encouraged** — e.g. game-design spec linking to analytics event slug.

1. Body → wikilinks; frontmatter `related:` for strategic graph edges only.
2. Glossary terms → `shared/glossary/` or domain glossary; link on first mention.
3. Run `sync-links` after migrating markdown `[links](path.md)`.

## CLI & MCP

| Command / tool | Use |
|----------------|-----|
| `repo-mind init` | Domain-based scaffold |
| `repo-mind prepare [--all]` | Add frontmatter to legacy md |
| `repo-mind sync-links` | Wikilinks + related sync |
| `repo-mind check` | Schema, domain, links |
| `list_docs` / `search_docs` | Filter by `domain`, `type`, `status`, `tag` |
| `get_doc`, `explore_graph` | Read and traverse |

Details: [reference.md](reference.md).

## Output quality bar

1. Correct **domain** and **type** for the content
2. File under `docs/{domain}/{type-folder}/`
3. Frontmatter validates; slug unique
4. `related:` and wikilinks resolve
5. `repo-mind check` passes
