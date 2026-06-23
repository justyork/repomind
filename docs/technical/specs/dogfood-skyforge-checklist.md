---
type: feature-spec
domain: technical
slug: dogfood-skyforge-checklist
status: accepted
title: Dogfood exit checklist — skyforge-caravan
tags:
  - dogfood
  - v4
  - qa
related:
  - product-roadmap
updated: 2026-06-23
---

# Dogfood exit checklist — skyforge-caravan

**Target repo:** `~/www/GAMEDEV/skyforge-caravan`  
**Goal (v4.0 B1):** one week of daily use without blocking UX issues; friction logged in [improvements backlog](../../../product/wiki/improvements.md).  
**Exit:** all **P0** rows checked; P1 issues either fixed or filed with owner.

## Setup (run once)

```bash
cd ~/www/GAMEDEV/skyforge-caravan
# Ensure docs/ exists and is indexed (migrate from .project-knowledge/ if needed)
npx @justyork/repo-mind prepare --all --dry-run   # preview legacy md
npx @justyork/repo-mind prepare --all             # add frontmatter where missing
npx @justyork/repo-mind sync-links --dry-run
npx @justyork/repo-mind sync-links
npx @justyork/repo-mind check
npx @justyork/repo-mind setup --cursor            # or --claude
npx @justyork/repo-mind ui                        # http://127.0.0.1:3847
```

Record versions:

| Field | Value |
|-------|-------|
| repo-mind version | |
| Date started | |
| Doc count (`list_docs`) | |

## P0 — must pass to exit dogfood

### Tree & navigation

- [ ] **Create page** — new doc via UI; lands under correct domain folder with valid frontmatter
- [ ] **Folder README** — click domain or subfolder with `README.md` opens index page (not empty state)
- [ ] **Move** — relocate page to another folder; tree and slug remain consistent
- [ ] **Rename** — rename file/slug; deep link `?slug=` still resolves
- [ ] **Delete** — remove page; tree updates; no orphan draft confusion
- [ ] **Deep link** — copy link from header; paste in new tab → same page; Back/Forward works

### Reader

- [ ] **Wikilinks** — double-bracket slug links navigate in-app and update URL
- [ ] **Backlinks** — inbound links visible for a linked page
- [ ] **yaml/json** — open at least one `.yaml` and one `.json` under `docs/`; readable view
- [ ] **Images** — embedded images under `docs/` render in light and dark theme
- [ ] **Related chips** — `related:` frontmatter shows in page info rail

### Editor & drafts

- [ ] **Draft → publish** — create draft, edit in WYSIWYG canvas, publish to `docs/*.md`; appears in tree
- [ ] **WYSIWYG** — bold, headings, lists, `[[wikilinks]]` survive publish (verify in reader + `get_doc`)
- [ ] **Publish now** — primary Publish without modal; Review changes via Publish ▾ optional
- [ ] **Properties chips** — status, tags, related editable in rail; autosave works
- [ ] **Slash menu** — `/h2`, `/bullet`, `/todo` insert blocks in canvas
- [ ] **Related suggest** — on publish review, related slug suggestions appear (accept or dismiss)
- [ ] **Prepare** — `repo-mind prepare` on a legacy md file adds schema without data loss

### Migration & health

- [ ] **prepare --all** — batch frontmatter on remaining legacy markdown (or N/A if already done)
- [ ] **sync-links** — wikilink conversion + `related:` sync on a real folder
- [ ] **check clean** — `repo-mind check` exits 0 on skyforge `docs/`
- [ ] **Link health** — dashboard shows broken links count; no silent failures on known-good set

### MCP (agent path)

Ask the agent **three real project questions** (combat, caravan lore, architecture — not trivia). For each:

- [ ] Agent calls `search_docs` then `get_doc` (or `get_glossary_term`) without reading whole `docs/` blindly
- [ ] Answer is grounded in published docs (no invented mechanics)
- [ ] You can open the cited slug in UI and verify the fact

### Graph

- [ ] **Graph page** — `/graph.html` loads; click node opens workspace at slug
- [ ] **Focus mode** — filter graph from current page works for a dense doc

## P1 — log if failing (not blocking exit)

- [x] Domain labels visible at tree root (E1, 0.2.0)
- [x] Keyboard shortcuts (`j`/`k`, `/`, `e`) (E2, 0.3.0)
- [x] Image upload in editor (E3, 0.3.0)
- [x] Editor layout matches reader chrome (E6b PageShell, 0.4.1)
- [ ] Type icons in catalog tree

## Daily log (1 week)

| Day | Date | Minutes | Blocker? | Notes |
|-----|------|---------|----------|-------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
| 7 | | | | |

**Blocker** = could not complete normal doc task; file in [improvements](../../../product/wiki/improvements.md).

## Sign-off

| Role | Name | Date | P0 complete |
|------|------|------|-------------|
| Dogfood owner | | | [ ] |

When signed off, update [product roadmap](../../../product/wiki/roadmap.md) B1 row to **Done** and proceed to npm 0.2.0 (B3) after hallucination scoring (B2b).
