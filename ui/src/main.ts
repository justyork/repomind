import {
  createDraft,
  getDoc,
  getGraph,
  getHealth,
  listDocs,
  listDrafts,
  searchDocs,
  type Draft,
} from './api.js';
import { renderDocPanel } from './doc-panel.js';
import { renderDraftEditor } from './editor.js';
import { createGraphView } from './graph.js';
import { renderSidebar } from './sidebar.js';

const ALL_GRAPH = '__all__';

function showError(message: string): void {
  const banner = document.querySelector<HTMLElement>('#banner');
  if (!banner) {
    return;
  }
  banner.textContent = message;
  banner.classList.remove('hidden');
  setTimeout(() => banner.classList.add('hidden'), 5000);
}

async function reloadDrafts(sidebarEl: HTMLElement): Promise<Draft[]> {
  const { drafts } = await listDrafts();
  sidebarEl.refreshDrafts?.(drafts);
  return drafts;
}

async function reloadGraph(graph: ReturnType<typeof createGraphView>): Promise<void> {
  const graphData = await getGraph(ALL_GRAPH);
  graph.load(graphData);
}

async function main(): Promise<void> {
  const sidebarEl = document.querySelector<HTMLElement>('#sidebar')!;
  const graphEl = document.querySelector<HTMLElement>('#graph')!;
  const docPanelEl = document.querySelector<HTMLElement>('#doc-panel')!;
  const statsEl = document.querySelector<HTMLElement>('#stats')!;

  const graph = createGraphView(graphEl);
  let currentSlug: string | null = null;

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

  function openDraft(draft: Draft): void {
    currentSlug = null;
    sidebarEl.setActiveDraft?.(draft.id);
    renderDraftEditor(docPanelEl, draft, {
      onPublished: (path) => {
        void (async () => {
          await reloadDrafts(sidebarEl);
          await reloadGraph(graph);
          await refreshStats();
          showError(`Published: ${path}`);
          if (draft.slug) {
            await selectSlug(draft.slug);
          }
        })();
      },
      onDeleted: () => {
        void (async () => {
          await reloadDrafts(sidebarEl);
          docPanelEl.innerHTML = '<p class="placeholder">Select a document</p>';
        })();
      },
      onError: (message) => showError(message),
    });
  }

  async function selectSlug(slug: string): Promise<void> {
    currentSlug = slug;
    sidebarEl.setActiveSlug?.(slug);
    graph.selectSlug(slug);
    try {
      const doc = await getDoc(slug);
      renderDocPanel(docPanelEl, doc, {
        onFork: (forkSlug) => {
          void createDraft({ forkFrom: forkSlug })
            .then(({ draft }) => {
              void reloadDrafts(sidebarEl).then(() => openDraft(draft));
            })
            .catch((err: unknown) => {
              showError(err instanceof Error ? err.message : 'Fork failed');
            });
        },
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load doc');
    }
  }

  graph.onSelect((slug) => {
    void selectSlug(slug);
  });

  try {
    await refreshStats();

    const { docs } = await listDocs();
    const drafts = await reloadDrafts(sidebarEl);

    renderSidebar(sidebarEl, docs, drafts, {
      onSelectSlug: (slug) => {
        void selectSlug(slug);
      },
      onSearch: (query) => {
        void searchDocs(query)
          .then(({ results }) => sidebarEl.showSearchResults?.(results))
          .catch((err) => showError(err instanceof Error ? err.message : 'Search failed'));
      },
      onSelectDraft: (draft) => openDraft(draft),
      onNewDraft: () => {
        const slug = prompt('New draft slug (lowercase, hyphens):');
        if (!slug) {
          return;
        }
        const type =
          prompt('Type (adr|feature-spec|glossary-term|open-question|agent-instruction):') ??
          'glossary-term';
        void createDraft({ slug, type })
          .then(({ draft }) => {
            void reloadDrafts(sidebarEl).then(() => openDraft(draft));
          })
          .catch((err: unknown) => {
            showError(err instanceof Error ? err.message : 'Create failed');
          });
      },
    });

    await reloadGraph(graph);

    if (docs.length > 0 && docs[0]) {
      await selectSlug(docs[0].slug);
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to load workspace');
  }
}

void main();
