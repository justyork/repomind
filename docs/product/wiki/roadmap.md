---
type: wiki-page
domain: product
slug: product-roadmap
status: accepted
title: Product Roadmap
tags:
  - roadmap
  - v4
related: []
updated: 2026-06-23
---

# RepoMind product roadmap

Single source of truth for release phases. Engineering detail: [v4 eng spec](../../../.gstack/projects/repo-mind/specs/2026-06-22-repomind-v4-prove-and-expand.md). Strategy: [CEO plan v4](../../../.gstack/projects/repo-mind/ceo-plans/2026-06-22-repomind-v4-prove-and-expand.md).

## Shipped

| Release | Highlights |
|---------|------------|
| **v1** | MCP read tools, `init` / `check` / `export`, `docs/` frontmatter index |
| **v2** | Confluence UI, wikilinks, backlinks, editor, move/rename/delete, link health |
| **v3** | README folder index, deep links (`?slug=`), yaml/json reader, image serving via `/api/assets/` |
| **v3+** | Documentation domains (`product/`, `technical/`, `game-design/`, …), `repomind-docs` authoring skill |

Package version on `main`: **0.2.0**

## v4.0 — Prove (in progress)

Goal: prove agents query structured `docs/` better than raw markdown, then publish.

| ID | Deliverable | Status |
|----|-------------|--------|
| B2 | A/B harness (`ab-demo/`, token simulation) | **Done** — `npm run ab-demo:run`; token pass on seeded corpus |
| B2b | Hallucination scoring (human, blind rubric) | **Pending** — see `ab-demo/score-hallucination.md` |
| B1 | Dogfood exit checklist on [skyforge-caravan](~/www/GAMEDEV/skyforge-caravan) | **In progress** — [checklist](../../technical/specs/dogfood-skyforge-checklist.md); log friction in [improvements](improvements.md) |
| B4 | This roadmap page | **Done** |
| B3 | npm **0.2.0** + README version sync | **Done** |
| E1 | Domain labels in catalog tree | **Done** (0.2.0) |

### Kill-switch (P2)

From [CLAUDE.md](../../../CLAUDE.md): A/B must show RepoMind beats plain markdown + CLAUDE.md on **tokens and hallucinations**. If not, stop before agent-write features.

Automated token slice (2026-06-23): baseline median **792** vs repomind **71** on `ab-demo/corpus` (8/8 question wins). Full gate requires human hallucination scores on real agent runs.

```bash
npm run ab-demo          # validate fixture
npm run ab-demo:run      # token comparison → ab-demo/results/latest.json
```

## v4.1 — UX depth (after v4.0 prove)

| ID | Feature | Notes |
|----|---------|-------|
| ~~E1~~ | ~~Domain labels in catalog tree~~ | Shipped in 0.2.0 |
| E2 | Keyboard nav (`j`/`k`, `/`, `e`) | Reader + tree focus |
| E3 | Image upload in editor | `POST /api/assets/upload`, `safe-path` guards |

## v4.2 — Agent write (gated)

Ship **only if** kill-switch passes (tokens + hallucinations).

| ID | Feature | Notes |
|----|---------|-------|
| E4 | `create_draft` MCP tool | Git worktree + branch; design in approved v1 doc |
| E5 | `publish --pr` + optional CI check workflow | Requires `gh`, clean git state |

## Not in scope (this cycle)

- Confluence / Notion import
- PDF preview, Obsidian import
- Cloud hosting, multi-user auth
- gstack as a shipped product surface

## 12-month direction

`npx repo-mind init` → daily dogfood on a real game project → proven MCP advantage → npm adoption → agents propose drafts → humans merge via PR. Full vision: [idea.md](../../../idea.md).

## Improvements backlog

Friction from dogfood: [product/wiki/improvements.md](product/wiki/improvements.md). Scoped engineering specs: `technical/specs/`.
