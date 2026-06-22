const SLUG_PARAM = 'slug';
const PATH_PARAM = 'path';

export function readSlugFromUrl(): string | null {
  const slug = new URLSearchParams(window.location.search).get(SLUG_PARAM);
  return slug?.trim() ? slug.trim() : null;
}

export function readPathFromUrl(): string | null {
  const relativePath = new URLSearchParams(window.location.search).get(PATH_PARAM);
  return relativePath?.trim() ? relativePath.trim().replace(/\\/g, '/') : null;
}

/** SPA lives at `/`; strip accidental path segments from relative link navigation. */
export function normalizeAppUrl(): void {
  const url = new URL(window.location.href);
  const pathname = url.pathname;
  if (pathname === '/' || pathname === '/index.html') {
    return;
  }

  const slug = readSlugFromUrl();
  url.pathname = '/';
  history.replaceState(slug ? { slug } : {}, '', url);
}

function appRootUrl(): URL {
  const url = new URL(window.location.href);
  url.pathname = '/';
  return url;
}

export function buildPageUrl(slug: string): string {
  const url = appRootUrl();
  url.search = '';
  url.searchParams.set(SLUG_PARAM, slug);
  return url.toString();
}

export function writeSlugToUrl(slug: string, mode: 'push' | 'replace' = 'push'): void {
  const url = appRootUrl();
  url.searchParams.delete(PATH_PARAM);
  url.searchParams.set(SLUG_PARAM, slug);
  const state = { slug };
  if (mode === 'replace') {
    history.replaceState(state, '', url);
  } else {
    history.pushState(state, '', url);
  }
}

export function subscribePopState(onChange: (slug: string | null) => void): () => void {
  const handler = () => {
    onChange(readSlugFromUrl());
  };
  window.addEventListener('popstate', handler);
  return () => window.removeEventListener('popstate', handler);
}
