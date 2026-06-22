import { isImageFileName } from './asset-file.js';

function stripLinkSuffix(href: string): string {
  return href.split('#')[0]?.split('?')[0]?.trim() ?? '';
}

function isExternalHref(href: string): boolean {
  return (
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('#') ||
    href.startsWith('data:')
  );
}

function resolveRelativePath(fromDocRelative: string, href: string): string | null {
  const pathPart = stripLinkSuffix(href);
  if (!pathPart || isExternalHref(pathPart)) {
    return null;
  }

  const fromDir = fromDocRelative.includes('/')
    ? fromDocRelative.slice(0, fromDocRelative.lastIndexOf('/'))
    : '';

  const segments = pathPart.replace(/\\/g, '/').split('/');
  const stack = fromDir ? fromDir.split('/') : [];

  for (const segment of segments) {
    if (!segment || segment === '.') {
      continue;
    }
    if (segment === '..') {
      if (stack.length === 0) {
        return null;
      }
      stack.pop();
      continue;
    }
    stack.push(segment);
  }

  const resolved = stack.join('/');
  return resolved || null;
}

function resolveDocsRootPath(href: string): string | null {
  let pathPart = stripLinkSuffix(href).replace(/\\/g, '/');
  if (!pathPart || isExternalHref(pathPart) || pathPart.split('/').includes('..')) {
    return null;
  }
  if (!pathPart.startsWith('/') && !pathPart.startsWith('docs/')) {
    return null;
  }
  if (pathPart.startsWith('/')) {
    pathPart = pathPart.slice(1);
  }
  if (pathPart.startsWith('docs/')) {
    pathPart = pathPart.slice(5);
  }
  return pathPart || null;
}

/** Resolves an image/asset href to a path relative to the docs root. */
export function resolveAssetRelativePath(fromDocRelative: string, href: string): string | null {
  const docsRoot = resolveDocsRootPath(href);
  if (docsRoot && isImageFileName(docsRoot)) {
    return docsRoot;
  }

  const relative = resolveRelativePath(fromDocRelative, href);
  if (relative && isImageFileName(relative)) {
    return relative;
  }

  return null;
}
