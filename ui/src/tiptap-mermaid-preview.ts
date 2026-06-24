import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { enhanceMermaidPreview } from './mermaid-preview.js';

const mermaidPreviewKey = new PluginKey('mermaidEditorPreview');

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildMermaidWidget(source: string): HTMLElement {
  const widget = document.createElement('div');
  widget.className = 'mermaid-editor-preview mermaid-wrapper';
  widget.contentEditable = 'false';

  const trimmed = source.trim();
  if (!trimmed) {
    widget.innerHTML = '<p class="mermaid-placeholder">Mermaid preview</p>';
    return widget;
  }

  widget.innerHTML = `<pre class="mermaid">${escapeHtml(trimmed)}</pre>`;
  void enhanceMermaidPreview(widget);
  return widget;
}

/** Live mermaid preview via ProseMirror widget decorations (no DOM surgery inside the doc). */
export const MermaidPreviewExtension = Extension.create({
  name: 'mermaidPreview',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: mermaidPreviewKey,
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];

            state.doc.descendants((node, pos) => {
              if (node.type.name !== 'codeBlock') {
                return;
              }
              if (node.attrs.language !== 'mermaid') {
                return;
              }

              const widget = buildMermaidWidget(node.textContent);
              decorations.push(
                Decoration.widget(pos + node.nodeSize, widget, {
                  side: 1,
                  key: `mermaid-${pos}-${node.textContent.length}`,
                }),
              );
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

/** Re-render mermaid widgets after theme toggle (decorations do not auto-refresh). */
export function bindMermaidThemeRefresh(editor: Editor): () => void {
  const onThemeChange = (): void => {
    editor.view.dispatch(editor.state.tr);
  };
  window.addEventListener('repomind-theme-change', onThemeChange);
  return () => {
    window.removeEventListener('repomind-theme-change', onThemeChange);
  };
}
