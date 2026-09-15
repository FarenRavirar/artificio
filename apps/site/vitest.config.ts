/// <reference types="vitest/config" />
// `getViteConfig` do Astro, não `defineConfig` do vitest (spec 102, guard do header).
//
// É ele que carrega a config do Astro dentro do vitest e torna resolvível o módulo
// virtual `astro:container` — sem isso, `import { loadRenderers } from 'astro:container'`
// falha com "Failed to resolve import". O guard de estrutura do header depende da
// Container API para renderizar um `.astro` de verdade, com o `<astro-island>` e as tags
// que o Astro injeta ao hidratar; é nelas que estava o defeito de layout de T3.5.
//
// Antes deste arquivo o `site` rodava sem config de vitest. Os 13 testes preexistentes
// seguem cobertos: o `include` default não muda e o `exclude` default já ignora
// `node_modules` e `dist`. Ambiente `node` — o guard renderiza para string e assere por
// posição, e o ambiente jsdom do vitest quebra a Container API (ver nota no guard).
import { getViteConfig } from "astro/config";
import type { ViteUserConfig } from "astro";

// O cast existe porque `getViteConfig` tipa o 1º parâmetro como `ViteUserConfig` puro,
// sem a chave `test` do vitest — o exemplo oficial do Astro
// (`examples/with-vitest/vitest.config.ts`) usa `test` assim mesmo e não passa em
// `tsc --noEmit`. Reportado em withastro/astro#12791 e fechado como "not planned",
// sem workaround oficial. O cast é local e tipado: `test` continua checado pelo
// `/// <reference types="vitest/config" />` acima, e trocar por `any` perderia isso.
export default getViteConfig({
  test: {
    environment: "node",
  },
} as ViteUserConfig);
