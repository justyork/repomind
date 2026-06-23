import type { Editor } from '@tiptap/core';

interface SlashCommand {
  id: string;
  label: string;
  keywords: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
  { id: 'h1', label: 'Heading 1', keywords: 'h1 heading' },
  { id: 'h2', label: 'Heading 2', keywords: 'h2 heading' },
  { id: 'h3', label: 'Heading 3', keywords: 'h3 heading' },
  { id: 'bullet', label: 'Bullet list', keywords: 'bullet list ul' },
  { id: 'todo', label: 'Task list', keywords: 'todo task checkbox' },
  { id: 'code', label: 'Code block', keywords: 'code fence' },
  { id: 'image', label: 'Image', keywords: 'image upload' },
  { id: 'link', label: 'Wikilink', keywords: 'link wikilink' },
];

function filterCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase().trim();
  if (!q) {
    return SLASH_COMMANDS;
  }
  return SLASH_COMMANDS.filter(
    (cmd) =>
      cmd.id.includes(q) ||
      cmd.label.toLowerCase().includes(q) ||
      cmd.keywords.includes(q),
  );
}

export function bindTiptapSlashMenu(
  editor: Editor,
  onImage: () => void,
  onWikilink: () => void,
): () => void {
  const menu = document.createElement('div');
  menu.className = 'slash-menu hidden';
  menu.setAttribute('role', 'listbox');
  document.body.appendChild(menu);

  let activeFrom = -1;

  function closeMenu(): void {
    menu.classList.add('hidden');
    menu.innerHTML = '';
    activeFrom = -1;
  }

  function positionMenu(): void {
    const coords = editor.view.coordsAtPos(editor.state.selection.from);
    menu.style.top = `${coords.bottom + 4}px`;
    menu.style.left = `${coords.left}px`;
    menu.style.minWidth = '220px';
  }

  function runCommand(id: string): void {
    if (activeFrom < 0) {
      return;
    }
    const to = editor.state.selection.from;
    editor.chain().focus().deleteRange({ from: activeFrom, to }).run();

    switch (id) {
      case 'h1':
        editor.chain().focus().toggleHeading({ level: 1 }).run();
        break;
      case 'h2':
        editor.chain().focus().toggleHeading({ level: 2 }).run();
        break;
      case 'h3':
        editor.chain().focus().toggleHeading({ level: 3 }).run();
        break;
      case 'bullet':
        editor.chain().focus().toggleBulletList().run();
        break;
      case 'todo':
        editor.chain().focus().toggleTaskList().run();
        break;
      case 'code':
        editor.chain().focus().toggleCodeBlock().run();
        break;
      case 'image':
        onImage();
        break;
      case 'link':
        onWikilink();
        break;
      default:
        break;
    }
    closeMenu();
  }

  function renderMenu(query: string): void {
    const matches = filterCommands(query);
    if (matches.length === 0) {
      closeMenu();
      return;
    }
    menu.innerHTML = matches
      .map(
        (cmd) =>
          `<button type="button" class="slash-option" data-id="${cmd.id}" role="option">
            <span class="slash-option-id">/${cmd.id}</span>
            <span class="slash-option-label">${cmd.label}</span>
          </button>`,
      )
      .join('');
    positionMenu();
    menu.classList.remove('hidden');

    menu.querySelectorAll<HTMLButtonElement>('.slash-option').forEach((button) => {
      button.addEventListener('mousedown', (event) => {
        event.preventDefault();
        runCommand(button.dataset.id ?? '');
      });
    });
  }

  function detectTrigger(): void {
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 40), from, '\n', '\0');
    const match = /(?:^|\s)\/([^\s/]*)$/.exec(textBefore);
    if (!match) {
      closeMenu();
      return;
    }
    activeFrom = from - (match[1]?.length ?? 0) - 1;
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
