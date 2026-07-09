import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';
import { retrieveAskContext } from '../src/ask/retrieve.ts';
import { extractAskSearchTerms, searchDocsForAsk } from '../src/ask/search.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-ask-retrieve-'));
  tmpRoots.push(dir);
  return dir;
}

function writeDoc(
  root: string,
  slug: string,
  title: string,
  body: string,
  folder = 'glossary',
): void {
  const filePath = path.join(root, 'docs', folder, `${slug}.md`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `---\ntype: glossary-term\nslug: ${slug}\nstatus: accepted\ntitle: ${title}\n---\n\n${body}`,
    'utf8',
  );
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('extractAskSearchTerms', () => {
  it('removes stop words from natural-language questions', () => {
    expect(extractAskSearchTerms('What is the product roadmap?')).toEqual(['product', 'roadmap']);
    expect(extractAskSearchTerms('Как работает dogfood checklist?')).toEqual([
      'работает',
      'dogfood',
      'checklist',
    ]);
  });
});

describe('searchDocsForAsk', () => {
  let repo: string;
  let index: DocIndex;

  beforeEach(() => {
    repo = makeTempDir();
    writeDoc(repo, 'auth', 'Authentication', 'Login and session tokens for users.');
    writeDoc(
      repo,
      'product-roadmap',
      'Product Roadmap',
      'Release phases and v4 prove goals for RepoMind.',
      'product/wiki',
    );
    index = new DocIndex(repo);
  });

  it('finds docs from natural-language questions', () => {
    const hits = searchDocsForAsk(index, 'What is the product roadmap?');
    expect(hits.some((hit) => hit.slug === 'product-roadmap')).toBe(true);
  });

  it('finds docs when only one keyword from the question matches', () => {
    const hits = searchDocsForAsk(index, 'How does authentication work for users?');
    expect(hits[0]?.slug).toBe('auth');
  });
});

describe('retrieveAskContext', () => {
  let repo: string;
  let index: DocIndex;

  beforeEach(() => {
    repo = makeTempDir();
    writeDoc(repo, 'auth', 'Authentication', 'Login and session tokens for users.');
    writeDoc(repo, 'cache', 'Cache Layer', 'In-memory cache invalidated by mtime.');
    index = new DocIndex(repo);
  });

  it('returns empty array for blank question', () => {
    expect(retrieveAskContext(index, '   ')).toEqual([]);
  });

  it('returns matching sources with excerpts', () => {
    const sources = retrieveAskContext(index, 'session tokens');
    expect(sources).toHaveLength(1);
    expect(sources[0]?.slug).toBe('auth');
    expect(sources[0]?.title).toBe('Authentication');
    expect(sources[0]?.excerpt).toContain('session tokens');
  });

  it('retrieves sources for conversational questions', () => {
    const sources = retrieveAskContext(index, 'How do session tokens work?');
    expect(sources).toHaveLength(1);
    expect(sources[0]?.slug).toBe('auth');
  });

  it('caps at top 5 docs', () => {
    for (let i = 0; i < 8; i += 1) {
      writeDoc(repo, `term-${i}`, `Term ${i}`, 'shared keyword alpha');
    }
    index = new DocIndex(repo);
    expect(retrieveAskContext(index, 'shared keyword')).toHaveLength(5);
  });
});
