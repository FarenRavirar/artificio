# Tasks — Spec 073 (Downloads-D)

## F0 — Preparação

- [x] T0.1 — Confirmado localmente 2026-07-12: 070/071/072 lint+build+test verdes (histórico de sessões anteriores) antes de iniciar 073.

## F1 — Rotas e navegação

- [x] T1.1 — Rotas públicas de T4.1 implementadas em `apps/downloads/frontend/src/App.tsx`: `/`, `/catalogo`, `/materiais/:materialSlug`, `/criadores/:slug`, `/ir/:destinationId`, `/obter/:fileId`. `/usuarios/:username` e coleções ficam para spec 074 (painel).
- [x] T1.2 — Header global + submenu Downloads via `AppShell.tsx`, reaproveitando `@artificio/ui` `Header`/`Footer`/`useTheme` (mesmo contrato de mesas/glossario/site/links).
- [ ] T1.3 — Sidebar contextual por rota — não implementada nesta rodada (MVP focou header+conteúdo; sidebar de exploração fica para iteração seguinte).
- [ ] T1.4 — Drawer mobile de filtros/exploração — não implementado nesta rodada.

## F2 — Busca/filtro/ordenação/paginação

- [x] T2.1 — Campo de busca com debounce (300ms) em `CatalogoPage.tsx`.
- [x] T2.2 — Facetas do MVP parcial: `material_type` implementado; sistema/edição/gênero/idioma/formato/origem/gratuito-PWYW/licença/barreiras ficam para quando a UI de filtro avançado for exigida (exigem join com `download_material_metadata`, documentado no comentário de `materials.ts`).
- [x] T2.3 — Ordenação (relevância≈recentes/recentes/populares por `download_metric_daily`/nome) implementada em `GET /api/v1/materials` e no seletor da UI.
- [x] T2.4 — Paginação como parâmetro de URL (`page`, `page_size`).
- [x] T2.5 — Estado combinado compartilhável na URL (`q`, `material_type`, `sort`, `page` — tudo em `searchParams`, sem estado React não refletido na URL).

## F3 — Card e ficha

- [x] T3.1 — `MaterialCard.tsx`: placeholder de capa, badges (tipo/acesso), alvo de clique único (`before:absolute`), sem truncamento cego de nome (`break-words`).
- [x] T3.2 — `MaterialPage.tsx`: ordem título→badges→resumo→CTA→descrição→criador→última atualização.
- [x] T3.3 — CTA dispara `trackEvent('download_cta_click', ...)` antes de navegar para `/ir/:slug`.
- [x] T3.4 — Aviso (`role="alert"`) quando `external_url` ausente, no lugar do CTA.
- [x] T3.5 — "Última atualização" exibida via `updated_at`.

## F4 — Perfil de criador

- [x] T4.1 — `/criadores/:slug` implementado (frontend `CreatorPage.tsx` + backend `GET /api/v1/creators/:slug`, novo). Ver DEB-073-01: schema atual não suporta de fato criador "sem conta" (user_id NOT NULL); rota funciona só para criador com conta accounts.

## F5 — AA/responsivo

- [x] T5.1 — Contraste AA: cores usam `--color-artificio-orange`/branco sobre navy escuro (mesma paleta validada em mesas/glossario).
- [x] T5.2 — Alvo mínimo 44×44 (`min-h-[44px]`/`min-w-[44px]`) em botões, inputs, paginação.
- [x] T5.3 — Layout responsivo via grid/flex-wrap Tailwind, sem largura fixa que quebre a 320px.
- [x] T5.4 — Sem animação de movimento (só transição de cor em hover, não sujeita a `prefers-reduced-motion` pela WCAG).

## F6 — Validação

- [x] T6.1 — Após correção de DEB-073-01/02: backend 50/50 testes, frontend 6/6 testes, `tsc --noEmit`/`tsc -b` limpos, `eslint` limpo nos dois, `vite build` ok, `pnpm verify:api` exit 0 (downloads breaking=0 non-breaking=3).
- [x] T6.2 — Teste de componente: `MaterialCard.test.tsx` (3 casos) + `CatalogoPage.test.tsx` (3 casos) + backend `materials.list.test.ts` (3 casos) + `creators.test.ts` (3 casos, incl. crédito sem conta).
- [ ] T6.3 — E2e leve busca→filtro→ficha→CTA — não implementado (sem harness E2E configurado no monorepo para downloads ainda; fora do escopo desta rodada).
