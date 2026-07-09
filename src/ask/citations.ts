import type { AskSource } from './types.js';

const SLUG_LINK_PATTERN = /\?slug=([^)\s"&]+)/gi;

/** Extracts slug values from markdown links using ?slug= query params. */
export function extractCitedSlugs(markdown: string): string[] {
  const slugs = new Set<string>();
  for (const match of markdown.matchAll(SLUG_LINK_PATTERN)) {
    const raw = match[1];
    if (!raw) {
      continue;
    }
    try {
      slugs.add(decodeURIComponent(raw));
    } catch {
      slugs.add(raw);
    }
  }
  return [...slugs];
}

export function hasCitationForSources(answer: string, sources: AskSource[]): boolean {
  if (sources.length === 0) {
    return true;
  }
  const cited = new Set(extractCitedSlugs(answer));
  return sources.some((source) => cited.has(source.slug));
}

export function appendSourcesBlock(answer: string, sources: AskSource[]): string {
  if (sources.length === 0) {
    return answer;
  }

  const trimmed = answer.trimEnd();
  const links = sources.map((source) => `- [${source.title}](?slug=${encodeURIComponent(source.slug)})`);
  const block = ['', '## Sources', '', ...links].join('\n');
  return `${trimmed}${block}`;
}

export function ensureCitations(answer: string, sources: AskSource[]): string {
  if (hasCitationForSources(answer, sources)) {
    return answer;
  }
  return appendSourcesBlock(answer, sources);
}
