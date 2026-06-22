import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';
import { listUnpreparedFiles, prepareDocFile } from '../src/prepare/prepare-docs.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-prepare-'));
  tmpRoots.push(dir);
  return dir;
}

function writeDoc(root: string, relativePath: string, content: string): void {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('prepare docs', () => {
  it('lists markdown without explicit type as unprepared', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'docs/wiki/legacy-page.md', '# Legacy\n\nNo frontmatter.');
    writeDoc(
      repo,
      'docs/glossary/term.md',
      '---\ntype: glossary-term\nslug: term\nstatus: accepted\n---\n',
    );

    const index = new DocIndex(repo);
    const unprepared = listUnpreparedFiles(index);
    expect(unprepared).toHaveLength(1);
    expect(unprepared[0]?.relativePath).toBe('wiki/legacy-page.md');
  });

  it('adds frontmatter to an unprepared file', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'docs/architecture/overview.md', '# Overview\n\nSystem design.');

    const index = new DocIndex(repo);
    const result = prepareDocFile(index, 'architecture/overview.md', {
      type: 'wiki-page',
    });

    expect(result.slug).toBe('architecture-overview');
    const raw = fs.readFileSync(result.path, 'utf8');
    expect(raw).toContain('type: wiki-page');
    expect(raw).toContain('slug: architecture-overview');
    expect(listUnpreparedFiles(index)).toHaveLength(0);
  });
});
