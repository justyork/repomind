import { moveFsFolder, moveFsPage } from './api.js';

export type TreeDragKind = 'page' | 'folder';

interface TreeDragPayload {
  kind: TreeDragKind;
  path: string;
}

const DRAG_MIME = 'application/x-repomind-tree-node';

function normalizePath(value: string): string {
  return value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function parentPath(relativePath: string): string {
  const normalized = normalizePath(relativePath);
  const slash = normalized.lastIndexOf('/');
  return slash === -1 ? '' : normalized.slice(0, slash);
}

function isDescendantOrEqual(ancestor: string, candidate: string): boolean {
  const a = normalizePath(ancestor);
  const c = normalizePath(candidate);
  if (!a) {
    return true;
  }
  return c === a || c.startsWith(`${a}/`);
}

function parsePayload(event: DragEvent): TreeDragPayload | null {
  const raw = event.dataTransfer?.getData(DRAG_MIME);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as TreeDragPayload;
    if ((parsed.kind !== 'page' && parsed.kind !== 'folder') || typeof parsed.path !== 'string') {
      return null;
    }
    return { kind: parsed.kind, path: normalizePath(parsed.path) };
  } catch {
    return null;
  }
}

function canDropPage(payload: TreeDragPayload, targetDir: string): boolean {
  const from = normalizePath(payload.path);
  const toDir = normalizePath(targetDir);
  if (parentPath(from) === toDir) {
    return false;
  }
  if (isDescendantOrEqual(from.replace(/\.md$/i, ''), toDir)) {
    return false;
  }
  return true;
}

function canDropFolder(payload: TreeDragPayload, targetParent: string): boolean {
  const from = normalizePath(payload.path);
  const toParent = normalizePath(targetParent);
  if (from === toParent) {
    return false;
  }
  if (parentPath(from) === toParent) {
    return false;
  }
  if (isDescendantOrEqual(from, toParent)) {
    return false;
  }
  return true;
}

export interface TreeDnDCallbacks {
  onTreeChanged?: () => void;
  onError?: (message: string) => void;
  onNotify?: (message: string) => void;
}

