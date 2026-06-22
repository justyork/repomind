import { describe, expect, it } from 'vitest';
import { CATALOG_LABELS, groupDocsByCatalog } from '../ui/src/catalog.ts';

describe('groupDocsByCatalog', () => {
  it('groups and sorts docs by catalog order', () => {
    const groups = groupDocsByCatalog([
      {
        slug: 'b',
        type: 'glossary-term',
        title: 'Beta',
        status: 'accepted',
        relativePath: 'glossary/b.md',
      },
      {
        slug: 'a',
        type: 'adr',
        title: 'Alpha',
        status: 'draft',
        relativePath: 'adr/a.md',
      },
      {
        slug: 'c',
        type: 'adr',
        title: 'Charlie',
        status: 'accepted',
        relativePath: 'adr/c.md',
      },
    ]);

    expect(groups.map((g) => g.type)).toEqual(['adr', 'glossary-term']);
    expect(groups[0]?.docs.map((d) => d.slug)).toEqual(['a', 'c']);
    expect(CATALOG_LABELS['adr']).toBe('ADR');
  });

  it('splits wiki pages by top-level docs folder', () => {
    const groups = groupDocsByCatalog([
      {
        slug: 'net-overview',
        type: 'wiki-page',
        title: 'Network',
        status: 'accepted',
        relativePath: 'architecture/network/overview.md',
      },
      {
        slug: 'product-vision',
        type: 'wiki-page',
        title: 'Vision',
        status: 'accepted',
        relativePath: 'product/vision.md',
      },
      {
        slug: 'changelog',
        type: 'wiki-page',
        title: 'Changelog',
        status: 'accepted',
        relativePath: 'CHANGELOG.md',
      },
    ]);

    expect(groups.map((g) => g.type)).toEqual([
      'folder:architecture',
      'folder:product',
      'folder:__root__',
    ]);
    expect(groups[0]?.label).toBe('Architecture');
    expect(groups[0]?.subfolders?.[0]?.label).toBe('Network');
    expect(groups[2]?.docs[0]?.slug).toBe('changelog');
  });
});
