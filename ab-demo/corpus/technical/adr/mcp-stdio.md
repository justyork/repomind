---
type: adr
domain: technical
slug: mcp-stdio
status: accepted
title: MCP over stdio
tags:
  - mcp
  - architecture
updated: 2026-06-21
---

## Context

RepoMind must run inside Cursor and Claude Code without opening inbound ports.

## Decision

Expose MCP tools over **stdio** transport only in v1.

## Consequences

- No HTTP auth surface on localhost
- Agents spawn `repo-mind mcp` as a child process
- HTTP is reserved for the human UI (`repo-mind ui`)
