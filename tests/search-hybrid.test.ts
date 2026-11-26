import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SemanticIndex } from '../src/embeddings/semantic-index.ts';
import { DocIndex } from '../src/index/doc-index.ts';
import { searchDocs } from '../src/tools/search-docs.ts';
import { createFakeEmbedder } from './helpers/fake-embedder.ts';

const tmpRoots: string[] = [];

function writeDoc(repo: string, slug: string, front: string, body: string, status = 'accepted'): void {
  const file = path.join(repo, 'docs/wiki', `${slug}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `---\ntype: wiki-page\nslug: ${slug}\nstatus: ${status}\n${front}\n---\n${body}`, 'utf8');
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('hybrid search', () => {
  let repo: string;
  let index: DocIndex;
  let sem: SemanticIndex;

  beforeEach(async () => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-hybrid-'));
    tmpRoots.push(repo);
    writeDoc(repo, 'adr-0004', 'title: ADR-0004 Plain Markdown', '# ADR\n\n## Decision\nStore knowledge as plain markdown files, not a database.');
    writeDoc(repo, 'fuel', 'title: Fuel', '## Tank\nFuel tank holds the fuel.');
    writeDoc(repo, 'market', 'title: Market', 'The market sells goods.');
    index = new DocIndex(repo);
    sem = new SemanticIndex(index, createFakeEmbedder());
    await sem.sync();
  });

  it('is purely lexical when no semantic index is attached', () => {
    expect(searchDocs(index, { query: 'знания в markdown' })[0]?.slug).toBe('adr-0004');
    expect(searchDocs(index, { query: 'знания базе данных' })).toEqual([]);
  });

  it('finds a page that shares no words with a cross-language query', async () => {
    index.semantic = sem;
    const query = 'знания в базе данных';
    await sem.prepare(query);
    const [hit] = searchDocs(index, { query });
    expect(hit?.slug).toBe('adr-0004');
    expect(hit?.matchMode).toBe('semantic');
    expect(hit?.section).toBe('Decision');
  });

  it('falls back to lexical results when the query was never prepared', () => {
    index.semantic = sem;
    expect(searchDocs(index, { query: 'markdown' })[0]?.slug).toBe('adr-0004');
  });

  it('keeps a strong lexical match on top when semantic agrees or is silent', async () => {
    index.semantic = sem;
    await sem.prepare('fuel');
    expect(searchDocs(index, { query: 'fuel' })[0]?.slug).toBe('fuel');
  });

  it('still applies type/status filters to semantic hits', async () => {
    index.semantic = sem;
    const query = 'знания в базе данных';
    await sem.prepare(query);
    expect(searchDocs(index, { query, type: 'adr' })).toEqual([]);
    expect(searchDocs(index, { query, status: 'superseded' })).toEqual([]);
  });

  it('keeps a clearly best match first even when its page is superseded', async () => {
    writeDoc(repo, 'tank-old', 'title: Fuel tank rules', 'Fuel tank rules: the fuel tank holds fuel.', 'superseded');
    fs.rmSync(path.join(repo, 'docs/wiki/fuel.md')); // leave no equally good accepted page
    writeDoc(repo, 'tank-mention', 'title: Notes', 'A short note that mentions the fuel tank once, plus the market and caravan.');
    const idx2 = new DocIndex(repo);
    const sem2 = new SemanticIndex(idx2, createFakeEmbedder());
    await sem2.sync();
    idx2.semantic = sem2;
    const query = 'fuel tank';
    await sem2.prepare(query);
    expect(searchDocs(idx2, { query })[0]?.slug).toBe('tank-old');
  });

  it('down-ranks superseded pages found semantically', async () => {
    writeDoc(repo, 'adr-old', 'title: Old markdown ADR', '## Decision\nStore knowledge as plain markdown files, not a database.', 'superseded');
    const idx2 = new DocIndex(repo);
    const sem2 = new SemanticIndex(idx2, createFakeEmbedder());
    await sem2.sync();
    idx2.semantic = sem2;
    const query = 'знания в базе данных';
    await sem2.prepare(query);
    const slugs = searchDocs(idx2, { query }).map((h) => h.slug);
    expect(slugs.indexOf('adr-0004')).toBeLessThan(slugs.indexOf('adr-old'));
  });
});
