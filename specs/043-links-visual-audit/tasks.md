# Tasks — 043 (links: auditoria visual + shared packages/ui)

> **Escopo ampliado:** spec cobre `apps/links` + `packages/ui` (mantenedor decidiu unificar).
> **Relatórios gerados:** `ui-design-review.md` (score 64/100) + `nielsen-heuristics-audit.md` (score 6.2/10).

---

## CONTEXTO PARA AGENTE FRIO (ler antes de tocar)

**T0 obrigatório primeiro:** `.specify/memory/project-state.md` + `docs/agents/context-capsule.md` + `.specify/memory/decisions.md`. Depois esta spec (`spec.md` + `plan.md`) e a sessão `sessoes/26-06-21_6_links_visual-audit.md`.

**Estado atual (2026-06-22):** Auditorias concluídas (28 issues). T20-T22 (shared `packages/ui`) promovidos a prioridade máxima por decisão do mantenedor. Spec 043 cobre tudo — shared e links.

**Regras para `packages/ui`:** mudança em shared package exige smoke proporcional nos consumidores (links, mesas, glossario, site, accounts). Cada task shared deve validar build + lint de cada app consumidor antes de fechar.

---

## Fase 0 — Auditoria ✅

- [x] **T1** — Executar `ui-design-review` · feito: `ui-design-review.md`, score 64/100 (C).
- [x] **T2** — Executar `nielsen-heuristics-audit` · feito: `nielsen-heuristics-audit.md`, score 6.2/10 (Fair).
- [x] **T3** — Compilar achados em tasks · feito.
- [x] **T4** — Identificar débitos que tocam `packages/ui` · feito: 3 débitos promovidos a F1.
- [x] **T-final** — Atualizar `specs/backlog.md`, sessão e `project-state.md` · feito.

---

## Fase 1 — Prioritário (Shared `packages/ui` → Máxima Urgência)

> **Ordem pétrea.** Resolver na raiz compartilhada antes de correções locais. Cada task valida smoke em todos os consumidores. Aprovação por ação (commit/push/PR).

- [x] **T5 — Mover logo base64 do header para asset estático cacheável** · Esforço: M (2-3h) · `packages/ui` ✅
  - **Evidência:** `packages/ui/src/brand.ts:9` (`brandLogoNavy.src` ≈4KB base64), `brand.ts:41` (`brandLogoNeg.src` ≈4KB), `brand.ts:19` (`faviconV2.src` 421B). Consumido em `Header.tsx:5,106`, `accounts/frontend/src/main.tsx:3,42`, `site/src/lib/content.ts:6,55-56`.
  - **Implementado (2026-06-22):**
    - PNGs: `_logo.png`, `_logo_neg.png` (já existiam) + `faviconV2.png` (criado do base64 original) em `packages/ui/src/`.
    - `brand.ts`: base64 substituído por `import x from "./file.png?url"` — Vite resolve como URL hasheada.
    - `ambient.d.ts`: declaração `*.png` + `*.png?url`.
    - Build: `tsc && cp` — PNGs copiados para `dist/`.
    - `?url` previne inlining no Vite/Astro (força asset separado).
    - **Descoberto:** Vite inlinea assets < 4KB (padrão). `_logo_neg.png` (3903B) e `faviconV2.png` (421B) eram inlined mesmo com `?url`. Fix: `build.assetsInlineLimit: 0` nos 5 consumidores (3 vite.config.ts + 2 astro.config.mjs).
  - **Smoke:** ✅ `pnpm build` verde em links, mesas, glossario, site, accounts. ZERO `data:image/png;base64` em HTML/JS de todos. 3 PNGs com hash em cada dist/.
  - **UI:** §6.2
  - **Rollback:** Reverter `brand.ts` para base64 inline + remover `assetsInlineLimit: 0`

