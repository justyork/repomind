import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DocIndex } from '../index/doc-index.js';
import type { AbDryRunReport, AbQuestion } from './types.js';

export function materializeCorpusRepo(corpusPath: string): string {
  if (!fs.existsSync(corpusPath)) {
    throw new Error(`corpus directory not found: ${corpusPath}`);
  }

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-ab-demo-'));
  const docsDir = path.join(workDir, 'docs');
  fs.cpSync(corpusPath, docsDir, { recursive: true });
  return workDir;
}

export function validateCorpusAgainstQuestions(
  corpusPath: string,
  questions: AbQuestion[],
): AbDryRunReport {
  const workDir = materializeCorpusRepo(corpusPath);
  try {
    const index = new DocIndex(workDir);
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
      corpusPath,
      docCount: docs.length,
      questionCount: questions.length,
      missingAnchors,
    };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}
