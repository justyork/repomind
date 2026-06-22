import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { DocIndex } from '../src/index/doc-index.ts';
import { movePageFile, renamePageFile } from '../src/ui/fs-operations.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-fs-'));
  tmpRoots.push(dir);
  return dir;
}

function writeDoc(root: string, relativePath: string, content: string): void {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('fs move/rename', () => {
  it('moves a page between folders and reports inbound link warnings', () => {
    const repo = makeTempDir();
    writeDoc(
      repo,
      'docs/glossary/caravan.md',
      `---
type: glossary-term
slug: caravan
status: accepted
title: Caravan
---
Glossary entry.
`,
    );
    writeDoc(
      repo,
      'docs/specs/convoy-rules.md',
      `---
type: feature-spec
slug: convoy-rules
status: draft
title: Convoy Rules
related:
  - caravan
---
See [[caravan]].
`,
    );

    const index = new DocIndex(repo);
    const result = movePageFile(index, 'specs/convoy-rules.md', 'glossary');

    expect(result.relativePath).toBe('glossary/convoy-rules.md');
    expect(fs.existsSync(path.join(repo, 'docs/glossary/convoy-rules.md'))).toBe(true);
    expect(fs.existsSync(path.join(repo, 'docs/specs/convoy-rules.md'))).toBe(false);
    expect(result.inboundWarnings.some((w) => w.slug === 'caravan')).toBe(false);
    expect(index.getDocBySlug(result.slug)).toBeTruthy();
  });

  it('renames a page file in place', () => {
    const repo = makeTempDir();
    writeDoc(
      repo,
      'docs/specs/old-name.md',
      `---
type: feature-spec
slug: old-name
status: draft
title: Old Name
---
Body.
`,
    );

    const index = new DocIndex(repo);
    const result = renamePageFile(index, 'specs/old-name.md', 'new-name');

    expect(result.relativePath).toBe('specs/new-name.md');
    expect(fs.existsSync(path.join(repo, 'docs/specs/new-name.md'))).toBe(true);
    expect(index.getDocBySlug(result.slug)).toBeTruthy();
    expect(result.slug).toBe('specs-new-name');
  });
});
