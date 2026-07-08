import fs from 'node:fs';
import http from 'node:http';
import type { Socket } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DocIndex } from '../index/doc-index.js';
import { routeApi, handleDocsEvents } from './api-handlers.js';
import type { AuthApiResponse } from './auth.js';
import { handleAuthApi } from './auth.js';
import type { UiAuth } from './auth.js';
import type { DocsWatcher } from './docs-watcher.js';
import type { DraftsDb } from './db/drafts-db.js';
import { handleDraftApi } from './draft-api.js';
import { serveKnowledgeAsset } from './serve-asset.js';
import { handleAssetUpload, MAX_ASSET_UPLOAD_BYTES } from './upload-asset.js';

export interface UiServerOptions {
  host?: string;
  port: number;
  index: DocIndex;
  staticDir: string;
  draftsDb?: DraftsDb;
  docsWatcher?: DocsWatcher;
  auth?: UiAuth | null;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

const MAX_BODY_BYTES = 2 * 1024 * 1024;

function readBodyBuffer(req: http.IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function resolveStaticPath(staticDir: string, requestPath: string): string | null {
  const normalized = path.normalize(requestPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(staticDir, normalized);
  const resolvedStatic = path.resolve(staticDir);
  const resolvedFile = path.resolve(filePath);
  if (!resolvedFile.startsWith(resolvedStatic)) {
    return null;
  }
  return resolvedFile;
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...extraHeaders,
  });
  res.end(payload);
}

function sendAuthJson(res: http.ServerResponse, auth: UiAuth, response: AuthApiResponse): void {
  const headers: Record<string, string> = {};
  if (response.setCookie) {
    headers['Set-Cookie'] = response.setCookie;
  } else if (response.clearCookie) {
    headers['Set-Cookie'] = auth.clearSessionCookie();
  }
  sendJson(res, response.status, response.body, headers);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveStatic(
  res: http.ServerResponse,
  staticDir: string,
  requestPath: string,
): boolean {
  const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\//, '');
  let filePath = resolveStaticPath(staticDir, relative);

  if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    const spaFallback = resolveStaticPath(staticDir, 'index.html');
    if (!spaFallback || !fs.existsSync(spaFallback)) {
      return false;
    }
    filePath = spaFallback;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
  const data = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': data.length,
  });
  res.end(data);
  return true;
}

