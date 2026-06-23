import { getGraph, getHealth, listDrafts } from './api.js';
import { createGraphView } from './graph.js';
import { bindThemeToggle, initTheme } from './theme.js';

initTheme();

const ALL_GRAPH = '__all__';

function readSlugParam(): string | null {
  const slug = new URLSearchParams(window.location.search).get('slug');
  return slug?.trim() ? slug : null;
}

async function main(): Promise<void> {
  bindThemeToggle(document.querySelector<HTMLButtonElement>('#theme-toggle'));

  const graphEl = document.querySelector<HTMLElement>('#graph')!;
  const statsEl = document.querySelector<HTMLElement>('#stats')!;
  const graph = createGraphView(graphEl);

  try {
    const [health, { drafts }, graphData] = await Promise.all([
      getHealth(),
      listDrafts(),
      getGraph(ALL_GRAPH),
    ]);

    statsEl.textContent = `v${health.version} · ${health.docCount} docs · ${graphData.nodes.length} nodes · ${drafts.length} drafts`;

    graph.load(graphData);

    const initialSlug = readSlugParam();
    if (initialSlug) {
      graph.selectSlug(initialSlug);
    }

    graph.onSelect((slug) => {
      window.location.href = `/?slug=${encodeURIComponent(slug)}`;
    });

    requestAnimationFrame(() => {
      graph.resize();
    });
  } catch (err) {
    statsEl.textContent = err instanceof Error ? err.message : 'Failed to load graph';
  }
}

void main();
