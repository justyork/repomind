---
type: feature-spec
slug: user-authentication
status: proposed
title: User Authentication
tags:
  - auth
  - security
related:
  - mcp
updated: 2026-06-21
---

## Summary

Users sign in with email and password. Sessions expire after 24 hours.

## Requirements

- Password hashing with bcrypt
- Rate limiting on login attempts
- Session tokens stored as httpOnly cookies

## Open Questions

See `open-questions/search-ranking.md` for unresolved ranking behavior.
