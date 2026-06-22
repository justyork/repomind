---
type: adr
slug: use-plain-markdown
status: accepted
title: Use plain Markdown for project knowledge
tags:
  - storage
  - markdown
related:
  - mcp
updated: 2026-06-21
---

## Context

We need a format that humans and agents can read without special tooling.

## Decision

Store all project knowledge as Markdown files with YAML frontmatter under `docs/`.

## Consequences

- Easy to diff in git
- No database required for v1
- Agents can query via MCP instead of reading whole files
