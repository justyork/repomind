# UI-4 Dogfood — Skyforge Caravan (2026-06-21)

**Project:** `~/www/GAMEDEV/skyforge-caravan` (10 docs, 2 drafts)  
**UI:** `http://127.0.0.1:3847`  
**Scope:** Confluence shell, graph page, theme toggle, markdown tables

## Fixed since UI-3 dogfood

| Item | Status |
|------|--------|
| Graph split-screen / drawer | **Fixed** — graph on `/graph.html` full page |
| Search ↔ graph sync | **N/A** — graph is separate; search opens doc in workspace |
| Truncated graph labels | **Fixed** — slug on canvas, full title on hover |
| Related in doc panel | **Fixed** — chips in page info rail |
| New draft via `prompt()` | **Fixed** — modal + Create page |
| Publish modal stuck open | **Fixed** — `.modal.hidden` CSS specificity |
| Draft editor padding | **Fixed** — `workspace-main` class preserved |

## UI-4 friction (next)

### P1

1. **Editor breaks Confluence layout** — draft mode is full-width form; no breadcrumb / page info rail.
2. **No type icons in catalog tree** — catalogs are text-only; harder to scan vs Confluence.
3. **Breadcrumb "Knowledge" root** — click does nothing useful yet.

### P2

4. **Graph page light theme** — nodes readable; edge contrast could be stronger in light mode.
5. **Health view still utilitarian** — not restyled to Confluence shell (acceptable for v1).
6. **Table overflow on very wide tables** — horizontal scroll works; no sticky header.

## What worked

- Catalog tree (ADR / Specs / Glossary…) matches mental model of `.project-knowledge/` folders.
- Breadcrumb + page info rail feel Confluence-like on read path.
- Global search in topbar with catalog hint in results.
- Light/dark toggle persists across workspace and graph pages.
- Markdown tables render with borders, stripes, and scroll.

## Recommendation for UI-4b

1. Editor in same page layout (breadcrumb + optional collapsed page info).
2. Type icons in sidebar tree.
3. README hero GIF after npm publish.