- [x] **T6 — Skeleton/shimmer de carregamento do header (SSO)** · Esforço: M (2h) · `packages/ui` ✅
  - **Evidência:** `Header.tsx:158-159` — `if (loading) { return <span className="artificio-session-muted">Carregando</span>; }` — texto estático sem indicador visual.
  - **Consumidores afetados (só apps que usam `<Header>`):** links (via `LinksHeader.tsx`), glossario (via `GlossarioHeader.tsx`), mesas (via `AppShell.tsx`). **NÃO afeta:** site (header Astro próprio `SiteHeader.astro`), accounts (layout minimalista sem Header).
  - **Critério:** Texto muda para "Verificando acesso…" com animação CSS de skeleton/pulse enquanto SSO carrega.
  - **Absorve:** antiga T7 (shimmer header local) — resolvido de uma vez no shared
  - **Smoke:** `pnpm build` em links, glossario, mesas. Verificar header com skeleton em cada app.
  - **Heurísticas:** H1.1; UI §5.3
  - **Investigação (2026-06-22):**
    - **Origem dos registros:** 3 achados convergentes nas auditorias:
      - Nielsen H1.1 (severity 3/Major): "Carregando" sem contexto do que carrega — `nielsen-heuristics-audit.md:36-41`
      - Nielsen H2.1 (severity 2/Minor): "Carregando" sugere algo lento/travado; deveria ser "Verificando sessão…" — `nielsen-heuristics-audit.md:78-81`
      - UI Design Review §5.3 (severity Low): texto estático sem skeleton/spinner — `ui-design-review.md:197-202`
    - **Arquivos investigados:**
      - `packages/ui/src/Header.tsx:105` — `loading` de `useSession()` (SSO) ou `sessionOverride` (glossário legado)
      - `packages/auth/src/client.ts:86-128` — `useSession()`: fetch `GET /api/auth/me` (+ refresh 401), loading=true→false
      - `packages/ui/src/styles.css:267-270` — `.artificio-session-muted` só tem `color` e `font-size`, zero animação
      - `packages/ui/src/Header.tsx:238` — container `<div className="artificio-session" aria-live="polite">` — a11y já ok
    - **Consumidores — como loading chega ao Header:**
      - **links** (`LinksHeader.tsx:21`): sem `sessionOverride` → `useSession()` do auth → fetch /me
      - **mesas** (`AppShell.tsx:45`): sem `sessionOverride` → `useSession()` do auth → fetch /me
      - **glossario** (`GlossarioHeader.tsx:54`): `sessionOverride={{ user: sessionUser, loading }}` → `useAuth()` legado
    - **Padrões existentes no codebase:**
      - `@keyframes artificio-spin` (styles.css:706) — spinner circular (border-top), 28px
      - `.artificio-state-spinner` (styles.css:980) — usa `artificio-spin`, 28px, para `<StateBlock tone="loading">`
      - `.artificio-button-spinner` (styles.css:697) — versão reduzida para `<Button loading>`
      - **NÃO existe shimmer/skeleton/pulse no codebase** — esta task introduz o primeiro
    - **Severidade real:** Minor (não Major como Nielsen H1.1). O texto existe, comunica loading, some rápido (~200ms-2s). Melhoria é polimento UX, não funcionalidade quebrada. O próprio H2.1 classifica como Minor pela rapidez.
    - **Risco de regressão:** Baixo. Mudança é CSS + texto. Fluxo de loading não muda.
    - **Conclusão:** **Procede.** 3 achados convergentes (H1.1, H2.1, UI §5.3) recomendam a mesma correção. Implementar: (1) trocar texto "Carregando"→"Verificando acesso…"; (2) adicionar `@keyframes artificio-pulse` + classe `.artificio-session-loading` com animação de opacidade; (3) smoke build links/glossario/mesas. Severidade ajustada de Major→Minor em relação ao registro original das auditorias.
  - **Implementado (2026-06-22):**
    - `Header.tsx:159`: texto trocado de `<span className="artificio-session-muted">Carregando</span>` para `<span className="artificio-session-loading" aria-busy="true">Verificando acesso…</span>`
    - `styles.css:267-275`: nova classe `.artificio-session-loading` com `animation: artificio-pulse 1.4s ease-in-out infinite` (mantém `color` e `font-size` da original)
    - `styles.css:711-715`: novo `@keyframes artificio-pulse` — opacidade oscila 0.45↔1.0 (primeiro shimmer do codebase; spinner `artificio-spin` já existia)
    - `aria-busy="true"` adicionado ao span para comunicar estado de carregamento a leitores de tela
  - **Smoke:** ✅ 3/3 builds verdes (links, glossario, mesas). `packages/ui/dist/Header.js` confirma "Verificando acesso…" + `artificio-session-loading`. CSS nos 3 dists confirma `@keyframes artificio-pulse`. Zero regressão — "Carregando" residual pertence a outros componentes (ChangelogModal labels, LoadingState primitiva, CommunityGroups/LinksSearch).

