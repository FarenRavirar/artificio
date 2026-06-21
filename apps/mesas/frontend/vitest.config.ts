import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    // Baseline de env limpa: o `.env` local (VITE_PUBLIC_SITE_URL/VITE_API_URL)
    // vaza para os testes via Vite e quebra os casos que assumem essas vars vazias
    // (fallback p/ window.origin, precedência beta de VITE_API_URL). Zera a baseline;
    // testes que precisam das vars as setam via vi.stubEnv. `unstubAllEnvs` restaura aqui.
    env: {
      VITE_PUBLIC_SITE_URL: '',
      VITE_API_URL: '',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'dist/',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
