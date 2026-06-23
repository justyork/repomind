export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'repomind-theme';

export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {
    /* localStorage unavailable */
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* localStorage unavailable */
  }
  syncThemeToggleLabels(theme);
  window.dispatchEvent(new CustomEvent('repomind-theme-change', { detail: { theme } }));
}

export function initTheme(): Theme {
  const theme = getTheme();
  applyTheme(theme);
  return theme;
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'light' ? 'dark' : 'light';
  applyTheme(next);
  return next;
}

function themeToggleLabel(theme: Theme): string {
  return theme === 'light' ? 'Dark mode' : 'Light mode';
}

function syncThemeToggleLabels(theme: Theme): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')) {
    button.textContent = themeToggleLabel(theme);
    button.setAttribute('aria-pressed', String(theme === 'dark'));
  }
}

export function bindThemeToggle(button: HTMLButtonElement | null): void {
  if (!button) {
    return;
  }
  button.setAttribute('data-theme-toggle', 'true');
  syncThemeToggleLabels(getTheme());
  button.addEventListener('click', () => {
    toggleTheme();
  });
}
