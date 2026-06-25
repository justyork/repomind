import {
  getDoc,
  getDocsTree,
  getHealth,
  listDocs,
  listDrafts,
  openDraftForSlug,
  searchDocs,
  type Draft,
  type ListDocsItem,
  type SearchResult,
  type TreeFolderNode,
} from './api.js';
import { catalogLabel } from './catalog.js';
import { renderDashboard } from './dashboard.js';
import { renderDraftEditor } from './editor.js';
import {
  destroyPageWorkspace,
  openPageWorkspaceDraft,
  renderPageWorkspace,
} from './page-workspace.js';
import { bindThemeToggle, initTheme } from './theme.js';
import { bindKeyboardNav, collectTreeSlugs } from './keyboard-nav.js';
import { renderTreeSidebar } from './tree-sidebar.js';
import { bindSidebarResize } from './sidebar-resize.js';
import { subscribeDocsReload } from './live-reload.js';
import {
  normalizeAppUrl,
  readDraftIdFromUrl,
  readPathFromUrl,
  readSlugFromUrl,
  subscribePopState,
  writeSlugToUrl,
} from './navigation.js';

normalizeAppUrl();
initTheme();

function buildSlugByRelative(docsList: ListDocsItem[]): Map<string, string> {
  return new Map(docsList.map((doc) => [doc.relativePath, doc.slug]));
}

function relativePathForSlug(docsList: ListDocsItem[], slug: string): string | undefined {
  return docsList.find((doc) => doc.slug === slug)?.relativePath;
}

function showToast(message: string, isError = false): void {
  const banner = document.querySelector<HTMLElement>('#banner');
  if (!banner) {
    return;
  }
  banner.textContent = message;
  banner.classList.toggle('error', isError);
  banner.classList.remove('hidden');
  setTimeout(() => banner.classList.add('hidden'), 5000);
}

async function reloadDrafts(sidebarEl: HTMLElement): Promise<Draft[]> {
  const { drafts } = await listDrafts();
  sidebarEl.refreshDrafts?.(drafts);
  return drafts;
}

