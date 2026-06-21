# RepoMind

MCP-first project memory layer for AI-assisted development. Agents query structured project knowledge inside the repository instead of ingesting whole markdown files.

## Status

**v0.1.0** — M1: CLI + MCP read tools. **UI-1:** read-only graph workspace (`repo-mind ui`).

| Artifact | Location |
|----------|----------|
| Full product vision | [`idea.md`](idea.md) |
| Approved v1 design (Approach A) | [`.gstack/projects/repo-mind/york-repomind-design-20260621.md`](.gstack/projects/repo-mind/york-repomind-design-20260621.md) |
| Executable spec (M1) | [`.gstack/projects/repo-mind/specs/2026-06-21-repomind-v1-core-scaffold.md`](.gstack/projects/repo-mind/specs/2026-06-21-repomind-v1-core-scaffold.md) |
| Eng review test plan | [`.gstack/projects/repo-mind/york-repomind-eng-review-test-plan-20260621.md`](.gstack/projects/repo-mind/york-repomind-eng-review-test-plan-20260621.md) |

## Quick start

```bash
# From this repo (local dev)
npm install && npm run build
node dist/cli.js init
node dist/cli.js setup

# After npm publish
npx -y repo-mind init
npx -y repo-mind setup
```

Then ask your agent a project question — it should call `search_docs` / `get_doc` via MCP.

## CLI commands

| Command | Description |
|---------|-------------|
| `repo-mind init` | Scaffold `.project-knowledge/` with 6 example docs |
| `repo-mind setup` | Configure Cursor/Claude MCP + CLAUDE.md snippet |
| `repo-mind check` | Validate frontmatter schema and `related:` links |
| `repo-mind export` | Write `agents.md` to repo root |
| `repo-mind mcp` | Start the MCP stdio server |
| `repo-mind ui` | Local read-only knowledge graph (127.0.0.1:3847) |

## Web UI (UI-1)

Read-only graph workspace over `.project-knowledge/`:

```bash
npm run build          # compiles CLI + Vite UI (ui/dist)
repo-mind ui           # http://127.0.0.1:3847
repo-mind ui --port 4000 --cwd /path/to/project
```

Binds **127.0.0.1** only. Requires `npm run build` so `ui/dist` exists.


- `list_docs` — filter by type, status, tag
- `search_docs` — ranked full-text search
- `get_doc` — fetch one doc by slug
- `get_glossary_term` — resolve glossary entries
- `explore_graph` — BFS over `related:` links

## CI

Add to GitHub Actions or pre-commit:

```yaml
- run: npx repo-mind check
```

## Development

```bash
npm install
npm run build
npm test
```

## gstack workflow

This repo is developed with [gstack](https://github.com/garrytan/gstack). Project artifacts live in `.gstack/projects/repo-mind/` (versioned in git). Set `GSTACK_HOME=.gstack` when working in this repo (see `.env`).

## Roadmap

- **UI-2:** SQLite drafts + publish to markdown
- **UI-3:** Check dashboard + diff preview
- **M2:** A/B demo harness + E2E install-to-whoa
- **M3:** `create_draft` (only if P2 kill-switch passes)
- **v1.1:** GitHub Action, `llms.txt` / `docs-index.json` export

## License

MIT
