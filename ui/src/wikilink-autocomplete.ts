export interface DocCandidate {
  slug: string;
  title: string;
}

const WIKILINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function parseWikilinkTargets(body: string): string[] {
  const targets: string[] = [];
  for (const match of body.matchAll(WIKILINK_PATTERN)) {
    const display = match[1]?.trim() ?? '';
    const slugPart = match[2]?.trim() ?? display;
    if (slugPart) {
      targets.push(slugPart);
    }
  }
  return targets;
}

function resolveTargetToSlug(raw: string, docs: DocCandidate[]): string | null {
  const bySlug = docs.find((doc) => doc.slug === raw);
  if (bySlug) {
    return bySlug.slug;
  }
  const lower = raw.toLowerCase();
  const byTitle = docs.find((doc) => doc.title.toLowerCase() === lower);
  return byTitle?.slug ?? null;
}

export function suggestRelatedFromBody(
  body: string,
  currentRelated: string[],
  docs: DocCandidate[],
): string[] {
  const existing = new Set(currentRelated);
  const suggested: string[] = [];
  for (const raw of parseWikilinkTargets(body)) {
    const slug = resolveTargetToSlug(raw, docs);
    if (!slug || existing.has(slug) || suggested.includes(slug)) {
      continue;
    }
    suggested.push(slug);
  }
  return suggested;
}

function fuzzyScore(query: string, slug: string, title: string): number {
  const q = query.toLowerCase();
  if (!q) {
    return 1;
  }
  const slugLower = slug.toLowerCase();
  const titleLower = title.toLowerCase();
  if (slugLower.startsWith(q) || titleLower.startsWith(q)) {
    return 3;
  }
  if (slugLower.includes(q) || titleLower.includes(q)) {
    return 2;
  }
  return 0;
}

export function filterDocCandidates(query: string, docs: DocCandidate[], limit = 12): DocCandidate[] {
  return docs
    .map((doc) => ({ doc, score: fuzzyScore(query, doc.slug, doc.title) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.doc.slug.localeCompare(b.doc.slug))
    .slice(0, limit)
    .map((item) => item.doc);
}

export function bindWikilinkAutocomplete(
  textarea: HTMLTextAreaElement,
  docs: DocCandidate[],
  onChange: () => void,
): void {
  const menu = document.createElement('div');
  menu.className = 'wikilink-menu hidden';
  document.body.appendChild(menu);

  let activeStart = -1;
  let activeQuery = '';

  function closeMenu(): void {
    menu.classList.add('hidden');
    menu.innerHTML = '';
    activeStart = -1;
    activeQuery = '';
  }

  function positionMenu(): void {
    const rect = textarea.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.left}px`;
    menu.style.minWidth = `${Math.max(200, rect.width * 0.5)}px`;
  }

  function renderMenu(query: string): void {
    const matches = filterDocCandidates(query, docs);
    if (matches.length === 0) {
      closeMenu();
      return;
    }
    menu.innerHTML = matches
      .map(
        (doc) =>
          `<button type="button" class="wikilink-option" data-slug="${escapeAttr(doc.slug)}">
            <span class="wikilink-option-slug">${escapeHtml(doc.slug)}</span>
            <span class="wikilink-option-title">${escapeHtml(doc.title)}</span>
          </button>`,
      )
      .join('');
    positionMenu();
    menu.classList.remove('hidden');

    menu.querySelectorAll<HTMLButtonElement>('.wikilink-option').forEach((button) => {
      button.addEventListener('mousedown', (event) => {
        event.preventDefault();
        const slug = button.dataset.slug ?? '';
        insertSlug(slug);
      });
    });
  }

  function insertSlug(slug: string): void {
    if (activeStart < 0) {
      return;
    }
    const before = textarea.value.slice(0, activeStart);
    const after = textarea.value.slice(textarea.selectionStart);
    textarea.value = `${before}[[${slug}]]${after}`;
    const cursor = before.length + slug.length + 4;
    textarea.setSelectionRange(cursor, cursor);
    closeMenu();
    onChange();
    textarea.focus();
  }

  function detectWikilinkTrigger(): void {
    const cursor = textarea.selectionStart;
    const prefix = textarea.value.slice(0, cursor);
    const match = /\[\[([^\]]*)$/.exec(prefix);
    if (!match) {
      closeMenu();
      return;
    }
    activeStart = cursor - match[0].length;
    activeQuery = match[1] ?? '';
    renderMenu(activeQuery);
  }

  textarea.addEventListener('input', detectWikilinkTrigger);
  textarea.addEventListener('click', detectWikilinkTrigger);
  textarea.addEventListener('keyup', detectWikilinkTrigger);
  textarea.addEventListener('blur', () => {
    setTimeout(closeMenu, 120);
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(text: string): string {
  return escapeHtml(text).replace(/"/g, '&quot;');
}
