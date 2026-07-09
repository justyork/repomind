#!/usr/bin/env node
import { runAbEval } from './commands/ab-eval.js';
import { runCheck } from './commands/check.js';
import { runExport } from './commands/export.js';
import { runInit } from './commands/init.js';
import { runInstallSkill } from './commands/install-skill.js';
import { runPrepare } from './commands/prepare.js';
import { runPublish } from './commands/publish.js';
import { runSetup } from './commands/setup.js';
import { runSyncLinks } from './commands/sync-links.js';
import { runUi } from './commands/ui.js';
import { startMcpServer } from './mcp/server.js';

function printHelp(): void {
  console.log(`repo-mind — unified docs workspace for humans and AI agents

Usage:
  repo-mind init [--cwd <dir>]
  repo-mind setup [--cursor] [--claude] [--force]
  repo-mind install-skill [--cwd <dir>] [--global] [--force]
  repo-mind check [--cwd <dir>]
  repo-mind export [--force] [--cwd <dir>]
  repo-mind prepare [--all] [--dry-run] [--cwd <dir>] [relative-path]
  repo-mind sync-links [--dry-run] [--no-convert-body] [--no-sync-related] [--cwd <dir>]
  repo-mind publish [--pr] [--dry-run] [--draft <id>] [--message <text>] [--title <text>] [--body <text>] [--cwd <dir>]
  repo-mind ab-eval --cwd <dir> [--questions <path>] [--output <path>] [--dry-run]
  repo-mind mcp
  repo-mind ui [--port <n>] [--cwd <dir>]

Environment:
  REPOMIND_UI_PASSWORD   When set, protects the UI and API with password login
  REPOMIND_ASK_API_KEY   Optional default API key for the Ask assistant (BYOK)
  REPOMIND_ASK_PROVIDER  Ask LLM provider: openai (default) or anthropic
  REPOMIND_ASK_MODEL     Ask LLM model override

  repo-mind ui loads REPOMIND_* variables from <cwd>/.env (does not override shell env).

Commands:
  init    Scaffold docs/ with example structured pages
  setup   Configure Cursor/Claude MCP and CLAUDE.md snippet
  install-skill  Copy repomind-docs Cursor skill into .cursor/skills/
  check   Validate frontmatter schema and related links
  export  Write agents-export.md flat dump to repo root
  prepare Add RepoMind frontmatter to markdown files (--all for batch)
  sync-links Convert markdown links to wikilinks and sync related frontmatter
  publish   Publish active drafts to docs/; --pr opens a GitHub pull request
  ab-eval   Live A/B eval on a project docs/ corpus (skyforge dogfood gate)
  mcp     Start the MCP stdio server
  ui      Confluence-style workspace over docs/ (127.0.0.1)
`);
}

function parseArgs(argv: string[]): {
  command?: string;
  flags: Record<string, string | boolean>;
} {
  const [command, ...rest] = argv;
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (arg === '--all') {
      flags.all = true;
      continue;
    }
    if (arg === '--pr') {
      flags.pr = true;
      continue;
    }
    if (arg === '--dry-run') {
      flags.dryRun = true;
      continue;
    }
    if (arg === '--no-convert-body') {
      flags.noConvertBody = true;
      continue;
    }
    if (arg === '--no-sync-related') {
      flags.noSyncRelated = true;
      continue;
    }
    if (arg === '--force') {
      flags.force = true;
      continue;
    }
    if (arg === '--cursor') {
      flags.cursor = true;
      continue;
    }
    if (arg === '--claude') {
      flags.claude = true;
      continue;
    }
    if (arg === '--global') {
      flags.global = true;
      continue;
    }
    if (arg === '--cwd' && rest[i + 1]) {
      flags.cwd = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--port' && rest[i + 1]) {
      flags.port = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--message' && rest[i + 1]) {
      flags.message = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--title' && rest[i + 1]) {
      flags.title = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--body' && rest[i + 1]) {
      flags.body = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--draft' && rest[i + 1]) {
      const existing = flags.draft;
      const next = rest[i + 1];
      flags.draft = existing ? `${existing},${next}` : next;
      i += 1;
      continue;
    }
    if (arg === '--questions' && rest[i + 1]) {
      flags.questions = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--output' && rest[i + 1]) {
      flags.output = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--record-scores' && rest[i + 1]) {
      flags.recordScores = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--scores' && rest[i + 1]) {
      flags.scores = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--baseline-transcript' && rest[i + 1]) {
      flags.baselineTranscript = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--repomind-transcript' && rest[i + 1]) {
      flags.repomindTranscript = rest[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      flags.help = true;
    }
  }

  return { command, flags };
}

