export type ContentKind = 'markdown' | 'yaml' | 'json';

const KNOWLEDGE_FILE_PATTERN = /\.(md|ya?ml|json)$/i;

export function isKnowledgeFileName(name: string): boolean {
  return KNOWLEDGE_FILE_PATTERN.test(name);
}

export function contentKindFromRelativePath(relativePath: string): ContentKind {
  const lower = relativePath.toLowerCase();
  if (lower.endsWith('.json')) {
    return 'json';
  }
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    return 'yaml';
  }
  return 'markdown';
}

export function stripKnowledgeExtension(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/\.(md|ya?ml|json)$/i, '');
}
