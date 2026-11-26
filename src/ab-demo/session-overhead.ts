import { SERVER_INSTRUCTIONS, buildToolDefinitions } from '../mcp/tool-definitions.js';
import { estimateJsonTokens } from './estimate-tokens.js';

/** Token cost of what an MCP client loads at session start: server instructions + ListTools payload. */
export function mcpToolSchemaTokenEstimate(): number {
  const tools = buildToolDefinitions({ writeEnabled: false });
  return estimateJsonTokens({ instructions: SERVER_INSTRUCTIONS, tools });
}

export const BASELINE_CLAUDE_SNIPPET = `# Project knowledge

Read markdown files under \`docs/\` to answer questions. Prefer grep or glob before reading entire files.
`;
