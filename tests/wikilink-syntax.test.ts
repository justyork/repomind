import { describe, expect, it } from 'vitest';
import {
  extractWikilinkTargets,
  formatWikilink,
  parseWikilinkMatch,
  WIKILINK_PATTERN,
} from '../ui/src/wikilink-syntax.ts';

describe('wikilink-syntax', () => {
  it('parses simple wikilink', () => {
    expect(parseWikilinkMatch('caravan')).toEqual({ display: 'caravan', slug: 'caravan' });
  });

  it('parses label|slug wikilink', () => {
    expect(parseWikilinkMatch('Caravan', 'caravan')).toEqual({
      display: 'Caravan',
      slug: 'caravan',
    });
  });

  it('trims whitespace in parts', () => {
    expect(parseWikilinkMatch(' Caravan ', ' caravan ')).toEqual({
      display: 'Caravan',
      slug: 'caravan',
    });
  });

  it('formats simple wikilink', () => {
    expect(formatWikilink('caravan')).toBe('[[caravan]]');
  });

  it('formats label|slug wikilink', () => {
    expect(formatWikilink('Caravan', 'caravan')).toBe('[[Caravan|caravan]]');
  });

  it('extracts targets from body', () => {
    const body = 'See [[caravan]] and [[Convoy|convoy-rules]] for details.';
    expect(extractWikilinkTargets(body)).toEqual(['caravan', 'convoy-rules']);
  });

  it('matches pattern globally', () => {
    const text = '[[a]] [[b|c]]';
    const matches = [...text.matchAll(WIKILINK_PATTERN)];
    expect(matches).toHaveLength(2);
    expect(matches[0]?.[1]).toBe('a');
    expect(matches[1]?.[1]).toBe('b');
    expect(matches[1]?.[2]).toBe('c');
  });
});
