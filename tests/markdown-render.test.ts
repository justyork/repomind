import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../ui/src/markdown.ts';

describe('renderMarkdown', () => {
  it('renders task lists without duplicate bullets', () => {
    const html = renderMarkdown('- [ ] Todo\n- [x] Done');
    expect(html).toContain('contains-task-list');
    expect(html).toContain('task-list-item-checkbox');
    expect(html).not.toContain('<li><input');
  });

  it('renders mermaid code blocks', () => {
    const html = renderMarkdown('```mermaid\ngraph LR\n  A --> B\n```');
    expect(html).toContain('class="mermaid"');
    expect(html).toContain('graph LR');
  });
});
