import { describe, expect, it } from 'vitest';
import { chunkDoc } from '../src/embeddings/chunks.ts';
import type { DocRecord } from '../src/index/types.ts';

function doc(body: string, title = 'Guide'): DocRecord {
  return {
    path: '/x/guide.md', relativePath: 'wiki/guide.md', slug: 'guide', type: 'wiki-page', domain: 'shared',
    status: 'accepted', title, tags: [], related: [], body,
    frontmatter: { type: 'wiki-page', slug: 'guide', status: 'accepted' }, prepared: true, contentKind: 'markdown',
  };
}

describe('chunkDoc', () => {
  it('makes one chunk per section, prefixed with the title and heading', () => {
    const chunks = chunkDoc(doc('intro text\n\n## Install\nrun it\n\n## Billing\npay monthly'));
    expect(chunks.map((c) => c.section)).toEqual([null, 'Install', 'Billing']);
    expect(chunks[1]!.text).toContain('Guide');
    expect(chunks[1]!.text).toContain('Install');
    expect(chunks[1]!.text).toContain('run it');
  });

  it('splits an oversized section on paragraph boundaries', () => {
    const paragraph = 'слово '.repeat(60).trim();
    const chunks = chunkDoc(doc(['## Big', paragraph, paragraph, paragraph, paragraph].join('\n\n')), { maxChars: 800 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.text.length <= 800 + 100)).toBe(true);
    expect(new Set(chunks.map((c) => c.section))).toEqual(new Set(['Big']));
  });

  it('hard-splits a single huge paragraph', () => {
    const chunks = chunkDoc(doc('## Wall\n' + 'x'.repeat(5000)), { maxChars: 1000 });
    expect(chunks.length).toBeGreaterThanOrEqual(5);
  });

  it('handles pages without headings and empty bodies', () => {
    expect(chunkDoc(doc('just text')).map((c) => c.section)).toEqual([null]);
    expect(chunkDoc(doc('   '))).toEqual([]);
  });

  it('caps chunks per document', () => {
    const body = Array.from({ length: 200 }, (_, i) => `## S${i}\ntext ${i}`).join('\n\n');
    expect(chunkDoc(doc(body), { maxChunks: 40 })).toHaveLength(40);
  });
});
