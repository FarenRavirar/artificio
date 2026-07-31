import { defineConfig } from "vitest/config";

export default defineConfig({
  // Sem `@vitejs/plugin-react`: o app usa Vite 8 e `vitest/config` resolve os
  // tipos do Vite 7, o que torna o plugin incompatível no `defineConfig`. Para
  // teste ele é dispensável — a transformação de JSX do próprio Vitest basta;
  // o plugin serve a Fast Refresh, que não existe aqui.
  esbuild: { jsx: "automatic" },
  test: {
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
