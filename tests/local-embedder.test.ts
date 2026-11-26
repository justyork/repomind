import { describe, expect, it } from 'vitest';
import { loadLocalEmbedder, LOCAL_MODEL_ID } from '../src/embeddings/local-embedder.ts';

describe('loadLocalEmbedder', () => {
  it('returns null when the optional dependency is not installed', async () => {
    const embedder = await loadLocalEmbedder({
      importer: async () => {
        throw new Error('Cannot find package');
      },
    });
    expect(embedder).toBeNull();
  });

  it('uses REPOMIND_EMBEDDING_MODEL when set', async () => {
    process.env.REPOMIND_EMBEDDING_MODEL = 'Xenova/multilingual-e5-base';
    try {
      let requested = '';
      const embedder = await loadLocalEmbedder({
        importer: async () => ({
          pipeline: async (_task: string, model: string) => {
            requested = model;
            return async (texts: string[]) => ({ dims: [texts.length, 1], data: new Float32Array(texts.length) });
          },
        }),
      });
      expect(requested).toBe('Xenova/multilingual-e5-base');
      expect(embedder?.id).toBe('Xenova/multilingual-e5-base');
    } finally {
      delete process.env.REPOMIND_EMBEDDING_MODEL;
    }
  });

  it('prefixes inputs by kind and splits the batch output', async () => {
    const seen: string[][] = [];
    const embedder = await loadLocalEmbedder({
      importer: async () => ({
        pipeline: async () => async (texts: string[]) => {
          seen.push(texts);
          return { dims: [texts.length, 2], data: new Float32Array(texts.flatMap((_, i) => [i, i + 0.5])) };
        },
      }),
    });
    expect(embedder?.id).toBe(LOCAL_MODEL_ID);
    const vectors = await embedder!.embed(['a', 'b'], 'passage');
    await embedder!.embed(['q'], 'query');
    expect(seen[0]).toEqual(['passage: a', 'passage: b']);
    expect(seen[1]).toEqual(['query: q']);
    expect(vectors).toHaveLength(2);
    expect(Array.from(vectors[1]!)).toEqual([1, 1.5]);
  });
});
