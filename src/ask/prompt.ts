import type { AskSource } from './types.js';

export const NOT_FOUND_ANSWER_RU = 'Не нашёл в документации.';
export const NOT_FOUND_ANSWER_EN = 'Not found in the documentation.';

export function buildAskSystemPrompt(hasSources: boolean): string {
  const lines = [
    'You are a helpful documentation assistant for RepoMind.',
    'Answer in a clear, conversational tone.',
    'Reply in the same language as the user question.',
  ];

  if (hasSources) {
    lines.push(
      'Use ONLY the provided source excerpts to answer documentation questions.',
      'Synthesize a helpful explanation for the user — do not dump raw excerpts or bullet lists of sources without explanation.',
      'If the sources do not contain enough information, say clearly that you could not find it in the documentation.',
      'Always cite sources inline using markdown links: [Page Title](?slug=slug-name).',
      'Use the exact slug from each source block.',
      'Do not invent facts, APIs, or pages that are not in the sources.',
    );
  } else {
    lines.push(
      'No documentation excerpts were retrieved for this message.',
      'If the user is greeting you or making small talk, reply briefly and explain that you can answer questions about the project documentation in docs/.',
      'If they asked a documentation question, say you could not find relevant pages and suggest more specific keywords.',
      'Do not invent documentation content.',
    );
  }

  return lines.join(' ');
}

export function buildAskUserPrompt(question: string, sources: AskSource[]): string {
  if (sources.length === 0) {
    return [
      '## Sources',
      '',
      '_No matching documentation pages were retrieved._',
      '',
      '## Question',
      '',
      question.trim(),
    ].join('\n');
  }

  const blocks = sources.map(
    (source) =>
      `### ${source.title} (slug: ${source.slug})\n\n${source.excerpt}`,
  );

  return [
    '## Sources',
    '',
    blocks.join('\n\n---\n\n'),
    '',
    '## Question',
    '',
    question.trim(),
  ].join('\n');
}
