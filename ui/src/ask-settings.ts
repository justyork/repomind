export type AskLlmProvider = 'openai' | 'anthropic';

export interface AskSettings {
  provider: AskLlmProvider;
  model: string;
  apiKey: string;
}

const STORAGE_KEY = 'repomind-ask-settings';

export const DEFAULT_ASK_SETTINGS: AskSettings = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: '',
};

export function loadAskSettings(): AskSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_ASK_SETTINGS };
    }
    const parsed = JSON.parse(raw) as Partial<AskSettings>;
    return {
      provider: parsed.provider === 'anthropic' ? 'anthropic' : 'openai',
      model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model.trim() : DEFAULT_ASK_SETTINGS.model,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
    };
  } catch {
    return { ...DEFAULT_ASK_SETTINGS };
  }
}

export function saveAskSettings(settings: AskSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function defaultModelForProvider(provider: AskLlmProvider): string {
  return provider === 'anthropic' ? 'claude-3-5-haiku-latest' : 'gpt-4o-mini';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function openAskSettingsModal(
  current: AskSettings,
  onSave: (settings: AskSettings) => void,
  options: { serverConfigured?: boolean } = {},
): void {
  const serverConfigured = options.serverConfigured === true;
  const overlay = document.createElement('div');
  overlay.className = 'modal ask-settings-modal';
  overlay.innerHTML = `
    <div class="modal-card ask-settings-card" role="dialog" aria-modal="true" aria-labelledby="ask-settings-title">
      <h3 id="ask-settings-title" class="modal-title">Ask assistant settings</h3>
      <p class="ask-settings-hint">${
        serverConfigured
          ? 'API key is configured on the server via <code>REPOMIND_ASK_API_KEY</code> in <code>.env</code>. It is never sent from the browser.'
          : 'Your API key is stored only in this browser (localStorage) and sent to the local RepoMind server for each request.'
      }</p>
      <label class="modal-field">
        <span class="modal-label">Provider</span>
        <select id="ask-settings-provider" class="modal-input" ${serverConfigured ? 'disabled' : ''}>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
      </label>
      <label class="modal-field">
        <span class="modal-label">Model</span>
        <input type="text" id="ask-settings-model" class="modal-input" autocomplete="off" ${serverConfigured ? 'disabled' : ''} />
      </label>
      ${
        serverConfigured
          ? ''
          : `<label class="modal-field">
        <span class="modal-label">API key</span>
        <input type="password" id="ask-settings-api-key" class="modal-input" autocomplete="off" placeholder="sk-…" />
      </label>`
      }
      <div class="modal-actions">
        <button type="button" class="btn-ghost" data-action="cancel">Cancel</button>
        <button type="button" class="btn-primary" data-action="save">${serverConfigured ? 'Close' : 'Save'}</button>
      </div>
    </div>
  `;

  const providerEl = overlay.querySelector<HTMLSelectElement>('#ask-settings-provider');
  const modelEl = overlay.querySelector<HTMLInputElement>('#ask-settings-model');
  const apiKeyEl = overlay.querySelector<HTMLInputElement>('#ask-settings-api-key');

  if (providerEl) {
    providerEl.value = current.provider;
  }
  if (modelEl) {
    modelEl.value = current.model;
  }
  if (apiKeyEl) {
    apiKeyEl.value = current.apiKey;
  }

  providerEl?.addEventListener('change', () => {
    if (!providerEl || !modelEl) {
      return;
    }
    const provider = providerEl.value === 'anthropic' ? 'anthropic' : 'openai';
    if (modelEl.value === defaultModelForProvider('openai') || modelEl.value === defaultModelForProvider('anthropic')) {
      modelEl.value = defaultModelForProvider(provider);
    }
  });

  function close(): void {
    overlay.remove();
  }

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      close();
    }
  });

  overlay.querySelector('[data-action="cancel"]')?.addEventListener('click', close);
  overlay.querySelector('[data-action="save"]')?.addEventListener('click', () => {
    if (serverConfigured) {
      close();
      return;
    }
    const provider = providerEl?.value === 'anthropic' ? 'anthropic' : 'openai';
    onSave({
      provider,
      model: modelEl?.value.trim() || defaultModelForProvider(provider),
      apiKey: apiKeyEl?.value.trim() ?? '',
    });
    close();
  });

  document.body.appendChild(overlay);
}

export function escapeAskHtml(text: string): string {
  return escapeHtml(text);
}
