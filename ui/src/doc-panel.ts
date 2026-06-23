import { enhanceMermaidPreview, renderMarkdown } from './markdown.js';
import { buildPageUrl } from './navigation.js';
import { getBacklinks } from './api.js';
import { catalogLabel } from './catalog.js';
import {
  bindBreadcrumbNavigation,
  bindFocusToggle,
  escapeHtml,
  loadFocusMode,
  renderPageShell,
} from './page-shell.js';
import { renderStructuredPreview } from './structured-preview.js';
import type { DocDetail } from './api.js';

export interface DocPanelOptions {
  onEdit?: (slug: string) => void;
  docRelativePath?: string;
  slugByRelative?: Map<string, string>;
  onCopyLink?: () => void;
  onNavigateCatalog?: () => void;
  onNavigateRoot?: () => void;
}

function renderReadPropertiesRail(doc: DocDetail, fm: Record<string, unknown>): string {
  const title = typeof fm.title === 'string' ? fm.title : doc.slug ?? '';
  const status = typeof fm.status === 'string' ? fm.status : '';
  const type = typeof fm.type === 'string' ? fm.type : '';
  const domain = typeof fm.domain === 'string' ? fm.domain : '';
  const tags = Array.isArray(fm.tags)
    ? fm.tags.filter((t): t is string => typeof t === 'string')
    : [];
  const related = Array.isArray(fm.related)
    ? fm.related.filter((r): r is string => typeof r === 'string')
    : [];
  const contentKind = doc.contentKind ?? 'markdown';

  return `
    <h2 class="page-info-title">Page info</h2>
    <dl class="info-list">
      <dt>Status</dt><dd><span class="status-chip status-${escapeHtml(status)}">${escapeHtml(status)}</span></dd>
      <dt>Type</dt><dd>${escapeHtml(type)}</dd>
      ${domain ? `<dt>Domain</dt><dd>${escapeHtml(domain)}</dd>` : ''}
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
  `;
}

export function renderDocPanel(
  container: HTMLElement,
  doc: DocDetail | null,
  options: DocPanelOptions = {},
): void {
  if (!doc || !doc.found) {
    container.className = 'workspace-main';
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
  const type = typeof fm.type === 'string' ? fm.type : '';
  const catalog = catalogLabel(type);
  const focusMode = loadFocusMode();
  const contentKind = doc.contentKind ?? 'markdown';
  const isStructured = contentKind === 'json' || contentKind === 'yaml';
  const editButton = isStructured
    ? ''
    : '<button type="button" id="edit-page" class="btn-primary">Edit</button>';

  const shell = renderPageShell(container, {
    breadcrumbs: [
      { label: 'Knowledge', crumbId: 'root' },
      { label: catalog, crumbId: 'catalog' },
      { label: title, current: true },
    ],
    titleHtml: `<h1 class="doc-title">${escapeHtml(title)}</h1>`,
    actionsHtml: `
      <button type="button" id="toggle-focus" class="btn-ghost" aria-pressed="${focusMode}">
        ${focusMode ? 'Show info' : 'Hide info'}
      </button>
      ${editButton}
      <button type="button" id="copy-link" class="btn-ghost">Copy link</button>
      <button type="button" id="copy-path" class="btn-ghost">Copy path</button>
    `,
    mainHtml: `
      <div id="tab-preview" class="markdown-preview reader-preview"></div>
      <section id="reader-backlinks" class="reader-backlinks hidden" aria-label="Backlinks"></section>
    `,
    railHtml: renderReadPropertiesRail(doc, fm),
    focusMode,
  });

  bindFocusToggle(container, focusMode);
  bindBreadcrumbNavigation(container, {
    root: () => options.onNavigateRoot?.(),
    catalog: () => options.onNavigateCatalog?.(),
  });

  const previewEl = shell.bodySlot.querySelector<HTMLDivElement>('#tab-preview')!;
  if (isStructured) {
    previewEl.innerHTML = renderStructuredPreview(doc.body ?? '', contentKind);
  } else {
    const markdownContext =
      options.docRelativePath && options.slugByRelative
        ? { docRelativePath: options.docRelativePath, slugByRelative: options.slugByRelative }
        : undefined;
    previewEl.innerHTML = renderMarkdown(doc.body ?? '', markdownContext);
    void enhanceMermaidPreview(previewEl);

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

  const fmEl = shell.railSlot.querySelector<HTMLDivElement>('#tab-frontmatter')!;
  fmEl.innerHTML = `<pre class="frontmatter-yaml"></pre>`;
  fmEl.querySelector('pre')!.textContent = JSON.stringify(fm, null, 2);

  const agentEl = shell.railSlot.querySelector<HTMLDivElement>('#tab-agent')!;
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

  shell.railSlot.querySelectorAll<HTMLButtonElement>('.related-chip').forEach((chip) => {
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
        const section = shell.bodySlot.querySelector<HTMLElement>('#reader-backlinks');
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
