import path from 'node:path';
import { branchExists } from '../git/git-exec.js';
import type { DocIndex } from '../index/doc-index.js';
import type { DraftsDb, DraftRow } from '../ui/db/drafts-db.js';
import { publishDraft, resolvePublishTargetPath, validateDraftForPublish } from '../ui/publish.js';

export interface PublishedDraft {
  draftId: string;
  slug: string;
  title: string;
  path: string;
}

export interface BatchPublishFailure {
  draftId: string;
  slug: string;
  code: string;
  message: string;
}

export interface BatchPublishResult {
  published: PublishedDraft[];
  failures: BatchPublishFailure[];
}

export interface BatchPublishOptions {
  draftIds?: string[];
  dryRun?: boolean;
}

function selectDrafts(db: DraftsDb, draftIds?: string[]): DraftRow[] {
  const active = db.listActive();
  if (!draftIds || draftIds.length === 0) {
    return active;
  }

  const byId = new Map(active.map((draft) => [draft.id, draft]));
  return draftIds.map((id) => byId.get(id) ?? null).filter((draft): draft is DraftRow => draft !== null);
}

export function batchPublishDrafts(
  index: DocIndex,
  db: DraftsDb,
  options: BatchPublishOptions = {},
): BatchPublishResult {
  const drafts = selectDrafts(db, options.draftIds);
  const failures: BatchPublishFailure[] = [];
  const validated: DraftRow[] = [];

  for (const draft of drafts) {
    const validation = validateDraftForPublish(index, draft);
    if (validation) {
      failures.push({
        draftId: draft.id,
        slug: draft.slug,
        code: validation.code,
        message: validation.message,
      });
      continue;
    }
    validated.push(draft);
  }

  if (failures.length > 0) {
    return { published: [], failures };
  }

  if (options.dryRun) {
    return {
      published: validated.map((draft) => ({
        draftId: draft.id,
        slug: draft.slug,
        title: draft.title,
        path: resolvePublishTargetPath(index, draft) ?? '(unresolved)',
      })),
      failures: [],
    };
  }

  const published: PublishedDraft[] = [];
  for (const draft of validated) {
    const result = publishDraft(index, draft);
    db.markPublished(draft.id, result.path);
    published.push({
      draftId: draft.id,
      slug: draft.slug,
      title: draft.title,
      path: result.path,
    });
  }

  return { published, failures: [] };
}

export function defaultCommitMessage(published: PublishedDraft[]): string {
  const lines = ['docs: publish via repo-mind', ''];
  for (const item of published) {
    lines.push(`- ${item.slug} (${item.title})`);
  }
  return lines.join('\n').trim();
}

export function defaultPrTitle(published: PublishedDraft[]): string {
  if (published.length === 1) {
    return `docs: publish ${published[0]!.slug}`;
  }
  return `docs: publish ${published.length} pages via repo-mind`;
}

export function defaultPrBody(published: PublishedDraft[]): string {
  const lines = [
    '## Summary',
    '',
    'Published knowledge pages from repo-mind drafts:',
    '',
  ];
  for (const item of published) {
    lines.push(`- \`${item.slug}\` — ${item.title}`);
  }
  lines.push('', '## Test plan', '', '- [ ] `repo-mind check` passes', '- [ ] Pages render in repo-mind UI');
  return lines.join('\n');
}

export function buildPublishBranchName(published: PublishedDraft[]): string {
  const slugPart = published
    .map((item) => item.slug)
    .slice(0, 2)
    .join('-')
    .slice(0, 40);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
  const suffix = slugPart ? `${slugPart}-${stamp}` : stamp;
  return `repo-mind/publish/${suffix}`;
}

export function resolveUniqueBranchName(repoRoot: string, preferred: string): string {
  if (!branchExists(repoRoot, preferred)) {
    return preferred;
  }

  for (let index = 2; index <= 9; index += 1) {
    const candidate = `${preferred}-${index}`;
    if (!branchExists(repoRoot, candidate)) {
      return candidate;
    }
  }

  return `${preferred}-${Date.now().toString(36)}`;
}

export function relativeDocsPaths(repoRoot: string, absolutePaths: string[]): string[] {
  return absolutePaths.map((absolutePath) => path.relative(repoRoot, absolutePath).replace(/\\/g, '/'));
}
