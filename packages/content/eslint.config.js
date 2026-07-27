import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // `dist-cjs/**` faltava aqui, ao contrário dos outros pacotes que emitem o
    // build CJS (auth, catalog-client, catalog-matching, changelog, feedback).
    // O diretório é gitignored, então o CI (checkout limpo) nunca o via; em
    // máquina que já rodou build, o lint entrava no JS compilado e acusava
    // `'process' is not defined  no-undef` em dist-cjs/site.js — erro do
    // artefato, não do fonte. `turbo.json` já lista dist-cjs/** como output.
    ignores: ["dist/**", "dist-cjs/**", "node_modules/**", "coverage/**"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
