import { MessageCircle, X, createIcons } from 'lucide';
import { getAskConfig, postAsk, type AskResponse, type AskSource } from './api.js';
import { renderMarkdown } from './markdown.js';
import {
  escapeAskHtml,
  loadAskSettings,
  openAskSettingsModal,
  saveAskSettings,
  type AskSettings,
} from './ask-settings.js';

export interface AskPanelOptions {
  onOpenSlug: (slug: string) => void;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: AskSource[];
}

const ASK_FAB_ICONS = {
  MessageCircle,
  X,
};

function preprocessAskLinks(markdown: string): string {
  return markdown.replace(
    /\[([^\]]+)\]\(\?slug=([^)]+)\)/g,
    (_match, label: string, slug: string) => `[${label}](#wikilink:${slug})`,
  );
}

function renderFabIcon(button: HTMLButtonElement, open: boolean): void {
  button.innerHTML = `<i data-lucide="${open ? 'x' : 'message-circle'}" aria-hidden="true"></i>`;
  createIcons({
    icons: ASK_FAB_ICONS,
    root: button,
    attrs: {
      width: 22,
      height: 22,
      'stroke-width': 1.75,
    },
  });
}

export function initAskPanel(options: AskPanelOptions): void {
  let settings = loadAskSettings();
  let serverConfigured = false;
  let open = false;
  let loading = false;
  const messages: ChatMessage[] = [];

  void getAskConfig()
    .then((config) => {
      serverConfigured = config.serverConfigured;
      if (serverConfigured) {
        settings = {
          provider: config.provider,
          model: config.model,
          apiKey: '',
        };
        saveAskSettings(settings);
      }
    })
    .catch(() => {
      /* keep local settings */
    });

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.id = 'ask-toggle';
  toggleBtn.className = 'ask-fab';
  toggleBtn.setAttribute('aria-label', 'Open documentation assistant');
  toggleBtn.setAttribute('aria-pressed', 'false');
  toggleBtn.title = 'Ask';
  document.body.appendChild(toggleBtn);
  renderFabIcon(toggleBtn, false);

  const panel = document.createElement('aside');
  panel.id = 'ask-panel';
  panel.className = 'ask-panel hidden';
  panel.setAttribute('aria-label', 'Documentation assistant');
  panel.innerHTML = `
    <header class="ask-panel-header">
      <div>
        <h2 class="ask-panel-title">Ask</h2>
        <p class="ask-panel-subtitle">Answers from published docs with source links</p>
      </div>
      <div class="ask-panel-actions">
        <button type="button" class="btn-ghost ask-settings-btn" title="Settings">Settings</button>
        <button type="button" class="btn-ghost ask-close-btn" title="Close">Close</button>
      </div>
    </header>
    <div class="ask-messages" role="log" aria-live="polite"></div>
    <form class="ask-form">
      <textarea class="ask-input" rows="3" placeholder="Ask about your documentation…" aria-label="Question"></textarea>
      <div class="ask-form-actions">
        <button type="submit" class="btn-primary ask-submit-btn">Ask</button>
      </div>
    </form>
    <p class="ask-error hidden" role="alert"></p>
  `;

  document.body.appendChild(panel);

  const messagesEl = panel.querySelector<HTMLElement>('.ask-messages')!;
  const formEl = panel.querySelector<HTMLFormElement>('.ask-form')!;
  const inputEl = panel.querySelector<HTMLTextAreaElement>('.ask-input')!;
  const submitBtn = panel.querySelector<HTMLButtonElement>('.ask-submit-btn')!;
  const errorEl = panel.querySelector<HTMLElement>('.ask-error')!;

  function setOpen(next: boolean): void {
    open = next;
    panel.classList.toggle('hidden', !open);
    toggleBtn.classList.toggle('ask-fab--open', open);
    toggleBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
    toggleBtn.setAttribute(
      'aria-label',
      open ? 'Close documentation assistant' : 'Open documentation assistant',
    );
    renderFabIcon(toggleBtn, open);
    if (open) {
      inputEl.focus();
    }
  }

  function setError(message: string | null): void {
    if (!message) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      return;
    }
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  function renderSources(sources: AskSource[]): string {
    if (sources.length === 0) {
      return '';
    }
    const chips = sources
      .map(
        (source) =>
          `<button type="button" class="ask-source-chip" data-slug="${escapeAskHtml(source.slug)}">${escapeAskHtml(source.title)}</button>`,
      )
      .join('');
    return `<div class="ask-sources"><span class="ask-sources-label">Sources</span>${chips}</div>`;
  }

  function renderMessages(): void {
    messagesEl.innerHTML = messages
      .map((message) => {
        if (message.role === 'user') {
          return `<div class="ask-message ask-message-user"><div class="ask-bubble">${escapeAskHtml(message.content)}</div></div>`;
        }
        const html = renderMarkdown(preprocessAskLinks(message.content));
        const sources = message.sources ? renderSources(message.sources) : '';
        return `<div class="ask-message ask-message-assistant"><div class="ask-bubble markdown-body">${html}</div>${sources}</div>`;
      })
      .join('');
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function setLoading(next: boolean): void {
    loading = next;
    submitBtn.disabled = loading;
    inputEl.disabled = loading;
    submitBtn.textContent = loading ? 'Thinking…' : 'Ask';
  }

  async function submitQuestion(): Promise<void> {
    const question = inputEl.value.trim();
    if (!question || loading) {
      return;
    }

    setError(null);
    messages.push({ role: 'user', content: question });
    inputEl.value = '';
    renderMessages();
    setLoading(true);

    try {
      const history = messages
        .slice(0, -1)
        .map((message) => ({ role: message.role, content: message.content }));
      const response: AskResponse = await postAsk(question, settings, history);
      messages.push({
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
      });
      renderMessages();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Ask failed';
      setError(message);
      messages.pop();
      renderMessages();
      if (message.includes('API key')) {
        openAskSettingsModal(settings, (next) => {
          settings = next;
          saveAskSettings(settings);
        }, { serverConfigured });
      }
    } finally {
      setLoading(false);
    }
  }

  toggleBtn.addEventListener('click', () => {
    setOpen(!open);
  });

  panel.querySelector('.ask-close-btn')?.addEventListener('click', () => {
    setOpen(false);
  });

  panel.querySelector('.ask-settings-btn')?.addEventListener('click', () => {
    openAskSettingsModal(settings, (next) => {
      settings = next;
      saveAskSettings(settings);
      setError(null);
    }, { serverConfigured });
  });

  formEl.addEventListener('submit', (event) => {
    event.preventDefault();
    void submitQuestion();
  });

  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitQuestion();
    }
  });

  messagesEl.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const slugEl = target.closest<HTMLElement>('[data-slug]');
    if (!slugEl) {
      return;
    }
    const slug = slugEl.getAttribute('data-slug');
    if (slug) {
      options.onOpenSlug(slug);
      setOpen(false);
    }
  });
}
