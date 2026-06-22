import path from 'node:path';
import { DocIndex } from '../index/doc-index.js';
import {
  listUnpreparedFiles,
  prepareAllDocs,
  prepareDocFile,
  type PrepareAllResult,
} from '../prepare/prepare-docs.js';

export interface PrepareCommandOptions {
  cwd?: string;
  dryRun?: boolean;
  all?: boolean;
  path?: string;
}

function printPrepareAllResult(result: PrepareAllResult, dryRun: boolean): void {
  const verb = dryRun ? 'Would prepare' : 'Prepared';
  for (const item of result.prepared) {
    console.log(`${verb}: ${item.relativePath} → ${item.slug} (${item.type})`);
  }
  for (const item of result.skipped) {
    console.error(`Skipped ${item.relativePath}: ${item.reason}`);
  }
  console.log(`${verb} ${result.prepared.length} file(s), skipped ${result.skipped.length}`);
}

export function runPrepare(options: PrepareCommandOptions = {}): number {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const index = new DocIndex(cwd);

  if (!index.getKnowledgeRoot()) {
    console.error('no docs/ found — run `repo-mind init` or create a docs/ directory');
    return 1;
  }

  if (options.all) {
    const result = prepareAllDocs(index, { dryRun: options.dryRun });
    printPrepareAllResult(result, options.dryRun === true);
    return result.skipped.length > 0 ? 1 : 0;
  }

  if (options.path) {
    const relativePath = options.path.replace(/\\/g, '/').replace(/^\.\//, '');
    if (options.dryRun) {
      const match = listUnpreparedFiles(index).find((file) => file.relativePath === relativePath);
      if (!match) {
        console.error(`not unprepared or not found: ${relativePath}`);
        return 1;
      }
      console.log(
        `Would prepare: ${match.relativePath} → ${match.suggestedSlug} (${match.suggestedType})`,
      );
      return 0;
    }

    try {
      const result = prepareDocFile(index, relativePath);
      console.log(`Prepared: ${result.relativePath} → ${result.slug} (${result.type})`);
      return 0;
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      return 1;
    }
  }

  const unprepared = listUnpreparedFiles(index);
  if (unprepared.length === 0) {
    console.log('All markdown docs already have frontmatter.');
    return 0;
  }

  console.log(`${unprepared.length} unprepared markdown file(s).`);
  console.log('Run with --all to add frontmatter, or pass a relative path under docs/.');
  for (const file of unprepared.slice(0, 10)) {
    console.log(`  ${file.relativePath} → ${file.suggestedSlug} (${file.suggestedType})`);
  }
  if (unprepared.length > 10) {
    console.log(`  … and ${unprepared.length - 10} more`);
  }
  return 0;
}
