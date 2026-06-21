# RepoMind

MCP-first project memory layer for AI-assisted development. Agents query structured project knowledge inside the repository instead of ingesting whole markdown files.

## Status

**v0.1.1** — M1 CLI + MCP. **Web UI:** Confluence-style workspace, drafts/publish, health dashboard, graph page, light/dark theme.

| Artifact | Location |
|----------|----------|
| Full product vision | [`idea.md`](idea.md) |
| Approved v1 design (Approach A) | [`.gstack/projects/repo-mind/york-repomind-design-20260621.md`](.gstack/projects/repo-mind/york-repomind-design-20260621.md) |
| Executable spec (M1) | [`.gstack/projects/repo-mind/specs/2026-06-21-repomind-v1-core-scaffold.md`](.gstack/projects/repo-mind/specs/2026-06-21-repomind-v1-core-scaffold.md) |
| Design system | [`DESIGN.md`](DESIGN.md) |

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
| `repo-mind ui` | Local knowledge workspace (127.0.0.1:3847) |

## Web UI

Confluence-style workspace over `.project-knowledge/`:

```bash
npm run build
repo-mind ui              # http://127.0.0.1:3847
repo-mind ui --port 4000 --cwd /path/to/project
```

- **Catalog tree** — docs grouped by type (ADR, specs, glossary…)
- **Drafts + Publish** — SQLite drafts, publish to git markdown
- **Health** — schema check, publish queue, export `agents.md`
- **Graph** — full-page view at `/graph.html`
- **Theme** — light (default) / dark toggle

Binds **127.0.0.1** only. MCP reads published files only.


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

- **UI-4b:** Editor in Confluence layout, type icons in tree
- **M2:** A/B demo harness + E2E install-to-whoa
- **M3:** `create_draft` MCP (if P2 kill-switch passes)
- **v1.1:** `publish --pr`, GitHub Action, batch publish

## License

MIT
