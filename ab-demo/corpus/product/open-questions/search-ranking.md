---
type: open-question
domain: product
slug: search-ranking
status: proposed
title: Search ranking behavior
tags:
  - search
  - mcp
related:
  - mcp
updated: 2026-06-22
---

## Question

Should `search_docs` rank by title match only, or also body text and `related:` graph distance?

## Options considered

1. **Title + slug substring** (current v1) — fast, predictable
2. **Body grep + title boost** — better recall, noisier
3. **Graph-weighted** — use `explore_graph` scores as reranker

## Decision

**Undecided.** A/B demo will show whether agents struggle with ranking on this corpus.
