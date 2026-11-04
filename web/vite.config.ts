import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Fully offline: no CDN, no remote fonts. Everything is bundled from node_modules.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
