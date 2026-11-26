import { tokenizeWords } from './terms.js';

export interface DocHeading {
  level: number;
  heading: string;
}

export interface ParsedHeading extends DocHeading {
  line: number;
}

export interface FlatSection {
  /** null for the intro text before the first heading. */
  heading: string | null;
  text: string;
}

const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const FENCE_PATTERN = /^\s*(```|~~~)/;

/** Parses ATX headings, ignoring anything inside fenced code blocks. */
export function parseHeadings(body: string): ParsedHeading[] {
  const headings: ParsedHeading[] = [];
  let inFence = false;
  body.split('\n').forEach((text, line) => {
    if (FENCE_PATTERN.test(text)) {
      inFence = !inFence;
      return;
    }
    if (inFence) {
      return;
    }
    const match = HEADING_PATTERN.exec(text);
    if (match) {
      headings.push({ level: match[1]!.length, heading: match[2]!.trim(), line });
    }
  });
  return headings;
}

export function kebab(text: string): string {
  return tokenizeWords(text).join('-');
}

/** Section by heading text (or its kebab form), including all deeper subsections. */
export function extractSection(
  body: string,
  headings: ParsedHeading[],
  wanted: string,
): { heading: string; text: string } | null {
  const needle = wanted.trim().toLowerCase();
  const needleKebab = kebab(wanted);
  const index = headings.findIndex(
    (h) => h.heading.toLowerCase() === needle || kebab(h.heading) === needleKebab,
  );
  if (index < 0) {
    return null;
  }
  const start = headings[index]!;
  const next = headings.slice(index + 1).find((h) => h.level <= start.level);
  const lines = body.split('\n');
  const text = lines.slice(start.line, next ? next.line : lines.length).join('\n').trim();
  return { heading: start.heading, text };
}

/** Non-overlapping sections: intro, then one per heading (up to the next heading of any level). */
export function splitFlatSections(body: string, headings: ParsedHeading[]): FlatSection[] {
  const lines = body.split('\n');
  const sections: FlatSection[] = [];
  const firstLine = headings.length > 0 ? headings[0]!.line : lines.length;
  sections.push({ heading: null, text: lines.slice(0, firstLine).join('\n').trim() });
  headings.forEach((heading, i) => {
    const end = i + 1 < headings.length ? headings[i + 1]!.line : lines.length;
    sections.push({ heading: heading.heading, text: lines.slice(heading.line, end).join('\n').trim() });
  });
  return sections;
}
