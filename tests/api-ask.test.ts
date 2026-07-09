import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';
import { handleAskApi, handleApiRequest } from '../src/ui/api-handlers.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-api-ask-'));
  tmpRoots.push(dir);
  return dir;
}

function writeDoc(root: string, slug: string, title: string, body: string): void {
  const filePath = path.join(root, 'docs/glossary', `${slug}.md`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `---\ntype: glossary-term\nslug: ${slug}\nstatus: accepted\ntitle: ${title}\n---\n\n${body}`,
    'utf8',
  );
}

afterEach(() => {
  delete process.env.REPOMIND_ASK_API_KEY;
  vi.restoreAllMocks();
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('POST /api/ask', () => {
  let index: DocIndex;

  beforeEach(() => {
    const repo = makeTempDir();
    writeDoc(repo, 'auth', 'Authentication', 'Login and session tokens.');
    index = new DocIndex(repo);
  });

  it('returns null for non-ask routes', async () => {
    const response = await handleAskApi(index, 'GET', '/api/search', '');
    expect(response).toBeNull();
  });

  it('rejects invalid JSON', async () => {
    const response = await handleAskApi(index, 'POST', '/api/ask', '{bad');
    expect(response?.status).toBe(400);
  });

  it('requires an API key', async () => {
    const response = await handleAskApi(
      index,
      'POST',
      '/api/ask',
      JSON.stringify({ question: 'session' }),
    );
    expect(response?.status).toBe(400);
    expect((response?.body as { error?: string }).error).toMatch(/API key/i);
  });

  it('returns notFound with suggestions when nothing matches', async () => {
    const response = await handleAskApi(
      index,
      'POST',
      '/api/ask',
      JSON.stringify({ question: 'zzzz-missing', apiKey: 'test-key' }),
    );
    expect(response?.status).toBe(200);
    const body = response?.body as { notFound: boolean; sources: unknown[]; answer: string };
    expect(body.notFound).toBe(true);
    expect(body.sources).toEqual([]);
    expect(body.answer).toMatch(/No pages matched|Не нашёл страниц/);
  });

  it('greets without notFound for small talk', async () => {
    const response = await handleAskApi(
      index,
      'POST',
      '/api/ask',
      JSON.stringify({ question: 'привет', apiKey: 'test-key' }),
    );
    expect(response?.status).toBe(200);
    const body = response?.body as { notFound: boolean; answer: string };
    expect(body.notFound).toBe(false);
    expect(body.answer).toContain('Привет!');
  });
});

describe('GET /api/ask/config', () => {
  it('returns server ask config without exposing secrets', () => {
    process.env.REPOMIND_ASK_API_KEY = 'secret';
    const index = new DocIndex(makeTempDir());
    const response = handleApiRequest(index, {} as import('node:http').IncomingMessage, '/api/ask/config', new URLSearchParams());
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      serverConfigured: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
    });
  });
});
