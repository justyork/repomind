import fs from 'node:fs';
import path from 'node:path';

export interface LoadRepomindEnvResult {
  loaded: string[];
  envPath: string | null;
}

function unquoteEnvValue(raw: string): string {
  const value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseEnvLine(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  if (trimmed.startsWith('export ')) {
    return parseEnvLine(trimmed.slice('export '.length));
  }

  const separator = trimmed.indexOf('=');
  if (separator <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separator).trim();
  const rawValue = trimmed.slice(separator + 1).trim();
  if (!key) {
    return null;
  }

  return { key, value: unquoteEnvValue(rawValue) };
}

function envIsUnset(key: string): boolean {
  const value = process.env[key];
  return value === undefined || value.trim() === '';
}

/** Finds the nearest `.env` walking up from `startDir`. */
export function findRepomindEnvFile(startDir: string): string | null {
  let current = path.resolve(startDir);

  while (true) {
    const envPath = path.join(current, '.env');
    if (fs.existsSync(envPath) && fs.statSync(envPath).isFile()) {
      return envPath;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function loadRepomindEnvAtPath(envPath: string): string[] {
  const loaded: string[] = [];
  const content = fs.readFileSync(envPath, 'utf8');

  for (const line of content.split(/\r?\n/)) {
    const parsed = parseEnvLine(line);
    if (!parsed || !parsed.key.startsWith('REPOMIND_')) {
      continue;
    }
    if (!envIsUnset(parsed.key)) {
      continue;
    }
    process.env[parsed.key] = parsed.value;
    loaded.push(parsed.key);
  }

  return loaded;
}

/** Loads `REPOMIND_*` variables from the nearest `.env` without overriding shell env. */
export function loadRepomindEnvFromFile(cwd: string): string[] {
  return loadRepomindEnv(cwd).loaded;
}

/** Loads `REPOMIND_*` from nearest `.env` near cwd and optional project root. */
export function loadRepomindEnv(cwd: string, projectRoot?: string): LoadRepomindEnvResult {
  const candidates = new Set<string>([path.resolve(cwd)]);
  if (projectRoot) {
    candidates.add(path.resolve(projectRoot));
  }

  const envPaths: string[] = [];
  for (const candidate of candidates) {
    const envPath = findRepomindEnvFile(candidate);
    if (envPath && !envPaths.includes(envPath)) {
      envPaths.push(envPath);
    }
  }

  const loaded: string[] = [];
  let envPath: string | null = null;

  for (const candidatePath of envPaths) {
    const keys = loadRepomindEnvAtPath(candidatePath);
    if (keys.length > 0) {
      envPath = candidatePath;
      for (const key of keys) {
        if (!loaded.includes(key)) {
          loaded.push(key);
        }
      }
    }
  }

  return { loaded, envPath };
}
