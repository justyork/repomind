import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';
import { createMcpServer } from '../src/mcp/server.ts';

const tmpRoots: string[] = [];

function makeRepo(withDocs: boolean): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-mcp-'));
  tmpRoots.push(dir);
  if (withDocs) {
    const file = path.join(dir, 'docs/adr/choice.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '---\ntype: adr\nslug: choice\nstatus: accepted\ntitle: Choice\n---\nWe chose sqlite.', 'utf8');
  }
  return dir;
}

async function connect(repo: string): Promise<Client> {
  const server = createMcpServer(new DocIndex(repo), repo);
  const client = new Client({ name: 'test', version: '0.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

function parse(result: unknown): any {
  const content = (result as { content: Array<{ text: string }> }).content;
  return JSON.parse(content[0]!.text);
}

afterEach(() => {
  delete process.env.REPOMIND_AGENT_WRITE;
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('mcp server', () => {
  it('ships workflow instructions', async () => {
    const client = await connect(makeRepo(true));
    expect(client.getInstructions()).toMatch(/search_docs[\s\S]*get_doc/);
  });

  it('marks read tools read-only and describes them richly', async () => {
    const client = await connect(makeRepo(true));
    const { tools } = await client.listTools();
    const search = tools.find((t) => t.name === 'search_docs')!;
    expect(search.annotations?.readOnlyHint).toBe(true);
    expect(search.description!.length).toBeGreaterThan(80);
    expect(search.inputSchema.properties).toHaveProperty('limit');
    expect(search.inputSchema.properties).toHaveProperty('status');
  });

  it('hides create_draft while agent write is disabled', async () => {
    const client = await connect(makeRepo(true));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).not.toContain('create_draft');
  });

  it('lists create_draft when REPOMIND_AGENT_WRITE=1', async () => {
    process.env.REPOMIND_AGENT_WRITE = '1';
    const client = await connect(makeRepo(true));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain('create_draft');
  });

  it('answers search_docs end to end', async () => {
    const client = await connect(makeRepo(true));
    const data = parse(await client.callTool({ name: 'search_docs', arguments: { query: 'sqlite' } }));
    expect(data[0].slug).toBe('choice');
  });

  it('returns a clear error when no docs/ root exists', async () => {
    const repo = makeRepo(false);
    const client = await connect(repo);
    const result = await client.callTool({ name: 'list_docs', arguments: {} });
    expect(result.isError).toBe(true);
    expect(parse(result).error.code).toBe('NO_KNOWLEDGE_ROOT');
    expect(parse(result).error.message).toContain(repo);
  });

  it('returns isError for unknown tools', async () => {
    const client = await connect(makeRepo(true));
    const result = await client.callTool({ name: 'nope', arguments: {} });
    expect(result.isError).toBe(true);
  });

  it('rejects invalid enum filters instead of silently ignoring', async () => {
    const client = await connect(makeRepo(true));
    const result = await client.callTool({ name: 'list_docs', arguments: { type: 'bogus' } });
    expect(result.isError).toBe(true);
    expect(parse(result).error.code).toBe('BAD_ARGUMENT');
  });
});
