const FOCUS_STORAGE_KEY = 'repomind-page-info-hidden';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function loadFocusMode(): boolean {
  try {
    const raw = localStorage.getItem(FOCUS_STORAGE_KEY);
    if (raw === null) {
      return true;
    }
    return raw === 'true';
  } catch {
    return true;
  }
}

export function saveFocusMode(hidden: boolean): void {
  try {
    localStorage.setItem(FOCUS_STORAGE_KEY, hidden ? 'true' : 'false');
  } catch {
    // ignore
  }
}

export interface BreadcrumbItem {
  label: string;
  current?: boolean;
  crumbId?: string;
}

export function renderBreadcrumb(items: BreadcrumbItem[]): string {
  return items
    .map((item, index) => {
      const sep = index > 0 ? '<span class="crumb-sep">›</span>' : '';
      if (item.current) {
        return `${sep}<span class="crumb current">${escapeHtml(item.label)}</span>`;
      }
      if (item.crumbId) {
        return `${sep}<button type="button" class="crumb" data-crumb="${escapeHtml(item.crumbId)}">${escapeHtml(item.label)}</button>`;
      }
      return `${sep}<span class="crumb">${escapeHtml(item.label)}</span>`;
    })
    .join('');
}

export interface PageShellOptions {
  rootClass?: string;
  breadcrumbs: BreadcrumbItem[];
  titleHtml: string;
  actionsHtml: string;
  mainHtml: string;
  railHtml: string;
  focusMode?: boolean;
}

export interface PageShellRefs {
  pageLayout: HTMLElement;
  bodySlot: HTMLElement;
  railSlot: HTMLElement;
  setFocusMode: (hidden: boolean) => void;
}

export function renderPageShell(
  container: HTMLElement,
  options: PageShellOptions,
): PageShellRefs {
  const focusMode = options.focusMode ?? loadFocusMode();
  container.className = options.rootClass ?? 'workspace-main';
  container.innerHTML = `
    <nav class="breadcrumb" aria-label="Breadcrumb">
      ${renderBreadcrumb(options.breadcrumbs)}
    </nav>
    <div class="page-layout${focusMode ? ' page-layout--focus' : ''}">
      <article class="page-content">
        <header class="page-header">
          <div class="page-title-slot">${options.titleHtml}</div>
          <div class="workspace-actions">${options.actionsHtml}</div>
        </header>
        <div class="page-body-slot">${options.mainHtml}</div>
      </article>
      <aside class="page-info">${options.railHtml}</aside>
    </div>
  `;

  const pageLayout = container.querySelector<HTMLElement>('.page-layout')!;

  return {
    pageLayout,
    bodySlot: container.querySelector<HTMLElement>('.page-body-slot')!,
    railSlot: container.querySelector<HTMLElement>('.page-info')!,
    setFocusMode(hidden: boolean) {
      pageLayout.classList.toggle('page-layout--focus', hidden);
      saveFocusMode(hidden);
    },
  };
}

export function bindFocusToggle(
  container: HTMLElement,
  initialHidden: boolean,
  onChange?: (hidden: boolean) => void,
): void {
  const btn = container.querySelector<HTMLButtonElement>('#toggle-focus');
  const layout = container.querySelector<HTMLElement>('.page-layout');
  if (!btn || !layout) {
    return;
  }

  layout.classList.toggle('page-layout--focus', initialHidden);
  btn.setAttribute('aria-pressed', String(initialHidden));
  btn.textContent = initialHidden ? 'Show info' : 'Hide info';

  btn.addEventListener('click', () => {
    const next = !layout.classList.contains('page-layout--focus');
    layout.classList.toggle('page-layout--focus', next);
    saveFocusMode(next);
    btn.setAttribute('aria-pressed', String(next));
    btn.textContent = next ? 'Show info' : 'Hide info';
    onChange?.(next);
  });
}

export function bindBreadcrumbNavigation(
  container: HTMLElement,
  handlers: Record<string, () => void>,
): void {
  container.querySelectorAll<HTMLButtonElement>('.breadcrumb [data-crumb]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.crumb;
      if (id && handlers[id]) {
        handlers[id]();
      }
    });
  });
}
