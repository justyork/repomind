import { Extension, type Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { enhanceMermaidPreview } from './mermaid-preview.js';

const mermaidPreviewPluginKey = new PluginKey('mermaidPreview');

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function createPreviewElement(source: string): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'mermaid-editor-preview mermaid-wrapper';
  wrapper.setAttribute('contenteditable', 'false');

  const trimmed = source.trim();
  if (!trimmed) {
    wrapper.innerHTML = '<p class="mermaid-placeholder">Mermaid preview</p>';
    return wrapper;
  }

  wrapper.innerHTML = `<pre class="mermaid">${escapeHtml(trimmed)}</pre>`;
  queueMicrotask(() => {
    if (wrapper.isConnected) {
      void enhanceMermaidPreview(wrapper);
    }
  });
  return wrapper;
}

function buildDecorationSet(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== 'codeBlock') {
      return;
    }

    const language = node.attrs.language as string | null | undefined;
    if (language !== 'mermaid') {
      return;
    }

    const source = node.textContent;
    decorations.push(
      Decoration.widget(
        pos + node.nodeSize,
        () => createPreviewElement(source),
        {
          side: 1,
          key: `mermaid-${pos}-${source}`,
        },
      ),
    );
  });

  return DecorationSet.create(doc, decorations);
}

/** Live mermaid preview below mermaid code blocks via ProseMirror widget decorations. */
export const MermaidPreviewExtension = Extension.create({
  name: 'mermaidPreview',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: mermaidPreviewPluginKey,
        state: {
          init: (_, { doc }) => buildDecorationSet(doc),
          apply(tr, value) {
            const refresh = tr.getMeta(mermaidPreviewPluginKey)?.refresh === true;
            if (tr.docChanged || refresh) {
              return buildDecorationSet(tr.doc);
            }
            return value.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return mermaidPreviewPluginKey.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

export function refreshMermaidPreviews(editor: Editor): void {
  editor.view.dispatch(
    editor.state.tr.setMeta(mermaidPreviewPluginKey, { refresh: true }),
  );
}

/** Re-render mermaid widgets after theme toggle (decorations do not auto-refresh). */
export function bindMermaidThemeRefresh(editor: Editor): () => void {
  const onThemeChange = (): void => {
    refreshMermaidPreviews(editor);
  };
  window.addEventListener('repomind-theme-change', onThemeChange);
  return () => window.removeEventListener('repomind-theme-change', onThemeChange);
}
