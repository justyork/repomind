export interface ListDocsItem {
  slug: string;
  type: string;
  title: string;
  status: string;
}

export interface SearchResult {
  slug: string;
  title: string;
  snippet: string;
  score: number;
}

export interface GraphNode {
  slug: string;
  type: string;
  title: string;
}

export interface GraphEdge {
  from: string;
  to: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  broken_links: string[];
}

export interface DocDetail {
  found: boolean;
  slug?: string;
  path?: string;
  frontmatter?: Record<string, unknown>;
  body?: string;
  agentShape?: unknown;
}

export interface HealthResponse {
  ok: boolean;
  knowledgeRoot: string | null;
  docCount: number;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getHealth(): Promise<HealthResponse> {
  return fetchJson('/api/health');
}

export function listDocs(params: Record<string, string> = {}): Promise<{ docs: ListDocsItem[] }> {
  const qs = new URLSearchParams(params).toString();
  return fetchJson(`/api/docs${qs ? `?${qs}` : ''}`);
}

export function searchDocs(q: string, type?: string): Promise<{ results: SearchResult[] }> {
  const params = new URLSearchParams({ q });
  if (type) {
    params.set('type', type);
  }
  return fetchJson(`/api/search?${params}`);
}

export function getGraph(slug: string, depth?: number): Promise<GraphData> {
  const params = depth ? `?depth=${depth}` : '';
  return fetchJson(`/api/graph/${encodeURIComponent(slug)}${params}`);
}

export function getDoc(slug: string): Promise<DocDetail> {
  return fetchJson(`/api/docs/${encodeURIComponent(slug)}`);
}
