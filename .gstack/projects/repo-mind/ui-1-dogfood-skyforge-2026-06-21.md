# UI-1 Dogfood — Skyforge Caravan (2026-06-21)

**Project:** `~/www/GAMEDEV/skyforge-caravan` (10 docs)  
**UI:** `http://127.0.0.1:3847`  
**Method:** Browser session + API checks

## Friction points (prioritized)

### P0 — fixed in this commit

1. **Graph column width 0px** — center panel collapsed (`graph-panel.clientWidth === 0`); graph existed in DOM but was invisible. Fix: `minmax(280px, 1fr)` + `min-width` on layout.

### P1 — address in UI-1.1 or early UI-2

2. **No edit path** — expected for UI-1, but #1 user pain during dogfood; blocks "Notion-like" positioning until UI-2.
3. **Node labels truncated** — d3 labels cut at ~12 chars; Russian titles unreadable on graph ("Груз из трю…").
4. **Broken `related:` invisible** — skyforge docs have empty `related:` arrays; when links exist, UI should show broken count in graph (badge) and list in dashboard (UI-3).
5. **Search → graph sync** — picking a search result opens doc panel but does not center/highlight node on graph.
6. **No `related:` in doc panel** — cannot see outbound links while reading; click-to-navigate missing.

### P2 — nice to have

7. **Frontmatter tab is JSON, not YAML** — minor; agents use JSON anyway.
8. **No double-click subgraph** — design mentioned re-center on slug with depth=2; not implemented.
9. **Header stats minimal** — added broken link count; still no by-type breakdown.
10. **First selection is list order, not graph** — loads first sidebar doc, not graph-selected node.

## What worked

- 10 docs load; search `caravan` returns relevant hits with snippets.
- Doc panel Preview / Agent tabs match MCP shape for glossary terms.
- Copy path works for opening in editor externally.
- Type/status filters populate from live data.

## Recommendation for UI-2 spec

Prioritize: **draft editor + publish** (P1 #2), then **related links in doc panel** (#6) and **search↔graph sync** (#5) as UI-2 polish items.
