import { describe, expect, it } from 'vitest';
import { extractAskSearchTerms, stemWord, stemsCompatible } from '../src/search/terms.ts';

describe('search terms', () => {
  it('drops Russian question filler words', () => {
    expect(extractAskSearchTerms('Что такое топливный бак?')).toEqual(['топливный', 'бак']);
    expect(extractAskSearchTerms('Какой стек используется и в каком документе он описан?')).toEqual(['стек', 'документе']);
  });

  it('unifies common Russian inflections', () => {
    expect(stemsCompatible(stemWord('топливный'), stemWord('топлива'))).toBe(true);
    expect(stemsCompatible(stemWord('рейсы'), stemWord('рейсов'))).toBe(true);
    expect(stemsCompatible(stemWord('сохранение'), stemWord('сохранения'))).toBe(true);
  });

  it('keeps unrelated words apart', () => {
    expect(stemsCompatible(stemWord('art'), stemWord('start'))).toBe(false);
    expect(stemsCompatible(stemWord('бак'), stemWord('банк'))).toBe(false);
    expect(stemsCompatible(stemWord('рынок'), stemWord('рейс'))).toBe(false);
  });

  it('still unifies simple English inflections', () => {
    expect(stemsCompatible(stemWord('sessions'), stemWord('session'))).toBe(true);
    expect(stemsCompatible(stemWord('cache'), stemWord('cached'))).toBe(true);
  });
});
