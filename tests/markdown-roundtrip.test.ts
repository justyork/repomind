import { describe, expect, it } from 'vitest';
import {
  markdownRoundTrip,
  normalizeMarkdownForCompare,
  parseMarkdownToDoc,
  serializeDocToMarkdown,
} from '../ui/src/markdown-roundtrip.ts';

const CORPUS: Array<{ name: string; markdown: string }> = [
  { name: 'plain paragraph', markdown: 'A group of vehicles traveling together.' },
  { name: 'heading h1', markdown: '# Product Roadmap' },
  { name: 'heading h2', markdown: '## Summary' },
  { name: 'heading h3', markdown: '### Requirements' },
  { name: 'bold', markdown: 'This is **important** text.' },
  { name: 'italic', markdown: 'This is _emphasized_ text.' },
  { name: 'inline code', markdown: 'Use the `repo-mind` CLI.' },
  { name: 'external link', markdown: 'Read [docs](https://example.com/docs).' },
  { name: 'image', markdown: '![Diagram](assets/diagram.png)' },
  { name: 'wikilink simple', markdown: 'See [[caravan]] for glossary.' },
  { name: 'wikilink label', markdown: 'See [[Caravan term|caravan]] for glossary.' },
  { name: 'multiple wikilinks', markdown: 'Links: [[caravan]] and [[convoy-rules]].' },
  { name: 'bullet list', markdown: '- First item\n- Second item' },
  { name: 'ordered list', markdown: '1. Step one\n2. Step two' },
  { name: 'task unchecked', markdown: '- [ ] Todo item' },
  { name: 'task checked', markdown: '- [x] Done item' },
  { name: 'task list', markdown: '- [ ] Todo\n- [x] Done' },
  { name: 'code fence', markdown: '```typescript\nconst x = 1;\n```' },
  { name: 'mermaid fence', markdown: '```mermaid\ngraph LR\n  A --> B\n```' },
  { name: 'blockquote', markdown: '> Quoted wisdom\n> second line' },
  { name: 'horizontal rule', markdown: 'Before\n\n---\n\nAfter' },
  { name: 'wikilink in list', markdown: '- See [[caravan]]\n- Read [[convoy-rules]]' },
  { name: 'mixed block', markdown: '## Convoy\n\nRules for [[caravan]] movement.\n\n- [ ] Review\n- [x] Ship' },
  {
    name: 'convoy fixture',
    markdown: 'Rules for convoy movement. See [[caravan]] for glossary.',
  },
  {
    name: 'gfm table',
    markdown: '| Feature | Status |\n| --- | --- |\n| Editor | Done |\n| MCP | Done |',
  },
  {
    name: 'table with inline',
    markdown: '| Term | Meaning |\n| --- | --- |\n| **Caravan** | Vehicle group |',
  },
];

function expectRoundTrip(markdown: string): void {
  const roundTripped = markdownRoundTrip(markdown);
  expect(normalizeMarkdownForCompare(roundTripped)).toBe(normalizeMarkdownForCompare(markdown));
}

describe('markdown-roundtrip', () => {
  for (const fixture of CORPUS) {
    it(`round-trips: ${fixture.name}`, () => {
      expectRoundTrip(fixture.markdown);
    });
  }

  it('preserves wikilink slug in doc JSON', () => {
    const doc = parseMarkdownToDoc('See [[Caravan|caravan]] here.');
    const paragraph = doc.content?.[0];
    const wikilink = paragraph?.content?.find((node) => node.type === 'wikilink');
    expect(wikilink?.attrs).toEqual({ slug: 'caravan', label: 'Caravan' });
  });

  it('serializes wikilink back to markdown', () => {
    const doc = parseMarkdownToDoc('[[caravan]]');
    expect(serializeDocToMarkdown(doc)).toBe('[[caravan]]');
  });

  it('handles empty document', () => {
    const doc = parseMarkdownToDoc('');
    expect(doc.type).toBe('doc');
    expect(serializeDocToMarkdown(doc)).toBe('');
  });
});
