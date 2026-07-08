import crypto from 'node:crypto';
import type { IncomingHttpHeaders } from 'node:http';

const SESSION_COOKIE = 'repomind_session';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface UiAuthOptions {
  password: string;
}

export interface UiAuth {
  isEnabled: () => boolean;
  isAuthenticated: (headers: IncomingHttpHeaders) => boolean;
  login: (password: string) => string | null;
  logout: (headers: IncomingHttpHeaders) => void;
  createSessionCookie: (token: string) => string;
  clearSessionCookie: () => string;
}

export interface AuthApiResponse {
  status: number;
  body: unknown;
  setCookie?: string;
  clearCookie?: boolean;
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const [key, ...rest] = part.split('=');
    const name = key?.trim();
    if (name) {
      cookies[name] = decodeURIComponent(rest.join('=').trim());
    }
  }
  return cookies;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function createUiAuth(options: UiAuthOptions): UiAuth {
  const sessions = new Map<string, number>();

  function pruneSessions(): void {
    const now = Date.now();
    for (const [token, expiresAt] of sessions) {
      if (expiresAt <= now) {
        sessions.delete(token);
      }
    }
  }

  return {
    isEnabled: () => true,
    isAuthenticated(headers) {
      pruneSessions();
      const token = parseCookies(headers.cookie)[SESSION_COOKIE];
      if (!token) {
        return false;
      }
      const expiresAt = sessions.get(token);
      if (!expiresAt || expiresAt <= Date.now()) {
        sessions.delete(token);
        return false;
      }
      return true;
    },
    login(password) {
      if (!safeEqual(password, options.password)) {
        return null;
      }
      const token = crypto.randomBytes(32).toString('base64url');
      sessions.set(token, Date.now() + SESSION_MAX_AGE_MS);
      return token;
    },
    logout(headers) {
      const token = parseCookies(headers.cookie)[SESSION_COOKIE];
      if (token) {
        sessions.delete(token);
      }
    },
    createSessionCookie(token) {
      const maxAge = Math.floor(SESSION_MAX_AGE_MS / 1000);
      return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
    },
    clearSessionCookie() {
      return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
    },
  };
}

export function createOptionalUiAuth(): UiAuth | null {
  const password = process.env.REPOMIND_UI_PASSWORD?.trim();
  if (!password) {
    return null;
  }
  return createUiAuth({ password });
}

export function handleAuthApi(
  auth: UiAuth,
  method: string,
  urlPath: string,
  bodyRaw: string,
  headers: IncomingHttpHeaders,
): AuthApiResponse | null {
  if (urlPath === '/api/auth/session' && method === 'GET') {
    return {
      status: 200,
      body: { authenticated: auth.isAuthenticated(headers), required: true },
    };
  }

  if (urlPath === '/api/auth/login' && method === 'POST') {
    let password = '';
    try {
      const parsed = JSON.parse(bodyRaw) as { password?: string };
      password = typeof parsed.password === 'string' ? parsed.password : '';
    } catch {
      return { status: 400, body: { error: 'invalid JSON body' } };
    }

    const token = auth.login(password);
    if (!token) {
      return { status: 401, body: { error: 'invalid password' } };
    }

    return {
      status: 200,
      body: { authenticated: true },
      setCookie: auth.createSessionCookie(token),
    };
  }

  if (urlPath === '/api/auth/logout' && method === 'POST') {
    auth.logout(headers);
    return {
      status: 200,
      body: { authenticated: false },
      clearCookie: true,
    };
  }

  return null;
}
