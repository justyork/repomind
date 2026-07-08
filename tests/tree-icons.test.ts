import { describe, expect, it } from 'vitest';
import type { TreeFolderNode } from '../ui/src/api.js';
import {
  renderTreeFolderIcon,
  renderTreeFolderNodeIcon,
  renderTreePageIcon,
} from '../ui/src/tree-icons.js';

function folderNode(overrides: Partial<TreeFolderNode> = {}): TreeFolderNode {
  return {
    kind: 'folder',
    name: 'Specs',
    relativePath: 'specs',
    emoji: null,
    indexPageSlug: 'specs-readme',
    indexPageTitle: 'Specs Readme',
    indexPageRelativePath: 'specs/README.md',
    indexPageType: 'wiki-page',
    indexPageContentKind: 'markdown',
    children: [],
    ...overrides,
  };
}

describe('tree-icons', () => {
  it('uses page icon for folders with an index page', () => {
    const html = renderTreeFolderNodeIcon(folderNode());
    expect(html).toContain('tree-icon--page');
    expect(html).not.toContain('tree-icon--folder');
  });

  it('uses folder icon for folders without an index page', () => {
    const html = renderTreeFolderNodeIcon(
      folderNode({
        indexPageSlug: null,
        indexPageTitle: null,
        indexPageRelativePath: null,
        indexPageType: null,
        indexPageContentKind: null,
      }),
    );
    expect(html).toContain('tree-icon--folder');
    expect(html).not.toContain('tree-icon--page');
  });

  it('uses page icon for standalone page rows', () => {
    const html = renderTreePageIcon('wiki-page', 'markdown');
    expect(html).toContain('tree-icon--page');
    expect(html).not.toContain('tree-icon--folder');
  });

  it('exposes flat folder and page icons', () => {
    expect(renderTreeFolderIcon()).toContain('tree-icon--folder');
    expect(renderTreePageIcon('feature-spec', 'markdown')).toContain('tree-icon--page');
  });
});
