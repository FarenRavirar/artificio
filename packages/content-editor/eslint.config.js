import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // `dist-cjs/**` acompanha `dist/**`: o build CJS do sanitizador emite JS
  // compilado que o lint não deve inspecionar (E016 — em máquina que já rodou
  // build, o lint entrava no artefato e acusava erro do compilado, não do fonte).
  { ignores: ['dist/**', 'dist-cjs/**', 'node_modules/**', 'coverage/**', 'vitest.config.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
