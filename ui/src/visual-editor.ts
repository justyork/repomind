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
import { bindMermaidEditorPreviews } from './tiptap-mermaid-preview.js';
import { bindTiptapSlashMenu } from './tiptap-slash-menu.js';
import { bindTiptapWikilinkAutocomplete, Wikilink } from './tiptap-wikilink.js';
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

function toolbarButton(label: string, action: string, title?: string): string {
  const titleAttr = title ? ` title="${title}"` : '';
  return `<button type="button" class="toolbar-btn" data-action="${action}"${titleAttr}>${label}</button>`;
}

function buildToolbarHtml(): string {
  return `
    <div class="editor-toolbar visual-toolbar" role="toolbar" aria-label="Formatting">
      ${toolbarButton('H1', 'h1')}
      ${toolbarButton('H2', 'h2')}
      ${toolbarButton('H3', 'h3')}
      <span class="editor-toolbar-sep"></span>
      ${toolbarButton('B', 'bold', 'Bold')}
      ${toolbarButton('I', 'italic', 'Italic')}
      ${toolbarButton('Link', 'link')}
      <span class="editor-toolbar-sep"></span>
      ${toolbarButton('• List', 'bullet')}
      ${toolbarButton('1. List', 'ordered')}
      ${toolbarButton('☐ Task', 'task')}
      ${toolbarButton('Table', 'table')}
      <span class="editor-toolbar-sep"></span>
      ${toolbarButton('[[', 'wikilink', 'Insert wikilink')}
      ${toolbarButton('Image', 'image')}
      ${toolbarButton('Mermaid', 'mermaid', 'Insert mermaid diagram')}
    </div>
  `;
}

const MERMAID_STARTER = 'graph LR\n  A --> B';

export function mountVisualEditor(
  container: HTMLElement,
  options: VisualEditorOptions,
): VisualEditorHandle {
  container.className = 'visual-canvas';
  container.innerHTML = `${buildToolbarHtml()}<div class="visual-editor-mount"></div>`;

  const mountEl = container.querySelector<HTMLElement>('.visual-editor-mount')!;
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
    ],
    content: doc,
    onUpdate: () => {
      options.onBodyChange();
    },
  });

  const unbindAutocomplete = bindTiptapWikilinkAutocomplete(editor, options.docCandidates);
  const unbindMermaid = bindMermaidEditorPreviews(editor, mountEl);

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

  function insertWikilink(): void {
    const slug = window.prompt('Wikilink slug');
    if (!slug?.trim()) {
      return;
    }
    const trimmed = slug.trim();
    editor.chain().focus().insertWikilink({ slug: trimmed, label: trimmed }).run();
  }

  function insertMermaid(): void {
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

  const toolbar = container.querySelector<HTMLElement>('.visual-toolbar')!;
  toolbar.addEventListener('click', (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
    if (!target) {
      return;
    }
    const action = target.dataset.action;
    switch (action) {
      case 'h1':
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'h2':
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'h3':
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
      case 'bold':
        editor.chain().focus().toggleBold().run();
        break;
      case 'italic':
        editor.chain().focus().toggleItalic().run();
        break;
      case 'link': {
        const previous = editor.getAttributes('link').href as string | undefined;
        const href = window.prompt('URL', previous ?? 'https://');
        if (href === null) {
          break;
        }
        if (href === '') {
          editor.chain().focus().extendMarkRange('link').unsetLink().run();
          break;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
        break;
      }
      case 'bullet':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'ordered':
        editor.chain().focus().toggleOrderedList().run();
        break;
      case 'task':
        editor.chain().focus().toggleTaskList().run();
        break;
      case 'table':
        insertTable();
        break;
      case 'wikilink':
        insertWikilink();
        break;
      case 'image':
        insertImage();
        break;
      case 'mermaid':
        insertMermaid();
        break;
      default:
        break;
    }
  });

  return {
    getMarkdownBody: () => serializeDocToMarkdown(editor.getJSON()),
    destroy: () => {
      unbindMermaid();
      unbindSlashMenu();
      unbindAutocomplete();
      editor.destroy();
    },
  };
}
