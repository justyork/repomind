import { DOC_DOMAINS, DOC_STATUSES, DOC_TYPES } from '../index/types.js';
import { estimateJsonTokens } from './estimate-tokens.js';

/** Mirrors MCP ListTools payload shape for token budgeting. */
export function mcpToolSchemaTokenEstimate(): number {
  const tools = [
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
        properties: { slug: { type: 'string' } },
        required: ['slug'],
      },
    },
    {
      name: 'get_glossary_term',
      description: 'Resolve a glossary term by name.',
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string' } },
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
  ];

  return estimateJsonTokens({ tools });
}

export const BASELINE_CLAUDE_SNIPPET = `# Project knowledge

Read markdown files under \`docs/\` to answer questions. Prefer grep or glob before reading entire files.
`;
