export function formatStructuredBody(body: string, kind: 'json' | 'yaml'): string {
  if (kind === 'json') {
    try {
      const parsed = JSON.parse(body) as unknown;
      return JSON.stringify(parsed, null, 2);
    } catch {
      return body;
    }
  }
  return body;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderStructuredPreview(body: string, kind: 'json' | 'yaml'): string {
  const formatted = formatStructuredBody(body, kind);
  const modifier = kind === 'json' ? 'structured-preview--json' : 'structured-preview--yaml';
  return `<pre class="structured-preview ${modifier}"><code>${escapeHtml(formatted)}</code></pre>`;
}
