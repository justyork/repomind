import {
  createFsFolder,
  createFsPage,
  deleteFsNode,
  listTemplates,
  type Draft,
  type PageTemplate,
  type TreeFolderNode,
  type TreeNode,
  type TreePageNode,
} from './api.js';
import { renderTreeFolderNodeIcon, renderTreePageIcon } from './tree-icons.js';
import { openBlankPageModal, openTemplatePageModal } from './tree-template-modal.js';
import { resolveCreateParentForPage } from './tree-page-parent.js';
import { applyTreeRowDragSource, applyTreeRowDropTarget, applyTreeChildrenDropTarget, bindTreeDnD } from './tree-dnd.js';

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
    templates: PageTemplate[];
    resolveCreateParent: () => Promise<string | null>;
  },
  callbacks: TreeSidebarCallbacks,
): void {
  closeTreeMenus();

  const { kind, folderPath, page, templates, resolveCreateParent } = options;

  const showDelete = kind === 'page' || (kind === 'folder' && Boolean(folderPath));
  const hasTemplates = templates.length > 0;

  const menu = document.createElement('div');
  menu.className = 'tree-create-menu tree-context-menu';
  menu.innerHTML = `
    <button type="button" data-action="folder">Добавить директорию</button>
    <button type="button" data-action="page">Создать файл</button>
    ${hasTemplates ? '<button type="button" data-action="template">Создать из шаблона</button>' : ''}
    ${showDelete ? '<button type="button" data-action="delete" class="tree-menu-danger">Удалить</button>' : ''}
  `;

  const rect = anchor.getBoundingClientRect();
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${Math.max(8, rect.right - 200)}px`;
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
    void (async () => {
      const targetParent = await resolveCreateParent();
      if (targetParent === null) {
        return;
      }
      openBlankPageModal((name) => {
        createPage(targetParent, name, undefined, callbacks);
      });
    })();
  });

  menu.querySelector('[data-action="template"]')?.addEventListener('click', () => {
    close();
    void (async () => {
      const targetParent = await resolveCreateParent();
      if (targetParent === null) {
        return;
      }
      openTemplatePageModal(templates, (name, templateId) => {
        createPage(targetParent, name, templateId, callbacks);
      });
    })();
  });

  menu.querySelector('[data-action="folder"]')?.addEventListener('click', () => {
    close();
    const name = window.prompt('Имя директории:');
    if (!name?.trim()) {
      return;
    }
    void (async () => {
      const targetParent = await resolveCreateParent();
      if (targetParent === null) {
        return;
      }
      void createFsFolder(targetParent, name.trim())
        .then(() => callbacks.onTreeChanged?.())
        .catch((err: unknown) => {
          callbacks.onError?.(err instanceof Error ? err.message : 'Create folder failed');
        });
    })();
  });

  menu.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
    close();
    if (kind === 'page' && page) {
      if (!window.confirm(`Удалить «${page.title}»?`)) {
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
      return;
    }
    if (kind === 'folder' && folderPath) {
      if (!window.confirm(`Удалить «${folderPath}» и всё содержимое?`)) {
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
    }
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

  function rememberExpandedFolder(folderPath: string): void {
    expanded.add('');
    let acc = '';
    for (const segment of folderPath.split('/').filter(Boolean)) {
      acc = acc ? `${acc}/${segment}` : segment;
      expanded.add(acc);
    }
    saveExpanded(expanded);
  }

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

  function renderPageRow(node: TreePageNode, depth: number): HTMLElement {
    const block = document.createElement('div');
    block.className = 'tree-page';
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
        resolveCreateParent: () =>
          resolveCreateParentForPage(node, {
            onTreeChanged: callbacks.onTreeChanged,
            onError: callbacks.onError,
            onExpandFolder: rememberExpandedFolder,
          }),
      });
    });

    row.querySelector('.tree-label')?.addEventListener('click', () => {
      activeSlug = node.slug;
      activeDraftId = null;
      renderTree();
      renderDrafts();
      callbacks.onSelectSlug(node.slug);
    });

    applyTreeRowDragSource(row, 'page', node.relativePath);

    block.appendChild(row);
    return block;
  }

  function renderFolder(node: TreeFolderNode, depth: number): HTMLElement {
    const block = document.createElement('div');
    block.className = 'tree-folder';
    const isOpen = expanded.has(node.relativePath);
    const hasIndexPage = Boolean(node.indexPageSlug);
    const displayTitle = node.indexPageTitle ?? node.name;
    const row = document.createElement('div');
    row.className = 'tree-row';
    row.style.paddingLeft = `${depth * 12 + 8}px`;
    if (hasIndexPage && node.indexPageSlug === activeSlug) {
      row.classList.add('active');
    }
    row.innerHTML = `
      <button type="button" class="tree-toggle" aria-expanded="${isOpen}">${isOpen ? '▾' : '▸'}</button>
      <button type="button" class="tree-label">
        ${renderTreeFolderNodeIcon(node)}
        <span class="tree-title">${escapeHtml(displayTitle)}</span>
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
      if (hasIndexPage && node.indexPageSlug) {
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
        resolveCreateParent: async () => node.relativePath,
      });
    });

    applyTreeRowDragSource(row, 'folder', node.relativePath);
    applyTreeRowDropTarget(row, node.relativePath);

    block.appendChild(row);

    if (isOpen) {
      const children = document.createElement('div');
      children.className = 'tree-children';
      applyTreeChildrenDropTarget(children, node.relativePath);
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

  bindTreeDnD(treeEl, {
    onTreeChanged: callbacks.onTreeChanged,
    onError: callbacks.onError,
    onNotify: callbacks.onNotify,
  });

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
    tree.indexPageTitle = nextTree.indexPageTitle;
    tree.indexPageRelativePath = nextTree.indexPageRelativePath;
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

declare global {
  interface HTMLElement {
    setActiveSlug?: (slug: string) => void;
    setActiveDraft?: (id: string) => void;
    refreshDrafts?: (drafts: Draft[]) => void;
    refreshTree?: (tree: TreeFolderNode, drafts: Draft[]) => void;
  }
}
