import type { ListDocsItem } from './api.js';

export const CATALOG_ORDER = [
  'adr',
  'feature-spec',
  'glossary-term',
  'open-question',
  'agent-instruction',
] as const;

export const CATALOG_LABELS: Record<string, string> = {
  adr: 'ADR',
  'feature-spec': 'Feature specs',
  'glossary-term': 'Glossary',
  'open-question': 'Open questions',
  'agent-instruction': 'Agent instructions',
};

export const CATALOG_ICON_LETTERS: Record<string, string> = {
  adr: 'A',
  'feature-spec': 'S',
  'glossary-term': 'G',
  'open-question': '?',
  'agent-instruction': '◎',
};

export function catalogIconLetter(type: string): string {
  return CATALOG_ICON_LETTERS[type] ?? type.slice(0, 1).toUpperCase();
}

export function catalogLabel(type: string): string {
  return CATALOG_LABELS[type] ?? type;
}

export interface CatalogGroup {
  type: string;
  label: string;
  docs: ListDocsItem[];
}

export function groupDocsByCatalog(docs: ListDocsItem[]): CatalogGroup[] {
  const byType = new Map<string, ListDocsItem[]>();
  for (const doc of docs) {
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
    items.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    groups.push({ type, label: catalogLabel(type), docs: items });
  }

  for (const [type, items] of byType) {
    if ((CATALOG_ORDER as readonly string[]).includes(type)) {
      continue;
    }
    items.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
    groups.push({ type, label: catalogLabel(type), docs: items });
  }

  return groups;
}
