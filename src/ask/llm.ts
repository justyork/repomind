import type { CompleteAskFn, LlmMessage, LlmProvider } from './types.js';

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';
export const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-haiku-latest';

export function defaultModelForProvider(provider: LlmProvider): string {
  switch (provider) {
    case 'openai':
      return DEFAULT_OPENAI_MODEL;
    case 'anthropic':
      return DEFAULT_ANTHROPIC_MODEL;
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

export function resolveAskProvider(value: string | undefined): LlmProvider {
  if (value === 'anthropic') {
    return 'anthropic';
  }
  return 'openai';
}

async function readApiError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } | string };
    if (typeof body.error === 'string') {
      return body.error;
    }
    if (body.error && typeof body.error.message === 'string') {
      return body.error.message;
    }
  } catch {
    // ignore parse errors
  }
  return `HTTP ${res.status}`;
}

export async function callOpenAi(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
): Promise<string> {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${await readApiError(res)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error('OpenAI API returned an empty response');
  }
  return content;
}

export async function callAnthropic(
  apiKey: string,
  model: string,
  messages: LlmMessage[],
): Promise<string> {
  const system = messages.find((message) => message.role === 'system')?.content ?? '';
  const chatMessages = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
    }));

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system,
      messages: chatMessages,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${await readApiError(res)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const text = data.content
    ?.filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('')
    .trim();
  if (!text) {
    throw new Error('Anthropic API returned an empty response');
  }
  return text;
}

export const completeAsk: CompleteAskFn = async (provider, apiKey, model, messages) => {
  switch (provider) {
    case 'openai':
      return callOpenAi(apiKey, model, messages);
    case 'anthropic':
      return callAnthropic(apiKey, model, messages);
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
};
