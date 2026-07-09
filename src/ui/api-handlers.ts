import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { collectCheckReport } from '../check/collect-violations.js';
import { getPackageVersion } from '../package-version.js';
import type { DocIndex } from '../index/doc-index.js';
import {
  computeLinkHealth,
  getBacklinksForSlug,
} from '../index/link-index.js';
import { isValidSlug } from '../index/slug.js';
import { isDocStatus, isDocType } from '../index/types.js';
import { listUnpreparedFiles, prepareDocFile } from '../prepare/prepare-docs.js';
import { buildLinkIndexForDocs, exploreGraph } from '../tools/explore-graph.js';
import { getDoc } from '../tools/get-doc.js';
import { getGlossaryTerm } from '../tools/get-glossary-term.js';
import { listDocs } from '../tools/list-docs.js';
import { searchDocs } from '../tools/search-docs.js';
import type { DocsWatcher } from './docs-watcher.js';
import { ALL_GRAPH_SLUG, exploreGraphAll } from './graph-all.js';
import { buildDocsTree } from './fs-tree.js';
import { readCatalogMeta } from './catalog-meta.js';
import { computeKnowledgeStats } from './stats.js';
import { listPageTemplates } from './templates.js';
import { askDocs } from '../ask/ask.js';
import { getAskServerConfig } from '../ask/config.js';
import type { AskChatTurn, LlmProvider } from '../ask/types.js';

export interface ApiResponse {
  status: number;
  body: unknown;
}

function jsonError(status: number, message: string): ApiResponse {
  return { status, body: { error: message } };
}

function parseJsonBody(raw: string): Record<string, unknown> | null {
  if (!raw.trim()) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isLlmProvider(value: string): value is LlmProvider {
  return value === 'openai' || value === 'anthropic';
}

export async function handleAskApi(
  index: DocIndex,
  method: string,
  pathname: string,
  bodyRaw: string,
): Promise<ApiResponse | null> {
  if (pathname !== '/api/ask' || method !== 'POST') {
    return null;
  }

  const body = parseJsonBody(bodyRaw);
  if (!body) {
    return jsonError(400, 'invalid JSON body');
  }

  const question = typeof body.question === 'string' ? body.question : '';
  const providerRaw = typeof body.provider === 'string' ? body.provider : undefined;
  if (providerRaw && !isLlmProvider(providerRaw)) {
    return jsonError(400, 'invalid provider — use openai or anthropic');
  }
  const provider = providerRaw && isLlmProvider(providerRaw) ? providerRaw : undefined;

  const model = typeof body.model === 'string' ? body.model : undefined;
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey : undefined;
  const history = parseAskHistory(body.history);

  try {
    const result = await askDocs(index, {
      question,
      provider,
      model,
      apiKey,
      history,
    });
    return { status: 200, body: result };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'ask failed';
    if (message.includes('API key is required')) {
      return jsonError(400, message);
    }
    if (message.includes('question is required')) {
      return jsonError(400, message);
    }
    return jsonError(502, message);
  }
}

function parseAskHistory(value: unknown): AskChatTurn[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const turns = value
    .map((item) => {
      if (typeof item !== 'object' || item === null) {
        return null;
      }
      const role = (item as { role?: unknown }).role;
      const content = (item as { content?: unknown }).content;
      if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
        return null;
      }
      const trimmed = content.trim();
      if (!trimmed) {
        return null;
      }
      return { role, content: trimmed };
    })
    .filter((item): item is AskChatTurn => item !== null);

  return turns.length > 0 ? turns : undefined;
}

function parseRequestUrl(req: IncomingMessage, baseUrl: string): URL {
  const host = req.headers.host ?? '127.0.0.1';
  return new URL(req.url ?? '/', `http://${host}${baseUrl}`);
}

