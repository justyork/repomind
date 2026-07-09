import { afterEach, describe, expect, it } from 'vitest';
import { getAskServerConfig, resolveAskApiKey } from '../src/ask/config.ts';

afterEach(() => {
  delete process.env.REPOMIND_ASK_API_KEY;
  delete process.env.REPOMIND_ASK_PROVIDER;
  delete process.env.REPOMIND_ASK_MODEL;
});

describe('ask config', () => {
  it('reports server configuration without exposing the key', () => {
    process.env.REPOMIND_ASK_API_KEY = 'secret-key';
    process.env.REPOMIND_ASK_PROVIDER = 'anthropic';
    process.env.REPOMIND_ASK_MODEL = 'claude-test';

    expect(getAskServerConfig()).toEqual({
      serverConfigured: true,
      provider: 'anthropic',
      model: 'claude-test',
    });
  });

  it('prefers server env key over request key', () => {
    process.env.REPOMIND_ASK_API_KEY = 'from-env';
    expect(resolveAskApiKey('from-browser')).toBe('from-env');
  });

  it('falls back to request key when env is missing', () => {
    expect(resolveAskApiKey('from-browser')).toBe('from-browser');
  });
});
