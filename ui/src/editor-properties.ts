import { catalogLabel } from './catalog.js';
import { escapeHtml } from './page-shell.js';
import { filterDocCandidates, type DocCandidate } from './wikilink-autocomplete.js';

export interface EditorPropertiesState {
  slug: string;
  type: string;
  status: string;
  tags: string[];
  related: string[];
  forkedFrom?: string;
}

const DOC_TYPES = [
  'adr',
  'feature-spec',
  'glossary-term',
  'open-question',
  'agent-instruction',
  'wiki-page',
] as const;

const DOC_STATUSES = ['draft', 'proposed', 'accepted', 'superseded'] as const;

export function renderEditorPropertiesRail(options: {
  forkedFrom?: string;
}): string {
  const forkBadge = options.forkedFrom
    ? `<span class="badge">fork: ${escapeHtml(options.forkedFrom)}</span>`
    : '';

  return `
    <h2 class="page-info-title">Page properties</h2>
    <div class="workspace-badges editor-badges">
      <span class="badge badge-draft">draft</span>
      ${forkBadge}
    </div>
    <div class="props-section">
      <div class="props-label">Status</div>
      <div class="props-chip-row">
        <button type="button" id="ed-status-chip" class="status-chip props-chip-trigger" aria-haspopup="listbox"></button>
        <div id="ed-status-menu" class="props-dropdown hidden" role="listbox"></div>
      </div>
    </div>
    <div class="props-section">
      <div class="props-label">Type</div>
      <div class="props-chip-row">
        <button type="button" id="ed-type-chip" class="props-chip props-chip-trigger" aria-haspopup="listbox"></button>
        <div id="ed-type-menu" class="props-dropdown hidden" role="listbox"></div>
      </div>
      <div class="props-hint" id="ed-catalog-hint"></div>
    </div>
    <div class="props-section">
      <div class="props-label">Slug</div>
      <input id="ed-slug" class="props-slug-input" spellcheck="false" />
      <div class="props-hint props-hint-slug hidden" id="ed-slug-hint"></div>
    </div>
    <div class="props-section">
      <div class="props-label">Tags</div>
      <div id="ed-tags-chips" class="props-chip-list"></div>
      <input id="ed-tags-input" class="props-add-input" placeholder="Add tag…" />
    </div>
    <div class="props-section">
      <div class="props-label">Related</div>
      <div id="ed-related-chips" class="props-chip-list"></div>
      <input id="ed-related-input" class="props-add-input" placeholder="Add related slug…" autocomplete="off" />
      <div id="ed-related-menu" class="props-dropdown hidden" role="listbox"></div>
    </div>
  `;
}

export interface EditorPropertiesHandle {
  getState: () => EditorPropertiesState;
  setRelated: (slugs: string[]) => void;
}