async function main(): Promise<void> {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (!command || flags.help) {
    printHelp();
    process.exit(command ? 0 : 1);
  }

  const cwd = typeof flags.cwd === 'string' ? flags.cwd : undefined;
  const positionalPath = process.argv.slice(2).find(
    (arg, index, argv) =>
      index > 0 &&
      !arg.startsWith('-') &&
      argv[index - 1] !== '--cwd' &&
      argv[index - 1] !== '--port' &&
      argv[index - 1] !== '--message' &&
      argv[index - 1] !== '--title' &&
      argv[index - 1] !== '--body' &&
      argv[index - 1] !== '--draft' &&
      argv[index - 1] !== '--questions' &&
      argv[index - 1] !== '--output' &&
      argv[index - 1] !== '--record-scores' &&
      argv[index - 1] !== '--scores' &&
      argv[index - 1] !== '--baseline-transcript' &&
      argv[index - 1] !== '--repomind-transcript' &&
      arg !== argv[1],
  );

  switch (command) {
    case 'init':
      process.exit(runInit({ cwd }));
      break;
    case 'setup':
      process.exit(
        runSetup({
          cwd,
          cursor: flags.cursor === true,
          claude: flags.claude === true,
          force: flags.force === true,
        }),
      );
      break;
    case 'install-skill':
      process.exit(
        runInstallSkill({
          cwd,
          global: flags.global === true,
          force: flags.force === true,
        }),
      );
      break;
    case 'check':
      process.exit(runCheck({ cwd }));
      break;
    case 'export':
      process.exit(runExport({ cwd, force: flags.force === true }));
      break;
    case 'prepare':
      process.exit(
        runPrepare({
          cwd,
          dryRun: flags.dryRun === true,
          all: flags.all === true,
          path: positionalPath,
        }),
      );
      break;
    case 'sync-links':
      process.exit(
        runSyncLinks({
          cwd,
          dryRun: flags.dryRun === true,
          convertBody: flags.noConvertBody !== true,
          syncRelated: flags.noSyncRelated !== true,
        }),
      );
      break;
    case 'ab-eval':
      process.exit(
        runAbEval({
          cwd,
          questions: typeof flags.questions === 'string' ? flags.questions : undefined,
          output: typeof flags.output === 'string' ? flags.output : undefined,
          dryRun: flags.dryRun === true,
          recordScores:
            typeof flags.recordScores === 'string' ? flags.recordScores : undefined,
          scoresFile: typeof flags.scores === 'string' ? flags.scores : undefined,
          baselineTranscript:
            typeof flags.baselineTranscript === 'string'
              ? flags.baselineTranscript
              : undefined,
          repomindTranscript:
            typeof flags.repomindTranscript === 'string'
              ? flags.repomindTranscript
              : undefined,
        }),
      );
      break;
    case 'publish':
      process.exit(
        runPublish({
          cwd,
          pr: flags.pr === true,
          dryRun: flags.dryRun === true,
          message: typeof flags.message === 'string' ? flags.message : undefined,
          prTitle: typeof flags.title === 'string' ? flags.title : undefined,
          prBody: typeof flags.body === 'string' ? flags.body : undefined,
          draftIds:
            typeof flags.draft === 'string'
              ? flags.draft.split(',').map((id) => id.trim()).filter(Boolean)
              : undefined,
          skipPush: process.env.REPOMIND_PUBLISH_SKIP_REMOTE === '1',
        }),
      );
      break;
    case 'mcp':
      await startMcpServer();
      break;
    case 'ui': {
      const portRaw = typeof flags.port === 'string' ? Number.parseInt(flags.port, 10) : undefined;
      const port = portRaw && !Number.isNaN(portRaw) ? portRaw : undefined;
      process.exit(await runUi({ cwd, port }));
      break;
    }
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
