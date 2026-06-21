import fs from 'node:fs';
import path from 'node:path';
import { DocIndex } from '../index/doc-index.js';
import {
  DOC_STATUSES,
  DOC_TYPES,
  isDocStatus,
  isDocType,
} from '../index/types.js';

const ORPHAN_WORKTREE_DAYS = 7;

export interface CheckOptions {
  cwd?: string;
}

export interface CheckViolation {
  path: string;
  message: string;
}

export function runCheck(options: CheckOptions = {}): number {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const index = new DocIndex(cwd);
  const knowledgeRoot = index.getKnowledgeRoot();

  if (!knowledgeRoot) {
    console.error('no .project-knowledge/ found — run `repo-mind init`');
    return 1;
  }

  const violations: CheckViolation[] = [];
  const warnings: string[] = [];
  const docs = index.refresh();
  const slugCounts = new Map<string, number>();
  const slugSet = new Set(docs.map((doc) => doc.slug));

  for (const doc of docs) {
    slugCounts.set(doc.slug, (slugCounts.get(doc.slug) ?? 0) + 1);

    if (!isDocType(doc.frontmatter.type)) {
      violations.push({
        path: doc.path,
        message: `invalid type "${String(doc.frontmatter.type)}" — expected one of: ${DOC_TYPES.join(', ')}`,
      });
    }

    if (!isDocStatus(doc.frontmatter.status)) {
      violations.push({
        path: doc.path,
        message: `invalid status "${String(doc.frontmatter.status)}" — expected one of: ${DOC_STATUSES.join(', ')}`,
      });
    }

    if (!doc.slug) {
      violations.push({ path: doc.path, message: 'missing slug in frontmatter' });
    }

    for (const related of doc.related) {
      if (!slugSet.has(related)) {
        violations.push({
          path: doc.path,
          message: `broken related slug "${related}"`,
        });
      }
    }
  }

  for (const [slug, count] of slugCounts) {
    if (count > 1) {
      violations.push({
        path: knowledgeRoot,
        message: `duplicate slug "${slug}" (${count} docs)`,
      });
    }
  }

  const worktreesDir = path.join(knowledgeRoot, '.worktrees');
  if (fs.existsSync(worktreesDir)) {
    const cutoff = Date.now() - ORPHAN_WORKTREE_DAYS * 24 * 60 * 60 * 1000;
    for (const entry of fs.readdirSync(worktreesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const entryPath = path.join(worktreesDir, entry.name);
      const stat = fs.statSync(entryPath);
      if (stat.mtimeMs < cutoff) {
        warnings.push(
          `orphaned worktree older than ${ORPHAN_WORKTREE_DAYS} days: ${entryPath}`,
        );
      }
    }
  }

  for (const violation of violations) {
    console.error(`${violation.path}: ${violation.message}`);
  }
  for (const warning of warnings) {
    console.warn(`warning: ${warning}`);
  }

  return violations.length > 0 ? 1 : 0;
}
