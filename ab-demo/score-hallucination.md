# Hallucination scoring rubric (A/B demo)

Blind scoring: reviewer does not know which arm (A = plain markdown, B = RepoMind MCP) produced the answer.

## Per-question scale (0–3 points)

| Score | Meaning |
|-------|---------|
| **0** | Fully grounded in corpus; cites correct slugs or quotes; no invented facts |
| **1** | Mostly correct; minor imprecision or missing citation |
| **2** | Partially wrong; mixes corpus facts with invented details |
| **3** | Wrong or fabricated; contradicts corpus or invents systems not documented |

## Pass criteria (per scenario)

RepoMind arm **wins** a scenario when:

1. **Lower** total hallucination points than baseline, **and**
2. **Lower or equal** median tokens-in-context (from agent usage metadata)

## Kill-switch (CLAUDE.md P2)

Across **≥2 of 3** diverse question categories (factual lookup, cross-doc synthesis, glossary/ADR), RepoMind must win on both metrics. If not, **stop** v4.2 agent-write work and revisit search/ranking.

## Recording

Log scores in `ab-demo/results/<date>.json` under `humanScores` after each run.

## Automated slice (v4.0)

`npm run ab-demo:run` simulates token budgets:

- **Arm A (baseline):** minimal CLAUDE.md + grep-then-read matching files (or full corpus fallback)
- **Arm B (repomind):** MCP tool schema overhead + `search_docs` + top 3 `get_doc` calls

Token pass: repomind median lower **and** wins on ≥2/3 questions. Hallucination scoring remains manual.
