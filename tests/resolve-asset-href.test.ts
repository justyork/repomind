import { describe, expect, it } from 'vitest';
import { assetApiPath, isImageFileName } from '../src/index/asset-file.ts';
import { resolveAssetRelativePath } from '../src/index/resolve-asset-href.ts';

describe('asset-file', () => {
  it('detects image extensions', () => {
    expect(isImageFileName('assets/logo.png')).toBe(true);
    expect(isImageFileName('readme.md')).toBe(false);
  });

  it('builds encoded asset API paths', () => {
    expect(assetApiPath('assets/my image.png')).toBe('/api/assets/assets/my%20image.png');
  });
});

describe('resolveAssetRelativePath', () => {
  it('resolves sibling and parent-relative image paths', () => {
    expect(resolveAssetRelativePath('specs/feature.md', '../assets/diagram.png')).toBe(
      'assets/diagram.png',
    );
    expect(resolveAssetRelativePath('specs/feature.md', 'screenshot.png')).toBe(
      'specs/screenshot.png',
    );
  });

  it('resolves docs-root image paths', () => {
    expect(resolveAssetRelativePath('specs/feature.md', 'docs/assets/logo.svg')).toBe(
      'assets/logo.svg',
    );
  });

  it('ignores external URLs', () => {
    expect(resolveAssetRelativePath('specs/feature.md', 'https://example.com/a.png')).toBeNull();
  });
});
