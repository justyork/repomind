import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';
import { searchDocs } from '../src/tools/search-docs.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-search-'));
  tmpRoots.push(dir);
  return dir;
}

function writeDoc(root: string, slug: string, title: string, body: string, tags: string[] = []): void {
  const tagLines = tags.length > 0 ? `tags:\n${tags.map((t) => `  - ${t}`).join('\n')}` : '';
  const filePath = path.join(root, '.project-knowledge/glossary', `${slug}.md`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `---\ntype: glossary-term\nslug: ${slug}\nstatus: accepted\ntitle: ${title}\n${tagLines}\n---\n\n${body}`,
    'utf8',
  );
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('search_docs', () => {
  let repo: string;
  let index: DocIndex;

  beforeEach(() => {
    repo = makeTempDir();
    writeDoc(repo, 'auth', 'Authentication', 'Login and session tokens', ['security']);
    writeDoc(repo, 'cache', 'Cache Layer', 'In-memory cache invalidated by mtime');
    index = new DocIndex(repo);
  });

  it('returns empty for blank query', () => {
    expect(searchDocs(index, { query: '   ' })).toEqual([]);
  });

  it('matches single term in body', () => {
    const results = searchDocs(index, { query: 'session' });
    expect(results).toHaveLength(1);
    expect(results[0]?.slug).toBe('auth');
  });

  it('requires all terms (AND)', () => {
    expect(searchDocs(index, { query: 'session cache' })).toHaveLength(0);
    expect(searchDocs(index, { query: 'login session' })).toHaveLength(1);
  });

  it('caps results at 20', () => {
    for (let i = 0; i < 25; i += 1) {
      writeDoc(repo, `term-${i}`, `Term ${i}`, 'shared keyword body');
    }
    const indexMany = new DocIndex(repo);
    expect(searchDocs(indexMany, { query: 'shared' })).toHaveLength(20);
  });
});
