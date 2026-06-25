import { describe, expect, it } from 'vitest';
import { wikilinkPickFromDoc, wikilinkPickFromRawSlug } from '../ui/src/wikilink-ui.ts';

describe('wikilink-ui', () => {
  it('uses title as label when different from slug', () => {
    expect(wikilinkPickFromDoc({ slug: 'caravan', title: 'Caravan' })).toEqual({
      slug: 'caravan',
      label: 'Caravan',
    });
  });

  it('uses slug as label when title matches slug', () => {
    expect(wikilinkPickFromDoc({ slug: 'caravan', title: 'caravan' })).toEqual({
      slug: 'caravan',
      label: 'caravan',
    });
  });

  it('normalizes raw slug input', () => {
    expect(wikilinkPickFromRawSlug('My Page')).toEqual({
      slug: 'my-page',
      label: 'my-page',
    });
  });

  it('rejects invalid slug characters', () => {
    expect(wikilinkPickFromRawSlug('bad slug!')).toBeNull();
  });
});
