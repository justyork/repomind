import fs from 'node:fs';
import path from 'node:path';

export interface StoredChunk {
  section: string | null;
  vec: Float32Array;
}

export interface StoredDoc {
  slug: string;
  hash: string;
  chunks: StoredChunk[];
}

interface StoreFile {
  version: 1;
  model: string;
  docs: Record<string, { slug: string; hash: string; chunks: Array<{ section: string | null; vec: string }> }>;
}

export function storeFilePath(knowledgeRoot: string, modelId: string): string {
  const safe = modelId.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return path.join(knowledgeRoot, '.repo-mind', 'embeddings', `${safe}.json`);
}

function encode(vec: Float32Array): string {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength).toString('base64');
}

function decode(text: string): Float32Array {
  const bytes = Buffer.from(text, 'base64');
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Float32Array(copy.buffer);
}

/** Reads cached vectors, keyed by relative doc path. Missing or incompatible files read as empty. */
export function readStore(file: string, modelId: string): Map<string, StoredDoc> {
  const docs = new Map<string, StoredDoc>();
  if (!fs.existsSync(file)) return docs;
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as StoreFile;
    if (parsed.version !== 1 || parsed.model !== modelId) return docs;
    for (const [rel, doc] of Object.entries(parsed.docs)) {
      docs.set(rel, {
        slug: doc.slug,
        hash: doc.hash,
        chunks: doc.chunks.map((chunk) => ({ section: chunk.section, vec: decode(chunk.vec) })),
      });
    }
  } catch {
    return new Map();
  }
  return docs;
}

export function writeStore(file: string, modelId: string, docs: Map<string, StoredDoc>): void {
  const out: StoreFile = { version: 1, model: modelId, docs: {} };
  for (const [rel, doc] of docs) {
    out.docs[rel] = {
      slug: doc.slug,
      hash: doc.hash,
      chunks: doc.chunks.map((chunk) => ({ section: chunk.section, vec: encode(chunk.vec) })),
    };
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(out), 'utf8');
  fs.renameSync(tmp, file);
}
