import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prepareSemantic } from '../src/embeddings/prepare.ts';
import { runEmbed } from '../src/commands/embed.ts';
import { DocIndex } from '../src/index/doc-index.ts';
import { createFakeEmbedder } from './helpers/fake-embedder.ts';

const tmpRoots: string[] = [];

afterEach(() => {
  delete process.env.REPOMIND_EMBEDDINGS;
  for (const dir of tmpRoots.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('prepareSemantic', () => {
  let repo: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-prep-'));
    tmpRoots.push(repo);
    const file = path.join(repo, 'docs/wiki/fuel.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '---\ntype: wiki-page\nslug: fuel\nstatus: accepted\ntitle: Fuel\n---\n## Tank\nFuel tank.', 'utf8');
  });

  it('syncs, attaches to the index and prepares queries', async () => {
    const index = new DocIndex(repo);
    const result = await prepareSemantic(index, {
      loader: async () => createFakeEmbedder(),
      attach: true,
      queries: ['топливный бак'],
    });
    expect(result?.report.embeddedDocs).toBe(1);
    expect(index.semantic).toBe(result?.semantic);
    expect(result?.semantic.lookup('топливный бак')?.[0]?.slug).toBe('fuel');
  });

  it('does not attach unless asked', async () => {
    const index = new DocIndex(repo);
    await prepareSemantic(index, { loader: async () => createFakeEmbedder() });
    expect(index.semantic).toBeNull();
  });

  it('returns null with an install hint when the dependency is missing', async () => {
    const messages: string[] = [];
    const result = await prepareSemantic(new DocIndex(repo), { loader: async () => null, log: (m) => messages.push(m) });
    expect(result).toBeNull();
    expect(messages.join(' ')).toContain('@huggingface/transformers');
  });

  it('is disabled by REPOMIND_EMBEDDINGS=off', async () => {
    process.env.REPOMIND_EMBEDDINGS = 'off';
    let called = false;
    const result = await prepareSemantic(new DocIndex(repo), {
      loader: async () => {
        called = true;
        return createFakeEmbedder();
      },
    });
    expect(result).toBeNull();
    expect(called).toBe(false);
  });
});

describe('embed command', () => {
  it('builds the cache and exits 0, or exits 1 without the dependency', async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-embed-'));
    tmpRoots.push(repo);
    const file = path.join(repo, 'docs/wiki/a.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '---\ntype: wiki-page\nslug: a\nstatus: accepted\ntitle: A\n---\ntext', 'utf8');
    const lines: string[] = [];
    expect(await runEmbed({ cwd: repo, loader: async () => createFakeEmbedder(), log: (m) => lines.push(m) })).toBe(0);
    expect(lines.join('\n')).toMatch(/1 embedded/);
    expect(await runEmbed({ cwd: repo, loader: async () => null, log: () => undefined })).toBe(1);
  });

  it('fails clearly when there is no docs/ directory', async () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-embed-empty-'));
    tmpRoots.push(empty);
    expect(await runEmbed({ cwd: empty, loader: async () => createFakeEmbedder(), log: () => undefined })).toBe(1);
  });
});
