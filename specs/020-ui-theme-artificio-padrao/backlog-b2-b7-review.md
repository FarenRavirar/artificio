# Revisao B2-B7 — Spec 020

Status: **revisao documental** (2026-06-13). Nao altera runtime. Estado de B6/B7 reflete o que ja foi a producao (PRs #24/#25, D065/D066/D067).

## Objetivo

Revisar os debitos B2-B7 a partir do que esta em `dev`, separar o que fecha por documentacao do que continua parcial, e deixar criterio de saida claro para as proximas fatias.

## Matriz

| Debito | Estado | Decisao |
|---|---|---|
| B2 — export static-friendly site Astro | **fechado** | `@artificio/ui/static` criado e consumido pelo site Astro; sem barrel React/auth para dados static. |
| B3 — HeaderAction/changelog/notification shell | **parcial** | Slot/classes/actions ja existem; contrato e fronteira documentados em `header-nav-actions.md`; helper runtime `HeaderAction` ainda nao existe. |
| B4 — primitives | **parcial** | Contrato fechado em `primitives-form-state.md`; implementacao em `packages/ui` fica para T14/fatia propria. |
| B5 — recipes | **fechado** | Recipes documentadas em `page-recipes.md`; runtime em `packages/ui` nao faz parte do debito. |
| B6 — dark readiness glossario | **fechado** | Variante dark implementada/promovida; telas com dados/admin/forms aprovadas pelo mantenedor em prod conforme sessão `26-06-13_1`. |
| B7 — light readiness mesas | **fechado** | Variante light implementada/promovida com default-dark preservado; E2E autenticado final validado pelo mantenedor em prod em 2026-06-15. |

## B2 — export static-friendly site Astro

O site publico ja cumpre a estrategia static/zero-JS:

- `SiteHeader.astro` e `SiteFooter.astro` sao `.astro`, sem React island;
- `global.css` consome `@artificio/ui/styles.css`;
- build T9 ficou static, com JS de shell ausente em `_astro`.

B2 fecha em 2026-06-15 porque:

- `@artificio/ui/static` exporta `faviconV2`, logos e `defaultNavItems` sem React/auth/theme;
- `Base.astro` usa `faviconV2` por `@artificio/ui/static`;
- `content.ts` usa logos/nav por `@artificio/ui/static`;
- `prep-fixtures.mjs` nao gera mais `brand.json`;
- builds `@artificio/ui` e `@artificio/site` verdes, site segue `output: "static"`.

## B3 — HeaderAction/changelog/notification shell

O que ja existe:

- `Header` tem slot `actions`;
- CSS comum existe: `.artificio-header-actions`, `.artificio-header-action`, `.artificio-header-action-badge`;
- mesas e glossario usam o padrao vivo com tema/changelog/badge;
- mesas tem `NotificationBell`, restrito a usuario logado;
- dados/fetch/modais seguem por app.

Decisao: **nao fechar**. O contrato visual esta documentado, mas o componente/helper `HeaderAction` ainda nao existe em `packages/ui`.

Criterio de fechamento:

- implementar `HeaderAction` visual-only em `packages/ui`;
- manter `ChangelogAction`, `NotificationBell` e dados por app ate duplicacao real;
- builds/smokes dos consumidores tocados;
- acessibilidade de icon-only (`aria-label`, foco, badge sem depender so de cor).

## B4 — primitives

O contrato minimo esta fechado em `primitives-form-state.md`:

- `Button`;
- `Field`;
- `TextInput`/`Textarea`/`Select`;
- `Badge`;
- `Panel`;
- `Toolbar`/`FilterPanel`;
- `State`;
- `Modal`/`Drawer`;
- `HeaderAction`.

Decisao: **parcial**. A documentacao esta suficiente; a implementacao fica em T14/fatia propria porque toca `packages/ui` e exige SDD Completo.

Dependencia: variantes semanticas dependem de B11 (`success/warning/danger/info` canonicos) antes de implementar cores de `Button`/`Badge`/`Panel`/`State`.

## B5 — recipes

B5 fica **fechado** como debito documental:

- `PublicSearchPage`;
- `CatalogPage`;
- `AdminWorkspacePage`;
- `AuthPage`;
- `EditorialPage`;
- `DetailPage`.

Os recipes sao guias de composicao, nao componentes obrigatorios. Implementacao futura em `packages/ui` so entra se reduzir duplicacao real em mais de um app.

## B6 — dark readiness glossario

Estado final:

- dark do glossario **em producao** (`glossario.artificiorpg.com`): D065 + PR #24, smoke prod confirmou CSS `[data-theme=dark]` servido;
- usa `[data-theme="dark"]` e remap de utilities; navy proprio migrado `#1a2744`->`#020740`;
- toggle usa `ThemeIcon`/`setTheme` canonicos via `actions` (nao `showThemeToggle`), com `variant` reativo;
- AA medido nos estados principais;
- smoke publico/local cobriu home, login, modal, mobile e troca ao vivo;
- sessao `26-06-13_1` registra aprovacao do mantenedor em prod para cards de termo, detalhe, AddTermModal, select/foco/validacao, admin e mobile.

Criterio de fechamento cumprido; reabrir so com nova evidencia visual de regressao em prod.

## B7 — light readiness mesas

Estado final:

- light do mesas **em producao** (`mesas.artificiorpg.com`): D066/D067 + PR #25, smoke prod confirmou CSS `[data-theme=light]` servido + boot default-dark;
- fixes de `/perfil` light e hero com `banner_url` custom publicados via PR #27/#28;
- `resolveMesasTheme` **honra o cookie compartilhado** (`cookie ? cookie : 'dark'`); sem cookie continua dark;
- cookie `artificio_theme` so vem de escolha explicita (D067: `accounts`/`site` deixaram de grava-lo no boot);
- folha `[data-theme="light"]` cobre tokens, white-utils (~1873) e hexes hardcoded principais;
- smoke publico/local cobriu landing, mobile, troca ao vivo e AA principal.
- E2E final do mantenedor em 2026-06-15 confirmou `/perfil` light com dados reais, perfil publico de mestre com `banner_url` custom e smoke anti-regressao em prod.

Criterio de fechamento cumprido por validacao do mantenedor; reabrir so com nova evidencia visual de regressao em prod.

## Ordem recomendada

1. B6, B7 e B2 estao fechados.
2. Proximo: B4 primitives neutras e B3 `HeaderAction`.
3. Usar B5 como guia para novas telas; extrair recipe runtime so quando houver duplicacao real.
4. Em paralelo, B12 (limpeza do `@import` de fontes: ordem + perf/privacidade) quando tocar o CSS compartilhado.
