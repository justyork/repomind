# Visual editor (Confluence / Notion) — design plan

**Status:** DRAFT (plan-design-review)  
**Branch:** main @ v0.3.0  
**Author:** plan-design-review  
**Date:** 2026-06-23

## Problem

Today RepoMind editing feels like a **developer tool**, not a wiki:

- Split **Markdown | Preview** panes (`ui/src/editor.ts`)
- Frontmatter as raw form fields in sidebar
- **Publish** opens a modal with git diff — correct for git-native product, but breaks Confluence/Notion mental model
- Reader (`doc-panel.ts`) and editor are **different layouts** — mode switch is jarring

Users expect: **one canvas**, type and see formatted text, **Publish** updates the page.

**Constraint (non-negotiable):** `docs/*.md` + frontmatter remain SSOT for MCP. WYSIWYG is a **view/controller** over markdown, not a second format.

## Design north star

> **Confluence page editor** in RepoMind shell: single prose canvas, toolbar, properties rail, Publish.  
> **Notion borrow:** inline title, autosave chip, slash commands (phase 1b).  
> **RepoMind keep:** git publish, diff available, Agent JSON in properties, wikilinks.

## Information architecture (Pass 1 — 8/10 after fix)

### Screen: Visual editor (replaces `workspace-editor`)

```
┌─ Topbar (unchanged) ─────────────────────────────────────────────┐
│ RepoMind · search · Graph · Health · v0.3.0 stats                │
├─ Tree 280px ─┬─ Canvas (flex) ────────────────────┬─ Props 260px ┤
│              │ Breadcrumb: Knowledge › … › Title   │ Page props   │
│              │ ┌─────────────────────────────────┐ │ Status ▾     │
│              │ │ [Title — editable H1 inline]     │ │ Type ▾       │
│              │ │ Saved · 2s ago    [Publish ▾]   │ │ Tags         │
│              │ ├─────────────────────────────────┤ │ Related      │
│              │ │ ▾ Toolbar (sticky on scroll)    │ │ Path (ro)    │
│              │ │ B I link H2 • 1. ☐ {} img …    │ │ Agent tab    │
│              │ ├─────────────────────────────────┤ │              │
│              │ │                                 │ │              │
│              │ │  WYSIWYG body (72ch, centered)  │ │              │
│              │ │  — headings, lists, links,      │ │              │
│              │ │    images, code, callouts       │ │              │
│              │ │                                 │ │              │
│              │ └─────────────────────────────────┘ │              │
└──────────────┴─────────────────────────────────────┴──────────────┘
```

**Hierarchy (what user sees first):**

1. **Title** (28px, editable) — page identity
2. **Save status + Publish** — primary action cluster (top-right of canvas, not global topbar)
3. **Body** — main work area
4. **Toolbar** — appears on focus / selection (secondary)
5. **Properties rail** — metadata (tertiary, collapsed by default on `<1024px`)

**Navigation:** unchanged tree + breadcrumb. Drafts section still lists unpublished work.

### Reader → editor transition

| Approach | Completeness | Notes |
|----------|--------------|-------|
| **A) Same route, swap component** (current) | 7/10 | Keep `e` / Edit; still feels like two apps |
| **B) Unified page shell** (recommended) | 10/10 | One `PageShell`: `mode: read \| edit`. Reader and editor share breadcrumb, title slot, properties rail. Edit toggles `contenteditable` canvas in place. |
| **C) Notion inline always-on** | 6/10 for v1 | Hover "Edit block" everywhere — high scope |

**Decision:** **B** for v1 visual editor. Reader preview and WYSIWYG use same chrome; only center column swaps rendering engine.

## Interaction states (Pass 2 — 9/10)

| Feature | Loading | Empty | Error | Success | Partial |
|---------|---------|-------|-------|---------|---------|
| Open editor | Skeleton title + 3 gray lines | New page: placeholder title "Untitled", body hint "Type / for commands" | Toast + retry; stay on reader | Canvas interactive | Draft loaded but images 404 → inline broken image chip |
| Autosave | "Saving…" muted | — | Toast "Can't save"; keep local buffer | "Saved" / "Saved just now" | Offline: "Pending sync" (future) |
| Wikilink insert | Popover "Searching…" | "No pages" + create link option | — | Chip `[[slug]]` rendered as link | Ambiguous slug → picker |
| Image upload | Progress on insert | — | Toast + remove placeholder | Image inline | >5MB rejected before upload |
| Publish | Button spinner | — | Inline errors: broken related, slug conflict | Toast + navigate to published reader | Diff warnings non-blocking |
| Publish modal (review) | Diff loading | — | — | Confirm enabled | Large diff scroll |

