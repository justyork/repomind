import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let cachedVersion: string | undefined;

/** Package version from repo-mind `package.json` (single source for UI + MCP). */
export function getPackageVersion(): string {
  if (cachedVersion) {
    return cachedVersion;
  }
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const packageJsonPath = path.join(moduleDir, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as { version?: string };
  cachedVersion = typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  return cachedVersion;
}