export function handleApiRequest(
  index: DocIndex,
  req: IncomingMessage,
  pathname: string,
  searchParams: URLSearchParams,
): ApiResponse {
  if (pathname === '/api/ask/config') {
    return { status: 200, body: getAskServerConfig() };
  }

  if (pathname === '/api/health') {
    const docs = index.refresh();
    return {
      status: 200,
      body: {
        ok: true,
        version: getPackageVersion(),
        knowledgeRoot: index.getKnowledgeRoot(),
        docCount: docs.length,
      },
    };
  }

  if (pathname === '/api/docs') {
    const typeParam = searchParams.get('type');
    const statusParam = searchParams.get('status');
    const tag = searchParams.get('tag') ?? undefined;

    if (typeParam && !isDocType(typeParam)) {
      return jsonError(400, `invalid type: ${typeParam}`);
    }
    if (statusParam && !isDocStatus(statusParam)) {
      return jsonError(400, `invalid status: ${statusParam}`);
    }

    return {
      status: 200,
      body: {
        docs: listDocs(index, {
          type: typeParam && isDocType(typeParam) ? typeParam : undefined,
          status: statusParam && isDocStatus(statusParam) ? statusParam : undefined,
          tag,
        }),
      },
    };
  }

  if (pathname === '/api/search') {
    const query = searchParams.get('q') ?? '';
    if (!query.trim()) {
      return jsonError(400, 'query parameter q is required');
    }
    const typeParam = searchParams.get('type');
    if (typeParam && !isDocType(typeParam)) {
      return jsonError(400, `invalid type: ${typeParam}`);
    }

    return {
      status: 200,
      body: {
        results: searchDocs(index, {
          query,
          type: typeParam && isDocType(typeParam) ? typeParam : undefined,
        }),
      },
    };
  }

  if (pathname === '/api/stats') {
    return { status: 200, body: computeKnowledgeStats(index) };
  }

  if (pathname === '/api/check') {
    const report = collectCheckReport(index);
    if (!report) {
      return jsonError(404, 'no docs/ directory found');
    }
    return { status: 200, body: report };
  }

  if (pathname === '/api/tree') {
    const tree = buildDocsTree(index);
    if (!tree) {
      return jsonError(404, 'no docs/ directory found');
    }
    return { status: 200, body: { tree, catalogMeta: readCatalogMeta(index.getKnowledgeRoot()!) } };
  }

  if (pathname === '/api/templates') {
    return { status: 200, body: { templates: listPageTemplates() } };
  }

  if (pathname === '/api/link-health') {
    const docs = index.refresh();
    const snapshot = buildLinkIndexForDocs(index);
    const health = computeLinkHealth(snapshot, docs);
    return {
      status: 200,
      body: {
        orphanCount: health.orphanSlugs.length,
        orphanSlugs: health.orphanSlugs,
        brokenCount: health.brokenTargets.length,
        brokenTargets: health.brokenTargets,
        oneWayCount: health.oneWayCount,
      },
    };
  }

  const backlinksMatch = pathname.match(/^\/api\/backlinks\/([^/]+)$/);
  if (backlinksMatch) {
    const slug = decodeURIComponent(backlinksMatch[1] ?? '');
    if (!isValidSlug(slug)) {
      return jsonError(400, `invalid slug: ${slug}`);
    }
    const docs = index.refresh();
    const docsBySlug = new Map(docs.map((doc) => [doc.slug, doc]));
    if (!docsBySlug.has(slug)) {
      return jsonError(404, `unknown slug: ${slug}`);
    }
    const snapshot = buildLinkIndexForDocs(index);
    return {
      status: 200,
      body: {
        slug,
        backlinks: getBacklinksForSlug(snapshot, slug, docsBySlug),
      },
    };
  }

  if (pathname === '/api/unprepared') {
    return { status: 200, body: { files: listUnpreparedFiles(index) } };
  }

  const graphMatch = pathname.match(/^\/api\/graph\/([^/]+)$/);
  if (graphMatch) {
    const slug = decodeURIComponent(graphMatch[1] ?? '');
    if (slug === ALL_GRAPH_SLUG) {
      return { status: 200, body: exploreGraphAll(index) };
    }
    if (!isValidSlug(slug)) {
      return jsonError(400, `invalid slug: ${slug}`);
    }
    const depthParam = searchParams.get('depth');
    const depth = depthParam ? Number.parseInt(depthParam, 10) : undefined;
    return {
      status: 200,
      body: exploreGraph(index, { slug, depth }),
    };
  }

  const docMatch = pathname.match(/^\/api\/docs\/([^/]+)$/);
  if (docMatch) {
    const slug = decodeURIComponent(docMatch[1] ?? '');
    if (!isValidSlug(slug)) {
      return jsonError(400, `invalid slug: ${slug}`);
    }

    const doc = index.getDocBySlug(slug);
    if (!doc) {
      return { status: 404, body: { found: false } };
    }

    const agentShape =
      doc.type === 'glossary-term'
        ? getGlossaryTerm(index, slug)
        : getDoc(index, slug);

    return {
      status: 200,
      body: {
        found: true,
        slug: doc.slug,
        path: doc.path,
        contentKind: doc.contentKind,
        frontmatter: doc.frontmatter,
        body: doc.body,
        agentShape,
      },
    };
  }

  return jsonError(404, 'not found');
}

export function routeApi(index: DocIndex, req: IncomingMessage): ApiResponse | null {
  const url = parseRequestUrl(req, '');
  if (!url.pathname.startsWith('/api/')) {
    return null;
  }
  return handleApiRequest(index, req, url.pathname, url.searchParams);
}

const docsEventClients = new Set<ServerResponse>();

/** Closes live SSE streams so `server.close()` can finish during shutdown. */
export function closeAllDocsEventStreams(): void {
  for (const res of docsEventClients) {
    if (!res.writableEnded) {
      res.end();
    }
  }
  docsEventClients.clear();
}

export function handleDocsEvents(
  req: IncomingMessage,
  res: ServerResponse,
  docsWatcher: DocsWatcher | undefined,
): void {
  if ((req.method ?? 'GET') !== 'GET') {
    res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'method not allowed' }));
    return;
  }

  if (!docsWatcher) {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'docs watcher unavailable' }));
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const sendRevision = (revision: number): void => {
    res.write(`data: ${JSON.stringify({ revision })}\n\n`);
  };

  sendRevision(docsWatcher.getRevision());
  const unsubscribe = docsWatcher.subscribe(sendRevision);
  docsEventClients.add(res);
  req.on('close', () => {
    unsubscribe();
    docsEventClients.delete(res);
  });
}
