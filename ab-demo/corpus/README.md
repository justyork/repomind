# Caravan — demo knowledge base

This corpus is a **seeded fixture** for the RepoMind A/B kill-switch harness (`ab-demo/`).
It simulates a small game project knowledge base (~15 pages).

Domains:

- `product/` — roadmap and open questions
- `technical/` — architecture, ADR, specs
- `game-design/` — combat and mechanics
- `shared/` — glossary and agent instructions

Run `npm run ab-demo -- --dry-run` to validate slugs against `questions.json`.
