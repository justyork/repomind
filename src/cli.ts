#!/usr/bin/env node
import { runCheck } from './commands/check.js';
import { runExport } from './commands/export.js';
import { runInit } from './commands/init.js';
import { runSetup } from './commands/setup.js';
import { runUi } from './commands/ui.js';
import { startMcpServer } from './mcp/server.js';

function printHelp(): void {
  console.log(`repo-mind — MCP-first project memory

Usage:
  repo-mind init [--cwd <dir>]
  repo-mind setup [--cursor] [--claude] [--force]
  repo-mind check [--cwd <dir>]
  repo-mind export [--force] [--cwd <dir>]
  repo-mind mcp
  repo-mind ui [--port <n>] [--cwd <dir>]

Commands:
  init    Scaffold .project-knowledge/ with example docs
  setup   Configure Cursor/Claude MCP and CLAUDE.md snippet
  check   Validate frontmatter schema and related links
  export  Write agents.md export to repo root
  mcp     Start the MCP stdio server
  ui      Local read-only knowledge graph workspace (127.0.0.1)
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
    case 'check':
      process.exit(runCheck({ cwd }));
      break;
    case 'export':
      process.exit(runExport({ cwd, force: flags.force === true }));
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
