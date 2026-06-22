import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KNOWLEDGE_DIR } from '../index/doc-index.js';
import { TYPE_TO_DIR } from '../index/types.js';

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const SUBDIRS = Object.values(TYPE_TO_DIR);

const TEMPLATE_FILES: Array<{ template: string; target: string }> = [
  { template: 'adr-example.md', target: 'adr/use-plain-markdown.md' },
  { template: 'feature-spec-example.md', target: 'specs/user-authentication.md' },
  { template: 'glossary-term-example.md', target: 'glossary/mcp.md' },
  { template: 'open-question-example.md', target: 'open-questions/search-ranking.md' },
  { template: 'agent-instruction-example.md', target: 'agents/query-first.md' },
  { template: 'combat-system-example.md', target: 'specs/combat-system.md' },
];

const KNOWLEDGE_README = `# Project documentation

This \`docs/\` directory is the single source of truth for project knowledge — wiki, architecture, ADR, specs, glossary, and agent rules.

Humans edit via \`repo-mind ui\`; agents query the same files via MCP (\`search_docs\`, \`get_doc\`).

Each structured page uses Markdown with YAML frontmatter. Run \`npx repo-mind check\` to validate schema and links.
Existing markdown without frontmatter is indexed as wiki pages — use the UI **Prepare** flow to add frontmatter.
`;

const KNOWLEDGE_GITIGNORE = `.worktrees/
.repo-mind/
`;

export interface InitOptions {
  cwd?: string;
}

export function runInit(options: InitOptions = {}): number {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const knowledgeRoot = path.join(cwd, KNOWLEDGE_DIR);

  if (!fs.existsSync(path.join(cwd, '.git'))) {
    console.warn('warning: no .git directory found — initialize git for version control');
  }

  fs.mkdirSync(knowledgeRoot, { recursive: true });

  for (const subdir of SUBDIRS) {
    fs.mkdirSync(path.join(knowledgeRoot, subdir), { recursive: true });
  }

  writeIfMissing(path.join(knowledgeRoot, 'README.md'), KNOWLEDGE_README);
  writeIfMissing(path.join(knowledgeRoot, '.gitignore'), KNOWLEDGE_GITIGNORE);

  for (const { template, target } of TEMPLATE_FILES) {
    const source = path.join(PACKAGE_ROOT, 'templates', template);
    const dest = path.join(knowledgeRoot, target);
    writeIfMissing(dest, fs.readFileSync(source, 'utf8'));
  }

  console.log(`Initialized ${KNOWLEDGE_DIR}/ with example docs.`);
  return 0;
}

function writeIfMissing(filePath: string, content: string): void {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }
}
