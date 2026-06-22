import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { cascadeSlugDelete, cascadeSlugRename } from '../src/ui/link-cascade.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-cascade-'));
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

describe('link cascade', () => {
  it('updates wikilinks and related on slug rename', () => {
    const repo = makeTempDir();
    const docsRoot = path.join(repo, 'docs');
    writeDoc(
      repo,
      'docs/glossary/old-slug.md',
      `---
type: glossary-term
slug: old-slug
status: accepted
title: Old
---
Target page.
`,
    );
    writeDoc(
      repo,
      'docs/specs/linker.md',
      `---
type: feature-spec
slug: linker
status: draft
title: Linker
related:
  - old-slug
---
See [[old-slug]] and [[Label|old-slug]].
`,
    );

    const updated = cascadeSlugRename(docsRoot, 'old-slug', 'new-slug');
    expect(updated).toHaveLength(1);

    const raw = fs.readFileSync(path.join(repo, 'docs/specs/linker.md'), 'utf8');
    expect(raw).toContain('[[new-slug]]');
    expect(raw).toContain('[[Label|new-slug]]');
    expect(raw).toContain('related:\n  - new-slug');
    expect(raw).not.toContain('old-slug');
  });

  it('removes references on slug delete', () => {
    const repo = makeTempDir();
    const docsRoot = path.join(repo, 'docs');
    writeDoc(
      repo,
      'docs/specs/linker.md',
      `---
type: feature-spec
slug: linker
status: draft
title: Linker
related:
  - gone
---
Mentions [[gone]] and [[Alias|gone]].
`,
    );

    const updated = cascadeSlugDelete(docsRoot, 'gone');
    expect(updated).toHaveLength(1);

    const raw = fs.readFileSync(path.join(repo, 'docs/specs/linker.md'), 'utf8');
    expect(raw).not.toContain('[[gone]]');
    expect(raw).toContain('Alias');
    expect(raw).not.toContain('- gone');
  });
});
