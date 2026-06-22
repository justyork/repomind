import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';
import { syncAllDocLinks } from '../src/prepare/auto-links.ts';
import { prepareAllDocs } from '../src/prepare/prepare-docs.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-autolink-'));
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

describe('prepareAllDocs', () => {
  it('prepares every unprepared markdown file', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'docs/wiki/a.md', '# A\n');
    writeDoc(repo, 'docs/wiki/b.md', '# B\n');

    const index = new DocIndex(repo);
    const result = prepareAllDocs(index);
    expect(result.prepared).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);
    expect(index.listUnprepared()).toHaveLength(0);
  });
});

describe('syncAllDocLinks', () => {
  it('converts markdown links to wikilinks and syncs related', () => {
    const repo = makeTempDir();
    writeDoc(
      repo,
      'docs/glossary/alpha.md',
      `---
type: glossary-term
slug: alpha
status: accepted
title: Alpha
related: []
---
See [Beta](./beta.md).`,
    );
    writeDoc(
      repo,
      'docs/glossary/beta.md',
      `---
type: glossary-term
slug: beta
status: accepted
title: Beta
related: []
---
Beta page.`,
    );

    const index = new DocIndex(repo);
    const { files } = syncAllDocLinks(index);
    const alpha = files.find((file) => file.relativePath === 'glossary/alpha.md');
    expect(alpha?.changed).toBe(true);
    expect(alpha?.convertedLinks).toBe(1);
    expect(alpha?.addedRelated).toContain('beta');

    const raw = fs.readFileSync(path.join(repo, 'docs/glossary/alpha.md'), 'utf8');
    expect(raw).toContain('[[beta]]');
    expect(raw).toContain('related:\n  - beta');
  });

  it('supports dry run without writing files', () => {
    const repo = makeTempDir();
    writeDoc(
      repo,
      'docs/glossary/alpha.md',
      `---
type: glossary-term
slug: alpha
status: accepted
title: Alpha
related: []
---
Link [Beta](./beta.md).`,
    );
    writeDoc(
      repo,
      'docs/glossary/beta.md',
      `---
type: glossary-term
slug: beta
status: accepted
title: Beta
related: []
---
Beta.`,
    );

    const index = new DocIndex(repo);
    syncAllDocLinks(index, { dryRun: true });
    const raw = fs.readFileSync(path.join(repo, 'docs/glossary/alpha.md'), 'utf8');
    expect(raw).toContain('[Beta](./beta.md)');
    expect(raw).not.toContain('[[beta]]');
  });
});
