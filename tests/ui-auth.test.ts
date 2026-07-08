import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createUiAuth } from '../src/ui/auth.ts';

describe('ui auth', () => {
  const auth = createUiAuth({ password: 'secret-pass' });

  it('rejects invalid passwords', () => {
    expect(auth.login('wrong')).toBeNull();
  });

  it('issues a session token for valid password', () => {
    const token = auth.login('secret-pass');
    expect(token).toBeTruthy();
  });

  it('authenticates requests with a valid session cookie', () => {
    const token = auth.login('secret-pass');
    expect(token).toBeTruthy();
    const headers = { cookie: auth.createSessionCookie(token!) };
    expect(auth.isAuthenticated(headers)).toBe(true);
  });

  it('rejects missing or cleared sessions', () => {
    const token = auth.login('secret-pass');
    expect(token).toBeTruthy();
    const headers = { cookie: auth.createSessionCookie(token!) };
    auth.logout(headers);
    expect(auth.isAuthenticated(headers)).toBe(false);
  });
});

describe('ui server auth integration', () => {
  let server: http.Server | null = null;
  let port = 0;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  });

  it('blocks protected API routes until login', async () => {
    const { createUiServer } = await import('../src/ui/server.ts');
    const { DocIndex } = await import('../src/index/doc-index.ts');
    const fs = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');

    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-auth-'));
    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'docs/README.md'),
      `---
type: wiki-page
slug: readme
status: accepted
title: Readme
---
Hello
`,
      'utf8',
    );

    const index = new DocIndex(root);
    index.refresh();
    const auth = createUiAuth({ password: 'ui-pass' });
    server = createUiServer({
      port: 0,
      index,
      staticDir: path.join(root, 'missing-ui-dist'),
      auth,
    });

    await new Promise<void>((resolve) => {
      server!.listen(0, '127.0.0.1', () => resolve());
    });
    port = (server.address() as { port: number }).port;

    const blocked = await fetch(`http://127.0.0.1:${port}/api/health`);
    expect(blocked.status).toBe(401);

    const sessionRes = await fetch(`http://127.0.0.1:${port}/api/auth/session`);
    expect(sessionRes.status).toBe(200);
    const session = (await sessionRes.json()) as { authenticated: boolean; required: boolean };
    expect(session).toEqual({ authenticated: false, required: true });

    const badLogin = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'nope' }),
    });
    expect(badLogin.status).toBe(401);

    const loginRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'ui-pass' }),
    });
    expect(loginRes.status).toBe(200);
    const cookie = loginRes.headers.get('set-cookie');
    expect(cookie).toContain('repomind_session=');

    const healthRes = await fetch(`http://127.0.0.1:${port}/api/health`, {
      headers: { cookie: cookie ?? '' },
    });
    expect(healthRes.status).toBe(200);

    fs.rmSync(root, { recursive: true, force: true });
  });
});
