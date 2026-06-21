import { marked } from 'marked';
import type { Draft } from './api.js';
import { deleteDraftApi, publishDraftApi, updateDraftApi } from './api.js';

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
): void {
  container.innerHTML = `
    <div class="editor-header">
      <span class="badge">draft</span>
      ${draft.forked_from ? `<span class="badge">fork of ${draft.forked_from}</span>` : ''}
    </div>
    <div class="field"><label>Title</label><input id="ed-title" value="" /></div>
    <div class="field"><label>Slug</label><input id="ed-slug" value="" /></div>
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
    <div class="field"><label>Tags (comma-separated)</label><input id="ed-tags" /></div>
    <div class="field"><label>Related slugs (comma-separated)</label><input id="ed-related" /></div>
    <div class="field"><label>Body (markdown)</label><textarea id="ed-body" rows="10"></textarea></div>
    <div id="ed-preview" class="markdown-preview editor-preview"></div>
    <div class="editor-actions">
      <button type="button" id="ed-publish" class="btn-primary">Publish</button>
      <button type="button" id="ed-discard">Discard draft</button>
    </div>
    <div id="publish-modal" class="modal hidden">
      <div class="modal-card">
        <p>Publish to git as markdown?</p>
        <code id="publish-target"></code>
        <div class="editor-actions">
          <button type="button" id="publish-confirm" class="btn-primary">Confirm</button>
          <button type="button" id="publish-cancel">Cancel</button>
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
    modal.classList.remove('hidden');
    const target = container.querySelector<HTMLSpanElement>('#publish-target')!;
    target.textContent = `.project-knowledge/.../${slugEl.value}.md`;
  });

  container.querySelector<HTMLButtonElement>('#publish-cancel')?.addEventListener('click', () => {
    modal.classList.add('hidden');
  });

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
      modal.classList.add('hidden');
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
