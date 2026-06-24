import fs from 'node:fs';
import readline from 'node:readline';

export interface TranscriptTokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  source: 'transcript' | 'unavailable';
}

function addUsage(target: TranscriptTokenUsage, usage: Record<string, unknown>): void {
  const input =
    typeof usage.input_tokens === 'number'
      ? usage.input_tokens
      : typeof usage.prompt_tokens === 'number'
        ? usage.prompt_tokens
        : 0;
  const output =
    typeof usage.output_tokens === 'number'
      ? usage.output_tokens
      : typeof usage.completion_tokens === 'number'
        ? usage.completion_tokens
        : 0;

  target.inputTokens += input;
  target.outputTokens += output;
  target.totalTokens += input + output;
}

function extractUsageFromObject(value: unknown, target: TranscriptTokenUsage): void {
  if (!value || typeof value !== 'object') {
    return;
  }

  const record = value as Record<string, unknown>;

  if (record.usage && typeof record.usage === 'object') {
    addUsage(target, record.usage as Record<string, unknown>);
  }

  if (record.message && typeof record.message === 'object') {
    const message = record.message as Record<string, unknown>;
    if (message.usage && typeof message.usage === 'object') {
      addUsage(target, message.usage as Record<string, unknown>);
    }
  }

  if (record.metadata && typeof record.metadata === 'object') {
    const metadata = record.metadata as Record<string, unknown>;
    if (metadata.usage && typeof metadata.usage === 'object') {
      addUsage(target, metadata.usage as Record<string, unknown>);
    }
  }
}

/** Sum token usage from agent transcript JSONL (best-effort). */
export async function parseTranscriptTokens(filePath: string): Promise<TranscriptTokenUsage> {
  if (!fs.existsSync(filePath)) {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0, source: 'unavailable' };
  }

  const usage: TranscriptTokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    source: 'transcript',
  };

  const stream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      extractUsageFromObject(parsed, usage);
    } catch {
      // skip non-JSON lines
    }
  }

  if (usage.totalTokens === 0) {
    usage.source = 'unavailable';
  }

  return usage;
}

export function parseTranscriptTokensSync(filePath: string): TranscriptTokenUsage {
  if (!fs.existsSync(filePath)) {
    return { inputTokens: 0, outputTokens: 0, totalTokens: 0, source: 'unavailable' };
  }

  const usage: TranscriptTokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    source: 'transcript',
  };

  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      extractUsageFromObject(JSON.parse(trimmed) as unknown, usage);
    } catch {
      // skip
    }
  }

  if (usage.totalTokens === 0) {
    usage.source = 'unavailable';
  }

  return usage;
}
