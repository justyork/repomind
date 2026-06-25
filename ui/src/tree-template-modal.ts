import type { PageTemplate } from './api.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text);
}

function mountPageModal(title: string, bodyHtml: string): {
  backdrop: HTMLDivElement;
  nameInput: HTMLInputElement;
  close: () => void;
} {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal';
  backdrop.innerHTML = `
    <div class="modal-card tree-page-modal" role="dialog" aria-modal="true">
      <h2 class="modal-title">${escapeHtml(title)}</h2>
      ${bodyHtml}
      <div class="modal-actions">
        <button type="button" class="btn-ghost" data-action="cancel">Отмена</button>
        <button type="button" class="btn-primary" data-action="create">Создать</button>
      </div>
    </div>
  `;

  const close = (): void => {
    backdrop.remove();
  };

  const card = backdrop.querySelector<HTMLElement>('.modal-card')!;
  card.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  backdrop.querySelector('[data-action="cancel"]')?.addEventListener('click', close);
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) {
      close();
    }
  });

  const nameInput = backdrop.querySelector<HTMLInputElement>('#tree-page-name')!;
  nameInput.focus();

  document.body.appendChild(backdrop);
  return { backdrop, nameInput, close };
}

function bindNameSubmit(
  backdrop: HTMLDivElement,
  nameInput: HTMLInputElement,
  close: () => void,
  onSubmit: (name: string) => void,
  canSubmit?: () => boolean,
): void {
  const submit = (): void => {
    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }
    if (canSubmit && !canSubmit()) {
      return;
    }
    close();
    onSubmit(name);
  };

  backdrop.querySelector('[data-action="create"]')?.addEventListener('click', submit);
  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
    if (event.key === 'Escape') {
      close();
    }
  });
}

/** Modal with page name only (blank file). */
export function openBlankPageModal(onSubmit: (name: string) => void): void {
  const body = `
    <label class="modal-field">
      <span class="modal-label">Имя (без .md)</span>
      <input type="text" class="modal-input" id="tree-page-name" autocomplete="off" />
    </label>
  `;
  const { backdrop, nameInput, close } = mountPageModal('Новый файл', body);
  bindNameSubmit(backdrop, nameInput, close, onSubmit);
}

/** Modal: page name + template list for tree "Create from template". */
export function openTemplatePageModal(
  templates: PageTemplate[],
  onSubmit: (name: string, templateId: string) => void,
): void {
  const body = `
    <label class="modal-field">
      <span class="modal-label">Имя (без .md)</span>
      <input type="text" class="modal-input" id="tree-page-name" autocomplete="off" />
    </label>
    <div class="modal-field">
      <span class="modal-label" id="tree-template-label">Шаблон</span>
      <div class="tree-template-list" role="listbox" aria-labelledby="tree-template-label">
        ${templates
          .map(
            (template, index) => `
          <button
            type="button"
            class="tree-template-item${index === 0 ? ' is-selected' : ''}"
            role="option"
            aria-selected="${index === 0 ? 'true' : 'false'}"
            data-template-id="${escapeAttr(template.id)}"
          >${escapeHtml(template.label)}</button>`,
          )
          .join('')}
      </div>
    </div>
  `;

  const { backdrop, nameInput, close } = mountPageModal('Новый файл из шаблона', body);
  const list = backdrop.querySelector<HTMLElement>('.tree-template-list')!;
  let selectedTemplateId = templates[0]?.id ?? '';

  list.addEventListener('click', (event) => {
    const item = (event.target as HTMLElement).closest<HTMLButtonElement>('.tree-template-item');
    if (!item?.dataset.templateId) {
      return;
    }
    selectedTemplateId = item.dataset.templateId;
    list.querySelectorAll('.tree-template-item').forEach((button) => {
      const selected = button === item;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-selected', String(selected));
    });
  });

  bindNameSubmit(
    backdrop,
    nameInput,
    close,
    (name) => {
      if (!selectedTemplateId) {
        return;
      }
      onSubmit(name, selectedTemplateId);
    },
    () => Boolean(selectedTemplateId),
  );
}
