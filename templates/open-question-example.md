---
type: open-question
domain: product
slug: search-ranking
status: draft
title: Is grep ranking good enough?
tags:
  - search
  - performance
related:
  - mcp
updated: 2026-06-21
---

## Question

Should v1 ship with simple grep-based ranking, or invest in SQLite FTS early?

## Options

1. Grep + scoring formula (current v1 plan)
2. SQLite FTS index (Approach B)

## Decision criteria

Run the A/B kill-switch demo. Upgrade only if ranking quality blocks adoption.
