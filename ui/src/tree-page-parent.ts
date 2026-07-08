import { promoteFsPage, type TreePageNode } from './api.js';

export function createParentPathForPage(page: TreePageNode): string {
  const rel = page.relativePath.replace(/\\/g, '/');
  if (rel === 'README.md') {
    return '';
  }

  const slash = rel.lastIndexOf('/');
  const fileName = slash === -1 ? rel : rel.slice(slash + 1);
  const parentDir = slash === -1 ? '' : rel.slice(0, slash);

  if (fileName.toLowerCase() === 'readme.md') {
    return parentDir;
  }

  const baseName = fileName.replace(/\.(md|ya?ml|json)$/i, '');
  return parentDir ? `${parentDir}/${baseName}` : baseName;
}

export function pageNeedsPromote(page: TreePageNode): boolean {
  const rel = page.relativePath.replace(/\\/g, '/');
  if (rel === 'README.md') {
    return false;
  }

  const fileName = rel.includes('/') ? rel.slice(rel.lastIndexOf('/') + 1) : rel;
  return fileName.toLowerCase() !== 'readme.md';
}

export async function resolveCreateParentForPage(
  page: TreePageNode,
  handlers: {
    onTreeChanged?: () => void;
    onError?: (message: string) => void;
    onExpandFolder?: (folderPath: string) => void;
  },
): Promise<string | null> {
  if (!pageNeedsPromote(page)) {
    return createParentPathForPage(page);
  }

  try {
    const { result } = await promoteFsPage(page.relativePath);
    handlers.onTreeChanged?.();
    handlers.onExpandFolder?.(result.folderPath);
    return result.folderPath;
  } catch (err: unknown) {
    handlers.onError?.(err instanceof Error ? err.message : 'Promote page failed');
    return null;
  }
}
