import fs from 'node:fs';
import path from 'node:path';
import { DocIndex } from '../index/doc-index.js';
import { resolveUiStaticDir, startUiServer } from '../ui/server.js';

export interface UiCommandOptions {
  cwd?: string;
  port?: number;
}

export async function runUi(options: UiCommandOptions = {}): Promise<number> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const port = options.port ?? 3847;
  const index = new DocIndex(cwd);

  if (!index.getKnowledgeRoot()) {
    console.error('no .project-knowledge/ found — run `repo-mind init`');
    return 1;
  }

  const staticDir = resolveUiStaticDir();
  const indexHtml = path.join(staticDir, 'index.html');
  if (!fs.existsSync(indexHtml)) {
    console.warn(
      'warning: ui/dist not found — run `npm run build:ui` in the repo-mind package',
    );
  }

  try {
    const server = await startUiServer({
      host: '127.0.0.1',
      port,
      index,
      staticDir,
    });

    const docCount = index.refresh().length;
    console.log(`RepoMind UI at http://127.0.0.1:${port} (${docCount} docs)`);
    console.log('Press Ctrl+C to stop');

    await new Promise<void>((resolve) => {
      const shutdown = () => {
        server.close(() => resolve());
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    });

    return 0;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('EADDRINUSE')) {
      console.error(`port ${port} is in use — try --port <other>`);
      return 1;
    }
    console.error(message);
    return 1;
  }
}
