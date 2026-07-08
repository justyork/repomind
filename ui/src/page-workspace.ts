import {
  getBacklinks,
  openDraftForSlug,
  type DocDetail,
  type Draft,
  type ListDocsItem,
} from './api.js';
import { catalogLabel } from './catalog.js';
import { bindDraftSession, renderEditorActionsHtml, type DraftSessionHandle } from './draft-session.js';
import { mountDocOutline, type DocOutlineHandle } from './doc-outline.js';
import { renderEditorPropertiesRail } from './editor-properties.js';
import { enhanceMermaidPreview, renderMarkdown } from './markdown.js';
import { buildPageUrl } from './navigation.js';
import {
  bindBreadcrumbNavigation,
  bindFocusToggle,
  escapeHtml,
  loadFocusMode,
  renderPageShell,
} from './page-shell.js';
import { renderStructuredPreview } from './structured-preview.js';
import { resetWorkspaceScroll, scheduleWorkspaceScrollReset } from './workspace-scroll.js';

export interface PageWorkspaceOptions {
  docIndex: ListDocsItem[];
  docRelativePath?: string;
  slugByRelative?: Map<string, string>;
  onCopyLink?: () => void;
  onNavigateCatalog?: () => void;
  onNavigateRoot?: () => void;
  onPublished: (path: string) => void | Promise<void>;
  onError: (message: string) => void;
  onReloadDoc: (slug: string) => Promise<DocDetail>;
  onDraftsChanged?: () => void;
}

let activeSession: DraftSessionHandle | null = null;
let activeOutline: DocOutlineHandle | null = null;

export function destroyPageWorkspace(): void {
  activeSession?.destroy();
  activeSession = null;
  activeOutline?.destroy();
  activeOutline = null;
}

function renderReadPropertiesRail(doc: DocDetail, fm: Record<string, unknown>): string {
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

function bindReadRailTabs(container: HTMLElement): void {
  container.querySelectorAll<HTMLButtonElement>('.info-tabs .tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      container.querySelectorAll('.info-tabs .tab').forEach((t) => t.classList.remove('active'));
      container.querySelectorAll('.page-info .tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      container.querySelector(`#tab-${tab}`)?.classList.add('active');
    });
  });
}

function bindSlugNavigation(container: HTMLElement): void {
  container.querySelectorAll<HTMLButtonElement>('.related-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const slug = chip.dataset.slug;
      if (slug) {
        container.dispatchEvent(new CustomEvent('navigate-slug', { detail: { slug } }));
      }
    });
  });
}

function pageBreadcrumbs(doc: DocDetail, title: string, type: string) {
  return [
    { label: 'Knowledge', crumbId: 'root' },
    { label: catalogLabel(type), crumbId: 'catalog' },
    { label: title, current: true },
  ];
}

function renderEditMode(
  container: HTMLElement,
  doc: DocDetail,
  draft: Draft,
  options: PageWorkspaceOptions,
): void {
  destroyPageWorkspace();

  const fm = doc.frontmatter ?? {};
  const title = typeof fm.title === 'string' ? fm.title : doc.slug ?? '';
  const type = typeof fm.type === 'string' ? fm.type : '';
  const focusMode = loadFocusMode();

  const shell = renderPageShell(container, {
    rootClass: 'workspace-main workspace-editor workspace-page',
    breadcrumbs: pageBreadcrumbs(doc, title, type),
    titleHtml: `<input id="ed-title" class="title-input doc-title" type="text" placeholder="Document title" />`,
    actionsHtml: renderEditorActionsHtml(focusMode, { showDiscard: true }),
    mainHtml: `<div id="ed-visual-canvas"></div>`,
    railHtml: renderEditorPropertiesRail({ forkedFrom: draft.forked_from }),
    focusMode,
  });

  bindFocusToggle(container, focusMode);

  activeSession = bindDraftSession(container, shell, draft, {
    onPublished: (path) => {
      void (async () => {
        await options.onPublished(path);
        options.onDraftsChanged?.();
        if (doc.slug) {
          const refreshed = await options.onReloadDoc(doc.slug);
          renderReadMode(container, refreshed, options);
        }
      })();
    },
    onClosed: () => {
      void (async () => {
        options.onDraftsChanged?.();
        if (doc.slug) {
          try {
            const refreshed = await options.onReloadDoc(doc.slug);
            renderReadMode(container, refreshed, options);
          } catch (err) {
            options.onError(err instanceof Error ? err.message : 'Failed to reload page');
          }
        }
      })();
    },
    onDeleted: () => {
      options.onDraftsChanged?.();
      if (doc.slug) {
        void options.onReloadDoc(doc.slug).then(
          (refreshed) => renderReadMode(container, refreshed, options),
          () => renderReadMode(container, doc, options),
        );
      }
    },
    onError: options.onError,
  }, options.docIndex);
}

