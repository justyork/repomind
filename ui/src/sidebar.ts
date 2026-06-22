import { CATALOG_ORDER, catalogIconLetter, catalogLabel, groupDocsByCatalog, type CatalogSubfolder } from './catalog.js';
import type { Draft, ListDocsItem } from './api.js';

export interface SidebarCallbacks {
  onSelectSlug: (slug: string) => void;
  onSelectDraft?: (draft: Draft) => void;
  onNewDraft?: () => void;
  onSelectCatalog?: (type: string) => void;
}

const STORAGE_KEY = 'repomind-catalog-expanded';

function loadExpanded(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return new Set(CATALOG_ORDER);
    }
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set(CATALOG_ORDER);
  }
}

function saveExpanded(expanded: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...expanded]));
}

export function renderSidebar(
  container: HTMLElement,
  docs: ListDocsItem[],
  drafts: Draft[],
  callbacks: SidebarCallbacks,
): void {
  container.innerHTML = `
    <div class="sidebar-actions">
      <button type="button" id="new-draft" class="btn-primary btn-block">Create page</button>
    </div>
    <nav id="catalog-tree" class="catalog-tree" aria-label="Knowledge catalogs"></nav>
    <section class="catalog-section catalog-drafts">
      <button type="button" class="catalog-header" data-catalog="__drafts__" aria-expanded="true">
        <span class="catalog-chevron" aria-hidden="true">▾</span>
        <span class="catalog-icon catalog-icon--draft" aria-hidden="true">✎</span>
        <span class="catalog-label">Drafts</span>
        <span class="catalog-count">${drafts.length}</span>
      </button>
      <ul id="draft-list" class="catalog-pages"></ul>
    </section>
  `;

  const treeEl = container.querySelector<HTMLElement>('#catalog-tree')!;
  const draftListEl = container.querySelector<HTMLUListElement>('#draft-list')!;
  const expanded = loadExpanded();

  let activeSlug: string | null = null;
  let activeDraftId: string | null = null;

  function appendDocItem(listEl: HTMLElement, doc: ListDocsItem): void {
    const li = document.createElement('li');
    li.className = 'page-item';
    if (doc.slug === activeSlug) {
      li.classList.add('active');
    }
    li.dataset.slug = doc.slug;
    const statusChip =
      doc.status !== 'accepted'
        ? `<span class="status-chip status-${doc.status}">${doc.status}</span>`
        : '';
    const pathHint =
      doc.type === 'wiki-page' && doc.relativePath.includes('/')
        ? `<span class="page-path">${doc.relativePath.replace(/\.md$/i, '')}</span>`
        : '';
    li.innerHTML = `
      <span class="catalog-icon catalog-icon--${doc.type} catalog-icon--sm" aria-hidden="true">${catalogIconLetter(doc.type)}</span>
      <span class="page-item-text">
        <span class="page-title">${doc.title}</span>
        ${pathHint}
      </span>
      ${statusChip}
    `;
    li.addEventListener('click', () => {
      activeSlug = doc.slug;
      activeDraftId = null;
      renderCatalogTree();
      renderDrafts();
      callbacks.onSelectSlug(doc.slug);
    });
    listEl.appendChild(li);
  }

  function appendSubfolder(parentEl: HTMLElement, subfolder: CatalogSubfolder, parentExpanded: boolean): void {
    const subKey = `subfolder:${subfolder.path}`;
    const isOpen = parentExpanded && (expanded.has(subKey) || expanded.size === 0);
    const block = document.createElement('li');
    block.className = 'catalog-subfolder';
    block.innerHTML = `
      <button type="button" class="catalog-subheader" data-subfolder="${subfolder.path}" aria-expanded="${isOpen}">
        <span class="catalog-chevron" aria-hidden="true">${isOpen ? '▾' : '▸'}</span>
        <span class="catalog-label">${subfolder.label}</span>
        <span class="catalog-count">${subfolder.docs.length}</span>
      </button>
      <ul class="catalog-pages catalog-pages--nested${isOpen ? '' : ' hidden'}"></ul>
    `;
    const listEl = block.querySelector<HTMLUListElement>('.catalog-pages')!;
    for (const doc of subfolder.docs) {
      appendDocItem(listEl, doc);
    }
    block.querySelector<HTMLButtonElement>('.catalog-subheader')?.addEventListener('click', (event) => {
      event.stopPropagation();
      if (expanded.has(subKey)) {
        expanded.delete(subKey);
      } else {
        expanded.add(subKey);
      }
      saveExpanded(expanded);
      renderCatalogTree();
    });
    parentEl.appendChild(block);
  }

  function renderCatalogTree(): void {
    const groups = groupDocsByCatalog(docs);
    treeEl.innerHTML = '';

    for (const group of groups) {
      const isOpen = expanded.has(group.type) || expanded.size === 0;
      const section = document.createElement('section');
      section.className = 'catalog-section';
      const totalCount =
        group.docs.length +
        (group.subfolders?.reduce((sum, folder) => sum + folder.docs.length, 0) ?? 0);
      section.innerHTML = `
        <button type="button" class="catalog-header" data-catalog="${group.type}" aria-expanded="${isOpen}">
          <span class="catalog-chevron" aria-hidden="true">${isOpen ? '▾' : '▸'}</span>
          <span class="catalog-icon catalog-icon--${group.type.startsWith('folder:') ? 'folder' : group.type}" aria-hidden="true">${catalogIconLetter(group.type)}</span>
          <span class="catalog-label">${group.label}</span>
          <span class="catalog-count">${totalCount}</span>
        </button>
        <ul class="catalog-pages${isOpen ? '' : ' hidden'}"></ul>
      `;

      const listEl = section.querySelector<HTMLUListElement>('.catalog-pages')!;
      for (const doc of group.docs) {
        appendDocItem(listEl, doc);
      }
      if (group.subfolders) {
        for (const subfolder of group.subfolders) {
          appendSubfolder(listEl, subfolder, isOpen);
        }
      }

      section.querySelector<HTMLButtonElement>('.catalog-header')?.addEventListener('click', () => {
        const catalog = group.type;
        if (expanded.size === 0) {
          for (const g of groups) {
            expanded.add(g.type);
          }
        }
        if (expanded.has(catalog)) {
          expanded.delete(catalog);
        } else {
          expanded.add(catalog);
        }
        saveExpanded(expanded);
        renderCatalogTree();
        callbacks.onSelectCatalog?.(catalog);
      });

      treeEl.appendChild(section);
    }
  }

  function renderDrafts(): void {
    draftListEl.innerHTML = '';
    if (drafts.length === 0) {
      draftListEl.innerHTML = '<li class="placeholder page-item">No drafts</li>';
      return;
    }
    for (const draft of drafts) {
      const li = document.createElement('li');
      li.className = 'page-item';
      if (draft.id === activeDraftId) {
        li.classList.add('active');
      }
      li.innerHTML = `<span class="page-title">${draft.title || draft.slug}</span><span class="status-chip status-draft">draft</span>`;
      li.addEventListener('click', () => {
        activeDraftId = draft.id;
        activeSlug = null;
        renderCatalogTree();
        renderDrafts();
        callbacks.onSelectDraft?.(draft);
      });
      draftListEl.appendChild(li);
    }
  }

  renderCatalogTree();
  renderDrafts();

  container.querySelector<HTMLButtonElement>('#new-draft')?.addEventListener('click', () => {
    callbacks.onNewDraft?.();
  });

  container.querySelector<HTMLButtonElement>('[data-catalog="__drafts__"]')?.addEventListener('click', () => {
    const list = container.querySelector('#draft-list');
    const btn = container.querySelector('[data-catalog="__drafts__"]');
    const open = list?.classList.toggle('hidden') === false;
    btn?.setAttribute('aria-expanded', String(open));
    const chevron = btn?.querySelector('.catalog-chevron');
    if (chevron) {
      chevron.textContent = open ? '▾' : '▸';
    }
  });

  container.setActiveSlug = (slug: string) => {
    activeSlug = slug;
    activeDraftId = null;
    const doc = docs.find((d) => d.slug === slug);
    if (doc) {
      if (doc.type === 'wiki-page') {
        const top = doc.relativePath.includes('/')
          ? `folder:${doc.relativePath.split('/')[0]}`
          : 'folder:__root__';
        expanded.add(top);
      } else {
        expanded.add(doc.type);
      }
      saveExpanded(expanded);
    }
    renderCatalogTree();
    renderDrafts();
  };

  container.setActiveDraft = (id: string) => {
    activeDraftId = id;
    activeSlug = null;
    renderCatalogTree();
    renderDrafts();
  };

  container.refreshDrafts = (nextDrafts: Draft[]) => {
    drafts.length = 0;
    drafts.push(...nextDrafts);
    renderDrafts();
    const countEl = container.querySelector('.catalog-drafts .catalog-count');
    if (countEl) {
      countEl.textContent = String(drafts.length);
    }
  };
}

declare global {
  interface HTMLElement {
    setActiveSlug?: (slug: string) => void;
    setActiveDraft?: (id: string) => void;
    refreshDrafts?: (drafts: Draft[]) => void;
  }
}
