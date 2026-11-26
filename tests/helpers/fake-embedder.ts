import type { Embedder } from '../../src/embeddings/types.ts';

// Concept groups: words in one group embed to the same axis, across languages.
const GROUPS: string[][] = [
  ['knowledge', 'знания', 'знаний', 'knowledge-base'],
  ['markdown', 'маркдаун'],
  ['database', 'базе', 'данных', 'db'],
  ['stack', 'стек', 'framework', 'frontend', 'фронтенде', 'backend', 'бэкенде'],
  ['fuel', 'топливо', 'топлива', 'топливный', 'бак', 'tank'],
  ['market', 'рынок', 'товары'],
  ['caravan', 'караван'],
];
const DIM = GROUPS.length + 1;

function vectorFor(text: string): Float32Array {
  const vec = new Float32Array(DIM);
  const words = text.toLowerCase().match(/[a-zа-яё0-9-]+/g) ?? [];
  for (const word of words) {
    const axis = GROUPS.findIndex((group) => group.some((g) => word.startsWith(g.slice(0, 5))));
    if (axis >= 0) vec[axis] += 1;
  }
  vec[DIM - 1] = 0.01; // never an all-zero vector
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  return vec.map((v) => v / norm) as Float32Array;
}

export interface FakeEmbedder extends Embedder {
  calls: Array<{ kind: 'query' | 'passage'; count: number }>;
}

export function createFakeEmbedder(id = 'fake-concepts'): FakeEmbedder {
  const calls: FakeEmbedder['calls'] = [];
  return {
    id,
    calls,
    async embed(texts, kind) {
      calls.push({ kind, count: texts.length });
      return texts.map(vectorFor);
    },
  };
}
