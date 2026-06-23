import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KNOWLEDGE_DIR } from '../index/doc-index.js';
import { DOC_DOMAINS, DOMAIN_LABELS, DOMAIN_TYPE_DIRS } from '../index/types.js';

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

const TEMPLATE_FILES: Array<{ template: string; target: string }> = [
  { template: 'adr-example.md', target: 'technical/adr/use-plain-markdown.md' },
  { template: 'feature-spec-example.md', target: 'technical/specs/user-authentication.md' },
  { template: 'glossary-term-example.md', target: 'shared/glossary/mcp.md' },
  { template: 'open-question-example.md', target: 'product/open-questions/search-ranking.md' },
  { template: 'agent-instruction-example.md', target: 'shared/agents/query-first.md' },
  { template: 'combat-system-example.md', target: 'game-design/specs/combat-system.md' },
];

const KNOWLEDGE_README = `# Project documentation

This \`docs/\` directory is the single source of truth for project knowledge.

## Domains

| Domain | Purpose |
|--------|---------|
| \`product/\` | PRD, roadmap, user value, open product questions |
| \`technical/\` | Architecture, ADR, API, infrastructure |
| \`game-design/\` | Mechanics, balance, systems design |
| \`analytics/\` | Metrics, events, dashboards, experiments |
| \`art/\` | Visual style, assets, UI art guidelines |
| \`narrative/\` | Story, lore, dialogue, quests |
| \`ops/\` | Liveops, release, support runbooks |
| \`shared/\` | Cross-domain glossary, agent rules |

Each domain contains type subfolders (\`specs/\`, \`adr/\`, \`wiki/\`, …). See \`.cursor/skills/repomind-docs/structure.md\` for the full taxonomy.

Humans edit via \`repo-mind ui\`; agents query via MCP (\`search_docs\`, \`get_doc\`).

Run \`npx @justyork/repo-mind check\` to validate frontmatter, domains, and links.
`;

function domainReadme(domain: (typeof DOC_DOMAINS)[number]): string {
  const label = DOMAIN_LABELS[domain];
  const subdirs = DOMAIN_TYPE_DIRS[domain].map((d) => `- \`${d}/\``).join('\n');
  return `# ${label}

Documentation domain: **${domain}**.

## Subfolders

${subdirs}

Add a \`README.md\` in each subfolder when it grows beyond a few pages.
`;
}

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
  fs.mkdirSync(path.join(knowledgeRoot, 'assets'), { recursive: true });

  for (const domain of DOC_DOMAINS) {
    const domainRoot = path.join(knowledgeRoot, domain);
    fs.mkdirSync(domainRoot, { recursive: true });
    writeIfMissing(path.join(domainRoot, 'README.md'), domainReadme(domain));
    for (const subdir of DOMAIN_TYPE_DIRS[domain]) {
      fs.mkdirSync(path.join(domainRoot, subdir), { recursive: true });
    }
  }

  writeIfMissing(path.join(knowledgeRoot, 'README.md'), KNOWLEDGE_README);
  writeIfMissing(path.join(knowledgeRoot, '.gitignore'), KNOWLEDGE_GITIGNORE);

  for (const { template, target } of TEMPLATE_FILES) {
    const source = path.join(PACKAGE_ROOT, 'templates', template);
    const dest = path.join(knowledgeRoot, target);
    writeIfMissing(dest, fs.readFileSync(source, 'utf8'));
  }

  console.log(`Initialized ${KNOWLEDGE_DIR}/ with domain-based example docs.`);
  return 0;
}

function writeIfMissing(filePath: string, content: string): void {
  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');
  }
}
