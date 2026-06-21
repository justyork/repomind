import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DocIndex } from '../index/doc-index.js';
import { routeApi } from './api-handlers.js';

export interface UiServerOptions {
  host?: string;
  port: number;
  index: DocIndex;
  staticDir: string;
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

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
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
  const { staticDir, index } = options;

  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { error: 'method not allowed' });
      return;
    }

    const apiResponse = routeApi(index, req);
    if (apiResponse) {
      if (req.method === 'HEAD') {
        res.writeHead(apiResponse.status);
        res.end();
        return;
      }
      sendJson(res, apiResponse.status, apiResponse.body);
      return;
    }

    if (req.method === 'HEAD') {
      res.writeHead(200);
      res.end();
      return;
    }

    const urlPath = new URL(req.url ?? '/', `http://${host}`).pathname;
    if (!serveStatic(res, staticDir, urlPath)) {
      sendJson(res, 503, {
        error: 'UI assets not found — run `npm run build:ui` in the repo-mind package',
      });
    }
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

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port, host, () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}
