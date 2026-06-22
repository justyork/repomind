import type { Draft, ListDocsItem } from './api.js';
import { deleteDraftApi, getDraftDiff, publishDraftApi, updateDraftApi } from './api.js';
import { catalogLabel } from './catalog.js';
import { bindMarkdownToolbar, markdownToolbarHtml } from './markdown-toolbar.js';
import { enhanceMarkdownPreview, renderMarkdown } from './markdown.js';
import {
  bindWikilinkAutocomplete,
  suggestRelatedFromBody,
  type DocCandidate,
} from './wikilink-autocomplete.js';

export interface EditorCallbacks {
  onPublished: (path: string) => void;
  onDeleted: () => void;
  onClosed: () => void;
  onError: (message: string) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let previewMermaidTimer: ReturnType<typeof setTimeout> | null = null;

export function renderDraftEditor(
  container: HTMLElement,
  draft: Draft,
  callbacks: EditorCallbacks,
  docIndex: ListDocsItem[] = [],
): void {
  const docCandidates: DocCandidate[] = docIndex.map((doc) => ({
    slug: doc.slug,
    title: doc.title,
  }));
  const knownSlugs = docCandidates.map((doc) => doc.slug);
  container.className = 'workspace-main workspace-editor';
  const catalog = catalogLabel(draft.type);
  container.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <span class="crumb">Knowledge</span>
      <span class="crumb-sep">›</span>
      <span class="crumb">Drafts</span>
      <span class="crumb-sep">›</span>
      <span class="crumb current">${escapeHtml(draft.title || draft.slug)}</span>
    </nav>
    <div class="page-layout">
      <div class="page-content">
        <header class="page-header">
          <input id="ed-title" class="title-input doc-title" type="text" placeholder="Document title" />
          <div class="workspace-actions">
            <button type="button" id="ed-publish" class="btn-primary">Publish</button>
            <button type="button" id="ed-close" class="btn-ghost">Close</button>
            <button type="button" id="ed-discard" class="btn-ghost">Discard draft</button>
          </div>
        </header>
        <div class="split-editor">
          <div class="split-pane">
            <div class="pane-label">Markdown</div>
            ${markdownToolbarHtml()}
            <textarea id="ed-body" spellcheck="false"></textarea>
          </div>
          <div class="split-pane">
            <div class="pane-label">Preview</div>
            <div id="ed-preview" class="markdown-preview pane-preview"></div>
          </div>
        </div>
      </div>
      <aside class="page-info">
        <h2 class="page-info-title">Page properties</h2>
        <div class="workspace-badges editor-badges">
          <span class="badge badge-draft">draft</span>
          ${draft.forked_from ? `<span class="badge">fork: ${escapeHtml(draft.forked_from)}</span>` : ''}
        </div>
        <div class="meta-grid editor-meta">
          <div class="field"><label>Slug</label><input id="ed-slug" /></div>
          <div class="field"><label>Catalog</label><input id="ed-catalog" readonly value="${escapeHtml(catalog)}" /></div>
          <div class="field"><label>Type</label>
            <select id="ed-type">
              <option value="adr">adr</option>
              <option value="feature-spec">feature-spec</option>
              <option value="glossary-term">glossary-term</option>
              <option value="open-question">open-question</option>
              <option value="agent-instruction">agent-instruction</option>
              <option value="wiki-page">wiki-page</option>
            </select>
          </div>
          <div class="field"><label>Status</label>
            <select id="ed-status">
              <option value="draft">draft</option>
              <option value="proposed">proposed</option>
              <option value="accepted">accepted</option>
              <option value="superseded">superseded</option>
            </select>
          </div>
          <div class="field field-wide"><label>Tags</label><input id="ed-tags" placeholder="comma-separated" /></div>
          <div class="field field-wide"><label>Related</label><input id="ed-related" list="ed-related-suggestions" placeholder="slug-one, slug-two" /></div>
        </div>
        <datalist id="ed-related-suggestions">
          ${knownSlugs.map((slug) => `<option value="${slug}"></option>`).join('')}
        </datalist>
      </aside>
    </div>
    <div id="publish-modal" class="modal hidden">
      <div class="modal-card modal-card-wide">
        <p>Publish to git as markdown?</p>
        <code id="publish-target"></code>
        <pre id="publish-diff" class="diff-preview"></pre>
        <div id="publish-related" class="publish-related hidden">
          <p id="publish-related-prompt"></p>
          <ul id="publish-related-list" class="publish-related-list"></ul>
          <div class="editor-actions">
            <button type="button" id="publish-related-apply" class="btn-primary">Add to related</button>
            <button type="button" id="publish-related-skip" class="btn-ghost">Skip</button>
          </div>
        </div>
        <div class="editor-actions">
          <button type="button" id="publish-confirm" class="btn-primary">Confirm</button>
          <button type="button" id="publish-cancel" class="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  `;

  const titleEl = container.querySelector<HTMLInputElement>('#ed-title')!;
  const slugEl = container.querySelector<HTMLInputElement>('#ed-slug')!;
  const typeEl = container.querySelector<HTMLSelectElement>('#ed-type')!;
  const statusEl = container.querySelector<HTMLSelectElement>('#ed-status')!;
  const tagsEl = container.querySelector<HTMLInputElement>('#ed-tags')!;
  const relatedEl = container.querySelector<HTMLInputElement>('#ed-related')!;
  const bodyEl = container.querySelector<HTMLTextAreaElement>('#ed-body')!;
  const previewEl = container.querySelector<HTMLDivElement>('#ed-preview')!;
  const modal = container.querySelector<HTMLDivElement>('#publish-modal')!;

  titleEl.value = draft.title;
  slugEl.value = draft.slug;
  typeEl.value = draft.type;
  statusEl.value = draft.status;
  tagsEl.value = draft.tags.join(', ');
  relatedEl.value = draft.related.join(', ');
  bodyEl.value = draft.body;

  const markdownContext =
    draft.target_path && docIndex.length > 0
      ? {
          docRelativePath: draft.target_path,
          slugByRelative: new Map(docIndex.map((doc) => [doc.relativePath, doc.slug])),
        }
      : undefined;

  function updatePreview(): void {
    previewEl.innerHTML = renderMarkdown(bodyEl.value, markdownContext);
    if (previewMermaidTimer) {
      clearTimeout(previewMermaidTimer);
    }
    previewMermaidTimer = setTimeout(() => {
      void enhanceMarkdownPreview(previewEl);
    }, 350);
  }

  updatePreview();

  let pendingRelatedSuggestions: string[] = [];

  function parseList(raw: string): string[] {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function scheduleSave(): void {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      void updateDraftApi(draft.id, {
        title: titleEl.value,
        slug: slugEl.value,
        type: typeEl.value,
        status: statusEl.value,
        tags: parseList(tagsEl.value),
        related: parseList(relatedEl.value),
        body: bodyEl.value,
      }).catch((err: unknown) => {
        callbacks.onError(err instanceof Error ? err.message : 'Autosave failed');
      });
    }, 800);
  }

