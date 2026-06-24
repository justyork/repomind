import fs from 'node:fs';
import path from 'node:path';
import type { DocIndex } from '../index/doc-index.js';
import type { AbDryRunReport, AbQuestion } from './types.js';

export function validateQuestionsAgainstIndex(
  index: DocIndex,
  questions: AbQuestion[],
  label: string,
): AbDryRunReport {
  const knowledgeRoot = index.getKnowledgeRoot();
  if (!knowledgeRoot) {
    throw new Error(`no docs/ found in ${label}`);
  }

  const docs = index.refresh();
  const slugSet = new Set(docs.map((doc) => doc.slug));
  const missingAnchors: AbDryRunReport['missingAnchors'] = [];

  for (const question of questions) {
    for (const slug of question.anchorSlugs) {
      if (!slugSet.has(slug)) {
        missingAnchors.push({ questionId: question.id, slug });
      }
    }
  }

  return {
    corpusPath: knowledgeRoot,
    docCount: docs.length,
    questionCount: questions.length,
    missingAnchors,
  };
}

export function defaultSkyforgeQuestionsPath(abDemoRoot: string): string {
  return path.join(abDemoRoot, 'skyforge-questions.json');
}

export function assertQuestionsFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`questions file not found: ${filePath}`);
  }
}
