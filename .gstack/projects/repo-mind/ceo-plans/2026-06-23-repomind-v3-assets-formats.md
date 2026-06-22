---
status: DRAFT
---
# CEO Plan: RepoMind v3 — Formats & Images

Generated: 2026-06-23
Follows: v2 Link Layer (APPROVED / shipping)
Repo: justyork/repomind

## Why now

v2 made **links and wiki UX** solid. Dogfood friction shifts to:

- Config and schema files live as `.yaml` / `.json` next to markdown — today invisible to tree and MCP
- Architecture docs reference **diagrams and screenshots** — broken `img` paths, no static serving from `docs/`

## Vision (next 4–6 weeks)

```
v2 (shipping)                 v3                          12-month
Link Layer + tree UX    →    Multi-format + images   →    Full team knowledge OS
.md only in index           yaml/json in reader          Agent co-authoring
No asset URLs               /api/assets from docs/       Rich embeds, zero lock-in
{folder}.md index           README.md index everywhere   Shareable ?slug= URLs
```

## Scope (proposed)

| Priority | Deliverable | Phase |
|----------|-------------|-------|
| Must | **README.md** as folder index (incl. `docs/`) | P0 |
| Must | **Deep links** — `?slug=`, URL sync, copy link, in-app md links | P0 |
| Must | Read yaml/yml/json in tree + reader | P1 |
| Must | Serve images from `docs/`, render in markdown | P2 |
| Should | `check` syntax for yaml/json; broken image warnings | P2 |
| Could | E8 keyboard nav, link cascade on delete | P3 |
| Defer | Image upload UI, PDF, Obsidian | v3.1+ |

## Non-goals

- Replacing Markdown as primary authoring format
- Cloud hosting / multi-user auth

## Success metrics

- Click any folder → opens its `README.md` (or clear empty state)
- Paste `http://127.0.0.1:3847/?slug=…` → correct page without manual tree navigation
- Skyforge: open at least one `.json` and one image-heavy page without leaving RepoMind UI
- Zero path-traversal issues on `/api/assets`
- Agent can `get_doc` a yaml config file

## Spec

Detail: `.gstack/projects/repo-mind/specs/2026-06-23-repomind-v3-assets-formats.md`

## GitHub (to file after v2 PR merges)

- Epic: RepoMind v3 — Assets & formats
- P0: README index pages + deep link routing
- P1: yaml/json index and reader
- P2: Image serving and markdown embeds
