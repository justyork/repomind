import { createHash } from 'node:crypto';
import type { DocIndex } from '../index/doc-index.js';
import { chunkDoc } from './chunks.js';
import { readStore, storeFilePath, writeStore, type StoredDoc } from './store.js';
import type { Embedder, SemanticHit, SemanticLookup } from './types.js';

export interface SyncReport {
  totalDocs: number;
  embeddedDocs: number;
  skippedDocs: number;
  removedDocs: number;
  chunks: number;
}

export interface SyncOptions {
  /** Re-embed everything, ignoring cached vectors. */
  force?: boolean;
  /** Called after each embedded doc: (embedded so far, docs to embed). */
  onProgress?: (done: number, total: number) => void;
  batchSize?: number;
}

const DEFAULT_TOP_K = 30;
const QUERY_CACHE_LIMIT = 200;
const SAVE_EVERY_DOCS = 20;

function contentHash(title: string, body: string): string {
  return createHash('sha1').update(title).update('\0').update(body).digest('hex');
}

function dot(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) sum += a[i]! * b[i]!;
  return sum;
}

/** Vector index over page sections, cached on disk in <docs>/.repo-mind/embeddings/. */
export class SemanticIndex implements SemanticLookup {
  private store: Map<string, StoredDoc> | null = null;
  private readonly queryCache = new Map<string, SemanticHit[]>();

  constructor(
    private readonly index: DocIndex,
    private readonly embedder: Embedder,
    private readonly topK: number = DEFAULT_TOP_K,
  ) {}

  private file(): string | null {
    const root = this.index.getKnowledgeRoot();
    return root ? storeFilePath(root, this.embedder.id) : null;
  }

  private load(): Map<string, StoredDoc> {
    if (!this.store) {
      const file = this.file();
      this.store = file ? readStore(file, this.embedder.id) : new Map();
    }
    return this.store;
  }

  private save(): void {
    const file = this.file();
    if (file && this.store) writeStore(file, this.embedder.id, this.store);
  }

  /** Embeds new or changed pages, drops deleted ones, and persists the cache. */
  async sync(options: SyncOptions = {}): Promise<SyncReport> {
    const store = options.force ? new Map<string, StoredDoc>() : this.load();
    if (options.force) this.store = store;
    this.queryCache.clear();

    const docs = this.index.refresh();
    const currentPaths = new Set(docs.map((doc) => doc.relativePath));
    let removedDocs = 0;
    for (const rel of [...store.keys()]) {
      if (!currentPaths.has(rel)) {
        store.delete(rel);
        removedDocs += 1;
      }
    }

    const pending = docs.filter((doc) => {
      const cached = store.get(doc.relativePath);
      return !cached || cached.hash !== contentHash(doc.title, doc.body) || cached.slug !== doc.slug;
    });

    const batchSize = options.batchSize ?? 16;
    let chunkCount = 0;
    let done = 0;
    for (const doc of pending) {
      const chunks = chunkDoc(doc);
      const vectors: Float32Array[] = [];
      for (let at = 0; at < chunks.length; at += batchSize) {
        const batch = chunks.slice(at, at + batchSize).map((chunk) => chunk.text);
        vectors.push(...(await this.embedder.embed(batch, 'passage')));
      }
      store.set(doc.relativePath, {
        slug: doc.slug,
        hash: contentHash(doc.title, doc.body),
        chunks: chunks.map((chunk, i) => ({ section: chunk.section, vec: vectors[i]! })),
      });
      chunkCount += chunks.length;
      done += 1;
      options.onProgress?.(done, pending.length);
      if (done % SAVE_EVERY_DOCS === 0) this.save();
    }

    this.save();
    return {
      totalDocs: docs.length,
      embeddedDocs: pending.length,
      skippedDocs: docs.length - pending.length,
      removedDocs,
      chunks: chunkCount,
    };
  }

  /** Embeds the query so a later sync `lookup` can answer it. */
  async prepare(query: string): Promise<void> {
    const key = query.trim();
    if (!key || this.queryCache.has(key)) return;
    const [vector] = await this.embedder.embed([key], 'query');
    if (!vector) return;

    const best: SemanticHit[] = [];
    for (const doc of this.load().values()) {
      let top: { sim: number; section: string | null } | null = null;
      for (const chunk of doc.chunks) {
        const sim = dot(vector, chunk.vec);
        if (!top || sim > top.sim) top = { sim, section: chunk.section };
      }
      if (top) {
        best.push({ slug: doc.slug, similarity: top.sim, ...(top.section ? { section: top.section } : {}) });
      }
    }
    best.sort((a, b) => b.similarity - a.similarity || a.slug.localeCompare(b.slug));

    if (this.queryCache.size >= QUERY_CACHE_LIMIT) {
      const oldest = this.queryCache.keys().next().value;
      if (oldest !== undefined) this.queryCache.delete(oldest);
    }
    this.queryCache.set(key, best.slice(0, this.topK));
  }

  lookup(query: string): SemanticHit[] | null {
    return this.queryCache.get(query.trim()) ?? null;
  }
}
