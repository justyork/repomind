# Spec: RepoMind v2 — Link Layer + Human UX

Status: **APPROVED** (CEO plan locked 2026-06-22)
Branch: main
CEO plan: `.gstack/projects/repo-mind/ceo-plans/2026-06-22-repomind-v2-link-layer.md`

## Goal

One link index powers graph, reader, editor, MCP, and `check`. Humans get collapsible page info, richer graph, and (P2) move/rename + editor autocomplete.

## P0 — Ship pending UI-4 work

- [ ] Commit: tree-sidebar, fs-tree, fs-operations, safe-path, catalog-meta, markdown, catalog grouping
- [x] Fix `listDrafts()` destructuring in `reloadTree` (done)

## P1 — Link Layer + reader UX

### 1.1 `src/index/link-index.ts`

```ts
export type LinkKind = 'related' | 'wikilink' | 'markdown-href' | 'parent_of';

export interface LinkEdge {
  from: string;   // slug
  to: string;     // slug or unresolved target string
  kind: LinkKind;
}

export interface LinkIndexSnapshot {
  edges: LinkEdge[];
  backlinks: Map<string, string[]>;  // target → sources
  brokenTargets: Set<string>;
}

// parseWikilinks(body): string[]  — [[slug]], [[title|slug]]
// parseMarkdownLinks(body): { href, text }[]
// buildLinkIndex(docs, tree?): LinkIndexSnapshot
```

- Wikilink regex: `\[\[([^\]|]+)(?:\|([^\]]+))?\]\]`
- Resolve wikilink target: slug as-is, or title→slug via DocIndex
- `parent_of`: folder index page → child page slugs (E10)

### 1.2 Extend `explore_graph`

- Traverse edges from LinkIndex (related + wikilink + parent_of)
- Deduplicate edges; keep `broken_links` for unresolved targets
- MCP `explore_graph` unchanged input/output shape

### 1.3 APIs

```
GET /api/backlinks/:slug     → { backlinks: { slug, title, kind }[] }
GET /api/link-health         → { orphans, broken, oneWay }  (E1 partial in P1, full dashboard P3)
```

### 1.4 UI reader

- `markdown.ts`: render `[[slug]]` as internal nav links before marked parse
- `doc-panel.ts`: backlinks section below article; collapsible `.page-info` + Focus toggle (`localStorage`)

### 1.5 Check (E3)

- `collect-violations.ts`: warn on `[[missing-slug]]` not in index (warning, not violation initially)

### Tests

- `tests/link-index.test.ts` — wikilink parse, backlinks, broken detection
- Extend `tests/explore-graph.test.ts` for wikilink edges

## P2 — Editor + filesystem

### 2.1 Editor

- `[[` trigger → dropdown of slugs (fuzzy match on title/slug)
- Toolbar: H1–H3, bold, italic, link, task list
- Publish modal: "Add N body links to related?" (E4) — lists slugs, Apply / Skip

### 2.2 Filesystem

```
POST /api/fs/move    { fromPath, toDir }
POST /api/fs/rename  { path, newName }
```

- `safe-path.ts` guards
- On move: recompute slug from path; warn broken inbound links
- Tree: context menu Move to… / Rename (E2 drag deferred)

## P3 — Accepted polish

| Item | Deliverable |
|------|-------------|
| E1 | Link health panel on dashboard: orphan count, broken links, one-way edges |
| E5 | `chokidar` on `docs/` → debounced `DocIndex.refresh()` + `sidebar.refreshTree()` |
| E7 | `+` menu: New from template → pick from `templates/*.md` |

## Deferred / skipped

- E2 drag-drop, E6 git history, E8 keyboard nav
- E9 Obsidian import — skipped

## Acceptance (v2 done)

1. Graph shows edges from `[[wikilinks]]` without manual `related:`
2. Reader: Focus mode hides page info; backlinks visible inline
3. `repo-mind check` reports broken wikilinks
4. Editor: `[[` autocomplete; publish suggests related
5. Move page between folders via API + tree menu
6. Dashboard shows link health summary
