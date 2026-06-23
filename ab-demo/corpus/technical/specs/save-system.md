---
type: feature-spec
domain: technical
slug: save-system
status: accepted
title: Save System
tags:
  - persistence
updated: 2026-06-22
---

## Summary

Players persist progress in **3 manual save slots** stored as JSON files under the OS app data directory.

## Requirements

- Slot list screen shows timestamp and playtime per slot
- Autosave writes to slot 0 only (quicksave)
- Cloud sync is out of scope for the demo

## Paths

- macOS: `~/Library/Application Support/Caravan/saves/slot-{0,1,2}.json`
- Windows: `%APPDATA%/Caravan/saves/`
