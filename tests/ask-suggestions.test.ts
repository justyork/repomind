import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';
import {
  buildAskGreetingReply,
  buildAskNotFoundReply,
  pickStarterPages,
  suggestAlternativePages,
} from '../src/ask/suggestions.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-ask-suggestions-'));
  tmpRoots.push(dir);
  return dir;
}

function writeDoc(
  root: string,
  slug: string,
  title: string,
  body: string,
  folder = 'glossary',
  type = 'glossary-term',
): void {
  const filePath = path.join(root, 'docs', folder, `${slug}.md`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `---\ntype: ${type}\nslug: ${slug}\nstatus: accepted\ntitle: ${title}\n---\n\n${body}`,
    'utf8',
  );
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('ask suggestions', () => {
  let repo: string;
  let index: DocIndex;

  beforeEach(() => {
    repo = makeTempDir();
    fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, 'docs/README.md'),
      '---\ntype: wiki-page\nslug: readme\nstatus: accepted\ntitle: Documentation\n---\n\nStart here.',
      'utf8',
    );
    writeDoc(
      repo,
      'product-roadmap',
      'Product Roadmap',
      'Release phases and milestones.',
      'product/wiki',
      'wiki-page',
    );
    writeDoc(repo, 'auth', 'Authentication', 'Login and session tokens.');
    index = new DocIndex(repo);
  });

  it('prioritizes readme and roadmap as starter pages', () => {
    const starters = pickStarterPages(index);
    expect(starters.map((page) => page.slug)).toEqual(
      expect.arrayContaining(['readme', 'product-roadmap']),
    );
  });

  it('builds a greeting with starter links', () => {
    const reply = buildAskGreetingReply(index, 'привет');
    expect(reply).toContain('Привет!');
    expect(reply).toContain('С чего начать:');
    expect(reply).toContain('[Documentation](?slug=readme)');
    expect(reply).toContain('Спросите что-то конкретное');
  });

  it('suggests similar pages when nothing was retrieved', () => {
    const alternatives = suggestAlternativePages(index, 'roadmap milestones');
    expect(alternatives.some((page) => page.slug === 'product-roadmap')).toBe(true);
  });

  it('builds a not-found reply with "возможно, вы искали"', () => {
    const reply = buildAskNotFoundReply(index, 'что в roadmap milestones');
    expect(reply).toContain('Возможно, вы искали:');
    expect(reply).toContain('[Product Roadmap](?slug=product-roadmap)');
  });
});
