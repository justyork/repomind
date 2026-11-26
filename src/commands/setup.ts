import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const NPM_PACKAGE_NAME = '@justyork/repo-mind';
const MCP_SERVER_NAME = 'repo-mind';
const CLAUDE_SNIPPET = [
  '',
  '<!-- repo-mind -->',
  'Project knowledge lives in `docs/`. Use repo-mind MCP, same files humans edit in `repo-mind ui`:',
  '1. `search_docs` with a keyword or a full question; hits show status and best section.',
  '2. `get_doc` on the best slug; for long pages pass `section` (see outline) instead of the whole page.',
  '3. Treat `superseded`/`draft` pages as possibly outdated; prefer the accepted page.',
  '4. `explore_graph` (direction in/out/both) for related decisions; `get_glossary_term` for domain terms.',
  '<!-- /repo-mind -->',
  '',
].join('\n');

export interface SetupOptions {
  cwd?: string;
  cursor?: boolean;
  claude?: boolean;
  force?: boolean;
}

export function runSetup(options: SetupOptions = {}): number {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const setupCursor = options.cursor ?? !options.claude;
  const setupClaude = options.claude ?? !options.cursor;
  const actions: string[] = [];

  if (setupCursor) {
    const cursorPath = resolveCursorConfigPath(cwd);
    // A project-level config belongs to this project, so pin the server to it.
    const projectLevel = cursorPath === path.join(cwd, '.cursor', 'mcp.json');
    mergeMcpConfig(cursorPath, options.force ?? false, projectLevel ? cwd : undefined);
    actions.push(`Cursor MCP config: ${cursorPath}`);
  }

  if (setupClaude) {
    const claudePath = path.join(os.homedir(), '.claude.json');
    mergeClaudeConfig(claudePath, options.force ?? false);
    actions.push(`Claude Code MCP config: ${claudePath}`);
  }

  const claudeMdPath = path.join(cwd, 'CLAUDE.md');
  appendClaudeSnippet(claudeMdPath);
  actions.push(`CLAUDE.md snippet: ${claudeMdPath}`);

  for (const action of actions) {
    console.log(action);
  }

  return 0;
}

function resolveCursorConfigPath(cwd: string): string {
  const projectConfig = path.join(cwd, '.cursor', 'mcp.json');
  if (fs.existsSync(path.dirname(projectConfig))) {
    return projectConfig;
  }
  return path.join(os.homedir(), '.cursor', 'mcp.json');
}

interface McpJson {
  mcpServers?: Record<string, { command: string; args?: string[] }>;
}

function mergeMcpConfig(configPath: string, force: boolean, pinnedCwd?: string): void {
  const config = readJson<McpJson>(configPath);
  config.mcpServers ??= {};

  if (config.mcpServers[MCP_SERVER_NAME] && !force) {
    console.warn(`warning: ${MCP_SERVER_NAME} already configured in ${configPath} (use --force to replace)`);
    return;
  }

  config.mcpServers[MCP_SERVER_NAME] = {
    command: 'npx',
    args: ['-y', NPM_PACKAGE_NAME, 'mcp', ...(pinnedCwd ? ['--cwd', pinnedCwd] : [])],
  };

  writeJson(configPath, config);
}

interface ClaudeJson {
  mcpServers?: Record<string, { command: string; args?: string[] }>;
}

function mergeClaudeConfig(configPath: string, force: boolean): void {
  const config = readJson<ClaudeJson>(configPath);
  config.mcpServers ??= {};

  if (config.mcpServers[MCP_SERVER_NAME] && !force) {
    console.warn(`warning: ${MCP_SERVER_NAME} already configured in ${configPath} (use --force to replace)`);
    return;
  }

  config.mcpServers[MCP_SERVER_NAME] = {
    command: 'npx',
    args: ['-y', NPM_PACKAGE_NAME, 'mcp'],
  };

  writeJson(configPath, config);
}

function appendClaudeSnippet(claudeMdPath: string): void {
  if (fs.existsSync(claudeMdPath)) {
    const existing = fs.readFileSync(claudeMdPath, 'utf8');
    if (existing.includes('<!-- repo-mind -->')) {
      return;
    }
    fs.appendFileSync(claudeMdPath, CLAUDE_SNIPPET, 'utf8');
    return;
  }

  fs.writeFileSync(claudeMdPath, `# CLAUDE.md${CLAUDE_SNIPPET}`, 'utf8');
}

function readJson<T>(filePath: string): T {
  if (!fs.existsSync(filePath)) {
    return {} as T;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export { CLAUDE_SNIPPET, MCP_SERVER_NAME, NPM_PACKAGE_NAME };
