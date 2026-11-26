export const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'what',
  'how',
  'why',
  'when',
  'where',
  'who',
  'which',
  'do',
  'does',
  'did',
  'can',
  'could',
  'should',
  'would',
  'will',
  'to',
  'of',
  'in',
  'on',
  'at',
  'for',
  'and',
  'or',
  'but',
  'not',
  'with',
  'about',
  'from',
  'into',
  'me',
  'my',
  'i',
  'you',
  'your',
  'we',
  'our',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'there',
  'tell',
  'please',
  'explain',
  'describe',
  'как',
  'что',
  'где',
  'когда',
  'почему',
  'кто',
  'какой',
  'какая',
  'какие',
  'какое',
  'каков',
  'какова',
  'каково',
  'это',
  'этот',
  'эта',
  'эти',
  'тот',
  'та',
  'те',
  'в',
  'во',
  'на',
  'с',
  'со',
  'по',
  'для',
  'из',
  'у',
  'о',
  'об',
  'от',
  'до',
  'при',
  'про',
  'над',
  'под',
  'и',
  'или',
  'не',
  'ни',
  'ли',
  'же',
  'бы',
  'мне',
  'меня',
  'мой',
  'моя',
  'мои',
  'твой',
  'твоя',
  'твои',
  'наш',
  'наша',
  'наши',
  'расскажи',
  'рассказать',
  'объясни',
  'объяснить',
  'покажи',
  'показать',
  'найди',
  'найти',
  'есть',
  'быть',
  'был',
  'была',
  'были',
]);

export const TERM_PATTERN = /[a-z0-9\u0400-\u04ff]+/gi;

function uniqueTerms(terms: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const term of terms) {
    const normalized = term.toLowerCase();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

/** Extracts meaningful search terms from a natural-language question. */
export function extractAskSearchTerms(question: string): string[] {
  const raw = question.match(TERM_PATTERN) ?? [];
  const meaningful = raw.filter((term) => term.length >= 3 && !STOP_WORDS.has(term.toLowerCase()));
  if (meaningful.length > 0) {
    return uniqueTerms(meaningful);
  }

  return uniqueTerms(raw.filter((term) => term.length >= 2 && !STOP_WORDS.has(term.toLowerCase())));
}

/** Splits a raw query into lowercase word tokens (letters/digits, latin + cyrillic). */
export function tokenizeWords(text: string): string[] {
  return (text.toLowerCase().match(TERM_PATTERN) ?? []).filter(Boolean);
}

/**
 * Cheap prefix "stem": long words lose their last 1-2 chars so simple inflections
 * (session/sessions, сохранение/сохранения) share a prefix.
 */
export function stemPrefix(word: string): string {
  if (word.length >= 7) return word.slice(0, word.length - 2);
  if (word.length >= 5) return word.slice(0, word.length - 1);
  return word;
}

/** True when any word in `words` starts with the stem of `term`. */
export function wordsMatchTerm(words: string[], term: string): boolean {
  const stem = stemPrefix(term);
  return words.some((word) => word.startsWith(stem));
}
