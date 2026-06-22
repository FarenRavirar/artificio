# Tasks — 043 (links: auditoria visual + shared packages/ui)

> **Docs irmãos:** `debitos.md` (DEB-001 a DEB-013) · `reviews.md` (REV-001 a REV-006) · `spec.md`
> **Relatórios:** `ui-design-review.md` (64/100) + `nielsen-heuristics-audit.md` (6.2/10)

---

## CONTEXTO PARA AGENTE FRIO

**T0 obrigatório primeiro.** Depois esta spec + `debitos.md` (detalhes de implementação por débito). Mudança em `packages/ui` exige smoke cross-app.

---

## Resumo de Status

| Fase | Tasks | Esforço | Status |
|------|-------|---------|--------|
| F0 — Auditoria | T1-T4 | — | ✅ concluído |
| F1 — Shared (`packages/ui`) | T5-T7 | ~5h | ✅ concluído |
| F2 — Local (`apps/links`) | T8-T12 | ~8h | ✅ concluído |
| F3 — Melhorias | T15-T20 | ~5h | ✅ concluído |
| F4 — Backlog | T30-T39 | ~12h | ✅ 12/12 resolvidos (T34 ignorado) |

---

## Fase 0 — Auditoria ✅

- [x] **T1** — `ui-design-review` · score 64/100 (C)
- [x] **T2** — `nielsen-heuristics-audit` · score 6.2/10 (Fair)
- [x] **T3** — Compilar achados em tasks
- [x] **T4** — Identificar débitos `packages/ui`

---

## Fase 1 — Shared `packages/ui` ✅

- [x] **T5** — Logo base64 → asset PNG hasheado · `brand.ts` · 3 PNGs, `assetsInlineLimit: 0` nos 5 consumidores · ✅ 5/5 builds
- [x] **T6** — Shimmer SSO header · `Header.tsx` · `@keyframes artificio-pulse` + `aria-busy` · ✅ 3/3 builds
- [x] **T7** — Menu ☰ → SVG · `Header.tsx` · 3-linhas 18×18 · ✅ 3/3 builds

---

## Fase 2 — Local `apps/links` ✅

- [x] **T8** — Shell busca unificado · `Sidebar.astro` (novo) + `busca/index.astro` · PortalHeader + sidebar + footer · ✅ 16 páginas
- [x] **T9** — LinksSearch cores → tokens CSS · 9 tokens `var(--*)` · `text-red-400` → `var(--state-danger-fg)` · ✅ 16 páginas · → DEB-003, DEB-004, DEB-005
- [x] **T10** — ReportButton trigger `<button>` + Desfazer · `ReportButton.tsx` · modal migrado para `<Modal>` do `@artificio/ui` · ✅ 16 páginas · → DEB-001, DEB-002
- [x] **T11** — CTA external link indicator · SVG + `.sr-only` "(abre no WhatsApp)" · ✅ 16 páginas
- [x] **T12** — Oswald → system fonts · `Arial Narrow` stack, sem woff2 externo · ✅ 16 páginas

---

## Fase 3 — Melhorias `apps/links` ✅

- [x] **T15** — Line-height padronizado (1.5 body, 1.4 compacto) · 4 edições em `global.css` · ✅ 16 páginas
- [x] **T16** — Sidebar fonte 0.8→0.85rem · `global.css` · ✅ 16 páginas
- [x] **T17** — Estados de erro React · `LinksSearch.tsx` +8 linhas (retry button) · demais já resolvidos · ✅ 16 páginas
- [x] **T18** — Emojis regras → SVGs · `regras.ts` 7 ícones + `index.astro` · ✅ 16 páginas
- [x] **T19** — Gate adulto: re-esconder + fix overlay SSR · `CommunityGroups.tsx` + `[slug].astro` · ✅ 16 páginas
- [x] **T20** — Disabled + spinner submits · **FALSO POSITIVO** — 3/3 componentes já implementavam · zero código

---

## Fase 4 — Backlog

| Task | Débito | Descrição | Status |
|------|--------|-----------|--------|
| T30 | DEB-006 | Drawer mobile sidebar | ✅ resolvido |
| T31 | DEB-007 | Breakpoint 900→220px | ✅ resolvido |
| T32 | DEB-004 | `.input-error`/`.input-disabled` → `<Select>` do design system | ✅ resolvido |
| T33 | DEB-008 | Chips de categoria na busca | ✅ resolvido |
| T34 | — | Atalhos de teclado (/ busca, Esc) | 🚫 ignorado (mantenedor) |
| T35 | DEB-009 | Página 404 customizada | ✅ resolvido |
| T36 | DEB-010 | Botão "voltar ao topo" | ✅ resolvido |
| T37 | DEB-011 | Transição CSS troca de tema | ✅ resolvido |
| T38 | DEB-012 | Accordion de regras | ✅ resolvido |
| T39 | DEB-013 | Onboarding/banner boas-vindas | ✅ resolvido |

> **Detalhes de implementação:** `debitos.md` — uma seção por DEB (meta + evidência + implementado + smoke).
> **Relações:** DEB-006 cobre T30 e atenua T36 · DEB-007 (opção 2) pode ser absorvido por DEB-006 · DEB-008 back-end já pronto (`server.ts:75` `?category=`) · DEB-009 infra já pronta (`server.ts:480` `dist/404.html`) · DEB-012 SEO preservado (conteúdo no DOM, `<details>` nativo).

---

## Ordem de Execução

1. T5→T6→T7 (F1) ✅
2. T8+T9→T10→T11→T12 (F2) ✅
3. T15-T20 (F3) ✅
4. T30-T39 (F4) ✅
