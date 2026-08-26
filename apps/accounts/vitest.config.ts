import { defineConfig } from "vitest/config";

export default defineConfig({
  // Sem `@vitejs/plugin-react`: o app usa Vite 8 e `vitest/config` resolve os
  // tipos do Vite 7, o que torna o plugin incompatível no `defineConfig`. Para
  // teste ele é dispensável — a transformação de JSX do próprio Vitest basta;
  // o plugin serve a Fast Refresh, que não existe aqui.
  esbuild: { jsx: "automatic" },
  test: {
    // Serializa TAMBÉM entre os dois `projects` abaixo: declarado só dentro de
    // `server`, o `frontend` continuava rodando em paralelo com ele, e os
    // arquivos de integração seguiam disputando o banco (medido: 1 falha em 3
    // execuções, `importLegacyComments` contando 363 atores onde esperava 362).
    fileParallelism: false,
    // Dois ambientes no mesmo app: o backend roda em Node, e o painel de papéis
    // (`frontend/`, `.tsx`) precisa de DOM. `projects` mantém jsdom fora dos
    // testes de servidor — `environmentMatchGlobs` faria o mesmo, mas está
    // deprecado no Vitest 3.
    projects: [
      {
        test: {
          name: "server",
          include: ["src/**/*.test.ts"],
          environment: "node",
          // Seis arquivos de teste compartilham UM banco Postgres
          // (`COMMUNITY_TEST_DATABASE_URL`): `communityCommentReadSql`,
          // `communityWilson`, `communityReadIntegration`,
          // `notificationOutboxSavepoint`, `notificationRecipientsIntegration` e
          // `scripts/importLegacyComments`. Cada um limpa o próprio escopo
          // (`source_app`, e-mail, prefixo), mas nenhum isola o dos outros, e
          // consultas de agregado — contagem de atores, `processOutboxPending`,
          // que varre TODA entrada pendente sem filtrar `source_app` — enxergam
          // as linhas que os vizinhos acabaram de criar.
          //
          // Medido em 2026-08-26, contra Postgres 16 real: em paralelo, 1 falha
          // em 4 execuções da suíte completa, mudando de arquivo entre elas
          // (`importLegacyComments` esperando 122 atores e vendo 123;
          // `notificationOutboxSavepoint` esperando 2 recibos e vendo 1, que foi
          // como o CI da PR #289 quebrou). Em série, 3/3 verdes. Rodando só os 4
          // arquivos de integração juntos, 6/6 verdes — a colisão precisa da
          // concorrência dos 38 arquivos para aparecer.
          //
          // `fileParallelism: false` custa segundos e devolve determinismo. A
          // alternativa real é dar um schema por arquivo, que é trabalho de
          // outra ordem para um ganho que ninguém pediu.
          fileParallelism: false,
        },
      },
      {
        test: {
          name: "frontend",
          include: ["frontend/src/**/*.test.tsx"],
          environment: "jsdom",
        },
      },
    ],
  },
});
