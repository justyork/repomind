import {
  createDraft,
  getDoc,
  getHealth,
  listDocs,
  listDrafts,
  searchDocs,
  type Draft,
  type ListDocsItem,
  type SearchResult,
} from './api.js';
import { catalogLabel } from './catalog.js';
import { renderDashboard } from './dashboard.js';
import { renderDocPanel } from './doc-panel.js';
import { renderDraftEditor } from './editor.js';
import { showNewDraftModal } from './new-draft-modal.js';
import { renderSidebar } from './sidebar.js';
import { bindThemeToggle, initTheme } from './theme.js';

initTheme();

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

function readSlugParam(): string | null {
  const slug = new URLSearchParams(window.location.search).get('slug');
  return slug?.trim() ? slug : null;
}

async function reloadDrafts(sidebarEl: HTMLElement): Promise<Draft[]> {
  const { drafts } = await listDrafts();
  sidebarEl.refreshDrafts?.(drafts);
  return drafts;
}

async function main(): Promise<void> {
  bindThemeToggle(document.querySelector<HTMLButtonElement>('#theme-toggle'));

  const sidebarEl = document.querySelector<HTMLElement>('#sidebar')!;
  const workspaceEl = document.querySelector<HTMLElement>('#workspace')!;
  const healthToggle = document.querySelector<HTMLButtonElement>('#health-toggle')!;
  const statsEl = document.querySelector<HTMLElement>('#stats')!;
  const searchInput = document.querySelector<HTMLInputElement>('#global-search')!;
  const searchDropdown = document.querySelector<HTMLElement>('#search-dropdown')!;

  let docs: ListDocsItem[] = [];
  let viewMode: 'workspace' | 'dashboard' = 'workspace';
  let dashboardRefresh: (() => Promise<void>) | null = null;
  let searchTimer: ReturnType<typeof setTimeout> | null = null;

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
            await reloadDrafts(sidebarEl);
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
    renderDocPanel(workspaceEl, null);
  }

  healthToggle.addEventListener('click', () => {
    setViewMode(viewMode === 'dashboard' ? 'workspace' : 'dashboard');
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
    statsEl.textContent = `${health.docCount} pages · ${drafts.length} drafts${broken}`;
  }

  const knownSlugs = (): string[] => docs.map((d) => d.slug);

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
    renderDraftEditor(workspaceEl, draft, {
      onPublished: (path) => {
        void (async () => {
          await reloadDrafts(sidebarEl);
          await refreshStats();
          void dashboardRefresh?.();
          showToast(`Published: ${path}`);
          await selectSlug(draft.slug);
        })();
      },
      onDeleted: () => {
        void (async () => {
          await reloadDrafts(sidebarEl);
          renderDocPanel(workspaceEl, null);
        })();
      },
      onError: (message) => showToast(message, true),
    }, knownSlugs());
  }

  async function selectSlug(slug: string): Promise<void> {
    if (viewMode === 'dashboard') {
      setViewMode('workspace');
    }

    sidebarEl.setActiveSlug?.(slug);

    try {
      const doc = await getDoc(slug);
      renderDocPanel(workspaceEl, doc, {
        onFork: (forkSlug) => {
          void createDraft({ forkFrom: forkSlug })
            .then(({ draft }) => {
              void reloadDrafts(sidebarEl).then(() => openDraft(draft));
            })
            .catch((err: unknown) => {
              showToast(err instanceof Error ? err.message : 'Fork failed', true);
            });
        },
        onNavigateCatalog: (type) => {
          sidebarEl.querySelector<HTMLButtonElement>(`[data-catalog="${type}"]`)?.click();
        },
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load doc', true);
    }
  }

  workspaceEl.addEventListener('navigate-slug', ((event: CustomEvent<{ slug: string }>) => {
    void selectSlug(event.detail.slug);
  }) as EventListener);

  try {
    await refreshStats();

    const docsRes = await listDocs();
    docs = docsRes.docs;
    const drafts = await reloadDrafts(sidebarEl);

    renderSidebar(sidebarEl, docs, drafts, {
      onSelectSlug: (slug) => {
        void selectSlug(slug);
      },
      onSelectDraft: (draft) => openDraft(draft),
      onNewDraft: () => {
        void showNewDraftModal(knownSlugs()).then((values) => {
          if (!values) {
            return;
          }
          void createDraft({ slug: values.slug, type: values.type })
            .then(({ draft }) => {
              void reloadDrafts(sidebarEl).then(() => openDraft(draft));
            })
            .catch((err: unknown) => {
              showToast(err instanceof Error ? err.message : 'Create failed', true);
            });
        });
      },
    });

    renderDocPanel(workspaceEl, null);

    const slugFromUrl = readSlugParam();
    if (slugFromUrl && docs.some((d) => d.slug === slugFromUrl)) {
      await selectSlug(slugFromUrl);
    } else if (docs.length > 0 && docs[0]) {
      await selectSlug(docs[0].slug);
    }
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Failed to load workspace', true);
  }
}

void main();
