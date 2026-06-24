import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { getPackageVersion } from '../package-version.js';
import { DocIndex } from '../index/doc-index.js';
import { DOC_TYPES, DOC_STATUSES, DOC_DOMAINS } from '../index/types.js';
import { exploreGraph } from '../tools/explore-graph.js';
import { createDraft } from '../tools/create-draft.js';
import { getDoc } from '../tools/get-doc.js';
import { getGlossaryTerm } from '../tools/get-glossary-term.js';
import { listDocs } from '../tools/list-docs.js';
import { searchDocs } from '../tools/search-docs.js';

const TOOL_NAMES = [
  'list_docs',
  'search_docs',
  'get_doc',
  'get_glossary_term',
  'explore_graph',
  'create_draft',
] as const;

type ToolName = (typeof TOOL_NAMES)[number];

function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}

let acceptingCalls = true;

export async function startMcpServer(): Promise<void> {
  const index = new DocIndex(process.cwd());
  const server = new Server(
    { name: 'repo-mind', version: getPackageVersion() },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'list_docs',
        description: 'List project knowledge documents with optional filters.',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: [...DOC_TYPES] },
            status: { type: 'string', enum: [...DOC_STATUSES] },
            tag: { type: 'string' },
            domain: { type: 'string', enum: [...DOC_DOMAINS] },
          },
        },
      },
      {
        name: 'search_docs',
        description: 'Search project knowledge documents by query.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            type: { type: 'string', enum: [...DOC_TYPES] },
            domain: { type: 'string', enum: [...DOC_DOMAINS] },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_doc',
        description: 'Fetch a single document by slug.',
        inputSchema: {
          type: 'object',
          properties: {
            slug: { type: 'string' },
          },
          required: ['slug'],
        },
      },
      {
        name: 'get_glossary_term',
        description: 'Resolve a glossary term by name.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
          required: ['name'],
        },
      },
      {
        name: 'explore_graph',
        description: 'Explore related documents as a graph.',
        inputSchema: {
          type: 'object',
          properties: {
            slug: { type: 'string' },
            depth: { type: 'number' },
          },
          required: ['slug'],
        },
      },
      {
        name: 'create_draft',
        description:
          'Create a SQLite-backed draft for human review in repo-mind UI (gated on ab-demo kill-switch or REPOMIND_AGENT_WRITE=1).',
        inputSchema: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: [...DOC_TYPES] },
            title: { type: 'string' },
            body: { type: 'string' },
            slug: { type: 'string' },
            related: { type: 'array', items: { type: 'string' } },
            tags: { type: 'array', items: { type: 'string' } },
            forked_from: { type: 'string' },
          },
          required: ['type', 'title', 'body'],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (!acceptingCalls) {
      throw new Error('Server is shutting down');
    }

    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    const toolName = request.params.name;
    if (!isToolName(toolName)) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    switch (toolName) {
      case 'list_docs':
        return toolResult(
          listDocs(index, {
            type: typeof args.type === 'string' ? (args.type as (typeof DOC_TYPES)[number]) : undefined,
            status:
              typeof args.status === 'string'
                ? (args.status as (typeof DOC_STATUSES)[number])
                : undefined,
            tag: typeof args.tag === 'string' ? args.tag : undefined,
            domain:
              typeof args.domain === 'string'
                ? (args.domain as (typeof DOC_DOMAINS)[number])
                : undefined,
          }),
        );
      case 'search_docs':
        return toolResult(
          searchDocs(index, {
            query: typeof args.query === 'string' ? args.query : '',
            type: typeof args.type === 'string' ? (args.type as (typeof DOC_TYPES)[number]) : undefined,
            domain:
              typeof args.domain === 'string'
                ? (args.domain as (typeof DOC_DOMAINS)[number])
                : undefined,
          }),
        );
      case 'get_doc':
        return toolResult(
          getDoc(index, typeof args.slug === 'string' ? args.slug : ''),
        );
      case 'get_glossary_term':
        return toolResult(
          getGlossaryTerm(index, typeof args.name === 'string' ? args.name : ''),
        );
      case 'explore_graph':
        return toolResult(
          exploreGraph(index, {
            slug: typeof args.slug === 'string' ? args.slug : '',
            depth: typeof args.depth === 'number' ? args.depth : undefined,
          }),
        );
      case 'create_draft': {
        const result = createDraft(index, {
          type: typeof args.type === 'string' ? args.type : '',
          title: typeof args.title === 'string' ? args.title : '',
          body: typeof args.body === 'string' ? args.body : '',
          slug: typeof args.slug === 'string' ? args.slug : undefined,
          related: Array.isArray(args.related) ? (args.related as string[]) : undefined,
          tags: Array.isArray(args.tags) ? (args.tags as string[]) : undefined,
          forked_from: typeof args.forked_from === 'string' ? args.forked_from : undefined,
        });
        if (!result.ok) {
          return toolError(result.error);
        }
        return toolResult(result.data);
      }
      default: {
        const unknownTool: never = toolName;
        throw new Error(`Unknown tool: ${unknownTool}`);
      }
    }
  });

  const shutdown = async () => {
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

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function toolResult(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  };
}

function toolError(error: { code: string; message: string; hint?: string }) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
    isError: true,
  };
}
