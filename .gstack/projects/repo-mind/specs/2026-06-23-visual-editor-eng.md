# Visual editor (E6) — engineering spec

**Status:** APPROVED (plan-eng-review)  
**Design:** [2026-06-23-visual-editor-wysiwyg.md](./2026-06-23-visual-editor-wysiwyg.md)  
**Target:** `@justyork/repo-mind` **0.4.0** (PR1), **0.4.1** (PR2)  
**Phasing:** D1 = phased PR1 → PR2 (user confirmed)

## Goal

Replace split Markdown/Preview editor with TipTap WYSIWYG canvas. Markdown on disk remains SSOT. MCP unchanged.

## Non-goals (v1)

- Collaborative editing, comments, version history UI
- WYSIWYG for yaml/json structured docs
- Slash menu, tables, live mermaid preview (PR2 / 0.4.1)
- PageShell reader/editor unification (PR2)

---

## Architecture

### Component diagram

```
┌──────────── main.ts ────────────────────────────────────────────┐
│  doc-panel.ts (read)          editor.ts (edit)                │
│       │                              │                        │
│       │ renderMarkdown               │ renderVisualEditor()   │
│       ▼                              ▼                        │
│  markdown.ts                   visual-editor.ts               │
│  (reader HTML)                 TipTap Editor + toolbar        │
│                                       │                       │
│                                       ▼                       │
│                              markdown-roundtrip.ts            │
│                              parseMarkdown → JSON             │
│                              serializeDoc → markdown body   │
│                                       │                       │
│                                       ▼                       │
│                              updateDraftApi / publishDraftApi │
│                              (unchanged REST)                 │
└───────────────────────────────────────────────────────────────┘
```

### Data flow (edit → publish)

```
User types in TipTap
    → onUpdate (debounce 800ms)
    → serializeDoc(editor) → draft.body (markdown string)
    → PUT /api/drafts/:id

User clicks Publish
    → flushPendingSave()          // await in-flight autosave
    → PUT /api/drafts/:id         // final body
    → POST /api/drafts/:id/publish
    → publish.ts writes docs/*.md via gray-matter
    → DocIndex refresh → MCP reads same file
```

### Dependency choice: TipTap 2 **[Layer 1]**

Do not build `contenteditable` + `document.execCommand`. TipTap/ProseMirror is the boring default for block editors with extensions.

**Do not use `tiptap-markdown` alone** for round-trip: it will not preserve `[[wikilinks]]` and task-list GFM quirks RepoMind already handles in `markdown.ts`. Use:

- **Parse:** TipTap `StarterKit` + custom extensions; initial content from markdown via custom parser (regex + marked lexer for blocks, or `prosemirror-markdown` with custom token handlers)
- **Serialize:** custom `serializeDocToMarkdown(doc: JSONContent): string` mirroring reader output conventions

### Wikilink single source of truth

Extract regex to `ui/src/wikilink-syntax.ts`:

```typescript
export const WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
export function parseWikilink(match): { display: string; slug: string };
```

Import from `markdown.ts`, `wikilink-autocomplete.ts`, `markdown-roundtrip.ts`, TipTap wikilink extension. **DRY fix required.**

### TipTap extensions (PR1)

| Extension | Purpose |
|-----------|---------|
| `@tiptap/starter-kit` | Headings, bold, italic, lists, code block, blockquote, hr |
| `@tiptap/extension-link` | External URLs |
| `@tiptap/extension-image` | `/api/assets/...` images |
| `@tiptap/extension-placeholder` | Empty state copy |
| `@tiptap/extension-task-list` + `task-item` | GFM tasks (match reader) |
| **Custom `Wikilink`** | Inline atom `[[slug\|label]]` |

### Bundle / lazy load

```typescript
// main.ts or editor.ts
const { mountVisualEditor } = await import('./visual-editor.js');
```

