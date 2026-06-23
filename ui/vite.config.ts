import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const uiRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: uiRoot,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(uiRoot, 'index.html'),
        graph: path.resolve(uiRoot, 'graph.html'),
      },
      output: {
        manualChunks(id) {
          if (
            id.includes('@tiptap') ||
            id.includes('prosemirror') ||
            id.includes('node_modules/marked')
          ) {
            return 'editor';
          }
        },
      },
    },
  },
});
