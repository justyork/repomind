import type { Draft, ListDocsItem } from './api.js';
import { deleteDraftApi, getDraftDiff, publishDraftApi, updateDraftApi } from './api.js';
import { bindEditorProperties, renderEditorPropertiesRail } from './editor-properties.js';
import { bindFocusToggle, escapeHtml, loadFocusMode, renderPageShell } from './page-shell.js';
import { suggestRelatedFromBody, type DocCandidate } from './wikilink-autocomplete.js';
import type { VisualEditorHandle } from './visual-editor.js';

export interface EditorCallbacks {
  onPublished: (path: string) => void;
  onDeleted: () => void;
  onClosed: () => void;
  onError: (message: string) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let inFlightSave: Promise<void> | null = null;

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
  let visualHandle: VisualEditorHandle | null = null;
  let fallbackBody = draft.body;
  const focusMode = loadFocusMode();

  const shell = renderPageShell(container, {
    rootClass: 'workspace-main workspace-editor',
    breadcrumbs: [
      { label: 'Knowledge' },
      { label: 'Drafts' },
      { label: draft.title || draft.slug, current: true },
    ],
    titleHtml: `<input id="ed-title" class="title-input doc-title" type="text" placeholder="Document title" />`,
    actionsHtml: `
      <span id="ed-save-status" class="save-status" aria-live="polite"></span>
      <button type="button" id="toggle-focus" class="btn-ghost" aria-pressed="${focusMode}">
        ${focusMode ? 'Show info' : 'Hide info'}
      </button>
      <div class="publish-split">
        <button type="button" id="ed-publish" class="btn-primary publish-main">Publish</button>
        <button type="button" id="ed-publish-menu-btn" class="btn-primary publish-menu-trigger" aria-haspopup="true" aria-expanded="false">▾</button>
        <div id="ed-publish-menu" class="publish-menu hidden" role="menu">
          <button type="button" id="ed-publish-review" role="menuitem">Review changes</button>
        </div>
      </div>
      <button type="button" id="ed-view-md" class="btn-ghost">View markdown</button>
      <button type="button" id="ed-close" class="btn-ghost">Close</button>
      <button type="button" id="ed-discard" class="btn-ghost">Discard draft</button>
    `,
    mainHtml: `<div id="ed-visual-canvas"></div>`,
    railHtml: renderEditorPropertiesRail({
      forkedFrom: draft.forked_from,
    }),
    focusMode,
  });

  bindFocusToggle(container, focusMode);

  const titleEl = container.querySelector<HTMLInputElement>('#ed-title')!;
  const saveStatusEl = container.querySelector<HTMLElement>('#ed-save-status')!;
  const canvasEl = shell.bodySlot.querySelector<HTMLElement>('#ed-visual-canvas')!;
  const modal = document.createElement('div');
  modal.id = 'publish-modal';
  modal.className = 'modal hidden';
  modal.innerHTML = `
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
  `;
  container.appendChild(modal);

  const viewMdModal = document.createElement('div');
  viewMdModal.id = 'view-md-modal';
  viewMdModal.className = 'modal hidden';
  viewMdModal.innerHTML = `
    <div class="modal-card modal-card-wide">
      <h3 class="modal-title">Markdown source</h3>
      <pre id="view-md-content" class="md-source"></pre>
      <div class="editor-actions">
        <button type="button" id="view-md-copy" class="btn-primary">Copy</button>
        <button type="button" id="view-md-close" class="btn-ghost">Close</button>
      </div>
    </div>
  `;
  container.appendChild(viewMdModal);

  const publishMenu = container.querySelector<HTMLDivElement>('#ed-publish-menu')!;

  titleEl.value = draft.title;

  const properties = bindEditorProperties(
    shell.railSlot,
    {
      slug: draft.slug,
      type: draft.type,
      status: draft.status,
      tags: draft.tags,
      related: draft.related,
    },
    docCandidates,
    () => scheduleSave(),
  );

  void import('./visual-editor.js').then(({ mountVisualEditor }) => {
    visualHandle = mountVisualEditor(canvasEl, {
      initialMarkdown: draft.body,
      docCandidates,
      onBodyChange: () => scheduleSave(),
      onError: callbacks.onError,
    });
  });

  let pendingRelatedSuggestions: string[] = [];

  function getBody(): string {
    return visualHandle?.getMarkdownBody() ?? fallbackBody;
  }

  function buildDraftPayload() {
    const props = properties.getState();
    return {
      title: titleEl.value,
      slug: props.slug,
      type: props.type,
      status: props.status,
      tags: props.tags,
      related: props.related,
      body: getBody(),
    };
  }

  function setSaveStatus(text: string): void {
    saveStatusEl.textContent = text;
  }

  async function persistDraft(): Promise<void> {
    setSaveStatus('Saving…');
    const payload = buildDraftPayload();
    fallbackBody = payload.body;
    await updateDraftApi(draft.id, payload);
    setSaveStatus('Saved');
  }

  function scheduleSave(): void {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(() => {
      saveTimer = null;
      inFlightSave = persistDraft().catch((err: unknown) => {
        setSaveStatus('');
        callbacks.onError(err instanceof Error ? err.message : 'Autosave failed');
      }) as Promise<void>;
    }, 800);
  }

