import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('../shared/src', import.meta.url)) },
  },
  server: { port: 5173, host: true },
  // Relative paths so the built game also works from GitHub Pages or any folder.
  base: './',
  // Rapier's physics engine is bundled in; it is big but loads once.
  build: { chunkSizeWarningLimit: 3000 },
});
