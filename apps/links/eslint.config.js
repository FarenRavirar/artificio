import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * O `links` rodava sem lint: o script era `echo "(links) lint TODO"` porque
 * `eslint .` falha sem `eslint.config`, e a saída foi silenciar em vez de criar
 * a config — mesmo caminho que o `site` percorreu e corrigiu
 * (`apps/site/eslint.config.js`).
 *
 * Mesma mistura de três ambientes do `site`: Node (`server`, `db`, `scripts`),
 * browser (`src`) e Astro (`.astro`, que o parser TS não lê — ficam fora, como
 * em qualquer setup sem `eslint-plugin-astro`, que seria dependência nova).
 */
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".astro/**",
      "public/**",
      // `.astro` exige `eslint-plugin-astro` + parser próprio: dependência
      // nova, que precisa de aprovação. O TS embaixo já é o que carrega lógica
      // de servidor.
      "**/*.astro",
    ],
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
  {
    // Node puro: config de build, servidor, repositórios e scripts.
    // `process`/`console` aqui são o ambiente, não variável esquecida.
    // Declarados à mão em vez de via pacote `globals`: ele não está na raiz do
    // workspace, e dependência nova exige aprovação nominal (`AGENTS.md`).
    files: ["*.config.{js,mjs,ts}", "scripts/**", "server/**", "db/**"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
      },
    },
  },
];
