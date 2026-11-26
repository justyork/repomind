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

function writeRaw(root: string, rel: string, front: string, body: string): void {
  const filePath = path.join(root, 'docs', rel);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `---\n${front}\n---\n\n${body}`, 'utf8');
}

describe('search_docs ranking and sections', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempDir();
  });

  it('ranks superseded pages below accepted ones with the same content', () => {
    writeRaw(repo, 'adr/old.md', 'type: adr\nslug: old\nstatus: superseded\ntitle: Queue design', 'queue retry policy');
    writeRaw(repo, 'adr/new.md', 'type: adr\nslug: new\nstatus: accepted\ntitle: Queue design', 'queue retry policy');
    const results = searchDocs(new DocIndex(repo), { query: 'queue retry' });
    expect(results.map((r) => r.slug)).toEqual(['new', 'old']);
  });

  it('prefers an exact slug match over repeated body mentions', () => {
    writeRaw(repo, 'wiki/cache.md', 'type: wiki-page\nslug: cache\nstatus: accepted\ntitle: Cache', 'short');
    writeRaw(repo, 'wiki/other.md', 'type: wiki-page\nslug: other\nstatus: accepted\ntitle: Other', 'cache cache cache cache cache');
    expect(searchDocs(new DocIndex(repo), { query: 'cache' })[0]?.slug).toBe('cache');
  });

  it('boosts pages that other pages point to via related', () => {
    writeRaw(repo, 'wiki/a.md', 'type: wiki-page\nslug: a\nstatus: accepted\ntitle: Alpha', 'deploy pipeline notes');
    writeRaw(repo, 'wiki/b.md', 'type: wiki-page\nslug: b\nstatus: accepted\ntitle: Beta', 'deploy pipeline notes');
    writeRaw(repo, 'wiki/c.md', 'type: wiki-page\nslug: c\nstatus: accepted\ntitle: Gamma\nrelated:\n  - b', 'unrelated');
    expect(searchDocs(new DocIndex(repo), { query: 'deploy pipeline' })[0]?.slug).toBe('b');
  });

  it('keeps a precise short page when filler query words are missing from it', () => {
    writeRaw(repo, 'glossary/caravan.md', 'type: glossary-term\nslug: caravan\nstatus: accepted\ntitle: Caravan', 'A merchant convoy between towns.');
    writeRaw(
      repo,
      'specs/economy.md',
      'type: feature-spec\nslug: economy\nstatus: accepted\ntitle: Economy System',
      'In the game world the caravan pays upkeep. ' + 'Trade prices move weekly across the game world. '.repeat(40),
    );
    // In a real game repo "game" and "world" are common words, not discriminating ones.
    for (let i = 0; i < 6; i += 1) {
      writeRaw(repo, `wiki/filler-${i}.md`, `type: wiki-page\nslug: filler-${i}\nstatus: accepted\ntitle: Filler ${i}`, 'Notes about the game world and its design.');
    }
    const hits = searchDocs(new DocIndex(repo), { query: 'What is a caravan in the game world?' });
    expect(hits[0]?.slug).toBe('caravan');
  });

  it('finds a short Russian glossary page through inflected words', () => {
    writeRaw(repo, 'glossary/fuel-tank.md', 'type: glossary-term\nslug: fuel-tank\nstatus: accepted\ntitle: Бак топлива (Fuel Tank)', 'Топливо для мобильности каравана.');
    writeRaw(
      repo,
      'specs/fuel.md',
      'type: feature-spec\nslug: fuel\nstatus: accepted\ntitle: Топливо',
      'Заправка топливом на острове. Расход топлива в рейсе. Топливо как груз. '.repeat(60),
    );
    writeRaw(repo, 'specs/market.md', 'type: feature-spec\nslug: market\nstatus: accepted\ntitle: Рынок', 'Рынок и товары. '.repeat(40));
    const hits = searchDocs(new DocIndex(repo), { query: 'Что такое топливный бак (fuel tank)?' });
    expect(hits[0]?.slug).toBe('fuel-tank');
  });

  it('indexes slug words so an English slug finds a page with a Russian title', () => {
    writeRaw(repo, 'specs/onboarding-coach.md', 'type: feature-spec\nslug: onboarding-coach\nstatus: accepted\ntitle: Обучение — подсказки поверх интерфейса', 'Подсказки для новых игроков.');
    writeRaw(repo, 'specs/market.md', 'type: feature-spec\nslug: market\nstatus: accepted\ntitle: Рынок', 'Товары и цены.');
    expect(searchDocs(new DocIndex(repo), { query: 'onboarding coach' })[0]?.slug).toBe('onboarding-coach');
  });

  it('weights rare terms above common ones', () => {
    writeRaw(repo, 'wiki/common.md', 'type: wiki-page\nslug: common\nstatus: accepted\ntitle: One', 'the system the system the system overview');
    writeRaw(repo, 'wiki/rare.md', 'type: wiki-page\nslug: rare\nstatus: accepted\ntitle: Two', 'overview of zeppelin');
    writeRaw(repo, 'wiki/filler.md', 'type: wiki-page\nslug: filler\nstatus: accepted\ntitle: Three', 'system overview system');
    const hits = searchDocs(new DocIndex(repo), { query: 'zeppelin system' });
    expect(hits[0]?.slug).toBe('rare');
  });

  const sectioned = ['# Guide', 'intro text', '## Install', 'run the installer', '## Billing', 'invoices are monthly and prorated', '### Refunds', 'refunds take five days'].join('\n');

  it('reports the best-matching section and snippets from it', () => {
    writeRaw(repo, 'wiki/guide.md', 'type: wiki-page\nslug: guide\nstatus: accepted\ntitle: Guide', sectioned);
    const [hit] = searchDocs(new DocIndex(repo), { query: 'invoices prorated' });
    expect(hit?.section).toBe('Billing');
    expect(hit?.snippet).toContain('invoices');
  });

  it('includes the top section text when includeTop is set, capped by topChars', () => {
    writeRaw(repo, 'wiki/guide.md', 'type: wiki-page\nslug: guide\nstatus: accepted\ntitle: Guide', sectioned);
    const idx = new DocIndex(repo);
    const [hit, ...rest] = searchDocs(idx, { query: 'invoices', includeTop: true });
    expect(hit?.top?.text).toContain('invoices are monthly');
    expect(hit?.top?.text).toContain('Refunds');
    expect(rest.every((r) => r.top === undefined)).toBe(true);
    const [short] = searchDocs(idx, { query: 'invoices', includeTop: true, topChars: 20 });
    expect(short?.top?.text.length).toBeLessThanOrEqual(20);
  });
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
