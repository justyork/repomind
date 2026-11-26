import path from 'node:path';
import { DocIndex } from '../index/doc-index.js';
import { prepareSemantic, type PrepareSemanticOptions } from '../embeddings/prepare.js';

export interface EmbedOptions {
  cwd?: string;
  force?: boolean;
  loader?: PrepareSemanticOptions['loader'];
  log?: (message: string) => void;
}

/** Builds (or refreshes) the vector cache so semantic search is ready before the first query. */
export async function runEmbed(options: EmbedOptions = {}): Promise<number> {
  const log = options.log ?? ((message: string) => console.log(message));
  const index = new DocIndex(path.resolve(options.cwd ?? process.cwd()));
  if (!index.getKnowledgeRoot()) {
    log('no docs/ directory found; run from the project or pass --cwd <dir>');
    return 1;
  }

  const prepared = await prepareSemantic(index, { loader: options.loader, force: options.force, log });
  if (!prepared) {
    return 1;
  }
  const { report } = prepared;
  log(
    `done: ${report.embeddedDocs} embedded, ${report.skippedDocs} unchanged, ${report.removedDocs} removed (${report.chunks} chunks)`,
  );
  return 0;
}
