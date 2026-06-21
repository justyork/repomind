import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';
import { exploreGraph } from '../src/tools/explore-graph.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-graph-'));
  tmpRoots.push(dir);
  return dir;
}

function writeDoc(
  root: string,
  typeDir: string,
  slug: string,
  title: string,
  related: string[] = [],
): void {
  const relatedLines = related.length > 0 ? `related:\n${related.map((r) => `  - ${r}`).join('\n')}` : '';
  const filePath = path.join(root, '.project-knowledge', typeDir, `${slug}.md`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `---\ntype: adr\nslug: ${slug}\nstatus: accepted\ntitle: ${title}\n${relatedLines}\n---\n\nBody`,
    'utf8',
  );
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('explore_graph', () => {
  let repo: string;
  let index: DocIndex;

  beforeEach(() => {
    repo = makeTempDir();
    writeDoc(repo, 'adr', 'a', 'A', ['b']);
    writeDoc(repo, 'adr', 'b', 'B', ['c']);
    writeDoc(repo, 'adr', 'c', 'C', ['a']);
    index = new DocIndex(repo);
  });

  it('defaults to depth 3', () => {
    const result = exploreGraph(index, { slug: 'a' });
    expect(result.nodes.length).toBeGreaterThanOrEqual(3);
  });

  it('clamps depth <= 0 to root only', () => {
    const result = exploreGraph(index, { slug: 'a', depth: 0 });
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]?.slug).toBe('a');
  });

  it('records broken links', () => {
    writeDoc(repo, 'adr', 'd', 'D', ['missing']);
    const brokenIndex = new DocIndex(repo);
    const result = exploreGraph(brokenIndex, { slug: 'd', depth: 2 });
    expect(result.broken_links).toContain('missing');
  });

  it('cuts cycles with visited set', () => {
    const result = exploreGraph(index, { slug: 'a', depth: 10 });
    expect(result.nodes.length).toBe(3);
  });
});
