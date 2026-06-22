export function readmeRelativePath(folderRelativePath: string): string {
  const base = folderRelativePath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  return base ? `${base}/README.md` : 'README.md';
}

export function parseSlugFromHref(href: string): string | null {
  if (!href) {
    return null;
  }

  if (href.startsWith('?slug=') || href.startsWith('/?slug=')) {
    const query = href.includes('?') ? href.slice(href.indexOf('?')) : href;
    const slug = new URLSearchParams(query).get('slug');
    return slug?.trim() || null;
  }

  try {
    const url = new URL(href, 'http://local');
    const slug = url.searchParams.get('slug');
    return slug?.trim() || null;
  } catch {
    return null;
  }
}

function stripLinkSuffix(href: string): string {
  return href.split('#')[0]?.split('?')[0]?.trim() ?? '';
}

function normalizeMdPath(relative: string): string {
  const normalized = relative.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalized) {
    return '';
  }
  return normalized.toLowerCase().endsWith('.md') ? normalized : `${normalized}.md`;
}

/** Resolves a markdown href relative to the current doc path under docs/. */
export function resolveMarkdownHref(
  fromDocRelative: string,
  href: string,
): string | null {
  const pathPart = stripLinkSuffix(href);
  if (!pathPart || pathPart.startsWith('http://') || pathPart.startsWith('https://')) {
    return null;
  }
  if (pathPart.startsWith('mailto:') || pathPart.startsWith('#')) {
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

  return normalizeMdPath(stack.join('/'));
}

/** Resolves href as path under docs/ root (e.g. `docs/README.md`, `/adr/foo.md`). */
export function resolveDocsKnowledgeHref(href: string): string | null {
  let pathPart = stripLinkSuffix(href).replace(/\\/g, '/');
  if (!pathPart || pathPart.startsWith('http://') || pathPart.startsWith('https://')) {
    return null;
  }
  if (pathPart.startsWith('mailto:') || pathPart.startsWith('#')) {
    return null;
  }
  if (pathPart.startsWith('/')) {
    pathPart = pathPart.slice(1);
  }
  if (pathPart.startsWith('docs/')) {
    pathPart = pathPart.slice(5);
  }
  if (!pathPart) {
    return null;
  }
  return normalizeMdPath(pathPart);
}

function lookupSlugByRelative(
  relativePath: string,
  slugByRelative: Map<string, string>,
): string | null {
  const direct = slugByRelative.get(relativePath);
  if (direct) {
    return direct;
  }
  const lower = relativePath.toLowerCase();
  for (const [key, slug] of slugByRelative.entries()) {
    if (key.toLowerCase() === lower) {
      return slug;
    }
  }
  return null;
}

export function slugForMarkdownHref(
  fromDocRelative: string,
  href: string,
  slugByRelative: Map<string, string>,
): string | null {
  const fromQuery = parseSlugFromHref(href);
  if (fromQuery) {
    for (const slug of slugByRelative.values()) {
      if (slug === fromQuery) {
        return fromQuery;
      }
    }
    return null;
  }

  const candidates = [
    resolveMarkdownHref(fromDocRelative, href),
    resolveDocsKnowledgeHref(href),
  ].filter((value): value is string => Boolean(value));

  for (const resolved of candidates) {
    const slug = lookupSlugByRelative(resolved, slugByRelative);
    if (slug) {
      return slug;
    }
  }

  return null;
}
