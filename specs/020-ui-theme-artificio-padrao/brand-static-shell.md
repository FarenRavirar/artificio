# Paridade brand/static shell — Spec 020

Status: **fechado localmente** (2026-06-15). Implementado por subpath static-only.

## Objetivo

Fechar a lacuna entre o shell publico Astro do `site` e a fonte unica de marca/nav em `packages/ui`, sem quebrar a decisao de zero-JS do publico. O alvo e evitar drift de logo, favicon, nav cross-projetos e textos estaticos do Header/Footer Astro.

## Estado antes da fatia

O comportamento publico esta correto, mas o contrato de fonte unica ainda nao esta fechado:

- `apps/site/src/layouts/Base.astro` importava `faviconV2` pelo barrel `@artificio/ui`.
- `apps/site/src/components/SiteHeader.astro` e `SiteFooter.astro` continuam `.astro`, sem React island.
- `apps/site/src/styles/global.css` importa `@artificio/ui/styles.css`, entao o CSS do shell vem da fonte comum.
- `apps/site/src/lib/content.ts` ja consumia `@artificio/ui/brand` e `@artificio/ui/modules`, mas ainda sem subpath unico static-safe.
- `apps/site/scripts/prep-fixtures.mjs` ainda tinha codigo legado para gerar `brand.json` por regex.

Isso nao era bug visual conhecido. Era risco de drift/import errado: se logo/nav mudasse em `packages/ui`, o Astro podia puxar o barrel React por acidente ou recriar espelho stale.

## Implementacao

Feito em 2026-06-15:

- `packages/ui/src/static.ts` reexporta apenas dados: `faviconV2`, `brandLogoNavy`, `brandLogoNeg`, `defaultNavItems` e tipo `NavItem`;
- `packages/ui/package.json` expõe `exports["./static"]`;
- `apps/site/src/layouts/Base.astro` importa `faviconV2` de `@artificio/ui/static`;
- `apps/site/src/lib/content.ts` importa logos e nav de `@artificio/ui/static`;
- `apps/site/scripts/prep-fixtures.mjs` parou de gerar `brand.json`.

## Criterio de fechamento

- [x] `apps/site/src` nao importa mais o barrel principal `@artificio/ui` para dados static.
- [x] O site consome `@artificio/ui/static`.
- [x] Logos/nav/favicons do site nao divergem silenciosamente de `packages/ui`.
- [x] `SiteHeader.astro` e `SiteFooter.astro` continuam Astro/static, sem React island.
- [x] `pnpm --filter @artificio/ui build` verde.
- [x] `pnpm --filter @artificio/site build` verde.
- [x] Build do site continua `output: "static"`.
- [x] `_astro` continua sem JS de shell; JS permitido segue restrito a FeedbackWidget/Pagefind/GA4/scripts vanilla documentados em `astro-zero-js.md`.

## Rollback

Rollback seguro: voltar imports para `@artificio/ui/brand`/`@artificio/ui/modules` e o favicon para o import anterior. Como a mudanca e static-only, rollback nao toca auth, banco, deploy ou WordPress.

## Fora de escopo

- Migrar o Header/Footer Astro para React.
- Mover regras de sessao/login do site para `packages/ui`.
- Mudar SEO, rotas, importador WP ou Pagefind.
- Resolver B12 (`@import` de fontes) nesta fatia, embora ambos passem pelo shell publico.
