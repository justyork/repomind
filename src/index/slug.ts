import path from 'node:path';

export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
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