Vite `manualChunks`:

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: { editor: ['@tiptap/core', '@tiptap/starter-kit', /* ... */] },
    },
  },
},
```

Target: main bundle stays near current size; editor chunk ~120–180kb gzip loaded only on Edit.

### Publish UX (locked D1)

```typescript
// editor.ts header actions
publishBtn.onclick → publishNow();           // default
publishMenu.review → openDiffModal();        // existing modal, simplified
viewMarkdownBtn → openReadonlyMdModal();     // locked D2
```

`publishNow()` must call `flushPendingSave()` before `publishDraftApi`.

### View markdown (D2)

Read-only modal or slide-over showing `serializeDocToMarkdown(editor.getJSON())` with copy button. Does not allow edit in v1 (avoid dual-write).

---

## PR1 file plan (0.4.0)

| File | Action |
|------|--------|
| `package.json` | Add TipTap deps |
| `ui/vite.config.ts` | `manualChunks` for editor |
| `ui/src/wikilink-syntax.ts` | **new** — shared regex/helpers |
| `ui/src/markdown-roundtrip.ts` | **new** — parse + serialize |
| `ui/src/tiptap-wikilink.ts` | **new** — TipTap node + autocomplete UI |
| `ui/src/visual-editor.ts` | **new** — mount, toolbar, autosave hook |
| `ui/src/editor.ts` | Refactor: drop split panes, wire visual-editor + publish dropdown |
| `ui/src/markdown.ts` | Import WIKILINK_PATTERN from wikilink-syntax |
| `ui/src/wikilink-autocomplete.ts` | Import shared syntax; retire textarea binding in editor path |
| `ui/src/markdown-toolbar.ts` | **delete** or keep only if view-md modal needs it |
| `ui/src/styles.css` | `.visual-canvas`, toolbar, publish split button |
| `DESIGN.md` | Add Visual Editor section; remove WYSIWYG out-of-scope |
| `tests/markdown-roundtrip.test.ts` | **new** — corpus round-trip |
| `tests/wikilink-syntax.test.ts` | **new** — parse edge cases |
| `docs/product/wiki/roadmap.md` | E6 row |

**PR1 does not touch:** `doc-panel.ts`, `page-shell.ts` (deferred PR2).

---

## PR2 file plan (0.4.1)

| File | Action |
|------|--------|
| `ui/src/page-shell.ts` | **new** — shared layout: breadcrumb, title slot, actions, rail |
| `ui/src/doc-panel.ts` | Use PageShell read mode |
| `ui/src/editor.ts` | Use PageShell edit mode |
| Properties rail | Chip UI for tags/related/status |

---

## Edge cases (explicit)

| Case | Behavior |
|------|----------|
| Publish while autosave in flight | `await flushPendingSave()`; disable Publish with `aria-busy` |
| Autosave fails | Toast; keep TipTap state; retry on next keystroke |
| Round-trip adds/removes blank lines | Normalize in tests; document acceptable drift |
| `[[broken-slug]]` in body | Allowed in editor; `check` fails on publish (existing validateDraftForPublish) |
| Mermaid block | Serialize as ` ```mermaid ` fence; no live preview in PR1 |
| Paste from Word/Google Docs | TipTap default paste; strip unsafe HTML (StarterKit) |
| yaml/json doc Edit | No change — hide Edit button (existing `doc-panel.ts`) |
| Large doc (50kb body) | TipTap handles; autosave debounce unchanged |
| Image upload during edit | Reuse `uploadAsset()` → insert Image node |

---

## Security

- TipTap strips script tags on paste (verify in test)
- Image upload already guarded (`upload-asset.ts` assets/ only)
- No new server endpoints in PR1

---

## Performance

| Concern | Mitigation |
|---------|------------|
| +150kb editor JS | Lazy chunk on Edit only |
| `onUpdate` per keystroke | Keep 800ms debounce; serialize only on debounce + publish flush |
| Mermaid in editor | Do not call `enhanceMarkdownPreview` in TipTap path |

---

## Test plan summary

See [york-main-visual-editor-test-plan-20260623.md](../york-main-visual-editor-test-plan-20260623.md).

### Kill gates (ship blockers)

1. `tests/markdown-roundtrip.test.ts` — ≥20 fixture docs, wikilinks + tasks + images + code fences
2. `repo-mind check` passes after edit→publish cycle in `tests/ui-api.test.ts` extension
3. Wikilink survives: edit existing doc with `[[caravan]]`, publish, `get_doc` unchanged slug refs

---

## Implementation order (PR1)

1. `wikilink-syntax.ts` + tests (extract from markdown.ts)
2. `markdown-roundtrip.ts` + corpus tests (TDD)
3. TipTap deps + `tiptap-wikilink.ts`
4. `visual-editor.ts` + styles
5. Refactor `editor.ts` (remove split, publish dropdown, view md)
6. Vite chunk split + manual smoke `repo-mind ui`
7. DESIGN.md + roadmap

---

## GSTACK REVIEW REPORT

| Run | Skill | Status |
|-----|-------|--------|
| 1 | plan-design-review | complete |
| 2 | plan-eng-review | complete |

### Section scores

| Section | Rating | Top issues |
|---------|--------|------------|
| Architecture | 8/10 | Custom serializer required; autosave flush before publish |
| Code quality | 7/10 | WIKILINK_PATTERN triplicated — extract shared module |
| Tests | 6/10 → 9/10 planned | Round-trip corpus is kill gate; ui-api publish extension |
| Performance | 8/10 | Lazy chunk mandatory |

### Findings

| ID | Sev | Conf | Finding | Resolution |
|----|-----|------|---------|------------|
| E1 | P0 | 9/10 | `tiptap-markdown` alone breaks `[[wikilinks]]` | Custom `markdown-roundtrip.ts` |
| E2 | P1 | 9/10 | Publish during autosave race | `flushPendingSave()` before publish |
| E3 | P1 | 8/10 | WIKILINK_PATTERN in `markdown.ts:21` and `wikilink-autocomplete.ts:6` | `wikilink-syntax.ts` |
| E4 | P1 | 8/10 | 10+ files triggers scope smell | Phased PR1/PR2 (D1 accepted) |
| E5 | P2 | 8/10 | Main bundle bloat if TipTap not chunked | `manualChunks` + dynamic import |
| E6 | P2 | 7/10 | Task list HTML in reader uses custom marked renderer | Serializer must emit `- [ ]` GFM |

### Outside voice

Codex not run (optional; user can request `/codex review` on spec).

### VERDICT

**APPROVED FOR IMPLEMENTATION** — start PR1 (`feat/visual-editor-pr1`).

**Resolved:**

- D1: Phased PR1 (TipTap core) → PR2 (PageShell)
- Design D1–D4 carry forward (publish now, view md, TipTap, PageShell in PR2)

NO UNRESOLVED DECISIONS
