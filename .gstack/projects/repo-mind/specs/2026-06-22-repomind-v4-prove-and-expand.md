# Spec: RepoMind v4 — Prove, Publish, Expand

Status: **DRAFT** (engineering review 2026-06-22)
CEO plan: `.gstack/projects/repo-mind/ceo-plans/2026-06-22-repomind-v4-prove-and-expand.md`
Branch: main

## Goal

Ship proof (A/B kill-switch), distribution (npm 0.2), and product roadmap in `docs/`, then UX expansions (domain tree, keyboard, image upload), then agent write path gated on A/B pass.

## Phase v4.0 — Prove (B1–B4)

### B1 Dogfood exit checklist

**Artifact:** `docs/technical/specs/dogfood-skyforge-checklist.md` (or `.gstack/.../dogfood-exit-2026.md` linked from product roadmap)

| Area | Exit criterion |
|------|----------------|
| Tree | Create/move/rename/delete page; folder README opens |
| Reader | Wikilinks, backlinks, yaml/json, images render |
| Editor | Draft → publish; related suggest on publish |
| Migration | `prepare --all`, `sync-links` on legacy md |
| MCP | `search_docs` → `get_doc` answers real project questions |
| Check | `repo-mind check` passes on skyforge `docs/` |

**Process:** 1 week daily use; log friction in `docs/product/wiki/improvements.md`.

### B2 A/B demo harness

**Location:** `ab-demo/` (per approved design `york-repomind-design-20260621.md`)

```
ab-demo/
├── corpus/              # OR symlink path to skyforge docs/ (TBD — see D1)
├── questions.json       # 5–10 diverse prompts + expected slug anchors
├── run-ab.ts            # orchestrates two arms
├── score-hallucination.md  # human 3-point rubric
└── results/             # gitignored JSON output
```

**Arms:**

| Arm | Agent context |
|-----|----------------|
| A (baseline) | Plain markdown: glob + read files + minimal CLAUDE.md |
| B (RepoMind) | MCP: `search_docs`, `get_doc`, `explore_graph` |

**Metrics:**

- Median tokens-in-context (from agent transcript / usage metadata)
- Hallucination score (human rubric, blind to arm)
- Pass: B wins on ≥2/3 scenarios on both metrics

**CLI:** `npm run ab-demo` → `node ab-demo/run-ab.ts`

**Not unit tests** — EVAL harness; document in README.

### B3 npm 0.2.x

- Bump `package.json` to `0.2.0`
- Sync README Status section
- `files` tarball already includes `ui/dist`, `templates`
- Verify: `npm pack` → install in temp dir → `repo-mind init` → `ui`

### B4 Product roadmap page

**Path:** `docs/product/wiki/roadmap.md`

Frontmatter: `type: wiki-page`, `domain: product`, `slug: product-roadmap`

Content: phases v4.0–v4.2, kill-switch gate, link to CEO plan summary.

## Phase v4.1 — UX depth (E1–E3)

### E1 Domain-grouped tree

**Current state:** `fs-tree.ts` mirrors filesystem; `init` creates `docs/{domain}/...`.

**Approach (recommended):** No second tree model. Enhance root level in `buildFsTree`:

- If top-level folders match `DOC_DOMAINS`, show domain labels from `DOMAIN_LABELS`
- Optional: domain emoji in `catalog-meta.json` keyed by `product`, `technical`, …
- Legacy flat `docs/adr/` → stays under virtual `shared` group or ungrouped root

**API:** extend `GET /api/fs/tree` metadata only if needed; prefer UI-only labels.

**Files:** `src/ui/fs-tree.ts`, `ui/src/tree-sidebar.ts`, `src/index/types.ts` (DOMAIN_LABELS export to UI via api)

### E2 Keyboard navigation

**Scope:** workspace reader + tree focus

| Key | Action |
|-----|--------|
| `j` / `k` | next/prev page in tree order |
| `/` | focus search |
| `e` | open editor for current slug |

**Implementation:** `ui/src/keyboard-nav.ts`; guard when focus in input/textarea.

### E3 Image upload

**Flow:**

```
POST /api/assets/upload
  multipart: file, relativeDir (under docs/assets/)
  → safe-path validate
  → write file
  → return { relativePath, url: /api/assets/... }
```

**UI:** editor toolbar "Insert image" → file picker → insert `![](relative)` 

**Security:** MIME allowlist (png, jpg, gif, webp, svg); max size 5MB; path under `docs/`.

**Tests:** `tests/asset-upload.test.ts`, extend `ui-api.test.ts`

## Phase v4.2 — Agent write (gated)

### E4 create_draft MCP

Per design: git worktree + branch + mutex (`src/git/worktree.ts`).

**Gate:** `ab-demo/results/latest.json` shows pass before implementation starts.

### E5 publish --pr

**CLI:** `repo-mind publish --pr` — commit docs changes, push branch, `gh pr create`

**CI:** optional `.github/workflows/repo-mind-check.yml` (check only in v4.2)

## Data flow (v4.0 critical path)

```
skyforge-caravan/docs/
        │
        ▼
   dogfood checklist (human)
        │
        ▼
ab-demo/run-ab.ts ──► results/*.json ──► kill-switch pass/fail
        │
        ├── FAIL → stop E4/E5, revisit search/ranking
        └── PASS → npm 0.2 + v4.1 UX + v4.2 write tools
```

## Test matrix (new in v4)

| Component | Tests |
|-----------|-------|
| ab-demo | Manual EVAL + smoke script `run-ab --dry-run` validates corpus |
| asset upload | unit + api integration |
| keyboard nav | optional playwright later; manual QA checklist |
| domain tree | `tests/fs-tree.test.ts` extend for domain labels |
| create_draft | defer until gate passes (design test plan exists) |

## Risks

| Risk | Mitigation |
|------|------------|
| A/B not reproducible (human scoring) | Fixed question set + anchor slugs; automate token count only |
| skyforge too large for fair baseline | Cap corpus or use `ab-demo/corpus` subset |
| Image upload path traversal | Reuse `safe-path.ts` + `resolveUnderKnowledgeRoot` |
| create_draft before proof | Hard gate in CEO plan + spec |

## Open decisions

- ~~D1: A/B corpus~~ → **RESOLVED: seeded `ab-demo/corpus` (~15 docs)**; skyforge for B1 dogfood only
- D2: Domain tree = label-only vs enforce domain folders in check
