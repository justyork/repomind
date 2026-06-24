## Learned User Preferences

- gstack is for RepoMind development workflow only; it is not part of the shipped end-user product.
- Web UI is a core product differentiator, not a post-MVP optional extra.
- Editing and page creation should feel Confluence-like: tree inline actions, visual WYSIWYG single canvas (not split Markdown/preview), edit then save to draft or publish from the page, page info collapsed by default.
- Publish without confirmation modal by default; optional diff via Publish menu; View markdown escape hatch in v1.
- Knowledge graph should open as a separate page, not a split-panel view.
- Proceed with the documented recommended implementation order when the user says to continue without re-asking for priorities.
- UI icons use Lucide with a flat style; in the doc tree, a folder with a readable index page (`README.md`) shows a page icon, not a folder icon.

## Learned Workspace Facts

- Product goal: replace Confluence/Notion by keeping wiki, ADRs, architecture, and stack docs in-repo under `docs/` for humans (UI) and agents (MCP).
- `docs/` is the single source of truth; RepoMind is a wrapper providing MCP and Web UI on top of that directory.
- Documentation domains: `product`, `technical`, `game-design`, `analytics`, `art`, `narrative`, `ops`, `shared`; canonical path `docs/{domain}/{type-folder}/{slug}.md`; structured file slugs are path-derived (e.g. `config/app.yaml` → `config-app`).
- Product roadmap in `docs/product/wiki/`; domain backlogs in `{domain}/wiki/`; eng specs in `.gstack/projects/repo-mind/specs/`; authoring taxonomy in `.cursor/skills/repomind-docs/structure.md`.
- gstack project state lives in `.gstack/` with `GSTACK_HOME=.gstack` (see `.env`).
- Git remote: `git@github.com:justyork/repomind.git`.
- Folder index pages use `{folder}/README.md`; root index is `docs/README.md`.
- UI routing is SPA at `/` with `?slug=` deep links; avoid path-based browser navigation outside `/`.
- Primary dogfood target: `~/www/GAMEDEV/skyforge-caravan` (SFC).
- npm package `@justyork/repo-mind` on registry (scoped due to npm `repomind` name conflict); CLI `repo-mind`. Current on `main`: **0.6.1.0**.
- Agent write (E4/E5, 0.6.0): `create_draft` MCP and `repo-mind publish --pr` use SQLite drafts (not git worktree); gated on ab-demo kill-switch P2 (`REPOMIND_AGENT_WRITE=1` override for local dev).
- v4.0 prove exit (B1 skyforge dogfood + B2b live hallucination gate) still in progress; tracked in GitHub issue #13.
