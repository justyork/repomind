# Spec: RepoMind UI-4 — Confluence Light Shell

**Status:** APPROVED  
**Generated:** 2026-06-21  
**Depends on:** UI-3, `DESIGN.md`

## Goal

Confluence-like navigation: catalog tree sidebar, breadcrumb, page canvas, page info rail, light theme.

## Scope

- Catalog tree grouped by `type` with expand/collapse
- Global search in topbar with dropdown
- Breadcrumb on doc view
- Page info rail (status, tags, related, frontmatter/agent tabs)
- Light design tokens per `DESIGN.md`
- Graph page inherits light shell tokens

## Out of scope

- Nested folders beyond type
- Dark theme toggle
- Right rail on editor mode (editor stays full width)

## Acceptance

- [ ] Sidebar shows ADR / Specs / Glossary / … catalogs with page lists
- [ ] Breadcrumb: Knowledge › Catalog › Title
- [ ] Search in topbar returns grouped results
- [ ] Light theme applied workspace-wide
- [ ] Mobile: sidebar collapses height, page info stacks below content
