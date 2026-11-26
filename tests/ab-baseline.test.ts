import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runArmBaseline } from '../src/ab-demo/arm-baseline.ts';
import { DocIndex } from '../src/index/doc-index.ts';

const tmpRoots: string[] = [];

function makeRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-mind-baseline-'));
  tmpRoots.push(dir);
  const write = (slug: string, body: string) => {
    const file = path.join(dir, 'docs/wiki', `${slug}.md`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `---\ntype: wiki-page\nslug: ${slug}\nstatus: accepted\ntitle: ${slug}\n---\n${body}`, 'utf8');
  };
  write('fuel', 'Топливо расходуется в рейсе. Заправка топливом возможна на острове. '.repeat(20));
  write('market', 'Рынок продаёт товары за золото. '.repeat(20));
  write('port', 'Порт принимает корабли. Топливо можно купить в порту. '.repeat(5));
  for (let i = 0; i < 6; i += 1) write(`other-${i}`, 'Совсем другая тема про картографию. '.repeat(20));
  return dir;
}

afterEach(() => {
  for (const dir of tmpRoots.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

describe('ab-demo baseline arm', () => {
  it('greps non-latin prompts instead of reading the whole corpus', () => {
    const index = new DocIndex(makeRepo());
    const result = runArmBaseline(index, { id: 'q', prompt: 'Как заправить корабль топливом?', anchorSlugs: ['fuel'] }, 0);
    expect(result.strategy).toBe('grep-then-read');
    expect(result.filesRead).toBeLessThanOrEqual(3);
    expect(result.filesRead).toBeGreaterThan(0);
    expect(result.anchorRead).toBe(true);
  });

  it('reads the files with the most term hits first', () => {
    const index = new DocIndex(makeRepo());
    const result = runArmBaseline(index, { id: 'q', prompt: 'топливо в рейсе', anchorSlugs: ['fuel'] }, 0);
    expect(result.anchorRead).toBe(true);
    expect(result.filesRead).toBeLessThanOrEqual(3);
  });
});
