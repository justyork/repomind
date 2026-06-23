import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';
import { buildDocsTree, folderDisplayName, readmeIndexRelativePath } from '../src/ui/fs-tree.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-tree-'));
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

describe('readmeIndexRelativePath', () => {
  it('resolves root and nested README paths', () => {
    expect(readmeIndexRelativePath('')).toBe('README.md');
    expect(readmeIndexRelativePath('specs')).toBe('specs/README.md');
  });
});

describe('folderDisplayName', () => {
  it('labels top-level domain folders', () => {
    expect(folderDisplayName('')).toBe('Knowledge');
    expect(folderDisplayName('product')).toBe('Product');
    expect(folderDisplayName('game-design')).toBe('Game design');
    expect(folderDisplayName('product/specs')).toBe('specs');
  });
});

describe('buildDocsTree domain labels', () => {
  it('shows DOMAIN_LABELS for docs/{domain}/ roots', () => {
    const repo = makeTempDir();
    writeDoc(
      repo,
      'docs/README.md',
      `---
type: wiki-page
slug: root
status: accepted
title: Root
---
`,
    );
    writeDoc(
      repo,
      'docs/product/README.md',
      `---
type: wiki-page
slug: product-home
status: accepted
title: Product Home
domain: product
---
`,
    );

    const tree = buildDocsTree(new DocIndex(repo));
    const product = tree?.children.find(
      (child) => child.kind === 'folder' && child.relativePath === 'product',
    );
    expect(product?.kind).toBe('folder');
    if (product?.kind === 'folder') {
      expect(product.name).toBe('Product');
    }
  });
});

describe('buildDocsTree README index', () => {
  it('uses README.md as folder index and hides it from children', () => {
    const repo = makeTempDir();
    writeDoc(
      repo,
      'docs/README.md',
      `---
type: wiki-page
slug: knowledge-readme
status: accepted
title: Knowledge Home
---
`,
    );
    writeDoc(
      repo,
      'docs/specs/README.md',
      `---
type: feature-spec
slug: specs-readme
status: accepted
title: Specs Index
---
`,
    );
    writeDoc(
      repo,
      'docs/specs/feature-a.md',
      `---
type: feature-spec
slug: feature-a
status: draft
title: Feature A
---
`,
    );
    writeDoc(
      repo,
      'docs/specs/specs.md',
      `---
type: feature-spec
slug: legacy-index
status: draft
title: Legacy Index
---
`,
    );

    const index = new DocIndex(repo);
    const tree = buildDocsTree(index);
    expect(tree).not.toBeNull();
    expect(tree!.indexPageSlug).toBe('knowledge-readme');

    const specs = tree!.children.find((child) => child.kind === 'folder' && child.relativePath === 'specs');
    expect(specs?.kind).toBe('folder');
    if (specs?.kind !== 'folder') {
      return;
    }
    expect(specs.indexPageSlug).toBe('specs-readme');
    expect(specs.children.some((child) => child.kind === 'page' && child.relativePath === 'specs/README.md')).toBe(
      false,
    );
    expect(specs.children.some((child) => child.kind === 'page' && child.slug === 'legacy-index')).toBe(true);
  });
});
