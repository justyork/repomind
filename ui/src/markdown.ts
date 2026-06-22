import { marked, type Tokens } from 'marked';

let configured = false;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
    },
  });

  configured = true;
}

export function renderMarkdown(markdown: string): string {
  configureMarked();
  return marked.parse(markdown, { async: false }) as string;
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
