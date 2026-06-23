---
type: wiki-page
domain: technical
slug: architecture
status: accepted
title: System architecture
tags:
  - architecture
related:
  - mcp-stdio
  - save-system
updated: 2026-06-22
---

## Overview

Caravan is a single-player Unity client with a local SQLite cache. Game design docs live in `docs/` and are queried by agents via RepoMind MCP.

## Components

| Layer | Responsibility |
|-------|----------------|
| Client | Gameplay, UI, save I/O |
| Docs | Human + agent knowledge (`docs/`) |
| RepoMind | Index, search, MCP tools |
