import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * O `site` rodou sem lint desde que existe: o script era
 * `echo "(site) lint TODO"` porque `eslint .` falhava com
 * "couldn't find an eslint.config file" (medido em 2026-08-14), e a saída foi
 * silenciar em vez de criar a config. Consequência: 37 arquivos TS —
 * incluindo `server/` (a fachada Express), `db/` (repositórios) e `importer/` —
 * nunca passaram por análise estática, no app que guarda o dado mais delicado
 * do monorepo (comentários legados do blog, `plan.md`).
 *
 * Estrutura seguindo `packages/comments/eslint.config.js`, com a diferença que
 * o `site` mistura três ambientes num pacote só: Node (`server`, `db`,
 * `importer`, `scripts`), browser (`src`, ilhas React) e Astro (`.astro`, que
 * o parser TS não lê — ficam fora, como em qualquer setup sem
 * `eslint-plugin-astro`, que seria dependência nova).
 */
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "dist/**",
      "dist.a/**",
      "node_modules/**",
      ".astro/**",
      "public/**",
      // `.astro` exige `eslint-plugin-astro` + parser próprio: dependência
      // nova, que precisa de aprovação. O TS/TSX embaixo já é o que carrega
      // lógica de servidor e de ilha.
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
    // Node puro: build, scripts operacionais, servidor, repositórios e
    // importador. `process`/`console` aqui são o ambiente, não variável
    // esquecida — sem isto o `no-undef` acusa 11 falsos positivos.
    // Declarados à mão em vez de via pacote `globals`: ele não está na raiz do
    // workspace, e dependência nova exige aprovação nominal (`AGENTS.md`).
    files: [
      "*.config.{js,mjs}",
      "scripts/**",
      "server/**",
      "db/**",
      "importer/**",
    ],
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
