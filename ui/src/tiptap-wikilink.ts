import { Node, mergeAttributes } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import type { DocCandidate } from './wikilink-autocomplete.js';
import { createWikilinkInlineMenu, type WikilinkPick } from './wikilink-ui.js';

export interface WikilinkOptions {
  HTMLAttributes: Record<string, string>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wikilink: {
      insertWikilink: (attrs: { slug: string; label: string }) => ReturnType;
      updateWikilink: (attrs: { slug: string; label: string }) => ReturnType;
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
    const slug = String(node.attrs.slug ?? '');
    const label = String(node.attrs.label || slug);
    const title = label === slug ? `[[${slug}]]` : `[[${label}|${slug}]]`;
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-wikilink-slug': slug,
        class: 'wikilink-chip',
        title,
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
      updateWikilink:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),
    };
  },
});

export function bindTiptapWikilinkAutocomplete(editor: Editor, docs: DocCandidate[]): () => void {
  let activeFrom = -1;

  const inlineMenu = createWikilinkInlineMenu((pick: WikilinkPick) => {
    if (activeFrom < 0) {
      editor.chain().focus().insertWikilink(pick).run();
      return;
    }
    const to = editor.state.selection.from;
    editor.chain().focus().deleteRange({ from: activeFrom, to }).insertWikilink(pick).run();
    activeFrom = -1;
  });

  function detectTrigger(): void {
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 80), from, '\n', '\0');
    const match = /\[\[([^\]]*)$/.exec(textBefore);
    if (!match) {
      if (!inlineMenu.element.classList.contains('hidden')) {
        inlineMenu.element.classList.add('hidden');
        inlineMenu.element.innerHTML = '';
      }
      activeFrom = -1;
      return;
    }
    activeFrom = from - match[0].length;
    inlineMenu.render(match[1] ?? '', docs);
    const coords = editor.view.coordsAtPos(from);
    inlineMenu.positionAt(coords.left, coords.bottom);
  }

  editor.on('update', detectTrigger);
  editor.on('selectionUpdate', detectTrigger);

  const onBlur = () => {
    setTimeout(() => {
      if (!inlineMenu.element.matches(':hover')) {
        inlineMenu.element.classList.add('hidden');
        inlineMenu.element.innerHTML = '';
        activeFrom = -1;
      }
    }, 150);
  };
  editor.view.dom.addEventListener('blur', onBlur);

  return () => {
    editor.off('update', detectTrigger);
    editor.off('selectionUpdate', detectTrigger);
    editor.view.dom.removeEventListener('blur', onBlur);
    inlineMenu.close();
  };
}
