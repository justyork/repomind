import os from 'node:os';
import path from 'node:path';
import type { Embedder } from './types.js';

/** Multilingual (100 languages), 384-dim, ~120 MB quantised: good RU/EN cross-lingual retrieval. */
export const LOCAL_MODEL_ID = 'Xenova/multilingual-e5-small';
const PACKAGE = '@huggingface/transformers';
const BATCH = 16;

type PipelineOutput = { dims: number[]; data: ArrayLike<number> };
type Pipeline = (texts: string[], options?: Record<string, unknown>) => Promise<PipelineOutput>;
interface TransformersModule {
  pipeline: (task: string, model: string, options?: Record<string, unknown>) => Promise<Pipeline>;
  env?: { cacheDir?: string };
}

export interface LocalEmbedderOptions {
  modelId?: string;
  /** Test seam: replaces the dynamic import of the optional dependency. */
  importer?: () => Promise<unknown>;
  onStatus?: (message: string) => void;
}

/**
 * Loads the local e5 model through the optional `@huggingface/transformers` dependency.
 * Returns null when that dependency is not installed; rethrows if the model cannot be loaded.
 */
export async function loadLocalEmbedder(options: LocalEmbedderOptions = {}): Promise<Embedder | null> {
  const modelId = options.modelId ?? process.env.REPOMIND_EMBEDDING_MODEL ?? LOCAL_MODEL_ID;
  let mod: TransformersModule;
  try {
    mod = (await (options.importer ?? (() => import(PACKAGE)))()) as TransformersModule;
  } catch {
    return null;
  }

  if (mod.env) {
    mod.env.cacheDir = path.join(os.homedir(), '.cache', 'repo-mind', 'models');
  }
  options.onStatus?.(`loading embedding model ${modelId} (the first run downloads the model; ~120 MB for the default)`);
  const pipe = await mod.pipeline('feature-extraction', modelId, { dtype: 'q8' });

  return {
    id: modelId,
    async embed(texts, kind) {
      const vectors: Float32Array[] = [];
      for (let at = 0; at < texts.length; at += BATCH) {
        const batch = texts.slice(at, at + BATCH).map((text) => `${kind}: ${text}`);
        const output = await pipe(batch, { pooling: 'mean', normalize: true });
        const dim = output.dims[output.dims.length - 1]!;
        for (let row = 0; row < batch.length; row += 1) {
          const vec = new Float32Array(dim);
          for (let i = 0; i < dim; i += 1) vec[i] = output.data[row * dim + i]!;
          vectors.push(vec);
        }
      }
      return vectors;
    },
  };
}
