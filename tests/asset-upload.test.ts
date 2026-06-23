import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseMultipartFormData } from '../src/ui/parse-multipart.ts';
import { handleAssetUpload } from '../src/ui/upload-asset.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-upload-'));
  tmpRoots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function buildMultipart(
  boundary: string,
  fields: Record<string, string>,
  files: Array<{ field: string; filename: string; data: Buffer; mime?: string }>,
): Buffer {
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
      ),
    );
  }
  for (const file of files) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\nContent-Type: ${file.mime ?? 'application/octet-stream'}\r\n\r\n`,
      ),
    );
    chunks.push(file.data);
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

describe('parseMultipartFormData', () => {
  it('parses text fields and file parts', () => {
    const boundary = 'test-boundary';
    const body = buildMultipart(
      boundary,
      { relativeDir: 'assets' },
      [{ field: 'file', filename: 'logo.png', data: Buffer.from('png'), mime: 'image/png' }],
    );
    const parsed = parseMultipartFormData(body, `multipart/form-data; boundary=${boundary}`);
    expect(parsed.fields.get('relativeDir')).toBe('assets');
    expect(parsed.files.get('file')?.fileName).toBe('logo.png');
    expect(parsed.files.get('file')?.data.toString()).toBe('png');
  });
});

describe('handleAssetUpload', () => {
  it('writes image under docs/assets/', () => {
    const repo = makeTempDir();
    const docsRoot = path.join(repo, 'docs');
    fs.mkdirSync(docsRoot, { recursive: true });
    const boundary = 'upload-boundary';
    const png = Buffer.from('fake-png');
    const body = buildMultipart(
      boundary,
      { relativeDir: 'assets' },
      [{ field: 'file', filename: 'diagram.png', data: png, mime: 'image/png' }],
    );

    const result = handleAssetUpload(docsRoot, body, `multipart/form-data; boundary=${boundary}`);
    expect(result.status).toBe(200);
    if (result.status !== 200) {
      return;
    }
    expect(result.body.relativePath).toBe('assets/diagram.png');
    expect(result.body.url).toBe('/api/assets/assets/diagram.png');
    const written = fs.readFileSync(path.join(docsRoot, 'assets/diagram.png'));
    expect(written.equals(png)).toBe(true);
  });

  it('rejects paths outside assets/', () => {
    const repo = makeTempDir();
    const docsRoot = path.join(repo, 'docs');
    fs.mkdirSync(docsRoot, { recursive: true });
    const boundary = 'upload-boundary';
    const body = buildMultipart(
      boundary,
      { relativeDir: '../secrets' },
      [{ field: 'file', filename: 'evil.png', data: Buffer.from('x'), mime: 'image/png' }],
    );

    const result = handleAssetUpload(docsRoot, body, `multipart/form-data; boundary=${boundary}`);
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ error: expect.stringContaining('assets') });
  });

  it('rejects non-image extensions', () => {
    const repo = makeTempDir();
    const docsRoot = path.join(repo, 'docs');
    fs.mkdirSync(docsRoot, { recursive: true });
    const boundary = 'upload-boundary';
    const body = buildMultipart(
      boundary,
      {},
      [{ field: 'file', filename: 'script.js', data: Buffer.from('x'), mime: 'text/javascript' }],
    );

    const result = handleAssetUpload(docsRoot, body, `multipart/form-data; boundary=${boundary}`);
    expect(result.status).toBe(400);
  });
});
