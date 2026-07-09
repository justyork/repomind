import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';
import { askDocs } from '../src/ask/ask.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-ask-'));
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
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('askDocs', () => {
  let repo: string;
  let index: DocIndex;

  beforeEach(() => {
    repo = makeTempDir();
    writeDoc(repo, 'auth', 'Authentication', 'Login and session tokens.');
    index = new DocIndex(repo);
  });

  it('requires an API key', async () => {
    await expect(askDocs(index, { question: 'session' })).rejects.toThrow(/API key is required/);
  });

  it('replies to greetings without calling the LLM', async () => {
    process.env.REPOMIND_ASK_API_KEY = 'test-key';
    const completeFn = vi.fn();
    const result = await askDocs(index, { question: 'привет' }, { completeFn });
    expect(completeFn).not.toHaveBeenCalled();
    expect(result.notFound).toBe(false);
    expect(result.answer).toContain('Привет!');
  });

  it('returns suggestions without calling the LLM when retrieval is empty', async () => {
    const completeFn = vi.fn().mockResolvedValue('Should not be used.');
    const result = await askDocs(
      index,
      { question: 'zzzz-not-found', apiKey: 'test-key' },
      { completeFn },
    );
    expect(completeFn).not.toHaveBeenCalled();
    expect(result.notFound).toBe(true);
    expect(result.sources).toEqual([]);
    expect(result.answer).toMatch(/No pages matched|Не нашёл страниц/);
  });

  it('calls LLM and ensures citations', async () => {
    const completeFn = vi.fn().mockResolvedValue('Sessions are described in the docs.');
    const result = await askDocs(
      index,
      { question: 'session', apiKey: 'test-key' },
      { completeFn },
    );
    expect(completeFn).toHaveBeenCalledOnce();
    expect(result.notFound).toBe(false);
    expect(result.sources).toHaveLength(1);
    expect(result.answer).toContain('## Sources');
    expect(result.answer).toContain('[Authentication](?slug=auth)');
  });
});
