import type { Editor } from '@tiptap/core';
import { filterDocCandidates, type DocCandidate } from './wikilink-autocomplete.js';

export interface WikilinkPick {
  slug: string;
  label: string;
}

export function wikilinkPickFromDoc(doc: DocCandidate): WikilinkPick {
  const slug = doc.slug.trim();
  const title = doc.title.trim();
  return {
    slug,
    label: title && title !== slug ? title : slug,
  };
}

export function wikilinkPickFromRawSlug(raw: string): WikilinkPick | null {
  const slug = raw.trim().toLowerCase().replace(/\s+/g, '-');
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return null;
  }
  return { slug, label: slug };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

function renderOptionButtons(
  docs: DocCandidate[],
  options: { activeIndex?: number; customSlug?: string | null },
): string {
  const rows: string[] = docs.map((doc, index) => {
    const active = index === options.activeIndex ? ' wikilink-option--active' : '';
    return `<button type="button" class="wikilink-option${active}" data-slug="${escapeAttr(doc.slug)}" data-label="${escapeAttr(doc.title)}" role="option" aria-selected="${index === options.activeIndex}">
      <span class="wikilink-option-slug">${escapeHtml(doc.slug)}</span>
      <span class="wikilink-option-title">${escapeHtml(doc.title)}</span>
    </button>`;
  });

  if (options.customSlug) {
    const active = options.activeIndex === docs.length ? ' wikilink-option--active' : '';
    rows.push(
      `<button type="button" class="wikilink-option wikilink-option--custom${active}" data-custom-slug="${escapeAttr(options.customSlug)}" role="option">
        <span class="wikilink-option-slug">Use slug «${escapeHtml(options.customSlug)}»</span>
        <span class="wikilink-option-title">Page not in index yet</span>
      </button>`,
    );
  }

  return rows.join('');
}

export interface WikilinkInlineMenu {
  element: HTMLElement;
  render: (query: string, docs: DocCandidate[]) => void;
  positionAt: (x: number, y: number) => void;
  close: () => void;
}

