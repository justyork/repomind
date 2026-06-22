export interface ListDocsItem {
  slug: string;
  type: string;
  title: string;
  status: string;
  relativePath: string;
  contentKind?: 'markdown' | 'yaml' | 'json';
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
  contentKind?: 'markdown' | 'yaml' | 'json';
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
  target_path?: string | null;
}

export interface TreePageNode {
  kind: 'page';
  name: string;
  relativePath: string;
  slug: string;
  title: string;
  status: string;
  type: string;
  contentKind: 'markdown' | 'yaml' | 'json';
}

export interface TreeFolderNode {
  kind: 'folder';
  name: string;
  relativePath: string;
  emoji: string | null;
  indexPageSlug: string | null;
  children: TreeNode[];
}

export type TreeNode = TreePageNode | TreeFolderNode;

export function getDocsTree(): Promise<{ tree: TreeFolderNode; catalogMeta: Record<string, string> }> {
  return fetchJson('/api/tree');
}

export interface BacklinkItem {
  slug: string;
  title: string;
  kind: string;
}

export function getBacklinks(slug: string): Promise<{ slug: string; backlinks: BacklinkItem[] }> {
  return fetchJson(`/api/backlinks/${encodeURIComponent(slug)}`);
}

export function getLinkHealth(): Promise<{
  orphanCount: number;
  orphanSlugs: string[];
  brokenCount: number;
  brokenTargets: string[];
  oneWayCount: number;
}> {
  return fetchJson('/api/link-health');
}

export function openDraftForSlug(slug: string): Promise<{ draft: Draft }> {
  return fetchJson('/api/drafts/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug }),
  });
}

export function createFsFolder(parentPath: string, name: string): Promise<{ result: { relativePath: string } }> {
  return fetchJson('/api/fs/folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentPath, name }),
  });
}

export function createFsPage(
  parentPath: string,
  name: string,
  title?: string,
  templateId?: string,
): Promise<{ page: { slug: string; relativePath: string }; draft: Draft }> {
  return fetchJson('/api/fs/page', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parentPath, name, title, templateId }),
  });
}

export interface FsPageMutationResult {
  relativePath: string;
  slug: string;
  previousSlug: string;
  slugChanged: boolean;
  inboundWarnings: Array<{ slug: string; title: string }>;
}

export function moveFsPage(
  fromPath: string,
  toDir: string,
): Promise<{ result: FsPageMutationResult }> {
  return fetchJson('/api/fs/move', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromPath, toDir }),
  });
}

export function renameFsPage(
  pagePath: string,
  newName: string,
): Promise<{ result: FsPageMutationResult }> {
  return fetchJson('/api/fs/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: pagePath, newName }),
  });
}

export interface FsDeletePageResult {
  relativePath: string;
  slug: string;
  inboundWarnings: Array<{ slug: string; title: string }>;
}

export interface FsDeleteFolderResult {
  relativePath: string;
  deletedSlugs: string[];
  inboundWarnings: Array<{ slug: string; title: string }>;
}

export function deleteFsNode(
  path: string,
  kind: 'page' | 'folder',
): Promise<{ result: FsDeletePageResult | FsDeleteFolderResult }> {
  return fetchJson('/api/fs/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, kind }),
  });
}

export interface PageTemplate {
  id: string;
  label: string;
  type: string;
  filename: string;
}

export function listTemplates(): Promise<{ templates: PageTemplate[] }> {
  return fetchJson('/api/templates');
}

export function setCatalogEmoji(folderPath: string, emoji: string): Promise<{ meta: Record<string, string> }> {
  return fetchJson('/api/catalog-meta', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: folderPath, emoji }),
  });
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

export interface CheckViolation {
  path: string;
  message: string;
}

export interface CheckReport {
  ok: boolean;
  violations: CheckViolation[];
  warnings: string[];
}

export function getCheckReport(): Promise<CheckReport> {
  return fetchJson('/api/check');
}

export interface DraftDiffResult {
  targetPath: string | null;
  isNew: boolean;
  diff: string;
}

export function getDraftDiff(id: string): Promise<DraftDiffResult> {
  return fetchJson(`/api/drafts/${encodeURIComponent(id)}/diff`);
}

export function exportAgentsMd(): Promise<{ ok: boolean; path: string }> {
  return fetchJson('/api/export', { method: 'POST' });
}

export interface UnpreparedFile {
  relativePath: string;
  path: string;
  suggestedType: string;
  suggestedSlug: string;
  suggestedTitle: string;
}

export function listUnprepared(): Promise<{ files: UnpreparedFile[] }> {
  return fetchJson('/api/unprepared');
}

export function prepareDoc(path: string, type?: string): Promise<{ result: { slug: string; path: string } }> {
  return fetchJson('/api/prepare', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, type }),
  });
}

export function prepareAllDocs(dryRun = false): Promise<{
  result: { prepared: Array<{ relativePath: string; slug: string; type: string }>; skipped: Array<{ relativePath: string; reason: string }> };
  dryRun: boolean;
}> {
  return fetchJson('/api/prepare-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dryRun }),
  });
}

export function syncAllLinks(options: {
  dryRun?: boolean;
  convertBody?: boolean;
  syncRelated?: boolean;
} = {}): Promise<{
  result: {
    files: Array<{
      relativePath: string;
      convertedLinks: number;
      addedRelated: string[];
      changed: boolean;
      skipped: boolean;
    }>;
  };
  dryRun: boolean;
}> {
  return fetchJson('/api/sync-links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
}
