import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getAgentWriteGate } from '../agent-write-gate.js';
import { prepareSemantic } from '../embeddings/prepare.js';
import { DocIndex } from '../index/doc-index.js';
import { DOC_DOMAINS, DOC_STATUSES, DOC_TYPES } from '../index/types.js';
import { getPackageVersion } from '../package-version.js';
import { createDraft } from '../tools/create-draft.js';
import { exploreGraph, type GraphDirection } from '../tools/explore-graph.js';
import { MCP_GET_DOC_OPTIONS, getDoc, toMcpDoc } from '../tools/get-doc.js';
import { getGlossaryTerm } from '../tools/get-glossary-term.js';
import { listDocs } from '../tools/list-docs.js';
import { MCP_DEFAULT_SEARCH_LIMIT, searchDocs, toMcpSearchHit } from '../tools/search-docs.js';
import {
  SERVER_INSTRUCTIONS,
  buildToolDefinitions,
  isToolName,
} from './tool-definitions.js';

const DOC_URI_PREFIX = 'repomind://doc/';
const DOC_URI_TEMPLATE = `${DOC_URI_PREFIX}{slug}`;
const GRAPH_DIRECTIONS = ['out', 'in', 'both'] as const;

interface ToolFailure {
  code: string;
  message: string;
  hint?: string;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: ToolFailure };

function optionalEnum<T extends string>(
  args: Record<string, unknown>,
  key: string,
  allowed: readonly T[],
): Parsed<T | undefined> {
  const raw = args[key];
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: undefined };
  }
  if (typeof raw === 'string' && (allowed as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as T };
  }
  return {
    ok: false,
    error: {
      code: 'BAD_ARGUMENT',
      message: `invalid ${key}: ${JSON.stringify(raw)}`,
      hint: `expected one of: ${allowed.join(', ')}`,
    },
  };
}

function str(args: Record<string, unknown>, key: string): string {
  return typeof args[key] === 'string' ? (args[key] as string) : '';
}

function num(args: Record<string, unknown>, key: string): number | undefined {
  const raw = args[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}

function toolResult(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  };
}

function toolError(error: ToolFailure) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
    isError: true,
  };
}

/** Collects the first enum failure, if any, so a bad filter never silently widens a query. */
function firstFailure(...parsed: Array<Parsed<unknown>>): ToolFailure | null {
  for (const entry of parsed) {
    if (!entry.ok) {
      return entry.error;
    }
  }
  return null;
}

