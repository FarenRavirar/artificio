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
        // `allowDefaultProject` SAIU (PR #289). Ele existia para um único
        // arquivo, `scripts/backfillNotificationOutbox.ts`, que ficava fora do
        // `include` do tsconfig — e essa exceção era o próprio defeito, não a
        // solução: fora do `include`, o script não era checado por tipo por
        // NADA (nem `tsc -p`, nem `tsc -b`, nem o build) e o lint o aceitava
        // sem projeto, produzindo o falso-verde da família registrada em
        // `errors.md` E022.
        //
        // O arquivo foi para `src/scripts/`, que é onde os outros scripts
        // operacionais deste app já viviam (`og:worker`, `discord:sync`,
        // `metrics:cleanup`): entra no type-check real, compila para
        // `dist/scripts/` e passa a existir no container — sem tocar em
        // `rootDir` nem no `CMD ["node", "dist/server.js"]`.
        //
        // Script operacional novo vai para `src/scripts/`. Se algum dia
        // precisar de exceção aqui, ela é sinal de que o arquivo está no lugar
        // errado.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    },
  },
];
