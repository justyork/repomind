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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
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

export interface Draft {
  id: string;
  slug: string;
  type: string;
  status: string;
  title: string;
  body: string;
  tags: string[];
  related: string[];
  forked_from: string | null;
}

export function listDrafts(): Promise<{ drafts: Draft[] }> {
  return fetchJson('/api/drafts');
}

export function createDraft(payload: {
  slug?: string;
  type?: string;
  title?: string;
  body?: string;
  forkFrom?: string;
}): Promise<{ draft: Draft }> {
  const body = payload.forkFrom
    ? { forkFrom: payload.forkFrom }
    : { slug: payload.slug, type: payload.type, title: payload.title, body: payload.body };
  return fetchJson('/api/drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function updateDraftApi(
  id: string,
  payload: Partial<Pick<Draft, 'slug' | 'type' | 'status' | 'title' | 'body' | 'tags' | 'related'>>,
): Promise<{ draft: Draft }> {
  return fetchJson(`/api/drafts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function publishDraftApi(id: string): Promise<{ result: { path: string } }> {
  return fetchJson(`/api/drafts/${encodeURIComponent(id)}/publish`, { method: 'POST' });
}

export function deleteDraftApi(id: string): Promise<{ deleted: boolean }> {
  return fetchJson(`/api/drafts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
