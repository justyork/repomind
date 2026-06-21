# gstack project state (RepoMind)

This directory is the project-local `GSTACK_HOME` for repo-mind. Set `GSTACK_HOME=.gstack` when working in this repository (see `.env`).

## Layout

```
.gstack/
├── projects/repo-mind/     # Design docs, test plans, learnings, checkpoints
│   ├── york-repomind-design-20260621.md
│   └── york-repomind-eng-review-test-plan-20260621.md
├── plans/                  # Saved plans (fallback for /context-save, /ship)
└── tmp/                    # Ephemeral files (gitignored)
```

`~/.gstack/projects/repo-mind` is a symlink to `.gstack/projects/repo-mind` so skills that hardcode the global path still resolve artifacts here.

Tracked in git: `projects/`, `plans/`. Ignored: `tmp/`, `sessions/`, `analytics/`.
