import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { collectCheckReport } from '../src/check/collect-violations.ts';
import { DocIndex } from '../src/index/doc-index.ts';
import { openDraftsDb } from '../src/ui/db/drafts-db.ts';
import { computeDraftDiff } from '../src/ui/diff.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-check-'));
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

describe('collectCheckReport', () => {
  it('returns null when knowledge root missing', () => {
    const repo = makeTempDir();
    const index = new DocIndex(repo);
    expect(collectCheckReport(index)).toBeNull();
  });

  it('flags broken related slugs', () => {
    const repo = makeTempDir();
    writeDoc(
      repo,
      'docs/adr/broken.md',
      `---
type: adr
slug: broken
status: draft
title: Broken
related:
  - missing
---
`,
    );
    const index = new DocIndex(repo);
    const report = collectCheckReport(index);
    expect(report?.ok).toBe(false);
    expect(report?.violations.some((v) => v.message.includes('missing'))).toBe(true);
  });
});

describe('computeDraftDiff', () => {
  it('marks new drafts with + lines', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'docs/glossary/base.md', '---\ntype: glossary-term\nslug: base\nstatus: accepted\n---\n');
    const index = new DocIndex(repo);
    const db = openDraftsDb(index.getKnowledgeRoot()!);
    const draft = db.create({
      slug: 'new-term',
      type: 'glossary-term',
      title: 'New',
      body: 'Body text.',
    });

    const diff = computeDraftDiff(index, draft);
    expect(diff.isNew).toBe(true);
    expect(diff.diff).toContain('+');
    db.close();
  });

  it('shows changes when overwriting existing file', () => {
    const repo = makeTempDir();
    writeDoc(
      repo,
      'docs/glossary/existing.md',
      `---
type: glossary-term
slug: existing
status: accepted
title: Old
---
Old body.
`,
    );
    const index = new DocIndex(repo);
    const db = openDraftsDb(index.getKnowledgeRoot()!);
    const draft = db.create({
      slug: 'existing',
      type: 'glossary-term',
      title: 'New title',
      body: 'New body.',
      forked_from: 'existing',
    });

    const diff = computeDraftDiff(index, draft);
    expect(diff.isNew).toBe(false);
    expect(diff.diff).toContain('-Old body.');
    expect(diff.diff).toContain('+New body.');
    db.close();
  });
});
