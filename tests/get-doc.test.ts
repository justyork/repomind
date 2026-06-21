import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';
import { getDoc } from '../src/tools/get-doc.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-get-'));
  tmpRoots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('get_doc', () => {
  let repo: string;
  let index: DocIndex;

  beforeEach(() => {
    repo = makeTempDir();
    const filePath = path.join(repo, '.project-knowledge/adr/decision.md');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      `---
type: adr
slug: decision
status: accepted
title: Decision
---
Body text.`,
      'utf8',
    );
    index = new DocIndex(repo);
  });

  it('returns found doc', () => {
    const result = getDoc(index, 'decision');
    expect(result.found).toBe(true);
    expect(result.body).toBe('Body text.');
  });

  it('returns not found for missing slug', () => {
    expect(getDoc(index, 'missing')).toEqual({ found: false });
  });

  it('returns not found for bad slug', () => {
    expect(getDoc(index, '../evil')).toEqual({ found: false });
  });
});
