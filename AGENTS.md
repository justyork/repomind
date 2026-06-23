## Learned User Preferences

- gstack is for RepoMind development workflow only; it is not part of the shipped end-user product.
- Web UI is a core product differentiator, not a post-MVP optional extra.
- Editing and page creation should feel Confluence-like: tree inline actions, visual WYSIWYG single canvas (not split Markdown/preview), edit then save to draft or publish from the page, page info collapsed by default.
- Publish without confirmation modal by default; optional diff via Publish menu; View markdown escape hatch in v1.
- Knowledge graph should open as a separate page, not a split-panel view.
- Proceed with the documented recommended implementation order when the user says to continue without re-asking for priorities.

## Learned Workspace Facts

- Product goal: replace Confluence/Notion by keeping wiki, ADRs, architecture, and stack docs in-repo under `docs/` for humans (UI) and agents (MCP).
- `docs/` is the single source of truth; RepoMind is a wrapper providing MCP and Web UI on top of that directory.
- Documentation domains: `product`, `technical`, `game-design`, `analytics`, `art`, `narrative`, `ops`, `shared`; canonical path `docs/{domain}/{type-folder}/{slug}.md`; structured file slugs are path-derived (e.g. `config/app.yaml` → `config-app`).
- Product roadmap lives in `docs/product/wiki/`; improvements backlog in `{domain}/wiki/`; scoped improvements in `{domain}/specs/`.
- Cursor skill `repomind-docs` at `.cursor/skills/repomind-docs/` (`structure.md` for full domain×type taxonomy).
- gstack project state lives in `.gstack/` with `GSTACK_HOME=.gstack` (see `.env`).
- Git remote: `git@github.com:justyork/repomind.git`.
- Folder index pages use `{folder}/README.md`; root index is `docs/README.md`.
- UI routing is SPA at `/` with `?slug=` deep links; avoid path-based browser navigation outside `/`.
- Primary dogfood target: `~/www/GAMEDEV/skyforge-caravan` (SFC).
- npm package `@justyork/repo-mind` on registry (scoped due to npm `repomind` name conflict); CLI `repo-mind`. v0.3.0 shipped: domain labels, keyboard nav, image upload, UI version in topbar via `/api/health`.
- npm version plan: 0.2.0 = v4.0 Prove (shipped), 0.3.0 = v4.1 UX (shipped), 0.4.0+ = visual WYSIWYG editor (`.gstack/projects/repo-mind/specs/2026-06-23-visual-editor-wysiwyg.md`) then `create_draft` (gated on kill-switch pass).
