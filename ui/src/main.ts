import { getDoc, getGraph, getHealth, listDocs, searchDocs } from './api.js';
import { renderDocPanel } from './doc-panel.js';
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

async function main(): Promise<void> {
  const sidebarEl = document.querySelector<HTMLElement>('#sidebar')!;
  const graphEl = document.querySelector<HTMLElement>('#graph')!;
  const docPanelEl = document.querySelector<HTMLElement>('#doc-panel')!;
  const statsEl = document.querySelector<HTMLElement>('#stats')!;

  const graph = createGraphView(graphEl);
  let currentSlug: string | null = null;

  async function selectSlug(slug: string): Promise<void> {
    currentSlug = slug;
    sidebarEl.setActiveSlug?.(slug);
    graph.selectSlug(slug);
    try {
      const doc = await getDoc(slug);
      renderDocPanel(docPanelEl, doc);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load doc');
    }
  }

  graph.onSelect((slug) => {
    void selectSlug(slug);
  });

  try {
    const health = await getHealth();
    const statsRes = await fetch('/api/stats');
    const stats = (await statsRes.json()) as {
      totalDocs: number;
      brokenRelatedCount: number;
    };
    const broken =
      stats.brokenRelatedCount > 0 ? ` · ${stats.brokenRelatedCount} broken links` : '';
    statsEl.textContent = `${health.docCount} docs${broken}`;

    const { docs } = await listDocs();
    renderSidebar(sidebarEl, docs, {
      onSelectSlug: (slug) => {
        void selectSlug(slug);
      },
      onSearch: (query) => {
        void searchDocs(query)
          .then(({ results }) => sidebarEl.showSearchResults?.(results))
          .catch((err) => showError(err instanceof Error ? err.message : 'Search failed'));
      },
    });

    const graphData = await getGraph(ALL_GRAPH);
    graph.load(graphData);

    if (docs.length > 0 && docs[0]) {
      await selectSlug(docs[0].slug);
    }
  } catch (err) {
    showError(err instanceof Error ? err.message : 'Failed to load workspace');
  }
}

void main();
