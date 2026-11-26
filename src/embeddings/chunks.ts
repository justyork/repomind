import { parseHeadings, splitFlatSections } from '../search/sections.js';
import type { DocRecord } from '../index/types.js';

export interface Chunk {
  section: string | null;
  /** Text to embed: title and heading context plus a slice of the section. */
  text: string;
}

export interface ChunkOptions {
  maxChars?: number;
  maxChunks?: number;
}

const DEFAULT_MAX_CHARS = 1000;
const DEFAULT_MAX_CHUNKS = 80;

function packParagraphs(content: string, maxChars: number): string[] {
  const pieces: string[] = [];
  let current = '';
  const flush = () => {
    if (current.trim()) pieces.push(current.trim());
    current = '';
  };
  for (const paragraph of content.split(/\n\s*\n/)) {
    if (paragraph.length > maxChars) {
      flush();
      for (let at = 0; at < paragraph.length; at += maxChars) {
        pieces.push(paragraph.slice(at, at + maxChars).trim());
      }
      continue;
    }
    if (current && current.length + paragraph.length + 2 > maxChars) flush();
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  flush();
  return pieces;
}

/** Splits a page into embeddable chunks: one or more per section, always labelled with the title. */
export function chunkDoc(doc: DocRecord, options: ChunkOptions = {}): Chunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const maxChunks = options.maxChunks ?? DEFAULT_MAX_CHUNKS;
  const sections =
    doc.contentKind === 'markdown'
      ? splitFlatSections(doc.body, parseHeadings(doc.body))
      : [{ heading: null as string | null, text: doc.body }];

  const chunks: Chunk[] = [];
  for (const section of sections) {
    const content = section.text.trim();
    // Skip sections that are only a heading line.
    const withoutHeading = section.heading ? content.replace(/^#{1,6}[^\n]*\n?/, '').trim() : content;
    if (!withoutHeading) continue;
    const prefix = section.heading ? `${doc.title} — ${section.heading}\n` : `${doc.title}\n`;
    for (const piece of packParagraphs(content, maxChars)) {
      chunks.push({ section: section.heading, text: prefix + piece });
    }
  }
  return chunks.slice(0, maxChunks);
}
