import { describe, expect, it } from 'vitest';
import {
  appendSourcesBlock,
  ensureCitations,
  extractCitedSlugs,
  hasCitationForSources,
} from '../src/ask/citations.ts';

describe('ask citations', () => {
  const sources = [
    { slug: 'auth', title: 'Authentication', excerpt: 'tokens' },
    { slug: 'cache', title: 'Cache Layer', excerpt: 'mtime' },
  ];

  it('extracts slugs from ?slug= links', () => {
    expect(extractCitedSlugs('See [Auth](?slug=auth) and [Cache](?slug=cache).')).toEqual([
      'auth',
      'cache',
    ]);
  });

  it('detects missing citations', () => {
    expect(hasCitationForSources('No links here.', sources)).toBe(false);
    expect(hasCitationForSources('See [Auth](?slug=auth).', sources)).toBe(true);
  });

  it('appends a sources block', () => {
    const result = appendSourcesBlock('Answer body.', sources);
    expect(result).toContain('## Sources');
    expect(result).toContain('[Authentication](?slug=auth)');
    expect(result).toContain('[Cache Layer](?slug=cache)');
  });

  it('ensures citations without duplicating when present', () => {
    const withLink = 'Done. [Authentication](?slug=auth)';
    expect(ensureCitations(withLink, sources)).toBe(withLink);
    const withoutLink = ensureCitations('Done.', sources);
    expect(withoutLink).toContain('## Sources');
  });
});
