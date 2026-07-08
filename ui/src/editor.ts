import type { Draft, ListDocsItem } from './api.js';
import { renderEditorPropertiesRail } from './editor-properties.js';
import {
  bindDraftSession,
  renderEditorActionsHtml,
  type DraftSessionHandle,
} from './draft-session.js';
import type { EditorCallbacks } from './draft-session.js';
import { bindFocusToggle, loadFocusMode, renderPageShell } from './page-shell.js';
import { scheduleWorkspaceScrollReset } from './workspace-scroll.js';

export type { EditorCallbacks } from './draft-session.js';

export function renderDraftEditor(
  container: HTMLElement,
  draft: Draft,
  callbacks: EditorCallbacks,
  docIndex: ListDocsItem[] = [],
): DraftSessionHandle {
  const focusMode = loadFocusMode();

  const shell = renderPageShell(container, {
    rootClass: 'workspace-main workspace-editor',
    breadcrumbs: [
      { label: 'Knowledge' },
      { label: 'Drafts' },
      { label: draft.title || draft.slug, current: true },
    ],
    titleHtml: `<input id="ed-title" class="title-input doc-title" type="text" placeholder="Document title" />`,
    actionsHtml: renderEditorActionsHtml(focusMode),
    mainHtml: `<div id="ed-visual-canvas"></div>`,
    railHtml: renderEditorPropertiesRail({
      forkedFrom: draft.forked_from,
    }),
    focusMode,
  });

  bindFocusToggle(container, focusMode);
  scheduleWorkspaceScrollReset(container);

  return bindDraftSession(container, shell, draft, callbacks, docIndex);
}
