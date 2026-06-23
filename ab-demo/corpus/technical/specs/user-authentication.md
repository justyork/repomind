---
type: feature-spec
domain: technical
slug: user-authentication
status: proposed
title: User Authentication
tags:
  - auth
updated: 2026-06-22
---

## Summary

Optional online accounts for leaderboard sync. Offline play remains fully supported.

## Session policy

- Password hashing with bcrypt
- Sessions expire after **24 hours** of inactivity
- Refresh tokens rotate on each login

## Out of scope

- OAuth providers (deferred to beta)