  async function flushPendingSave(): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
      inFlightSave = persistDraft().catch((err: unknown) => {
        setSaveStatus('');
        callbacks.onError(err instanceof Error ? err.message : 'Autosave failed');
        throw err;
      }) as Promise<void>;
    }
    if (inFlightSave) {
      await inFlightSave;
      inFlightSave = null;
    }
  }

  titleEl.addEventListener('input', () => scheduleSave());
  titleEl.addEventListener('change', () => scheduleSave());

  function showRelatedSuggestions(): void {
    const relatedSection = container.querySelector<HTMLElement>('#publish-related')!;
    const promptEl = container.querySelector<HTMLElement>('#publish-related-prompt')!;
    const listEl = container.querySelector<HTMLElement>('#publish-related-list')!;
    const props = properties.getState();
    pendingRelatedSuggestions = suggestRelatedFromBody(
      getBody(),
      props.related,
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
    const props = properties.getState();
    properties.setRelated([...new Set([...props.related, ...pendingRelatedSuggestions])]);
    pendingRelatedSuggestions = [];
    container.querySelector('#publish-related')?.classList.add('hidden');
  }

  container.querySelector<HTMLButtonElement>('#publish-related-apply')?.addEventListener('click', () => {
    applyRelatedSuggestions();
  });

  container.querySelector<HTMLButtonElement>('#publish-related-skip')?.addEventListener('click', () => {
    pendingRelatedSuggestions = [];
    container.querySelector('#publish-related')?.classList.add('hidden');
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

  function closeViewMdModal(): void {
    viewMdModal.classList.add('hidden');
  }

  function openViewMdModal(): void {
    const content = viewMdModal.querySelector<HTMLElement>('#view-md-content')!;
    content.textContent = getBody();
    viewMdModal.classList.remove('hidden');
  }

  async function openReviewModal(): Promise<void> {
    await flushPendingSave();
    openPublishModal();
    showRelatedSuggestions();
    const target = container.querySelector<HTMLElement>('#publish-target')!;
    const diffEl = container.querySelector<HTMLElement>('#publish-diff')!;
    const props = properties.getState();
    target.textContent = `docs/.../${props.slug}.md`;
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
  }

  async function publishNow(): Promise<void> {
    const publishBtn = container.querySelector<HTMLButtonElement>('#ed-publish')!;
    publishBtn.setAttribute('aria-busy', 'true');
    publishBtn.disabled = true;
    try {
      await flushPendingSave();
      const { result } = await publishDraftApi(draft.id);
      callbacks.onPublished(result.path);
    } finally {
      publishBtn.removeAttribute('aria-busy');
      publishBtn.disabled = false;
    }
  }

  container.querySelector<HTMLButtonElement>('#ed-publish')?.addEventListener('click', () => {
    void publishNow().catch((err: unknown) => {
      callbacks.onError(err instanceof Error ? err.message : 'Publish failed');
    });
  });

  container.querySelector<HTMLButtonElement>('#ed-publish-review')?.addEventListener('click', () => {
    publishMenu.classList.add('hidden');
    void openReviewModal().catch((err: unknown) => {
      callbacks.onError(err instanceof Error ? err.message : 'Failed to prepare publish');
    });
  });

  container.querySelector<HTMLButtonElement>('#ed-publish-menu-btn')?.addEventListener('click', () => {
    const hidden = publishMenu.classList.toggle('hidden');
    container
      .querySelector<HTMLButtonElement>('#ed-publish-menu-btn')
      ?.setAttribute('aria-expanded', hidden ? 'false' : 'true');
  });

  document.addEventListener('click', (event) => {
    const target = event.target as Node;
    if (!publishMenu.contains(target) && !container.querySelector('#ed-publish-menu-btn')?.contains(target)) {
      publishMenu.classList.add('hidden');
      container.querySelector<HTMLButtonElement>('#ed-publish-menu-btn')?.setAttribute('aria-expanded', 'false');
    }
  });

  container.querySelector<HTMLButtonElement>('#ed-view-md')?.addEventListener('click', () => {
    openViewMdModal();
  });

  viewMdModal.querySelector<HTMLButtonElement>('#view-md-close')?.addEventListener('click', () => {
    closeViewMdModal();
  });

  viewMdModal.addEventListener('click', (event) => {
    if (event.target === viewMdModal) {
      closeViewMdModal();
    }
  });

  viewMdModal.querySelector<HTMLButtonElement>('#view-md-copy')?.addEventListener('click', () => {
    void navigator.clipboard.writeText(getBody()).catch((err: unknown) => {
      callbacks.onError(err instanceof Error ? err.message : 'Copy failed');
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

  container.querySelector<HTMLButtonElement>('#publish-confirm')?.addEventListener('click', () => {
    void (async () => {
      await flushPendingSave();
      const { result } = await publishDraftApi(draft.id);
      closePublishModal();
      callbacks.onPublished(result.path);
    })().catch((err: unknown) => {
      callbacks.onError(err instanceof Error ? err.message : 'Publish failed');
    });
  });

  container.querySelector<HTMLButtonElement>('#ed-close')?.addEventListener('click', () => {
    visualHandle?.destroy();
    callbacks.onClosed();
  });

  container.querySelector<HTMLButtonElement>('#ed-discard')?.addEventListener('click', () => {
    if (!confirm('Discard this draft?')) {
      return;
    }
    visualHandle?.destroy();
    void deleteDraftApi(draft.id)
      .then(() => callbacks.onDeleted())
      .catch((err: unknown) => {
        callbacks.onError(err instanceof Error ? err.message : 'Delete failed');
      });
  });
}
