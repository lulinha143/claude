import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The web demo and the Electron renderer share this config.
// `base: './'` keeps asset URLs relative so the same build works when served
// from GitHub Pages (a subpath) and when loaded via file:// inside Electron.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    target: 'es2021',
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