export function createUiServer(options: UiServerOptions): http.Server {
  const host = options.host ?? '127.0.0.1';
  const { staticDir, index, draftsDb, docsWatcher, auth = null } = options;

  return http.createServer((req, res) => {
    void (async () => {
      const method = req.method ?? 'GET';
      const urlPath = new URL(req.url ?? '/', `http://${host}`).pathname;

      if (urlPath.startsWith('/api/auth/')) {
        if (!auth) {
          if (urlPath === '/api/auth/session' && method === 'GET') {
            sendJson(res, 200, { authenticated: true, required: false });
            return;
          }
          sendJson(res, 404, { error: 'not found' });
          return;
        }

        let bodyRaw = '';
        if (method === 'POST') {
          try {
            bodyRaw = await readBody(req);
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'bad request';
            sendJson(res, 400, { error: message });
            return;
          }
        }

        const authResponse = handleAuthApi(auth, method, urlPath, bodyRaw, req.headers);
        if (authResponse) {
          sendAuthJson(res, auth, authResponse);
          return;
        }

        sendJson(res, 404, { error: 'not found' });
        return;
      }

      if (auth && !auth.isAuthenticated(req.headers)) {
        if (urlPath.startsWith('/api/')) {
          sendJson(res, 401, { error: 'authentication required' });
          return;
        }
        if (method !== 'GET' && method !== 'HEAD') {
          sendJson(res, 401, { error: 'authentication required' });
          return;
        }
        if (method === 'HEAD') {
          res.writeHead(401);
          res.end();
          return;
        }
        if (!serveStatic(res, staticDir, urlPath)) {
          sendJson(res, 503, {
            error: 'UI assets not found — run `npm run build:ui` in the repo-mind package',
          });
        }
        return;
      }

      if (urlPath.startsWith('/api/')) {
        if (urlPath === '/api/assets/upload' && method === 'POST') {
          const knowledgeRoot = index.getKnowledgeRoot();
          if (!knowledgeRoot) {
            sendJson(res, 404, { error: 'no docs/ directory found' });
            return;
          }
          const contentType = req.headers['content-type'] ?? '';
          if (!contentType.toLowerCase().includes('multipart/form-data')) {
            sendJson(res, 400, { error: 'multipart/form-data required' });
            return;
          }
          let bodyBuffer: Buffer;
          try {
            bodyBuffer = await readBodyBuffer(req, MAX_ASSET_UPLOAD_BYTES);
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'bad request';
            sendJson(res, 400, { error: message });
            return;
          }
          const uploadResponse = handleAssetUpload(knowledgeRoot, bodyBuffer, contentType);
          sendJson(res, uploadResponse.status, uploadResponse.body);
          return;
        }

        if (urlPath.startsWith('/api/assets/') && method === 'GET') {
          const knowledgeRoot = index.getKnowledgeRoot();
          if (!knowledgeRoot) {
            sendJson(res, 404, { error: 'no docs/ directory found' });
            return;
          }
          serveKnowledgeAsset(res, knowledgeRoot, urlPath.slice('/api/assets/'.length));
          return;
        }

        if (urlPath === '/api/events' && method === 'GET') {
          handleDocsEvents(req, res, docsWatcher);
          return;
        }

        let bodyRaw = '';
        if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
          try {
            bodyRaw = await readBody(req);
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : 'bad request';
            sendJson(res, 400, { error: message });
            return;
          }
        }

        const draftResponse = handleDraftApi(index, draftsDb, method, urlPath, bodyRaw);
        if (draftResponse) {
          sendJson(res, draftResponse.status, draftResponse.body);
          return;
        }

        if (urlPath.startsWith('/api/drafts')) {
          sendJson(res, 503, { error: 'drafts database unavailable' });
          return;
        }

        if (method !== 'GET' && method !== 'HEAD') {
          sendJson(res, 405, { error: 'method not allowed' });
          return;
        }

        const apiResponse = routeApi(index, req);
        if (apiResponse) {
          if (method === 'HEAD') {
            res.writeHead(apiResponse.status);
            res.end();
            return;
          }
          sendJson(res, apiResponse.status, apiResponse.body);
          return;
        }

        sendJson(res, 404, { error: 'not found' });
        return;
      }

      if (method !== 'GET' && method !== 'HEAD') {
        sendJson(res, 405, { error: 'method not allowed' });
        return;
      }

      if (method === 'HEAD') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (!serveStatic(res, staticDir, urlPath)) {
        sendJson(res, 503, {
          error: 'UI assets not found — run `npm run build:ui` in the repo-mind package',
        });
      }
    })().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'internal error';
      sendJson(res, 500, { error: message });
    });
  });
}

export function resolveUiStaticDir(): string {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const packageRoot = path.join(moduleDir, '..', '..');
  return path.join(packageRoot, 'ui', 'dist');
}

export function startUiServer(options: UiServerOptions): Promise<http.Server> {
  const host = options.host ?? '127.0.0.1';
  const server = createUiServer(options);
  attachActiveConnectionTracking(server);

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, host, () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}

const activeSockets = new WeakMap<http.Server, Set<Socket>>();

function attachActiveConnectionTracking(server: http.Server): void {
  const sockets = new Set<Socket>();
  activeSockets.set(server, sockets);
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => {
      sockets.delete(socket);
    });
  });
}

/** Destroys open HTTP connections (including SSE) so shutdown can complete. */
export function destroyUiServerConnections(server: http.Server): void {
  const sockets = activeSockets.get(server);
  if (sockets) {
    for (const socket of sockets) {
      socket.destroy();
    }
    sockets.clear();
  }
  if (typeof server.closeAllConnections === 'function') {
    server.closeAllConnections();
  }
}
