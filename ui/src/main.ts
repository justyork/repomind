import {
  createDraft,
  getDoc,
  getGraph,
  getHealth,
  listDocs,
  listDrafts,
  searchDocs,
  type Draft,
  type ListDocsItem,
} from './api.js';
import { renderDashboard } from './dashboard.js';
import { renderDocPanel } from './doc-panel.js';
import { renderDraftEditor } from './editor.js';
import { createGraphView } from './graph.js';
import { showNewDraftModal } from './new-draft-modal.js';
import { renderSidebar } from './sidebar.js';

const ALL_GRAPH = '__all__';

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
  const sidebarEl = document.querySelector<HTMLElement>('#sidebar')!;
  const workspaceEl = document.querySelector<HTMLElement>('#workspace')!;
  const graphEl = document.querySelector<HTMLElement>('#graph')!;
  const graphDrawer = document.querySelector<HTMLElement>('#graph-drawer')!;
  const graphToggle = document.querySelector<HTMLButtonElement>('#graph-toggle')!;
  const healthToggle = document.querySelector<HTMLButtonElement>('#health-toggle')!;
  const statsEl = document.querySelector<HTMLElement>('#stats')!;

  const graph = createGraphView(graphEl);
  let graphLoaded = false;
  let docs: ListDocsItem[] = [];
  let viewMode: 'workspace' | 'dashboard' = 'workspace';
  let dashboardRefresh: (() => Promise<void>) | null = null;

  async function ensureGraph(): Promise<void> {
    if (graphLoaded) {
      graph.resize();
      return;
    }
    const graphData = await getGraph(ALL_GRAPH);
    graph.load(graphData);
    graphLoaded = true;
  }

  async function revealGraphForSlug(slug: string): Promise<void> {
    if (!graphDrawer.classList.contains('open')) {
      graphDrawer.classList.add('open');
      graphToggle.setAttribute('aria-expanded', 'true');
      graphDrawer.setAttribute('aria-hidden', 'false');
    }
    await ensureGraph();
    graph.selectSlug(slug);
    graph.focusSlug(slug);
  }

  graphToggle.addEventListener('click', () => {
    const open = graphDrawer.classList.toggle('open');
    graphToggle.setAttribute('aria-expanded', String(open));
    graphDrawer.setAttribute('aria-hidden', String(!open));
    if (open) {
      void ensureGraph().then(() => graph.resize());
    }
  });

  function setViewMode(mode: 'workspace' | 'dashboard'): void {
    viewMode = mode;
    healthToggle.setAttribute('aria-pressed', String(mode === 'dashboard'));
    graphToggle.disabled = mode === 'dashboard';

    if (mode === 'dashboard') {
      const dash = renderDashboard(workspaceEl, {
        onOpenDraft: (draft) => {
          setViewMode('workspace');
          openDraft(draft);
        },
        onPublished: (path) => {
          void (async () => {
            await reloadDrafts(sidebarEl);
            graphLoaded = false;
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
    statsEl.textContent = `${health.docCount} docs · ${drafts.length} drafts${broken}`;
  }

  const knownSlugs = (): string[] => docs.map((d) => d.slug);

  function openDraft(draft: Draft): void {
    setViewMode('workspace');
    sidebarEl.setActiveDraft?.(draft.id);
    renderDraftEditor(workspaceEl, draft, {
      onPublished: (path) => {
        void (async () => {
          await reloadDrafts(sidebarEl);
          graphLoaded = false;
          await refreshStats();
          void dashboardRefresh?.();
          showToast(`Published: ${path}`);
          await selectSlug(draft.slug, { syncGraph: true });
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

  async function selectSlug(
    slug: string,
    options: { syncGraph?: boolean } = {},
  ): Promise<void> {
    if (viewMode === 'dashboard') {
      setViewMode('workspace');
    }

    sidebarEl.setActiveSlug?.(slug);
    graph.selectSlug(slug);
    if (options.syncGraph) {
      await revealGraphForSlug(slug);
    }

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
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load doc', true);
    }
  }

  workspaceEl.addEventListener('navigate-slug', ((event: CustomEvent<{ slug: string }>) => {
    void selectSlug(event.detail.slug, { syncGraph: true });
  }) as EventListener);

  graph.onSelect((slug) => {
    void selectSlug(slug);
  });

  try {
    await refreshStats();

    const docsRes = await listDocs();
    docs = docsRes.docs;
    const drafts = await reloadDrafts(sidebarEl);

    renderSidebar(sidebarEl, docs, drafts, {
      onSelectSlug: (slug) => {
        void selectSlug(slug, { syncGraph: true });
      },
      onSearch: (query) => {
        void searchDocs(query)
          .then(({ results }) => sidebarEl.showSearchResults?.(results))
          .catch((err) => showToast(err instanceof Error ? err.message : 'Search failed', true));
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

    if (docs.length > 0 && docs[0]) {
      await selectSlug(docs[0].slug);
    }
  } catch (err) {
    showToast(err instanceof Error ? err.message : 'Failed to load workspace', true);
  }
}

void main();
