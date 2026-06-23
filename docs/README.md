# Project documentation

RepoMind dogfoods its own `docs/` layout. Humans edit here via `repo-mind ui`; agents query the same files via MCP.

## Domains

| Domain | Purpose |
|--------|---------|
| [product/](product/README.md) | Roadmap, PRD, product questions |
| `technical/` | ADR, architecture, engineering specs — [dogfood checklist](technical/specs/dogfood-skyforge-checklist.md) |
| `shared/` | Glossary, agent instructions (add as needed) |

## Key pages

- [Product roadmap](product/wiki/roadmap.md) — current phases and kill-switch gate

Run `repo-mind check` to validate frontmatter and links.
