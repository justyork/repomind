import type { DocIndex } from '../index/doc-index.js';
import { resolveAskApiKey } from './config.js';
import { ensureCitations } from './citations.js';
import {
  completeAsk,
  defaultModelForProvider,
  resolveAskProvider,
} from './llm.js';
import { buildAskSystemPrompt, buildAskUserPrompt } from './prompt.js';
import { retrieveAskContext } from './retrieve.js';
import { buildAskGreetingReply, buildAskNotFoundReply } from './suggestions.js';
import { isAskSmallTalk } from './small-talk.js';
import type { AskChatTurn, AskRequest, AskResponse, AskSource, CompleteAskFn, LlmMessage, LlmProvider } from './types.js';

export interface AskDocsOptions {
  completeFn?: CompleteAskFn;
}

const MAX_HISTORY_TURNS = 6;

function resolveProvider(requestProvider: LlmProvider | undefined): LlmProvider {
  if (requestProvider) {
    return requestProvider;
  }
  return resolveAskProvider(process.env.REPOMIND_ASK_PROVIDER);
}

function resolveModel(provider: LlmProvider, requestModel: string | undefined): string {
  const trimmed = requestModel?.trim();
  if (trimmed) {
    return trimmed;
  }
  const fromEnv = process.env.REPOMIND_ASK_MODEL?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  return defaultModelForProvider(provider);
}

function buildAskMessages(
  question: string,
  sources: AskSource[],
  history: AskChatTurn[] | undefined,
): LlmMessage[] {
  const messages: LlmMessage[] = [{ role: 'system', content: buildAskSystemPrompt(sources.length > 0) }];

  for (const turn of (history ?? []).slice(-MAX_HISTORY_TURNS)) {
    messages.push({ role: turn.role, content: turn.content });
  }

  messages.push({ role: 'user', content: buildAskUserPrompt(question, sources) });
  return messages;
}

/** Answers a documentation question using retrieval + optional LLM synthesis. */
export async function askDocs(
  index: DocIndex,
  input: AskRequest,
  options: AskDocsOptions = {},
): Promise<AskResponse> {
  const question = input.question?.trim() ?? '';
  if (!question) {
    throw new Error('question is required');
  }

  const apiKey = resolveAskApiKey(input.apiKey);
  if (!apiKey) {
    throw new Error('API key is required — set it in Ask settings or REPOMIND_ASK_API_KEY');
  }

  const sources = retrieveAskContext(index, question);
  if (sources.length === 0 && isAskSmallTalk(question)) {
    return {
      answer: buildAskGreetingReply(index, question),
      sources: [],
      notFound: false,
    };
  }

  if (sources.length === 0) {
    return {
      answer: buildAskNotFoundReply(index, question),
      sources: [],
      notFound: true,
    };
  }

  const provider = resolveProvider(input.provider);
  const model = resolveModel(provider, input.model);
  const completeFn = options.completeFn ?? completeAsk;

  const rawAnswer = await completeFn(provider, apiKey, model, buildAskMessages(question, sources, input.history));

  return {
    answer: sources.length > 0 ? ensureCitations(rawAnswer, sources) : rawAnswer,
    sources,
    notFound: sources.length === 0,
  };
}