export function bindEditorProperties(
  container: HTMLElement,
  initial: EditorPropertiesState,
  docCandidates: DocCandidate[],
  onChange: () => void,
): EditorPropertiesHandle {
  const slugEl = container.querySelector<HTMLInputElement>('#ed-slug')!;
  const slugHint = container.querySelector<HTMLElement>('#ed-slug-hint')!;
  const statusChip = container.querySelector<HTMLButtonElement>('#ed-status-chip')!;
  const statusMenu = container.querySelector<HTMLDivElement>('#ed-status-menu')!;
  const typeChip = container.querySelector<HTMLButtonElement>('#ed-type-chip')!;
  const typeMenu = container.querySelector<HTMLDivElement>('#ed-type-menu')!;
  const catalogHint = container.querySelector<HTMLElement>('#ed-catalog-hint')!;
  const tagsChips = container.querySelector<HTMLDivElement>('#ed-tags-chips')!;
  const tagsInput = container.querySelector<HTMLInputElement>('#ed-tags-input')!;
  const relatedChips = container.querySelector<HTMLDivElement>('#ed-related-chips')!;
  const relatedInput = container.querySelector<HTMLInputElement>('#ed-related-input')!;
  const relatedMenu = container.querySelector<HTMLDivElement>('#ed-related-menu')!;

  let tags = [...initial.tags];
  let related = [...initial.related];
  let status = initial.status;
  let type = initial.type;

  slugEl.value = initial.slug;
  if (initial.forkedFrom) {
    slugEl.readOnly = true;
    slugEl.title = 'Slug is fixed for edits of an existing published page';
    slugHint.textContent = `Locked while editing published page (${initial.forkedFrom})`;
    slugHint.classList.remove('hidden');
  }
  updateStatusChip();
  updateTypeChip();
  renderTagChips();
  renderRelatedChips();

  function emitChange(): void {
    onChange();
  }

  function updateStatusChip(): void {
    statusChip.textContent = status;
    statusChip.className = `status-chip props-chip-trigger status-${status}`;
    statusMenu.innerHTML = DOC_STATUSES.map(
      (value) =>
        `<button type="button" class="props-dropdown-item" data-value="${value}" role="option">${value}</button>`,
    ).join('');
  }

  function updateTypeChip(): void {
    typeChip.textContent = type;
    catalogHint.textContent = catalogLabel(type);
    typeMenu.innerHTML = DOC_TYPES.map(
      (value) =>
        `<button type="button" class="props-dropdown-item" data-value="${value}" role="option">${value}</button>`,
    ).join('');
  }

  function renderTagChips(): void {
    tagsChips.innerHTML = tags
      .map(
        (tag) =>
          `<span class="tag-chip props-removable-chip">${escapeHtml(tag)}<button type="button" class="chip-remove" data-tag="${escapeHtml(tag)}" aria-label="Remove tag">×</button></span>`,
      )
      .join('');
    tagsChips.querySelectorAll<HTMLButtonElement>('.chip-remove').forEach((button) => {
      button.addEventListener('click', () => {
        const value = button.dataset.tag;
        tags = tags.filter((tag) => tag !== value);
        renderTagChips();
        emitChange();
      });
    });
  }

  function renderRelatedChips(): void {
    relatedChips.innerHTML = related
      .map(
        (slug) =>
          `<span class="related-chip props-removable-chip">${escapeHtml(slug)}<button type="button" class="chip-remove" data-slug="${escapeHtml(slug)}" aria-label="Remove related">×</button></span>`,
      )
      .join('');
    relatedChips.querySelectorAll<HTMLButtonElement>('.chip-remove').forEach((button) => {
      button.addEventListener('click', () => {
        const value = button.dataset.slug;
        related = related.filter((slug) => slug !== value);
        renderRelatedChips();
        emitChange();
      });
    });
  }

  function closeMenus(): void {
    statusMenu.classList.add('hidden');
    typeMenu.classList.add('hidden');
    relatedMenu.classList.add('hidden');
  }

  statusChip.addEventListener('click', () => {
    const open = statusMenu.classList.toggle('hidden');
    if (!open) {
      typeMenu.classList.add('hidden');
      relatedMenu.classList.add('hidden');
    }
  });

  statusMenu.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-value]');
    if (!button) {
      return;
    }
    status = button.dataset.value ?? status;
    updateStatusChip();
    statusMenu.classList.add('hidden');
    emitChange();
  });

  typeChip.addEventListener('click', () => {
    const open = typeMenu.classList.toggle('hidden');
    if (!open) {
      statusMenu.classList.add('hidden');
      relatedMenu.classList.add('hidden');
    }
  });

  typeMenu.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-value]');
    if (!button) {
      return;
    }
    type = button.dataset.value ?? type;
    updateTypeChip();
    typeMenu.classList.add('hidden');
    emitChange();
  });

  slugEl.addEventListener('input', emitChange);

  tagsInput.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ',') {
      return;
    }
    event.preventDefault();
    const value = tagsInput.value.trim().replace(/,$/, '');
    if (!value || tags.includes(value)) {
      tagsInput.value = '';
      return;
    }
    tags.push(value);
    tagsInput.value = '';
    renderTagChips();
    emitChange();
  });

  function renderRelatedMenu(query: string): void {
    const matches = filterDocCandidates(query, docCandidates).filter(
      (doc) => !related.includes(doc.slug),
    );
    if (matches.length === 0) {
      relatedMenu.classList.add('hidden');
      return;
    }
    relatedMenu.innerHTML = matches
      .map(
        (doc) =>
          `<button type="button" class="props-dropdown-item" data-slug="${escapeHtml(doc.slug)}" role="option">
            <span class="wikilink-option-slug">${escapeHtml(doc.slug)}</span>
            <span class="wikilink-option-title">${escapeHtml(doc.title)}</span>
          </button>`,
      )
      .join('');
    relatedMenu.classList.remove('hidden');
  }

  relatedInput.addEventListener('input', () => {
    renderRelatedMenu(relatedInput.value.trim());
  });

  relatedInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const value = relatedInput.value.trim();
      if (value && !related.includes(value)) {
        related.push(value);
        relatedInput.value = '';
        renderRelatedChips();
        relatedMenu.classList.add('hidden');
        emitChange();
      }
    }
  });

  relatedMenu.addEventListener('mousedown', (event) => {
    event.preventDefault();
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-slug]');
    if (!button) {
      return;
    }
    const slug = button.dataset.slug ?? '';
    if (slug && !related.includes(slug)) {
      related.push(slug);
      relatedInput.value = '';
      renderRelatedChips();
      relatedMenu.classList.add('hidden');
      emitChange();
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target as Node;
    if (
      !statusChip.contains(target) &&
      !statusMenu.contains(target) &&
      !typeChip.contains(target) &&
      !typeMenu.contains(target) &&
      !relatedInput.contains(target) &&
      !relatedMenu.contains(target)
    ) {
      closeMenus();
    }
  });

  return {
    getState: () => ({
      slug: slugEl.value.trim(),
      type,
      status,
      tags: [...tags],
      related: [...related],
    }),
    setRelated(slugs: string[]) {
      related = [...new Set(slugs)];
      renderRelatedChips();
      emitChange();
    },
  };
}