- [x] **T7 — Substituir ☰ (emoji) por SVG no menu toggle do header** · Esforço: L (30min) · `packages/ui` ✅
  - **Evidência:** `Header.tsx:278-286` — `<button type="button" className="artificio-menu-toggle" ...> ☰ </button>` (U+2630). Todos os ícones vizinhos são SVG.
  - **Consumidores afetados:** links, glossario, mesas (mesmos de T6 — só apps que usam `<Header>`).
  - **Critério:** SVG inline de 3 barras, consistente com ícones vizinhos (search, changelog, theme).
  - **Absorve:** antiga T11 (menu SVG local) — resolvido de uma vez no shared
  - **Smoke:** `pnpm build` em links, glossario, mesas. Verificar ícone SVG no header de cada um.
  - **Heurísticas:** H4.3; UI §6.1
  - **Investigação (2026-06-22):**
    - **Origem dos registros:** 2 achados convergentes:
      - Nielsen H4.3 (severity 2/Minor): inconsistência — todos ícones do header são SVG inline (search, changelog, theme) exceto menu hamburger que usa caractere ☰ (U+2630) — `nielsen-heuristics-audit.md:133-137`
      - UI Design Review §6.1 (severity Medium): renderização de ☰ varia por OS/fonte — pode aparecer como caractere estranho, box vazio, ou estilo inconsistente — `ui-design-review.md:216-222`
    - **Arquivos investigados:**
      - `packages/ui/src/Header.tsx:278-286` — `<button>` com `☰` (U+2630), `aria-label="Menu"`, `aria-expanded`
      - `packages/ui/src/styles.css:181-196` — `.artificio-menu-toggle`: `font-size: 22px`, `line-height: 1`, `color: inherit`, `min-height/width: 40px`
      - `packages/ui/src/styles.css:1211-1215` — responsive (580px): `display: inline-flex; align-items: center; justify-content: center`
    - **Padrão SVG vizinho (search, changelog, theme):**
      - `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">` + paths
      - O hamburger SVG deve usar o mesmo contrato: viewBox 24x24, width/height 18, stroke="currentColor", strokeWidth="2", strokeLinecap="round"
    - **SVG proposto:** 3 linhas horizontais — `<line x1="3" y1="6" x2="21" y2="6"/>`, `<line x1="3" y1="12" x2="21" y2="12"/>`, `<line x1="3" y1="18" x2="21" y2="18"/>`
    - **Impacto CSS:** `font-size: 22px` deixa de ser necessário para o conteúdo, mas pode permanecer inofensivo. `line-height: 1` igualmente. Nenhuma mudança de CSS obrigatória.
    - **Severidade real:** Minor. Inconsistência visual real, mas funcionalmente correto (aria-label + aria-expanded intactos). O problema central é portabilidade de renderização cross-OS.
    - **Risco de regressão:** Mínimo. Troca de 1 caractere por SVG inline de mesmo propósito. `aria-label="Menu"` e `aria-expanded` permanecem.
    - **Conclusão:** **Procede.** Ambos os achados são válidos. Implementar: (1) substituir `☰` por SVG inline de 3 barras no mesmo padrão dos ícones vizinhos (viewBox 24, width/height 18, stroke currentColor, strokeWidth 2, round); (2) smoke build links/glossario/mesas.
  - **Implementado (2026-06-22):**
    - `Header.tsx:285-289`: `☰` (U+2630) substituído por `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>` — mesmo contrato dos ícones vizinhos (search, changelog, theme)
    - CSS intocado — `font-size: 22px` e `line-height: 1` permanecem inofensivos com SVG inline; `display: inline-flex; align-items: center` no mobile já cobre centralização
    - `aria-label="Menu"` e `aria-expanded` preservados no `<button>`; SVG tem `aria-hidden="true"`
  - **Smoke:** ✅ 3/3 builds verdes (links, glossario, mesas). `packages/ui/dist/Header.js` confirma SVG. Zero `☰` nos 3 dists.

