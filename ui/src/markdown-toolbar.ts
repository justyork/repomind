type ToolbarAction =
  | { kind: 'wrap'; before: string; after: string }
  | { kind: 'prefix'; prefix: string }
  | { kind: 'link' };

const ACTIONS: Record<string, ToolbarAction> = {
  h1: { kind: 'prefix', prefix: '# ' },
  h2: { kind: 'prefix', prefix: '## ' },
  h3: { kind: 'prefix', prefix: '### ' },
  bold: { kind: 'wrap', before: '**', after: '**' },
  italic: { kind: 'wrap', before: '_', after: '_' },
  link: { kind: 'link' },
  task: { kind: 'prefix', prefix: '- [ ] ' },
};

function applyAction(textarea: HTMLTextAreaElement, action: ToolbarAction): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end);

  if (action.kind === 'prefix') {
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const before = value.slice(0, lineStart);
    const after = value.slice(lineStart);
    textarea.value = `${before}${action.prefix}${after}`;
    const cursor = lineStart + action.prefix.length + (start - lineStart);
    textarea.setSelectionRange(cursor, cursor);
    return;
  }

  if (action.kind === 'link') {
    const label = selected || 'link text';
    const replacement = `[${label}](url)`;
    textarea.value = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
    const urlStart = start + label.length + 3;
    textarea.setSelectionRange(urlStart, urlStart + 3);
    return;
  }

  const replacement = `${action.before}${selected || 'text'}${action.after}`;
  textarea.value = `${value.slice(0, start)}${replacement}${value.slice(end)}`;
  const cursor = start + action.before.length + (selected ? selected.length : 4);
  textarea.setSelectionRange(
    selected ? cursor : start + action.before.length,
    selected ? cursor : start + action.before.length + 4,
  );
}

export function bindMarkdownToolbar(
  container: HTMLElement,
  textarea: HTMLTextAreaElement,
  onChange: () => void,
  options: { onInsertImage?: () => void } = {},
): void {
  container.querySelectorAll<HTMLButtonElement>('[data-md-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.mdAction ?? '';
      if (key === 'image') {
        options.onInsertImage?.();
        return;
      }
      const action = ACTIONS[key];
      if (!action) {
        return;
      }
      applyAction(textarea, action);
      onChange();
      textarea.focus();
    });
  });
}

export function markdownToolbarHtml(): string {
  return `
    <div class="editor-toolbar" role="toolbar" aria-label="Markdown formatting">
      <button type="button" data-md-action="h1" title="Heading 1">H1</button>
      <button type="button" data-md-action="h2" title="Heading 2">H2</button>
      <button type="button" data-md-action="h3" title="Heading 3">H3</button>
      <span class="editor-toolbar-sep" aria-hidden="true"></span>
      <button type="button" data-md-action="bold" title="Bold"><strong>B</strong></button>
      <button type="button" data-md-action="italic" title="Italic"><em>I</em></button>
      <button type="button" data-md-action="link" title="Link">Link</button>
      <button type="button" data-md-action="image" title="Insert image">Image</button>
      <button type="button" data-md-action="task" title="Task list">Task</button>
    </div>
  `;
}
