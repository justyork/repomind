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
  'такое',
  'такой',
  'такая',
  'такие',
  'используется',
  'используются',
  'использует',
  'каком',
  'какого',
  'какому',
  'каким',
  'описан',
  'описана',
  'описаны',
  'устроен',
  'устроена',
  'реализован',
  'реализована',
  'только',
  'зачем',
  'нужен',
  'нужна',
  'нужно',
  'нужны',
  'сколько',
  'можно',
  'нельзя',
  'также',
  'который',
  'которая',
  'которые',
  'этом',
  'этого',
  'обычном',
  'новых',
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
 * Cheap prefix "stem": long Latin words lose their last 1-2 chars so simple inflections
 * (session/sessions) share a prefix.
 */
export function stemPrefix(word: string): string {
  if (word.length >= 7) return word.slice(0, word.length - 2);
  if (word.length >= 5) return word.slice(0, word.length - 1);
  return word;
}

const CYRILLIC = /[а-яё]/;
// Longest first. A suffix is only stripped when at least 4 letters remain.
const RU_SUFFIXES = [
  'ами', 'ями', 'ого', 'его', 'ому', 'ему', 'ыми', 'ими', 'ать', 'ять', 'ить',
  'ей', 'ий', 'ый', 'ой', 'ая', 'яя', 'ое', 'ее', 'ые', 'ие', 'ую', 'юю', 'ом', 'ем', 'им', 'ым',
  'ов', 'ев', 'ах', 'ях', 'ам', 'ям', 'ут', 'ют', 'ет', 'ит',
  'у', 'ю', 'а', 'я', 'о', 'е', 'ы', 'и', 'ь',
];

/** Language-aware stem: light suffix stripping for Russian, prefix reduction for Latin. */
export function stemWord(word: string): string {
  const lower = word.toLowerCase().replace(/ё/g, 'е');
  if (CYRILLIC.test(lower)) {
    if (lower.length < 5) return lower;
    for (const suffix of RU_SUFFIXES) {
      if (lower.endsWith(suffix) && lower.length - suffix.length >= 4) {
        return lower.slice(0, lower.length - suffix.length);
      }
    }
    return lower;
  }
  return stemPrefix(lower);
}

/** Two stems match when the shorter (>= 3 chars) is a prefix of the longer. */
export function stemsCompatible(a: string, b: string): boolean {
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 3 && long.startsWith(short);
}

/** True when any word in `words` shares a stem with `term`. */
export function wordsMatchTerm(words: string[], term: string): boolean {
  const stem = stemWord(term);
  return words.some((word) => stemsCompatible(stemWord(word), stem));
}
