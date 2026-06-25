import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';
import { openDraftsDb } from '../src/ui/db/drafts-db.ts';
import { publishDraft, validateDraftForPublish } from '../src/ui/publish.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-draft-'));
  tmpRoots.push(dir);
  return dir;
}

function writeDoc(root: string, relativePath: string, content: string): void {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('DraftsDb', () => {
  it('creates and lists active drafts', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'docs/glossary/term.md', '---\ntype: glossary-term\nslug: term\nstatus: draft\n---\n');
    const index = new DocIndex(repo);
    const db = openDraftsDb(index.getKnowledgeRoot()!);

    const draft = db.create({ slug: 'new-term', type: 'glossary-term', title: 'New' });
    expect(draft.slug).toBe('new-term');
    expect(db.listActive()).toHaveLength(1);

    db.close();
  });

  it('rejects duplicate active slug', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'docs/glossary/a.md', '---\ntype: glossary-term\nslug: a\nstatus: draft\n---\n');
    const index = new DocIndex(repo);
    const db = openDraftsDb(index.getKnowledgeRoot()!);
    db.create({ slug: 'dup', type: 'glossary-term' });
    expect(() => db.create({ slug: 'dup', type: 'glossary-term' })).toThrow(/already exists/);
    db.close();
  });

  it('updates draft fields', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'docs/glossary/a.md', '---\ntype: glossary-term\nslug: a\nstatus: draft\n---\n');
    const index = new DocIndex(repo);
    const db = openDraftsDb(index.getKnowledgeRoot()!);
    const draft = db.create({ slug: 'edit-me', type: 'glossary-term', body: 'v1' });
    const updated = db.update(draft.id, { body: 'v2', title: 'Edited' });
    expect(updated.body).toBe('v2');
    expect(updated.title).toBe('Edited');
    db.close();
  });
});

describe('publishDraft', () => {
  it('writes markdown file for new draft', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'docs/glossary/base.md', '---\ntype: glossary-term\nslug: base\nstatus: accepted\n---\n');
    const index = new DocIndex(repo);
    const db = openDraftsDb(index.getKnowledgeRoot()!);

    const draft = db.create({
      slug: 'published-term',
      type: 'glossary-term',
      title: 'Published',
      body: 'Definition here.',
      related: ['base'],
    });

    const err = validateDraftForPublish(index, draft);
    expect(err).toBeNull();

    const result = publishDraft(index, draft);
    expect(fs.existsSync(result.path)).toBe(true);
    const content = fs.readFileSync(result.path, 'utf8');
    expect(content).toContain('slug: published-term');
    expect(content).toContain('Definition here.');

    db.markPublished(draft.id, result.path);
    db.close();
  });

  it('allows fork publish to overwrite existing file', () => {
    const repo = makeTempDir();
    writeDoc(
      repo,
      'docs/glossary/forked.md',
      '---\ntype: glossary-term\nslug: forked\nstatus: accepted\ntitle: Old\n---\nOld body',
    );
    const index = new DocIndex(repo);
    const db = openDraftsDb(index.getKnowledgeRoot()!);

    const draft = db.create({
      slug: 'forked',
      type: 'glossary-term',
      title: 'New',
      body: 'New body',
      forked_from: 'forked',
    });

    expect(validateDraftForPublish(index, draft)).toBeNull();
    publishDraft(index, draft);
    const content = fs.readFileSync(
      path.join(repo, 'docs/glossary/forked.md'),
      'utf8',
    );
    expect(content).toContain('New body');

    db.close();
  });

  it('allows publish for tree-created page when forked_from is set', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'docs/glossary/base.md', '---\ntype: glossary-term\nslug: base\nstatus: accepted\n---\n');
    const index = new DocIndex(repo);
    const db = openDraftsDb(index.getKnowledgeRoot()!);

    const targetPath = 'glossary/tree-page.md';
    writeDoc(
      repo,
      `docs/${targetPath}`,
      '---\ntype: glossary-term\nslug: tree-page\nstatus: draft\ntitle: Tree Page\n---\n# Tree Page\n\n',
    );
    index.refresh();

    const draft = db.create({
      slug: 'tree-page',
      type: 'glossary-term',
      title: 'Tree Page',
      body: '# Tree Page\n\nEdited in UI.',
      forked_from: 'tree-page',
      target_path: targetPath,
    });

    expect(validateDraftForPublish(index, draft)).toBeNull();
    const result = publishDraft(index, draft);
    expect(fs.readFileSync(result.path, 'utf8')).toContain('Edited in UI.');

    db.close();
  });

  it('blocks publish for on-disk page draft without forked_from', () => {
    const repo = makeTempDir();
    const targetPath = 'glossary/orphan-page.md';
    writeDoc(
      repo,
      `docs/${targetPath}`,
      '---\ntype: glossary-term\nslug: orphan-page\nstatus: draft\ntitle: Orphan\n---\n# Orphan\n\n',
    );
    const index = new DocIndex(repo);
    const db = openDraftsDb(index.getKnowledgeRoot()!);

    const draft = db.create({
      slug: 'orphan-page',
      type: 'glossary-term',
      title: 'Orphan',
      body: 'Body',
      target_path: targetPath,
    });

    const err = validateDraftForPublish(index, draft);
    expect(err?.code).toBe('path_conflict');

    db.close();
  });

  it('blocks publish when related slug missing', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'docs/glossary/a.md', '---\ntype: glossary-term\nslug: a\nstatus: draft\n---\n');
    const index = new DocIndex(repo);
    const db = openDraftsDb(index.getKnowledgeRoot()!);

    const draft = db.create({
      slug: 'broken',
      type: 'glossary-term',
      related: ['missing-slug'],
    });

    const err = validateDraftForPublish(index, draft);
    expect(err?.code).toBe('broken_related');

    db.close();
  });
});
