import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocIndex, discoverKnowledgeRoot } from '../src/index/doc-index.ts';
import { isValidSlug, resolveDocPath } from '../src/index/slug.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-test-'));
  tmpRoots.push(dir);
  return dir;
}

function writeDoc(
  root: string,
  relativePath: string,
  content: string,
): void {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('discoverKnowledgeRoot', () => {
  it('walks up to find .project-knowledge/', () => {
    const repo = makeTempDir();
    const subdir = path.join(repo, 'packages', 'app');
    fs.mkdirSync(subdir, { recursive: true });
    writeDoc(repo, '.project-knowledge/glossary/a.md', '---\ntype: glossary-term\nslug: a\nstatus: draft\n---\n');

    expect(discoverKnowledgeRoot(subdir)).toBe(path.join(repo, '.project-knowledge'));
  });

  it('returns null when not found', () => {
    const repo = makeTempDir();
    expect(discoverKnowledgeRoot(repo)).toBeNull();
  });
});

describe('slug safety (A1)', () => {
  const knowledgeRoot = '/tmp/repo/.project-knowledge';

  const adversarial = ['../x', 'a/../../b', '..%2f..', '/abs', '', 'has/slash', 'UPPER'];

  it.each(adversarial)('rejects invalid slug %s', (slug) => {
    expect(isValidSlug(slug)).toBe(false);
    expect(resolveDocPath(knowledgeRoot, 'glossary', slug)).toBeNull();
  });

  it('accepts valid slug and stays under root', () => {
    const resolved = resolveDocPath(knowledgeRoot, 'glossary', 'valid-term');
    expect(resolved).toBe(path.resolve(knowledgeRoot, 'glossary', 'valid-term.md'));
  });
});

describe('DocIndex cache', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempDir();
    writeDoc(
      repo,
      '.project-knowledge/glossary/alpha.md',
      `---
type: glossary-term
slug: alpha
status: accepted
title: Alpha
---
First paragraph.`,
    );
  });

  it('parses docs on refresh', () => {
    const index = new DocIndex(repo);
    const docs = index.refresh();
    expect(docs).toHaveLength(1);
    expect(docs[0]?.slug).toBe('alpha');
  });

  it('re-parses when mtime changes', () => {
    const index = new DocIndex(repo);
    index.refresh();

    const docPath = path.join(repo, '.project-knowledge/glossary/alpha.md');
    const original = fs.readFileSync(docPath, 'utf8');
    fs.writeFileSync(
      docPath,
      original.replace('title: Alpha', 'title: Alpha Updated'),
      'utf8',
    );

    const docs = index.refresh();
    expect(docs[0]?.title).toBe('Alpha Updated');
  });
});
