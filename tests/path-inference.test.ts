import { describe, expect, it } from 'vitest';
import {
  domainFromPath,
  inferDomainFromRelative,
  inferTypeFromRelative,
  resolveDomain,
} from '../src/index/path-inference.js';

describe('path-inference', () => {
  describe('inferTypeFromRelative', () => {
    it('resolves type from flat legacy path', () => {
      expect(inferTypeFromRelative('adr/use-plain-markdown.md')).toBe('adr');
      expect(inferTypeFromRelative('specs/user-auth.md')).toBe('feature-spec');
    });

    it('resolves type from domain-nested path', () => {
      expect(inferTypeFromRelative('technical/adr/use-plain-markdown.md')).toBe('adr');
      expect(inferTypeFromRelative('game-design/specs/combat-system.md')).toBe('feature-spec');
      expect(inferTypeFromRelative('shared/agents/query-first.md')).toBe('agent-instruction');
    });

    it('defaults to wiki-page when no type folder in path', () => {
      expect(inferTypeFromRelative('product/README.md')).toBe('wiki-page');
      expect(inferTypeFromRelative('wiki/notes.md')).toBe('wiki-page');
    });
  });

  describe('inferDomainFromRelative', () => {
    it('reads domain from first segment', () => {
      expect(inferDomainFromRelative('product/specs/foo.md')).toBe('product');
      expect(inferDomainFromRelative('game-design/specs/combat-system.md')).toBe('game-design');
      expect(inferDomainFromRelative('analytics/specs/events.md')).toBe('analytics');
    });

    it('returns shared for flat legacy paths', () => {
      expect(inferDomainFromRelative('adr/foo.md')).toBe('shared');
      expect(inferDomainFromRelative('specs/foo.md')).toBe('shared');
    });
  });

  describe('resolveDomain', () => {
    it('prefers explicit frontmatter domain', () => {
      expect(resolveDomain('technical/adr/foo.md', 'product')).toBe('product');
    });

    it('falls back to path inference', () => {
      expect(resolveDomain('technical/adr/foo.md', undefined)).toBe('technical');
    });
  });

  describe('domainFromPath', () => {
    it('matches inferDomainFromRelative', () => {
      expect(domainFromPath('narrative/wiki/lore.md')).toBe('narrative');
    });
  });
});