**Empty body:** Not "No content." — use: *"Start writing, or press `/` for headings, lists, and links."* + subtle `#F4F5F7` canvas.

## User journey (Pass 3 — 8/10)

| Step | User does | Feels | Design support |
|------|-----------|-------|----------------|
| 1 | Clicks **Edit** on reader | "I'm still on the same page" | Same title position, same breadcrumb, rail persists |
| 2 | Types in canvas | Flow, not "coding markdown" | WYSIWYG, no pane labels |
| 3 | Inserts link to glossary | Smart, connected | `[[` autocomplete popover (existing logic, new UI) |
| 4 | Sees **Saved** | Safe | Autosave 800ms debounce (keep) |
| 5 | Clicks **Publish** | Confident | Primary blue; default = publish; chevron → "Review changes" |
| 6 | Lands on reader | Done | Published content, highlight flash optional |

**5-second:** formatted text visible immediately.  
**5-minute:** publish without reading diff.  
**5-year:** git history + MCP still trust markdown on disk.

## AI slop risk (Pass 4 — 9/10)

**Classifier:** APP UI.

| Litmus | Answer |
|--------|--------|
| Brand unmistakable | Yes — RepoMind shell, Confluence tokens from `DESIGN.md` |
| Visual anchor | Editable title + white page on `#F4F5F7` |
| Scannable | Breadcrumb + title + toolbar |
| One job per section | Canvas = write; rail = metadata |
| Cards necessary | No card grid; single page surface |
| Motion | Subtle: save status fade, publish success toast only |
| Premium without shadows | Yes — borders `#DFE1E6`, flat surfaces |

**Reject:** centered marketing hero, 3-column feature grid, purple gradients, split-pane "IDE editor" aesthetic.

## Specificity / components (Pass 5)

### Toolbar (sticky, `48px` height)

| Control | Behavior |
|---------|----------|
| Text style ▾ | Paragraph, H1, H2, H3 |
| **B** / *I* | Toggle marks |
| Link | URL or `[[wikilink]]` picker |
| Lists | Bullet, numbered, task |
| Code | Fenced block monospaced 13px |
| Image | Upload → `assets/` (E3 API) |
| `⋯` | Table, horizontal rule, quote (phase 1b) |

Keyboard: `⌘B`, `⌘I`, `⌘K` link. Match Confluence shortcuts where obvious.

### Slash menu `/` (phase 1b, same release if cheap)

| Command | Block |
|---------|-------|
| `/h1` `/h2` | Heading |
| `/bullet` `/todo` | Lists |
| `/code` | Code block |
| `/image` | Upload |
| `/link` | Wikilink |

### Title field

- `contenteditable` or TipTap doc title node
- Syncs to draft `title` + frontmatter `title`
- Slug derived on publish unless user overrides in properties

### Publish control (Confluence-like)

```
[ Publish ▾ ]
  ├─ Publish now          ← default click (primary)
  └─ Review changes…      ← opens diff modal (current modal, simplified)
```

Remove modal as **gate**; make it **optional review**.

### Properties rail

Reuse `page-info` styles. Changes from today:

- Status as **chip + dropdown**, not raw `<select>` in form grid
- **Related:** pill chips with `×`, add via combobox (not comma string)
- Slug: editable with validation hint
- **Agent** tab: read-only JSON (unchanged)

## Responsive (Pass 6)

| Viewport | Behavior |
|----------|----------|
| `≥1280px` | Tree + canvas + properties rail |
| `1024–1279px` | Properties rail collapsed; toggle "Properties" in header |
| `<1024px` | Tree overlay (future); canvas full width; toolbar scroll horizontal |

Touch: toolbar buttons **44×44px** min hit target.

## Accessibility (Pass 7)

- Full keyboard toolbar navigation (`Arrow` + `Tab`)
- `aria-label` on icon buttons
- Publish: `aria-busy` while saving
- Wikilink popover: `role="listbox"`, arrow keys
- Don't rely on hover for toolbar — show on focus in body
- Contrast: body 15px on white ≥ 4.5:1 (`#172B4D`)

## Technical approach (engineering handoff)

### Recommended stack

**TipTap 2** (ProseMirror) + `@tiptap/extension-*` + custom `Wikilink` extension.

