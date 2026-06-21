import { marked } from 'marked';
import type { Draft } from './api.js';
import { deleteDraftApi, getDraftDiff, publishDraftApi, updateDraftApi } from './api.js';

export interface EditorCallbacks {
  onPublished: (path: string) => void;
  onDeleted: () => void;
  onError: (message: string) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function renderDraftEditor(
  container: HTMLElement,
  draft: Draft,
  callbacks: EditorCallbacks,
  knownSlugs: string[] = [],
): void {
  container.className = 'workspace-main workspace-editor';
  container.innerHTML = `
    <div class="workspace-toolbar">
      <div class="workspace-title-row">
        <input id="ed-title" class="title-input" type="text" placeholder="Document title" />
        <div class="workspace-badges">
          <span class="badge badge-draft">draft</span>
          ${draft.forked_from ? `<span class="badge">fork: ${draft.forked_from}</span>` : ''}
        </div>
      </div>
      <div class="workspace-actions">
        <button type="button" id="ed-publish" class="btn-primary">Publish</button>
        <button type="button" id="ed-discard" class="btn-ghost">Discard</button>
      </div>
    </div>
    <div class="meta-grid">
      <div class="field"><label>Slug</label><input id="ed-slug" /></div>
      <div class="field"><label>Type</label>
        <select id="ed-type">
          <option value="adr">adr</option>
          <option value="feature-spec">feature-spec</option>
          <option value="glossary-term">glossary-term</option>
          <option value="open-question">open-question</option>
          <option value="agent-instruction">agent-instruction</option>
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
      <div class="field"><label>Tags</label><input id="ed-tags" placeholder="comma-separated" /></div>
      <div class="field field-wide"><label>Related</label><input id="ed-related" list="ed-related-suggestions" placeholder="slug-one, slug-two" /></div>
    </div>
    <datalist id="ed-related-suggestions">
      ${knownSlugs.map((slug) => `<option value="${slug}"></option>`).join('')}
    </datalist>
    <div class="split-editor">
      <div class="split-pane">
        <div class="pane-label">Markdown</div>
        <textarea id="ed-body" spellcheck="false"></textarea>
      </div>
      <div class="split-pane">
        <div class="pane-label">Preview</div>
        <div id="ed-preview" class="markdown-preview pane-preview"></div>
      </div>
    </div>
    <div id="publish-modal" class="modal hidden">
      <div class="modal-card modal-card-wide">
        <p>Publish to git as markdown?</p>
        <code id="publish-target"></code>
        <pre id="publish-diff" class="diff-preview"></pre>
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
  previewEl.innerHTML = marked.parse(draft.body, { async: false }) as string;

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
    previewEl.innerHTML = marked.parse(bodyEl.value, { async: false }) as string;
    scheduleSave();
  };

  for (const el of [titleEl, slugEl, typeEl, statusEl, tagsEl, relatedEl, bodyEl]) {
    el.addEventListener('input', onInput);
    el.addEventListener('change', onInput);
  }

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
      const target = container.querySelector<HTMLElement>('#publish-target')!;
      const diffEl = container.querySelector<HTMLElement>('#publish-diff')!;
      target.textContent = `.project-knowledge/.../${slugEl.value}.md`;
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
