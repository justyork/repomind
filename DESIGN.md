# RepoMind Design System — Confluence Light (UI-4)

**Status:** APPROVED  
**Direction:** Confluence-inspired wiki shell — catalog tree, page canvas, page info rail  
**Memorable thing:** Git-native wiki where humans and agents read the same knowledge.

## Visual thesis

Light, structured, trustworthy. Hierarchy through **catalogs and pages**, not filters and dark chrome. Color is rare; typography and spacing carry wayfinding.

## Tokens

```css
--rm-bg: #FFFFFF;
--rm-bg-subtle: #F7F8FA;
--rm-bg-sidebar: #FFFFFF;
--rm-border: #E4E6EA;
--rm-border-strong: #C1C7D0;
--rm-text: #172B4D;
--rm-text-muted: #626F86;
--rm-text-subtle: #8590A2;
--rm-accent: #0C66E4;
--rm-accent-hover: #0055CC;
--rm-accent-subtle: #E9F2FF;
--rm-success: #216E4E;
--rm-warning: #974F0C;
--rm-danger: #AE2E24;
--rm-radius: 6px;
--rm-space-1: 4px;
--rm-space-2: 8px;
--rm-space-3: 12px;
--rm-space-4: 16px;
--rm-space-5: 24px;
--rm-space-6: 32px;
--rm-sidebar-width: 280px;
--rm-info-width: 260px;
--rm-content-max: 72ch;
```

## Typography

| Role | Stack | Size |
|------|-------|------|
| UI | system-ui, -apple-system, "Segoe UI", sans-serif | 14px base |
| Page title | same, 600 weight | 28px |
| Catalog header | same, 600 weight | 12px uppercase, letter-spacing 0.04em |
| Body (markdown) | same | 15px / 1.6 line-height |
| Code | ui-monospace, "SF Mono", Menlo, monospace | 13px |

## Layout

```
┌ Topbar: brand · search · Graph · Health · stats ─────────────┐
├ Sidebar (catalog tree) │ Page canvas │ Page info (optional) ┤
└────────────────────────┴─────────────┴───────────────────────┘
```

- **Sidebar:** expandable catalogs mapped from `type` → folder (ADR, Specs, Glossary…). Drafts as separate root section.
- **Breadcrumb:** `Knowledge › {Catalog} › {Title}`
- **Page canvas:** document or editor; max readable width ~72ch for prose.
- **Page info rail:** status, tags, related, path, Agent JSON tab — collapses on narrow viewports.

## Catalog labels

| `type` | Label |
|--------|-------|
| `adr` | ADR |
| `feature-spec` | Feature specs |
| `glossary-term` | Glossary |
| `open-question` | Open questions |
| `agent-instruction` | Agent instructions |

## Components

- **Tree row:** chevron + outline icon + label; 6px row radius; hover uses accent-subtle fill.
- **Page row:** outline file icon (accent stroke) + title (truncate), status chip when not `accepted`.
- **Breadcrumb:** muted parents, current page bold; parents clickable.
- **Search dropdown:** grouped by catalog; keyboard-friendly list.

## Icons (v0.7+ refresh)

**Style:** outline stroke SVG (Lucide-inspired), not filled shapes or emoji for default tree nodes.

| Token | Value |
|-------|-------|
| Stroke width | `1.25px` (`--icon-stroke`) |
| Folder color | `--icon-fg` (#626F86 light) |
| Page color | `--accent` (#0C66E4 light) |
| Size | 16×16 in 18×18 hit box |

- **Folder:** open-folder outline; custom `emoji` in frontmatter still overrides.
- **Page:** file-with-fold outline; JSON/YAML get extra stroke hints inside the file.
- **Catalog sidebar:** letter badges remain for type grouping; folder catalog rows use muted icon color without filled pill.

Implementation: `ui/src/tree-icons.ts`, styles in `ui/src/styles.css` (`.tree-outline-icon`).

## Safe choices (category baseline)

- Light neutral surfaces and blue primary (Confluence literacy).
- Left tree + center content (wiki convention).
- Breadcrumb wayfinding.

## Risks (product differentiation)

1. **Agent JSON in page info rail** — Confluence has labels; we expose MCP shape beside human view.
2. **Drafts as first-class catalog** — unpublished work visible but separated from published tree.
3. **Graph on separate full page** — spatial view without splitting the reading canvas.

## Out of scope (UI-4)

- Dark theme toggle (future).
- Nested folders beyond `type` (until disk layout supports it).
- Comments, permissions.

## Visual editor (E6, v0.4.0)

- **Edit mode:** single TipTap WYSIWYG canvas (no Markdown/Preview split). Body serializes to markdown on disk.
- **Publish:** primary action publishes immediately; **Publish ▾ → Review changes** opens diff modal.
- **View markdown:** read-only modal with serialized body (escape hatch).
- **Lazy load:** TipTap bundle loads only when opening the editor.
- **PR2 (0.4.1):** PageShell unification, properties chips, slash menu.
- **VE2 (0.4.2):** GFM tables in editor; mermaid live preview block.

## References

- Approved workspace design: `.gstack/projects/repo-mind/york-main-design-20260621-203318-ui-knowledge-workspace.md`
- Implementation spec: `.gstack/projects/repo-mind/specs/2026-06-21-repomind-ui-4-confluence-shell.md`
