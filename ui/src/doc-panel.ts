import { enhanceMarkdownPreview, renderMarkdown } from './markdown.js';
import { catalogLabel } from './catalog.js';
import type { DocDetail } from './api.js';

export interface DocPanelOptions {
  onEdit?: (slug: string) => void;
}

export function renderDocPanel(
  container: HTMLElement,
  doc: DocDetail | null,
  options: DocPanelOptions = {},
): void {
  container.className = 'workspace-main';

  if (!doc || !doc.found) {
    container.innerHTML = `
      <div class="workspace-empty">
        <h1>Knowledge</h1>
        <p class="placeholder">Select a page from the tree or create one with +.</p>
      </div>
    `;
    return;
  }

  const fm = doc.frontmatter ?? {};
  const title = typeof fm.title === 'string' ? fm.title : doc.slug ?? '';
  const status = typeof fm.status === 'string' ? fm.status : '';
  const type = typeof fm.type === 'string' ? fm.type : '';
  const tags = Array.isArray(fm.tags)
    ? fm.tags.filter((t): t is string => typeof t === 'string')
    : [];
  const related = Array.isArray(fm.related)
    ? fm.related.filter((r): r is string => typeof r === 'string')
    : [];
  const catalog = catalogLabel(type);

  container.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <button type="button" class="crumb" data-crumb="root">Knowledge</button>
      <span class="crumb-sep">›</span>
      <button type="button" class="crumb" data-crumb="catalog">${escapeHtml(catalog)}</button>
      <span class="crumb-sep">›</span>
      <span class="crumb current">${escapeHtml(title)}</span>
    </nav>
    <div class="page-layout">
      <article class="page-content">
        <header class="page-header">
          <h1 class="doc-title">${escapeHtml(title)}</h1>
          <div class="workspace-actions">
            <button type="button" id="edit-page" class="btn-primary">Edit</button>
            <button type="button" id="copy-path" class="btn-ghost">Copy path</button>
          </div>
        </header>
        <div id="tab-preview" class="markdown-preview reader-preview"></div>
      </article>
      <aside class="page-info">
        <h2 class="page-info-title">Page info</h2>
        <dl class="info-list">
          <dt>Status</dt><dd><span class="status-chip status-${escapeHtml(status)}">${escapeHtml(status)}</span></dd>
          <dt>Type</dt><dd>${escapeHtml(type)}</dd>
          ${
            tags.length > 0
              ? `<dt>Tags</dt><dd>${tags.map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join(' ')}</dd>`
              : ''
          }
        </dl>
        ${
          related.length > 0
            ? `<div class="info-block"><div class="info-block-label">Related</div>${related.map((s) => `<button type="button" class="related-chip" data-slug="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}</div>`
            : ''
        }
        <div class="info-tabs tabs">
          <button class="tab active" data-tab="frontmatter">Frontmatter</button>
          <button class="tab" data-tab="agent">Agent JSON</button>
        </div>
        <div id="tab-frontmatter" class="tab-panel active"></div>
        <div id="tab-agent" class="tab-panel"></div>
        <footer class="page-info-footer">
          <code id="doc-path">${escapeHtml(doc.path ?? '')}</code>
        </footer>
      </aside>
    </div>
  `;

  const previewEl = container.querySelector<HTMLDivElement>('#tab-preview')!;
  previewEl.innerHTML = renderMarkdown(doc.body ?? '');
  void enhanceMarkdownPreview(previewEl);

  const fmEl = container.querySelector<HTMLDivElement>('#tab-frontmatter')!;
  fmEl.innerHTML = `<pre class="frontmatter-yaml"></pre>`;
  fmEl.querySelector('pre')!.textContent = JSON.stringify(fm, null, 2);

  const agentEl = container.querySelector<HTMLDivElement>('#tab-agent')!;
  agentEl.innerHTML = `<pre class="agent-json"></pre>`;
  agentEl.querySelector('pre')!.textContent = JSON.stringify(doc.agentShape, null, 2);

  container.querySelectorAll<HTMLButtonElement>('.info-tabs .tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      container.querySelectorAll('.info-tabs .tab').forEach((t) => t.classList.remove('active'));
      container.querySelectorAll('.page-info .tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      container.querySelector(`#tab-${tab}`)?.classList.add('active');
    });
  });

  container.querySelector<HTMLButtonElement>('#copy-path')?.addEventListener('click', () => {
    if (doc.path) {
      void navigator.clipboard.writeText(doc.path);
    }
  });

  container.querySelector<HTMLButtonElement>('#edit-page')?.addEventListener('click', () => {
    if (doc.slug && options.onEdit) {
      options.onEdit(doc.slug);
    }
  });

  container.querySelectorAll<HTMLButtonElement>('.related-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const slug = chip.dataset.slug;
      if (slug) {
        container.dispatchEvent(new CustomEvent('navigate-slug', { detail: { slug } }));
      }
    });
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
