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

describe('buildDocsTree README files', () => {
  it('lists README.md as regular page nodes in the tree', () => {
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
    expect(tree!.indexPageType).toBe('wiki-page');
    expect(tree!.indexPageContentKind).toBe('markdown');

    const specs = tree!.children.find((child) => child.kind === 'folder' && child.relativePath === 'specs');
    expect(specs?.kind).toBe('folder');
    if (specs?.kind !== 'folder') {
      return;
    }
    expect(specs.indexPageSlug).toBe('specs-readme');
    expect(specs.indexPageType).toBe('feature-spec');
    expect(specs.children.some((child) => child.kind === 'page' && child.relativePath === 'specs/README.md')).toBe(
      true,
    );
    expect(specs.children.some((child) => child.kind === 'page' && child.slug === 'specs-readme')).toBe(true);
    expect(specs.children.some((child) => child.kind === 'page' && child.slug === 'legacy-index')).toBe(true);
  });
});

describe('buildDocsTree sibling page+folder', () => {
  it('merges same-named page file and folder into one expandable page node', () => {
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

    const tree = buildDocsTree(new DocIndex(repo));
    const wiki = tree?.children.find((child) => child.kind === 'folder' && child.relativePath === 'wiki');
    expect(wiki?.kind).toBe('folder');
    if (wiki?.kind !== 'folder') {
      return;
    }

    expect(wiki.children.some((child) => child.kind === 'folder' && child.relativePath === 'wiki/roadmap')).toBe(
      false,
    );

    const roadmap = wiki.children.find((child) => child.kind === 'page' && child.relativePath === 'wiki/roadmap.md');
    expect(roadmap?.kind).toBe('page');
    if (roadmap?.kind !== 'page') {
      return;
    }
    expect(roadmap.childFolderPath).toBe('wiki/roadmap');
    expect(roadmap.children?.some((child) => child.kind === 'page' && child.slug === 'wiki-roadmap-child')).toBe(
      true,
    );
  });
});
