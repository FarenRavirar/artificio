# Paridade brand/static shell — Spec 020

Status: **revisado / aberto**. Esta revisao e documental; nao altera runtime.

## Objetivo

Fechar a lacuna entre o shell publico Astro do `site` e a fonte unica de marca/nav em `packages/ui`, sem quebrar a decisao de zero-JS do publico. O alvo e evitar drift de logo, favicon, nav cross-projetos e textos estaticos do Header/Footer Astro.

## Estado atual em `dev`

O comportamento publico esta correto, mas o contrato de fonte unica ainda nao esta fechado:

- `apps/site/src/layouts/Base.astro` importa `faviconV2` pelo barrel `@artificio/ui`.
- `apps/site/src/components/SiteHeader.astro` e `SiteFooter.astro` continuam `.astro`, sem React island.
- `apps/site/src/styles/global.css` importa `@artificio/ui/styles.css`, entao o CSS do shell vem da fonte comum.
- `apps/site/src/lib/content.ts` importa `brand.json` local e declara `MODULES` localmente.
- `apps/site/src/data/brand.json` espelha `brandLogoNavy` e `brandLogoNeg`.
- `apps/site/scripts/prep-fixtures.mjs` gera `brand.json` extraindo data-URIs de `packages/ui/src/brand.ts` por regex.
- `packages/ui/src/modules.ts` e o `MODULES` local do site hoje estao iguais, mas sem trava de paridade.

Isso nao e bug visual conhecido. E risco de drift: se logo/nav mudar em `packages/ui`, o Astro pode ficar atrasado ou puxar o barrel React por acidente.

## Decisao da revisao

Nao fechar T11 agora. Documentacao so consegue fechar diagnostico e criterio; o fechamento real exige uma fatia de codigo compartilhado (`packages/ui`) ou teste de paridade.

T11/B2 continuam abertos porque:

1. nao existe export static oficial em `@artificio/ui`;
2. `Base.astro` ainda importa pelo barrel principal;
3. `brand.json` e `MODULES` ainda sao espelhos locais;
4. nao existe teste que falhe quando `packages/ui` e `apps/site` divergem.

## Caminho recomendado

Implementar um subpath static-only no pacote compartilhado:

```text
@artificio/ui/static
```

Conteudo permitido:

- `faviconV2`;
- `brandLogoNavy`;
- `brandLogoNeg`;
- `defaultNavItems`;
- textos estaticos comuns, se forem usados pelo shell Astro.

Regras do subpath:

- nao importar/exportar React;
- nao importar/exportar `@artificio/auth`;
- nao importar/exportar `theme.tsx`;
- produzir `.js` e `.d.ts` via `tsc`;
- aparecer em `packages/ui/package.json` em `exports["./static"]`.

Depois, o `site` deve:

- importar `faviconV2`, logos e nav de `@artificio/ui/static`;
- manter `SiteHeader.astro` e `SiteFooter.astro`;
- remover o uso runtime de `brand.json`/`MODULES` espelhado ou trocar por teste de paridade se o espelho continuar por motivo de build;
- manter `@artificio/ui/styles.css` para CSS/tokens;
- continuar sem React/hydration no publico.

## Alternativa aceitavel

Se o subpath static nao entrar na primeira fatia, manter o espelho local temporariamente, mas adicionar teste de paridade:

- compara `apps/site/src/data/brand.json` com `packages/ui/src/brand.ts`;
- compara `MODULES` em `apps/site/src/lib/content.ts` com `defaultNavItems`;
- falha no CI quando houver drift.

Essa alternativa reduz risco, mas nao e tao boa quanto o subpath static porque ainda preserva copia/sync.

## Criterio de fechamento

T11/B2 fecham somente quando todos forem verdade:

- `apps/site/src` nao importa mais o barrel principal `@artificio/ui` para dados static;
- o site consome `@artificio/ui/static` ou possui teste de paridade ativo;
- logos/nav/favicons do site nao podem divergir silenciosamente de `packages/ui`;
- `SiteHeader.astro` e `SiteFooter.astro` continuam Astro/static, sem React island;
- `pnpm --filter @artificio/ui build` verde se o pacote for tocado;
- `pnpm --filter @artificio/site build` verde;
- build do site continua `output: "static"`;
- `_astro` continua sem JS de shell; JS permitido segue restrito a Pagefind/GA4/scripts vanilla documentados em `astro-zero-js.md`.

## Rollback

Rollback seguro: manter o estado atual do site (`brand.json` + `MODULES` local + `SiteHeader.astro`/`SiteFooter.astro`) e voltar o favicon para o import atual. Como a mudanca futura deve ser static-only, rollback nao deve tocar auth, banco, deploy ou WordPress.

## Fora de escopo

- Migrar o Header/Footer Astro para React.
- Mover regras de sessao/login do site para `packages/ui`.
- Mudar SEO, rotas, importador WP ou Pagefind.
- Resolver B12 (`@import` de fontes) nesta fatia, embora ambos passem pelo shell publico.
