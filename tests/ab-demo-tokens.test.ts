import { describe, expect, it } from 'vitest';
import { estimateTokens } from '../src/ab-demo/estimate-tokens.js';
import { mcpToolSchemaTokenEstimate } from '../src/ab-demo/session-overhead.js';

describe('ab-demo token helpers', () => {
  it('estimateTokens rounds up by character length', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('abcde')).toBe(2);
  });

  it('mcpToolSchemaTokenEstimate returns a positive budget', () => {
    expect(mcpToolSchemaTokenEstimate()).toBeGreaterThan(100);
  });
});
