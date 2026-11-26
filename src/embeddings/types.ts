/** Turns texts into L2-normalised vectors. "query"/"passage" follow the e5 prefix convention. */
export interface Embedder {
  readonly id: string;
  embed(texts: string[], kind: 'query' | 'passage'): Promise<Float32Array[]>;
}

export interface SemanticHit {
  slug: string;
  /** Heading of the best-matching section, when the page has headings. */
  section?: string;
  /** Cosine similarity of the best chunk. */
  similarity: number;
}

/**
 * What search needs from a semantic index. `prepare` is async (it embeds the query);
 * `lookup` is sync and only answers for queries that were prepared first.
 */
export interface SemanticLookup {
  prepare(query: string): Promise<void>;
  lookup(query: string): SemanticHit[] | null;
}
