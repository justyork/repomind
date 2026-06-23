# RepoMind docs — examples

Minimal samples. Full scaffolds: RepoMind `templates/*-example.md` (installed to project by `repo-mind init`).

## ADR (technical domain)

File: `docs/technical/adr/use-plain-markdown.md`

```markdown
---
type: adr
domain: technical
slug: use-plain-markdown
status: accepted
title: Use plain Markdown for project knowledge
tags:
  - storage
related:
  - mcp
updated: 2026-06-21
---

## Context
…

## Decision
Store knowledge under `docs/` with domain folders. Agents query via [[mcp]].

## Consequences
…
```

## Product feature spec

File: `docs/product/specs/onboarding-flow.md`

```markdown
---
type: feature-spec
domain: product
slug: onboarding-flow
status: proposed
title: User onboarding flow
tags:
  - onboarding
related:
  - search-ranking
updated: 2026-06-21
---

## Summary
First-session tutorial through core loop.

## Requirements
- …

## Open Questions
See [[search-ranking]] for analytics scope.
```

## Game design spec

File: `docs/game-design/specs/combat-system.md`

```markdown
---
type: feature-spec
domain: game-design
slug: combat-system
status: proposed
title: Combat System
related:
  - mcp
updated: 2026-06-21
---

## Summary
Turn-based combat with stamina and positioning.

## Requirements
- …
```

## Analytics event dictionary (yaml)

File: `docs/analytics/specs/event-dictionary.yaml` — indexed without frontmatter; domain inferred as `analytics`.

## Glossary (shared domain)

File: `docs/shared/glossary/mcp.md`

```markdown
---
type: glossary-term
domain: shared
slug: mcp
status: accepted
title: Model Context Protocol (MCP)
related:
  - use-plain-markdown
updated: 2026-06-21
---

MCP connects agents to tools and data. RepoMind exposes `docs/` via MCP read tools.
```

## ADR with related + wikilink (legacy flat path example)

```markdown
---
type: adr
domain: technical
slug: use-plain-markdown
status: accepted
title: Use plain Markdown for project knowledge
tags:
  - storage
  - markdown
related:
  - mcp
updated: 2026-06-21
---

## Context

We need a format that humans and agents can read without special tooling.

## Decision

Store all project knowledge as Markdown with YAML frontmatter under `docs/`.
Agents should query via [[mcp]] instead of reading whole repositories.

## Consequences

- Easy to diff in git
- No database required for v1
- Agents use MCP tools for targeted retrieval
```

Note: `related: [mcp]` for graph; `[[mcp]]` in body for inline link + backlinks.

## Glossary + backlink

```markdown
---
type: glossary-term
domain: shared
slug: mcp
status: accepted
title: Model Context Protocol (MCP)
tags:
  - agents
  - integration
related:
  - use-plain-markdown
updated: 2026-06-21
---

Model Context Protocol (MCP) is a standard for connecting AI agents to tools
and data sources. RepoMind exposes project knowledge through MCP read tools so
agents query by intent instead of ingesting entire files.
```

Other pages link back with `[[mcp]]` — backlinks appear in the UI reader.

## Feature spec (proposed)

```markdown
---
type: feature-spec
domain: technical
slug: user-authentication
status: proposed
title: User Authentication
tags:
  - auth
  - security
related:
  - mcp
updated: 2026-06-21
---

## Summary

Users sign in with email and password. Sessions expire after 24 hours.

## Requirements

- Password hashing with bcrypt
- Rate limiting on login attempts
- Session tokens stored as httpOnly cookies

## Open Questions

See [[search-ranking]] for unresolved ranking behavior.
```

Use `status: proposed` until the team accepts; move to `accepted` after review.

## Open question (product)

```markdown
---
type: open-question
domain: product
slug: search-ranking
status: draft
title: Is grep ranking good enough?
tags:
  - search
related:
  - mcp
updated: 2026-06-21
---

## Question

Should v1 ship with simple grep-based ranking, or invest in SQLite FTS early?

## Options

1. Grep + scoring formula (current plan)
2. SQLite FTS index

## Decision criteria

Run the A/B kill-switch demo. Upgrade only if ranking quality blocks adoption.
```

## Agent instruction (shared)

```markdown
---
type: agent-instruction
domain: shared
slug: query-first
status: accepted
title: Query project knowledge before reading files
tags:
  - agents
  - workflow
related:
  - mcp
updated: 2026-06-21
---

When answering project questions:

1. Call `search_docs` or `get_glossary_term` first
2. Use `get_doc` for the specific slug you need
3. Use `explore_graph` to understand related decisions
4. Only read raw markdown files if MCP tools return no results
```

## Domain README

File: `docs/game-design/README.md`

```markdown
---
type: wiki-page
domain: game-design
slug: game-design-index
status: accepted
title: Game design
updated: 2026-06-21
---

# Game design

- [[combat-system]] — turn-based combat (proposed)
- Mechanics glossary → `glossary/`
```

## Folder README (specs section)

File: `docs/product/specs/README.md`

```markdown
---
type: wiki-page
domain: product
slug: product-specs-index
status: accepted
title: Product specifications
updated: 2026-06-21
---

# Product specs

- [[onboarding-flow]] — first session (proposed)
```

## Folder README snippet (legacy naming)

```markdown
---
type: wiki-page
slug: specs-index
status: accepted
title: Specifications
tags:
  - index
related:
  - user-authentication
updated: 2026-06-21
---

# Specifications

Product and feature specs for this project.

- [[user-authentication]] — email/password auth (proposed)
```

Place as `docs/specs/README.md`. Tree treats `{folder}/README.md` as the folder index.

## Wiki page (freeform)

```markdown
---
type: wiki-page
slug: onboarding
status: accepted
title: Developer onboarding
tags:
  - wiki
related:
  - query-first
  - mcp
updated: 2026-06-21
---

# Developer onboarding

1. Clone the repo and run `repo-mind setup`
2. Read [[query-first]] for agent workflow
3. Browse glossary terms starting with [[mcp]]
```

## sync-links: before and after

**Before** (legacy markdown links):

```markdown
---
type: wiki-page
slug: legacy-page
status: accepted
title: Legacy Page
related: []
updated: 2026-06-21
---

See [MCP glossary](../glossary/mcp.md) for details.
Also related to [plain markdown ADR](../adr/use-plain-markdown.md).
```

**After** `repo-mind sync-links`:

```markdown
---
type: wiki-page
slug: legacy-page
status: accepted
title: Legacy Page
related:
  - mcp
  - use-plain-markdown
updated: 2026-06-21
---

See [[mcp]] for details.
Also related to [[use-plain-markdown]].
```

Run `repo-mind sync-links --dry-run` first to preview conversions.

## Image in markdown

File: `docs/specs/auth-flow.md`

```markdown
![Login sequence](../assets/auth-login.png)
```

Asset file: `docs/assets/auth-login.png`

## Structured yaml (no frontmatter)

File: `docs/config/app.yaml`:

```yaml
environment: production
features:
  auth: true
```

Indexed as slug `config-app`. Open in UI reader as formatted yaml; not editable via markdown frontmatter flow.

## prepare: legacy file

**Before** (no frontmatter):

```markdown
# Old wiki note

Some content without schema.
```

**After** `repo-mind prepare wiki/old-note.md`:

```markdown
---
type: wiki-page
slug: old-note
status: accepted
title: Old note
tags: []
related: []
updated: 2026-06-22
---

# Old wiki note

Some content without schema.
```

Type inferred from `wiki/` folder path.
