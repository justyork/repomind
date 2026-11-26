import type { DocIndex } from '../index/doc-index.js';
import { loadLocalEmbedder } from './local-embedder.js';
import { SemanticIndex, type SyncReport } from './semantic-index.js';
import type { Embedder } from './types.js';

export interface PrepareSemanticOptions {
  /** Replaces the local model loader (tests, alternative providers). */
  loader?: (onStatus: (message: string) => void) => Promise<Embedder | null>;
  /** Attach to `index.semantic` before syncing, so search can use the partial index meanwhile. */
  attach?: boolean;
  /** Queries to embed after syncing (e.g. the eval questions). */
  queries?: string[];
  force?: boolean;
  log?: (message: string) => void;
}

export interface PreparedSemantic {
  semantic: SemanticIndex;
  report: SyncReport;
}

export function embeddingsDisabled(): boolean {
  return process.env.REPOMIND_EMBEDDINGS === 'off';
}

/**
 * Loads the embedding model and syncs the vector cache for `index`.
 * Returns null when embeddings are off or the optional dependency is not installed.
 */
export async function prepareSemantic(
  index: DocIndex,
  options: PrepareSemanticOptions = {},
): Promise<PreparedSemantic | null> {
  const log = options.log ?? (() => undefined);
  if (embeddingsDisabled()) {
    return null;
  }

  const loader = options.loader ?? ((onStatus) => loadLocalEmbedder({ onStatus }));
  const embedder = await loader(log);
  if (!embedder) {
    log('semantic search is off: install the optional dependency with "npm i @huggingface/transformers" (set REPOMIND_EMBEDDINGS=off to silence this)');
    return null;
  }

  const semantic = new SemanticIndex(index, embedder);
  if (options.attach) {
    index.semantic = semantic;
  }

  let lastLogged = 0;
  const report = await semantic.sync({
    force: options.force,
    onProgress: (done, total) => {
      if (done === total || done - lastLogged >= 10) {
        lastLogged = done;
        log(`embedding pages: ${done}/${total}`);
      }
    },
  });
  for (const query of options.queries ?? []) {
    await semantic.prepare(query);
  }
  return { semantic, report };
}
