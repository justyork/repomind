## Learned User Preferences

- gstack is for RepoMind development workflow only; it is not part of the shipped end-user product.
- Web UI is a core product differentiator, not a post-MVP optional extra.
- Editing and page creation should feel Confluence-like: tree inline actions, edit then save to draft or publish from the page, page info collapsed by default.
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
- v3 shipped (PR #7); current focus v4.0 Prove: P2 kill-switch via `ab-demo/` (`npm run ab-demo`), skyforge dogfood checklist, npm 0.2.0 publish gate.
- npm version plan: 0.2.0 = v4.0 Prove, 0.3.0 = v4.1 UX (domain labels, keyboard, upload), 0.4.0 = v4.2 agent write (`create_draft`, gated on kill-switch pass).
