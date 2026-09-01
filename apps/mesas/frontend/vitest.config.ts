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
    // Ligar isto faz o jsdom parsear o CSS do Tailwind e emitir 12 avisos
    // `Could not parse CSS stylesheet` (nesting nao suportado). Causa medida e
    // lista das 12 regras no comentario do `import './index.css'` em `App.tsx`.
    css: true,
    // 191 testes de jsdom que, na suíte do monorepo, disputam CPU com os outros
    // 37 pacotes rodando em paralelo. Com o default de 5s, `suggestionModals`
    // estourava `Test timed out in 5000ms` em ~1 de cada 3 execuções completas —
    // reproduzido em 2026-07-31, sempre verde isolado. Os mocks de `fetch`
    // resolvem na hora e não há promessa pendente: o que falta é CPU, não
    // correção. 20s dá folga sem transformar teste travado em espera longa.
    testTimeout: 20_000,
    hookTimeout: 20_000,
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
