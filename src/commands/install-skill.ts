import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SKILL_NAME = 'repomind-docs';

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

export function resolveSkillSourceDir(): string {
  return path.join(PACKAGE_ROOT, '.cursor', 'skills', SKILL_NAME);
}

export interface InstallSkillOptions {
  cwd?: string;
  global?: boolean;
  force?: boolean;
}

export function resolveSkillDestDir(options: InstallSkillOptions = {}): string {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  if (options.global) {
    return path.join(os.homedir(), '.cursor', 'skills', SKILL_NAME);
  }
  return path.join(cwd, '.cursor', 'skills', SKILL_NAME);
}

export function runInstallSkill(options: InstallSkillOptions = {}): number {
  const source = resolveSkillSourceDir();
  const dest = resolveSkillDestDir(options);

  if (!fs.existsSync(source)) {
    console.error(`error: skill source not found at ${source}`);
    return 1;
  }

  if (fs.existsSync(dest) && !options.force) {
    console.warn(`warning: ${dest} already exists (use --force to replace)`);
    return 0;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.cpSync(source, dest, { recursive: true });

  console.log(`Installed ${SKILL_NAME} skill: ${dest}`);
  return 0;
}