function renderReadMode(
  container: HTMLElement,
  doc: DocDetail,
  options: PageWorkspaceOptions,
): void {
  destroyPageWorkspace();

  const fm = doc.frontmatter ?? {};
  const title = typeof fm.title === 'string' ? fm.title : doc.slug ?? '';
  const type = typeof fm.type === 'string' ? fm.type : '';
  const focusMode = loadFocusMode();
  const contentKind = doc.contentKind ?? 'markdown';
  const isStructured = contentKind === 'json' || contentKind === 'yaml';

  const shell = renderPageShell(container, {
    rootClass: 'workspace-main workspace-page',
    breadcrumbs: pageBreadcrumbs(doc, title, type),
    titleHtml: `<h1 class="doc-title reader-title">${escapeHtml(title)}</h1>`,
    actionsHtml: `
      <button type="button" id="toggle-focus" class="btn-ghost" aria-pressed="${focusMode}">
        ${focusMode ? 'Show info' : 'Hide info'}
      </button>
      ${isStructured ? '' : '<button type="button" id="edit-page" class="btn-primary">Edit</button>'}
      <button type="button" id="copy-link" class="btn-ghost">Copy link</button>
      <button type="button" id="copy-path" class="btn-ghost">Copy path</button>
    `,
    mainHtml: `
      <div class="reader-body">
        <div class="reader-layout">
          <div id="tab-preview" class="markdown-preview reader-preview"></div>
          <nav id="doc-outline" class="doc-outline hidden" aria-label="On this page"></nav>
        </div>
        <section id="reader-backlinks" class="reader-backlinks hidden" aria-label="Backlinks"></section>
      </div>
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

    activeOutline?.destroy();
    activeOutline = mountDocOutline({
      scrollRoot: container,
      contentRoot: previewEl,
      mountEl: shell.bodySlot.querySelector<HTMLElement>('#doc-outline')!,
    });
    void enhanceMermaidPreview(previewEl).then(() => {
      activeOutline?.refresh();
      scheduleWorkspaceScrollReset(container);
    });
  }

  const fmEl = shell.railSlot.querySelector<HTMLDivElement>('#tab-frontmatter')!;
  fmEl.innerHTML = `<pre class="frontmatter-yaml"></pre>`;
  fmEl.querySelector('pre')!.textContent = JSON.stringify(fm, null, 2);

  const agentEl = shell.railSlot.querySelector<HTMLDivElement>('#tab-agent')!;
  agentEl.innerHTML = `<pre class="agent-json"></pre>`;
  agentEl.querySelector('pre')!.textContent = JSON.stringify(doc.agentShape, null, 2);

  bindReadRailTabs(container);
  bindSlugNavigation(container);

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

  const beginEdit = () => {
    if (!doc.slug || isStructured) {
      return;
    }
    const bodySlot = shell.bodySlot;
    bodySlot.innerHTML = '<p class="reader-loading">Opening editor…</p>';
    void openDraftForSlug(doc.slug)
      .then(({ draft }) => {
        options.onDraftsChanged?.();
        renderEditMode(container, doc, draft, options);
      })
      .catch((err: unknown) => {
        options.onError(err instanceof Error ? err.message : 'Edit failed');
        renderReadMode(container, doc, options);
      });
  };

  container.querySelector<HTMLButtonElement>('#edit-page')?.addEventListener('click', beginEdit);

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
        bindSlugNavigation(container);
        activeOutline?.refresh();
      })
      .catch(() => {
        // optional enrichment
      });
  }
}

export function renderPageWorkspace(
  container: HTMLElement,
  doc: DocDetail | null,
  options: PageWorkspaceOptions,
): void {
  destroyPageWorkspace();
  resetWorkspaceScroll(container);

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

  renderReadMode(container, doc, options);
  scheduleWorkspaceScrollReset(container);
}

export function openPageWorkspaceDraft(
  container: HTMLElement,
  doc: DocDetail,
  draft: Draft,
  options: PageWorkspaceOptions,
): void {
  resetWorkspaceScroll(container);
  renderEditMode(container, doc, draft, options);
}
