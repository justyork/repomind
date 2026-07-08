import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';
import { movePageFile, moveFolder, promotePageToFolder, renamePageFile, deletePageFile, deleteFolder } from '../src/ui/fs-operations.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-fs-'));
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

describe('fs move/rename', () => {
  it('moves a page between folders and reports inbound link warnings', () => {
    const repo = makeTempDir();
    writeDoc(
      repo,
      'docs/glossary/caravan.md',
      `---
type: glossary-term
slug: caravan
status: accepted
title: Caravan
---
Glossary entry.
`,
    );
    writeDoc(
      repo,
      'docs/specs/convoy-rules.md',
      `---
type: feature-spec
slug: convoy-rules
status: draft
title: Convoy Rules
related:
  - caravan
---
See [[caravan]].
`,
    );
    writeDoc(
      repo,
      'docs/glossary/backlink.md',
      `---
type: glossary-term
slug: backlink
status: accepted
title: Backlink
related:
  - convoy-rules
---
Uses [[convoy-rules]].
`,
    );

    const index = new DocIndex(repo);
    const result = movePageFile(index, 'specs/convoy-rules.md', 'glossary');

    expect(result.relativePath).toBe('glossary/convoy-rules.md');
    expect(result.slug).toBe('glossary-convoy-rules');
    expect(result.slugChanged).toBe(true);
    expect(result.cascadeUpdated).toContain('glossary/backlink.md');

    const backlinkRaw = fs.readFileSync(path.join(repo, 'docs/glossary/backlink.md'), 'utf8');
    expect(backlinkRaw).toContain('[[glossary-convoy-rules]]');
    expect(backlinkRaw).toContain('related:\n  - glossary-convoy-rules');
    expect(backlinkRaw).not.toMatch(/\[\[convoy-rules\]\]/);
    expect(backlinkRaw).not.toMatch(/related:\n(?:  - .+\n)*  - convoy-rules/);
  });

  it('renames a page file in place', () => {
    const repo = makeTempDir();
    writeDoc(
      repo,
      'docs/specs/old-name.md',
      `---
type: feature-spec
slug: old-name
status: draft
title: Old Name
---
Body.
`,
    );

    const index = new DocIndex(repo);
    const result = renamePageFile(index, 'specs/old-name.md', 'new-name');

    expect(result.relativePath).toBe('specs/new-name.md');
    expect(fs.existsSync(path.join(repo, 'docs/specs/new-name.md'))).toBe(true);
    expect(index.getDocBySlug(result.slug)).toBeTruthy();
    expect(result.slug).toBe('specs-new-name');
  });

  it('deletes a page and a folder', () => {
    const repo = makeTempDir();
    writeDoc(
      repo,
      'docs/specs/to-delete.md',
      `---
type: feature-spec
slug: to-delete
status: draft
title: To Delete
---
`,
    );
    fs.mkdirSync(path.join(repo, 'docs/archive'), { recursive: true });
    writeDoc(
      repo,
      'docs/archive/old.md',
      `---
type: wiki-page
slug: archive-old
status: draft
title: Old
---
`,
    );

    const index = new DocIndex(repo);
    const pageResult = deletePageFile(index, 'specs/to-delete.md');
    expect(pageResult.slug).toBe('to-delete');
    expect(fs.existsSync(path.join(repo, 'docs/specs/to-delete.md'))).toBe(false);

    const folderResult = deleteFolder(index, 'archive');
    expect(folderResult.deletedSlugs).toContain('archive-old');
    expect(fs.existsSync(path.join(repo, 'docs/archive'))).toBe(false);
  });

  it('rejects deleting docs root', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'docs/root.md', '---\ntype: wiki-page\nslug: root\nstatus: draft\ntitle: Root\n---\n');
    const index = new DocIndex(repo);
    expect(() => deleteFolder(index, '')).toThrow(/cannot delete docs root/);
  });

  it('promotes a leaf page by creating a sibling folder and preserves slug', () => {
    const repo = makeTempDir();
    writeDoc(
      repo,
      'docs/product/wiki/roadmap.md',
      `---
type: wiki-page
slug: product-wiki-roadmap
status: accepted
title: Roadmap
related:
  - other-page
---
# Roadmap

See [[other-page]].
`,
    );
    writeDoc(
      repo,
      'docs/product/wiki/other.md',
      `---
type: wiki-page
slug: other-page
status: accepted
title: Other
---
`,
    );

    const index = new DocIndex(repo);
    const result = promotePageToFolder(index, 'product/wiki/roadmap.md');

    expect(result.folderPath).toBe('product/wiki/roadmap');
    expect(result.relativePath).toBe('product/wiki/roadmap/README.md');
    expect(result.slug).toBe('product-wiki-roadmap');
    expect(result.slugChanged).toBe(false);
    expect(result.cascadeUpdated).toEqual([]);
    expect(fs.existsSync(path.join(repo, 'docs/product/wiki/roadmap.md'))).toBe(false);
    expect(fs.existsSync(path.join(repo, 'docs/product/wiki/roadmap'))).toBe(true);
    expect(fs.existsSync(path.join(repo, 'docs/product/wiki/roadmap/README.md'))).toBe(true);

    const readmeRaw = fs.readFileSync(path.join(repo, 'docs/product/wiki/roadmap/README.md'), 'utf8');
    expect(readmeRaw).toContain('slug: product-wiki-roadmap');
    expect(index.getDocBySlug('product-wiki-roadmap')).toBeTruthy();
  });

  it('promote is idempotent when sibling folder already exists', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'docs/wiki/topic.md', '---\ntype: wiki-page\nslug: topic\nstatus: draft\ntitle: Topic\n---\n');
    fs.mkdirSync(path.join(repo, 'docs/wiki/topic'), { recursive: true });

    const index = new DocIndex(repo);
    const result = promotePageToFolder(index, 'wiki/topic.md');
    expect(result.folderPath).toBe('wiki/topic');
    expect(result.relativePath).toBe('wiki/topic/README.md');
    expect(fs.existsSync(path.join(repo, 'docs/wiki/topic.md'))).toBe(false);
    expect(fs.existsSync(path.join(repo, 'docs/wiki/topic/README.md'))).toBe(true);
  });

  it('moves a folder with Confluence sibling page and updates nested slugs', () => {
    const repo = makeTempDir();
    writeDoc(
      repo,
      'docs/wiki/roadmap.md',
      `---
type: wiki-page
slug: wiki-roadmap
status: accepted
title: Roadmap
---
`,
    );
    writeDoc(
      repo,
      'docs/wiki/roadmap/child.md',
      `---
type: wiki-page
slug: wiki-roadmap-child
status: draft
title: Child
---
`,
    );
    writeDoc(
      repo,
      'docs/product/home.md',
      `---
type: wiki-page
slug: product-home
status: accepted
title: Home
related:
  - wiki-roadmap-child
---
`,
    );

    const index = new DocIndex(repo);
    const result = moveFolder(index, 'wiki/roadmap', 'product');

    expect(result.relativePath).toBe('product/roadmap');
    expect(result.siblingPagePath).toBe('product/roadmap.md');
    expect(fs.existsSync(path.join(repo, 'docs/product/roadmap.md'))).toBe(true);
    expect(fs.existsSync(path.join(repo, 'docs/product/roadmap/child.md'))).toBe(true);
    expect(fs.existsSync(path.join(repo, 'docs/wiki/roadmap.md'))).toBe(false);

    const childRaw = fs.readFileSync(path.join(repo, 'docs/product/roadmap/child.md'), 'utf8');
    expect(childRaw).toContain('slug: product-roadmap-child');

    const homeRaw = fs.readFileSync(path.join(repo, 'docs/product/home.md'), 'utf8');
    expect(homeRaw).toContain('product-roadmap-child');
    expect(result.cascadeUpdated).toContain('product/home.md');
  });
});
