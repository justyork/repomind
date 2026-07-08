import { describe, expect, it } from 'vitest';
import { slugifyHeading } from '../ui/src/doc-outline.ts';

describe('doc-outline', () => {
  it('slugifies heading text uniquely', () => {
    const used = new Set<string>();
    expect(slugifyHeading('Hello World', 0, used)).toBe('hello-world');
    used.add('hello-world');
    expect(slugifyHeading('Hello World', 1, used)).toBe('hello-world-2');
  });

  it('falls back to section index for empty text', () => {
    const used = new Set<string>();
    expect(slugifyHeading('!!!', 2, used)).toBe('section-3');
  });
});
