import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // scripts/camoufox/.venv: venv Python isolado (T3.3, spec 084) com deps
    // vendored (playwright/urllib3) — nao e codigo do projeto, nunca deve
    // ser lintado.
    ignores: ["dist/**", "node_modules/**", "coverage/**", "vitest.config.ts", "scripts/camoufox/.venv/**"],
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
