import type { DocIndex } from '../index/doc-index.js';
import { listDocs } from '../tools/list-docs.js';
import { extractAskSearchTerms, searchDocsWithOrTerms } from './search.js';

export interface AskSuggestion {
  slug: string;
  title: string;
}

const MAX_STARTERS = 5;
const MAX_ALTERNATIVES = 4;

function isCyrillic(text: string): boolean {
  return /[\u0400-\u04ff]/.test(text);
}

export function formatSuggestionLink(suggestion: AskSuggestion): string {
  return `[${suggestion.title}](?slug=${encodeURIComponent(suggestion.slug)})`;
}

/** Picks onboarding pages (readme, roadmap, wiki) from the live index. */
export function pickStarterPages(index: DocIndex): AskSuggestion[] {
  const docs = listDocs(index);
  const scored: Array<AskSuggestion & { score: number }> = [];

  for (const doc of docs) {
    let score = 0;
    const slugLower = doc.slug.toLowerCase();
    const titleLower = doc.title.toLowerCase();
    const pathLower = doc.relativePath.toLowerCase();

    if (slugLower === 'readme' || pathLower === 'readme.md') {
      score += 100;
    }
    if (pathLower.endsWith('/readme.md') || slugLower.endsWith('-readme')) {
      score += 80;
    }
    if (slugLower.includes('roadmap') || titleLower.includes('roadmap')) {
      score += 70;
    }
    if (doc.type === 'wiki-page') {
      score += 20;
    }
    if (slugLower.includes('wiki') || titleLower.includes('wiki')) {
      score += 15;
    }
    if (doc.domain === 'product') {
      score += 10;
    }

    if (score > 0) {
      scored.push({ slug: doc.slug, title: doc.title, score });
    }
  }

  return scored
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, MAX_STARTERS)
    .map(({ slug, title }) => ({ slug, title }));
}

function scorePartialTermMatch(slugLower: string, titleLower: string, term: string): number {
  if (term.length < 3) {
    return 0;
  }

  let score = 0;
  if (slugLower.includes(term)) {
    score += 3;
  }
  if (titleLower.includes(term)) {
    score += 2;
  }

  const words = [...slugLower.split(/[-_/]/), ...titleLower.split(/\s+/)].filter(Boolean);
  if (words.some((word) => word.startsWith(term) || (word.length >= 3 && term.startsWith(word)))) {
    score += 1;
  }

  return score;
}

/** Suggests pages when retrieval found nothing — looser than ask search. */
export function suggestAlternativePages(index: DocIndex, question: string): AskSuggestion[] {
  const terms = extractAskSearchTerms(question);
  const bySlug = new Map<string, AskSuggestion & { score: number }>();

  function add(slug: string, title: string, score: number): void {
    const existing = bySlug.get(slug);
    if (!existing || score > existing.score) {
      bySlug.set(slug, { slug, title, score });
    }
  }

  for (const term of terms) {
    for (const hit of searchDocsWithOrTerms(index, [term])) {
      add(hit.slug, hit.title, hit.score);
    }
  }

  for (const doc of listDocs(index)) {
    const slugLower = doc.slug.toLowerCase();
    const titleLower = doc.title.toLowerCase();
    for (const term of terms) {
      const score = scorePartialTermMatch(slugLower, titleLower, term);
      if (score > 0) {
        add(doc.slug, doc.title, score);
      }
    }
  }

  return [...bySlug.values()]
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, MAX_ALTERNATIVES)
    .map(({ slug, title }) => ({ slug, title }));
}

function formatStarterSection(starters: AskSuggestion[], ru: boolean): string[] {
  if (starters.length === 0) {
    return [];
  }

  return [
    ru ? 'С чего начать:' : 'Where to start:',
    ...starters.map((page) => `- ${formatSuggestionLink(page)}`),
    '',
  ];
}

function formatExamplePrompt(exampleTitle: string | undefined, ru: boolean): string {
  if (exampleTitle) {
    return ru
      ? `Спросите что-то конкретное — например: «что в ${exampleTitle.toLowerCase()}?»`
      : `Ask something specific — for example: "what is in ${exampleTitle.toLowerCase()}?"`;
  }

  return ru
    ? 'Спросите что-то конкретное — укажите ключевое слово из названия страницы или тему.'
    : 'Ask something specific — use a keyword from a page title or a topic you care about.';
}

export function buildAskGreetingReply(index: DocIndex, question: string): string {
  const ru = isCyrillic(question);
  const starters = pickStarterPages(index);
  const exampleTitle = starters[0]?.title;

  const lines = ru
    ? ['Привет! Я помощник по документации RepoMind.', '']
    : ['Hello! I am the RepoMind documentation assistant.', ''];

  lines.push(...formatStarterSection(starters, ru));
  lines.push(formatExamplePrompt(exampleTitle, ru));

  return lines.join('\n');
}

export function buildAskNotFoundReply(index: DocIndex, question: string): string {
  const ru = isCyrillic(question);
  const alternatives = suggestAlternativePages(index, question);
  const starters = pickStarterPages(index);
  const trimmed = question.trim();

  const lines = ru
    ? [`Не нашёл страниц по запросу «${trimmed}».`, '']
    : [`No pages matched your question "${trimmed}".`, ''];

  if (alternatives.length > 0) {
    lines.push(ru ? 'Возможно, вы искали:' : 'Perhaps you were looking for:');
    for (const page of alternatives) {
      lines.push(`- ${formatSuggestionLink(page)}`);
    }
    lines.push('');
  } else if (starters.length > 0) {
    lines.push(...formatStarterSection(starters, ru));
  }

  lines.push(formatExamplePrompt(alternatives[0]?.title ?? starters[0]?.title, ru));

  return lines.join('\n');
}
