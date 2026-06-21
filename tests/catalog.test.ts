import { describe, expect, it } from 'vitest';
import { CATALOG_LABELS, groupDocsByCatalog } from '../ui/src/catalog.ts';

describe('groupDocsByCatalog', () => {
  it('groups and sorts docs by catalog order', () => {
    const groups = groupDocsByCatalog([
      { slug: 'b', type: 'glossary-term', title: 'Beta', status: 'accepted' },
      { slug: 'a', type: 'adr', title: 'Alpha', status: 'draft' },
      { slug: 'c', type: 'adr', title: 'Charlie', status: 'accepted' },
    ]);

    expect(groups.map((g) => g.type)).toEqual(['adr', 'glossary-term']);
    expect(groups[0]?.docs.map((d) => d.slug)).toEqual(['a', 'c']);
    expect(CATALOG_LABELS['adr']).toBe('ADR');
  });
});
