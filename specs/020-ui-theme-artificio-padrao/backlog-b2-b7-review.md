# Revisao B2-B7 — Spec 020

Status: **revisao documental** (2026-06-13). Nao altera runtime. Estado de B6/B7 reflete o que ja foi a producao (PRs #24/#25, D065/D066/D067).

## Objetivo

Revisar os debitos B2-B7 a partir do que esta em `dev`, separar o que fecha por documentacao do que continua parcial, e deixar criterio de saida claro para as proximas fatias.

## Matriz

| Debito | Estado | Decisao |
|---|---|---|
| B2 — export static-friendly site Astro | **parcial** | Estrategia fechada em `astro-zero-js.md` e revisao T11 em `brand-static-shell.md`; implementacao/paridade real ainda aberta. |
| B3 — HeaderAction/changelog/notification shell | **parcial** | Slot/classes/actions ja existem; contrato e fronteira documentados em `header-nav-actions.md`; helper runtime `HeaderAction` ainda nao existe. |
| B4 — primitives | **parcial** | Contrato fechado em `primitives-form-state.md`; implementacao em `packages/ui` fica para T14/fatia propria. |
| B5 — recipes | **fechado** | Recipes documentadas em `page-recipes.md`; runtime em `packages/ui` nao faz parte do debito. |
| B6 — dark readiness glossario | **parcial** | Variante dark implementada/promovida; falta E2E autenticado com dados/admin/forms para fechar readiness. |
| B7 — light readiness mesas | **parcial** | Variante light implementada/promovida com default-dark preservado; falta E2E autenticado nas telas operacionais para fechar readiness. |

## B2 — export static-friendly site Astro

O site publico ja cumpre a estrategia static/zero-JS:

- `SiteHeader.astro` e `SiteFooter.astro` sao `.astro`, sem React island;
- `global.css` consome `@artificio/ui/styles.css`;
- build T9 ficou static, com JS de shell ausente em `_astro`.

Mas B2 nao fecha porque:

- `Base.astro` ainda importa `faviconV2` pelo barrel principal `@artificio/ui`;
- `brand.json` ainda espelha logos;
- `MODULES` ainda espelha `defaultNavItems`;
- nao ha teste de paridade.

Criterio de fechamento: `@artificio/ui/static` ou teste de paridade real, conforme `brand-static-shell.md`.

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

Estado atual:

- dark do glossario **em producao** (`glossario.artificiorpg.com`): D065 + PR #24, smoke prod confirmou CSS `[data-theme=dark]` servido;
- usa `[data-theme="dark"]` e remap de utilities; navy proprio migrado `#1a2744`->`#020740`;
- toggle usa `ThemeIcon`/`setTheme` canonicos via `actions` (nao `showThemeToggle`), com `variant` reativo;
- AA medido nos estados principais;
- smoke publico/local cobriu home, login, modal, mobile e troca ao vivo.

Nao fecha porque faltam telas autenticadas/com dados:

- cards reais de termo;
- admin;
- AddTermModal;
- forms com validacao;
- selects/dropdowns e estados disabled/erro com dados reais.

Criterio de fechamento: E2E autenticado registrado com prints/medidas AA e checklist T4 completo para esses fluxos.

## B7 — light readiness mesas

Estado atual:

- light do mesas **em producao** (`mesas.artificiorpg.com`): D066/D067 + PR #25, smoke prod confirmou CSS `[data-theme=light]` servido + boot default-dark;
- `resolveMesasTheme` **honra o cookie compartilhado** (`cookie ? cookie : 'dark'`); sem cookie continua dark;
- cookie `artificio_theme` so vem de escolha explicita (D067: `accounts`/`site` deixaram de grava-lo no boot);
- folha `[data-theme="light"]` cobre tokens, white-utils (~1873) e hexes hardcoded principais;
- smoke publico/local cobriu landing, mobile, troca ao vivo e AA principal.

Nao fecha porque faltam telas operacionais autenticadas:

- catalogo com dados;
- detalhe de mesa;
- painel;
- gestao/admin;
- forms multi-step;
- modais/drawers;
- notificacao/changelog no contexto real.

Criterio de fechamento: E2E autenticado registrado com prints/medidas AA e checklist T4 completo, confirmando default-dark sem cookie e light somente por escolha/cookie.

## Ordem recomendada

1. Fechar B6/B7 com E2E autenticado, sem novo codigo se os fluxos passarem.
2. Implementar B2 via `@artificio/ui/static` ou teste de paridade.
3. Cadeia de tokens: B10a (`navy` na trava — **feito**) -> B10b (superficies dark/light ad-hoc dos pilotos) -> **B11** (semanticos `success/warning/danger/info` + shadow/spacing). B11 destrava as variantes coloridas.
4. Implementar B4 primitives neutras primeiro; variantes coloridas (`Button`/`Badge`/`Panel`/`State`) so apos B11.
5. Implementar B3 `HeaderAction` junto das primitives.
6. Usar B5 como guia para novas telas; extrair recipe runtime so quando houver duplicacao real.
7. Em paralelo, B12 (limpeza do `@import` de fontes: ordem + perf/privacidade) quando tocar o CSS compartilhado.
