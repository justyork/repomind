const STORAGE_KEY = 'repomind-sidebar-width';
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;
const DEFAULT_WIDTH = 280;

function clampWidth(width: number): number {
  return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width));
}

function readSavedWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_WIDTH;
    }
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? clampWidth(parsed) : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

function applyWidth(layout: HTMLElement, width: number): void {
  layout.style.setProperty('--sidebar-width', `${width}px`);
}

/** Drag handle to resize the docs sidebar; width persists in localStorage. */
export function bindSidebarResize(layout: HTMLElement): () => void {
  const initial = readSavedWidth();
  applyWidth(layout, initial);

  const handle = document.createElement('div');
  handle.className = 'sidebar-resize-handle';
  handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-orientation', 'vertical');
  handle.setAttribute('aria-label', 'Resize sidebar');
  handle.tabIndex = 0;

  const sidebar = layout.querySelector<HTMLElement>('#sidebar');
  if (sidebar?.nextSibling) {
    layout.insertBefore(handle, sidebar.nextSibling);
  } else {
    layout.appendChild(handle);
  }

  let dragging = false;
  let startX = 0;
  let startWidth = initial;

  const onPointerMove = (event: PointerEvent): void => {
    if (!dragging) {
      return;
    }
    const delta = event.clientX - startX;
    applyWidth(layout, clampWidth(startWidth + delta));
  };

  const stopDrag = (): void => {
    if (!dragging) {
      return;
    }
    dragging = false;
    handle.classList.remove('is-dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    const width = readComputedWidth(layout);
    localStorage.setItem(STORAGE_KEY, String(width));
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', stopDrag);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) {
      return;
    }
    dragging = true;
    startX = event.clientX;
    startWidth = readComputedWidth(layout);
    handle.classList.add('is-dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    handle.setPointerCapture(event.pointerId);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDrag);
  };

  const onKeyDown = (event: KeyboardEvent): void => {
    const step = event.shiftKey ? 40 : 16;
    let width = readComputedWidth(layout);
    if (event.key === 'ArrowLeft') {
      width = clampWidth(width - step);
    } else if (event.key === 'ArrowRight') {
      width = clampWidth(width + step);
    } else if (event.key === 'Home') {
      width = MIN_WIDTH;
    } else if (event.key === 'End') {
      width = MAX_WIDTH;
    } else {
      return;
    }
    event.preventDefault();
    applyWidth(layout, width);
    localStorage.setItem(STORAGE_KEY, String(width));
  };

  const onDoubleClick = (): void => {
    applyWidth(layout, DEFAULT_WIDTH);
    localStorage.setItem(STORAGE_KEY, String(DEFAULT_WIDTH));
  };

  handle.addEventListener('pointerdown', onPointerDown);
  handle.addEventListener('keydown', onKeyDown);
  handle.addEventListener('dblclick', onDoubleClick);

  return () => {
    handle.removeEventListener('pointerdown', onPointerDown);
    handle.removeEventListener('keydown', onKeyDown);
    handle.removeEventListener('dblclick', onDoubleClick);
    handle.remove();
  };
}

function readComputedWidth(layout: HTMLElement): number {
  const raw = getComputedStyle(layout).getPropertyValue('--sidebar-width').trim();
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_WIDTH;
}