| Requirement | TipTap approach |
|-------------|-----------------|
| Markdown round-trip | `tiptap-markdown` or serialize custom → `marked` parity tests |
| `[[slug]]` | Inline atom node; paste/import from markdown regex |
| Images | `Image` extension; `src` = `/api/assets/...` |
| Mermaid | Phase 1: fenced code block with label "mermaid"; Phase 2: live preview block |
| Autosave | `onUpdate` → `updateDraftApi` (existing) |
| Publish | Unchanged `publishDraftApi` — serialize doc → markdown body |

**Out of scope v1:** collaborative cursors, comments, version history UI, Notion databases.

### Files (planned)

| Area | Files |
|------|-------|
| Editor core | `ui/src/visual-editor.ts`, `ui/src/tiptap-wikilink.ts` |
| Shell | `ui/src/page-shell.ts` (unify reader + editor) |
| Serialize | `ui/src/markdown-serialize.ts` |
| Styles | `ui/src/styles.css` — `.visual-canvas`, `.editor-toolbar` |
| Tests | `tests/markdown-roundtrip.test.ts`, `tests/visual-editor-serialize.test.ts` |
| DESIGN.md | Remove "WYSIWYG out of scope"; add Visual Editor section |

### Markdown fidelity gates (kill criteria for ship)

1. Round-trip: corpus of 20 real SFC docs — serialize(parse(md)) === md ± whitespace
2. Wikilinks survive edit save publish
3. `repo-mind check` passes after UI-only edits
4. MCP `get_doc` body matches what user saw in editor

## Phasing

| Phase | Version | Deliverable |
|-------|---------|-------------|
| **VE1** | 0.4.0 | TipTap canvas replaces split editor; toolbar; publish dropdown |
| **VE1b** | 0.4.0 | Unified PageShell reader/edit; properties chips |
| **VE2** | 0.4.1 | Slash menu; tables; mermaid preview block |
| **VE3** | 0.5.0 | Optional inline edit on reader without explicit Edit click |

**Roadmap:** new row `E6 Visual editor` under v4.1 or v4.3 in `docs/product/wiki/roadmap.md`.

## Risks

| Risk | Mitigation |
|------|------------|
| Markdown round-trip loss | Test corpus; fallback "View source" mode (readonly markdown pane) |
| Bundle size (+~150kb) | Lazy-load editor chunk on Edit only |
| Structured yaml/json | Keep structured preview; no WYSIWYG |
| User distrust of hidden markdown | "Review changes" + future "View markdown" in menu |

## Locked decisions

| ID | Decision |
|----|----------|
| D1 | **Publish now** default; diff optional via Publish ▾ |
| D2 | **View markdown** in v1 (menu item) |
| D3 | **TipTap** over Milkdown (Confluence toolbar model) |
| D4 | **PageShell** unifies reader + editor chrome |

---

## GSTACK REVIEW REPORT

| Run | Skill | Status |
|-----|-------|--------|
| 1 | plan-design-review | complete (text-only; mockups blocked — no OpenAI key) |

### Dimension scores

| Dimension | Before | After | Notes |
|-----------|--------|-------|-------|
| Information architecture | 3 | 8 | ASCII layout, hierarchy, unified shell |
| Interaction states | 2 | 9 | State table per feature |
| User journey | 3 | 8 | 6-step storyboard |
| AI slop risk | 5 | 9 | APP UI rules applied |
| Specificity | 2 | 8 | Toolbar, publish, tokens |
| Responsive | 1 | 7 | Breakpoints defined |
| Accessibility | 2 | 7 | Keyboard, ARIA, contrast |

### Findings (critical)

| ID | Severity | Finding | Fix in plan |
|----|----------|---------|-------------|
| F1 | critical | No WYSIWYG — split pane | TipTap single canvas |
| F2 | critical | DESIGN.md excludes WYSIWYG | Update DESIGN.md |
| F3 | high | Publish modal blocks flow | Publish now + optional diff |
| F4 | high | Reader/editor layout mismatch | PageShell unified |
| F5 | medium | Frontmatter as dev form | Chip/combobox properties |
| F6 | medium | No slash commands | VE1b scope |

### VERDICT

**APPROVED FOR ENG SPEC** — ready for `/plan-eng-review` or implementation.

**Resolved (2026-06-23):**

- **D1:** Publish without modal by default; diff via **Publish ▾ → Review changes**
- **D2:** Ship **View markdown** menu item in v1

NO UNRESOLVED DECISIONS
