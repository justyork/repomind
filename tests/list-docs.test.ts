import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';
import { listDocs } from '../src/tools/list-docs.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-list-'));
  tmpRoots.push(dir);
  return dir;
}

function writeDoc(root: string, relativePath: string, frontmatter: string, body = 'Body'): void {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `---\n${frontmatter}\n---\n\n${body}`, 'utf8');
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('list_docs', () => {
  let repo: string;
  let index: DocIndex;

  beforeEach(() => {
    repo = makeTempDir();
    writeDoc(repo, 'docs/adr/one.md', 'type: adr\nslug: one\nstatus: accepted\ntitle: One\ntags:\n  - core');
    writeDoc(repo, 'docs/specs/two.md', 'type: feature-spec\nslug: two\nstatus: draft\ntitle: Two');
    index = new DocIndex(repo);
  });

  it('returns all docs without filters', () => {
    expect(listDocs(index)).toHaveLength(2);
  });

  it('filters by type', () => {
    expect(listDocs(index, { type: 'adr' })).toHaveLength(1);
  });

  it('filters by status', () => {
    expect(listDocs(index, { status: 'draft' })).toHaveLength(1);
  });

  it('filters by tag', () => {
    expect(listDocs(index, { tag: 'core' })).toHaveLength(1);
  });

  it('filters by domain', () => {
    writeDoc(
      repo,
      'docs/product/specs/prd.md',
      'type: feature-spec\ndomain: product\nslug: prd\nstatus: accepted\ntitle: PRD',
    );
    expect(listDocs(index, { domain: 'product' })).toHaveLength(1);
    expect(listDocs(index, { domain: 'technical' })).toHaveLength(0);
  });

  it('returns empty when knowledge root missing', () => {
    const emptyIndex = new DocIndex(makeTempDir());
    expect(listDocs(emptyIndex)).toEqual([]);
  });
});
