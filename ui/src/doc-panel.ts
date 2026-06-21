import { marked } from 'marked';
import type { DocDetail } from './api.js';

export interface DocPanelOptions {
  onFork?: (slug: string) => void;
}

export function renderDocPanel(
  container: HTMLElement,
  doc: DocDetail | null,
  options: DocPanelOptions = {},
): void {
  if (!doc || !doc.found) {
    container.innerHTML = `
      <div class="workspace-empty">
        <h1>Knowledge workspace</h1>
        <p class="placeholder">Select a document from the sidebar or create a new draft.</p>
      </div>
    `;
    return;
  }

  const fm = doc.frontmatter ?? {};
  const title = typeof fm.title === 'string' ? fm.title : doc.slug;
  const status = typeof fm.status === 'string' ? fm.status : '';
  const type = typeof fm.type === 'string' ? fm.type : '';
  const related = Array.isArray(fm.related)
    ? fm.related.filter((r): r is string => typeof r === 'string')
    : [];

  container.innerHTML = `
    <div class="workspace-toolbar">
      <div class="workspace-title-row">
        <h1 class="doc-title">${escapeHtml(title)}</h1>
        <div class="workspace-badges">
          <span class="badge">${escapeHtml(type)}</span>
          <span class="badge">${escapeHtml(status)}</span>
        </div>
      </div>
      <div class="workspace-actions">
        <button type="button" id="fork-draft" class="btn-primary">Edit as draft</button>
        <button type="button" id="copy-path" class="btn-ghost">Copy path</button>
      </div>
    </div>
    ${
      related.length > 0
        ? `<div class="related-row"><span class="related-label">Related:</span> ${related.map((s) => `<button type="button" class="related-chip" data-slug="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')}</div>`
        : ''
    }
    <div class="reader-tabs tabs">
      <button class="tab active" data-tab="preview">Document</button>
      <button class="tab" data-tab="frontmatter">Frontmatter</button>
      <button class="tab" data-tab="agent">Agent JSON</button>
    </div>
    <div class="reader-body">
      <div id="tab-preview" class="tab-panel active markdown-preview reader-preview"></div>
      <div id="tab-frontmatter" class="tab-panel"></div>
      <div id="tab-agent" class="tab-panel"></div>
    </div>
    <footer class="workspace-footer">
      <code id="doc-path">${escapeHtml(doc.path ?? '')}</code>
    </footer>
  `;

  const previewEl = container.querySelector<HTMLDivElement>('#tab-preview')!;
  previewEl.innerHTML = marked.parse(doc.body ?? '', { async: false }) as string;

  const fmEl = container.querySelector<HTMLDivElement>('#tab-frontmatter')!;
  fmEl.innerHTML = `<pre class="frontmatter-yaml"></pre>`;
  fmEl.querySelector('pre')!.textContent = JSON.stringify(fm, null, 2);

  const agentEl = container.querySelector<HTMLDivElement>('#tab-agent')!;
  agentEl.innerHTML = `<pre class="agent-json"></pre>`;
  agentEl.querySelector('pre')!.textContent = JSON.stringify(doc.agentShape, null, 2);

  container.querySelectorAll<HTMLButtonElement>('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      container.querySelectorAll('.reader-tabs .tab').forEach((t) => t.classList.remove('active'));
      container.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      container.querySelector(`#tab-${tab}`)?.classList.add('active');
    });
  });

  container.querySelector<HTMLButtonElement>('#copy-path')?.addEventListener('click', () => {
    if (doc.path) {
      void navigator.clipboard.writeText(doc.path);
    }
  });

  container.querySelector<HTMLButtonElement>('#fork-draft')?.addEventListener('click', () => {
    if (doc.slug && options.onFork) {
      options.onFork(doc.slug);
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
