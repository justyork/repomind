import fs from 'node:fs';
import path from 'node:path';
import { normalizeRelativePath } from './safe-path.js';

const META_FILE = 'catalog-meta.json';

export type CatalogMetaMap = Record<string, string>;

function metaPath(knowledgeRoot: string): string {
  return path.join(knowledgeRoot, '.repo-mind', META_FILE);
}

export function readCatalogMeta(knowledgeRoot: string): CatalogMetaMap {
  const filePath = metaPath(knowledgeRoot);
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const result: CatalogMetaMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string') {
        result[normalizeRelativePath(key)] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function writeCatalogEmoji(
  knowledgeRoot: string,
  folderPath: string,
  emoji: string,
): CatalogMetaMap {
  const key = normalizeRelativePath(folderPath);
  const meta = readCatalogMeta(knowledgeRoot);
  const trimmed = emoji.trim();
  if (!trimmed) {
    delete meta[key];
  } else {
    meta[key] = trimmed.slice(0, 8);
  }

  const dir = path.join(knowledgeRoot, '.repo-mind');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(metaPath(knowledgeRoot), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  return meta;
}

export function catalogEmoji(meta: CatalogMetaMap, folderPath: string): string | null {
  return meta[normalizeRelativePath(folderPath)] ?? null;
}
