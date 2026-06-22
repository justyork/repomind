import { describe, expect, it } from 'vitest';
import {
  parseSlugFromHref,
  resolveDocsKnowledgeHref,
  resolveMarkdownHref,
  slugForMarkdownHref,
} from '../ui/src/resolve-md-href.ts';

describe('resolve-md-href', () => {
  const slugByRelative = new Map<string, string>([
    ['README.md', 'knowledge-readme'],
    ['specs/feature-a.md', 'feature-a'],
    ['glossary/caravan.md', 'caravan'],
  ]);

  it('resolves relative markdown paths', () => {
    expect(resolveMarkdownHref('specs/README.md', '../glossary/caravan.md')).toBe('glossary/caravan.md');
    expect(resolveMarkdownHref('specs/feature-a.md', './feature-a')).toBe('specs/feature-a.md');
  });

  it('parses slug query links', () => {
    expect(parseSlugFromHref('?slug=caravan')).toBe('caravan');
    expect(parseSlugFromHref('http://127.0.0.1:3847/?slug=caravan')).toBe('caravan');
  });

  it('resolves docs-root style paths', () => {
    expect(resolveDocsKnowledgeHref('docs/README.md')).toBe('README.md');
    expect(resolveDocsKnowledgeHref('/adr/foo.md')).toBe('adr/foo.md');
  });

  it('maps hrefs to slugs', () => {
    expect(slugForMarkdownHref('specs/README.md', 'docs/README.md', slugByRelative)).toBe(
      'knowledge-readme',
    );
    expect(slugForMarkdownHref('specs/README.md', 'feature-a.md', slugByRelative)).toBe('feature-a');
    expect(slugForMarkdownHref('specs/README.md', '?slug=caravan', slugByRelative)).toBe('caravan');
    expect(slugForMarkdownHref('specs/README.md', 'https://example.com', slugByRelative)).toBeNull();
  });
});

describe('renderMarkdown internal links', () => {
  it('renders relative md links as wikilink navigation anchors', async () => {
    const { renderMarkdown } = await import('../ui/src/markdown.ts');
    const html = renderMarkdown('See [caravan](../glossary/caravan.md).', {
      docRelativePath: 'specs/README.md',
      slugByRelative: new Map([['glossary/caravan.md', 'caravan']]),
    });
    expect(html).toContain('data-slug="caravan"');
    expect(html).toContain('class="wikilink"');
  });

  it('does not emit relative hrefs for unresolved links', async () => {
    const { renderMarkdown } = await import('../ui/src/markdown.ts');
    const html = renderMarkdown('See [outside](../../apps/web/docs/README.md).', {
      docRelativePath: 'README.md',
      slugByRelative: new Map([['README.md', 'readme']]),
    });
    expect(html).not.toMatch(/href="[^"]*apps\/web/);
    expect(html).toContain('md-link-unresolved');
  });
});
