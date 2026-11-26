import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';
import { SemanticIndex } from '../src/embeddings/semantic-index.ts';
import { DocIndex } from '../src/index/doc-index.ts';
import { createMcpServer } from '../src/mcp/server.ts';
import { createFakeEmbedder } from './helpers/fake-embedder.ts';

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

  it('keeps tool schemas lean: no repeated enums on search filters', async () => {
    const client = await connect(makeRepo(true));
    const { tools } = await client.listTools();
    const search = tools.find((t) => t.name === 'search_docs')!;
    const props = search.inputSchema.properties as Record<string, Record<string, unknown>>;
    expect(props.type).not.toHaveProperty('enum');
    expect(props.status).not.toHaveProperty('enum');
    expect(props).toHaveProperty('include_top');
  });

  it('omits internal path and duplicate slug from get_doc', async () => {
    const client = await connect(makeRepo(true));
    const data = parse(await client.callTool({ name: 'get_doc', arguments: { slug: 'choice' } }));
    expect(data.path).toBeUndefined();
    expect(data.frontmatter.slug).toBeUndefined();
    expect(data.frontmatter.title).toBe('Choice');
    expect(data.body).toContain('sqlite');
  });

  it('previews long pages and returns everything with full=true', async () => {
    const repo = makeRepo(true);
    fs.writeFileSync(
      path.join(repo, 'docs/adr/long.md'),
      '---\ntype: adr\nslug: long\nstatus: accepted\ntitle: Long\n---\n# Long\n' + 'z'.repeat(6000) + '\n## Tail\nend',
      'utf8',
    );
    const client = await connect(repo);
    const preview = parse(await client.callTool({ name: 'get_doc', arguments: { slug: 'long' } }));
    expect(preview.truncated).toBe(true);
    expect(preview.hint).toMatch(/section/);
    expect(preview.outline.map((h: { heading: string }) => h.heading)).toEqual(['Long', 'Tail']);
    const full = parse(await client.callTool({ name: 'get_doc', arguments: { slug: 'long', full: true } }));
    expect(full.truncated).toBeUndefined();
    expect(full.body).toContain('end');
  });

  it('search_docs include_top returns the best section text inline', async () => {
    const client = await connect(makeRepo(true));
    const hits = parse(await client.callTool({ name: 'search_docs', arguments: { query: 'sqlite', include_top: true } }));
    expect(hits[0].top.text).toContain('sqlite');
  });

  it('exposes docs as repomind://doc/{slug} resources', async () => {
    const client = await connect(makeRepo(true));
    const templates = await client.listResourceTemplates();
    expect(templates.resourceTemplates[0]?.uriTemplate).toBe('repomind://doc/{slug}');
    const read = await client.readResource({ uri: 'repomind://doc/choice' });
    expect((read.contents[0] as { text: string }).text).toContain('We chose sqlite.');
  });

  it('blends semantic hits into search_docs and survives a failing embedder', async () => {
    const repo = makeRepo(true);
    const index = new DocIndex(repo);
    const semantic = new SemanticIndex(index, createFakeEmbedder());
    await semantic.sync();
    index.semantic = semantic;
    const server = createMcpServer(index, repo);
    const client = new Client({ name: 'test', version: '0.0.0' });
    const [a, b] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(a), client.connect(b)]);

    const hits = parse(await client.callTool({ name: 'search_docs', arguments: { query: 'знания в базе данных' } }));
    expect(hits[0].slug).toBe('choice');
    expect(hits[0].matchMode).toBe('semantic');

    index.semantic = {
      prepare: async () => {
        throw new Error('model crashed');
      },
      lookup: () => null,
    };
    const lexical = parse(await client.callTool({ name: 'search_docs', arguments: { query: 'sqlite' } }));
    expect(lexical[0].slug).toBe('choice');
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
