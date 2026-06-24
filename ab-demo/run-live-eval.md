# Live A/B eval runbook (skyforge dogfood)

Blind scoring protocol for **v4.0 B2b** on `~/www/GAMEDEV/skyforge-caravan`.

## Prerequisites

- `docs/` indexed; `repo-mind check` exits 0
- RepoMind built: `npm run build`
- Optional: real agent transcript JSONL files for token overrides

## 1. Validate questions

```bash
cd /path/to/repo-mind
npm run build
node dist/cli.js ab-eval \
  --cwd ~/www/GAMEDEV/skyforge-caravan \
  --dry-run
```

Fix any missing `anchorSlugs` in `ab-demo/skyforge-questions.json`.

## 2. Run live eval

```bash
node dist/cli.js ab-eval \
  --cwd ~/www/GAMEDEV/skyforge-caravan \
  --output ab-demo/results/skyforge-$(date +%Y%m%d).json
```

Outputs:

- `ab-demo/results/skyforge-YYYYMMDD.json` — full results + retrieval excerpts
- `ab-demo/results/skyforge-YYYYMMDD-blind.md` — blind review pack (Answer A / B)

Optional transcript token override:

```bash
node dist/cli.js ab-eval \
  --cwd ~/www/GAMEDEV/skyforge-caravan \
  --baseline-transcript /path/to/baseline.jsonl \
  --repomind-transcript /path/to/repomind.jsonl
```

## 3. Blind hallucination scoring

1. Open `-blind.md` without looking at the JSON (no arm labels).
2. Score each Answer A and B using `ab-demo/score-hallucination.md` (0–3).
3. Record scores in `ab-demo/results/skyforge-scores.json`:

```json
[
  { "questionId": "caravan-definition", "baseline": 1, "repomind": 0 },
  { "questionId": "expedition-flow", "baseline": 2, "repomind": 0 }
]
```

## 4. Merge scores and compute pass

```bash
node dist/cli.js ab-eval \
  --record-scores ab-demo/results/skyforge-YYYYMMDD.json \
  --scores ab-demo/results/skyforge-scores.json
```

Kill-switch **pass** requires:

- `tokenPass: true` (RepoMind lower median tokens + ≥2/3 question wins)
- `hallucinationPass: true` (RepoMind wins on **both** metrics in ≥2 of 3 categories: factual, synthesis, glossary-adr)

## 5. Sign-off

- Update `docs/product/wiki/roadmap.md` B2b row
- Copy final `pass` into dogfood checklist
- If `pass: false`, log issues in `docs/product/wiki/improvements.md` and stop v4.2 agent-write reliance on gate
