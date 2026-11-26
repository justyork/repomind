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
  const filePath = path.join(root, 'docs/glossary', `${slug}.md`);
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

  it('ranks docs matching all terms above partial matches', () => {
    const results = searchDocs(index, { query: 'login session' });
    expect(results).toHaveLength(1);
    expect(results[0]?.matchMode).toBe('all');
  });

  it('falls back to any-term matching when no doc has every term', () => {
    const results = searchDocs(index, { query: 'session cache' });
    expect(results.map((r) => r.slug).sort()).toEqual(['auth', 'cache']);
    expect(results.every((r) => r.matchMode === 'any')).toBe(true);
  });

  it('handles natural-language questions by dropping stop words', () => {
    const results = searchDocs(index, { query: 'how does the cache work?' });
    expect(results[0]?.slug).toBe('cache');
  });

  it('matches on word boundaries, not substrings', () => {
    writeDoc(repo, 'start', 'Startup', 'boot sequence');
    const results = searchDocs(new DocIndex(repo), { query: 'art' });
    expect(results).toHaveLength(0);
  });

  it('matches simple inflections (en and ru)', () => {
    writeDoc(repo, 'save', 'Сохранение', 'Система сохранения прогресса игрока');
    const idx = new DocIndex(repo);
    expect(searchDocs(idx, { query: 'сохранение прогресса' })[0]?.slug).toBe('save');
    expect(searchDocs(idx, { query: 'sessions' })[0]?.slug).toBe('auth');
  });

  it('returns type, domain, status and path metadata', () => {
    const [hit] = searchDocs(index, { query: 'session' });
    expect(hit).toMatchObject({
      slug: 'auth',
      type: 'glossary-term',
      status: 'accepted',
      relativePath: 'glossary/auth.md',
    });
    expect(hit?.domain).toBeTruthy();
  });

  it('filters by status', () => {
    expect(searchDocs(index, { query: 'session', status: 'superseded' })).toHaveLength(0);
    expect(searchDocs(index, { query: 'session', status: 'accepted' })).toHaveLength(1);
  });

  it('honours limit', () => {
    for (let i = 0; i < 8; i += 1) {
      writeDoc(repo, `term-${i}`, `Term ${i}`, 'shared keyword body');
    }
    expect(searchDocs(new DocIndex(repo), { query: 'shared', limit: 3 })).toHaveLength(3);
  });

  it('caps results at 20', () => {
    for (let i = 0; i < 25; i += 1) {
      writeDoc(repo, `term-${i}`, `Term ${i}`, 'shared keyword body');
    }
    const indexMany = new DocIndex(repo);
    expect(searchDocs(indexMany, { query: 'shared' })).toHaveLength(20);
  });
});
