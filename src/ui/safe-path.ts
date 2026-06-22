import path from 'node:path';

const FS_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function isValidFsName(name: string): boolean {
  return FS_NAME_PATTERN.test(name) && name !== '.repo-mind' && name !== '.worktrees';
}

export function normalizeRelativePath(relative: string): string {
  return relative.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

export function resolveUnderKnowledgeRoot(
  knowledgeRoot: string,
  relative: string,
): string | null {
  const normalized = normalizeRelativePath(relative);
  const candidate = path.resolve(knowledgeRoot, normalized);
  const rootWithSep = knowledgeRoot.endsWith(path.sep)
    ? knowledgeRoot
    : `${knowledgeRoot}${path.sep}`;

  if (!candidate.startsWith(rootWithSep) && candidate !== knowledgeRoot) {
    return null;
  }

  return candidate;
}

export function resolveRelativeMdPath(
  knowledgeRoot: string,
  relative: string,
): string | null {
  const normalized = normalizeRelativePath(relative);
  if (!normalized || normalized.endsWith('.md')) {
    const base = resolveUnderKnowledgeRoot(knowledgeRoot, normalized);
    if (!base) {
      return null;
    }
    return base.endsWith('.md') ? base : `${base}.md`;
  }

  return resolveUnderKnowledgeRoot(knowledgeRoot, `${normalized}.md`);
}

export function parentRelativePath(relative: string): string {
  const normalized = normalizeRelativePath(relative);
  const idx = normalized.lastIndexOf('/');
  if (idx === -1) {
    return '';
  }
  return normalized.slice(0, idx);
}

export function joinRelativePath(parent: string, name: string): string {
  const base = normalizeRelativePath(parent);
  return base ? `${base}/${name}` : name;
}
