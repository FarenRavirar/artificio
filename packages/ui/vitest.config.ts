import { defineConfig } from "vitest/config";

// Sem `setupFiles`, e sem `@testing-library/jest-dom`, de propósito: as suítes
// daqui usam só matchers nativos do vitest (`toBeNull`, `toHaveBeenCalled`) e
// os arquivos que precisam de DOM declaram `// @vitest-environment jsdom` no
// topo, em vez de pagar jsdom no pacote inteiro.
//
// Ao adicionar jest-dom aqui um dia: este pacote usa `moduleResolution:
// NodeNext`, e sob NodeNext o `import * as matchers` esbarra em TS2345 porque
// os tipos da lib são CJS (`export =`) enquanto o runtime carrega o `.mjs`, que
// só tem exports nomeados. `packages/catalog-ui/src/test/setup.ts` documenta o
// caso e traz a forma que funciona nos dois lados.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
