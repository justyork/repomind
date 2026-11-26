---
type: wiki-page
domain: technical
slug: release-process
status: accepted
title: Release Process
tags:
  - release
  - operations
related:
  - architecture
updated: 2026-06-24
---

## Overview

This page describes how a change travels from a merged pull request to every player. The process favours small, frequent releases with an automatic way back. Anyone on the engineering rota can run a release by following the checklist below; no single person owns the pipeline.

## Branching model

Development happens on short-lived feature branches that merge into main through pull requests. Main is always releasable: continuous integration must be green before merge, and a failing main blocks every other merge until it is fixed or reverted.

Release branches are cut from main every second Tuesday and named after the version, for example release/1.8. Only fixes may land on a release branch; new features wait for the next cut. Branches are deleted two releases after they ship.

## Versioning

Versions follow semantic versioning. Breaking changes to save files or the MCP tool contract bump the major number, new features bump the minor number, and fixes bump the patch number. The version lives in a single VERSION file and is stamped into build artefacts by the pipeline.

Save-file format changes always require a migration and a major or minor bump, never a patch. The release checklist includes loading a save from the previous release to prove the migration works.

## Release checklist

1. Confirm continuous integration is green on the release branch and the changelog is updated.
2. Run the save-compatibility test against the previous release.
3. Build release artefacts and verify the stamped version matches the VERSION file.
4. Publish to the canary channel and watch the dashboards for 30 minutes.
5. Promote to everyone only if the canary shows no new crash signatures.

The rota engineer records the checklist result in the release ticket so a reviewer can audit the decision later.

## Canary and rollout

The canary channel receives 5 percent of players, chosen by a stable hash of the account id so the same players stay in the canary across releases. After the 30 minute watch the rollout widens to 25 percent, then 100 percent after two hours with no regressions.

Rollback is a configuration flip that points the channel back at the previous artefact. It takes under 10 minutes and does not require a rebuild. The rollback trigger is any of: crash rate above 1 percent of sessions, a failed save migration reported by two or more players, or a payment failure spike.

## Hotfixes

A hotfix is any fix that cannot wait for the next scheduled release. Hotfixes are approved by the engineering lead or, out of hours, by the on-call engineer together with one reviewer. The target is to ship within 4 hours of approval.

Hotfixes skip the second Tuesday cut but never skip the canary: they go to the canary channel first and the watch window shortens to 15 minutes. Every hotfix must be merged back into main the same day to avoid regressions in the next release.

## Changelog and communication

The changelog is written for players, not engineers. Each entry names the visible effect first and the technical cause second, if at all. The release manager posts the changelog to the community channel when the rollout reaches 100 percent.
