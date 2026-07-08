import { marked, type Token, type Tokens } from 'marked';
import type { JSONContent } from '@tiptap/core';
import { formatWikilink, parseWikilinkMatch } from './wikilink-syntax.js';

const INLINE_PATTERN =
  /(\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\)|!\[[^\]]*\]\([^)]+\)|\[\[[^\]]+\]\])/g;

function parseInlineSegment(segment: string): JSONContent[] {
  if (!segment) {
    return [];
  }

  const wikilinkMatch = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/.exec(segment);
  if (wikilinkMatch) {
    const { display, slug } = parseWikilinkMatch(wikilinkMatch[1] ?? '', wikilinkMatch[2]);
    return [{ type: 'wikilink', attrs: { slug, label: display } }];
  }

  const boldMatch = /^\*\*([^*]+)\*\*$/.exec(segment);
  if (boldMatch) {
    return [{ type: 'text', text: boldMatch[1] ?? '', marks: [{ type: 'bold' }] }];
  }

  const italicMatch = /^_([^_]+)_$/.exec(segment);
  if (italicMatch) {
    return [{ type: 'text', text: italicMatch[1] ?? '', marks: [{ type: 'italic' }] }];
  }

  const codeMatch = /^`([^`]+)`$/.exec(segment);
  if (codeMatch) {
    return [{ type: 'text', text: codeMatch[1] ?? '', marks: [{ type: 'code' }] }];
  }

  const imageMatch = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(segment);
  if (imageMatch) {
    return [{ type: 'image', attrs: { src: imageMatch[2] ?? '', alt: imageMatch[1] ?? '' } }];
  }

  const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(segment);
  if (linkMatch) {
    return [
      {
        type: 'text',
        text: linkMatch[1] ?? '',
        marks: [{ type: 'link', attrs: { href: linkMatch[2] ?? '' } }],
      },
    ];
  }

  return [{ type: 'text', text: segment }];
}

function parseInlineMarkdown(text: string): JSONContent[] {
  const nodes: JSONContent[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      nodes.push(...parseInlineSegment(text.slice(lastIndex, index)));
    }
    nodes.push(...parseInlineSegment(match[0] ?? ''));
    lastIndex = index + (match[0]?.length ?? 0);
  }

  if (lastIndex < text.length) {
    nodes.push(...parseInlineSegment(text.slice(lastIndex)));
  }

  if (nodes.length === 0) {
    return [{ type: 'text', text: '' }];
  }

  return nodes;
}

function paragraphFromText(text: string): JSONContent {
  const trimmed = text.trimEnd();
  if (!trimmed) {
    return { type: 'paragraph' };
  }
  return { type: 'paragraph', content: parseInlineMarkdown(trimmed) };
}

function tokensToInlineContent(tokens: Token[]): JSONContent[] {
  const nodes: JSONContent[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        nodes.push(...parseInlineMarkdown((token as Tokens.Text).text));
        break;
      case 'strong': {
        const inner = tokensToInlineContent((token as Tokens.Strong).tokens);
        for (const node of inner) {
          if (node.type === 'text') {
            nodes.push({
              type: 'text',
              text: node.text ?? '',
              marks: [...(node.marks ?? []), { type: 'bold' }],
            });
          } else {
            nodes.push(node);
          }
        }
        break;
      }
      case 'em': {
        const inner = tokensToInlineContent((token as Tokens.Em).tokens);
        for (const node of inner) {
          if (node.type === 'text') {
            nodes.push({
              type: 'text',
              text: node.text ?? '',
              marks: [...(node.marks ?? []), { type: 'italic' }],
            });
          } else {
            nodes.push(node);
          }
        }
        break;
      }
      case 'codespan':
        nodes.push({
          type: 'text',
          text: (token as Tokens.Codespan).text,
          marks: [{ type: 'code' }],
        });
        break;
      case 'link': {
        const linkToken = token as Tokens.Link;
        const inner = tokensToInlineContent(linkToken.tokens);
        for (const node of inner) {
          if (node.type === 'text') {
            nodes.push({
              type: 'text',
              text: node.text ?? '',
              marks: [...(node.marks ?? []), { type: 'link', attrs: { href: linkToken.href } }],
            });
          } else {
            nodes.push(node);
          }
        }
        break;
      }
      case 'image':
        nodes.push({
          type: 'image',
          attrs: {
            src: (token as Tokens.Image).href,
            alt: (token as Tokens.Image).text ?? '',
          },
        });
        break;
      default:
        break;
    }
  }
  return nodes;
}

function listItemContent(item: Tokens.ListItem): JSONContent {
  if (item.task) {
    return {
      type: 'taskItem',
      attrs: { checked: item.checked ?? false },
      content: [{ type: 'paragraph', content: tokensToInlineContent(item.tokens) }],
    };
  }

  const blocks: JSONContent[] = [];
  let inlineBuffer: Token[] = [];

  const flushInline = (): void => {
    if (inlineBuffer.length === 0) {
      return;
    }
    blocks.push({ type: 'paragraph', content: tokensToInlineContent(inlineBuffer) });
    inlineBuffer = [];
  };

  for (const token of item.tokens) {
    if (
      token.type === 'text' ||
      token.type === 'strong' ||
      token.type === 'em' ||
      token.type === 'codespan' ||
      token.type === 'link' ||
      token.type === 'image'
    ) {
      inlineBuffer.push(token);
      continue;
    }
    flushInline();
    blocks.push(...blockTokenToNodes(token));
  }
  flushInline();

  if (blocks.length === 0) {
    return { type: 'listItem', content: [{ type: 'paragraph' }] };
  }

  return { type: 'listItem', content: blocks };
}

function blockTokenToNodes(token: Token): JSONContent[] {
  switch (token.type) {
    case 'heading': {
      const heading = token as Tokens.Heading;
      return [
        {
          type: 'heading',
          attrs: { level: heading.depth },
          content: tokensToInlineContent(heading.tokens),
        },
      ];
    }
    case 'paragraph': {
      const paragraph = token as Tokens.Paragraph;
      if (paragraph.tokens.length > 0) {
        return [{ type: 'paragraph', content: tokensToInlineContent(paragraph.tokens) }];
      }
      return [paragraphFromText(paragraph.text)];
    }
    case 'code': {
      const code = token as Tokens.Code;
      return [
        {
          type: 'codeBlock',
          attrs: code.lang ? { language: code.lang } : undefined,
          content: code.text ? [{ type: 'text', text: code.text }] : undefined,
        },
      ];
    }
    case 'blockquote': {
      const quote = token as Tokens.Blockquote;
      const inner: JSONContent[] = [];
      for (const child of quote.tokens) {
        inner.push(...blockTokenToNodes(child));
      }
      return [{ type: 'blockquote', content: inner.length > 0 ? inner : [{ type: 'paragraph' }] }];
    }
    case 'hr':
      return [{ type: 'horizontalRule' }];
    case 'list': {
      const list = token as Tokens.List;
      const listType = list.items.some((entry) => entry.task)
        ? 'taskList'
        : list.ordered
          ? 'orderedList'
          : 'bulletList';
      const attrs =
        listType === 'orderedList' && list.start != null && list.start !== 1
          ? { start: list.start }
          : undefined;
      return [
        {
          type: listType,
          ...(attrs ? { attrs } : {}),
          content: list.items.map((entry) => listItemContent(entry)),
        },
      ];
    }
    case 'table': {
      const table = token as Tokens.Table;
      const rows: JSONContent[] = [];

      if (table.header.length > 0) {
        rows.push({
          type: 'tableRow',
          content: table.header.map((cell) => ({
            type: 'tableHeader',
            content: [
              {
                type: 'paragraph',
                content: tokensToInlineContent(cell.tokens),
              },
            ],
          })),
        });
      }

      for (const row of table.rows) {
        rows.push({
          type: 'tableRow',
          content: row.map((cell) => ({
            type: 'tableCell',
            content: [
              {
                type: 'paragraph',
                content: tokensToInlineContent(cell.tokens),
              },
            ],
          })),
        });
      }

      return rows.length > 0 ? [{ type: 'table', content: rows }] : [];
    }
    case 'space':
      return [];
    default:
      return [];
  }
}

/** Parse markdown body into TipTap JSON document. */
export function parseMarkdownToDoc(markdown: string): JSONContent {
  const tokens = marked.lexer(markdown, { gfm: true });
  const content: JSONContent[] = [];

  for (const token of tokens) {
    content.push(...blockTokenToNodes(token));
  }

  if (content.length === 0) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  return { type: 'doc', content };
}

function serializeInlineNode(node: JSONContent): string {
  if (node.type === 'wikilink') {
    const slug = String(node.attrs?.slug ?? '');
    const label = String(node.attrs?.label ?? slug);
    return formatWikilink(label, slug);
  }

  if (node.type === 'image') {
    const src = String(node.attrs?.src ?? '');
    const alt = String(node.attrs?.alt ?? '');
    return `![${alt}](${src})`;
  }

  if (node.type === 'hardBreak') {
    return '\n';
  }

  if (node.type !== 'text') {
    return '';
  }

  let text = node.text ?? '';
  const marks = node.marks ?? [];
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        text = `**${text}**`;
        break;
      case 'italic':
        text = `_${text}_`;
        break;
      case 'code':
        text = `\`${text}\``;
        break;
      case 'link':
        text = `[${text}](${String(mark.attrs?.href ?? '')})`;
        break;
      default:
        break;
    }
  }
  return text;
}

