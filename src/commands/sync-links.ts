import path from 'node:path';
import { DocIndex } from '../index/doc-index.js';
import { syncAllDocLinks, type SyncLinksResult } from '../prepare/auto-links.js';

export interface SyncLinksCommandOptions {
  cwd?: string;
  dryRun?: boolean;
  convertBody?: boolean;
  syncRelated?: boolean;
}

function printSyncLinksResult(result: SyncLinksResult, dryRun: boolean): void {
  const verb = dryRun ? 'Would update' : 'Updated';
  let changedCount = 0;

  for (const file of result.files) {
    if (file.skipped) {
      continue;
    }
    if (!file.changed) {
      continue;
    }
    changedCount += 1;
    const parts: string[] = [];
    if (file.convertedLinks > 0) {
      parts.push(`${file.convertedLinks} markdown link(s) → wikilink`);
    }
    if (file.addedRelated.length > 0) {
      parts.push(`related +${file.addedRelated.join(', ')}`);
    }
    console.log(`${verb}: ${file.relativePath}${parts.length > 0 ? ` (${parts.join('; ')})` : ''}`);
  }

  const unchanged = result.files.filter((file) => !file.skipped && !file.changed).length;
  console.log(`${verb} ${changedCount} file(s), ${unchanged} unchanged`);
}

export function runSyncLinks(options: SyncLinksCommandOptions = {}): number {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const index = new DocIndex(cwd);

  if (!index.getKnowledgeRoot()) {
    console.error('no docs/ found — run `repo-mind init` or create a docs/ directory');
    return 1;
  }

  const result = syncAllDocLinks(index, {
    dryRun: options.dryRun,
    convertMarkdownLinks: options.convertBody ?? true,
    syncRelated: options.syncRelated ?? true,
  });

  printSyncLinksResult(result, options.dryRun === true);
  return 0;
}
