import { enhanceMarkdownPreview, renderMarkdown } from './markdown.js';
import { buildPageUrl } from './navigation.js';
import { getBacklinks } from './api.js';
import { catalogLabel } from './catalog.js';
import { renderStructuredPreview } from './structured-preview.js';
import type { DocDetail } from './api.js';

export interface DocPanelOptions {
  onEdit?: (slug: string) => void;
  docRelativePath?: string;
  slugByRelative?: Map<string, string>;
  onCopyLink?: () => void;
}

const FOCUS_STORAGE_KEY = 'repomind-page-info-hidden';

function loadFocusMode(): boolean {
  try {
    const raw = localStorage.getItem(FOCUS_STORAGE_KEY);
    if (raw === null) {
      return true;
    }
    return raw === 'true';
  } catch {
    return true;
  }
}

function saveFocusMode(hidden: boolean): void {
  try {
    localStorage.setItem(FOCUS_STORAGE_KEY, hidden ? 'true' : 'false');
  } catch {
    // ignore
  }
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
        <p class="placeholder">Select a page from the tree or use the ⋯ menu to create one.</p>
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
  const focusMode = loadFocusMode();
  const contentKind = doc.contentKind ?? 'markdown';
  const isStructured = contentKind === 'json' || contentKind === 'yaml';
  const editButton = isStructured
    ? ''
    : '<button type="button" id="edit-page" class="btn-primary">Edit</button>';

  container.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <button type="button" class="crumb" data-crumb="root">Knowledge</button>
      <span class="crumb-sep">›</span>
      <button type="button" class="crumb" data-crumb="catalog">${escapeHtml(catalog)}</button>
      <span class="crumb-sep">›</span>
      <span class="crumb current">${escapeHtml(title)}</span>
    </nav>
    <div class="page-layout${focusMode ? ' page-layout--focus' : ''}">
      <article class="page-content">
        <header class="page-header">
          <h1 class="doc-title">${escapeHtml(title)}</h1>
          <div class="workspace-actions">
            <button type="button" id="toggle-focus" class="btn-ghost" aria-pressed="${focusMode}">
              ${focusMode ? 'Show info' : 'Hide info'}
            </button>
            ${editButton}
            <button type="button" id="copy-link" class="btn-ghost">Copy link</button>
            <button type="button" id="copy-path" class="btn-ghost">Copy path</button>
          </div>
        </header>
        <div id="tab-preview" class="markdown-preview reader-preview"></div>
        <section id="reader-backlinks" class="reader-backlinks hidden" aria-label="Backlinks"></section>
      </article>
      <aside class="page-info">
        <h2 class="page-info-title">Page info</h2>
        <dl class="info-list">
          <dt>Status</dt><dd><span class="status-chip status-${escapeHtml(status)}">${escapeHtml(status)}</span></dd>
          <dt>Type</dt><dd>${escapeHtml(type)}</dd>
          <dt>Format</dt><dd>${escapeHtml(contentKind)}</dd>
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
  if (isStructured) {
    previewEl.innerHTML = renderStructuredPreview(doc.body ?? '', contentKind);
  } else {
    const markdownContext =
      options.docRelativePath && options.slugByRelative
        ? { docRelativePath: options.docRelativePath, slugByRelative: options.slugByRelative }
        : undefined;
    previewEl.innerHTML = renderMarkdown(doc.body ?? '', markdownContext);
    void enhanceMarkdownPreview(previewEl);

    previewEl.querySelectorAll<HTMLAnchorElement>('a.wikilink').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const slug = link.dataset.slug;
        if (slug) {
          container.dispatchEvent(new CustomEvent('navigate-slug', { detail: { slug } }));
        }
      });
    });

    previewEl.querySelectorAll<HTMLAnchorElement>('a.md-link-unresolved').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
      });
    });
  }

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

  container.querySelector<HTMLButtonElement>('#toggle-focus')?.addEventListener('click', () => {
    const layout = container.querySelector('.page-layout');
    const btn = container.querySelector<HTMLButtonElement>('#toggle-focus');
    const next = !layout?.classList.contains('page-layout--focus');
    layout?.classList.toggle('page-layout--focus', next);
    saveFocusMode(next);
    if (btn) {
      btn.setAttribute('aria-pressed', String(next));
      btn.textContent = next ? 'Show info' : 'Hide info';
    }
  });

  container.querySelector<HTMLButtonElement>('#copy-path')?.addEventListener('click', () => {
    if (doc.path) {
      void navigator.clipboard.writeText(doc.path);
    }
  });

  container.querySelector<HTMLButtonElement>('#copy-link')?.addEventListener('click', () => {
    if (doc.slug) {
      void navigator.clipboard.writeText(buildPageUrl(doc.slug));
      options.onCopyLink?.();
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

  if (doc.slug && !isStructured) {
    void getBacklinks(doc.slug)
      .then(({ backlinks }) => {
        const section = container.querySelector<HTMLElement>('#reader-backlinks');
        if (!section || backlinks.length === 0) {
          return;
        }
        section.classList.remove('hidden');
        section.innerHTML = `
          <h2 class="reader-backlinks-title">Backlinks</h2>
          <div class="reader-backlinks-list">
            ${backlinks
              .map(
                (item) =>
                  `<button type="button" class="related-chip" data-slug="${escapeHtml(item.slug)}">${escapeHtml(item.title)} <span class="backlink-kind">${escapeHtml(item.kind)}</span></button>`,
              )
              .join('')}
          </div>
        `;
        section.querySelectorAll<HTMLButtonElement>('.related-chip').forEach((chip) => {
          chip.addEventListener('click', () => {
            const slug = chip.dataset.slug;
            if (slug) {
              container.dispatchEvent(new CustomEvent('navigate-slug', { detail: { slug } }));
            }
          });
        });
      })
      .catch(() => {
        // backlinks are optional enrichment
      });
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