async function main(): Promise<void> {
  bindThemeToggle(document.querySelector<HTMLButtonElement>('#theme-toggle'));

  const layoutEl = document.querySelector<HTMLElement>('.layout');
  if (layoutEl) {
    bindSidebarResize(layoutEl);
  }

  const sidebarEl = document.querySelector<HTMLElement>('#sidebar')!;
  const workspaceEl = document.querySelector<HTMLElement>('#workspace')!;
  const healthToggle = document.querySelector<HTMLButtonElement>('#health-toggle')!;
  const statsEl = document.querySelector<HTMLElement>('#stats')!;
  const searchInput = document.querySelector<HTMLInputElement>('#global-search')!;
  const searchDropdown = document.querySelector<HTMLElement>('#search-dropdown')!;

  let docs: ListDocsItem[] = [];
  let currentSlug: string | null = null;
  let treeOrderSlugs: string[] = [];
  let viewMode: 'workspace' | 'dashboard' = 'workspace';
  let dashboardRefresh: (() => Promise<void>) | null = null;
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

  async function reloadTree(sidebarEl: HTMLElement): Promise<TreeFolderNode> {
    const [{ tree }, { drafts }] = await Promise.all([getDocsTree(), listDrafts()]);
    sidebarEl.refreshTree?.(tree, drafts);
    treeOrderSlugs = collectTreeSlugs(tree);
    return tree;
  }

  function setViewMode(mode: 'workspace' | 'dashboard'): void {
    viewMode = mode;
    healthToggle.setAttribute('aria-pressed', String(mode === 'dashboard'));

    if (mode === 'dashboard') {
      const dash = renderDashboard(workspaceEl, {
        onOpenDraft: (draft) => {
          setViewMode('workspace');
          openDraft(draft);
        },
        onPublished: (path) => {
          void (async () => {
            await reloadTree(sidebarEl);
            await refreshStats();
            showToast(`Published: ${path}`);
          })();
        },
        onNotify: (message, isError) => showToast(message, isError),
      });
      dashboardRefresh = dash.refresh;
      return;
    }

    dashboardRefresh = null;
    destroyPageWorkspace();
    renderPageWorkspace(workspaceEl, null, workspaceOptions());
  }

  healthToggle.addEventListener('click', () => {
    setViewMode(viewMode === 'dashboard' ? 'workspace' : 'dashboard');
  });

  bindKeyboardNav({
    onNext: () => {
      if (viewMode !== 'workspace' || !currentSlug) {
        return;
      }
      const index = treeOrderSlugs.indexOf(currentSlug);
      if (index >= 0 && index < treeOrderSlugs.length - 1) {
        void selectSlug(treeOrderSlugs[index + 1]!);
      }
    },
    onPrev: () => {
      if (viewMode !== 'workspace' || !currentSlug) {
        return;
      }
      const index = treeOrderSlugs.indexOf(currentSlug);
      if (index > 0) {
        void selectSlug(treeOrderSlugs[index - 1]!);
      }
    },
    onFocusSearch: () => {
      searchInput.focus();
      searchInput.select();
    },
    onEdit: () => {
      if (viewMode === 'workspace' && currentSlug) {
        void startEdit(currentSlug);
      }
    },
  });

  async function refreshStats(): Promise<void> {
    const health = await getHealth();
    const statsRes = await fetch('/api/stats');
    const stats = (await statsRes.json()) as {
      totalDocs: number;
      brokenRelatedCount: number;
    };
    const { drafts } = await listDrafts();
    const broken =
      stats.brokenRelatedCount > 0 ? ` · ${stats.brokenRelatedCount} broken links` : '';
    statsEl.textContent = `v${health.version} · ${health.docCount} pages · ${drafts.length} drafts${broken}`;
  }

  const knownSlugs = (): string[] => docs.map((d) => d.slug);

  function workspaceOptions() {
    return {
      docIndex: docs,
      onPublished: async (path: string) => {
        const docsRes = await listDocs();
        docs = docsRes.docs;
        await reloadTree(sidebarEl);
        await refreshStats();
        void dashboardRefresh?.();
        showToast(`Published: ${path}`);
      },
      onError: (message: string) => showToast(message, true),
      onReloadDoc: (slug: string) => getDoc(slug),
      onDraftsChanged: () => {
        void reloadDrafts(sidebarEl);
      },
      onCopyLink: () => showToast('Link copied'),
    };
  }

  function renderSearchDropdown(results: SearchResult[]): void {
    if (results.length === 0) {
      searchDropdown.innerHTML = '<p class="search-empty">No matches</p>';
      searchDropdown.classList.remove('hidden');
      return;
    }

    const ul = document.createElement('ul');
    ul.className = 'search-results';
    for (const result of results) {
      const doc = docs.find((d) => d.slug === result.slug);
      const li = document.createElement('li');
      li.innerHTML = `
        <div class="search-result-title">${result.title}</div>
        <div class="search-result-meta">${catalogLabel(doc?.type ?? '')} · ${result.snippet}</div>
      `;
      li.addEventListener('click', () => {
        searchDropdown.classList.add('hidden');
        searchInput.value = '';
        void selectSlug(result.slug);
      });
      ul.appendChild(li);
    }
    searchDropdown.innerHTML = '';
    searchDropdown.appendChild(ul);
    searchDropdown.classList.remove('hidden');
  }

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim();
    if (searchTimer) {
      clearTimeout(searchTimer);
    }
    if (!q) {
      searchDropdown.classList.add('hidden');
      searchDropdown.innerHTML = '';
      return;
    }
    searchTimer = setTimeout(() => {
      void searchDocs(q)
        .then(({ results }) => renderSearchDropdown(results))
        .catch((err) => showToast(err instanceof Error ? err.message : 'Search failed', true));
    }, 300);
  });

  document.addEventListener('click', (event) => {
    if (!searchDropdown.contains(event.target as Node) && event.target !== searchInput) {
      searchDropdown.classList.add('hidden');
    }
  });

  function openDraft(draft: Draft): void {
    setViewMode('workspace');
    sidebarEl.setActiveDraft?.(draft.id);

    const baseSlug = draft.forked_from ?? (docs.some((d) => d.slug === draft.slug) ? draft.slug : null);
    if (baseSlug) {
      void getDoc(baseSlug).then((doc) => {
        openPageWorkspaceDraft(workspaceEl, doc, draft, {
          ...workspaceOptions(),
          docRelativePath: relativePathForSlug(docs, baseSlug),
          slugByRelative: buildSlugByRelative(docs),
          onPublished: async (path) => {
            await workspaceOptions().onPublished(path);
            await selectSlug(draft.slug);
          },
        });
      }).catch(() => {
        renderDraftEditor(workspaceEl, draft, draftEditorCallbacks(), docs);
      });
      return;
    }

    renderDraftEditor(workspaceEl, draft, draftEditorCallbacks(), docs);
  }

  function draftEditorCallbacks() {
    return {
      onPublished: (path: string) => {
        void (async () => {
          const docsRes = await listDocs();
          docs = docsRes.docs;
          await reloadTree(sidebarEl);
          await refreshStats();
          void dashboardRefresh?.();
          showToast(`Published: ${path}`);
          const match = docs.find((d) => d.slug === draft.slug);
          if (match) {
            await selectSlug(match.slug);
          }
        })();
      },
      onClosed: () => {
        renderPageWorkspace(workspaceEl, null, workspaceOptions());
      },
      onDeleted: () => {
        void (async () => {
          await reloadTree(sidebarEl);
          renderPageWorkspace(workspaceEl, null, workspaceOptions());
        })();
      },
      onError: (message: string) => showToast(message, true),
    };
  }

  async function startEdit(slug: string): Promise<void> {
    if (viewMode !== 'workspace') {
      return;
    }
    try {
      const doc = await getDoc(slug);
      const { draft } = await openDraftForSlug(slug);
      await reloadDrafts(sidebarEl);
      openPageWorkspaceDraft(workspaceEl, doc, draft, {
        ...workspaceOptions(),
        docRelativePath: relativePathForSlug(docs, slug),
        slugByRelative: buildSlugByRelative(docs),
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Edit failed', true);
    }
  }

  async function selectSlug(
    slug: string,
    options: { updateUrl?: boolean; urlMode?: 'push' | 'replace' } = {},
  ): Promise<void> {
    const updateUrl = options.updateUrl ?? true;
    const urlMode = options.urlMode ?? 'push';

    if (viewMode === 'dashboard') {
      setViewMode('workspace');
    }

    currentSlug = slug;
    sidebarEl.setActiveSlug?.(slug);

    try {
      const doc = await getDoc(slug);
      const docRelativePath = relativePathForSlug(docs, slug);
      renderPageWorkspace(workspaceEl, doc, {
        ...workspaceOptions(),
        docRelativePath,
        slugByRelative: buildSlugByRelative(docs),
      });
      if (updateUrl) {
        writeSlugToUrl(slug, urlMode);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load doc', true);
    }
  }

  workspaceEl.addEventListener('navigate-slug', ((event: CustomEvent<{ slug: string }>) => {
    void selectSlug(event.detail.slug);
  }) as EventListener);

  try {
    await refreshStats();

    const [docsRes, { tree }, { drafts }] = await Promise.all([
      listDocs(),
      getDocsTree(),
      listDrafts(),
    ]);
    docs = docsRes.docs;
    treeOrderSlugs = collectTreeSlugs(tree);

    renderTreeSidebar(sidebarEl, tree, drafts, {
      onSelectSlug: (slug) => {
        void selectSlug(slug);
      },
      onSelectDraft: (draft) => openDraft(draft),
      onTreeChanged: () => {
        void (async () => {
          const docsResInner = await listDocs();
          docs = docsResInner.docs;
          await reloadTree(sidebarEl);
          await refreshStats();
        })();
      },
      onFsDeleted: (deletedSlugs) => {
        void (async () => {
          const docsResInner = await listDocs();
          docs = docsResInner.docs;
          if (currentSlug && deletedSlugs.includes(currentSlug)) {
            currentSlug = null;
            renderPageWorkspace(workspaceEl, null, workspaceOptions());
          }
          await reloadTree(sidebarEl);
          await refreshStats();
        })();
      },
      onError: (message) => showToast(message, true),
      onNotify: (message) => showToast(message),
    });

    subscribeDocsReload(() => {
      void (async () => {
        try {
          const docsResInner = await listDocs();
          docs = docsResInner.docs;
          await reloadTree(sidebarEl);
          await refreshStats();
          if (currentSlug && !docs.some((doc) => doc.slug === currentSlug)) {
            currentSlug = null;
            renderPageWorkspace(workspaceEl, null, workspaceOptions());
          }
        } catch {
          // ignore transient reload errors
        }
      })();
    });

    subscribePopState((slug) => {
      if (!slug) {
        currentSlug = null;
        renderPageWorkspace(workspaceEl, null, workspaceOptions());
        return;
      }
      if (docs.some((doc) => doc.slug === slug)) {
        void selectSlug(slug, { updateUrl: false });
      }
    });

    renderPageWorkspace(workspaceEl, null, workspaceOptions());

    const slugFromUrl = readSlugFromUrl();
    const draftIdFromUrl = readDraftIdFromUrl();
    if (draftIdFromUrl) {
      const draft = drafts.find((item) => item.id === draftIdFromUrl);
      if (draft) {
        openDraft(draft);
      } else {
        showToast(`Unknown draft: ${draftIdFromUrl}`, true);
      }
    } else if (slugFromUrl) {
      if (docs.some((doc) => doc.slug === slugFromUrl)) {
        await selectSlug(slugFromUrl, { updateUrl: false });
      } else {
        showToast(`Unknown page: ${slugFromUrl}`, true);
      }
    } else {
      const pathFromUrl = readPathFromUrl();
      const pathSlug = pathFromUrl
        ? docs.find((doc) => doc.relativePath === pathFromUrl)?.slug
        : undefined;
      if (pathFromUrl && pathSlug) {
        await selectSlug(pathSlug, { updateUrl: false });
      } else if (pathFromUrl) {
        showToast(`Unknown path: ${pathFromUrl}`, true);
      } else if (tree.indexPageSlug) {
        await selectSlug(tree.indexPageSlug, { urlMode: 'replace' });
      } else if (docs.length > 0 && docs[0]) {
        await selectSlug(docs[0].slug, { urlMode: 'replace' });
      }
    }
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Failed to load workspace', true);
  }
}

void main();
