import { Node, mergeAttributes } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { filterDocCandidates, type DocCandidate } from './wikilink-autocomplete.js';

export interface WikilinkOptions {
  HTMLAttributes: Record<string, string>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikilink: {
      insertWikilink: (attrs: { slug: string; label: string }) => ReturnType;
    };
  }
}

export const Wikilink = Node.create<WikilinkOptions>({
  name: 'wikilink',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      slug: { default: '' },
      label: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-wikilink-slug]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = String(node.attrs.label || node.attrs.slug);
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-wikilink-slug': node.attrs.slug,
        class: 'wikilink-chip',
      }),
      label,
    ];
  },

  renderText({ node }) {
    const slug = String(node.attrs.slug ?? '');
    const label = String(node.attrs.label ?? slug);
    if (label === slug) {
      return `[[${slug}]]`;
    }
    return `[[${label}|${slug}]]`;
  },

  addCommands() {
    return {
      insertWikilink:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;');
}

export function bindTiptapWikilinkAutocomplete(editor: Editor, docs: DocCandidate[]): () => void {
  const menu = document.createElement('div');
  menu.className = 'wikilink-menu hidden';
  document.body.appendChild(menu);

  let activeFrom = -1;

  function closeMenu(): void {
    menu.classList.add('hidden');
    menu.innerHTML = '';
    activeFrom = -1;
  }

  function positionMenu(): void {
    const view = editor.view;
    const coords = view.coordsAtPos(editor.state.selection.from);
    menu.style.top = `${coords.bottom + 4}px`;
    menu.style.left = `${coords.left}px`;
    menu.style.minWidth = '220px';
  }

  function insertSlug(slug: string): void {
    if (activeFrom < 0) {
      return;
    }
    const to = editor.state.selection.from;
    editor
      .chain()
      .focus()
      .deleteRange({ from: activeFrom, to })
      .insertWikilink({ slug, label: slug })
      .run();
    closeMenu();
  }

  function renderMenu(query: string): void {
    const matches = filterDocCandidates(query, docs);
    if (matches.length === 0) {
      closeMenu();
      return;
    }
    menu.innerHTML = matches
      .map(
        (doc) =>
          `<button type="button" class="wikilink-option" data-slug="${escapeAttr(doc.slug)}">
            <span class="wikilink-option-slug">${escapeHtml(doc.slug)}</span>
            <span class="wikilink-option-title">${escapeHtml(doc.title)}</span>
          </button>`,
      )
      .join('');
    positionMenu();
    menu.classList.remove('hidden');

    menu.querySelectorAll<HTMLButtonElement>('.wikilink-option').forEach((button) => {
      button.addEventListener('mousedown', (event) => {
        event.preventDefault();
        insertSlug(button.dataset.slug ?? '');
      });
    });
  }

  function detectTrigger(): void {
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 80), from, '\n', '\0');
    const match = /\[\[([^\]]*)$/.exec(textBefore);
    if (!match) {
      closeMenu();
      return;
    }
    activeFrom = from - match[0].length;
    renderMenu(match[1] ?? '');
  }

  editor.on('update', detectTrigger);
  editor.on('selectionUpdate', detectTrigger);

  const onBlur = () => {
    setTimeout(closeMenu, 120);
  };
  editor.view.dom.addEventListener('blur', onBlur);

  return () => {
    editor.off('update', detectTrigger);
    editor.off('selectionUpdate', detectTrigger);
    editor.view.dom.removeEventListener('blur', onBlur);
    menu.remove();
  };
}
