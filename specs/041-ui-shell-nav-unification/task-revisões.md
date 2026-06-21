# 041 — Revisões (bots + humano) do PR

> Registro das revisões do PR `feat/041-ui-shell-nav-unification`. **Regra pétrea:** nenhum agente responde/reage/resolve thread no PR — todo veredicto vive AQUI. Resposta a revisor no PR é só do mantenedor.
>
> Preencher uma linha por achado. Merge só quando TODOS tiverem veredicto e os que **procedem** estiverem aplicados (com autorização de commit própria).

## Status do PR
- Branch: `feat/041-ui-shell-nav-unification`
- PR: _(preencher nº/URL ao abrir)_
- Checks GitHub (`lint + build + test`): _(pendente)_
- Estado das revisões: **aberto** / em análise / encerrado

## Resumo do escopo (Fase 8 — commit + PR)

**47 arquivos no diff** (30 modificados, 17 novos):

| Camada | Arquivos | Mudança |
|--------|----------|---------|
| `packages/ui` | `Header.tsx`, `index.ts`, `theme.tsx`, `hooks.ts` (novo), `modules.ts` | Botões centrais (busca/changelog/tema), menu de conta padronizado, `useTheme()`, `useChangelogBadge()`, `applyHeaderVariant` |
| `apps/mesas` | `AppShell.tsx`, `App.tsx`, `HeaderActions.tsx` | Consome hooks centrais, `/busca` redirect |
| `apps/glossario` | `GlossarioHeader.tsx`, `App.tsx`, `BuscaPage.tsx` (novo) | Consome hooks, `/perfil` uniforme, `/busca` page |
| `apps/links` | `PortalHeader.astro`, `LinksHeader.tsx` (novo), `LinksSearch.tsx` (novo), `busca/index.astro` (novo) | Wrapper React, `/busca` page |
| `apps/accounts` | `main.tsx`, `app.ts` | `/conta` page, dedup tema (remove readCookie/writeThemeCookie próprios) |
| `apps/site` | `astro.config.mjs`, `package.json`, `SiteHeader.astro`, `Base.astro`, `SiteHeaderIsland.tsx` (novo), `busca/index.astro` (novo) | Híbrido Astro+React, remove JS inline duplicado (~4KB), `/busca` Pagefind |
| Docs | `project-state.md`, `specs/041-*/*.md`, `sessoes/*.md` | Spec completa, 13 descobertas em tasks-2.md |
| Lockfile | `pnpm-lock.yaml` | `@astrojs/react`, `react`, `react-dom` p/ site |

**Débitos fechados:** `BL-SHELL-B13`, `D-SHELL1`, `BL-UI-THEME-REACT-HEADER-VARIANT`, `BL-UI-THEME-TOGGLE-SITE-REGRESSION`

**Pendências (tasks-2.md):** D-041-08 (SiteFooter fork), D-041-09 (accounts dedup já corrigido na F5, status a atualizar)

## Achados

| # | Bot/Revisor | Arquivo:linha | Severidade | Achado (resumo) | Veredicto | Justificativa | Ação |
|---|---|---|---|---|---|---|---|
| 1 | _(ex.: coderabbit)_ | | | | procede / descarta / débito | | commit `<sha>` / N/A / `BL-...` |

## Veredictos (legenda)
- **procede** → aplicar fix via novo commit (autorização nominal própria) e referenciar o sha.
- **descarta** → falso-positivo/decisão de design; justificar por que não se aplica.
- **fora de escopo** → procede mas não pertence ao foco do PR. **NÃO empurrar para o backlog / nada para trás.** Investigar, registrar em `tasks-2.md` desta spec e **resolver dentro da própria spec**. Linkar aqui o item de `tasks-2.md`.

## Critério de encerramento (gate de merge)
- [ ] Todos os achados com veredicto registrado.
- [ ] Todos os "procede" aplicados (commits referenciados) e checks verdes de novo.
- [ ] Mantenedor autorizou o merge nominalmente.