function serializeInline(content: JSONContent[] | undefined): string {
  if (!content || content.length === 0) {
    return '';
  }
  return content.map((node) => serializeInlineNode(node)).join('');
}

function escapeTableCell(text: string): string {
  return text.replace(/\|/g, '\\|');
}

function serializeTableCell(cell: JSONContent): string {
  const paragraph = cell.content?.[0];
  return escapeTableCell(serializeInline(paragraph?.content));
}

function serializeTable(node: JSONContent): string {
  const rows = node.content ?? [];
  const lines: string[] = [];
  rows.forEach((row, index) => {
    const cells = (row.content ?? []).map((cell) => serializeTableCell(cell));
    lines.push(`| ${cells.join(' | ')} |`);
    if (index === 0) {
      lines.push(`| ${cells.map(() => '---').join(' | ')} |`);
    }
  });
  return lines.join('\n');
}

function serializeBlock(node: JSONContent): string {
  switch (node.type) {
    case 'table':
      return serializeTable(node);
    case 'paragraph':
      return serializeInline(node.content);
    case 'heading': {
      const level = Number(node.attrs?.level ?? 1);
      const prefix = '#'.repeat(Math.min(3, Math.max(1, level)));
      return `${prefix} ${serializeInline(node.content)}`;
    }
    case 'codeBlock': {
      const lang = String(node.attrs?.language ?? '');
      const text = node.content?.map((child) => child.text ?? '').join('') ?? '';
      return `\`\`\`${lang}\n${text}\n\`\`\``;
    }
    case 'blockquote': {
      const inner = (node.content ?? []).map((child) => serializeBlock(child)).join('\n');
      return inner
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
    }
    case 'horizontalRule':
      return '---';
    case 'bulletList':
      return (node.content ?? [])
        .map((item) => serializeListItem(item, '- '))
        .join('\n');
    case 'orderedList': {
      const start = Number(node.attrs?.start ?? 1);
      return (node.content ?? [])
        .map((item, index) => serializeListItem(item, `${start + index}. `))
        .join('\n');
    }
    case 'taskList':
      return (node.content ?? []).map((item) => serializeTaskItem(item)).join('\n');
    case 'listItem':
      return (node.content ?? []).map((child) => serializeBlock(child)).join('\n');
    default:
      return '';
  }
}

