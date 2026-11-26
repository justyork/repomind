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
    const filePath = path.join(repo, 'docs/adr/decision.md');
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

  describe('agent options', () => {
    const long = ['# Title', 'intro', '## Setup', 'setup body', '### Detail', 'detail body', '## Usage', 'usage body'].join('\n');

    function writeLong(): DocIndex {
      const filePath = path.join(repo, 'docs/adr/long.md');
      fs.writeFileSync(filePath, `---\ntype: adr\nslug: long\nstatus: accepted\ntitle: Long\n---\n${long}`, 'utf8');
      return new DocIndex(repo);
    }

    it('returns an outline of headings', () => {
      const result = getDoc(writeLong(), 'long', { outline: true });
      expect(result.outline).toEqual([
        { level: 1, heading: 'Title' },
        { level: 2, heading: 'Setup' },
        { level: 3, heading: 'Detail' },
        { level: 2, heading: 'Usage' },
      ]);
    });

    it('returns one section including its subsections', () => {
      const result = getDoc(writeLong(), 'long', { section: 'setup' });
      expect(result.body).toBe('## Setup\nsetup body\n### Detail\ndetail body');
      expect(result.section).toBe('Setup');
    });

    it('reports available sections when section is unknown', () => {
      const result = getDoc(writeLong(), 'long', { section: 'nope' });
      expect(result.found).toBe(true);
      expect(result.section_found).toBe(false);
      expect(result.outline?.map((h) => h.heading)).toContain('Usage');
    });

    it('truncates body to max_chars and says so', () => {
      const result = getDoc(writeLong(), 'long', { maxChars: 20 });
      expect(result.body).toHaveLength(20);
      expect(result.truncated).toBe(true);
      expect(result.total_chars).toBe(long.length);
    });

    it('includes backlinks', () => {
      fs.writeFileSync(
        path.join(repo, 'docs/adr/other.md'),
        '---\ntype: adr\nslug: other\nstatus: accepted\ntitle: Other\nrelated:\n  - decision\n---\nx',
        'utf8',
      );
      const result = getDoc(new DocIndex(repo), 'decision', { backlinks: true });
      expect(result.backlinks).toEqual([{ slug: 'other', title: 'Other', kind: 'related' }]);
    });

    it('suggests similar slugs on miss', () => {
      const result = getDoc(index, 'decisio', { suggestions: true });
      expect(result.found).toBe(false);
      expect(result.suggestions).toContain('decision');
    });
  });

  it('returns not found for bad slug', () => {
    expect(getDoc(index, '../evil')).toEqual({ found: false });
  });
});
