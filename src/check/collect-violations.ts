import fs from 'node:fs';
import path from 'node:path';
import type { DocIndex } from '../index/doc-index.js';
import { resolveAssetRelativePath } from '../index/resolve-asset-href.js';
import { parseWikilinkTargets, resolveWikilinkTarget } from '../index/link-index.js';
import { assetExists } from '../ui/serve-asset.js';
import {
  DOC_STATUSES,
  DOC_TYPES,
  isDocStatus,
  isDocType,
} from '../index/types.js';

const ORPHAN_WORKTREE_DAYS = 7;

export interface CheckViolation {
  path: string;
  message: string;
}

export interface CheckReport {
  ok: boolean;
  violations: CheckViolation[];
  warnings: string[];
}

export function collectCheckReport(index: DocIndex): CheckReport | null {
  const knowledgeRoot = index.getKnowledgeRoot();
  if (!knowledgeRoot) {
    return null;
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

    if (doc.contentKind !== 'markdown') {
      if (doc.contentKind === 'json') {
        try {
          JSON.parse(doc.body);
        } catch {
          warnings.push(`invalid JSON syntax in ${doc.relativePath}`);
        }
      }
      continue;
    }

    const lookups = {
      slugSet,
      titleToSlug: new Map(
        docs.flatMap((item) => [
          [item.slug.toLowerCase(), item.slug],
          [item.title.toLowerCase(), item.slug],
        ]),
      ),
    };
    for (const raw of parseWikilinkTargets(doc.body)) {
      const resolved = resolveWikilinkTarget(raw, lookups);
      if (resolved.broken) {
        warnings.push(`broken wikilink [[${raw}]] in ${doc.relativePath}`);
      }
    }

    const imagePattern = /!\[[^\]]*\]\(([^)]+)\)/g;
    for (const match of doc.body.matchAll(imagePattern)) {
      const href = match[1]?.trim() ?? '';
      if (
        !href ||
        href.startsWith('http://') ||
        href.startsWith('https://') ||
        href.startsWith('data:')
      ) {
        continue;
      }
      const relative = resolveAssetRelativePath(doc.relativePath, href);
      if (!relative) {
        warnings.push(`unresolved image path "${href}" in ${doc.relativePath}`);
        continue;
      }
      if (!assetExists(knowledgeRoot, relative)) {
        warnings.push(`missing image asset "${relative}" in ${doc.relativePath}`);
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

  return {
    ok: violations.length === 0,
    violations,
    warnings,
  };
}
