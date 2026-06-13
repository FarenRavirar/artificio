# Caminho Astro/zero-JS — Spec 020

Status: **estrategia definida**. Nao altera runtime nesta revisao.

## Objetivo

Garantir que o site publico (`apps/site/src`) continue static-friendly: Astro SSG, HTML/CSS como base, sem exigir React islands nem `@artificio/auth/client` no publico. O admin React (`apps/site-admin`) e o backend Express (`apps/site/server`) ficam fora deste contrato: eles podem usar React/auth porque nao fazem parte do bundle publico do blog.

## Estado atual em `dev`

O site publico ja segue a decisao historica de zero-JS estrutural:

- `astro.config.mjs` usa output static padrao; build reporta `output: "static"`.
- `Base.astro` compoe `SiteHeader.astro`, `SiteFooter.astro`, `SearchModal.astro` e `Analytics.astro`.
- `SiteHeader.astro` e `SiteFooter.astro` sao componentes Astro, nao React.
- `global.css` importa `@artificio/ui/styles.css`, entao o shell Astro reusa CSS/tokens do design system sem importar `Header`/`Footer` React.
- `lib/content.ts` espelha `MODULES` localmente para evitar puxar o barrel React/auth do `@artificio/ui` so para nav.
- `SearchModal.astro` lazy-loads Pagefind somente quando a busca abre.
- `Analytics.astro` injeta GA4 somente quando `PUBLIC_GA_ID` existe.
- `server/*` usa `@artificio/auth` para `/admin/*`; isso e server-side e nao entra no publico SSG.
- `apps/site-admin` e SPA React isolada servida em `/admin`, fora do blog publico.

## JS permitido no publico

Zero-JS aqui significa **sem framework/hydration obrigatoria no publico**, nao "zero bytes de script em qualquer situacao". Scripts pequenos continuam permitidos quando preservam UX/SEO sem framework:

- boot inline de tema antes do paint (`artificio_theme` + `localStorage` + `matchMedia`);
- toggle lua/sol com escrita de cookie somente em escolha explicita (D067);
- atualizacao do link de login para incluir `return` e `theme`;
- probe opcional de sessao via `accounts /api/auth/me` + refresh para trocar "Entrar" por "Conta"/"Admin";
- TOC ativo por `IntersectionObserver`;
- Pagefind lazy-loaded sob demanda;
- GA4 env-gated.

Esses scripts devem permanecer vanilla, curtos, sem bundler de React e sem importar `@artificio/auth/client`.

## JS proibido no publico

- `client:*` em componentes React no shell publico.
- Importar `Header`, `Footer`, `ThemeToggle` ou qualquer componente React de `@artificio/ui` no `apps/site/src`.
- Importar `@artificio/auth/client` no `apps/site/src`.
- Mover controle editorial/admin para o bundle publico.
- Transformar login de header em auth island obrigatoria.

## Ponto de atencao: `@artificio/ui` barrel

Hoje `Base.astro` importa `faviconV2` de `@artificio/ui`. O HTML gerado continua sem React, mas o import pelo barrel passa por um pacote cujo `index.ts` tambem reexporta `Header`, `Footer` e `theme` React. Isso nao quebra o publico agora, mas nao e o melhor contrato static-friendly.

Caminho correto para B2/T11:

1. criar export static oficial em `@artificio/ui`, por exemplo `@artificio/ui/brand-static` ou `@artificio/ui/static`, contendo apenas dados serializaveis: `faviconV2`, logos, dimensoes, alt, `defaultNavItems` e textos estaticos;
2. `apps/site/src` passa a importar apenas esse subpath static ou JSON gerado;
3. `brand.json` e `MODULES` deixam de ser espelhos manuais ou ganham teste de paridade contra a fonte unica;
4. `SiteHeader.astro`/`SiteFooter.astro` continuam `.astro` e consomem dados/classes static, nao componentes React;
5. build valida que `_astro` nao contem `.js` de shell, apenas CSS; JS de Pagefind segue isolado em `/pagefind`.

Isso fecha B2/T11 quando implementado. T9 fecha agora porque a estrategia esta definida e a fronteira esta clara.

## Matriz de fronteira

| Area | Caminho permitido | Caminho proibido |
|---|---|---|
| Header/Footer publico | `.astro` + CSS vars/classes de `@artificio/ui/styles.css` | React island do `Header`/`Footer` |
| Nav cross-projetos | dados static/paridade com `defaultNavItems` | importar barrel React para renderizar nav |
| Tema | inline vanilla + cookie `artificio_theme` + CSS `[data-theme]` | `ThemeToggle` React no site publico |
| Auth no header | link + probe vanilla opcional contra `accounts` | `@artificio/auth/client` / session provider |
| Busca | Pagefind lazy-load sob demanda | SPA/search framework sempre carregado |
| Admin | `apps/site-admin` React isolado em `/admin` | misturar admin React no blog publico |
| SEO/content | Astro SSG + `@artificio/content` + JSON-LD | SSR publico obrigatorio |

## Validacao executada

Comandos:

```powershell
pnpm --filter @artificio/site build
rg -n '@artificio/auth|react|client:|<script|is:inline|PagefindUI|@artificio/ui' apps/site/src apps/site/package.json apps/site/astro.config.mjs
rg --files apps/site/dist | rg '\.js$'
Get-ChildItem -Recurse apps/site/dist/_astro -ErrorAction SilentlyContinue
```

Resultado:

- build verde: `output: "static"`, 45 paginas geradas, Pagefind indexou 8 paginas;
- `_astro` contem somente CSS (`_slug_*.css`), sem `.js` de shell;
- `.js` em `dist` vem de `/pagefind/*`;
- grep do `dist` mostra scripts inline de tema/sessao/TOC e lazy-load de Pagefind, mas nao React;
- `@artificio/auth` aparece em `apps/site/package.json` e `apps/site/server/*`, nao no `apps/site/src` publico;
- `react` aparece em `apps/site-admin`, nao no `apps/site/src` publico.

Aviso observado no build: `@import rules must precede all rules` por causa de `@import url(...)` em `packages/ui/src/styles.css` apos import/compilacao. Nao bloqueia T9; pode virar limpeza de CSS em fatia propria.

## Criterio de fechamento T9

T9 fecha porque o site tem caminho static-friendly documentado, validado por build, com fronteira clara entre publico SSG, scripts vanilla permitidos, admin React isolado e auth server-side. B2/T11 seguem como backlog para export/paridade static oficial de brand/header/footer.
