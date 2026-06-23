import fs from 'node:fs';
import type { AbQuestion, AbQuestionsFile } from './types.js';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseQuestion(raw: unknown, index: number): AbQuestion {
  if (!raw || typeof raw !== 'object') {
    throw new Error(`questions[${index}] must be an object`);
  }
  const record = raw as Record<string, unknown>;
  if (!isNonEmptyString(record.id)) {
    throw new Error(`questions[${index}].id must be a non-empty string`);
  }
  if (!isNonEmptyString(record.prompt)) {
    throw new Error(`questions[${index}].prompt must be a non-empty string`);
  }
  if (!Array.isArray(record.anchorSlugs) || record.anchorSlugs.length === 0) {
    throw new Error(`questions[${index}].anchorSlugs must be a non-empty array`);
  }
  for (const slug of record.anchorSlugs) {
    if (!isNonEmptyString(slug)) {
      throw new Error(`questions[${index}].anchorSlugs must contain strings`);
    }
  }
  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => isNonEmptyString(tag))
    : undefined;

  return {
    id: record.id,
    prompt: record.prompt,
    anchorSlugs: record.anchorSlugs,
    tags,
  };
}

export function loadQuestions(filePath: string): AbQuestionsFile {
  if (!fs.existsSync(filePath)) {
    throw new Error(`questions file not found: ${filePath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid JSON in ${filePath}: ${message}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`questions file must be a JSON object: ${filePath}`);
  }

  const record = parsed as Record<string, unknown>;
  if (record.version !== 1) {
    throw new Error(`unsupported questions version (expected 1): ${filePath}`);
  }
  if (!Array.isArray(record.questions) || record.questions.length === 0) {
    throw new Error(`questions array must be non-empty: ${filePath}`);
  }

  const questions = record.questions.map(parseQuestion);
  const ids = new Set<string>();
  for (const question of questions) {
    if (ids.has(question.id)) {
      throw new Error(`duplicate question id: ${question.id}`);
    }
    ids.add(question.id);
  }

  return { version: 1, questions };
}