  const onInput = () => {
    updatePreview();
    const catalogEl = container.querySelector<HTMLInputElement>('#ed-catalog');
    if (catalogEl) {
      catalogEl.value = catalogLabel(typeEl.value);
    }
    scheduleSave();
  };

  for (const el of [titleEl, slugEl, typeEl, statusEl, tagsEl, relatedEl, bodyEl]) {
    el.addEventListener('input', onInput);
    el.addEventListener('change', onInput);
  }

  bindMarkdownToolbar(container, bodyEl, onInput);
  bindWikilinkAutocomplete(bodyEl, docCandidates, onInput);

  function showRelatedSuggestions(): void {
    const relatedSection = container.querySelector<HTMLElement>('#publish-related')!;
    const promptEl = container.querySelector<HTMLElement>('#publish-related-prompt')!;
    const listEl = container.querySelector<HTMLElement>('#publish-related-list')!;
    pendingRelatedSuggestions = suggestRelatedFromBody(
      bodyEl.value,
      parseList(relatedEl.value),
      docCandidates,
    );
    if (pendingRelatedSuggestions.length === 0) {
      relatedSection.classList.add('hidden');
      return;
    }
    promptEl.textContent = `Add ${pendingRelatedSuggestions.length} body link(s) to related?`;
    listEl.innerHTML = pendingRelatedSuggestions
      .map((slug) => {
        const title = docCandidates.find((doc) => doc.slug === slug)?.title ?? slug;
        return `<li><code>${escapeHtml(slug)}</code> — ${escapeHtml(title)}</li>`;
      })
      .join('');
    relatedSection.classList.remove('hidden');
  }

