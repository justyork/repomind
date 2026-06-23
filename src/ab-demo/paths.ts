import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

export function resolveAbDemoRoot(startDir: string = process.cwd()): string {
  let current = path.resolve(startDir);

  while (true) {
    const candidate = path.join(current, 'ab-demo');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return path.join(PACKAGE_ROOT, 'ab-demo');
}

export function corpusPath(abDemoRoot: string): string {
  return path.join(abDemoRoot, 'corpus');
}

export function questionsPath(abDemoRoot: string): string {
  return path.join(abDemoRoot, 'questions.json');
}

export function resultsDir(abDemoRoot: string): string {
  return path.join(abDemoRoot, 'results');
}

export function scoreRubricPath(abDemoRoot: string): string {
  return path.join(abDemoRoot, 'score-hallucination.md');
}
