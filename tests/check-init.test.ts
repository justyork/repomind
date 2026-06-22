import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCheck } from '../src/commands/check.ts';
import { runInit } from '../src/commands/init.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-check-'));
  tmpRoots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('check', () => {
  it('fails when knowledge root missing', () => {
    const repo = makeTempDir();
    expect(runCheck({ cwd: repo })).toBe(1);
  });

  it('passes on valid init scaffold', () => {
    const repo = makeTempDir();
    fs.mkdirSync(path.join(repo, '.git'));
    runInit({ cwd: repo });
    expect(runCheck({ cwd: repo })).toBe(0);
  });

  it('fails on broken related slug', () => {
    const repo = makeTempDir();
    runInit({ cwd: repo });
    const docPath = path.join(repo, 'docs/adr/use-plain-markdown.md');
    const content = fs.readFileSync(docPath, 'utf8').replace('  - mcp', '  - does-not-exist');
    fs.writeFileSync(docPath, content, 'utf8');
    expect(runCheck({ cwd: repo })).toBe(1);
  });
});

describe('init', () => {
  it('scaffolds example docs including combat-system', () => {
    const repo = makeTempDir();
    runInit({ cwd: repo });
    expect(fs.existsSync(path.join(repo, 'docs/specs/combat-system.md'))).toBe(true);
    expect(fs.existsSync(path.join(repo, 'docs/glossary/mcp.md'))).toBe(true);
  });

  it('is idempotent and does not clobber user docs', () => {
    const repo = makeTempDir();
    runInit({ cwd: repo });
    const docPath = path.join(repo, 'docs/glossary/mcp.md');
    fs.writeFileSync(docPath, 'USER EDIT', 'utf8');
    runInit({ cwd: repo });
    expect(fs.readFileSync(docPath, 'utf8')).toBe('USER EDIT');
  });
});
