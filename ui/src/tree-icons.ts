import type { TreeFolderNode } from './api.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const ICON_PATHS = {
  folder:
    'M1.75 5.25A1 1 0 0 1 2.75 4.25h3.85L8 5.65h5.25A1 1 0 0 1 14.25 6.65v5.7a1 1 0 0 1-1 1H2.75a1 1 0 0 1-1-1V5.25z',
  page: 'M4.75 2.25A1 1 0 0 0 3.75 3.25v9.5a1 1 0 0 0 1 1h6.5a1 1 0 0 0 1-1V5.35a1 1 0 0 0-.29-.71L9.11 2.54A1 1 0 0 0 8.46 2.25H4.75zm4.35 1.79L11.75 5.5H9.1V4.04z',
  json: 'M5.1 4.5c-.55 0-1 .45-1 1v1.2c0 .45-.2.85-.5 1.15.3.3.5.7.5 1.15v1.2c0 .55.45 1 1 1M10.9 4.5c.55 0 1 .45 1 1v1.2c0 .45.2.85.5 1.15-.3.3-.5.7-.5 1.15v1.2c0 .55-.45 1-1 1',
  yaml: 'M3.75 5h8.5M3.75 8h8.5M3.75 11h5.5',
} as const;

function typeIconClass(type: string): string {
  if (type.startsWith('folder:')) {
    return 'tree-icon--type-folder-catalog';
  }
  const safe = type.replace(/[^a-z0-9-]/gi, '');
  return safe ? `tree-icon--type-${safe}` : 'tree-icon--type-default';
}

function wrapIcon(className: string, inner: string): string {
  return `<span class="tree-icon ${className}" aria-hidden="true">${inner}</span>`;
}

function svgIcon(paths: string, options?: { fill?: boolean; stroke?: boolean }): string {
  const fill = options?.fill !== false ? 'currentColor' : 'none';
  const stroke = options?.stroke ? 'currentColor' : 'none';
  const strokeWidth = options?.stroke ? '1.15' : '0';
  const strokeLinecap = options?.stroke ? 'round' : 'butt';
  return `<svg viewBox="0 0 16 16" xmlns="${SVG_NS}" fill="none" aria-hidden="true"><path d="${paths}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="${strokeLinecap}" stroke-linejoin="round"/></svg>`;
}

function svgYamlIcon(): string {
  return `<svg viewBox="0 0 16 16" xmlns="${SVG_NS}" fill="none" aria-hidden="true"><path d="${ICON_PATHS.yaml}" stroke="currentColor" stroke-width="1.15" stroke-linecap="round"/></svg>`;
}

/** Flat folder icon for tree rows without a readable index page. */
export function renderTreeFolderIcon(): string {
  return wrapIcon('tree-icon--folder', svgIcon(ICON_PATHS.folder));
}

/** Flat page icon for tree rows (pages and folders with README index). */
export function renderTreePageIcon(type: string, contentKind: 'markdown' | 'yaml' | 'json' = 'markdown'): string {
  if (contentKind === 'json') {
    return wrapIcon('tree-icon--page tree-icon--structured', svgIcon(ICON_PATHS.json, { fill: false, stroke: true }));
  }
  if (contentKind === 'yaml') {
    return wrapIcon('tree-icon--page tree-icon--structured', svgYamlIcon());
  }
  return wrapIcon(`tree-icon--page ${typeIconClass(type)}`, svgIcon(ICON_PATHS.page));
}

/** Folder row icon: page when the folder has a readable README index. */
export function renderTreeFolderNodeIcon(node: TreeFolderNode): string {
  if (node.indexPageSlug) {
    return renderTreePageIcon(
      node.indexPageType ?? 'wiki-page',
      node.indexPageContentKind ?? 'markdown',
    );
  }
  return renderTreeFolderIcon();
}
