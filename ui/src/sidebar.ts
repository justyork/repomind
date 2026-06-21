import type { Draft, ListDocsItem } from './api.js';

export interface SidebarCallbacks {
  onSelectSlug: (slug: string) => void;
  onSearch: (query: string) => void;
  onSelectDraft?: (draft: Draft) => void;
  onNewDraft?: () => void;
}

export function renderSidebar(
  container: HTMLElement,
  docs: ListDocsItem[],
  drafts: Draft[],
  callbacks: SidebarCallbacks,
): void {
  container.innerHTML = `
    <div class="sidebar-actions">
      <button type="button" id="new-draft" class="btn-primary btn-block">New draft</button>
    </div>
    <h2>Drafts</h2>
    <ul id="draft-list" class="doc-list"></ul>
    <h2>Search</h2>
    <div class="field">
      <input id="search-input" type="search" placeholder="Search docs…" />
    </div>
    <div id="search-results-wrap" class="hidden"></div>
    <h2>Filter</h2>
    <div class="field">
      <label for="filter-type">Type</label>
      <select id="filter-type">
        <option value="">All types</option>
      </select>
    </div>
    <div class="field">
      <label for="filter-status">Status</label>
      <select id="filter-status">
        <option value="">All statuses</option>
      </select>
    </div>
    <h2>Documents</h2>
    <ul id="doc-list" class="doc-list"></ul>
  `;

  const types = [...new Set(docs.map((d) => d.type))].sort();
  const statuses = [...new Set(docs.map((d) => d.status))].sort();

  const typeSelect = container.querySelector<HTMLSelectElement>('#filter-type')!;
  const statusSelect = container.querySelector<HTMLSelectElement>('#filter-status')!;

  for (const type of types) {
    const opt = document.createElement('option');
    opt.value = type;
    opt.textContent = type;
    typeSelect.appendChild(opt);
  }
  for (const status of statuses) {
    const opt = document.createElement('option');
    opt.value = status;
    opt.textContent = status;
    statusSelect.appendChild(opt);
  }

  const listEl = container.querySelector<HTMLUListElement>('#doc-list')!;
  const draftListEl = container.querySelector<HTMLUListElement>('#draft-list')!;
  const searchInput = container.querySelector<HTMLInputElement>('#search-input')!;
  const searchWrap = container.querySelector<HTMLDivElement>('#search-results-wrap')!;

  let activeSlug: string | null = null;
  let activeDraftId: string | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function renderDrafts(): void {
    draftListEl.innerHTML = '';
    if (drafts.length === 0) {
      draftListEl.innerHTML = '<li class="placeholder">No drafts</li>';
      return;
    }
    for (const draft of drafts) {
      const li = document.createElement('li');
      if (draft.id === activeDraftId) {
        li.classList.add('active');
      }
      li.innerHTML = `<div>${draft.title}</div><div class="meta">${draft.slug} · draft</div>`;
      li.addEventListener('click', () => {
        activeDraftId = draft.id;
        activeSlug = null;
        renderDrafts();
        applyFilters();
        callbacks.onSelectDraft?.(draft);
      });
      draftListEl.appendChild(li);
    }
  }

  renderDrafts();

  container.querySelector<HTMLButtonElement>('#new-draft')?.addEventListener('click', () => {
    callbacks.onNewDraft?.();
  });

  function renderList(filtered: ListDocsItem[]): void {
    listEl.innerHTML = '';
    for (const doc of filtered) {
      const li = document.createElement('li');
      if (doc.slug === activeSlug) {
        li.classList.add('active');
      }
      li.innerHTML = `<div>${doc.title}</div><div class="meta">${doc.type} · ${doc.status}</div>`;
      li.addEventListener('click', () => {
        activeSlug = doc.slug;
        activeDraftId = null;
        renderDrafts();
        renderList(filtered);
        callbacks.onSelectSlug(doc.slug);
      });
      listEl.appendChild(li);
    }
  }

  function applyFilters(): void {
    const type = typeSelect.value;
    const status = statusSelect.value;
    const filtered = docs.filter((doc) => {
      if (type && doc.type !== type) {
        return false;
      }
      if (status && doc.status !== status) {
        return false;
      }
      return true;
    });
    renderList(filtered);
  }

  typeSelect.addEventListener('change', applyFilters);
  statusSelect.addEventListener('change', applyFilters);
  applyFilters();

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    if (!q) {
      searchWrap.classList.add('hidden');
      searchWrap.innerHTML = '';
      return;
    }
    debounceTimer = setTimeout(() => {
      callbacks.onSearch(q);
    }, 300);
  });

  container.setActiveSlug = (slug: string) => {
    activeSlug = slug;
    activeDraftId = null;
    renderDrafts();
    applyFilters();
  };

  container.setActiveDraft = (id: string) => {
    activeDraftId = id;
    activeSlug = null;
    renderDrafts();
    applyFilters();
  };

  container.refreshDrafts = (nextDrafts: Draft[]) => {
    drafts.length = 0;
    drafts.push(...nextDrafts);
    renderDrafts();
  };

  container.showSearchResults = (results: { slug: string; title: string; snippet: string }[]) => {
    searchWrap.classList.remove('hidden');
    if (results.length === 0) {
      searchWrap.innerHTML = '<p class="placeholder">No matches</p>';
      return;
    }
    const ul = document.createElement('ul');
    ul.className = 'search-results';
    for (const r of results) {
      const li = document.createElement('li');
      li.innerHTML = `<div>${r.title}</div><div class="snippet">${r.snippet}</div>`;
      li.addEventListener('click', () => {
        activeSlug = r.slug;
        callbacks.onSelectSlug(r.slug);
      });
      ul.appendChild(li);
    }
    searchWrap.innerHTML = '';
    searchWrap.appendChild(ul);
  };
}

declare global {
  interface HTMLElement {
    setActiveSlug?: (slug: string) => void;
    setActiveDraft?: (id: string) => void;
    refreshDrafts?: (drafts: Draft[]) => void;
    showSearchResults?: (
      results: { slug: string; title: string; snippet: string }[],
    ) => void;
  }
}
