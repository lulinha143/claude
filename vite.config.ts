import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Strict production CSP: no inline scripts, no eval, no external connections.
// The game makes no network requests at runtime, so 'self' is sufficient.
const PROD_CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; media-src 'self' data: blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'";

// Dev CSP must allow what the Vite dev server needs: React Fast Refresh injects
// an inline module preamble (needs 'unsafe-inline'), some transforms use eval
// ('unsafe-eval'), and HMR connects over a websocket (ws:/wss:). Without this
// the dev server renders a blank page with a "can't detect preamble" error.
const DEV_CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ws: wss:; media-src 'self' data: blob:; object-src 'none'; base-uri 'self'";

// Injects the appropriate CSP meta tag depending on dev vs. build so the same
// index.html works everywhere without a hardcoded (dev-breaking) policy.
function cspPlugin(): Plugin {
  return {
    name: 'wmno-csp',
    transformIndexHtml(html, ctx) {
      const content = ctx.server ? DEV_CSP : PROD_CSP;
      return {
        html,
        tags: [
          {
            tag: 'meta',
            attrs: { 'http-equiv': 'Content-Security-Policy', content },
            injectTo: 'head-prepend',
          },
        ],
      };
    },
  };
}

// The web demo and the Electron renderer share this config.
// `base: './'` keeps asset URLs relative so the same build works when served
// from GitHub Pages (a subpath) and when loaded via file:// inside Electron.
export default defineConfig({
  base: './',
  plugins: [react(), cspPlugin()],
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
