import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  resolveSkillDestDir,
  resolveSkillSourceDir,
  runInstallSkill,
  SKILL_NAME,
} from '../src/commands/install-skill.ts';

const tmpRoots: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-skill-'));
  tmpRoots.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('install-skill', () => {
  it('copies skill files into project .cursor/skills/', () => {
    const repo = makeTempDir();
    expect(runInstallSkill({ cwd: repo })).toBe(0);

    const dest = path.join(repo, '.cursor', 'skills', SKILL_NAME);
    expect(fs.existsSync(path.join(dest, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'structure.md'))).toBe(true);
    expect(fs.readFileSync(path.join(dest, 'SKILL.md'), 'utf8')).toBe(
      fs.readFileSync(path.join(resolveSkillSourceDir(), 'SKILL.md'), 'utf8'),
    );
  });

  it('is idempotent without --force', () => {
    const repo = makeTempDir();
    expect(runInstallSkill({ cwd: repo })).toBe(0);
    fs.writeFileSync(
      path.join(repo, '.cursor', 'skills', SKILL_NAME, 'SKILL.md'),
      'USER EDIT',
      'utf8',
    );
    expect(runInstallSkill({ cwd: repo })).toBe(0);
    expect(
      fs.readFileSync(path.join(repo, '.cursor', 'skills', SKILL_NAME, 'SKILL.md'), 'utf8'),
    ).toBe('USER EDIT');
  });

  it('replaces existing skill with --force', () => {
    const repo = makeTempDir();
    runInstallSkill({ cwd: repo });
    fs.writeFileSync(
      path.join(repo, '.cursor', 'skills', SKILL_NAME, 'SKILL.md'),
      'USER EDIT',
      'utf8',
    );
    expect(runInstallSkill({ cwd: repo, force: true })).toBe(0);
    expect(
      fs.readFileSync(path.join(repo, '.cursor', 'skills', SKILL_NAME, 'SKILL.md'), 'utf8'),
    ).toBe(fs.readFileSync(path.join(resolveSkillSourceDir(), 'SKILL.md'), 'utf8'));
  });

  it('resolves global destination path', () => {
    expect(resolveSkillDestDir({ global: true })).toBe(
      path.join(os.homedir(), '.cursor', 'skills', SKILL_NAME),
    );
  });
});
