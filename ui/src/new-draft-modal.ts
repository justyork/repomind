const DOC_TYPES = [
  'adr',
  'feature-spec',
  'glossary-term',
  'open-question',
  'agent-instruction',
] as const;

export interface NewDraftValues {
  slug: string;
  type: string;
}

export function showNewDraftModal(existingSlugs: string[]): Promise<NewDraftValues | null> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal';
    overlay.innerHTML = `
      <div class="modal-card modal-card-wide">
        <h3 class="modal-title">New draft</h3>
        <div class="field">
          <label for="nd-slug">Slug</label>
          <input id="nd-slug" type="text" placeholder="lowercase-with-hyphens" autocomplete="off" />
          <p id="nd-slug-hint" class="field-hint hidden"></p>
        </div>
        <div class="field">
          <label for="nd-type">Type</label>
          <select id="nd-type">
            ${DOC_TYPES.map((t) => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div class="editor-actions">
          <button type="button" id="nd-create" class="btn-primary">Create</button>
          <button type="button" id="nd-cancel" class="btn-ghost">Cancel</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const slugInput = overlay.querySelector<HTMLInputElement>('#nd-slug')!;
    const typeSelect = overlay.querySelector<HTMLSelectElement>('#nd-type')!;
    const hintEl = overlay.querySelector<HTMLParagraphElement>('#nd-slug-hint')!;
    const slugSet = new Set(existingSlugs);

    function close(result: NewDraftValues | null): void {
      overlay.remove();
      resolve(result);
    }

    function validateSlug(raw: string): string | null {
      const slug = raw.trim().toLowerCase();
      if (!slug) {
        return 'Slug is required';
      }
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return 'Use lowercase letters, numbers, and hyphens only';
      }
      if (slugSet.has(slug)) {
        return `Slug "${slug}" already exists`;
      }
      return null;
    }

    function updateHint(): void {
      const error = validateSlug(slugInput.value);
      if (error) {
        hintEl.textContent = error;
        hintEl.classList.remove('hidden');
      } else {
        hintEl.classList.add('hidden');
      }
    }

    slugInput.addEventListener('input', updateHint);
    slugInput.focus();

    overlay.querySelector('#nd-cancel')?.addEventListener('click', () => close(null));
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        close(null);
      }
    });

    overlay.querySelector('#nd-create')?.addEventListener('click', () => {
      const error = validateSlug(slugInput.value);
      if (error) {
        hintEl.textContent = error;
        hintEl.classList.remove('hidden');
        return;
      }
      close({ slug: slugInput.value.trim().toLowerCase(), type: typeSelect.value });
    });

    slugInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        overlay.querySelector<HTMLButtonElement>('#nd-create')?.click();
      }
      if (event.key === 'Escape') {
        close(null);
      }
    });
  });
}
