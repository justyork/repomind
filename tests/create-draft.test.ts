import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';
import { slugFromTitle } from '../src/index/slug.ts';
import { getAgentWriteGate, isAgentWriteEnabled } from '../src/agent-write-gate.ts';
import { createDraft } from '../src/tools/create-draft.ts';
import { openDraftsDb } from '../src/ui/db/drafts-db.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-create-draft-'));
  tmpRoots.push(dir);
  return dir;
}

function writeDoc(root: string, relativePath: string, content: string): void {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

afterEach(() => {
  delete process.env.REPOMIND_AGENT_WRITE;
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('slugFromTitle', () => {
  it('derives kebab-case slugs', () => {
    expect(slugFromTitle('Combat Turn Order')).toBe('combat-turn-order');
    expect(slugFromTitle('  MCP / stdio  ')).toBe('mcp-stdio');
  });

  it('falls back for empty titles', () => {
    expect(slugFromTitle('')).toBe('draft');
  });
});

describe('agent-write gate', () => {
  const originalEnv = process.env.REPOMIND_AGENT_WRITE;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.REPOMIND_AGENT_WRITE;
    } else {
      process.env.REPOMIND_AGENT_WRITE = originalEnv;
    }
  });

  it('enables with REPOMIND_AGENT_WRITE=1', () => {
    process.env.REPOMIND_AGENT_WRITE = '1';
    expect(isAgentWriteEnabled()).toBe(true);
    expect(getAgentWriteGate().reason).toContain('REPOMIND_AGENT_WRITE');
  });

  it('disables without override or kill-switch pass', () => {
    delete process.env.REPOMIND_AGENT_WRITE;
    const repo = makeTempDir();
    expect(isAgentWriteEnabled(repo)).toBe(false);
  });
});

describe('createDraft', () => {
  beforeEach(() => {
    process.env.REPOMIND_AGENT_WRITE = '1';
  });

  it('creates a new draft in SQLite', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'docs/glossary/base.md', '---\ntype: glossary-term\nslug: base\nstatus: accepted\n---\n');
    const index = new DocIndex(repo);

    const result = createDraft(index, {
      type: 'wiki-page',
      title: 'Agent Note',
      body: 'Draft body from agent.',
      related: ['base'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.slug).toBe('agent-note');
    expect(result.data.editUrl).toContain(result.data.draftId);

    const db = openDraftsDb(index.getKnowledgeRoot()!);
    const draft = db.getById(result.data.draftId);
    expect(draft?.body).toBe('Draft body from agent.');
    db.close();
  });

  it('returns AGENT_WRITE_DISABLED when gate is closed', () => {
    delete process.env.REPOMIND_AGENT_WRITE;
    const repo = makeTempDir();
    writeDoc(repo, 'docs/glossary/base.md', '---\ntype: glossary-term\nslug: base\nstatus: accepted\n---\n');
    const index = new DocIndex(repo);

    const result = createDraft(index, {
      type: 'wiki-page',
      title: 'Blocked',
      body: 'nope',
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'AGENT_WRITE_DISABLED' }),
    });
  });

  it('forks an existing document', () => {
    const repo = makeTempDir();
    writeDoc(
      repo,
      'docs/glossary/forked.md',
      '---\ntype: glossary-term\nslug: forked\nstatus: accepted\ntitle: Forked\n---\nOriginal body',
    );
    const index = new DocIndex(repo);

    const result = createDraft(index, {
      type: 'glossary-term',
      title: 'Forked edit',
      body: 'Edited body',
      forked_from: 'forked',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.slug).toBe('forked');

    const db = openDraftsDb(index.getKnowledgeRoot()!);
    const draft = db.getById(result.data.draftId);
    expect(draft?.forked_from).toBe('forked');
    expect(draft?.body).toBe('Edited body');
    db.close();
  });

  it('auto-suffixes slug collisions', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'docs/wiki/agent-note.md', '---\ntype: wiki-page\nslug: agent-note\nstatus: accepted\n---\n');
    const index = new DocIndex(repo);

    const result = createDraft(index, {
      type: 'wiki-page',
      title: 'Agent Note',
      body: 'second',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data.slug).toBe('agent-note-2');
  });

  it('rejects explicit slug that conflicts with published doc', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'docs/wiki/taken.md', '---\ntype: wiki-page\nslug: taken\nstatus: accepted\n---\n');
    const index = new DocIndex(repo);

    const result = createDraft(index, {
      type: 'wiki-page',
      title: 'Taken',
      slug: 'taken',
      body: 'body',
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'SLUG_CONFLICT' }),
    });
  });

  it('rejects invalid type', () => {
    const repo = makeTempDir();
    writeDoc(repo, 'docs/glossary/base.md', '---\ntype: glossary-term\nslug: base\nstatus: accepted\n---\n');
    const index = new DocIndex(repo);

    const result = createDraft(index, {
      type: 'not-a-type',
      title: 'Bad',
      body: 'body',
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({ code: 'BAD_TYPE' }),
    });
  });
});

describe('createDraft kill-switch pass', () => {
  it('enables when ab-demo latest.json reports pass', () => {
    const repo = makeTempDir();
    const abRoot = path.join(repo, 'ab-demo');
    fs.mkdirSync(path.join(abRoot, 'results'), { recursive: true });
    fs.writeFileSync(
      path.join(abRoot, 'results', 'latest.json'),
      JSON.stringify({ pass: true, arms: { pass: true, tokenPass: true } }),
      'utf8',
    );
    writeDoc(repo, 'docs/glossary/base.md', '---\ntype: glossary-term\nslug: base\nstatus: accepted\n---\n');

    delete process.env.REPOMIND_AGENT_WRITE;
    expect(isAgentWriteEnabled(repo)).toBe(true);

    const index = new DocIndex(repo);
    const result = createDraft(
      index,
      {
        type: 'wiki-page',
        title: 'Gated pass',
        body: 'enabled by kill-switch',
      },
      repo,
    );

    expect(result.ok).toBe(true);
  });
});
