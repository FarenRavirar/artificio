import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // `frontend/**` saiu daqui: era ignorado porque o `projectService` nao
    // achava os `.tsx` em nenhum tsconfig, e o efeito colateral era o painel de
    // papeis globais escapar do lint por completo. Com
    // `frontend/tsconfig.json` no lugar, o servico resolve os arquivos e o
    // ignore deixou de ter motivo (achado do ESLint do CodeRabbit, PR #235).
    ignores: ["dist/**", "node_modules/**", "coverage/**", "vite.config.ts", "vitest.config.ts"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    },
  },
];