/** Inline [[ autocomplete menu (fixed near cursor). */
export function createWikilinkInlineMenu(onPick: (pick: WikilinkPick) => void): WikilinkInlineMenu {
  const menu = document.createElement('div');
  menu.className = 'wikilink-menu hidden';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', 'Link to page');
  document.body.appendChild(menu);

  let activeIndex = 0;
  let optionCount = 0;

  function closeMenu(): void {
    menu.classList.add('hidden');
    menu.innerHTML = '';
    activeIndex = 0;
    optionCount = 0;
  }

  function pickFromButton(button: HTMLButtonElement): void {
    const custom = button.dataset.customSlug;
    if (custom) {
      const pick = wikilinkPickFromRawSlug(custom);
      if (pick) {
        onPick(pick);
      }
      return;
    }
    const slug = button.dataset.slug ?? '';
    const label = button.dataset.label ?? slug;
    if (slug) {
      onPick(wikilinkPickFromDoc({ slug, title: label }));
    }
  }

  function bindOptionClicks(): void {
    menu.querySelectorAll<HTMLButtonElement>('.wikilink-option').forEach((button, index) => {
      button.dataset.optionIndex = String(index);
      button.addEventListener('mousedown', (event) => {
        event.preventDefault();
        pickFromButton(button);
        closeMenu();
      });
    });
  }

  function setActiveIndex(next: number): void {
    if (optionCount === 0) {
      return;
    }
    activeIndex = ((next % optionCount) + optionCount) % optionCount;
    menu.querySelectorAll<HTMLButtonElement>('.wikilink-option').forEach((button, index) => {
      const active = index === activeIndex;
      button.classList.toggle('wikilink-option--active', active);
      button.setAttribute('aria-selected', String(active));
    });
  }

  function activateCurrent(): void {
    const button = menu.querySelector<HTMLButtonElement>(`[data-option-index="${activeIndex}"]`);
    if (button) {
      pickFromButton(button);
      closeMenu();
    }
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (menu.classList.contains('hidden')) {
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex(activeIndex + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex(activeIndex - 1);
        break;
      case 'Enter':
        event.preventDefault();
        activateCurrent();
        break;
      case 'Escape':
        event.preventDefault();
        closeMenu();
        break;
      default:
        break;
    }
  };

  document.addEventListener('keydown', onKeyDown, true);

  return {
    element: menu,
    render(query: string, docs: DocCandidate[]): void {
      const matches = filterDocCandidates(query, docs, 12);
      const customSlug =
        matches.length === 0 && query.trim() ? wikilinkPickFromRawSlug(query)?.slug ?? null : null;

      if (matches.length === 0 && !customSlug) {
        menu.innerHTML = `<p class="wikilink-menu-empty">No pages match. Type a slug like <code>my-page</code>.</p>`;
        menu.classList.remove('hidden');
        optionCount = 0;
        return;
      }

      menu.innerHTML = `
        <p class="wikilink-menu-hint">Link to a page · markdown <code>[[slug]]</code></p>
        ${renderOptionButtons(matches, { activeIndex: 0, customSlug })}
      `;
      optionCount = matches.length + (customSlug ? 1 : 0);
      activeIndex = 0;
      bindOptionClicks();
      menu.classList.remove('hidden');
    },
    positionAt(x: number, y: number): void {
      menu.style.top = `${y + 4}px`;
      menu.style.left = `${x}px`;
      menu.style.minWidth = '260px';
    },
    close(): void {
      document.removeEventListener('keydown', onKeyDown, true);
      closeMenu();
      menu.remove();
    },
  };
}

export interface WikilinkPickerOptions {
  docs: DocCandidate[];
  initialQuery?: string;
  initialLabel?: string;
  title?: string;
  onSelect: (pick: WikilinkPick) => void;
  onCancel?: () => void;
}

/** Modal picker for toolbar, slash menu, and editing an existing wikilink. */
export function openWikilinkPicker(options: WikilinkPickerOptions): () => void {
  const overlay = document.createElement('div');
  overlay.className = 'modal wikilink-picker-modal';
  overlay.innerHTML = `
    <div class="modal-card wikilink-picker-card" role="dialog" aria-modal="true" aria-labelledby="wikilink-picker-title">
      <h3 id="wikilink-picker-title" class="modal-title">${escapeHtml(options.title ?? 'Link to page')}</h3>
      <p class="wikilink-picker-hint">Search by title or slug. In the editor you can also type <code>[[</code> for quick insert.</p>
      <label class="wikilink-picker-field">
        <span class="wikilink-picker-label">Search</span>
        <input type="search" class="wikilink-picker-search" placeholder="Page title or slug…" autocomplete="off" />
      </label>
      <label class="wikilink-picker-field">
        <span class="wikilink-picker-label">Display text</span>
        <input type="text" class="wikilink-picker-label-input" placeholder="Shown in the document" autocomplete="off" />
      </label>
      <div class="wikilink-picker-results" role="listbox" aria-label="Matching pages"></div>
      <div class="wikilink-picker-actions">
        <button type="button" class="btn-ghost wikilink-picker-cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const searchEl = overlay.querySelector<HTMLInputElement>('.wikilink-picker-search')!;
  const labelEl = overlay.querySelector<HTMLInputElement>('.wikilink-picker-label-input')!;
  const resultsEl = overlay.querySelector<HTMLElement>('.wikilink-picker-results')!;
  const cancelBtn = overlay.querySelector<HTMLButtonElement>('.wikilink-picker-cancel')!;
  const card = overlay.querySelector<HTMLElement>('.wikilink-picker-card')!;

  let activeIndex = 0;
  let optionCount = 0;

  if (options.initialQuery) {
    searchEl.value = options.initialQuery;
  }
  if (options.initialLabel) {
    labelEl.value = options.initialLabel;
  }

  function removeListeners(): void {
    document.removeEventListener('keydown', onKeyDown, true);
  }

  function close(): void {
    removeListeners();
    overlay.remove();
    options.onCancel?.();
  }

  function applyPick(pick: WikilinkPick): void {
    const label = labelEl.value.trim() || pick.label;
    removeListeners();
    overlay.remove();
    options.onSelect({ slug: pick.slug, label });
  }

  function renderResults(): void {
    const query = searchEl.value.trim();
    const matches = filterDocCandidates(query, options.docs, 15);
    const customSlug =
      matches.length === 0 && query ? wikilinkPickFromRawSlug(query)?.slug ?? null : null;

    if (matches.length === 0 && !customSlug) {
      resultsEl.innerHTML = `<p class="wikilink-menu-empty">No pages found. Enter a valid slug (letters, numbers, hyphens).</p>`;
      optionCount = 0;
      return;
    }

    resultsEl.innerHTML = renderOptionButtons(matches, { activeIndex, customSlug });
    optionCount = matches.length + (customSlug ? 1 : 0);
    if (activeIndex >= optionCount) {
      activeIndex = 0;
    }

    resultsEl.querySelectorAll<HTMLButtonElement>('.wikilink-option').forEach((button, index) => {
      button.dataset.optionIndex = String(index);
      button.addEventListener('click', () => {
        const custom = button.dataset.customSlug;
        if (custom) {
          const pick = wikilinkPickFromRawSlug(custom);
          if (pick) {
            if (!labelEl.value.trim()) {
              labelEl.value = pick.label;
            }
            applyPick(pick);
          }
          return;
        }
        const slug = button.dataset.slug ?? '';
        const title = button.dataset.label ?? slug;
        if (!labelEl.value.trim()) {
          labelEl.value = title !== slug ? title : slug;
        }
        applyPick(wikilinkPickFromDoc({ slug, title }));
      });
    });
  }

  function setActiveIndex(next: number): void {
    if (optionCount === 0) {
      return;
    }
    activeIndex = ((next % optionCount) + optionCount) % optionCount;
    renderResults();
  }

  function activateCurrent(): void {
    resultsEl.querySelector<HTMLButtonElement>(`[data-option-index="${activeIndex}"]`)?.click();
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!document.body.contains(overlay)) {
      return;
    }
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'ArrowDown':
        if (document.activeElement === searchEl || document.activeElement === labelEl) {
          event.preventDefault();
          setActiveIndex(activeIndex + 1);
        }
        break;
      case 'ArrowUp':
        if (document.activeElement === searchEl || document.activeElement === labelEl) {
          event.preventDefault();
          setActiveIndex(activeIndex - 1);
        }
        break;
      case 'Enter':
        if (document.activeElement === searchEl) {
          event.preventDefault();
          if (optionCount > 0) {
            activateCurrent();
          } else {
            const pick = wikilinkPickFromRawSlug(searchEl.value);
            if (pick) {
              applyPick(pick);
            }
          }
        }
        break;
      default:
        break;
    }
  };

  searchEl.addEventListener('input', () => {
    activeIndex = 0;
    renderResults();
  });

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close();
    }
  });
  card.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  document.addEventListener('keydown', onKeyDown, true);
  renderResults();
  searchEl.focus();

  return close;
}

export function getSelectedWikilinkAttrs(editor: Editor): WikilinkPick | null {
  const { selection } = editor.state;
  const node = selection.node;
  if (node?.type.name === 'wikilink') {
    return {
      slug: String(node.attrs.slug ?? ''),
      label: String(node.attrs.label ?? node.attrs.slug ?? ''),
    };
  }
  if (selection.empty) {
    return null;
  }
  let found: WikilinkPick | null = null;
  editor.state.doc.nodesBetween(selection.from, selection.to, (n) => {
    if (n.type.name === 'wikilink') {
      found = {
        slug: String(n.attrs.slug ?? ''),
        label: String(n.attrs.label ?? n.attrs.slug ?? ''),
      };
    }
  });
  return found;
}
