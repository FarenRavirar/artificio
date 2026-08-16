import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * O `site-admin` rodava sem lint: o script era `echo "(site-admin) lint TODO"`
 * porque `eslint .` falha sem `eslint.config`, e a saída foi silenciar em vez
 * de criar a config — mesmo caminho que o `site` percorreu e corrigiu
 * (`apps/site/eslint.config.js`). Consequência: a SPA de autoria do blog, que
 * escreve post e página em produção, nunca passou por análise estática.
 *
 * Mais simples que a do `site`: aqui é SPA React pura (Vite), sem `server/`
 * nem `db/`, então só o `vite.config.ts` precisa de globals de Node.
 */
export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Mesma versão e mesmo preset já usados em `downloads`, `mesas` e
  // `glossario`. Sem ele, o `eslint-disable-next-line
  // react-hooks/exhaustive-deps` de `BlockEditor.tsx` aponta para uma regra que
  // não existe na config — e o ESLint trata isso como erro, não como comentário
  // inócuo.
  reactHooks.configs.flat.recommended,
  {
    ignores: ["dist/**", "node_modules/**"],
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
    // Config de build roda em Node. Declarados à mão em vez de via pacote
    // `globals`: ele não está na raiz do workspace, e dependência nova exige
    // aprovação nominal (`AGENTS.md`).
    files: ["*.config.{js,mjs,ts}"],
    languageOptions: {
      globals: {
        process: "readonly",
        console: "readonly",
        __dirname: "readonly",
      },
    },
  },
];
