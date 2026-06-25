import { describe, expect, it } from 'vitest';
import type { TreePageNode } from '../ui/src/api.js';
import { createParentPathForPage, pageNeedsPromote } from '../ui/src/tree-page-parent.js';

function page(relativePath: string, extras: Partial<TreePageNode> = {}): TreePageNode {
  return {
    kind: 'page',
    relativePath,
    slug: 'test',
    title: 'Test',
    name: 'test',
    type: 'wiki-page',
    contentKind: 'markdown',
    ...extras,
  };
}

describe('tree-page-parent', () => {
  it('detects leaf pages that need promotion', () => {
    expect(pageNeedsPromote(page('product/wiki/roadmap.md'))).toBe(true);
    expect(pageNeedsPromote(page('README.md'))).toBe(false);
    expect(pageNeedsPromote(page('product/wiki/roadmap/README.md'))).toBe(false);
    expect(pageNeedsPromote(page('product/wiki/roadmap.md', { childFolderPath: 'product/wiki/roadmap' }))).toBe(
      false,
    );
  });

  it('resolves create parent for folder index pages and expandable pages', () => {
    expect(createParentPathForPage(page('product/wiki/roadmap/README.md'))).toBe('product/wiki/roadmap');
    expect(createParentPathForPage(page('README.md'))).toBe('');
    expect(createParentPathForPage(page('product/wiki/roadmap.md'))).toBe('product/wiki/roadmap');
    expect(
      createParentPathForPage(page('product/wiki/roadmap.md', { childFolderPath: 'product/wiki/roadmap' })),
    ).toBe('product/wiki/roadmap');
  });
});
