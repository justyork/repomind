import { DIR_TO_TYPE, type DocDomain, type DocType, isDocDomain } from './types.js';

function normalizedSegments(relative: string): string[] {
  return relative.replace(/\\/g, '/').split('/').filter(Boolean);
}

/** Infers doc type from any path segment matching a known type folder. */
export function inferTypeFromRelative(relative: string): DocType {
  for (const segment of normalizedSegments(relative)) {
    const mapped = DIR_TO_TYPE[segment];
    if (mapped) {
      return mapped;
    }
  }
  return 'wiki-page';
}

/** Infers domain from the first path segment when it is a known domain id. */
export function inferDomainFromRelative(relative: string): DocDomain {
  const [first] = normalizedSegments(relative);
  if (first && isDocDomain(first)) {
    return first;
  }
  return 'shared';
}

/** Resolves domain from frontmatter override or path inference. */
export function resolveDomain(relative: string, explicit: unknown): DocDomain {
  if (typeof explicit === 'string' && isDocDomain(explicit)) {
    return explicit;
  }
  return inferDomainFromRelative(relative);
}

/** Domain encoded in path (ignores frontmatter). */
export function domainFromPath(relative: string): DocDomain {
  return inferDomainFromRelative(relative);
}
