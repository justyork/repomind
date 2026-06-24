import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export class GitCommandError extends Error {
  readonly command: string;

  constructor(command: string, message: string) {
    super(message);
    this.name = 'GitCommandError';
    this.command = command;
  }
}

export function commandExists(command: string): boolean {
  try {
    execFileSync(command, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function findGitRoot(startDir: string): string | null {
  let current = path.resolve(startDir);

  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function gitExec(repoRoot: string, args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error: unknown) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error
        ? String((error as { stderr: Buffer }).stderr)
        : String(error);
    throw new GitCommandError(`git ${args.join(' ')}`, stderr.trim() || 'git command failed');
  }
}

export function toRepoRelativePath(repoRoot: string, absolutePath: string): string {
  return path.relative(repoRoot, absolutePath).replace(/\\/g, '/');
}

export function currentBranch(repoRoot: string): string {
  return gitExec(repoRoot, ['rev-parse', '--abbrev-ref', 'HEAD']);
}

export function branchExists(repoRoot: string, branchName: string): boolean {
  try {
    gitExec(repoRoot, ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`]);
    return true;
  } catch {
    return false;
  }
}

export function createBranch(repoRoot: string, branchName: string): void {
  gitExec(repoRoot, ['checkout', '-b', branchName]);
}

export function stagePaths(repoRoot: string, relativePaths: string[]): void {
  if (relativePaths.length === 0) {
    return;
  }
  gitExec(repoRoot, ['add', '--', ...relativePaths]);
}

export function commitStaged(repoRoot: string, message: string): string {
  return gitExec(repoRoot, ['commit', '-m', message]);
}

export function pushBranch(repoRoot: string, branchName: string): void {
  gitExec(repoRoot, ['push', '-u', 'origin', branchName]);
}

export function createPullRequest(
  repoRoot: string,
  options: { title: string; body: string; base?: string },
): string {
  const args = ['pr', 'create', '--title', options.title, '--body', options.body];
  if (options.base) {
    args.push('--base', options.base);
  }
  return execFileSync('gh', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}
