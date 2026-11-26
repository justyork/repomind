import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SemanticIndex } from '../src/embeddings/semantic-index.ts';
import { DocIndex } from '../src/index/doc-index.ts';
import { createFakeEmbedder } from './helpers/fake-embedder.ts';

const tmpRoots: string[] = [];

function writeDoc(repo: string, slug: string, title: string, body: string): void {
  const file = path.join(repo, 'docs/wiki', `${slug}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `---\ntype: wiki-page\nslug: ${slug}\nstatus: accepted\ntitle: ${title}\n---\n${body}`, 'utf8');
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('SemanticIndex', () => {
  let repo: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-sem-'));
    tmpRoots.push(repo);
    writeDoc(repo, 'adr-markdown', 'ADR plain markdown', '# ADR\n\n## Decision\nStore knowledge as plain markdown files.');
    writeDoc(repo, 'fuel', 'Fuel', '## Tank\nFuel tank holds the fuel.\n\n## Market\nThe market sells goods.');
  });

  it('embeds every doc on first sync and skips unchanged docs on the second', async () => {
    const embedder = createFakeEmbedder();
    const sem = new SemanticIndex(new DocIndex(repo), embedder);
    const first = await sem.sync();
    expect(first.embeddedDocs).toBe(2);
    const passageCalls = embedder.calls.filter((c) => c.kind === 'passage').length;
    const second = await new SemanticIndex(new DocIndex(repo), embedder).sync();
    expect(second.embeddedDocs).toBe(0);
    expect(second.skippedDocs).toBe(2);
    expect(embedder.calls.filter((c) => c.kind === 'passage').length).toBe(passageCalls);
  });

  it('re-embeds only the changed doc and drops deleted ones', async () => {
    const embedder = createFakeEmbedder();
    await new SemanticIndex(new DocIndex(repo), embedder).sync();
    writeDoc(repo, 'fuel', 'Fuel', '## Tank\nChanged text about the tank.');
    fs.rmSync(path.join(repo, 'docs/wiki/adr-markdown.md'));
    const sem = new SemanticIndex(new DocIndex(repo), embedder);
    const report = await sem.sync();
    expect(report.embeddedDocs).toBe(1);
    expect(report.removedDocs).toBe(1);
  });

  it('keeps separate caches per model id and supports force', async () => {
    await new SemanticIndex(new DocIndex(repo), createFakeEmbedder('model-a')).sync();
    const other = await new SemanticIndex(new DocIndex(repo), createFakeEmbedder('model-b')).sync();
    expect(other.embeddedDocs).toBe(2);
    const forced = await new SemanticIndex(new DocIndex(repo), createFakeEmbedder('model-b')).sync({ force: true });
    expect(forced.embeddedDocs).toBe(2);
  });

  it('finds the best doc and section across languages once the query is prepared', async () => {
    const sem = new SemanticIndex(new DocIndex(repo), createFakeEmbedder());
    await sem.sync();
    expect(sem.lookup('топливный бак')).toBeNull();
    await sem.prepare('топливный бак');
    const hits = sem.lookup('топливный бак')!;
    expect(hits[0]?.slug).toBe('fuel');
    expect(hits[0]?.section).toBe('Tank');
    await sem.prepare('знания в markdown');
    expect(sem.lookup('знания в markdown')![0]?.slug).toBe('adr-markdown');
  });

  it('works with a partially built index', async () => {
    const sem = new SemanticIndex(new DocIndex(repo), createFakeEmbedder());
    await sem.prepare('fuel tank');
    expect(sem.lookup('fuel tank')).toEqual([]);
  });

  it('reports progress', async () => {
    const seen: number[] = [];
    await new SemanticIndex(new DocIndex(repo), createFakeEmbedder()).sync({ onProgress: (done) => seen.push(done) });
    expect(seen.at(-1)).toBe(2);
  });
});
