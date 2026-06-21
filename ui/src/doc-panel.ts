import { marked } from 'marked';
import type { DocDetail } from './api.js';

export function renderDocPanel(container: HTMLElement, doc: DocDetail | null): void {
  if (!doc || !doc.found) {
    container.innerHTML = '<p class="placeholder">Select a document</p>';
    return;
  }

  const fm = doc.frontmatter ?? {};
  const title = typeof fm.title === 'string' ? fm.title : doc.slug;
  const status = typeof fm.status === 'string' ? fm.status : '';
  const type = typeof fm.type === 'string' ? fm.type : '';

  container.innerHTML = `
    <h1 style="font-size:1.1rem;margin:0 0 0.5rem">${title}</h1>
    <div><span class="badge">${type}</span><span class="badge">${status}</span></div>
    <div class="tabs">
      <button class="tab active" data-tab="preview">Preview</button>
      <button class="tab" data-tab="frontmatter">Frontmatter</button>
      <button class="tab" data-tab="agent">Agent</button>
    </div>
    <div id="tab-preview" class="tab-panel active markdown-preview"></div>
    <div id="tab-frontmatter" class="tab-panel"></div>
    <div id="tab-agent" class="tab-panel"></div>
    <div class="path-row">
      <code id="doc-path">${doc.path ?? ''}</code>
      <button type="button" id="copy-path">Copy path</button>
    </div>
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
      container.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
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
}
