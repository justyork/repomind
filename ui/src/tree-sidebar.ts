import {
  createFsFolder,
  createFsPage,
  deleteFsNode,
  listTemplates,
  moveFsPage,
  renameFsPage,
  setCatalogEmoji,
  type Draft,
  type PageTemplate,
  type TreeFolderNode,
  type TreeNode,
  type TreePageNode,
} from './api.js';
import { renderTreeFolderNodeIcon, renderTreePageIcon } from './tree-icons.js';

export interface TreeSidebarCallbacks {
  onSelectSlug: (slug: string) => void;
  onSelectDraft?: (draft: Draft) => void;
  onTreeChanged?: () => void;
  onFsDeleted?: (deletedSlugs: string[]) => void;
  onError?: (message: string) => void;
  onNotify?: (message: string) => void;
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

function closeTreeMenus(): void {
  document.querySelectorAll('.tree-context-menu').forEach((menu) => menu.remove());
}

function collectFolderPaths(node: TreeFolderNode): string[] {
  const paths: string[] = [node.relativePath];
  for (const child of node.children ?? []) {
    if (child.kind === 'folder') {
      paths.push(...collectFolderPaths(child));
    }
  }
  return paths;
}

function promptPageName(): string | null {
  const name = window.prompt('Page name (without .md):');
  return name?.trim() ? name.trim() : null;
}

function createPage(
  parentPath: string,
  name: string,
  templateId: string | undefined,
  callbacks: TreeSidebarCallbacks,
): void {
  void createFsPage(parentPath, name, undefined, templateId)
    .then(({ draft }) => {
      callbacks.onTreeChanged?.();
      callbacks.onSelectDraft?.(draft);
    })
    .catch((err: unknown) => {
      callbacks.onError?.(err instanceof Error ? err.message : 'Create page failed');
    });
}

function showContextMenu(
  anchor: HTMLElement,
  options: {
    kind: 'page' | 'folder';
    parentPath: string;
    folderPath: string;
    page?: TreePageNode;
    tree: TreeFolderNode;
    templates: PageTemplate[];
  },
  callbacks: TreeSidebarCallbacks,
): void {
  closeTreeMenus();

  const { kind, parentPath, folderPath, page, tree, templates } = options;
  const moveTargets =
    kind === 'page' && page
      ? collectFolderPaths(tree).filter((path) => {
          const pageParent = page.relativePath.includes('/')
            ? page.relativePath.slice(0, page.relativePath.lastIndexOf('/'))
            : '';
          return path !== pageParent;
        })
      : [];

  const menu = document.createElement('div');
  menu.className = 'tree-create-menu tree-context-menu';
  menu.innerHTML = `
    <div class="tree-menu-label">Create</div>
    <button type="button" data-action="page">New page</button>
    ${templates
      .map(
        (template) =>
          `<button type="button" data-action="template" data-template="${escapeAttr(template.id)}">From template: ${escapeHtml(template.label)}</button>`,
      )
      .join('')}
    <button type="button" data-action="folder">New folder</button>
    ${
      kind === 'folder' && folderPath
        ? '<button type="button" data-action="emoji">Set emoji</button>'
        : ''
    }
    ${
      kind === 'page' && page
        ? `
      <div class="tree-menu-label">Page</div>
      <button type="button" data-action="rename">Rename…</button>
      ${moveTargets.length > 0 ? '<div class="tree-menu-label">Move to</div>' : ''}
      ${moveTargets
        .map(
          (folder) =>
            `<button type="button" data-action="move" data-folder="${escapeAttr(folder)}">${escapeHtml(folder || '(root)')}</button>`,
        )
        .join('')}
      <button type="button" data-action="delete-page" class="tree-menu-danger">Delete page</button>
    `
        : ''
    }
    ${
      kind === 'folder' && folderPath
        ? '<button type="button" data-action="delete-folder" class="tree-menu-danger">Delete folder</button>'
        : ''
    }
  `;

  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${Math.max(8, rect.left - 160)}px`;
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
    const name = promptPageName();
    if (!name) {
      return;
    }
    createPage(parentPath, name, undefined, callbacks);
  });

  menu.querySelectorAll<HTMLButtonElement>('[data-action="template"]').forEach((button) => {
    button.addEventListener('click', () => {
      close();
      const name = promptPageName();
      if (!name) {
        return;
      }
      createPage(parentPath, name, button.dataset.template, callbacks);
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
    void setCatalogEmoji(folderPath, emoji)
      .then(() => callbacks.onTreeChanged?.())
      .catch((err: unknown) => {
        callbacks.onError?.(err instanceof Error ? err.message : 'Set emoji failed');
      });
  });

  menu.querySelector('[data-action="rename"]')?.addEventListener('click', () => {
    close();
    if (!page) {
      return;
    }
    const currentName = page.relativePath.split('/').pop()?.replace(/\.md$/, '') ?? page.name;
    const newName = window.prompt('New page name (without .md):', currentName);
    if (!newName?.trim() || newName.trim() === currentName) {
      return;
    }
    void renameFsPage(page.relativePath, newName.trim())
      .then(({ result }) => {
        callbacks.onTreeChanged?.();
        if (result.cascadeUpdated.length > 0) {
          callbacks.onNotify?.(
            `Renamed to ${result.slug}; updated links in ${result.cascadeUpdated.length} file(s).`,
          );
        } else if (result.slugChanged && result.inboundWarnings.length > 0) {
          callbacks.onError?.(
            `Renamed to ${result.slug}; ${result.inboundWarnings.length} page(s) may still reference the old slug.`,
          );
        }
        callbacks.onSelectSlug(result.slug);
      })
      .catch((err: unknown) => {
        callbacks.onError?.(err instanceof Error ? err.message : 'Rename failed');
      });
  });

  menu.querySelectorAll<HTMLButtonElement>('[data-action="move"]').forEach((button) => {
    button.addEventListener('click', () => {
      close();
      if (!page) {
        return;
      }
      const toDir = button.dataset.folder ?? '';
      void moveFsPage(page.relativePath, toDir)
        .then(({ result }) => {
          callbacks.onTreeChanged?.();
          if (result.cascadeUpdated.length > 0) {
            callbacks.onNotify?.(
              `Moved to ${result.relativePath}; updated links in ${result.cascadeUpdated.length} file(s).`,
            );
          } else if (result.slugChanged && result.inboundWarnings.length > 0) {
            callbacks.onError?.(
              `Moved; slug is now ${result.slug}. ${result.inboundWarnings.length} page(s) still reference the old slug.`,
            );
          }
          callbacks.onSelectSlug(result.slug);
        })
        .catch((err: unknown) => {
          callbacks.onError?.(err instanceof Error ? err.message : 'Move failed');
        });
    });
  });

  menu.querySelector('[data-action="delete-page"]')?.addEventListener('click', () => {
    close();
    if (!page) {
      return;
    }
    if (!window.confirm(`Delete page "${page.title}"?`)) {
      return;
    }
    void deleteFsNode(page.relativePath, 'page')
      .then(({ result }) => {
        callbacks.onFsDeleted?.([result.slug]);
        callbacks.onTreeChanged?.();
        if (result.cascadeUpdated.length > 0) {
          callbacks.onNotify?.(
            `Deleted ${result.slug}; cleaned links in ${result.cascadeUpdated.length} file(s).`,
          );
        } else if (result.inboundWarnings.length > 0) {
          callbacks.onError?.(
            `${result.inboundWarnings.length} page(s) still reference deleted slug "${result.slug}".`,
          );
        }
      })
      .catch((err: unknown) => {
        callbacks.onError?.(err instanceof Error ? err.message : 'Delete failed');
      });
  });

  menu.querySelector('[data-action="delete-folder"]')?.addEventListener('click', () => {
    close();
    if (!folderPath) {
      return;
    }
    if (!window.confirm(`Delete folder "${folderPath}" and all pages inside?`)) {
      return;
    }
    void deleteFsNode(folderPath, 'folder')
      .then(({ result }) => {
        callbacks.onFsDeleted?.(result.deletedSlugs);
        callbacks.onTreeChanged?.();
        if (result.cascadeUpdated.length > 0) {
          callbacks.onNotify?.(
            `Deleted folder; cleaned links in ${result.cascadeUpdated.length} file(s).`,
          );
        } else if (result.inboundWarnings.length > 0) {
          callbacks.onError?.(
            `${result.inboundWarnings.length} page(s) still reference deleted page(s).`,
          );
        }
      })
      .catch((err: unknown) => {
        callbacks.onError?.(err instanceof Error ? err.message : 'Delete folder failed');
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
  let templatesCache: PageTemplate[] | null = null;

  let activeSlug: string | null = null;
  let activeDraftId: string | null = null;

  async function openMenu(
    anchor: HTMLElement,
    options: Omit<Parameters<typeof showContextMenu>[1], 'templates'>,
  ): Promise<void> {
    try {
      if (!templatesCache) {
        templatesCache = (await listTemplates()).templates;
      }
      showContextMenu(anchor, { ...options, templates: templatesCache }, callbacks);
    } catch (err: unknown) {
      callbacks.onError?.(err instanceof Error ? err.message : 'Failed to open menu');
    }
  }

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
        ${renderTreePageIcon(node.type, node.contentKind)}
        <span class="tree-title">${escapeHtml(node.title)}</span>
      </button>
      <button type="button" class="tree-menu" title="Actions">⋯</button>
    `;
    const parentPath = node.relativePath.includes('/')
      ? node.relativePath.slice(0, node.relativePath.lastIndexOf('/'))
      : '';

    row.querySelector('.tree-menu')?.addEventListener('click', (event) => {
      event.stopPropagation();
      void openMenu(event.currentTarget as HTMLElement, {
        kind: 'page',
        parentPath,
        folderPath: parentPath,
        page: node,
        tree,
      });
    });

    row.querySelector('.tree-label')?.addEventListener('click', () => {
      activeSlug = node.slug;
      activeDraftId = null;
      renderTree();
      renderDrafts();
      callbacks.onSelectSlug(node.slug);
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
        ${renderTreeFolderNodeIcon(node)}
        <span class="tree-title">${escapeHtml(node.name)}</span>
      </button>
      <button type="button" class="tree-menu" title="Actions">⋯</button>
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

    row.querySelector('.tree-menu')?.addEventListener('click', (event) => {
      event.stopPropagation();
      void openMenu(event.currentTarget as HTMLElement, {
        kind: 'folder',
        parentPath: node.relativePath,
        folderPath: node.relativePath,
        tree,
      });
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
    tree.indexPageType = nextTree.indexPageType;
    tree.indexPageContentKind = nextTree.indexPageContentKind;
    tree.name = nextTree.name;
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

function escapeAttr(text: string): string {
  return escapeHtml(text);
}

declare global {
  interface HTMLElement {
    setActiveSlug?: (slug: string) => void;
    setActiveDraft?: (id: string) => void;
    refreshDrafts?: (drafts: Draft[]) => void;
    refreshTree?: (tree: TreeFolderNode, drafts: Draft[]) => void;
  }
}
