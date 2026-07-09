import { describe, expect, it } from 'vitest';
import { isAskSmallTalk } from '../src/ask/small-talk.ts';

describe('ask small talk', () => {
  it('detects greetings', () => {
    expect(isAskSmallTalk('привет')).toBe(true);
    expect(isAskSmallTalk('Hello!')).toBe(true);
    expect(isAskSmallTalk('hi there')).toBe(false);
  });
});
