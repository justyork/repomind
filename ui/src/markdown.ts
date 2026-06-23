import { marked, type Tokens } from 'marked';

import { slugForMarkdownHref, assetApiUrl } from './resolve-md-href.js';
import { parseWikilinkMatch, WIKILINK_PATTERN } from './wikilink-syntax.js';

let configured = false;
let renderContext: MarkdownRenderContext | null = null;

export interface MarkdownRenderContext {
  docRelativePath: string;
  slugByRelative: Map<string, string>;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function preprocessWikilinks(markdown: string): string {
  return markdown.replace(WIKILINK_PATTERN, (_, display, slugPart) => {
    const { display: label, slug } = parseWikilinkMatch(display, slugPart);
    const encoded = encodeURIComponent(slug);
    return `[${label}](#wikilink:${encoded})`;
  });
}

function configureMarked(): void {
  if (configured) {
    return;
  }

  marked.use({
    gfm: true,
    renderer: {
      code({ text, lang }) {
        if (lang === 'mermaid') {
          return `<div class="mermaid-wrapper"><pre class="mermaid">${escapeHtml(text.trim())}</pre></div>\n`;
        }
        return false;
      },
      list(token: Tokens.List) {
        const hasTask = token.items.some((item) => item.task);
        if (!hasTask) {
          return false;
        }

        const type = token.ordered ? 'ol' : 'ul';
        const startAttr =
          token.ordered && token.start !== 1 && token.start != null
            ? ` start="${token.start}"`
            : '';
        let body = '';
        for (const item of token.items) {
          body += this.listitem(item);
        }
        return `<${type} class="contains-task-list"${startAttr}>\n${body}</${type}>\n`;
      },
      listitem(item: Tokens.ListItem) {
        if (!item.task) {
          return false;
        }

        const checkbox = `<input type="checkbox" class="task-list-item-checkbox"${
          item.checked ? ' checked' : ''
        } disabled>`;
        const content = this.parser.parse(item.tokens, !!item.loose).trim();
        return `<li class="task-list-item"><label class="task-list-item-label">${checkbox}<span class="task-list-item-content">${content}</span></label></li>\n`;
      },
      image({ href, text, title }) {
        if (!href) {
          return false;
        }
        if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('data:')) {
          return false;
        }
        if (renderContext) {
          const apiUrl = assetApiUrl(renderContext.docRelativePath, href);
          if (apiUrl) {
            const alt = escapeHtml(text || title || '');
            return `<img src="${escapeHtml(apiUrl)}" alt="${alt}" loading="lazy" class="markdown-image">`;
          }
        }
        return false;
      },
      link({ href, text }) {
        if (href?.startsWith('#wikilink:')) {
          const slug = decodeURIComponent(href.slice('#wikilink:'.length));
          return `<a href="#" class="wikilink" data-slug="${escapeHtml(slug)}">${text}</a>`;
        }

        if (renderContext && href) {
          const slug = slugForMarkdownHref(
            renderContext.docRelativePath,
            href,
            renderContext.slugByRelative,
          );
          if (slug) {
            return `<a href="#" class="wikilink" data-slug="${escapeHtml(slug)}">${text}</a>`;
          }
        }

        if (href?.startsWith('http://') || href?.startsWith('https://')) {
          return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
        }

        if (href?.startsWith('mailto:')) {
          return false;
        }

        if (href?.startsWith('#')) {
          return false;
        }

        // * Unresolved relative links must not change browser pathname (SPA is at /).
        if (href) {
          return `<a href="#" class="md-link-unresolved" title="Link not in docs index">${text}</a>`;
        }

        return false;
      },
    },
  });

  configured = true;
}

export function renderMarkdown(markdown: string, context?: MarkdownRenderContext): string {
  configureMarked();
  renderContext = context ?? null;
  try {
    return marked.parse(preprocessWikilinks(markdown), { async: false }) as string;
  } finally {
    renderContext = null;
  }
}

let mermaidTheme: string | null = null;

export async function enhanceMarkdownPreview(root: HTMLElement): Promise<void> {
  const nodes = root.querySelectorAll<HTMLElement>('pre.mermaid');
  if (nodes.length === 0) {
    return;
  }

  const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default';
  const mermaid = await import('mermaid');

  if (mermaidTheme !== theme) {
    mermaid.default.initialize({
      startOnLoad: false,
      theme,
      securityLevel: 'loose',
    });
    mermaidTheme = theme;
  }

  try {
    await mermaid.default.run({ nodes: [...nodes] });
  } catch {
    for (const node of nodes) {
      if (!node.closest('.mermaid-error')) {
        const wrapper = node.parentElement;
        wrapper?.classList.add('mermaid-error');
      }
    }
  }
}
