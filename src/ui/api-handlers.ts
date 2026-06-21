import type { IncomingMessage } from 'node:http';
import { URL } from 'node:url';
import type { DocIndex } from '../index/doc-index.js';
import { isValidSlug } from '../index/slug.js';
import { isDocStatus, isDocType } from '../index/types.js';
import { exploreGraph } from '../tools/explore-graph.js';
import { getDoc } from '../tools/get-doc.js';
import { getGlossaryTerm } from '../tools/get-glossary-term.js';
import { listDocs } from '../tools/list-docs.js';
import { searchDocs } from '../tools/search-docs.js';
import { ALL_GRAPH_SLUG, exploreGraphAll } from './graph-all.js';
import { computeKnowledgeStats } from './stats.js';

export interface ApiResponse {
  status: number;
  body: unknown;
}

function jsonError(status: number, message: string): ApiResponse {
  return { status, body: { error: message } };
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
  if (pathname === '/api/health') {
    const docs = index.refresh();
    return {
      status: 200,
      body: {
        ok: true,
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
