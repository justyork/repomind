import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  findRepomindEnvFile,
  loadRepomindEnv,
  loadRepomindEnvFromFile,
} from '../src/env/load-repomind-env.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-env-'));
  tmpRoots.push(dir);
  return dir;
}

afterEach(() => {
  delete process.env.REPOMIND_UI_PASSWORD;
  delete process.env.REPOMIND_ASK_API_KEY;
  delete process.env.REPOMIND_ASK_PROVIDER;
  delete process.env.REPOMIND_EXISTING;
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('loadRepomindEnvFromFile', () => {
  it('loads REPOMIND_* keys from .env', () => {
    const cwd = makeTempDir();
    fs.writeFileSync(
      path.join(cwd, '.env'),
      [
        '# comment',
        'GSTACK_HOME=.gstack',
        'REPOMIND_UI_PASSWORD=secret',
        'REPOMIND_ASK_PROVIDER=openai',
        'REPOMIND_ASK_API_KEY="quoted-key"',
      ].join('\n'),
      'utf8',
    );

    const loaded = loadRepomindEnvFromFile(cwd);
    expect(loaded).toEqual([
      'REPOMIND_UI_PASSWORD',
      'REPOMIND_ASK_PROVIDER',
      'REPOMIND_ASK_API_KEY',
    ]);
    expect(process.env.REPOMIND_UI_PASSWORD).toBe('secret');
    expect(process.env.REPOMIND_ASK_PROVIDER).toBe('openai');
    expect(process.env.REPOMIND_ASK_API_KEY).toBe('quoted-key');
    expect(process.env.GSTACK_HOME).toBeUndefined();
  });

  it('does not override existing environment variables', () => {
    const cwd = makeTempDir();
    process.env.REPOMIND_EXISTING = 'from-shell';
    fs.writeFileSync(
      path.join(cwd, '.env'),
      'REPOMIND_EXISTING=from-file\nREPOMIND_UI_PASSWORD=file-password\n',
      'utf8',
    );

    const loaded = loadRepomindEnvFromFile(cwd);
    expect(loaded).toEqual(['REPOMIND_UI_PASSWORD']);
    expect(process.env.REPOMIND_EXISTING).toBe('from-shell');
    expect(process.env.REPOMIND_UI_PASSWORD).toBe('file-password');
  });

  it('overrides empty shell variables from .env', () => {
    const cwd = makeTempDir();
    process.env.REPOMIND_UI_PASSWORD = '   ';
    fs.writeFileSync(path.join(cwd, '.env'), 'REPOMIND_UI_PASSWORD=file-password\n', 'utf8');

    const loaded = loadRepomindEnvFromFile(cwd);
    expect(loaded).toEqual(['REPOMIND_UI_PASSWORD']);
    expect(process.env.REPOMIND_UI_PASSWORD).toBe('file-password');
  });

  it('returns empty list when .env is missing', () => {
    const cwd = makeTempDir();
    expect(loadRepomindEnvFromFile(cwd)).toEqual([]);
  });

  it('finds .env in a parent directory', () => {
    const root = makeTempDir();
    const nested = path.join(root, 'apps', 'wiki');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(root, '.env'), 'REPOMIND_UI_PASSWORD=nested-parent\n', 'utf8');

    const result = loadRepomindEnv(nested);
    expect(result.envPath).toBe(path.join(root, '.env'));
    expect(result.loaded).toEqual(['REPOMIND_UI_PASSWORD']);
    expect(process.env.REPOMIND_UI_PASSWORD).toBe('nested-parent');
  });

  it('loads from project root when cwd differs', () => {
    const root = makeTempDir();
    const docsDir = path.join(root, 'docs');
    const nested = path.join(root, 'apps', 'wiki');
    fs.mkdirSync(docsDir, { recursive: true });
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(root, '.env'), 'REPOMIND_ASK_PROVIDER=anthropic\n', 'utf8');

    const result = loadRepomindEnv(nested, root);
    expect(result.loaded).toEqual(['REPOMIND_ASK_PROVIDER']);
    expect(process.env.REPOMIND_ASK_PROVIDER).toBe('anthropic');
  });

  it('findRepomindEnvFile walks up the tree', () => {
    const root = makeTempDir();
    const nested = path.join(root, 'a', 'b');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(root, '.env'), 'REPOMIND_UI_PASSWORD=x\n', 'utf8');

    expect(findRepomindEnvFile(nested)).toBe(path.join(root, '.env'));
  });
});
