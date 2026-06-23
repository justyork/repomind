import type { Editor } from '@tiptap/core';
import { enhanceMermaidPreview } from './mermaid-preview.js';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Live mermaid preview below mermaid code blocks in the TipTap editor. */
export function bindMermaidEditorPreviews(editor: Editor, mountEl: HTMLElement): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  function refresh(): void {
    const codeBlocks = mountEl.querySelectorAll<HTMLElement>('pre code');
    for (const code of codeBlocks) {
      const language = code.className.match(/language-(\S+)/)?.[1];
      const pre = code.parentElement;
      if (!pre || language !== 'mermaid') {
        continue;
      }

      const wrapper = pre.closest('.mermaid-editor-block') ?? (() => {
        const block = document.createElement('div');
        block.className = 'mermaid-editor-block';
        pre.parentElement?.insertBefore(block, pre);
        block.appendChild(pre);
        return block;
      })();

      let preview = wrapper.querySelector<HTMLElement>('.mermaid-editor-preview');
      if (!preview) {
        preview = document.createElement('div');
        preview.className = 'mermaid-editor-preview mermaid-wrapper';
        wrapper.appendChild(preview);
      }

      const source = code.textContent?.trim() ?? '';
      if (!source) {
        preview.innerHTML = '<p class="mermaid-placeholder">Mermaid preview</p>';
        continue;
      }

      preview.innerHTML = `<pre class="mermaid">${escapeHtml(source)}</pre>`;
      void enhanceMermaidPreview(preview);
    }
  }

  function scheduleRefresh(): void {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      refresh();
    }, 350);
  }

  editor.on('update', scheduleRefresh);
  editor.on('create', scheduleRefresh);
  scheduleRefresh();

  const onThemeChange = (): void => {
    scheduleRefresh();
  };
  window.addEventListener('repomind-theme-change', onThemeChange);

  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    editor.off('update', scheduleRefresh);
    editor.off('create', scheduleRefresh);
    window.removeEventListener('repomind-theme-change', onThemeChange);
  };
}
