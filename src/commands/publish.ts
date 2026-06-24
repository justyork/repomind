import path from 'node:path';
import { runCheck } from './check.js';
import { DocIndex } from '../index/doc-index.js';
import { formatDryRunPublishPr, runPublishPr } from '../git/publish-pr.js';
import {
  batchPublishDrafts,
  defaultCommitMessage,
  defaultPrBody,
  defaultPrTitle,
} from '../publish/batch-publish.js';
import { openDraftsDb } from '../ui/db/drafts-db.js';

export interface PublishOptions {
  cwd?: string;
  pr?: boolean;
  dryRun?: boolean;
  message?: string;
  prTitle?: string;
  prBody?: string;
  draftIds?: string[];
  skipPush?: boolean;
}

export function runPublish(options: PublishOptions = {}): number {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const index = new DocIndex(cwd);
  const knowledgeRoot = index.getKnowledgeRoot();

  if (!knowledgeRoot) {
    console.error('no docs/ found — run `repo-mind init` or create a docs/ directory');
    return 1;
  }

  const db = openDraftsDb(knowledgeRoot);
  try {
    const active = db.listActive();
    if (active.length === 0) {
      console.error('no active drafts to publish');
      return 1;
    }

    const batch = batchPublishDrafts(index, db, {
      draftIds: options.draftIds,
      dryRun: options.dryRun,
    });

    if (batch.failures.length > 0) {
      for (const failure of batch.failures) {
        console.error(`${failure.slug}: ${failure.message}`);
      }
      return 1;
    }

    if (batch.published.length === 0) {
      console.error('no drafts matched the publish request');
      return 1;
    }

    if (!options.dryRun) {
      const checkCode = runCheck({ cwd });
      if (checkCode !== 0) {
        console.error('publish aborted — fix check violations before committing');
        return checkCode;
      }
    }

    for (const item of batch.published) {
      if (options.dryRun) {
        console.log(`dry-run: would publish ${item.slug} → ${item.path}`);
      } else {
        const relativePath = path.relative(path.dirname(knowledgeRoot), item.path);
        console.log(`published ${item.slug} → ${relativePath}`);
      }
    }

    if (!options.pr) {
      return 0;
    }

    const repoRoot = path.dirname(knowledgeRoot);
    const message = options.message ?? defaultCommitMessage(batch.published);
    const prTitle = options.prTitle ?? defaultPrTitle(batch.published);
    const prBody = options.prBody ?? defaultPrBody(batch.published);

    const prResult = runPublishPr({
      repoRoot,
      published: batch.published,
      message,
      prTitle,
      prBody,
      dryRun: options.dryRun,
      skipPush: options.skipPush,
    });

    if (!prResult.ok) {
      console.error(`${prResult.error.code}: ${prResult.error.message}`);
      if (prResult.error.hint) {
        console.error(prResult.error.hint);
      }
      return 1;
    }

    if (options.dryRun) {
      console.log(formatDryRunPublishPr(batch.published, prResult.data));
      return 0;
    }

    console.log(`branch: ${prResult.data.branch}`);
    if (prResult.data.pushed) {
      console.log(`pushed: origin/${prResult.data.branch}`);
    }
    if (prResult.data.prUrl) {
      console.log(`pr: ${prResult.data.prUrl}`);
    }
    return 0;
  } finally {
    db.close();
  }
}
