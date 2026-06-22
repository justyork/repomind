import { exploreGraph } from '../src/tools/explore-graph.ts';
import {
  buildLinkIndex,
  parseWikilinkTargets,
  resolveWikilinkTarget,
} from '../src/index/link-index.ts';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-link-'));
  tmpRoots.push(dir);
  return dir;
}

function writeDoc(
  root: string,
  typeDir: string,
  slug: string,
  title: string,
  body: string,
  related: string[] = [],
): void {
  const relatedLines =
    related.length > 0 ? `related:\n${related.map((r) => `  - ${r}`).join('\n')}` : '';
  const filePath = path.join(root, 'docs', typeDir, `${slug}.md`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `---\ntype: adr\nslug: ${slug}\nstatus: accepted\ntitle: ${title}\n${relatedLines}\n---\n\n${body}`,
    'utf8',
  );
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('link-index', () => {
  it('parses wikilink targets', () => {
    expect(parseWikilinkTargets('See [[other-page]] and [[Label|target-slug]]')).toEqual([
      'other-page',
      'target-slug',
    ]);
  });

  it('builds wikilink edges and backlinks', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'adr', 'a', 'A', 'Links to [[b]]');
    writeDoc(repo, 'adr', 'b', 'B', 'No links');
    const index = new DocIndex(repo);
    const docs = index.refresh();
    const snapshot = buildLinkIndex(docs);

    expect(snapshot.edges.some((e) => e.from === 'a' && e.to === 'b' && e.kind === 'wikilink')).toBe(
      true,
    );
    expect(snapshot.backlinks.get('b')).toEqual([{ from: 'a', kind: 'wikilink' }]);
  });

  it('records broken wikilink targets', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'adr', 'a', 'A', 'Broken [[missing-slug]]');
    const index = new DocIndex(repo);
    const snapshot = buildLinkIndex(index.refresh());

    expect(snapshot.brokenTargets.has('missing-slug')).toBe(true);
    expect(
      snapshot.edges.some(
        (e) => e.kind === 'wikilink' && e.rawTarget === 'missing-slug' && e.to === 'missing-slug',
      ),
    ).toBe(true);
  });

  it('resolves wikilink by title', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'adr', 'target-slug', 'Target Title', 'Body');
    const index = new DocIndex(repo);
    const docs = index.refresh();
    const lookups = {
      slugSet: new Set(docs.map((d) => d.slug)),
      titleToSlug: new Map(docs.flatMap((d) => [
        [d.slug.toLowerCase(), d.slug],
        [d.title.toLowerCase(), d.slug],
      ])),
    };
    expect(resolveWikilinkTarget('Target Title', lookups).slug).toBe('target-slug');
  });
});

describe('explore_graph with wikilinks', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempDir();
    writeDoc(repo, 'adr', 'a', 'A', 'Wiki [[b]]', []);
    writeDoc(repo, 'adr', 'b', 'B', 'Plain', ['c']);
    writeDoc(repo, 'adr', 'c', 'C', 'End', []);
  });

  it('traverses wikilink edges without related frontmatter', () => {
    const index = new DocIndex(repo);
    const result = exploreGraph(index, { slug: 'a', depth: 3 });
    const slugs = result.nodes.map((n) => n.slug).sort();
    expect(slugs).toContain('b');
    expect(result.edges.some((e) => e.from === 'a' && e.to === 'b')).toBe(true);
  });
});
