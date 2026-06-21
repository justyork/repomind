import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';
import { getGlossaryTerm } from '../src/tools/get-glossary-term.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-glossary-'));
  tmpRoots.push(dir);
  return dir;
}

function writeGlossary(
  root: string,
  slug: string,
  title: string,
  body: string,
  related: string[] = [],
): void {
  const relatedLines = related.length > 0 ? `related:\n${related.map((r) => `  - ${r}`).join('\n')}` : '';
  const filePath = path.join(root, '.project-knowledge/glossary', `${slug}.md`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    `---\ntype: glossary-term\nslug: ${slug}\nstatus: accepted\ntitle: ${title}\n${relatedLines}\n---\n\n${body}`,
    'utf8',
  );
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('get_glossary_term', () => {
  let repo: string;
  let index: DocIndex;

  beforeEach(() => {
    repo = makeTempDir();
    writeGlossary(repo, 'mcp', 'Model Context Protocol', 'First paragraph.\n\nSecond.', ['auth']);
    writeGlossary(repo, 'auth', 'Authentication', 'Login flows.');
    index = new DocIndex(repo);
  });

  it('matches exact slug', () => {
    const result = getGlossaryTerm(index, 'mcp');
    expect(result.found).toBe(true);
    expect(result.definition).toBe('First paragraph.');
    expect(result.related).toEqual(['auth']);
  });

  it('matches substring on title', () => {
    const result = getGlossaryTerm(index, 'protocol');
    expect(result.found).toBe(true);
    expect(result.slug).toBe('mcp');
  });

  it('returns suggestions on miss without fabricated definition', () => {
    const result = getGlossaryTerm(index, 'zzzz');
    expect(result.found).toBe(false);
    expect(result.definition).toBeUndefined();
    expect(result.suggestions).toBeDefined();
  });
});
