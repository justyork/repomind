# RepoMind

**Unified project knowledge in `docs/`** — wiki, architecture, ADR, stack, and glossary live in your repository. Humans edit via a Confluence-style UI; AI agents query the same files through MCP. No Confluence or Notion required.

## Status

**v0.6.1** — live A/B eval (`repo-mind ab-eval`) for kill-switch proof on real `docs/`. Also: `create_draft` MCP, `publish --pr` (0.6.0). Prior: WYSIWYG editor, keyboard nav, domain labels.

| Artifact | Location |
|----------|----------|
| **Product roadmap** | [`docs/product/wiki/roadmap.md`](docs/product/wiki/roadmap.md) |
| Full product vision | [`idea.md`](idea.md) |
| docs/ pivot spec | [`.gstack/projects/repo-mind/specs/2026-06-21-repomind-docs-root-pivot.md`](.gstack/projects/repo-mind/specs/2026-06-21-repomind-docs-root-pivot.md) |
| Design system | [`DESIGN.md`](DESIGN.md) |

## Install

```bash
npm install -g @justyork/repo-mind
```

CLI command remains **`repo-mind`** (bin alias unchanged).

## Quick start

```bash
# From npm
npx -y @justyork/repo-mind init
npx -y @justyork/repo-mind setup

# From this repo (local dev)
npm install && npm run build
node dist/cli.js init
node dist/cli.js setup
```

Then ask your agent a project question — it should call `search_docs` / `get_doc` via MCP against the same `docs/` you edit in the UI.

## CLI commands

| Command | Description |
|---------|-------------|
| `repo-mind init` | Scaffold `docs/` with example structured pages |
| `repo-mind setup` | Configure Cursor/Claude MCP + CLAUDE.md snippet |
| `repo-mind check` | Validate frontmatter schema and `related:` links |
| `repo-mind prepare` | Add frontmatter to legacy markdown (`--all` for batch) |
| `repo-mind sync-links` | Convert markdown links to wikilinks; sync `related:` |
| `repo-mind export` | Write `agents-export.md` flat dump to repo root |
| `repo-mind publish` | Publish active drafts to `docs/`; `--pr` opens a GitHub pull request |
| `repo-mind mcp` | Start the MCP stdio server |
| `repo-mind ui` | Confluence-style workspace over `docs/` (127.0.0.1:3847) |
| `npm run ab-demo` | Validate A/B demo fixture (repo checkout only) |
| `repo-mind ab-eval` | Live A/B eval on project `docs/` (skyforge dogfood gate) |

## Cursor skill

Agent skill for authoring `docs/` — **domains** (product, technical, game-design, analytics, …), frontmatter, structure, wikilinks: [`.cursor/skills/repomind-docs/`](.cursor/skills/repomind-docs/) ([structure.md](.cursor/skills/repomind-docs/structure.md)). Copy to `~/.cursor/skills/repomind-docs/` for other projects.

## Web UI

Confluence-style workspace over **`docs/`**:

```bash
npm run build
repo-mind ui              # http://127.0.0.1:3847
repo-mind ui --port 4000 --cwd /path/to/project

# Local development (uses this repo's dist/, includes latest .env loader):
npm run ui
node dist/cli.js ui
```

`repo-mind ui` loads `REPOMIND_*` variables from the nearest `.env` (starting at cwd and the docs project root). If you installed `@justyork/repo-mind` globally, run `npm link` in this repo after `npm run build` so `repo-mind ui` uses the local build.

- **Catalog tree** — docs by domain (`Product`, `Technical`, …) and type
- **Prepare** — recursively find markdown without frontmatter; add schema in one click
- **Drafts + Publish** — SQLite drafts, publish to `docs/*.md`
- **Health** — schema check, publish queue, export `agents-export.md`
- **Graph** — full-page view at `/graph.html`
- **Ask** — documentation assistant (BYOK): floating chat button, natural-language Q&A with source links
- **Theme** — light (default) / dark toggle

Binds **127.0.0.1** only. MCP reads published files in `docs/` only (not SQLite drafts).

### Ask assistant (BYOK)

Click the **chat icon** in the bottom-right corner to open the documentation assistant. Answers are grounded in published `docs/` via the same retrieval path as MCP (`search_docs` → `get_doc`). Each answer includes links to source pages (`?slug=`).

Configure your provider API key in **Ask → Settings** (stored in browser `localStorage` only) or set a team default:

Or set a team default in project `.env` (loaded automatically by `repo-mind ui`):

```bash
REPOMIND_ASK_API_KEY=sk-...
REPOMIND_ASK_PROVIDER=openai
REPOMIND_UI_PASSWORD=your-password
```

| Variable | Description |
|----------|-------------|
| `REPOMIND_ASK_API_KEY` | Optional server default API key |
| `REPOMIND_ASK_PROVIDER` | `openai` (default) or `anthropic` |
| `REPOMIND_ASK_MODEL` | Override model (default: `gpt-4o-mini` / `claude-3-5-haiku-latest`) |

## MCP tools

- `list_docs` — filter by type, status, tag
- `search_docs` — ranked full-text search
- `get_doc` — fetch one doc by slug
- `get_glossary_term` — resolve glossary entries
- `explore_graph` — BFS over `related:` links
- `create_draft` — create a SQLite draft for human review (gated on kill-switch pass)

## CI

Add to GitHub Actions or pre-commit:

```yaml
- run: npx @justyork/repo-mind check
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

See [`docs/product/wiki/roadmap.md`](docs/product/wiki/roadmap.md) for v4.0–v4.2 phases. v4.2 agent write shipped in 0.6.0 (gated); next: v4.0 prove closure (dogfood + hallucination scoring).

## License

MIT
