import fs from 'node:fs';
import path from 'node:path';
import type { ServerResponse } from 'node:http';
import { isImageFileName, mimeTypeForImagePath } from '../index/asset-file.js';
import { resolveUnderKnowledgeRoot } from './safe-path.js';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export function decodeAssetRelativePath(encodedPath: string): string {
  return encodedPath
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => decodeURIComponent(segment))
    .join('/');
}

export function serveKnowledgeAsset(
  res: ServerResponse,
  knowledgeRoot: string,
  encodedRelative: string,
): void {
  const relative = decodeAssetRelativePath(encodedRelative);
  if (!relative || !isImageFileName(relative)) {
    sendJson(res, 400, { error: 'invalid asset path' });
    return;
  }

  const absolute = resolveUnderKnowledgeRoot(knowledgeRoot, relative);
  if (!absolute || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    sendJson(res, 404, { error: 'asset not found' });
    return;
  }

  const contentType = mimeTypeForImagePath(relative);
  if (!contentType) {
    sendJson(res, 403, { error: 'unsupported asset type' });
    return;
  }

  const data = fs.readFileSync(absolute);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': data.length,
    'Cache-Control': 'no-cache',
  });
  res.end(data);
}

export function assetExists(knowledgeRoot: string, relative: string): boolean {
  if (!isImageFileName(relative)) {
    return false;
  }
  const absolute = resolveUnderKnowledgeRoot(knowledgeRoot, relative);
  return Boolean(absolute && fs.existsSync(absolute) && fs.statSync(absolute).isFile());
}