async function callTool(index: DocIndex, cwd: string, name: string, args: Record<string, unknown>) {
  if (!isToolName(name)) {
    return toolError({ code: 'UNKNOWN_TOOL', message: `Unknown tool: ${name}` });
  }

  if (!index.getKnowledgeRoot()) {
    index.rediscover();
  }
  if (!index.getKnowledgeRoot()) {
    return toolError({
      code: 'NO_KNOWLEDGE_ROOT',
      message: `No docs/ directory found from ${cwd} (or any parent).`,
      hint: 'Start the server inside the project, pass --cwd <dir> to "repo-mind mcp", or set REPOMIND_ROOT.',
    });
  }

  switch (name) {
    case 'list_docs': {
      const type = optionalEnum(args, 'type', DOC_TYPES);
      const status = optionalEnum(args, 'status', DOC_STATUSES);
      const domain = optionalEnum(args, 'domain', DOC_DOMAINS);
      const failure = firstFailure(type, status, domain);
      if (failure) return toolError(failure);
      return toolResult(
        listDocs(index, {
          type: type.ok ? type.value : undefined,
          status: status.ok ? status.value : undefined,
          domain: domain.ok ? domain.value : undefined,
          tag: typeof args.tag === 'string' ? args.tag : undefined,
        }),
      );
    }
    case 'search_docs': {
      const type = optionalEnum(args, 'type', DOC_TYPES);
      const status = optionalEnum(args, 'status', DOC_STATUSES);
      const domain = optionalEnum(args, 'domain', DOC_DOMAINS);
      const failure = firstFailure(type, status, domain);
      if (failure) return toolError(failure);
      try {
        // Embeds the query so the sync search below can blend in semantic hits.
        await index.semantic?.prepare(str(args, 'query'));
      } catch (error) {
        console.error(`repo-mind: semantic search skipped (${error instanceof Error ? error.message : String(error)})`);
      }
      return toolResult(
        searchDocs(index, {
          query: str(args, 'query'),
          type: type.ok ? type.value : undefined,
          status: status.ok ? status.value : undefined,
          domain: domain.ok ? domain.value : undefined,
          limit: num(args, 'limit') ?? MCP_DEFAULT_SEARCH_LIMIT,
          includeTop: args.include_top === true,
        }).map(toMcpSearchHit),
      );
    }
    case 'get_doc':
      return toolResult(
        toMcpDoc(
          getDoc(index, str(args, 'slug'), {
            ...MCP_GET_DOC_OPTIONS,
            ...(args.full === true ? { autoTruncateAbove: undefined } : {}),
            section: typeof args.section === 'string' && args.section ? args.section : undefined,
            maxChars: num(args, 'max_chars'),
          }),
        ),
      );
    case 'get_glossary_term':
      return toolResult(getGlossaryTerm(index, str(args, 'name')));
    case 'explore_graph': {
      const direction = optionalEnum<GraphDirection>(args, 'direction', GRAPH_DIRECTIONS);
      if (!direction.ok) return toolError(direction.error);
      return toolResult(
        exploreGraph(index, {
          slug: str(args, 'slug'),
          depth: num(args, 'depth'),
          direction: direction.value,
        }),
      );
    }
    case 'create_draft': {
      const result = createDraft(index, {
        type: str(args, 'type'),
        title: str(args, 'title'),
        body: str(args, 'body'),
        slug: typeof args.slug === 'string' ? args.slug : undefined,
        related: Array.isArray(args.related) ? (args.related as string[]) : undefined,
        tags: Array.isArray(args.tags) ? (args.tags as string[]) : undefined,
        forked_from: typeof args.forked_from === 'string' ? args.forked_from : undefined,
      });
      return result.ok ? toolResult(result.data) : toolError(result.error);
    }
    default: {
      const unknownTool: never = name;
      return toolError({ code: 'UNKNOWN_TOOL', message: `Unknown tool: ${unknownTool}` });
    }
  }
}

/** Builds the MCP server without connecting a transport (testable in-memory). */
export function createMcpServer(index: DocIndex, cwd: string = process.cwd()): Server {
  const server = new Server(
    { name: 'repo-mind', version: getPackageVersion() },
    { capabilities: { tools: {}, resources: {} }, instructions: SERVER_INSTRUCTIONS },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: buildToolDefinitions({ writeEnabled: getAgentWriteGate(cwd).enabled }),
  }));

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [
      {
        uriTemplate: DOC_URI_TEMPLATE,
        name: 'doc',
        description: 'A knowledge base page by slug (markdown body).',
        mimeType: 'text/markdown',
      },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    const slug = uri.startsWith(DOC_URI_PREFIX) ? decodeURIComponent(uri.slice(DOC_URI_PREFIX.length)) : '';
    if (!index.getKnowledgeRoot()) {
      index.rediscover();
    }
    const doc = getDoc(index, slug);
    if (!doc.found || doc.body === undefined) {
      throw new Error(`Resource not found: ${uri}`);
    }
    return { contents: [{ uri, mimeType: 'text/markdown', text: doc.body }] };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    callTool(index, cwd, request.params.name, (request.params.arguments ?? {}) as Record<string, unknown>),
  );

  return server;
}

export interface McpServerOptions {
  /** Project directory; defaults to REPOMIND_ROOT, then process.cwd(). */
  cwd?: string;
}

export async function startMcpServer(options: McpServerOptions = {}): Promise<void> {
  const cwd = options.cwd ?? process.env.REPOMIND_ROOT ?? process.cwd();
  const index = new DocIndex(cwd);
  const server = createMcpServer(index, cwd);

  let acceptingCalls = true;
  const shutdown = async () => {
    if (!acceptingCalls) return;
    acceptingCalls = false;
    await server.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    void shutdown();
  });
  process.on('SIGINT', () => {
    void shutdown();
  });
  process.stdin.on('close', () => {
    void shutdown();
  });

  await server.connect(new StdioServerTransport());

  // Build the vector index in the background; until it is ready, search stays lexical.
  void prepareSemantic(index, {
    attach: true,
    log: (message) => console.error(`repo-mind: ${message}`),
  }).catch((error: unknown) => {
    console.error(`repo-mind: semantic indexing failed (${error instanceof Error ? error.message : String(error)})`);
  });
}