/** HTML5 drag-and-drop for doc tree pages and folders. */
export function bindTreeDnD(treeEl: HTMLElement, callbacks: TreeDnDCallbacks): () => void {
  let activeDropRow: HTMLElement | null = null;
  let activeDrag: TreeDragPayload | null = null;

  function findDropTarget(event: DragEvent): HTMLElement | null {
    return (event.target as HTMLElement).closest<HTMLElement>('[data-drop-dir]');
  }

  function clearDropHighlight(): void {
    if (activeDropRow) {
      activeDropRow.classList.remove('tree-drop-target', 'tree-drop-invalid');
      activeDropRow = null;
    }
  }

  function setDropHighlight(row: HTMLElement, valid: boolean): void {
    if (activeDropRow && activeDropRow !== row) {
      activeDropRow.classList.remove('tree-drop-target', 'tree-drop-invalid');
    }
    activeDropRow = row;
    row.classList.toggle('tree-drop-target', valid);
    row.classList.toggle('tree-drop-invalid', !valid);
  }

  function resolveDropDir(el: HTMLElement): string | null {
    const dropDir = el.dataset.dropDir;
    if (dropDir === undefined) {
      return null;
    }
    return dropDir;
  }

  async function commitDrop(payload: TreeDragPayload, targetDir: string): Promise<void> {
    try {
      if (payload.kind === 'page') {
        const { result } = await moveFsPage(payload.path, targetDir);
        callbacks.onTreeChanged?.();
        if (result.cascadeUpdated.length > 0) {
          callbacks.onNotify?.(`Moved page; updated links in ${result.cascadeUpdated.length} file(s).`);
        } else if (result.inboundWarnings.length > 0) {
          callbacks.onError?.(
            `${result.inboundWarnings.length} page(s) still reference old slug "${result.previousSlug}".`,
          );
        }
        return;
      }

      const { result } = await moveFsFolder(payload.path, targetDir);
      callbacks.onTreeChanged?.();
      if (result.cascadeUpdated.length > 0) {
        callbacks.onNotify?.(`Moved folder; updated links in ${result.cascadeUpdated.length} file(s).`);
      }
    } catch (err: unknown) {
      callbacks.onError?.(err instanceof Error ? err.message : 'Move failed');
    }
  }

  const onDragStart = (event: DragEvent): void => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('.tree-row[data-drag-kind]');
    if (!row || !event.dataTransfer) {
      return;
    }
    if ((event.target as HTMLElement).closest('.tree-menu, .tree-toggle')) {
      event.preventDefault();
      return;
    }

    const kind = row.dataset.dragKind as TreeDragKind | undefined;
    const path = row.dataset.dragPath;
    if (!kind || !path) {
      event.preventDefault();
      return;
    }

    const payload: TreeDragPayload = { kind, path };
    activeDrag = payload;
    event.dataTransfer.setData(DRAG_MIME, JSON.stringify(payload));
    event.dataTransfer.setData('text/plain', path);
    event.dataTransfer.effectAllowed = 'move';
    row.classList.add('is-dragging');
  };

  const onDragEnd = (event: DragEvent): void => {
    activeDrag = null;
    const row = (event.target as HTMLElement).closest<HTMLElement>('.tree-row');
    row?.classList.remove('is-dragging');
    clearDropHighlight();
  };

  const onDragEnter = (event: DragEvent): void => {
    if (!activeDrag) {
      return;
    }
    const target = findDropTarget(event);
    if (!target) {
      return;
    }
    event.preventDefault();
  };

  const onDragOver = (event: DragEvent): void => {
    const payload = activeDrag ?? parsePayload(event);
    const target = findDropTarget(event);
    if (!payload || !target) {
      return;
    }
    const targetDir = resolveDropDir(target);
    if (targetDir === null) {
      return;
    }

    const valid =
      payload.kind === 'page' ? canDropPage(payload, targetDir) : canDropFolder(payload, targetDir);
    event.preventDefault();
    event.dataTransfer!.dropEffect = valid ? 'move' : 'none';

    const row = target.classList.contains('tree-row')
      ? target
      : target.closest<HTMLElement>('.tree-row');
    if (row) {
      setDropHighlight(row, valid);
    }
  };

  const onDragLeave = (event: DragEvent): void => {
    const target = findDropTarget(event);
    if (!target || target.contains(event.relatedTarget as Node)) {
      return;
    }
    const row = target.classList.contains('tree-row')
      ? target
      : target.closest<HTMLElement>('.tree-row');
    if (row && activeDropRow === row) {
      clearDropHighlight();
    }
  };

  const onDrop = (event: DragEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    const payload = activeDrag ?? parsePayload(event);
    const target = findDropTarget(event);
    const targetDir = target ? resolveDropDir(target) : null;
    clearDropHighlight();
    activeDrag = null;
    if (!payload || targetDir === null) {
      return;
    }

    const valid =
      payload.kind === 'page' ? canDropPage(payload, targetDir) : canDropFolder(payload, targetDir);
    if (!valid) {
      return;
    }

    void commitDrop(payload, targetDir);
  };

  treeEl.addEventListener('dragstart', onDragStart);
  treeEl.addEventListener('dragend', onDragEnd);
  treeEl.addEventListener('dragenter', onDragEnter);
  treeEl.addEventListener('dragover', onDragOver);
  treeEl.addEventListener('dragleave', onDragLeave);
  treeEl.addEventListener('drop', onDrop);

  return () => {
    activeDrag = null;
    treeEl.removeEventListener('dragstart', onDragStart);
    treeEl.removeEventListener('dragend', onDragEnd);
    treeEl.removeEventListener('dragenter', onDragEnter);
    treeEl.removeEventListener('dragover', onDragOver);
    treeEl.removeEventListener('dragleave', onDragLeave);
    treeEl.removeEventListener('drop', onDrop);
    clearDropHighlight();
  };
}

export function applyTreeRowDragSource(
  row: HTMLElement,
  kind: TreeDragKind,
  path: string,
): void {
  row.draggable = true;
  row.dataset.dragKind = kind;
  row.dataset.dragPath = path;
}

export function applyTreeRowDropTarget(row: HTMLElement, dropDir: string): void {
  row.dataset.dropDir = dropDir;
}

export function applyTreeChildrenDropTarget(container: HTMLElement, dropDir: string): void {
  container.dataset.dropDir = dropDir;
}
