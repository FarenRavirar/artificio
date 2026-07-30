import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    // Node 25 expõe Web Storage global. O Vitest enumera globals ao preparar o
    // jsdom e aciona o warning de `--localstorage-file` sem caminho. Desligar a
    // API experimental só no worker preserva `window.localStorage` do jsdom.
    execArgv: ['--no-experimental-webstorage'],
    setupFiles: './src/test/setup.ts',
    css: true,
    env: {
      VITE_PUBLIC_SITE_URL: '',
      VITE_API_URL: '',
    },
  },
});
