let mermaidTheme: string | null = null;

/** Render mermaid diagrams inside a container (reader or editor preview). */
export async function enhanceMermaidPreview(root: HTMLElement): Promise<void> {
  const nodes = root.querySelectorAll<HTMLElement>('pre.mermaid');
  if (nodes.length === 0) {
    return;
  }

  const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'default';
  const mermaid = await import('mermaid');

  if (mermaidTheme !== theme) {
    mermaid.default.initialize({
      startOnLoad: false,
      theme,
      securityLevel: 'loose',
    });
    mermaidTheme = theme;
  }

  try {
    await mermaid.default.run({ nodes: [...nodes] });
  } catch {
    for (const node of nodes) {
      if (!node.closest('.mermaid-error')) {
        const wrapper = node.parentElement;
        wrapper?.classList.add('mermaid-error');
      }
    }
  }
}
