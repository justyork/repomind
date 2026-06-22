# RepoMind

**Unified project knowledge in `docs/`** — wiki, architecture, ADR, stack, and glossary live in your repository. Humans edit via a Confluence-style UI; AI agents query the same files through MCP. No Confluence or Notion required.

## Status

**v0.1.2** — `docs/` as single source of truth. Confluence-style UI, drafts/publish, prepare frontmatter, health dashboard, graph, light/dark theme.

| Artifact | Location |
|----------|----------|
| Full product vision | [`idea.md`](idea.md) |
| docs/ pivot spec | [`.gstack/projects/repo-mind/specs/2026-06-21-repomind-docs-root-pivot.md`](.gstack/projects/repo-mind/specs/2026-06-21-repomind-docs-root-pivot.md) |
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

Then ask your agent a project question — it should call `search_docs` / `get_doc` via MCP against the same `docs/` you edit in the UI.

## CLI commands

| Command | Description |
|---------|-------------|
| `repo-mind init` | Scaffold `docs/` with example structured pages |
| `repo-mind setup` | Configure Cursor/Claude MCP + CLAUDE.md snippet |
| `repo-mind check` | Validate frontmatter schema and `related:` links |
| `repo-mind export` | Write `agents.md` to repo root |
| `repo-mind mcp` | Start the MCP stdio server |
| `repo-mind ui` | Confluence-style workspace over `docs/` (127.0.0.1:3847) |

## Web UI

Confluence-style workspace over **`docs/`**:

```bash
npm run build
repo-mind ui              # http://127.0.0.1:3847
repo-mind ui --port 4000 --cwd /path/to/project
```

- **Catalog tree** — docs grouped by type (Wiki, ADR, specs, glossary…)
- **Prepare** — recursively find markdown without frontmatter; add schema in one click
- **Drafts + Publish** — SQLite drafts, publish to `docs/*.md`
- **Health** — schema check, publish queue, export `agents.md`
- **Graph** — full-page view at `/graph.html`
- **Theme** — light (default) / dark toggle

Binds **127.0.0.1** only. MCP reads published files in `docs/` only (not SQLite drafts).

## MCP tools

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

- Confluence/Notion markdown import
- **M2:** A/B demo harness + E2E install-to-whoa
- **M3:** `create_draft` MCP (if P2 kill-switch passes)
- `publish --pr`, GitHub Action, batch publish

## License

MIT
