import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `.react-router/` é gerado pelo `react-router typegen` (framework mode, spec
  // 102 T4.2) e reescrito a cada build: os 40 erros que ele acusava
  // (`no-namespace`, `no-empty-object-type`) são da forma que o gerador emite,
  // não de código que alguém escreveu — lintar arquivo gerado só produz ruído
  // que ninguém pode corrigir na origem.
  globalIgnores(['dist', '.react-router']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Mesmo padrão de `apps/accounts/eslint.config.js:24`. Necessário aqui
      // desde o framework mode: `entry.server.tsx` recebe `loadContext` como
      // quinto parâmetro POSICIONAL da assinatura que o React Router chama —
      // não dá para omitir sem deslocar os anteriores, e o app não o usa.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    // No framework mode a rota é obrigada a exportar `loader`, `meta` e
    // `ErrorBoundary` ao lado do componente default — é assim que o React Router
    // descobre o que rodar no servidor. `react-refresh` lê isso como arquivo que
    // mistura componente e não-componente, mas aqui não há alternativa de
    // organização: mover o `loader` para outro arquivo o desliga.
    //
    // A regra continua valendo para todo o resto do app, que é onde ela de fato
    // protege o fast refresh.
    files: ['src/root.tsx', 'src/routes/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
