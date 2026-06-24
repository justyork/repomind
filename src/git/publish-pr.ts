import {
  commandExists,
  createBranch,
  createPullRequest,
  findGitRoot,
  GitCommandError,
  pushBranch,
  stagePaths,
  commitStaged,
} from '../git/git-exec.js';
import {
  buildPublishBranchName,
  defaultPrBody,
  defaultPrTitle,
  relativeDocsPaths,
  resolveUniqueBranchName,
  type PublishedDraft,
} from '../publish/batch-publish.js';

export type PublishPrErrorCode =
  | 'ENOENT_REPO'
  | 'NO_CHANGES'
  | 'GH_MISSING'
  | 'GIT_ERROR'
  | 'PUSH_FAILED';

export interface PublishPrSuccess {
  branch: string;
  commitMessage: string;
  stagedPaths: string[];
  prUrl?: string;
  pushed: boolean;
}

export interface PublishPrError {
  code: PublishPrErrorCode;
  message: string;
  hint?: string;
}

export type PublishPrResult =
  | { ok: true; data: PublishPrSuccess }
  | { ok: false; error: PublishPrError };

export interface PublishPrOptions {
  repoRoot: string;
  published: PublishedDraft[];
  message: string;
  prTitle: string;
  prBody: string;
  dryRun?: boolean;
  skipPush?: boolean;
  baseBranch?: string;
}

export function runPublishPr(options: PublishPrOptions): PublishPrResult {
  const gitRoot = findGitRoot(options.repoRoot);
  if (!gitRoot) {
    return {
      ok: false,
      error: {
        code: 'ENOENT_REPO',
        message: 'no git repository found — initialize git first',
      },
    };
  }

  const stagedPaths = relativeDocsPaths(
    gitRoot,
    options.published
      .map((item) => item.path)
      .filter((item) => item !== '(dry-run)' && item !== '(unresolved)'),
  );

  if (stagedPaths.length === 0) {
    return {
      ok: false,
      error: { code: 'NO_CHANGES', message: 'no published files to commit' },
    };
  }

  const branch = resolveUniqueBranchName(gitRoot, buildPublishBranchName(options.published));

  if (options.dryRun) {
    return {
      ok: true,
      data: {
        branch,
        commitMessage: options.message,
        stagedPaths,
        pushed: false,
      },
    };
  }

  try {
    createBranch(gitRoot, branch);
    stagePaths(gitRoot, stagedPaths);
    commitStaged(gitRoot, options.message);
  } catch (error: unknown) {
    const message = error instanceof GitCommandError ? error.message : String(error);
    return {
      ok: false,
      error: { code: 'GIT_ERROR', message, hint: 'Resolve git state and retry publish --pr.' },
    };
  }

  if (options.skipPush) {
    return {
      ok: true,
      data: {
        branch,
        commitMessage: options.message,
        stagedPaths,
        pushed: false,
      },
    };
  }

  if (!commandExists('gh')) {
    return {
      ok: false,
      error: {
        code: 'GH_MISSING',
        message: 'GitHub CLI (gh) is not installed',
        hint: `Branch ${branch} was created locally with commit staged paths. Install gh and run: gh pr create`,
      },
    };
  }

  try {
    pushBranch(gitRoot, branch);
  } catch (error: unknown) {
    const message = error instanceof GitCommandError ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'PUSH_FAILED',
        message,
        hint: `Branch ${branch} exists locally. Configure a remote and push manually.`,
      },
    };
  }

  try {
    const prUrl = createPullRequest(gitRoot, {
      title: options.prTitle,
      body: options.prBody,
      base: options.baseBranch,
    });
    return {
      ok: true,
      data: {
        branch,
        commitMessage: options.message,
        stagedPaths,
        prUrl,
        pushed: true,
      },
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: {
        code: 'GIT_ERROR',
        message,
        hint: `Branch ${branch} was pushed. Create the PR manually with gh pr create.`,
      },
    };
  }
}

export function formatDryRunPublishPr(
  published: PublishedDraft[],
  result: PublishPrSuccess,
): string {
  const lines = [
    'dry-run: would publish drafts:',
    ...published.map((item) => `  - ${item.slug} (${item.title})`),
    `dry-run: would create branch ${result.branch}`,
    `dry-run: would commit ${result.stagedPaths.length} file(s):`,
    ...result.stagedPaths.map((item) => `  - ${item}`),
    `dry-run: would push and run gh pr create`,
  ];
  return lines.join('\n');
}
