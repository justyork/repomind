import fs from 'node:fs';
import type { DocIndex } from '../index/doc-index.js';
import { TYPE_TO_DIR } from '../index/types.js';
import { resolveDocPath } from '../index/slug.js';
import type { DraftRow } from './db/drafts-db.js';
import { buildMarkdownFromDraft } from './publish.js';

export interface DraftDiffResult {
  targetPath: string | null;
  isNew: boolean;
  diff: string;
}

export function computeDraftDiff(index: DocIndex, draft: DraftRow): DraftDiffResult {
  const knowledgeRoot = index.getKnowledgeRoot();
  if (!knowledgeRoot) {
    return { targetPath: null, isNew: true, diff: buildMarkdownFromDraft(draft) };
  }

  const typeDir = TYPE_TO_DIR[draft.type];
  const targetPath = resolveDocPath(knowledgeRoot, typeDir, draft.slug);
  const proposed = buildMarkdownFromDraft(draft);

  if (!targetPath || !fs.existsSync(targetPath)) {
    return {
      targetPath,
      isNew: true,
      diff: `--- /dev/null\n+++ ${targetPath ?? draft.slug + '.md'}\n${prefixLines(proposed, '+')}`,
    };
  }

  const current = fs.readFileSync(targetPath, 'utf8');
  if (current === proposed) {
    return { targetPath, isNew: false, diff: '(no changes)' };
  }

  return {
    targetPath,
    isNew: false,
    diff: unifiedDiff(targetPath, current, proposed),
  };
}

function prefixLines(text: string, prefix: string): string {
  return text
    .split('\n')
    .map((line) => `${prefix}${line}`)
    .join('\n');
}

function unifiedDiff(pathLabel: string, before: string, after: string): string {
  const oldLines = before.split('\n');
  const newLines = after.split('\n');
  const header = [`--- a/${pathLabel}`, `+++ b/${pathLabel}`];

  if (oldLines.join('\n') === newLines.join('\n')) {
    return '(no changes)';
  }

  const max = Math.max(oldLines.length, newLines.length);
  const body: string[] = [];
  for (let i = 0; i < max; i += 1) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    if (oldLine === newLine) {
      body.push(` ${oldLine ?? ''}`);
    } else {
      if (oldLine !== undefined) {
        body.push(`-${oldLine}`);
      }
      if (newLine !== undefined) {
        body.push(`+${newLine}`);
      }
    }
  }

  return [...header, `@@ -1,${oldLines.length} +1,${newLines.length} @@`, ...body].join('\n');
}
