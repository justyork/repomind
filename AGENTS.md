## Learned User Preferences

- gstack is for RepoMind development workflow only; it is not part of the shipped end-user product.
- Web UI is a core product differentiator, not a post-MVP optional extra.
- Editing and page creation should feel Confluence-like: tree inline actions, visual WYSIWYG single canvas (not split Markdown/preview), read view first with edit entered only via the Edit button (not click-to-edit on the article body), edit then save to draft or publish from the page, page info collapsed by default.
- Switching documents resets workspace scroll to the top.
- Reader view: full workspace width; Notion-like right-side heading outline navigation (vertical track, hover menu) for documents with multiple headings.
- Apply saved theme before first paint so the UI does not flash light mode on reload.
- Ask chat opens from a floating icon in the bottom-right corner (not a topbar or menu button).
- Doc assistant should handle greetings and vague queries helpfully (suggest doc starting points or "maybe you were looking for…") instead of a bare "not found."
- Publish without confirmation modal by default; optional diff via Publish menu; View markdown escape hatch in v1.
- Knowledge graph should open as a separate page, not a split-panel view.
- Proceed with the documented recommended implementation order when the user says to continue without re-asking for priorities.
- UI icons use Lucide with a flat style; in the doc tree, show a folder icon for folders without an index page, and a page icon when the folder has a `README.md` index; editor toolbar uses the same icon set.

## Learned Workspace Facts

- Product goal: replace Confluence/Notion by keeping wiki, ADRs, architecture, and stack docs in-repo under `docs/` for humans (UI) and agents (MCP).
- `docs/` is the single source of truth; RepoMind is a wrapper providing MCP and Web UI on top of that directory.
- Documentation domains: `product`, `technical`, `game-design`, `analytics`, `art`, `narrative`, `ops`, `shared`; canonical path `docs/{domain}/{type-folder}/{slug}.md`; structured file slugs are path-derived (e.g. `config/app.yaml` → `config-app`).
- Informal ideas backlog in root `ROADMAP.md`; formal product roadmap in `docs/product/wiki/`; domain backlogs in `{domain}/wiki/`; eng specs in `.gstack/projects/repo-mind/specs/`; authoring taxonomy in `.cursor/skills/repomind-docs/structure.md`.
- Web UI doc assistant (Ask): BYOK LLM via `POST /api/ask`, `REPOMIND_*` from project `.env` (server-side only, not in browser payloads); answers grounded in `search_docs` + `get_doc` with source citations.
- `.gstack/` is gitignored (local dev state via `GSTACK_HOME=.gstack` in `.env`); UI design tokens in root `DESIGN.md`. Git remote: `git@github.com:justyork/repomind.git`.
- Folder index pages live at `README.md` inside the folder (e.g. `docs/specs/README.md`); the README is hidden from tree children and its title/slug powers the folder row (click opens the page, chevron expands children). Root index is `docs/README.md`. Legacy same-name sibling pairs (`roadmap.md` + `roadmap/`) still work as folder indexes and are also hidden from the tree; prefer `README.md` for new folders. Promoting a leaf page moves it to `{folder}/README.md`.
- UI routing is SPA at `/` with `?slug=` deep links; avoid path-based browser navigation outside `/`.
- Primary dogfood target: `~/www/GAMEDEV/skyforge-caravan` (SFC).
- npm package `@justyork/repo-mind` on registry (scoped due to npm `repomind` name conflict); CLI `repo-mind`. Current on `main`: **0.9.0**. Agent write: `create_draft` MCP and `repo-mind publish --pr` use SQLite drafts (not git worktree); gated on ab-demo kill-switch P2 (`REPOMIND_AGENT_WRITE=1` override for local dev).
- Optional UI password auth via `REPOMIND_UI_PASSWORD` (session cookie; protects Web UI and `/api/*`, not MCP or on-disk `docs/`).
- MCP reads published `docs/` from `process.cwd()` (no `--cwd` on `mcp`); run `init` + `setup` in the target project. `setup` configures MCP + `CLAUDE.md` snippet only; `install-skill` copies the `repomind-docs` Cursor skill (project or `--global`).
- v4.0 prove exit (B1 skyforge dogfood + B2b live hallucination gate) still in progress; tracked in GitHub issue #13. Visual WYSIWYG editor (TipTap) shipped 0.4.x; unified page workspace shipped 0.7.0.
