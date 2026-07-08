export interface OutlineHeading {
  id: string;
  level: number;
  text: string;
  element: HTMLElement;
}

export interface DocOutlineOptions {
  scrollRoot: HTMLElement;
  contentRoot: HTMLElement;
  mountEl: HTMLElement;
  minHeadings?: number;
}

export interface DocOutlineHandle {
  destroy: () => void;
  refresh: () => void;
}

const MIN_HEADINGS_DEFAULT = 2;

export function slugifyHeading(text: string, index: number, used: Set<string>): string {
  const base =
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 48) || `section-${index + 1}`;
  let id = base;
  let suffix = 2;
  while (used.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

export function collectOutlineHeadings(contentRoot: HTMLElement): OutlineHeading[] {
  const headings = contentRoot.querySelectorAll<HTMLElement>('h1, h2, h3');
  const usedIds = new Set<string>();
  const result: OutlineHeading[] = [];

  headings.forEach((element, index) => {
    const text = element.textContent?.trim() ?? '';
    if (!text) {
      return;
    }

    const level = Number(element.tagName.charAt(1));
    let id = element.id;
    if (!id) {
      id = slugifyHeading(text, index, usedIds);
      element.id = id;
    }
    usedIds.add(id);
    result.push({ id, level, text, element });
  });

  return result;
}

function offsetTopInScrollRoot(element: HTMLElement, scrollRoot: HTMLElement): number {
  const elementRect = element.getBoundingClientRect();
  const rootRect = scrollRoot.getBoundingClientRect();
  return elementRect.top - rootRect.top + scrollRoot.scrollTop;
}

function scrollToHeading(
  scrollRoot: HTMLElement,
  heading: HTMLElement,
  behavior: ScrollBehavior = 'smooth',
): void {
  const top = offsetTopInScrollRoot(heading, scrollRoot) - 16;
  scrollRoot.scrollTo({ top: Math.max(0, top), behavior });
}

export function mountDocOutline(options: DocOutlineOptions): DocOutlineHandle | null {
  const minHeadings = options.minHeadings ?? MIN_HEADINGS_DEFAULT;
  const headings = collectOutlineHeadings(options.contentRoot);

  if (headings.length < minHeadings) {
    options.mountEl.classList.add('hidden');
    options.mountEl.replaceChildren();
    return null;
  }

  options.mountEl.classList.remove('hidden');
  options.mountEl.replaceChildren();

  const track = document.createElement('div');
  track.className = 'doc-outline-track';
  track.setAttribute('role', 'presentation');

  const menu = document.createElement('div');
  menu.className = 'doc-outline-menu';
  menu.setAttribute('role', 'navigation');
  menu.setAttribute('aria-label', 'On this page');

  const menuList = document.createElement('ul');
  menuList.className = 'doc-outline-menu-list';

  const marks: HTMLButtonElement[] = [];
  const menuItems: HTMLButtonElement[] = [];

  for (const heading of headings) {
    const mark = document.createElement('button');
    mark.type = 'button';
    mark.className = `doc-outline-mark doc-outline-mark--${heading.level}`;
    mark.dataset.headingId = heading.id;
    mark.title = heading.text;
    mark.setAttribute('aria-label', heading.text);
    track.appendChild(mark);
    marks.push(mark);

    const menuItem = document.createElement('li');
    menuItem.className = `doc-outline-menu-item doc-outline-menu-item--${heading.level}`;
    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'doc-outline-menu-btn';
    menuButton.textContent = heading.text;
    menuButton.addEventListener('click', () => {
      scrollToHeading(options.scrollRoot, heading.element);
    });
    menuItem.appendChild(menuButton);
    menuList.appendChild(menuItem);
    menuItems.push(menuButton);

    mark.addEventListener('click', () => {
      scrollToHeading(options.scrollRoot, heading.element);
    });
  }

  menu.appendChild(menuList);
  options.mountEl.className = 'doc-outline';
  options.mountEl.append(track, menu);

  let activeId = headings[0]?.id ?? '';

  function setActive(id: string): void {
    if (activeId === id) {
      return;
    }
    activeId = id;
    for (const mark of marks) {
      mark.classList.toggle('is-active', mark.dataset.headingId === id);
    }
    for (const [index, button] of menuItems.entries()) {
      button.classList.toggle('is-active', headings[index]?.id === id);
    }
  }

  function layoutMarks(): void {
    const totalHeight = Math.max(options.scrollRoot.scrollHeight, 1);
    const trackHeight = track.clientHeight || 1;

    headings.forEach((heading, index) => {
      const mark = marks[index];
      if (!mark) {
        return;
      }
      const offset = offsetTopInScrollRoot(heading.element, options.scrollRoot);
      const ratio = Math.min(1, Math.max(0, offset / totalHeight));
      mark.style.top = `${ratio * (trackHeight - 4)}px`;
    });
  }

  function syncActiveFromScroll(): void {
    const rootRect = options.scrollRoot.getBoundingClientRect();
    const anchorY = rootRect.top + rootRect.height * 0.22;

    let current = headings[0];
    for (const heading of headings) {
      const rect = heading.element.getBoundingClientRect();
      if (rect.top <= anchorY) {
        current = heading;
      } else {
        break;
      }
    }

    if (current) {
      setActive(current.id);
    }
  }

  const onScroll = (): void => {
    syncActiveFromScroll();
  };

  const onResize = (): void => {
    layoutMarks();
    syncActiveFromScroll();
  };

  const observer = new IntersectionObserver(
    () => {
      syncActiveFromScroll();
    },
    {
      root: options.scrollRoot,
      rootMargin: '-15% 0px -75% 0px',
      threshold: [0, 0.25, 0.5, 1],
    },
  );

  for (const heading of headings) {
    observer.observe(heading.element);
  }

  options.scrollRoot.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize, { passive: true });

  layoutMarks();
  syncActiveFromScroll();

  return {
    refresh: () => {
      layoutMarks();
      syncActiveFromScroll();
    },
    destroy: () => {
      observer.disconnect();
      options.scrollRoot.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      options.mountEl.classList.add('hidden');
      options.mountEl.replaceChildren();
    },
  };
}
