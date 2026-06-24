import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import CodeBlock from '@tiptap/extension-code-block';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import { uploadAsset } from './api.js';
import { parseMarkdownToDoc, serializeDocToMarkdown } from './markdown-roundtrip.js';
import { bindTiptapSlashMenu } from './tiptap-slash-menu.js';
import { bindTiptapWikilinkAutocomplete, Wikilink } from './tiptap-wikilink.js';
import {
  bindBubbleMenuActions,
  bubbleMenuExtension,
  createBubbleMenuElement,
} from './tiptap-bubble-menu.js';
import {
  bindMermaidThemeRefresh,
  MermaidPreviewExtension,
} from './tiptap-mermaid-preview.js';
import { bindVisualToolbar, buildVisualToolbarHtml } from './tiptap-toolbar.js';
import {
  getSelectedWikilinkAttrs,
  openWikilinkPicker,
  type WikilinkPick,
} from './wikilink-ui.js';
import type { DocCandidate } from './wikilink-autocomplete.js';

export interface VisualEditorOptions {
  initialMarkdown: string;
  docCandidates: DocCandidate[];
  onBodyChange: () => void;
  onError: (message: string) => void;
}

export interface VisualEditorHandle {
  getMarkdownBody: () => string;
  destroy: () => void;
}

const MERMAID_STARTER = 'graph LR\n  A --> B';

export function mountVisualEditor(
  container: HTMLElement,
  options: VisualEditorOptions,
): VisualEditorHandle {
  container.className = 'visual-canvas';
  const bubbleMenuEl = createBubbleMenuElement();
  const inWorkspaceEditor = Boolean(container.closest('.workspace-editor'));
  container.innerHTML = `${buildVisualToolbarHtml(!inWorkspaceEditor)}<div class="visual-editor-mount"></div>`;
  container.appendChild(bubbleMenuEl);

  const mountEl = container.querySelector<HTMLElement>('.visual-editor-mount')!;
  const toolbar = container.querySelector<HTMLElement>('.visual-toolbar')!;
  const doc = parseMarkdownToDoc(options.initialMarkdown);

  const editor = new Editor({
    element: mountEl,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      CodeBlock.configure({
        languageClassPrefix: 'language-',
      }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Placeholder.configure({
        placeholder: 'Start writing, or type / for headings, lists, and links…',
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Wikilink,
      bubbleMenuExtension(bubbleMenuEl),
      MermaidPreviewExtension,
    ],
    content: doc,
    onFocus: () => {
      toolbar.classList.remove('visual-toolbar--collapsed');
    },
    onBlur: () => {
      if (inWorkspaceEditor) {
        return;
      }
      window.setTimeout(() => {
        if (!container.contains(document.activeElement)) {
          toolbar.classList.add('visual-toolbar--collapsed');
        }
      }, 120);
    },
    onUpdate: () => {
      options.onBodyChange();
    },
  });

  const unbindAutocomplete = bindTiptapWikilinkAutocomplete(editor, options.docCandidates);
  const unbindMermaidTheme = bindMermaidThemeRefresh(editor);

  function insertImage(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      void uploadAsset(file, 'assets')
        .then(({ relativePath }) => {
          editor.chain().focus().setImage({ src: relativePath }).run();
        })
        .catch((err: unknown) => {
          options.onError(err instanceof Error ? err.message : 'Image upload failed');
        });
    });
    input.click();
  }

  function applyWikilinkPick(pick: WikilinkPick): void {
    const existing = getSelectedWikilinkAttrs(editor);
    if (existing) {
      editor.chain().focus().updateWikilink(pick).run();
      return;
    }
    editor.chain().focus().insertWikilink(pick).run();
  }

  function insertWikilink(): void {
    const existing = getSelectedWikilinkAttrs(editor);
    openWikilinkPicker({
      docs: options.docCandidates,
      title: existing ? 'Edit page link' : 'Link to page',
      initialQuery: existing?.slug,
      initialLabel: existing?.label,
      onSelect: applyWikilinkPick,
    });
  }

  function insertMermaid(): void {
    const { $from } = editor.state.selection;
    const parent = $from.parent;
    if (parent.type.name === 'codeBlock' && parent.attrs.language === 'mermaid') {
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'codeBlock',
        attrs: { language: 'mermaid' },
        content: [{ type: 'text', text: MERMAID_STARTER }],
      })
      .run();
  }

  function insertTable(): void {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }

  const unbindSlashMenu = bindTiptapSlashMenu(editor, insertImage, insertWikilink, {
    onMermaid: insertMermaid,
    onTable: insertTable,
  });

  const unbindBubble = bindBubbleMenuActions(editor, bubbleMenuEl, {
    onWikilink: insertWikilink,
  });

  const unbindToolbar = bindVisualToolbar(editor, toolbar, {
    onImage: insertImage,
    onWikilink: insertWikilink,
    onTable: insertTable,
    onMermaid: insertMermaid,
  });

  const onWikilinkChipDblClick = (event: MouseEvent): void => {
    const chip = (event.target as HTMLElement).closest<HTMLElement>('[data-wikilink-slug]');
    if (!chip) {
      return;
    }
    event.preventDefault();
    const slug = chip.getAttribute('data-wikilink-slug') ?? '';
    const label = chip.textContent?.trim() || slug;
    const pos = editor.view.posAtDOM(chip, 0);
    editor.chain().focus().setNodeSelection(pos).run();
    openWikilinkPicker({
      docs: options.docCandidates,
      title: 'Edit page link',
      initialQuery: slug,
      initialLabel: label,
      onSelect: applyWikilinkPick,
    });
  };
  mountEl.addEventListener('dblclick', onWikilinkChipDblClick);

  return {
    getMarkdownBody: () => serializeDocToMarkdown(editor.getJSON()),
    destroy: () => {
      mountEl.removeEventListener('dblclick', onWikilinkChipDblClick);
      unbindToolbar();
      unbindMermaidTheme();
      unbindSlashMenu();
      unbindBubble();
      unbindAutocomplete();
      bubbleMenuEl.remove();
      editor.destroy();
    },
  };
}
