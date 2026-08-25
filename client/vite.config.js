import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const CLIENT = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(CLIENT, '..');

const API_PORT = process.env.VITE_API_PORT || process.env.PORT || 4000;

export default defineConfig({
  root: CLIENT,
  plugins: [react()],
  resolve: {
    alias: {
      // Module frontends import shared UI/auth from here. Everyone has access to
      // the core repo, so this alias always resolves — even for a developer who
      // only cloned one module.
      '@shell': path.join(CLIENT, 'src', 'shell'),
    },
  },
  server: {
    port: 5173,
    // modules/ lives above client/, so Vite must be allowed to read it.
    fs: { allow: [APP_ROOT] },
    proxy: {
      // Single origin for the browser: the React dev server forwards /api to
      // Express, so the auth cookie is same-site and there is no CORS.
      '/api': { target: `http://localhost:${API_PORT}`, changeOrigin: true },
    },
  },
  build: { outDir: path.join(CLIENT, 'dist'), emptyOutDir: true },
});
