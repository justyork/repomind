---
type: agent-instruction
slug: query-first
status: accepted
title: Query project knowledge before reading files
tags:
  - agents
  - workflow
related:
  - mcp
updated: 2026-06-21
---

When answering project questions:

1. Call `search_docs` or `get_glossary_term` first
2. Use `get_doc` for the specific slug you need
3. Use `explore_graph` to understand related decisions
4. Only read raw markdown files if MCP tools return no results
