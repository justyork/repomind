import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { fileURLToPath } from 'node:url';
import type { DocType } from '../index/types.js';

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

const TEMPLATES_DIR = path.join(PACKAGE_ROOT, 'templates');

const TEMPLATE_LABELS: Record<string, { label: string; type: DocType }> = {
  'adr-example': { label: 'ADR', type: 'adr' },
  'feature-spec-example': { label: 'Feature spec', type: 'feature-spec' },
  'glossary-term-example': { label: 'Glossary term', type: 'glossary-term' },
  'open-question-example': { label: 'Open question', type: 'open-question' },
  'agent-instruction-example': { label: 'Agent instruction', type: 'agent-instruction' },
  'combat-system-example': { label: 'Feature spec (example)', type: 'feature-spec' },
};

export interface TemplateInfo {
  id: string;
  label: string;
  type: DocType;
  filename: string;
}

export function listPageTemplates(): TemplateInfo[] {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    return [];
  }

  const templates: TemplateInfo[] = [];
  for (const filename of fs.readdirSync(TEMPLATES_DIR)) {
    if (!filename.endsWith('.md')) {
      continue;
    }
    const id = filename.replace(/\.md$/, '');
    const meta = TEMPLATE_LABELS[id] ?? { label: id, type: 'wiki-page' as DocType };
    templates.push({ id, label: meta.label, type: meta.type, filename });
  }

  return templates.sort((a, b) => a.label.localeCompare(b.label));
}

export function readPageTemplate(templateId: string): { body: string; title?: string } {
  const safeId = templateId.replace(/[^a-zA-Z0-9_-]/g, '');
  const filePath = path.join(TEMPLATES_DIR, `${safeId}.md`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`unknown template: ${templateId}`);
  }

  const parsed = matter(fs.readFileSync(filePath, 'utf8'));
  const title = typeof parsed.data.title === 'string' ? parsed.data.title : undefined;
  return { body: parsed.content.trimStart(), title };
}