---

## Fase 2 — Correções locais (`apps/links`)

> Executar após Fase 1 (shared) concluída. Cada task = 1 commit. Aprovação por ação.

### Bloco A: Shell + Consistência (raiz de 4+ problemas)

- [x] **T8 — Unificar /busca no shell padrão** · Esforço: M (3-4h) ✅
  - **Evidência:** `apps/links/src/pages/busca/index.astro` — usa `<Base>` mas NÃO inclui `<PortalHeader />`, sidebar nem footer. Só `<main class="max-w-4xl mx-auto px-4 py-8">` com cores hardcoded (text-white, bg-[#0F1A2E]).
  - **Arquivos:** `apps/links/src/pages/busca/index.astro`, `LinksSearch.tsx`
  - **Critério:** Busca renderiza dentro do shell completo (header + sidebar + conteúdo + footer) como `index.astro` e `grupo/[slug].astro`.
  - **Heurísticas:** H4.1, H4.2, H1.2, H6; UI §5.1, §3.1
  - **Rollback:** Reverter página para standalone
  - **Investigação (2026-06-22):**
    - **Origem dos registros:** 3 achados convergentes cobrindo a mesma causa-raiz (página standalone):
      - Nielsen H4.1 (severity 3/Major): `/busca/` completamente fora do padrão de shell — `nielsen-heuristics-audit.md:120-125`
      - UI Design Review §5.1 (severity Critical): `/busca/` rompe com o shell — sem LinksHeader, sidebar, footer — `ui-design-review.md:182-188`
      - Nielsen H4.2 (severity 3/Major): cores hardcoded em LinksSearch quebram tema — `nielsen-heuristics-audit.md:127-131`
    - **Arquivos investigados:**
      - `apps/links/src/pages/busca/index.astro:1-10` — `<Base><main class="max-w-4xl mx-auto px-4 py-8"><h1 class="text-2xl font-bold mb-6 text-white">Buscar Grupos de WhatsApp</h1><LinksSearch client:load /></main></Base>` — sem PortalHeader, sidebar, footer, shell. Cores Tailwind arbitrário.
      - `apps/links/src/components/LinksSearch.tsx:56-98` — input/search com classes fixas: `bg-[#0F1A2E]` (≈`--page` dark mas não idêntico `#0F1830`), `text-white`, `border-white/10`, `bg-[#10203a]/80`, `hover:border-[#FF5722]/30`
      - `apps/links/src/pages/index.astro:35-144` — shell completo (PortalHeader + `.shell` com sidebar + conteúdo + footer)
      - `apps/links/src/pages/admin/index.astro:7-13` — PortalHeader + `<main class="content admin-page">` (sem sidebar — admin não precisa)
      - `apps/links/src/pages/grupo/[slug].astro:36-114` — PortalHeader + breadcrumb + `<main class="content group-page">` (sem sidebar — página de detalhe)
      - `apps/links/src/styles/global.css:6-33` — tokens CSS disponíveis: `--page`, `--surface`, `--surface-soft`, `--text`, `--muted`, `--faint`, `--border`, `--brand`, `--brand-deep`, `--navy` (light+dark)
    - **O que falta vs. home page:**
      | Elemento | Home | Busca | Admin | Grupo |
      |---|---|---|---|---|
      | `<PortalHeader />` | ✅ | ❌ | ✅ | ✅ |
      | `<div class="shell">` | ✅ | ❌ | ❌ | ❌ |
      | `<aside class="sidebar">` | ✅ | ❌ | ❌ | ❌ |
      | Cores via tokens | ✅ | ❌ | N/A | ✅ |
      | Footer | ✅ | ❌ | ❌ | ❌ |
    - **Impacto real:** Grave. Sem PortalHeader → usuário não navega para outros apps, não faz login, não alterna tema. Ironicamente, a página de busca não tem o botão de busca do header. Mapeia para H1 (perda de status de sistema), H4 (quebra de padrão visual), H6 (perda de orientação espacial).
    - **Severidade real:** Major (confirma auditoria). A página é funcionalmente usável (busca funciona), mas a experiência é de "site quebrado" — desconectado do restante do hub.
    - **Relação T8 ↔ T9:** T9 (cores → tokens) é sub-task de T8. Refatorar cores faz parte natural da unificação do shell — quando a página estiver dentro do shell com tokens herdados, muitas cores hardcoded deixam de ser necessárias. Recomendação: implementar T8+T9 juntas como PR única.
    - **Conclusão:** **Procede.** Implementar: (1) adicionar `<PortalHeader />`; (2) envolver busca no shell `.shell` com sidebar (Grupos/Regras/Projetos) + `<main class="content">`; (3) substituir cores hardcoded do `<h1>` e do LinksSearch por tokens CSS; (4) adicionar footer. Smoke: build links + verificar HTML gerado com PortalHeader/sidebar/tokens.
  - **Implementado (2026-06-22):**
    - **Atomicidade:** Sidebar extraído de `index.astro` (27 linhas duplicadas) para `apps/links/src/components/Sidebar.astro` — componente Astro puro, aceita `categories: CategoryBlock[]`, importa `REGRAS_SECTIONS` + `defaultNavItems` internamente. Zero duplicação entre home e busca.
    - **Arquivos modificados (3):**
      - `apps/links/src/components/Sidebar.astro` (NOVO) — sidebar compartilhada: Grupos (categories), Regras (REGRAS_SECTIONS), Projetos (defaultNavItems)
      - `apps/links/src/pages/index.astro` — `<Sidebar categories={categories} />` substitui 24 linhas inline; removido `defaultNavItems` import não mais usado
      - `apps/links/src/pages/busca/index.astro` — página refatorada de standalone (10 linhas) para shell completo: `<PortalHeader />` + `<div class="shell">` + `<Sidebar categories={categories} />` + `<main class="content">` + `<footer class="site">`. Cores hardcoded removidas do template (`text-white`, `max-w-4xl`, `mx-auto`, `px-4`, `py-8`). `h1` usa classe `.page-title` (tokens). Subtítulo `.page-lead` adicionado. `getCategories()` adicionado ao frontmatter.
    - **Cores LinksSearch:** AINDA hardcoded (Tailwind arbitrário: `bg-[#0F1A2E]`, `text-white/40`, etc.) — escopo de T9. A estrutura da página agora herda tokens do shell, mas o componente React não os usa.
    - **CSS intocado:** Nenhuma mudança em `global.css` — tokens, `.shell`, `.sidebar`, `.content`, `.site` já existiam.
  - **Smoke:** ✅ build verde (16 páginas). HTML gerado confirma: `<astro-island>` LinksHeader (PortalHeader), `<div class="shell">`, `<aside class="sidebar">` com nav-group/categorias/regras/projetos, `<h1 class="page-title">` (token), `<footer class="site">`. Zero `text-white`/`bg-[#0F1A2E]` no template Astro. Home page sem regressão (sidebar renderiza via componente). Admin e grupo/[slug] intactos.

- [ ] **T9 — Refatorar cores de LinksSearch para tokens CSS** · Esforço: M (2h) — **sub-task de T8, pode ser PR única**
  - **Evidência:** `LinksSearch.tsx:67` — `bg-[#0F1A2E]` (≈`--page` dark #0F1830, mas não idêntico), `focus:border-[#FF5722]` (=`--brand` #FF5722, correto em valor mas hardcoded). `LinksSearch.tsx:86` — `bg-[#10203a]/80`, `hover:border-[#FF5722]/30`. `LinksSearch.tsx:58,67,73,76,88,90` — `text-white/40`, `border-white/10`, `text-white/50`, `text-red-400`, `text-white` (todos fixos, não respondem a light theme).
  - **FALSO POSITIVO PARCIAL:** `LinksSearch.tsx:73-78` já implementa estados loading/error/empty/results com mensagens. H9.1/H9.3 da auditoria Nielsen são parcialmente incorretos para este componente.
  - **Arquivos:** `apps/links/src/components/LinksSearch.tsx`
  - **Critério:** Todas as cores via `var(--*)`; busca responde a toggle light/dark
  - **Heurísticas:** H4.2; UI §3.1

### Bloco B: Feedback e Prevenção de Erro

- [ ] **T10 — ReportButton: trigger `<span>`→`<button>` + inline styles→classes · sem "Desfazer"** · Esforço: L (1h)
  - **Evidência:** `ReportButton.tsx:85-94` — trigger usa `<span role="button">` com `style={{ fontSize: "0.8rem", ... }}` inline, sem `.report-trigger` CSS, sem hover/focus-visible.
  - **FALSO POSITIVO das auditorias:** O modal de confirmação EXISTE (`ReportButton.tsx:96-202`): form com motivo/descrição, botões Cancelar/Enviar (com `disabled`+spinner `busy`), tratamento de erro (429/400/rede), e estado sucesso "Denúncia enviada" com botão Fechar. As auditorias marcaram "sem confirmação" (H3.1/H5.1 Major) — **incorreto.** Severidade real do trigger = Minor.
  - **Arquivos:** `apps/links/src/components/ReportButton.tsx`, `global.css` (nova classe `.report-trigger`)
  - **Critério:** Trigger vira `<button>` com classe `.report-trigger` com hover/focus-visible/transition. Opcional: opção "Desfazer" por 5s após submit.
  - **Heurísticas:** H4.3 (consistência de componente), H5.3 (prevenção duplo clique — já existe via `disabled`); UI §5.2, §8.3

- [ ] **T11 — CTA "Entrar no grupo" com indicador de link externo** · Esforço: L (15min)
  - **Evidência:** `apps/links/src/pages/grupo/[slug].astro:82-89` — `<a target="_blank" rel="noopener noreferrer">` apontando para `group.inviteUrl` (WhatsApp). Já tem `target="_blank"` e `rel` corretos. Falta indicador VISUAL de que usuário sairá do site.
  - **Critério:** Ícone external-link SVG ou texto "(abre WhatsApp)" visível no CTA.
  - **Heurísticas:** H5.2

### Bloco C: Tipografia

- [ ] **T12 — Resolver fonte Oswald (carregar ou substituir)** · Esforço: L (1h)
  - **Evidência:** `global.css:510` — `.group-head h1 { font-family: Oswald, "Arial Narrow", system-ui, sans-serif; }` e `global.css:565` — `.admin h1` idem. Zero `@font-face`, zero Google Fonts `<link>`, zero woff2 em `public/fonts/`. Oswald só renderiza se instalada no OS.
  - **Critério:** Ou Oswald carrega via self-hosted woff2 + `@font-face`, ou substituída por `system-ui` condensed.
  - **UI:** §2.1

---

## Fase 3 — Melhorias (Esforço Moderado ou Impacto Menor)

- [ ] **T15 — Padronizar line-height (1.5 body, 1.4 compacto)** · Esforço: L (1h)
  - **Arquivos:** `global.css` — ajustar `.card .desc` (1.35→1.4), `.regras-intro` (1.5 ok), `.group-desc` (1.6→1.5)
  - **UI:** §2.3

- [ ] **T16 — Subir fonte da sidebar para 0.85rem e remover uppercase de submenus** · Esforço: L (15min)
  - **Arquivos:** `global.css` — `.nav-group > summary`, `.nav-solo`
  - **UI:** §2.2

- [ ] **T17 — Estados de erro para componentes React (CommunityGroups, SuggestForm, LinksSearch)** · Esforço: M (2h)
  - **Problema:** Nenhum fallback de erro no SSR/HTML estático. Se API falha, loading eterno.
  - **Critério:** Cada componente mostra estado de erro com mensagem amigável + botão "Tentar novamente"
  - **Heurísticas:** H9.1

- [ ] **T18 — Substituir emojis de regras por SVGs** · Esforço: M (1h)
  - **Evidência:** `apps/links/src/data/regras.ts` — 7 emojis (🚫📢🧾🎭🤝📣🎲) como ícones. Renderizado em `apps/links/src/pages/index.astro:120`.
  - **UI:** §6.3

- [ ] **T19 — Gate adulto: adicionar opção "Esconder conteúdo +18"** · Esforço: L (30min)
  - **Problema:** Uma vez desbloqueado (`localStorage`), não tem como re-esconder
  - **Heurísticas:** H3.2

- [ ] **T20 — Adicionar `disabled` + spinner em submits (Reportar, Sugerir, Admin)** · Esforço: L (1h)
  - **Heurísticas:** H5.3

---

## Fase 4 — Backlog (Nice to Have)

- [ ] **T30 — Criar drawer mobile para sidebar (em vez de bloco estático)** · Esforço: M (2-3h) — UI §1.1
- [ ] **T31 — Breakpoint intermediário para sidebar (900px → 220px)** · Esforço: L (1h) — UI §7.1
- [ ] **T32 — Sistema de classes para estados de formulário (.input-error, .input-disabled)** · Esforço: M (2h) — UI §8.2
- [ ] **T33 — Busca: adicionar filtros por categoria (chips abaixo do input)** · Esforço: M (2h) — H7.3
- [ ] **T34 — Atalhos de teclado (/ para busca, Esc para fechar)** · Esforço: L (1h) — H7.1
- [ ] **T35 — Página 404 customizada** · Esforço: L (30min) — H9.2
- [ ] **T36 — Botão "voltar ao topo"** · Esforço: L (30min) — H3.3
- [ ] **T37 — Adicionar transição CSS na troca de tema (0.2s)** · Esforço: L (1 linha) — UI §10.1
- [ ] **T38 — Mover regras para página própria (/regras/) ou accordion** · Esforço: M (2h) — H8.3
- [ ] **T39 — Onboarding/banner de boas-vindas para novos visitantes** · Esforço: L (1h) — H10.1

---

## Resumo de Esforço

| Fase | Tasks | Esforço Total | Escopo | Impacto |
|------|-------|---------------|--------|---------|
| F1 — Shared (urgente) | T5-T7 | ~5h (+1h p/ bundler T5) | `packages/ui` + smoke 3-5 apps | Máximo — resolve raiz cross-app |
| F2 — Links local | T8-T12 | ~8h | `apps/links` | Alto — resolve 12/28 issues |
| F3 — Melhorias | T15-T20 | ~5h | `apps/links` | Médio — resolve 6/28 issues |
| F4 — Backlog | T30-T39 | ~12h | `apps/links` | Baixa prioridade |
| **Total** | **26 tasks** | **~31h** | — | — |

## Ordem de Execução (PÉTREA)

1. **T5** (logo base64 → asset) — `packages/ui`, 2-3h, smoke 5 apps (links, glossario, mesas, site, accounts — todos importam `brand.ts`)
2. **T6** (shimmer header SSO) — `packages/ui`, 2h, smoke 3 apps (links, glossario, mesas — só `<Header>` consumers)
3. **T7** (menu SVG ☰→≡) — `packages/ui`, 30min, smoke 3 apps (links, glossario, mesas — mesmo de T6)
4. **T8 + T9** (shell busca + cores) — `apps/links`, 5h, maior impacto local (4+ problemas)
5. **T12** (Oswald) — `apps/links`, 1h, standalone
6. **T10** (ReportButton) — `apps/links`, 2h
7. **T11** (CTA external link) — `apps/links`, 15min
8. **T15-T20** (F3 melhorias) — `apps/links`, ~6h, podem ser PR única de polish
9. **T30-T39** (F4 backlog) — quando houver tempo
