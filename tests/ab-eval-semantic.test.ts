import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runLiveEval } from '../src/ab-demo/live-eval.ts';
import { corpusPath, questionsPath, resolveAbDemoRoot } from '../src/ab-demo/paths.ts';
import { materializeCorpusRepo } from '../src/ab-demo/validate-corpus.ts';
import { SemanticIndex } from '../src/embeddings/semantic-index.ts';
import { DocIndex } from '../src/index/doc-index.ts';
import { createFakeEmbedder } from './helpers/fake-embedder.ts';

const tmp: string[] = [];

afterEach(() => {
  for (const dir of tmp.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('live eval search mode', () => {
  it('records lexical vs hybrid', async () => {
    const abRoot = resolveAbDemoRoot();
    const work = materializeCorpusRepo(corpusPath(abRoot));
    tmp.push(work);
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-evalout-'));
    tmp.push(out);

    const base = { cwd: work, questionsFile: questionsPath(abRoot) };
    const silent = console.log;
    console.log = () => undefined;
    try {
      runLiveEval({ ...base, outputPath: path.join(out, 'lexical.json') });
      const semantic = new SemanticIndex(new DocIndex(work), createFakeEmbedder());
      await semantic.sync();
      runLiveEval({ ...base, outputPath: path.join(out, 'hybrid.json'), semantic });
    } finally {
      console.log = silent;
    }
    expect(JSON.parse(fs.readFileSync(path.join(out, 'lexical.json'), 'utf8')).searchMode).toBe('lexical');
    expect(JSON.parse(fs.readFileSync(path.join(out, 'hybrid.json'), 'utf8')).searchMode).toBe('hybrid');
  }, 30_000); // two full live evals; the default 5s is flaky on a busy machine
});
