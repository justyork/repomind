import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CLAUDE_SNIPPET, runSetup } from '../src/commands/setup.ts';

const tmpRoots: string[] = [];

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('setup', () => {
  it('pins --cwd in a project-level Cursor MCP config', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-setup-'));
    tmpRoots.push(dir);
    fs.mkdirSync(path.join(dir, '.cursor'));
    expect(runSetup({ cwd: dir, cursor: true })).toBe(0);
    const config = JSON.parse(fs.readFileSync(path.join(dir, '.cursor', 'mcp.json'), 'utf8'));
    const args: string[] = config.mcpServers['repo-mind'].args;
    expect(args.slice(-3)).toEqual(['mcp', '--cwd', path.resolve(dir)]);
  });

  it('teaches the agent workflow in the CLAUDE.md snippet', () => {
    expect(CLAUDE_SNIPPET).toMatch(/search_docs/);
    expect(CLAUDE_SNIPPET).toMatch(/section/);
    expect(CLAUDE_SNIPPET).toMatch(/superseded/);
  });
});
