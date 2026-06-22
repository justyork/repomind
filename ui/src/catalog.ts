import type { ListDocsItem } from './api.js';

export const CATALOG_ORDER = [
  'adr',
  'feature-spec',
  'glossary-term',
  'open-question',
  'agent-instruction',
] as const;

export const CATALOG_LABELS: Record<string, string> = {
  'wiki-page': 'Wiki',
  adr: 'ADR',
  'feature-spec': 'Feature specs',
  'glossary-term': 'Glossary',
  'open-question': 'Open questions',
  'agent-instruction': 'Agent instructions',
};

export const CATALOG_ICON_LETTERS: Record<string, string> = {
  'wiki-page': 'W',
  adr: 'A',
  'feature-spec': 'S',
  'glossary-term': 'G',
  'open-question': '?',
  'agent-instruction': '◎',
};

const FOLDER_CATALOG_PREFIX = 'folder:';

export function catalogIconLetter(type: string): string {
  if (type.startsWith(FOLDER_CATALOG_PREFIX)) {
    const folder = type.slice(FOLDER_CATALOG_PREFIX.length);
    return folder.slice(0, 1).toUpperCase();
  }
  return CATALOG_ICON_LETTERS[type] ?? type.slice(0, 1).toUpperCase();
}

export function catalogLabel(type: string): string {
  if (type.startsWith(FOLDER_CATALOG_PREFIX)) {
    const folder = type.slice(FOLDER_CATALOG_PREFIX.length);
    if (folder === '__root__') {
      return 'General';
    }
    return folder
      .split(/[-_/]/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
  return CATALOG_LABELS[type] ?? type;
}

export interface CatalogGroup {
  type: string;
  label: string;
  docs: ListDocsItem[];
  /** Nested folders inside a wiki folder catalog (e.g. architecture/network). */
  subfolders?: CatalogSubfolder[];
}

export interface CatalogSubfolder {
  path: string;
  label: string;
  docs: ListDocsItem[];
}

function sortDocs(docs: ListDocsItem[]): ListDocsItem[] {
  return [...docs].sort((a, b) => {
    const pathCmp = a.relativePath.localeCompare(b.relativePath, undefined, { sensitivity: 'base' });
    if (pathCmp !== 0) {
      return pathCmp;
    }
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
  });
}

function wikiTopFolder(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/');
  const slash = normalized.indexOf('/');
  if (slash === -1) {
    return '__root__';
  }
  return normalized.slice(0, slash);
}

function wikiSubfolderPath(relativePath: string, topFolder: string): string | null {
  const normalized = relativePath.replace(/\\/g, '/');
  const prefix = topFolder === '__root__' ? '' : `${topFolder}/`;
  if (topFolder === '__root__') {
    const slash = normalized.indexOf('/');
    if (slash === -1) {
      return null;
    }
    const rest = normalized.slice(slash + 1);
    const lastSlash = rest.lastIndexOf('/');
    if (lastSlash === -1) {
      return null;
    }
    return rest.slice(0, lastSlash);
  }

  if (!normalized.startsWith(prefix)) {
    return null;
  }
  const rest = normalized.slice(prefix.length);
  const lastSlash = rest.lastIndexOf('/');
  if (lastSlash === -1) {
    return null;
  }
  return rest.slice(0, lastSlash);
}

function subfolderLabel(path: string): string {
  const segment = path.split('/').pop() ?? path;
  return segment
    .split(/[-_/]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildWikiFolderCatalog(topFolder: string, docs: ListDocsItem[]): CatalogGroup {
  const catalogType = `${FOLDER_CATALOG_PREFIX}${topFolder}`;
  const rootDocs: ListDocsItem[] = [];
  const subfolderMap = new Map<string, ListDocsItem[]>();

  for (const doc of docs) {
    const subPath = wikiSubfolderPath(doc.relativePath, topFolder);
    if (!subPath) {
      rootDocs.push(doc);
      continue;
    }
    const list = subfolderMap.get(subPath) ?? [];
    list.push(doc);
    subfolderMap.set(subPath, list);
  }

  const subfolders: CatalogSubfolder[] = [...subfolderMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map(([path, items]) => ({
      path,
      label: subfolderLabel(path),
      docs: sortDocs(items),
    }));

  return {
    type: catalogType,
    label: catalogLabel(catalogType),
    docs: sortDocs(rootDocs),
    subfolders: subfolders.length > 0 ? subfolders : undefined,
  };
}

export function groupDocsByCatalog(docs: ListDocsItem[]): CatalogGroup[] {
  const byType = new Map<string, ListDocsItem[]>();
  const wikiByFolder = new Map<string, ListDocsItem[]>();

  for (const doc of docs) {
    if (doc.type === 'wiki-page') {
      const folder = wikiTopFolder(doc.relativePath);
      const list = wikiByFolder.get(folder) ?? [];
      list.push(doc);
      wikiByFolder.set(folder, list);
      continue;
    }

    const list = byType.get(doc.type) ?? [];
    list.push(doc);
    byType.set(doc.type, list);
  }

  const groups: CatalogGroup[] = [];

  for (const type of CATALOG_ORDER) {
    const items = byType.get(type);
    if (!items?.length) {
      continue;
    }
    groups.push({ type, label: catalogLabel(type), docs: sortDocs(items) });
  }

  for (const [type, items] of byType) {
    if ((CATALOG_ORDER as readonly string[]).includes(type)) {
      continue;
    }
    groups.push({ type, label: catalogLabel(type), docs: sortDocs(items) });
  }

  const folderKeys = [...wikiByFolder.keys()].sort((a, b) => {
    if (a === '__root__') {
      return 1;
    }
    if (b === '__root__') {
      return -1;
    }
    return a.localeCompare(b, undefined, { sensitivity: 'base' });
  });

  for (const folder of folderKeys) {
    const items = wikiByFolder.get(folder);
    if (!items?.length) {
      continue;
    }
    groups.push(buildWikiFolderCatalog(folder, items));
  }

  return groups;
}
