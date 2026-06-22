import fs from 'node:fs';
import path from 'node:path';
import { DocIndex } from '../index/doc-index.js';
import { closeAllDocsEventStreams } from '../ui/api-handlers.js';
import { DocsWatcher } from '../ui/docs-watcher.js';
import { openDraftsDb } from '../ui/db/drafts-db.js';
import { destroyUiServerConnections, resolveUiStaticDir, startUiServer } from '../ui/server.js';

export interface UiCommandOptions {
  cwd?: string;
  port?: number;
}

export async function runUi(options: UiCommandOptions = {}): Promise<number> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const port = options.port ?? 3847;
  const index = new DocIndex(cwd);

  if (!index.getKnowledgeRoot()) {
    console.error('no docs/ found — run `repo-mind init` or create a docs/ directory');
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
    const draftsDb = openDraftsDb(index.getKnowledgeRoot()!);
    const docsWatcher = new DocsWatcher(index);
    docsWatcher.start(index.getKnowledgeRoot()!);
    const server = await startUiServer({
      host: '127.0.0.1',
      port,
      index,
      staticDir,
      draftsDb,
      docsWatcher,
    });

    const docCount = index.refresh().length;
    const draftCount = draftsDb.listActive().length;
    console.log(
      `RepoMind UI at http://127.0.0.1:${port} (${docCount} docs, ${draftCount} drafts)`,
    );
    console.log('Press Ctrl+C to stop');

    await new Promise<void>((resolve) => {
      let shuttingDown = false;

      const finishShutdown = (): void => {
        closeAllDocsEventStreams();
        destroyUiServerConnections(server);
        try {
          draftsDb.close();
        } catch {
          // ignore close errors during shutdown
        }
        server.close(() => {
          resolve();
        });
      };

      const shutdown = (): void => {
        if (shuttingDown) {
          console.log('\nForce exit.');
          process.exit(1);
          return;
        }
        shuttingDown = true;
        console.log('\nShutting down...');

        const forceTimer = setTimeout(() => {
          finishShutdown();
        }, 2_000);
        forceTimer.unref();

        void docsWatcher.stop().finally(() => {
          clearTimeout(forceTimer);
          finishShutdown();
        });
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
