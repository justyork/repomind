import * as d3 from 'd3';
import type { GraphData, GraphNode } from './api.js';

const TYPE_COLORS: Record<string, string> = {
  adr: '#c97b4a',
  'feature-spec': '#6abf69',
  'glossary-term': '#b07cc6',
  'open-question': '#e0c04a',
  'agent-instruction': '#5b9fd4',
};

export interface GraphView {
  load(data: GraphData): void;
  selectSlug(slug: string | null): void;
  focusSlug(slug: string): void;
  onSelect(callback: (slug: string) => void): void;
  resize(): void;
  destroy(): void;
}

export function createGraphView(container: HTMLElement): GraphView {
  container.innerHTML = '';
  const emptyEl = document.createElement('div');
  emptyEl.className = 'graph-empty hidden';
  emptyEl.textContent = 'No documents in graph';
  container.appendChild(emptyEl);

  const width = () => container.clientWidth || 800;
  const height = () => container.clientHeight || 600;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('width', width())
    .attr('height', height());

  const g = svg.append('g');
  const linkLayer = g.append('g');
  const nodeLayer = g.append('g');

  const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 4]).on('zoom', (event) => {
    g.attr('transform', event.transform);
  });
  svg.call(zoom);

  let simulation: d3.Simulation<GraphNode & d3.SimulationNodeDatum, undefined> | null = null;
  let selectCallback: ((slug: string) => void) | null = null;
  let selectedSlug: string | null = null;
  let loadedNodes: (GraphNode & d3.SimulationNodeDatum)[] = [];

  function degreeMap(data: GraphData): Map<string, number> {
    const degrees = new Map<string, number>();
    for (const node of data.nodes) {
      degrees.set(node.slug, 0);
    }
    for (const edge of data.edges) {
      degrees.set(edge.from, (degrees.get(edge.from) ?? 0) + 1);
      degrees.set(edge.to, (degrees.get(edge.to) ?? 0) + 1);
    }
    return degrees;
  }

  function resize(): void {
    svg.attr('width', width()).attr('height', height());
    if (simulation) {
      simulation.force('center', d3.forceCenter(width() / 2, height() / 2));
      simulation.alpha(0.3).restart();
    }
  }

  window.addEventListener('resize', resize);

  return {
    load(data: GraphData): void {
      if (data.nodes.length === 0) {
        emptyEl.classList.remove('hidden');
        svg.style('display', 'none');
        simulation?.stop();
        return;
      }

      emptyEl.classList.add('hidden');
      svg.style('display', 'block');
      simulation?.stop();

      const degrees = degreeMap(data);
      const nodes = data.nodes.map((n) => ({ ...n }));
      loadedNodes = nodes;
      const links = data.edges.map((e) => ({ source: e.from, target: e.to }));

      simulation = d3
        .forceSimulation(nodes)
        .force(
          'link',
          d3
            .forceLink(links)
            .id((d) => (d as GraphNode).slug)
            .distance(80),
        )
        .force('charge', d3.forceManyBody().strength(-180))
        .force('center', d3.forceCenter(width() / 2, height() / 2))
        .force('collision', d3.forceCollide().radius(24));

      const link = linkLayer
        .selectAll<SVGLineElement, { source: string; target: string }>('line')
        .data(links, (d) => `${String(d.source)}-${String(d.target)}`)
        .join('line')
        .attr('class', 'link');

      const node = nodeLayer
        .selectAll<SVGGElement, GraphNode>('g')
        .data(nodes, (d) => d.slug)
        .join('g')
        .attr('class', (d) => (d.slug === selectedSlug ? 'node selected' : 'node'))
        .call(
          d3
            .drag<SVGGElement, GraphNode>()
            .on('start', (event, d) => {
              if (!event.active && simulation) {
                simulation.alphaTarget(0.3).restart();
              }
              const simNode = d as GraphNode & d3.SimulationNodeDatum;
              simNode.fx = simNode.x;
              simNode.fy = simNode.y;
            })
            .on('drag', (event, d) => {
              const simNode = d as GraphNode & d3.SimulationNodeDatum;
              simNode.fx = event.x;
              simNode.fy = event.y;
            })
            .on('end', (event, d) => {
              if (!event.active && simulation) {
                simulation.alphaTarget(0);
              }
              const simNode = d as GraphNode & d3.SimulationNodeDatum;
              simNode.fx = null;
              simNode.fy = null;
            }),
        )
        .on('click', (_event, d) => {
          selectedSlug = d.slug;
          node.attr('class', (n) => (n.slug === selectedSlug ? 'node selected' : 'node'));
          selectCallback?.(d.slug);
        });

      node.selectAll('circle').remove();
      node.selectAll('text').remove();

      node
        .append('circle')
        .attr('r', (d) => 8 + Math.min((degrees.get(d.slug) ?? 0) * 2, 16))
        .attr('fill', (d) => TYPE_COLORS[d.type] ?? '#888');

      node.append('title').text((d) => `${d.slug}\n${d.title}`);

      node
        .append('text')
        .attr('dy', 4)
        .attr('text-anchor', 'middle')
        .text((d) => d.slug);

      simulation.on('tick', () => {
        link
          .attr('x1', (d) => (d.source as GraphNode & d3.SimulationNodeDatum).x ?? 0)
          .attr('y1', (d) => (d.source as GraphNode & d3.SimulationNodeDatum).y ?? 0)
          .attr('x2', (d) => (d.target as GraphNode & d3.SimulationNodeDatum).x ?? 0)
          .attr('y2', (d) => (d.target as GraphNode & d3.SimulationNodeDatum).y ?? 0);

        node.attr(
          'transform',
          (d) =>
            `translate(${(d as GraphNode & d3.SimulationNodeDatum).x ?? 0},${(d as GraphNode & d3.SimulationNodeDatum).y ?? 0})`,
        );
      });
    },

    selectSlug(slug: string | null): void {
      selectedSlug = slug;
      nodeLayer.selectAll<SVGGElement, GraphNode>('g.node').attr('class', (d) =>
        d.slug === selectedSlug ? 'node selected' : 'node',
      );
    },

    focusSlug(slug: string): void {
      selectedSlug = slug;
      nodeLayer.selectAll<SVGGElement, GraphNode>('g.node').attr('class', (d) =>
        d.slug === selectedSlug ? 'node selected' : 'node',
      );

      const target = loadedNodes.find((n) => n.slug === slug);
      if (!target || target.x === undefined || target.y === undefined) {
        return;
      }

      const w = width();
      const h = height();
      const scale = 1.4;
      const transform = d3.zoomIdentity
        .translate(w / 2, h / 2)
        .scale(scale)
        .translate(-target.x, -target.y);

      svg.transition().duration(400).call(zoom.transform, transform);
    },

    onSelect(callback: (slug: string) => void): void {
      selectCallback = callback;
    },

    resize(): void {
      resize();
    },

    destroy(): void {
      simulation?.stop();
      window.removeEventListener('resize', resize);
      svg.remove();
      emptyEl.remove();
    },
  };
}
