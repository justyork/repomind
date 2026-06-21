# RepoMind — project instructions for AI agents

Read this file first. RepoMind is an open-source MCP server that gives coding agents queryable access to project knowledge stored in `.project-knowledge/` inside the repository.

## Project context

- **Vision:** [`idea.md`](idea.md) — full product spec (Russian).
- **Approved v1 design:** [`.gstack/projects/repo-mind/york-repomind-design-20260621.md`](.gstack/projects/repo-mind/york-repomind-design-20260621.md) — Approach A (MCP-only, frontmatter-as-index). Status: APPROVED.
- **Test plan:** [`.gstack/projects/repo-mind/york-repomind-eng-review-test-plan-20260621.md`](.gstack/projects/repo-mind/york-repomind-eng-review-test-plan-20260621.md).
- **Stack (planned):** TypeScript, Node, vitest, `@modelcontextprotocol/sdk`, `gray-matter`, `fast-glob`, `minimatch`.
- **Kill-switch (P2):** A/B demo must show RepoMind beats plain markdown + CLAUDE.md on tokens and hallucinations. If not, stop.

## gstack (recommended)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted workflows.

Install (once per machine):

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --host cursor
```

Project state lives in `.gstack/` (set `GSTACK_HOME=.gstack` — see `.env`). Design docs, plans, learnings, and checkpoints go under `.gstack/projects/repo-mind/`.

Use `~/.claude/skills/gstack/...` for gstack file paths. In Cursor, gstack skills are available globally after setup.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:

- Product ideas/brainstorming → invoke `/office-hours`
- Strategy/scope → invoke `/plan-ceo-review`
- Architecture → invoke `/plan-eng-review`
- Design system/plan review → invoke `/design-consultation` or `/plan-design-review`
- Full review pipeline → invoke `/autoplan`
- Bugs/errors → invoke `/investigate`
- QA/testing site behavior → invoke `/qa` or `/qa-only`
- Code review/diff check → invoke `/review`
- Visual polish → invoke `/design-review`
- Ship/deploy/PR → invoke `/ship` or `/land-and-deploy`
- Save progress → invoke `/context-save`
- Resume context → invoke `/context-restore`
- Author a backlog-ready spec/issue → invoke `/spec`

## Conventions

- Keep imports at the top of files.
- Use exhaustive switch handling for TypeScript unions and enums.
- Minimize scope — match existing patterns when code exists.
- Comments in English, Better Comments style when needed.

## Effort estimates (AI-compression)

| Size | Meaning |
|------|---------|
| S | Hours — single module, straightforward |
| M | 1–2 days — multiple modules, some integration |
| L | Multi-day — cross-cutting, new subsystem |

<!-- repo-mind -->
Prefer repo-mind `search_docs` / `get_doc` over reading docs/ directly.
<!-- /repo-mind -->
