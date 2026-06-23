import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { uploadAsset } from './api.js';
import { parseMarkdownToDoc, serializeDocToMarkdown } from './markdown-roundtrip.js';
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
      <span class="editor-toolbar-sep"></span>
      ${toolbarButton('[[', 'wikilink', 'Insert wikilink')}
      ${toolbarButton('Image', 'image')}
    </div>
  `;
}

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
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Placeholder.configure({ placeholder: 'Start writing…' }),
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
      case 'wikilink': {
        const slug = window.prompt('Wikilink slug');
        if (!slug?.trim()) {
          break;
        }
        const trimmed = slug.trim();
        editor.chain().focus().insertWikilink({ slug: trimmed, label: trimmed }).run();
        break;
      }
      case 'image': {
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
        break;
      }
      default:
        break;
    }
  });

  return {
    getMarkdownBody: () => serializeDocToMarkdown(editor.getJSON()),
    destroy: () => {
      unbindAutocomplete();
      editor.destroy();
    },
  };
}
