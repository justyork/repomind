import fs from 'node:fs';
import path from 'node:path';
import { assetApiPath, isImageFileName } from '../index/asset-file.js';
import { parseMultipartFormData } from './parse-multipart.js';
import { isValidFsName, joinRelativePath, normalizeRelativePath, resolveUnderKnowledgeRoot } from './safe-path.js';

export const MAX_ASSET_UPLOAD_BYTES = 5 * 1024 * 1024;
const DEFAULT_ASSET_DIR = 'assets';

export interface AssetUploadResult {
  relativePath: string;
  url: string;
}

function isUnderAssetsDir(relativeDir: string): boolean {
  const normalized = normalizeRelativePath(relativeDir);
  if (!normalized) {
    return false;
  }
  return normalized === 'assets' || normalized.startsWith('assets/');
}

function validateImageFileName(fileName: string): boolean {
  const base = path.basename(fileName);
  if (!isImageFileName(base)) {
    return false;
  }
  const stem = base.slice(0, base.length - path.extname(base).length);
  return isValidFsName(stem);
}

export function handleAssetUpload(
  knowledgeRoot: string,
  body: Buffer,
  contentType: string,
): { status: number; body: AssetUploadResult | { error: string } } {
  let parsed;
  try {
    parsed = parseMultipartFormData(body, contentType);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'invalid multipart body';
    return { status: 400, body: { error: message } };
  }

  const file = parsed.files.get('file');
  if (!file) {
    return { status: 400, body: { error: 'file field required' } };
  }

  if (file.data.length > MAX_ASSET_UPLOAD_BYTES) {
    return { status: 400, body: { error: 'file too large (max 5MB)' } };
  }

  const relativeDir = normalizeRelativePath(parsed.fields.get('relativeDir')?.trim() || DEFAULT_ASSET_DIR);
  if (!isUnderAssetsDir(relativeDir)) {
    return { status: 400, body: { error: 'relativeDir must be under assets/' } };
  }

  const fileName = path.basename(file.fileName);
  if (!validateImageFileName(fileName)) {
    return { status: 400, body: { error: 'invalid image file name' } };
  }

  const relativePath = joinRelativePath(relativeDir, fileName);
  const absolutePath = resolveUnderKnowledgeRoot(knowledgeRoot, relativePath);
  if (!absolutePath) {
    return { status: 400, body: { error: 'invalid upload path' } };
  }

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, file.data);

  return {
    status: 200,
    body: {
      relativePath,
      url: assetApiPath(relativePath),
    },
  };
}
