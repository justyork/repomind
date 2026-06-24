import type { Editor } from '@tiptap/core';
import BubbleMenu from '@tiptap/extension-bubble-menu';

function bubbleButton(label: string, action: string, title?: string): string {
  const titleAttr = title ? ` title="${title}"` : '';
  return `<button type="button" class="bubble-btn" data-bubble-action="${action}"${titleAttr}>${label}</button>`;
}

export function createBubbleMenuElement(): HTMLElement {
  const menu = document.createElement('div');
  menu.className = 'editor-bubble-menu';
  menu.setAttribute('role', 'toolbar');
  menu.setAttribute('aria-label', 'Text formatting');
  menu.innerHTML = `
    ${bubbleButton('B', 'bold', 'Bold')}
    ${bubbleButton('I', 'italic', 'Italic')}
    ${bubbleButton('Link', 'link', 'Link')}
    ${bubbleButton('H2', 'h2', 'Heading 2')}
    ${bubbleButton('•', 'bullet', 'Bullet list')}
  `;
  return menu;
}

export function bindBubbleMenuActions(
  editor: Editor,
  menu: HTMLElement,
  handlers: { onWikilink?: () => void },
): () => void {
  const onClick = (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-bubble-action]');
    if (!target) {
      return;
    }
    event.preventDefault();
    const action = target.dataset.bubbleAction;
    switch (action) {
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
      case 'h2':
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'bullet':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'wikilink':
        handlers.onWikilink?.();
        break;
      default:
        break;
    }
  };

  menu.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });
  menu.addEventListener('click', onClick);

  return () => {
    menu.removeEventListener('click', onClick);
  };
}

export function bubbleMenuExtension(element: HTMLElement) {
  return BubbleMenu.configure({
    element,
    tippyOptions: {
      duration: 100,
      placement: 'top',
    },
  });
}
