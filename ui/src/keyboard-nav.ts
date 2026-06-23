import type { TreeFolderNode } from './api.js';

/** Depth-first slug order matching the sidebar tree (folder READMEs before children). */
export function collectTreeSlugs(tree: TreeFolderNode): string[] {
  const slugs: string[] = [];

  function walkFolder(folder: TreeFolderNode): void {
    if (folder.indexPageSlug) {
      slugs.push(folder.indexPageSlug);
    }
    for (const child of folder.children) {
      if (child.kind === 'page') {
        slugs.push(child.slug);
      } else {
        walkFolder(child);
      }
    }
  }

  walkFolder(tree);
  return slugs;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
    return true;
  }
  return target.isContentEditable;
}

export interface KeyboardNavHandlers {
  onNext: () => void;
  onPrev: () => void;
  onFocusSearch: () => void;
  onEdit: () => void;
}

export function bindKeyboardNav(handlers: KeyboardNavHandlers): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const typing = isTypingTarget(event.target);

    if (event.key === '/' && !typing) {
      event.preventDefault();
      handlers.onFocusSearch();
      return;
    }

    if (typing) {
      return;
    }

    switch (event.key) {
      case 'j':
        event.preventDefault();
        handlers.onNext();
        break;
      case 'k':
        event.preventDefault();
        handlers.onPrev();
        break;
      case 'e':
        handlers.onEdit();
        break;
      default:
        break;
    }
  };

  document.addEventListener('keydown', onKeyDown);
  return () => document.removeEventListener('keydown', onKeyDown);
}
