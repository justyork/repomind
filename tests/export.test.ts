import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runExport } from '../src/commands/export.ts';
import { runInit } from '../src/commands/init.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-export-'));
  tmpRoots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('export', () => {
  it('writes agents.md with per-type sections', () => {
    const repo = makeTempDir();
    runInit({ cwd: repo });
    expect(runExport({ cwd: repo })).toBe(0);

    const output = fs.readFileSync(path.join(repo, 'agents.md'), 'utf8');
    expect(output).toContain('## ADRs');
    expect(output).toContain('## Glossary');
    expect(output).toContain('slug: mcp');
  });

  it('refuses overwrite without --force', () => {
    const repo = makeTempDir();
    runInit({ cwd: repo });
    runExport({ cwd: repo });
    expect(runExport({ cwd: repo })).toBe(1);
    expect(runExport({ cwd: repo, force: true })).toBe(0);
  });
});
