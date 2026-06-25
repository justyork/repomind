import type { Editor } from '@tiptap/core';
import { hydrateToolbarIcons, lucideIcon } from './lucide-icon.js';

export interface ToolbarHandlers {
  onImage: () => void;
  onWikilink: () => void;
  onTable: () => void;
  onMermaid: () => void;
}

type BlockStyle = 'paragraph' | 'h1' | 'h2' | 'h3';

const BLOCK_STYLE_LABELS: Record<BlockStyle, string> = {
  paragraph: 'Paragraph',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
};

function iconButton(action: string, lucideName: string, label: string): string {
  return `<button type="button" class="toolbar-btn" data-action="${action}" aria-label="${label}" title="${label}">${lucideIcon(lucideName)}</button>`;
}

function blockStyleOption(style: BlockStyle): string {
  return `<button type="button" class="toolbar-dropdown-item" data-block-style="${style}" role="menuitem">${BLOCK_STYLE_LABELS[style]}</button>`;
}

export function buildVisualToolbarHtml(collapsed = true): string {
  const collapsedClass = collapsed ? ' visual-toolbar--collapsed' : '';
  return `
    <div class="editor-toolbar visual-toolbar${collapsedClass}" role="toolbar" aria-label="Formatting">
      <div class="toolbar-inner">
        <div class="toolbar-group">
          <div class="toolbar-dropdown" data-dropdown="block-style">
            <button type="button" class="toolbar-btn toolbar-dropdown-trigger toolbar-style-trigger" aria-haspopup="menu" aria-expanded="false" title="Text style">
              <span class="toolbar-style-label">Paragraph</span>
              ${lucideIcon('chevron-down')}
            </button>
            <div class="toolbar-dropdown-menu hidden" role="menu">
              ${blockStyleOption('paragraph')}
              ${blockStyleOption('h1')}
              ${blockStyleOption('h2')}
              ${blockStyleOption('h3')}
            </div>
          </div>
        </div>
        <span class="toolbar-sep" aria-hidden="true"></span>
        <div class="toolbar-group">
          ${iconButton('bold', 'bold', 'Bold')}
          ${iconButton('italic', 'italic', 'Italic')}
          ${iconButton('link', 'link-2', 'Link')}
        </div>
        <span class="toolbar-sep" aria-hidden="true"></span>
        <div class="toolbar-group">
          ${iconButton('bullet', 'list', 'Bullet list')}
          ${iconButton('ordered', 'list-ordered', 'Numbered list')}
          ${iconButton('task', 'list-todo', 'Task list')}
        </div>
        <span class="toolbar-sep" aria-hidden="true"></span>
        <div class="toolbar-group">
          ${iconButton('code', 'code', 'Code block')}
          ${iconButton('image', 'image', 'Image')}
          ${iconButton('wikilink', 'book-marked', 'Wikilink')}
        </div>
        <span class="toolbar-sep" aria-hidden="true"></span>
        <div class="toolbar-group">
          <div class="toolbar-dropdown" data-dropdown="insert-more">
            <button type="button" class="toolbar-btn toolbar-dropdown-trigger" aria-haspopup="menu" aria-expanded="false" aria-label="Insert more" title="Insert more">
              ${lucideIcon('plus')}
            </button>
            <div class="toolbar-dropdown-menu hidden" role="menu">
              <button type="button" class="toolbar-dropdown-item toolbar-dropdown-item--icon" data-action="table" role="menuitem">
                <span class="toolbar-dropdown-item-icon" aria-hidden="true">${lucideIcon('table')}</span>
                <span>Table</span>
              </button>
              <button type="button" class="toolbar-dropdown-item toolbar-dropdown-item--icon" data-action="mermaid" role="menuitem">
                <span class="toolbar-dropdown-item-icon" aria-hidden="true">${lucideIcon('workflow')}</span>
                <span>Mermaid diagram</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getActiveBlockStyle(editor: Editor): BlockStyle {
  if (editor.isActive('heading', { level: 1 })) {
    return 'h1';
  }
  if (editor.isActive('heading', { level: 2 })) {
    return 'h2';
  }
  if (editor.isActive('heading', { level: 3 })) {
    return 'h3';
  }
  return 'paragraph';
}

function applyLink(editor: Editor): void {
  const previous = editor.getAttributes('link').href as string | undefined;
  const href = window.prompt('URL', previous ?? 'https://');
  if (href === null) {
    return;
  }
  if (href === '') {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    return;
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
}

function applyBlockStyle(editor: Editor, style: BlockStyle): void {
  switch (style) {
    case 'paragraph':
      editor.chain().focus().setParagraph().run();
      break;
    case 'h1':
      editor.chain().focus().toggleHeading({ level: 1 }).run();
      break;
    case 'h2':
      editor.chain().focus().toggleHeading({ level: 2 }).run();
      break;
    case 'h3':
      editor.chain().focus().toggleHeading({ level: 3 }).run();
      break;
    default: {
      const _exhaustive: never = style;
      return _exhaustive;
    }
  }
}

function runToolbarAction(editor: Editor, action: string, handlers: ToolbarHandlers): void {
  switch (action) {
    case 'bold':
      editor.chain().focus().toggleBold().run();
      break;
    case 'italic':
      editor.chain().focus().toggleItalic().run();
      break;
    case 'link':
      applyLink(editor);
      break;
    case 'bullet':
      editor.chain().focus().toggleBulletList().run();
      break;
    case 'ordered':
      editor.chain().focus().toggleOrderedList().run();
      break;
    case 'task':
      editor.chain().focus().toggleTaskList().run();
      break;
    case 'code':
      editor.chain().focus().toggleCodeBlock().run();
      break;
    case 'image':
      handlers.onImage();
      break;
    case 'wikilink':
      handlers.onWikilink();
      break;
    case 'table':
      handlers.onTable();
      break;
    case 'mermaid':
      handlers.onMermaid();
      break;
    default:
      break;
  }
}

function resetDropdownMenu(menu: HTMLElement): void {
  menu.classList.add('hidden');
  menu.classList.remove('toolbar-dropdown-menu--floating');
  menu.style.top = '';
  menu.style.left = '';
  menu.style.minWidth = '';
}

function closeAllDropdowns(toolbar: HTMLElement): void {
  toolbar.querySelectorAll<HTMLElement>('.toolbar-dropdown-menu').forEach((menu) => {
    resetDropdownMenu(menu);
  });
  toolbar.querySelectorAll<HTMLButtonElement>('.toolbar-dropdown-trigger').forEach((trigger) => {
    trigger.setAttribute('aria-expanded', 'false');
  });
}

function positionFloatingMenu(dropdown: HTMLElement, menu: HTMLElement): void {
  const trigger = dropdown.querySelector<HTMLElement>('.toolbar-dropdown-trigger');
  if (!trigger) {
    return;
  }
  const rect = trigger.getBoundingClientRect();
  menu.classList.add('toolbar-dropdown-menu--floating');
  menu.style.top = `${rect.bottom + 4}px`;
  menu.style.left = `${rect.left}px`;
  menu.style.minWidth = `${Math.max(rect.width, 144)}px`;
}

function toggleDropdown(toolbar: HTMLElement, dropdown: HTMLElement): void {
  const menu = dropdown.querySelector<HTMLElement>('.toolbar-dropdown-menu');
  const trigger = dropdown.querySelector<HTMLButtonElement>('.toolbar-dropdown-trigger');
  if (!menu || !trigger) {
    return;
  }
  const willOpen = menu.classList.contains('hidden');
  closeAllDropdowns(toolbar);
  if (willOpen) {
    menu.classList.remove('hidden');
    positionFloatingMenu(dropdown, menu);
    trigger.setAttribute('aria-expanded', 'true');
  }
}

function syncToolbarState(editor: Editor, toolbar: HTMLElement): void {
  const style = getActiveBlockStyle(editor);
  const styleLabel = toolbar.querySelector<HTMLElement>('.toolbar-style-label');
  if (styleLabel) {
    styleLabel.textContent = BLOCK_STYLE_LABELS[style];
  }

  toolbar.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
    const action = button.dataset.action;
    let active = false;
    switch (action) {
      case 'bold':
        active = editor.isActive('bold');
        break;
      case 'italic':
        active = editor.isActive('italic');
        break;
      case 'link':
        active = editor.isActive('link');
        break;
      case 'bullet':
        active = editor.isActive('bulletList');
        break;
      case 'ordered':
        active = editor.isActive('orderedList');
        break;
      case 'task':
        active = editor.isActive('taskList');
        break;
      case 'code':
        active = editor.isActive('codeBlock');
        break;
      default:
        break;
    }
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  toolbar.querySelectorAll<HTMLButtonElement>('[data-block-style]').forEach((button) => {
    const isCurrent = button.dataset.blockStyle === style;
    button.classList.toggle('is-current', isCurrent);
    button.setAttribute('aria-checked', String(isCurrent));
  });
}

export function bindVisualToolbar(
  editor: Editor,
  toolbar: HTMLElement,
  handlers: ToolbarHandlers,
): () => void {
  hydrateToolbarIcons(toolbar);

  const sync = (): void => {
    syncToolbarState(editor, toolbar);
  };

  const onToolbarMouseDown = (event: MouseEvent): void => {
    event.preventDefault();
  };

  const onToolbarClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;

    const dropdownTrigger = target.closest<HTMLButtonElement>('.toolbar-dropdown-trigger');
    if (dropdownTrigger) {
      const dropdown = dropdownTrigger.closest<HTMLElement>('.toolbar-dropdown');
      if (dropdown) {
        toggleDropdown(toolbar, dropdown);
      }
      return;
    }

    const blockStyleBtn = target.closest<HTMLButtonElement>('[data-block-style]');
    if (blockStyleBtn?.dataset.blockStyle) {
      applyBlockStyle(editor, blockStyleBtn.dataset.blockStyle as BlockStyle);
      closeAllDropdowns(toolbar);
      sync();
      return;
    }

    const actionBtn = target.closest<HTMLButtonElement>('[data-action]');
    if (actionBtn?.dataset.action) {
      runToolbarAction(editor, actionBtn.dataset.action, handlers);
      closeAllDropdowns(toolbar);
      sync();
    }
  };

  const onDocumentClick = (event: MouseEvent): void => {
    if (!toolbar.contains(event.target as Node)) {
      closeAllDropdowns(toolbar);
    }
  };

  const onReposition = (): void => {
    closeAllDropdowns(toolbar);
  };

  const scrollRoot =
    toolbar.closest('.visual-canvas')?.querySelector<HTMLElement>('.visual-editor-mount') ?? null;

  editor.on('selectionUpdate', sync);
  editor.on('transaction', sync);
  sync();

  toolbar.addEventListener('mousedown', onToolbarMouseDown);
  toolbar.addEventListener('click', onToolbarClick);
  document.addEventListener('click', onDocumentClick);
  window.addEventListener('resize', onReposition);
  scrollRoot?.addEventListener('scroll', onReposition, { passive: true });

  return () => {
    editor.off('selectionUpdate', sync);
    editor.off('transaction', sync);
    toolbar.removeEventListener('mousedown', onToolbarMouseDown);
    toolbar.removeEventListener('click', onToolbarClick);
    document.removeEventListener('click', onDocumentClick);
    window.removeEventListener('resize', onReposition);
    scrollRoot?.removeEventListener('scroll', onReposition);
    closeAllDropdowns(toolbar);
  };
}
