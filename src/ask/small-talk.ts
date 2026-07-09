const SMALL_TALK_TERMS = new Set([
  'привет',
  'здравствуй',
  'здравствуйте',
  'приветствую',
  'hello',
  'hi',
  'hey',
  'yo',
  'thanks',
  'thank',
  'thx',
  'спасибо',
  'благодарю',
  'пока',
  'bye',
  'goodbye',
]);

/** Detects short greetings or small talk that should not trigger doc-not-found. */
export function isAskSmallTalk(question: string): boolean {
  const normalized = question
    .trim()
    .toLowerCase()
    .replace(/[!?.…,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return false;
  }

  const words = normalized.split(' ').filter(Boolean);
  if (words.length === 0 || words.length > 4) {
    return false;
  }

  return words.every((word) => SMALL_TALK_TERMS.has(word));
}

