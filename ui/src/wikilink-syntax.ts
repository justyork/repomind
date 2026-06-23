/** Shared wikilink pattern for markdown body, editor, and reader. */
export const WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export interface ParsedWikilink {
  display: string;
  slug: string;
}

export function parseWikilinkMatch(displayPart: string, slugPart?: string): ParsedWikilink {
  const display = displayPart.trim();
  const slug = (slugPart?.trim() || display).trim();
  return { display, slug };
}

export function formatWikilink(display: string, slug?: string): string {
  const d = display.trim();
  const s = (slug ?? d).trim();
  if (s === d) {
    return `[[${d}]]`;
  }
  return `[[${d}|${s}]]`;
}

export function extractWikilinkTargets(body: string): string[] {
  const targets: string[] = [];
  for (const match of body.matchAll(WIKILINK_PATTERN)) {
    const { slug } = parseWikilinkMatch(match[1] ?? '', match[2]);
    if (slug) {
      targets.push(slug);
    }
  }
  return targets;
}
