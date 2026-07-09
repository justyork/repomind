import fs from 'node:fs';
import path from 'node:path';
import { DocIndex } from '../index/doc-index.js';
import { DOC_TYPES, TYPE_TO_DIR, type DocFrontmatter, type DocType } from '../index/types.js';

/** Generated flat export — distinct from Cursor's `AGENTS.md` (case-insensitive FS clash). */
export const EXPORT_FILENAME = 'agents-export.md';

const TYPE_SECTIONS: Record<DocType, string> = {
  adr: 'ADRs',
  'feature-spec': 'Feature Specs',
  'glossary-term': 'Glossary',
  'open-question': 'Open Questions',
  'agent-instruction': 'Agent Instructions',
  'wiki-page': 'Wiki',
};

export interface ExportOptions {
  cwd?: string;
  force?: boolean;
}

export function runExport(options: ExportOptions = {}): number {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const index = new DocIndex(cwd);
  const knowledgeRoot = index.getKnowledgeRoot();

  if (!knowledgeRoot) {
    console.error('no docs/ found — run `repo-mind init` or create a docs/ directory');
    return 1;
  }

  const repoRoot = path.dirname(knowledgeRoot);
  const outputPath = path.join(repoRoot, EXPORT_FILENAME);

  if (fs.existsSync(outputPath) && !options.force) {
    console.error(`${EXPORT_FILENAME} already exists — pass --force to overwrite`);
    return 1;
  }

  const docs = index.refresh();
  const lines: string[] = ['# Project Knowledge Export', ''];

  for (const type of DOC_TYPES) {
    lines.push(`## ${TYPE_SECTIONS[type]}`, '');
    const typeDocs = docs
      .filter((doc) => doc.type === type)
      .sort((a, b) => a.slug.localeCompare(b.slug));

    if (typeDocs.length === 0) {
      lines.push('_No documents._', '');
      continue;
    }

    for (const doc of typeDocs) {
      lines.push(`### ${doc.title}`, '');
      lines.push(`- slug: ${doc.slug}`);
      lines.push(`- status: ${doc.status}`);
      lines.push('');
      lines.push('```yaml');
      lines.push(renderFrontmatter(doc.frontmatter));
      lines.push('```', '');
      lines.push(doc.body, '');
    }
  }

  fs.writeFileSync(outputPath, `${lines.join('\n').trim()}\n`, 'utf8');
  console.log(`Wrote ${outputPath}`);
  return 0;
}

function renderFrontmatter(frontmatter: DocFrontmatter): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${item}`);
      }
      continue;
    }
    lines.push(`${key}: ${value}`);
  }
  return lines.join('\n');
}

export function resolveExportPath(cwd: string): string {
  const index = new DocIndex(cwd);
  const knowledgeRoot = index.getKnowledgeRoot();
  if (!knowledgeRoot) {
    return path.join(cwd, EXPORT_FILENAME);
  }
  return path.join(path.dirname(knowledgeRoot), EXPORT_FILENAME);
}

export function typeDirFor(type: DocType): string {
  return TYPE_TO_DIR[type];
}