function serializeListItem(item: JSONContent, prefix: string): string {
  const body = (item.content ?? []).map((child) => serializeBlock(child)).join('\n');
  const lines = body.split('\n');
  const first = lines[0] ?? '';
  const rest = lines.slice(1).map((line) => `  ${line}`).join('\n');
  return rest ? `${prefix}${first}\n${rest}` : `${prefix}${first}`;
}

function serializeTaskItem(item: JSONContent): string {
  const checked = Boolean(item.attrs?.checked);
  const box = checked ? '- [x]' : '- [ ]';
  const body = (item.content ?? []).map((child) => serializeBlock(child)).join('\n');
  return `${box} ${body}`;
}

/** Serialize TipTap JSON document to markdown body. */
export function serializeDocToMarkdown(doc: JSONContent): string {
  const blocks = (doc.content ?? [])
    .map((node) => serializeBlock(node))
    .filter((block) => block.length > 0);
  return blocks.join('\n\n');
}

/** Normalize whitespace for round-trip comparison in tests. */
export function normalizeMarkdownForCompare(markdown: string): string {
  return markdown
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Parse and re-serialize markdown (used by editor autosave). */
export function markdownRoundTrip(markdown: string): string {
  return serializeDocToMarkdown(parseMarkdownToDoc(markdown));
}
