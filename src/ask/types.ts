export type LlmProvider = 'openai' | 'anthropic';

export interface AskSource {
  slug: string;
  title: string;
  excerpt: string;
}

export interface AskRequest {
  question: string;
  provider?: LlmProvider;
  model?: string;
  apiKey?: string;
  history?: AskChatTurn[];
}

export interface AskChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AskResponse {
  answer: string;
  sources: AskSource[];
  notFound: boolean;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type CompleteAskFn = (
  provider: LlmProvider,
  apiKey: string,
  model: string,
  messages: LlmMessage[],
) => Promise<string>;
