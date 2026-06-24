# Spec: RepoMind v4.0 Prove closure

Status: **APPROVED** (spec skill 2026-06-24)
Branch: `main` (dogfood/eval); `feat/e4-create-draft` stays gated
CEO plan: `.gstack/projects/repo-mind/ceo-plans/2026-06-22-repomind-v4-prove-and-expand.md`
Eng spec: `.gstack/projects/repo-mind/specs/2026-06-22-repomind-v4-prove-and-expand.md`

## Goal

Close v4.0 Prove (B1 dogfood + B2b live hallucination gate) on **skyforge-caravan**, ship **npm 0.6.0**, record kill-switch pass/fail. Unblocks v4.2 agent write only if `pass: true`.

## Context

RepoMind v4.1 UX shipped (0.5.1). v4.2 agent write (`feat/e4-create-draft`) is gated on kill-switch P2. Token comparison passes on synthetic corpus (`ab-demo/results/latest.json`: median 792 vs 71). Hallucination scoring and dogfood remain open.

**Who:** dogfood owner (solo dev), AI agents on skyforge-caravan (147 md files, `check` clean, `.cursor/mcp.json` present).

## Current State (verified 2026-06-24)

| Artifact | State |
|----------|-------|
| `docs/technical/specs/dogfood-skyforge-checklist.md` | 0/35 P0 checked; daily log empty |
| `ab-demo/results/latest.json` | `tokenPass: true`, `hallucinationPass: null`, `pass: null` |
| `ab-demo/score-hallucination.md` | Rubric exists; `humanScores` manual only |
| `src/ab-demo/types.ts` | No `humanScores` type |
| `src/ab-demo/run-arms.ts` | Token simulation only (not live agent) |
| `docs/product/wiki/improvements.md` | Empty |
| `docs/product/wiki/roadmap.md` | B1 in progress, B2b pending; version stale (0.4.2) |

## Scope (locked in spec interview)

| Decision | Choice |
|----------|--------|
| Dogfood duration | Full 7 days |
| Hallucination corpus | skyforge-caravan live docs |
| P0 blockers | Fix in same iteration |
| npm release | 0.6.0 = v4.0 Prove shipped |
| Eval engineering | Full live harness |

## Proposed Change

### Timeline

```
Day 1: pin version, setup, harness smoke test
Days 1–7: daily dogfood (P0 checklist + daily log)
Days 3–5: live eval runs (baseline + repomind per question)
Day 6: blind hallucination scoring + pass calculation
Day 7: sign-off, roadmap update, npm 0.6.0
```

### A. Live eval harness (new)

| File | Change |
|------|--------|
| `ab-demo/skyforge-questions.json` | 6–9 prompts with anchorSlugs from skyforge docs |
| `src/ab-demo/types.ts` | `HumanScore`, `LiveEvalRun`, `humanScores` on results |
| `src/ab-demo/live-eval.ts` | Orchestrate both arms per question on `--cwd` |
| `src/ab-demo/live-baseline.ts` | Baseline arm: CLAUDE.md + grep-read from docs/ |
| `src/ab-demo/live-repomind.ts` | Repomind arm: search_docs → get_doc via DocIndex |
| `src/ab-demo/record-transcript.ts` | Parse agent transcript for token usage |
| `src/ab-demo/compute-pass.ts` | tokenPass + hallucinationPass → pass |
| `src/commands/ab-eval.ts` | CLI `repo-mind ab-eval` |
| `src/cli.ts` | Register ab-eval command |
| `package.json` | Script `ab-eval:live` |
| `tests/ab-eval.test.ts` | Pass calculator, transcript parser, validation |
| `ab-demo/run-live-eval.md` | Blind scoring runbook |

**Harness flow:**

1. `repo-mind ab-eval --cwd ~/www/GAMEDEV/skyforge-caravan` validates questions.
2. Per question: run baseline + repomind; write `ab-demo/results/skyforge-<date>.json`.
3. Export blind review pack (`skyforge-<date>-blind.md`).
4. `repo-mind ab-eval --record-scores <file>` merges humanScores and computes pass.

**Kill-switch categories (need win on ≥2/3):** factual lookup, cross-doc synthesis, glossary/ADR.

### B. Dogfood execution

| File | Change |
|------|--------|
| `docs/technical/specs/dogfood-skyforge-checklist.md` | P0 checks, daily log, sign-off |
| `docs/product/wiki/improvements.md` | Friction entries |
| `docs/product/wiki/roadmap.md` | B1/B2b status, kill-switch outcome, 0.6.0 |
| `README.md` | Status sync |

### C. P0 bugfixes (conditional)

Any dogfood P0 blocker → fix in repo-mind same iteration with vitest + skyforge re-check.

### D. Release

`package.json` → `0.6.0`; publish `@justyork/repo-mind@0.6.0` after sign-off.

## Acceptance Criteria

1. All 35 P0 rows in dogfood checklist checked on skyforge with repo-mind 0.6.0.
2. Seven daily log rows filled; zero unresolved P0 blockers.
3. `repo-mind check` exit 0 on skyforge docs/.
4. Live eval: ≥6 questions, ≥3 categories; results in `ab-demo/results/skyforge-*.json`.
5. Blind hallucination scoring completed; humanScores recorded; pass computed.
6. Roadmap records kill-switch pass or fail with next steps.
7. `npm test` green including new ab-eval tests.
8. npm 0.6.0 published.

## Testing Plan

| Layer | What | Count |
|-------|------|-------|
| Unit | compute-pass rubric scenarios | +8 |
| Unit | Transcript token parser | +5 |
| Unit | Question anchor validation | +3 |
| Integration | ab-eval --dry-run on skyforge | +1 |
| Manual | Full dogfood P0 matrix | 35 |
| Manual | Blind scoring session | 1 |

## Rollback

- SFC docs changes → git revert in skyforge repo.
- Kill-switch fail → do not merge feat/e4-create-draft.
- Critical 0.6.0 bug → 0.6.1 patch.

## Effort

| Component | Size |
|-----------|------|
| Live eval harness | M (1–2 days) |
| Skyforge questions | S (2–4h) |
| 7-day dogfood | M (human) |
| P0 fixes buffer | S–M |
| Scoring + release | S |
| **Total** | ~1.5–2 weeks |

## Out of Scope

- E4 create_draft / E5 publish --pr merge
- VE3 inline edit, type icons, link cascade
- Automated hallucination scoring
- Synthetic ab-demo/corpus re-run for B2b
- Confluence import, cloud, auth

## Dependency Graph

```
Harness (ab-eval) ──┬──> Live eval runs (day 3–5)
                    └──> Blind scoring (day 6)
Dogfood (days 1–7) ──────> P0 fixes (as needed)
Both ────────────────────> Sign-off + roadmap + npm 0.6.0
pass:true ───────────────> v4.2 iteration (separate spec)
```
