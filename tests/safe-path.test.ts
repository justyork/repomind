import { describe, expect, it } from 'vitest';
import {
  isValidFsName,
  joinRelativePath,
  resolveRelativeMdPath,
  resolveUnderKnowledgeRoot,
} from '../src/ui/safe-path.ts';

describe('safe-path', () => {
  const root = '/tmp/repo/docs';

  it('rejects path traversal', () => {
    expect(resolveUnderKnowledgeRoot(root, '../secret')).toBeNull();
    expect(resolveUnderKnowledgeRoot(root, 'architecture/../../etc/passwd')).toBeNull();
  });

  it('resolves markdown paths under docs root', () => {
    expect(resolveRelativeMdPath(root, 'architecture/overview.md')).toBe(
      '/tmp/repo/docs/architecture/overview.md',
    );
    expect(resolveRelativeMdPath(root, 'architecture/overview')).toBe(
      '/tmp/repo/docs/architecture/overview.md',
    );
  });

  it('validates folder and page names', () => {
    expect(isValidFsName('architecture')).toBe(true);
    expect(isValidFsName('../x')).toBe(false);
    expect(isValidFsName('.repo-mind')).toBe(false);
  });

  it('joins relative paths safely', () => {
    expect(joinRelativePath('architecture', 'network')).toBe('architecture/network');
    expect(joinRelativePath('', 'README.md')).toBe('README.md');
  });
});