  function applyRelatedSuggestions(): void {
    if (pendingRelatedSuggestions.length === 0) {
      return;
    }
    const merged = [...new Set([...parseList(relatedEl.value), ...pendingRelatedSuggestions])];
    relatedEl.value = merged.join(', ');
    pendingRelatedSuggestions = [];
    container.querySelector('#publish-related')?.classList.add('hidden');
    scheduleSave();
  }

  container.querySelector<HTMLButtonElement>('#publish-related-apply')?.addEventListener('click', () => {
    applyRelatedSuggestions();
  });

  container.querySelector<HTMLButtonElement>('#publish-related-skip')?.addEventListener('click', () => {
    pendingRelatedSuggestions = [];
    container.querySelector('#publish-related')?.classList.add('hidden');
  });

  container.querySelector<HTMLButtonElement>('#ed-publish')?.addEventListener('click', () => {
    void (async () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
      await updateDraftApi(draft.id, {
        title: titleEl.value,
        slug: slugEl.value,
        type: typeEl.value,
        status: statusEl.value,
        tags: parseList(tagsEl.value),
        related: parseList(relatedEl.value),
        body: bodyEl.value,
      });

      openPublishModal();
      showRelatedSuggestions();
      const target = container.querySelector<HTMLElement>('#publish-target')!;
      const diffEl = container.querySelector<HTMLElement>('#publish-diff')!;
      target.textContent = `docs/.../${slugEl.value}.md`;
      diffEl.textContent = 'Loading diff…';

      try {
        const diffResult = await getDraftDiff(draft.id);
        if (diffResult.targetPath) {
          target.textContent = diffResult.targetPath;
        }
        diffEl.textContent = diffResult.diff;
      } catch (err) {
        diffEl.textContent = err instanceof Error ? err.message : 'Diff unavailable';
      }
    })().catch((err: unknown) => {
      callbacks.onError(err instanceof Error ? err.message : 'Failed to prepare publish');
    });
  });

  container.querySelector<HTMLButtonElement>('#publish-cancel')?.addEventListener('click', () => {
    closePublishModal();
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closePublishModal();
    }
  });

  let escapeHandler: ((event: KeyboardEvent) => void) | null = null;

  function closePublishModal(): void {
    modal.classList.add('hidden');
    if (escapeHandler) {
      document.removeEventListener('keydown', escapeHandler);
      escapeHandler = null;
    }
  }

  function openPublishModal(): void {
    modal.classList.remove('hidden');
    if (!escapeHandler) {
      escapeHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          closePublishModal();
        }
      };
      document.addEventListener('keydown', escapeHandler);
    }
  }

  container.querySelector<HTMLButtonElement>('#publish-confirm')?.addEventListener('click', () => {
    void (async () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
      await updateDraftApi(draft.id, {
        title: titleEl.value,
        slug: slugEl.value,
        type: typeEl.value,
        status: statusEl.value,
        tags: parseList(tagsEl.value),
        related: parseList(relatedEl.value),
        body: bodyEl.value,
      });
      const { result } = await publishDraftApi(draft.id);
      closePublishModal();
      callbacks.onPublished(result.path);
    })().catch((err: unknown) => {
      callbacks.onError(err instanceof Error ? err.message : 'Publish failed');
    });
  });

  container.querySelector<HTMLButtonElement>('#ed-close')?.addEventListener('click', () => {
    callbacks.onClosed();
  });

  container.querySelector<HTMLButtonElement>('#ed-discard')?.addEventListener('click', () => {
    if (!confirm('Discard this draft?')) {
      return;
    }
    void deleteDraftApi(draft.id)
      .then(() => callbacks.onDeleted())
      .catch((err: unknown) => {
        callbacks.onError(err instanceof Error ? err.message : 'Delete failed');
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
