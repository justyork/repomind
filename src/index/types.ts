export const DOC_TYPES = [
  'adr',
  'feature-spec',
  'glossary-term',
  'open-question',
  'agent-instruction',
  'wiki-page',
] as const;

export type DocType = (typeof DOC_TYPES)[number];

export const DOC_STATUSES = [
  'draft',
  'proposed',
  'accepted',
  'superseded',
] as const;

export type DocStatus = (typeof DOC_STATUSES)[number];

export type ContentKind = 'markdown' | 'yaml' | 'json';

export const TYPE_TO_DIR: Record<DocType, string> = {
  adr: 'adr',
  'feature-spec': 'specs',
  'glossary-term': 'glossary',
  'open-question': 'open-questions',
  'agent-instruction': 'agents',
  'wiki-page': 'wiki',
};

export const DIR_TO_TYPE: Record<string, DocType> = {
  adr: 'adr',
  specs: 'feature-spec',
  glossary: 'glossary-term',
  'open-questions': 'open-question',
  agents: 'agent-instruction',
  wiki: 'wiki-page',
};

export interface DocFrontmatter {
  type: DocType;
  slug: string;
  status: DocStatus;
  title?: string;
  tags?: string[];
  related?: string[];
  owner?: string;
  updated?: string;
}

export interface DocRecord {
  path: string;
  relativePath: string;
  slug: string;
  type: DocType;
  status: DocStatus;
  title: string;
  tags: string[];
  related: string[];
  body: string;
  frontmatter: DocFrontmatter;
  /** True when the file has explicit RepoMind frontmatter (type field). */
  prepared: boolean;
  contentKind: ContentKind;
}

export function isDocType(value: unknown): value is DocType {
  return typeof value === 'string' && (DOC_TYPES as readonly string[]).includes(value);
}

export function isDocStatus(value: unknown): value is DocStatus {
  return typeof value === 'string' && (DOC_STATUSES as readonly string[]).includes(value);
}
