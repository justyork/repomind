import { DOC_DOMAINS, DOC_STATUSES, DOC_TYPES } from '../index/types.js';
import { MAX_SEARCH_LIMIT, MCP_DEFAULT_SEARCH_LIMIT } from '../tools/search-docs.js';

export const TOOL_NAMES = [
  'list_docs',
  'search_docs',
  'get_doc',
  'get_glossary_term',
  'explore_graph',
  'create_draft',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export function isToolName(name: string): name is ToolName {
  return (TOOL_NAMES as readonly string[]).includes(name);
}

export const SERVER_INSTRUCTIONS = [
  'Project knowledge base (docs/). Flow: search_docs (a natural-language question works) -> get_doc(slug) -> explore_graph.',
  'Long page: use get_doc section/max_chars (outline lists sections). Check status: superseded/draft may be outdated.',
].join('\n');

const READ_ONLY = {
  readOnlyHint: true,
  idempotentHint: true,
  destructiveHint: false,
  openWorldHint: false,
} as const;

export interface McpToolDefinition {
  name: ToolName;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: Record<string, unknown>;
}

/** Tool list advertised over MCP. create_draft is only listed when agent write is enabled. */
export function buildToolDefinitions(options: { writeEnabled: boolean }): McpToolDefinition[] {
  const tools: McpToolDefinition[] = [
    {
      name: 'search_docs',
      description:
        'Search docs by keywords or a question. Tries all terms, then any term (matchMode:any). Then call get_doc.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', },
          type: { type: 'string', enum: [...DOC_TYPES] },
          domain: { type: 'string', enum: [...DOC_DOMAINS] },
          status: { type: 'string', enum: [...DOC_STATUSES] },
          limit: {
            type: 'number',
            description: `Max hits (default ${MCP_DEFAULT_SEARCH_LIMIT}, max ${MAX_SEARCH_LIMIT}).`,
          },
        },
        required: ['query'],
      },
      annotations: { title: 'Search docs', ...READ_ONLY },
    },
    {
      name: 'get_doc',
      description:
        'Get a page by slug: frontmatter, body, outline, backlinks. Long page: pass section (heading) or max_chars.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          section: { type: 'string', description: 'Return only this heading and its subsections.' },
          max_chars: { type: 'number', description: 'Truncate the body to this many characters.' },
        },
        required: ['slug'],
      },
      annotations: { title: 'Get doc', ...READ_ONLY },
    },
    {
      name: 'explore_graph',
      description:
        'Walk links from a page. depth = hops (default 2); direction out|in|both.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          depth: { type: 'number' },
          direction: { type: 'string', enum: ['out', 'in', 'both'] },
        },
        required: ['slug'],
      },
      annotations: { title: 'Explore graph', ...READ_ONLY },
    },
    {
      name: 'get_glossary_term',
      description: 'Look up a glossary term by name.',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string' } },
        required: ['name'],
      },
      annotations: { title: 'Glossary term', ...READ_ONLY },
    },
    {
      name: 'list_docs',
      description:
        'List all pages (large; prefer search_docs).',
      inputSchema: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...DOC_TYPES] },
          status: { type: 'string', enum: [...DOC_STATUSES] },
          tag: { type: 'string' },
          domain: { type: 'string', enum: [...DOC_DOMAINS] },
        },
      },
      annotations: { title: 'List docs', ...READ_ONLY },
    },
  ];

  if (options.writeEnabled) {
    tools.push({
      name: 'create_draft',
      description:
        'Create a draft page (or edit via forked_from) for human review. Does not change published docs.',
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
      annotations: {
        title: 'Create draft',
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    });
  }

  return tools;
}
