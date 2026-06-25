import {
  BookMarked,
  Bold,
  ChevronDown,
  Code,
  createIcons,
  Image,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Plus,
  Table,
  Workflow,
} from 'lucide';

const TOOLBAR_LUCIDE_ICONS = {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Code,
  Image,
  BookMarked,
  Plus,
  ChevronDown,
  Table,
  Workflow,
};

const LUCIDE_ICON_ATTRS = {
  width: 16,
  height: 16,
  'stroke-width': 1.75,
};

function lucideIcon(name: string): string {
  return `<i data-lucide="${name}" class="toolbar-icon" aria-hidden="true"></i>`;
}

/** Replace data-lucide placeholders with Lucide SVG icons. */
export function hydrateToolbarIcons(root: HTMLElement): void {
  createIcons({
    icons: TOOLBAR_LUCIDE_ICONS,
    root,
    attrs: LUCIDE_ICON_ATTRS,
  });
}

export { lucideIcon };
