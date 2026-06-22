import {
  createFsFolder,
  createFsPage,
  setCatalogEmoji,
  type Draft,
  type TreeFolderNode,
  type TreeNode,
} from './api.js';
import { catalogIconLetter } from './catalog.js';

export interface TreeSidebarCallbacks {
  onSelectSlug: (slug: string) => void;
  onSelectDraft?: (draft: Draft) => void;
  onTreeChanged?: () => void;
  onError?: (message: string) => void;
}

const EXPANDED_KEY = 'repomind-tree-expanded';

function loadExpanded(): Set<string> {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY);
    if (!raw) {
      return new Set(['']);
    }
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set(['']);
  }
}

function saveExpanded(expanded: Set<string>): void {
  localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expanded]));
}

function folderIcon(node: TreeFolderNode): string {
  if (node.emoji) {
    return node.emoji;
  }
  return '📁';
}

function pageIcon(type: string): string {
  const letter = catalogIconLetter(type);
  return letter.length === 1 ? letter : '📄';
}

function showCreateMenu(
  anchor: HTMLElement,
  parentPath: string,
  isFolder: boolean,
  callbacks: TreeSidebarCallbacks,
): void {
  document.querySelector('.tree-create-menu')?.remove();

  const menu = document.createElement('div');
  menu.className = 'tree-create-menu';
  menu.innerHTML = `
    <button type="button" data-action="page">New page</button>
    <button type="button" data-action="folder">New folder</button>
    ${isFolder ? '<button type="button" data-action="emoji">Set emoji</button>' : ''}
  `;

  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${Math.max(8, rect.left - 120)}px`;
  document.body.appendChild(menu);

  const close = () => menu.remove();
  const onDocClick = (event: MouseEvent) => {
    if (!menu.contains(event.target as Node)) {
      close();
      document.removeEventListener('click', onDocClick);
    }
  };
  setTimeout(() => document.addEventListener('click', onDocClick), 0);

  menu.querySelector('[data-action="page"]')?.addEventListener('click', () => {
    close();
    const name = window.prompt('Page name (without .md):');
    if (!name?.trim()) {
      return;
    }
    void createFsPage(parentPath, name.trim())
      .then(({ draft }) => {
        callbacks.onTreeChanged?.();
        callbacks.onSelectDraft?.(draft);
      })
      .catch((err: unknown) => {
        callbacks.onError?.(err instanceof Error ? err.message : 'Create page failed');
      });
  });

  menu.querySelector('[data-action="folder"]')?.addEventListener('click', () => {
    close();
    const name = window.prompt('Folder name:');
    if (!name?.trim()) {
      return;
    }
    void createFsFolder(parentPath, name.trim())
      .then(() => callbacks.onTreeChanged?.())
      .catch((err: unknown) => {
        callbacks.onError?.(err instanceof Error ? err.message : 'Create folder failed');
      });
  });

  menu.querySelector('[data-action="emoji"]')?.addEventListener('click', () => {
    close();
    const emoji = window.prompt('Emoji for this folder:');
    if (emoji === null) {
      return;
    }
    void setCatalogEmoji(parentPath, emoji)
      .then(() => callbacks.onTreeChanged?.())
      .catch((err: unknown) => {
        callbacks.onError?.(err instanceof Error ? err.message : 'Set emoji failed');
      });
  });
}

export function renderTreeSidebar(
  container: HTMLElement,
  tree: TreeFolderNode,
  drafts: Draft[],
  callbacks: TreeSidebarCallbacks,
): void {
  container.innerHTML = `
    <nav id="docs-tree" class="docs-tree" aria-label="Documentation tree"></nav>
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

  const treeEl = container.querySelector<HTMLElement>('#docs-tree')!;
  const draftListEl = container.querySelector<HTMLUListElement>('#draft-list')!;
  const expanded = loadExpanded();

  let activeSlug: string | null = null;
  let activeDraftId: string | null = null;

  function renderPageRow(node: TreeNode & { kind: 'page' }, depth: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'tree-row';
    row.style.paddingLeft = `${depth * 12 + 8}px`;
    if (node.slug === activeSlug) {
      row.classList.add('active');
    }
    row.innerHTML = `
      <span class="tree-spacer" aria-hidden="true"></span>
      <button type="button" class="tree-label">
        <span class="tree-icon tree-icon--page">${pageIcon(node.type)}</span>
        <span class="tree-title">${escapeHtml(node.title)}</span>
      </button>
      <button type="button" class="tree-add" title="Create here">+</button>
    `;
    const parentPath = node.relativePath.includes('/')
      ? node.relativePath.slice(0, node.relativePath.lastIndexOf('/'))
      : '';

    row.querySelector('.tree-label')?.addEventListener('click', () => {
      activeSlug = node.slug;
      activeDraftId = null;
      renderTree();
      renderDrafts();
      callbacks.onSelectSlug(node.slug);
    });
    row.querySelector('.tree-add')?.addEventListener('click', (event) => {
      event.stopPropagation();
      showCreateMenu(event.currentTarget as HTMLElement, parentPath, false, callbacks);
    });
    return row;
  }

  function renderFolder(node: TreeFolderNode, depth: number): HTMLElement {
    const block = document.createElement('div');
    block.className = 'tree-folder';
    const isOpen = expanded.has(node.relativePath);
    const row = document.createElement('div');
    row.className = 'tree-row';
    row.style.paddingLeft = `${depth * 12 + 8}px`;
    row.innerHTML = `
      <button type="button" class="tree-toggle" aria-expanded="${isOpen}">${isOpen ? '▾' : '▸'}</button>
      <button type="button" class="tree-label">
        <span class="tree-icon tree-icon--folder">${folderIcon(node)}</span>
        <span class="tree-title">${escapeHtml(node.name)}</span>
      </button>
      <button type="button" class="tree-add" title="Create here">+</button>
    `;

    row.querySelector('.tree-toggle')?.addEventListener('click', (event) => {
      event.stopPropagation();
      if (expanded.has(node.relativePath)) {
        expanded.delete(node.relativePath);
      } else {
        expanded.add(node.relativePath);
      }
      saveExpanded(expanded);
      renderTree();
    });

    row.querySelector('.tree-label')?.addEventListener('click', () => {
      if (node.indexPageSlug) {
        activeSlug = node.indexPageSlug;
        activeDraftId = null;
        renderTree();
        renderDrafts();
        callbacks.onSelectSlug(node.indexPageSlug);
        return;
      }
      if (expanded.has(node.relativePath)) {
        expanded.delete(node.relativePath);
      } else {
        expanded.add(node.relativePath);
      }
      saveExpanded(expanded);
      renderTree();
    });

    row.querySelector('.tree-add')?.addEventListener('click', (event) => {
      event.stopPropagation();
      showCreateMenu(event.currentTarget as HTMLElement, node.relativePath, true, callbacks);
    });

    block.appendChild(row);

    if (isOpen) {
      const children = document.createElement('div');
      children.className = 'tree-children';
      for (const child of node.children ?? []) {
        if (child.kind === 'folder') {
          children.appendChild(renderFolder(child, depth + 1));
        } else {
          children.appendChild(renderPageRow(child, depth + 1));
        }
      }
      block.appendChild(children);
    }

    return block;
  }

  function renderTree(): void {
    treeEl.innerHTML = '';
    treeEl.appendChild(renderFolder(tree, 0));
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
      li.innerHTML = `<span class="page-title">${escapeHtml(draft.title || draft.slug)}</span><span class="status-chip status-draft">draft</span>`;
      li.addEventListener('click', () => {
        activeDraftId = draft.id;
        activeSlug = null;
        renderTree();
        renderDrafts();
        callbacks.onSelectDraft?.(draft);
      });
      draftListEl.appendChild(li);
    }
  }

  renderTree();
  renderDrafts();

  container.querySelector('[data-catalog="__drafts__"]')?.addEventListener('click', () => {
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
    expanded.add('');
    saveExpanded(expanded);
    renderTree();
    renderDrafts();
  };

  container.setActiveDraft = (id: string) => {
    activeDraftId = id;
    activeSlug = null;
    renderTree();
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

  container.refreshTree = (nextTree: TreeFolderNode, nextDrafts: Draft[]) => {
    tree.children = nextTree.children ?? [];
    tree.emoji = nextTree.emoji;
    tree.indexPageSlug = nextTree.indexPageSlug;
    drafts.length = 0;
    drafts.push(...(nextDrafts ?? []));
    renderTree();
    renderDrafts();
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

declare global {
  interface HTMLElement {
    setActiveSlug?: (slug: string) => void;
    setActiveDraft?: (id: string) => void;
    refreshDrafts?: (drafts: Draft[]) => void;
    refreshTree?: (tree: TreeFolderNode, drafts: Draft[]) => void;
  }
}
