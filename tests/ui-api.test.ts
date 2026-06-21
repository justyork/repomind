import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';
import { ALL_GRAPH_SLUG, exploreGraphAll } from '../src/ui/graph-all.ts';
import { openDraftsDb } from '../src/ui/db/drafts-db.ts';
import { computeKnowledgeStats } from '../src/ui/stats.ts';
import { createUiServer } from '../src/ui/server.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-ui-'));
  tmpRoots.push(dir);
  return dir;
}

function writeDoc(root: string, relativePath: string, content: string): void {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function fixtureKnowledge(root: string): void {
  writeDoc(
    root,
    '.project-knowledge/glossary/caravan.md',
    `---
type: glossary-term
slug: caravan
status: accepted
title: Caravan
related:
  - convoy-rules
tags:
  - game
---
A group of vehicles traveling together.
`,
  );
  writeDoc(
    root,
    '.project-knowledge/specs/convoy-rules.md',
    `---
type: feature-spec
slug: convoy-rules
status: draft
title: Convoy Rules
related:
  - caravan
---
Rules for convoy movement.
`,
  );
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function fetchJson(
  port: number,
  pathname: string,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}${pathname}`, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({
          status: res.statusCode ?? 0,
          body: text ? JSON.parse(text) : null,
        });
      });
    }).on('error', reject);
  });
}

describe('exploreGraphAll', () => {
  it('returns all docs as nodes with edges', () => {
    const repo = makeTempDir();
    fixtureKnowledge(repo);
    const index = new DocIndex(repo);
    const graph = exploreGraphAll(index);
    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges.length).toBeGreaterThanOrEqual(1);
  });
});

describe('computeKnowledgeStats', () => {
  it('counts docs and broken links', () => {
    const repo = makeTempDir();
    fixtureKnowledge(repo);
    writeDoc(
      repo,
      '.project-knowledge/adr/broken.md',
      `---
type: adr
slug: broken
status: draft
title: Broken
related:
  - missing-slug
---
`,
    );
    const index = new DocIndex(repo);
    const stats = computeKnowledgeStats(index);
    expect(stats.totalDocs).toBe(3);
    expect(stats.brokenRelatedCount).toBe(1);
  });
});

describe('UI HTTP API', () => {
  it('serves health, search, and graph endpoints', async () => {
    const repo = makeTempDir();
    fixtureKnowledge(repo);
    const index = new DocIndex(repo);
    const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-static-'));

    const server = createUiServer({ port: 0, index, staticDir, host: '127.0.0.1' });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('no port');
    }
    const port = addr.port;

    try {
      const health = await fetchJson(port, '/api/health');
      expect(health.status).toBe(200);
      expect(health.body).toMatchObject({ ok: true, docCount: 2 });

      const search = await fetchJson(port, '/api/search?q=caravan');
      expect(search.status).toBe(200);
      const searchBody = search.body as { results: { slug: string }[] };
      expect(searchBody.results.some((r) => r.slug === 'caravan')).toBe(true);

      const graph = await fetchJson(port, `/api/graph/${ALL_GRAPH_SLUG}`);
      expect(graph.status).toBe(200);
      const graphBody = graph.body as { nodes: unknown[] };
      expect(graphBody.nodes.length).toBe(2);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });

  it('serves check and draft diff endpoints', async () => {
    const repo = makeTempDir();
    fixtureKnowledge(repo);
    writeDoc(
      repo,
      '.project-knowledge/adr/broken.md',
      `---
type: adr
slug: broken
status: draft
title: Broken
related:
  - missing-slug
---
`,
    );
    const index = new DocIndex(repo);
    const db = openDraftsDb(index.getKnowledgeRoot()!);
    const draft = db.create({
      slug: 'ui-draft',
      type: 'glossary-term',
      title: 'UI Draft',
      body: 'Draft body',
    });

    const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-static-'));
    const server = createUiServer({ port: 0, index, staticDir, host: '127.0.0.1', draftsDb: db });
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address();
    if (!addr || typeof addr === 'string') {
      throw new Error('no port');
    }
    const port = addr.port;

    try {
      const check = await fetchJson(port, '/api/check');
      expect(check.status).toBe(200);
      const checkBody = check.body as { ok: boolean; violations: unknown[] };
      expect(checkBody.ok).toBe(false);
      expect(checkBody.violations.length).toBeGreaterThan(0);

      const diff = await fetchJson(port, `/api/drafts/${encodeURIComponent(draft.id)}/diff`);
      expect(diff.status).toBe(200);
      const diffBody = diff.body as { isNew: boolean; diff: string };
      expect(diffBody.isNew).toBe(true);
      expect(diffBody.diff).toContain('Draft body');
    } finally {
      db.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      fs.rmSync(staticDir, { recursive: true, force: true });
    }
  });
});
