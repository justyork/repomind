import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectCheckReport } from '../src/check/collect-violations.ts';
import { DocIndex, listKnowledgeFiles } from '../src/index/doc-index.ts';
import { contentKindFromRelativePath } from '../src/index/knowledge-file.ts';
import { buildLinkIndex } from '../src/index/link-index.ts';
import { slugFromRelativePath } from '../src/index/slug.ts';
import { getDoc } from '../src/tools/get-doc.ts';
import { listDocs } from '../src/tools/list-docs.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-knowledge-'));
  tmpRoots.push(dir);
  return dir;
}

function writeFile(root: string, relativePath: string, content: string): void {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('knowledge files', () => {
  let repo: string;

  beforeEach(() => {
    repo = makeTempDir();
    writeFile(
      repo,
      'docs/config/app.yaml',
      'service:\n  name: repo-mind\n  port: 3847\n',
    );
    writeFile(
      repo,
      'docs/config/settings.json',
      JSON.stringify({ theme: 'dark', features: ['tree', 'links'] }, null, 2),
    );
    writeFile(
      repo,
      'docs/glossary/alpha.md',
      `---
type: glossary-term
slug: alpha
status: accepted
title: Alpha
---
Markdown page.`,
    );
  });

  it('discovers md, yaml, and json under docs/', () => {
    const root = path.join(repo, 'docs');
    const files = listKnowledgeFiles(root);
    expect(files).toHaveLength(3);
  });

  it('infers content kind from extension', () => {
    expect(contentKindFromRelativePath('config/app.yaml')).toBe('yaml');
    expect(contentKindFromRelativePath('config/settings.json')).toBe('json');
    expect(contentKindFromRelativePath('glossary/alpha.md')).toBe('markdown');
  });

  it('builds slugs from structured file paths', () => {
    expect(slugFromRelativePath('config/app.yaml')).toBe('config-app');
    expect(slugFromRelativePath('config/settings.json')).toBe('config-settings');
  });

  it('indexes structured files with inferred metadata', () => {
    const index = new DocIndex(repo);
    const docs = index.refresh();
    expect(docs).toHaveLength(3);

    const yamlDoc = index.getDocBySlug('config-app');
    expect(yamlDoc?.contentKind).toBe('yaml');
    expect(yamlDoc?.title).toBe('App');
    expect(yamlDoc?.prepared).toBe(false);
    expect(yamlDoc?.body).toContain('repo-mind');

    const jsonDoc = index.getDocBySlug('config-settings');
    expect(jsonDoc?.contentKind).toBe('json');
    expect(jsonDoc?.title).toBe('Settings');
  });

  it('resolves docs by relative path', () => {
    const index = new DocIndex(repo);
    index.refresh();
    expect(index.getDocByRelativePath('config/app.yaml')?.slug).toBe('config-app');
  });

  it('exposes contentKind via list_docs and get_doc', () => {
    const index = new DocIndex(repo);
    const listed = listDocs(index);
    expect(listed.find((doc) => doc.slug === 'config-settings')?.contentKind).toBe('json');

    const fetched = getDoc(index, 'config-app');
    expect(fetched.found).toBe(true);
    expect(fetched.contentKind).toBe('yaml');
    expect(fetched.path).toContain('app.yaml');
  });

  it('skips wikilink parsing for non-markdown files', () => {
    writeFile(
      repo,
      'docs/config/broken.json',
      '{"note": "see [[alpha]]"}',
    );
    const index = new DocIndex(repo);
    const snapshot = buildLinkIndex(index.refresh());
    expect(
      snapshot.edges.some((edge) => edge.from === 'config-broken' && edge.kind === 'wikilink'),
    ).toBe(false);
  });

  it('warns on invalid JSON during check', () => {
    writeFile(repo, 'docs/config/invalid.json', '{ not valid json');
    const index = new DocIndex(repo);
    const report = collectCheckReport(index);
    expect(report?.warnings.some((w) => w.includes('invalid JSON'))).toBe(true);
  });
});
