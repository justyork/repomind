import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runPublish } from '../src/commands/publish.ts';
import { gitExec } from '../src/git/git-exec.ts';
import { DocIndex } from '../src/index/doc-index.ts';
import { batchPublishDrafts } from '../src/publish/batch-publish.ts';
import { openDraftsDb } from '../src/ui/db/drafts-db.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-publish-'));
  tmpRoots.push(dir);
  return dir;
}

function writeDoc(root: string, relativePath: string, content: string): void {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function initGitRepo(repo: string): void {
  execFileSync('git', ['init'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: repo });
}

afterEach(() => {
  delete process.env.REPOMIND_PUBLISH_SKIP_REMOTE;
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('batchPublishDrafts', () => {
  it('publishes all active drafts', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'docs/shared/glossary/base.md', '---\ntype: glossary-term\nslug: base\nstatus: accepted\n---\n');
    const index = new DocIndex(repo);
    const db = openDraftsDb(index.getKnowledgeRoot()!);
    db.create({
      slug: 'new-page',
      type: 'wiki-page',
      title: 'New Page',
      body: 'Hello from draft.',
      related: ['base'],
    });

    const result = batchPublishDrafts(index, db);
    expect(result.failures).toHaveLength(0);
    expect(result.published).toHaveLength(1);
    expect(fs.existsSync(result.published[0]!.path)).toBe(true);
    expect(db.listActive()).toHaveLength(0);
    db.close();
  });

  it('reports validation failures without partial publish', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'docs/shared/glossary/base.md', '---\ntype: glossary-term\nslug: base\nstatus: accepted\n---\n');
    const index = new DocIndex(repo);
    const db = openDraftsDb(index.getKnowledgeRoot()!);
    db.create({
      slug: 'broken',
      type: 'wiki-page',
      title: 'Broken',
      body: 'Body',
      related: ['missing-slug'],
    });

    const result = batchPublishDrafts(index, db);
    expect(result.published).toHaveLength(0);
    expect(result.failures[0]?.code).toBe('broken_related');
    expect(db.listActive()).toHaveLength(1);
    db.close();
  });
});

describe('runPublish', () => {
  it('publishes drafts via CLI', () => {
    const repo = makeTempDir();
    initGitRepo(repo);
    writeDoc(repo, 'docs/shared/glossary/base.md', '---\ntype: glossary-term\nslug: base\nstatus: accepted\n---\n');
    writeDoc(repo, 'docs/product/wiki/readme.md', '---\ntype: wiki-page\nslug: readme\nstatus: accepted\n---\n');
    execFileSync('git', ['add', '.'], { cwd: repo });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: repo });

    const index = new DocIndex(repo);
    const db = openDraftsDb(index.getKnowledgeRoot()!);
    db.create({
      slug: 'cli-page',
      type: 'wiki-page',
      title: 'CLI Page',
      body: 'Published from CLI.',
      related: ['base'],
    });
    db.close();

    expect(runPublish({ cwd: repo })).toBe(0);
    expect(fs.existsSync(path.join(repo, 'docs/wiki/cli-page.md'))).toBe(true);
  });

  it('creates a local branch with publish --pr', () => {
    const repo = makeTempDir();
    initGitRepo(repo);
    writeDoc(repo, 'docs/shared/glossary/base.md', '---\ntype: glossary-term\nslug: base\nstatus: accepted\n---\n');
    writeDoc(repo, 'docs/product/wiki/readme.md', '---\ntype: wiki-page\nslug: readme\nstatus: accepted\n---\n');
    execFileSync('git', ['add', '.'], { cwd: repo });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: repo });

    const index = new DocIndex(repo);
    const db = openDraftsDb(index.getKnowledgeRoot()!);
    db.create({
      slug: 'pr-page',
      type: 'wiki-page',
      title: 'PR Page',
      body: 'Published with PR flow.',
      related: ['base'],
    });
    db.close();

    expect(runPublish({ cwd: repo, pr: true, skipPush: true })).toBe(0);

    const branch = gitExec(repo, ['rev-parse', '--abbrev-ref', 'HEAD']);
    expect(branch.startsWith('repo-mind/publish/')).toBe(true);
    expect(gitExec(repo, ['log', '-1', '--pretty=%s'])).toContain('docs: publish via repo-mind');
    expect(fs.existsSync(path.join(repo, 'docs/wiki/pr-page.md'))).toBe(true);
  });

  it('supports dry-run for publish --pr', () => {
    const repo = makeTempDir();
    initGitRepo(repo);
    writeDoc(repo, 'docs/shared/glossary/base.md', '---\ntype: glossary-term\nslug: base\nstatus: accepted\n---\n');
    execFileSync('git', ['add', '.'], { cwd: repo });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: repo });

    const index = new DocIndex(repo);
    const db = openDraftsDb(index.getKnowledgeRoot()!);
    db.create({
      slug: 'dry-page',
      type: 'wiki-page',
      title: 'Dry Page',
      body: 'Still a draft.',
      related: ['base'],
    });
    db.close();

    const branchBefore = gitExec(repo, ['rev-parse', '--abbrev-ref', 'HEAD']);
    expect(runPublish({ cwd: repo, pr: true, dryRun: true })).toBe(0);
    expect(dbClosedActiveCount(repo)).toBe(1);
    expect(gitExec(repo, ['rev-parse', '--abbrev-ref', 'HEAD'])).toBe(branchBefore);
  });
});

function dbClosedActiveCount(repo: string): number {
  const index = new DocIndex(repo);
  const db = openDraftsDb(index.getKnowledgeRoot()!);
  const count = db.listActive().length;
  db.close();
  return count;
}
