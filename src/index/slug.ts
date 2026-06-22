import path from 'node:path';

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/** Builds a stable slug from a path relative to the docs root. */
export function slugFromRelativePath(relativePath: string): string {
  const normalized = relativePath
    .replace(/\\/g, '/')
    .replace(/\.(md|ya?ml|json)$/i, '');
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length === 0) {
    return 'untitled';
  }

  const candidates = [
    segments.length === 1 ? segments[0]! : segments.join('-'),
    segments[segments.length - 1]!,
  ];

  for (const raw of candidates) {
    const slug = raw
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (isValidSlug(slug)) {
      return slug;
    }
  }

  return 'untitled';
}

export function resolveDocPath(
  knowledgeRoot: string,
  typeDir: string,
  slug: string,
): string | null {
  if (!isValidSlug(slug)) {
    return null;
  }

  const candidate = path.resolve(knowledgeRoot, typeDir, `${slug}.md`);
  const rootWithSep = knowledgeRoot.endsWith(path.sep)
    ? knowledgeRoot
    : `${knowledgeRoot}${path.sep}`;

  if (!candidate.startsWith(rootWithSep)) {
    return null;
  }

  return candidate;
}
