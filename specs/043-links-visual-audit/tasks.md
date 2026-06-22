# Tasks — 043 (links: auditoria visual + shared packages/ui)

> **Escopo ampliado:** spec cobre `apps/links` + `packages/ui` (mantenedor decidiu unificar).
> **Relatórios gerados:** `ui-design-review.md` (score 64/100) + `nielsen-heuristics-audit.md` (score 6.2/10).
> **Investigação detalhada:** `debitos.md` (DEB-001 a DEB-005) e `reviews.md` (PR #84).

---

## CONTEXTO PARA AGENTE FRIO

**T0 obrigatório primeiro.** Depois esta spec (`spec.md` + `plan.md`) e a sessão. **Regras para `packages/ui`:** mudança em shared exige smoke proporcional em todos os consumidores.

---

## Fase 0 — Auditoria ✅

- [x] **T1** — Executar `ui-design-review` · feito: score 64/100 (C).
- [x] **T2** — Executar `nielsen-heuristics-audit` · feito: score 6.2/10 (Fair).
- [x] **T3** — Compilar achados em tasks · feito.
- [x] **T4** — Identificar débitos que tocam `packages/ui` · feito.
- [x] **T-final** — Atualizar `specs/backlog.md`, sessão e `project-state.md` · feito.

---

## Fase 1 — Prioritário (Shared `packages/ui` → Máxima Urgência) ✅

> Resolver na raiz compartilhada antes de correções locais. Smoke em todos os consumidores.

- [x] **T5 — Mover logo base64 para asset estático cacheável** · `packages/ui` · 2-3h ✅
  - **Evidência:** `brand.ts` — 3 logos (4KB+4KB+421B) em base64 inline.
  - **Implementado:** Migrou para `import x from "./file.png?url"` (3 PNGs hasheados). `assetsInlineLimit: 0` nos 5 consumidores para prevenir inlining.
  - **Smoke:** ✅ 5/5 builds verdes. Zero `data:image/png;base64` nos dists.

- [x] **T6 — Skeleton/shimmer de carregamento do header (SSO)** · `packages/ui` · 2h ✅
  - **Evidência:** `Header.tsx:158-159` — `<span>Carregando</span>` estático, sem indicador visual.
  - **Implementado:** Texto → "Verificando acesso…". `@keyframes artificio-pulse` (opacidade 0.45↔1.0). Classe `.artificio-session-loading`. `aria-busy="true"`.
  - **Smoke:** ✅ 3/3 builds (links, glossario, mesas). Animação confirmada nos dists.
  - **Heurísticas:** H1.1, H2.1; UI §5.3

- [x] **T7 — Substituir ☰ por SVG no menu toggle** · `packages/ui` · 30min ✅
  - **Evidência:** `Header.tsx:278-286` — caractere `☰` (U+2630) como ícone do menu.
  - **Implementado:** SVG inline de 3 linhas (`stroke="currentColor"`, 18x18, viewBox 24).
  - **Smoke:** ✅ 3/3 builds. Zero `☰` nos dists.
  - **Heurísticas:** H4.3; UI §6.1

---

## Fase 2 — Correções locais (`apps/links`)

> Executar após Fase 1. Aprovação por ação.

### Bloco A: Shell + Consistência ✅

- [x] **T8 — Unificar /busca no shell padrão** · 3-4h ✅
  - **Evidência:** `busca/index.astro` standalone — sem `<PortalHeader />`, sidebar, footer.
  - **Implementado:** Sidebar extraído para `Sidebar.astro` (componente compartilhado). Busca migrada para shell completo (PortalHeader + `.shell` + Sidebar + `<main class="content">` + footer).
  - **Arquivos:** `Sidebar.astro` (NOVO), `index.astro`, `busca/index.astro`.
  - **Smoke:** ✅ 16 páginas. HTML confirma shell completo.
  - **Heurísticas:** H4.1, H4.2, H1.2, H6; UI §5.1, §3.1

- [x] **T9 — Refatorar cores de LinksSearch para tokens CSS** · 2h ✅
  - **Evidência:** 12 classes Tailwind hardcoded (`text-white`, `bg-[#0F1A2E]`, `border-white/10`, etc.).
  - **Implementado:** Todas as cores via `var(--*)` (9 tokens: `--surface`, `--text`, `--muted`, `--faint`, `--border`, `--brand`). `text-red-400` → `text-[var(--state-danger-fg)]` (resolvido pelo DEB-003).
  - **Smoke:** ✅ 16 páginas. Zero cores hardcoded no chunk LinksSearch.
  - **Heurísticas:** H4.2; UI §3.1
  - **Débitos relacionados:** DEB-003 (token `--error`), DEB-005 (spinner inline)

### Bloco B: Feedback e Prevenção de Erro ✅

- [x] **T10 — ReportButton: trigger `<span>`→`<button>` + inline styles→classes + Desfazer** · 1h ✅
  - **Evidência:** Trigger `<span role="button">` com `style={{...}}` inline, sem hover/focus-visible.
  - **Implementado:** Trigger → `<button className="report-trigger">`. Classe `.report-trigger` em `global.css` (hover opacity 0.8, transition). "Desfazer" implementado (5s timer, DELETE API). Modal posteriormente refatorado para `<Modal>` do `@artificio/ui` (DEB-001).
  - **Smoke:** ✅ 16 páginas.
  - **Heurísticas:** H3.1, H4.3, H5.1, H5.3; UI §5.2, §8.3
  - **Débitos:** DEB-001 (modal→@artificio/ui, resolvido), DEB-002 (Escape key, resolvido automaticamente via `<Modal>`)

- [x] **T11 — CTA "Entrar no grupo" com indicador de link externo** · 15min ✅
  - **Evidência:** `<a class="cta-join" target="_blank">` sem indicador visual de external link.
  - **Implementado:** SVG external-link (13x13, `stroke="currentColor"`, `opacity: 0.7`) + `<span class="sr-only">(abre no WhatsApp)</span>`. `.sr-only` adicionada ao `global.css`.
  - **Smoke:** ✅ 16 páginas. SVG + sr-only confirmados em todos os grupos.
  - **Heurísticas:** H5.2

### Bloco C: Tipografia ✅

- [x] **T12 — Resolver fonte Oswald (remover, usar system fonts)** · 1h ✅
  - **Evidência:** 2 locais em `global.css` com `font-family: Oswald, ...` — Oswald nunca carregada (zero `@font-face`, zero woff2).
  - **Decisão:** Hospedagem própria descartada pelo mantenedor (não vale peso para SEO). Substituída por system fonts.
  - **Implementado:** Stack → `"Arial Narrow", "Roboto Condensed", ui-sans-serif, system-ui, sans-serif`. Arial Narrow já era o fallback real em ~70% dos casos.
  - **Smoke:** ✅ 16 páginas. Oswald removida das regras `.group-head h1` e `.admin h1`. Permanece apenas no token `--artificio-font-display` do `packages/ui` (débito separado do design system).
  - **UI:** §2.1

---

## Fase 3 — Melhorias (Esforço Moderado ou Impacto Menor)

- [ ] **T15 — Padronizar line-height (1.5 body, 1.4 compacto)** · 1h · `global.css`
  - `.card .desc` (1.35→1.4), `.regras-intro` (1.5 ok), `.group-desc` (1.6→1.5)
  - **UI:** §2.3

- [ ] **T16 — Subir fonte da sidebar para 0.85rem e remover uppercase de submenus** · 15min · `global.css`
  - `.nav-group > summary`, `.nav-solo`
  - **UI:** §2.2

- [ ] **T17 — Estados de erro para componentes React** · 2h
  - Fallback de erro no SSR/HTML estático. Se API falha, loading eterno. Mensagem amigável + botão "Tentar novamente".
  - **Heurísticas:** H9.1

- [ ] **T18 — Substituir emojis de regras por SVGs** · 1h · `regras.ts` + `index.astro`
  - 7 emojis (🚫📢🧾🎭🤝📣🎲) como ícones.
  - **UI:** §6.3

- [ ] **T19 — Gate adulto: adicionar opção "Esconder conteúdo +18"** · 30min
  - Uma vez desbloqueado (`localStorage`), sem como re-esconder.
  - **Heurísticas:** H3.2

- [ ] **T20 — Adicionar `disabled` + spinner em submits** · 1h
  - Reportar, Sugerir, Admin.
  - **Heurísticas:** H5.3

---

## Fase 4 — Backlog

- [ ] **T30** — Drawer mobile para sidebar · 2-3h — UI §1.1
- [ ] **T31** — Breakpoint intermediário sidebar (900px→220px) · 1h — UI §7.1
- [x] **T32** — ~~Sistema de classes `.input-error`/`.input-disabled`~~ → **DEB-004 (resolvido)** ✅
  > `@artificio/ui` já provê `.artificio-control[data-invalid]`/`:disabled`/`.field-error`. Migrar `<select>` raw do AdminPanel para `<Select>` do design system.
- [ ] **T33** — Filtros por categoria na busca (chips) · 2h — H7.3
- [ ] **T34** — Atalhos de teclado (/ para busca, Esc) · 1h — H7.1
- [ ] **T35** — Página 404 customizada · 30min — H9.2
- [ ] **T36** — Botão "voltar ao topo" · 30min — H3.3
- [ ] **T37** — Transição CSS na troca de tema (0.2s) · 1 linha — UI §10.1
- [ ] **T38** — Mover regras para página própria ou accordion · 2h — H8.3
- [ ] **T39** — Onboarding/banner de boas-vindas · 1h — H10.1

---

## Resumo de Esforço

| Fase | Tasks | Esforço | Escopo | Status |
|------|-------|---------|--------|--------|
| F0 — Auditoria | T1-T4 | — | `apps/links` | ✅ concluído |
| F1 — Shared | T5-T7 | ~5h | `packages/ui` | ✅ concluído |
| F2 — Local | T8-T12 | ~8h | `apps/links` | ✅ concluído |
| F3 — Melhorias | T15-T20 | ~5h | `apps/links` | pendente |
| F4 — Backlog | T30-T39 | ~12h | `apps/links` | pendente |

## Ordem de Execução

1. T5 (logo) → T6 (shimmer) → T7 (menu SVG) — ✅ Fase 1
2. T8+T9 (shell + cores) → T10 (ReportButton) → T11 (CTA) → T12 (Oswald) — ✅ Fase 2
3. T15-T20 (Fase 3) — pendente
4. T30-T39 (Fase 4) — backlog
