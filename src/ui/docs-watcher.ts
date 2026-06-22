import type { FSWatcher } from 'chokidar';
import chokidar from 'chokidar';
import type { DocIndex } from '../index/doc-index.js';

const DEBOUNCE_MS = 350;

export class DocsWatcher {
  private watcher: FSWatcher | null = null;
  private revision = 0;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly subscribers = new Set<(revision: number) => void>();

  constructor(private readonly index: DocIndex) {}

  getRevision(): number {
    return this.revision;
  }

  subscribe(listener: (revision: number) => void): () => void {
    this.subscribers.add(listener);
    return () => {
      this.subscribers.delete(listener);
    };
  }

  start(knowledgeRoot: string): void {
    if (this.watcher) {
      return;
    }

    this.watcher = chokidar.watch(knowledgeRoot, {
      ignoreInitial: true,
      ignored: [
        /(^|[/\\])\../,
        '**/.repo-mind/**',
        '**/.worktrees/**',
        '**/node_modules/**',
      ],
    });

    const scheduleRefresh = (): void => {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.index.refresh();
        this.revision += 1;
        for (const listener of this.subscribers) {
          listener(this.revision);
        }
      }, DEBOUNCE_MS);
    };

    this.watcher.on('all', scheduleRefresh);
  }

  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.subscribers.clear();
  }
}
