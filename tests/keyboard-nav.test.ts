import { describe, expect, it } from 'vitest';
import { collectTreeSlugs } from '../ui/src/keyboard-nav.ts';
import type { TreeFolderNode } from '../ui/src/api.ts';

function sampleTree(): TreeFolderNode {
  return {
    kind: 'folder',
    name: 'docs',
    relativePath: '',
    emoji: null,
    indexPageSlug: 'readme',
    indexPageType: 'wiki-page',
    indexPageContentKind: 'markdown',
    children: [
      {
        kind: 'page',
        name: 'README',
        relativePath: 'README.md',
        slug: 'readme',
        title: 'Readme',
        status: 'accepted',
        type: 'wiki-page',
        contentKind: 'markdown',
      },
      {
        kind: 'page',
        name: 'caravan',
        relativePath: 'glossary/caravan.md',
        slug: 'caravan',
        title: 'Caravan',
        status: 'accepted',
        type: 'glossary-term',
        contentKind: 'markdown',
      },
      {
        kind: 'folder',
        name: 'specs',
        relativePath: 'specs',
        emoji: null,
        indexPageSlug: 'specs-readme',
        indexPageType: 'wiki-page',
        indexPageContentKind: 'markdown',
        children: [
          {
            kind: 'page',
            name: 'README',
            relativePath: 'specs/README.md',
            slug: 'specs-readme',
            title: 'Specs Readme',
            status: 'accepted',
            type: 'wiki-page',
            contentKind: 'markdown',
          },
          {
            kind: 'page',
            name: 'convoy-rules',
            relativePath: 'specs/convoy-rules.md',
            slug: 'convoy-rules',
            title: 'Convoy Rules',
            status: 'draft',
            type: 'feature-spec',
            contentKind: 'markdown',
          },
        ],
      },
    ],
  };
}

describe('collectTreeSlugs', () => {
  it('returns depth-first slug order', () => {
    expect(collectTreeSlugs(sampleTree())).toEqual([
      'readme',
      'caravan',
      'specs-readme',
      'convoy-rules',
    ]);
  });
});
