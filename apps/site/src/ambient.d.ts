// Tipos de módulos que o TS não resolve sozinho (mesmo padrão de
// `packages/ui/src/ambient.d.ts` e `packages/content-editor/src/ambient.d.ts`).

// `astro/client` declara `*.png`, `*.gif`, `*.webp` etc., mas NÃO declara `*.astro`
// (medido em astro@6.4.8: 75 `declare module` no `client.d.ts`, nenhuma para `.astro`).
// Importar um componente Astro em TypeScript — o que a Container API exige para testar
// um `.astro` de verdade — dá TS2307 sem esta declaração.
//
// O tipo é `AstroComponentFactory`, o mesmo que `container.renderToString()` aceita;
// declarar como `any` faria o teste passar sem checar a chamada.
declare module "*.astro" {
  import type { AstroComponentFactory } from "astro/runtime/server/index.js";

  const Component: AstroComponentFactory;
  export default Component;
}
