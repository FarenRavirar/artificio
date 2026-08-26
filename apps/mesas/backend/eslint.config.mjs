import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "test_jsonrepair.js", "vitest.config.ts"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        // `scripts/*.ts` fica FORA do `include` do tsconfig (que é `src/**/*`,
        // com `rootDir: ./src` — incluir `scripts/` moveria a saída para
        // `dist/src/…` e quebraria o `CMD ["node", "dist/server.js"]` do
        // Dockerfile). Sem `allowDefaultProject`, o `projectService` recusa o
        // arquivo com "was not found by the project service" e o lint falha —
        // medido no CI da PR #289, com `scripts/backfillNotificationOutbox.ts`.
        //
        // Script operacional entra aqui, um a um: a lista é explícita de
        // propósito, para que código de runtime nunca escape do type-check real
        // do projeto por descuido.
        projectService: {
          allowDefaultProject: ['scripts/*.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    },
  },
];
