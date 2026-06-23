import { describe, expect, it } from 'vitest';
import { renderBreadcrumb } from '../ui/src/page-shell.ts';

describe('page-shell', () => {
  it('renders breadcrumb with current page', () => {
    const html = renderBreadcrumb([
      { label: 'Knowledge', crumbId: 'root' },
      { label: 'Drafts' },
      { label: 'My page', current: true },
    ]);
    expect(html).toContain('data-crumb="root"');
    expect(html).toContain('class="crumb current"');
    expect(html).toContain('My page');
  });
});
