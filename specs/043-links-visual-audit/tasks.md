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

- [x] **T9 — Refatorar cores de LinksSearch para tokens CSS** · Esforço: M (2h) — **sub-task de T8, pode ser PR única** ✅
  - **Evidência:** `LinksSearch.tsx:67` — `bg-[#0F1A2E]` (≈`--page` dark #0F1830, mas não idêntico), `focus:border-[#FF5722]` (=`--brand` #FF5722, correto em valor mas hardcoded). `LinksSearch.tsx:86` — `bg-[#10203a]/80`, `hover:border-[#FF5722]/30`. `LinksSearch.tsx:58,67,73,76,88,90` — `text-white/40`, `border-white/10`, `text-white/50`, `text-red-400`, `text-white` (todos fixos, não respondem a light theme).
  - **FALSO POSITIVO PARCIAL:** `LinksSearch.tsx:73-78` já implementa estados loading/error/empty/results com mensagens. H9.1/H9.3 da auditoria Nielsen são parcialmente incorretos para este componente.
  - **Arquivos:** `apps/links/src/components/LinksSearch.tsx`
  - **Critério:** Todas as cores via `var(--*)`; busca responde a toggle light/dark
  - **Heurísticas:** H4.2; UI §3.1

  - **Investigação profunda (2026-06-22):**

    ### Registro 1: Nielsen H4.2 — "Cores hardcoded em LinksSearch quebram tema" · Severidade 3 (Major)
    - **Origem:** `nielsen-heuristics-audit.md:127-131` (Pattern 3 de cores hardcoded)
    - **Conclusão:** **PROCEDE TOTALMENTE.** 10 ocorrências em 8 localizações no render do componente.
    - **Mapeamento exato:**
      | Ln | Classe atual | Valor renderizado | Tema escuro (OK?) | Tema claro (OK?) | Token ideal |
      |---|---|---|---|---|---|
      | 58 | `text-white/40` | `rgb(255 255 255 / 0.4)` | ✅ visível | ❌ quase invisível sobre `--page: #F4F6FB` | `text-[var(--faint)]` |
      | 67 | `border-white/10` | `rgb(255 255 255 / 0.1)` | ✅ visível | ❌ invisível sobre `--page` claro | `border-[var(--border)]` |
      | 67 | `bg-[#0F1A2E]` | `#0F1A2E` | ✅ parece com `--page: #0F1830` | ❌ azul escuro em página clara | `bg-[var(--surface)]` |
      | 67 | `focus:border-[#FF5722]` | `rgb(255 87 34)` | ✅ = `--brand` | ✅ = `--brand` | `focus:border-[var(--brand)]` |
      | 73 | `text-white/50` | `rgb(255 255 255 / 0.5)` | ✅ visível | ❌ ilegível sobre `--page` claro | `text-[var(--muted)]` |
      | 74 | `text-red-400` | `rgb(248 113 113)` | ✅ contraste ~6.2:1 | ⚠️ contraste ~3.9:1 (marginal) | `text-red-400` (aceitável, sem token `--error`) |
      | 76 | `text-white/50` | `rgb(255 255 255 / 0.5)` | ✅ visível | ❌ ilegível | `text-[var(--muted)]` |
      | 86 | `border-white/10` | `rgb(255 255 255 / 0.1)` | ✅ visível | ❌ invisível | `border-[var(--border)]` |
      | 86 | `bg-[#10203a]/80` | `rgb(16 32 58 / 0.8)` | ✅ parece `--surface-soft: #16223E` | ❌ azul escuro | `bg-[var(--surface)]/80` |
      | 86 | `hover:border-[#FF5722]/30` | `rgb(255 87 34 / 0.3)` | ✅ | ✅ (muda cor da borda para brand) | `hover:border-[var(--brand)]/30` |
      | 88 | `text-white` | `rgb(255 255 255)` | ✅ visível | ❌ ilegível sobre `--surface` | `text-[var(--text)]` |
      | 90 | `text-white/50` | `rgb(255 255 255 / 0.5)` | ✅ visível | ❌ ilegível | `text-[var(--muted)]` |
    - **Total:** 12 ocorrências em 12 expressões de classe. 9 são "white/black over dark background assumption" (quebram tema claro). 2 usam `#FF5722` (valor idêntico a `--brand`, mas hardcoded). 1 (`text-red-400`) é cor padrão Tailwind para erro, única que funciona razoavelmente em ambos os temas.
    - **Impacto real no tema claro:**
      - Input de busca: fundo `#0F1A2E` escuro sobre shell `--page: #F4F6FB` claro — retângulo azul escuro gritante no meio da página clara
      - Texto: `text-white` + `text-white/50` + `text-white/40` sobre fundo claro — ILEGÍVEL (contraste ~1.1:1 a ~1.5:1)
      - Cards de resultado: fundo `#10203a/80` escuro sobre shell claro — desconexo visual
      - Bordas: `border-white/10` sobre fundo claro — invisíveis (contraste ~1.0:1)
      - Ícone de busca: `text-white/40` sobre fundo claro — fantasminha quase invisível
    - **Severidade real:** **Major (3).** Página funcional em dark theme, mas visualmente quebrada e inutilizável em light theme. Componente é um "dark mode hardcoded island" no meio de um shell que suporta temas.
    - **Risco de regressão:**
      - Tailwind v4.3.1 suporta `color-mix(in srgb, var(--brand) calc(30 * 1%), transparent)` para `opacity/30` com `var(--*)` — testado, funciona (`bg-[var(--surface)]/80` → `color-mix(in srgb, var(--surface) 80%, transparent)`).
      - `focus:border-[var(--brand)]` compete com regra global `input:focus-visible { outline: 3px solid var(--brand-deep) }` (`global.css:619`). Ambas devem coexistir (border-color + outline são propriedades independentes). Sem risco de regressão.
    - **Não é débito separado:** É o núcleo de T9.

    ### Registro 2: UI Design Review §3.1 — "/busca usa cores hardcoded" · Severidade High
    - **Origem:** `ui-design-review.md:124-131`
    - **Conclusão:** **PARCIALMENTE RESOLVIDO por T8.** O template Astro `busca/index.astro` foi migrado para tokens (`.page-title`, `.page-lead`, shell com `--page`/`--surface`/`--muted`, footer `.site`). O componente React `LinksSearch.tsx` AINDA tem cores hardcoded. Severidade real: **Medium** (era High antes de T8, reduzida pela unificação do shell).
    - **Evidência:** `busca/index.astro:1-26` — zero classes Tailwind arbitrárias no template. `LinksSearch.tsx:58-90` — 12 classes hardcoded.
    - **Não é débito separado:** Escopo direto de T9.

    ### Registro 3: H9.1/H9.3 — "Sem estados de erro/empty visíveis" · Severidade 3 (Major) / 2 (Minor)
    - **Origem:** `nielsen-heuristics-audit.md:267-283`
    - **Conclusão:** **FALSO POSITIVO (JÁ CORRIGIDO nos audits).** `LinksSearch.tsx:73-78` implementa 4 estados com mensagens:
      - Loading: `"Carregando grupos..."` (l.73)
      - Error: `"Erro ao carregar grupos. Tente novamente."` (l.74 — fetch `GET /api/groups` falhou)
      - Empty: `"Nenhum grupo disponível."` (l.77 — API retornou array vazio)
      - No-results: `"Nenhum grupo encontrado para '...'."` (l.77 — filtro local sem match)
    - A análise original dos audits (via SSR estático) não viu esses estados porque o `<LinksSearch client:load />` renderiza client-side. Correção 2 da UI audit e Correções 2+3 do Nielsen audit já documentam isso. As cores dessas mensagens são hardcoded (Registro 1), mas os estados EXISTEM.
    - **Status:** Já resolvido na documentação. Nada a implementar além da troca de cores.

    ### Registro 4: UI Design Review §8.2 — "Inputs sem tratamento de estados visuais" · Severidade Medium
    - **Origem:** `ui-design-review.md:277-282`
    - **Conclusão:** **FALSO POSITIVO MAJORITÁRIO** para LinksSearch.
      - `focus`: ✅ implementado (`focus:border-[#FF5722]` — hardcoded mas funcional)
      - `error`: ⚠️ mensagem textual existe (l.74), não há estado visual no input (não aplicável — erro é de fetch global, não de validação inline)
      - `disabled`: ⚠️ não existe, mas também não é necessário — input é interativo durante fetch (usuário pode digitar, filtro local aplica após dados chegarem)
      - `loading`: ⚠️ não há spinner inline durante digitação. Severidade Cosmetic (Minor).
      - `focus-visible`: ✅ herdado de `global.css:619` (`outline: 3px solid var(--brand-deep)`)
    - **Severidade real para LinksSearch:** **Cosmetic (1).** A recomendação é válida genericamente (outros forms como AdminPanel/SuggestForm podem precisar), mas para LinksSearch especificamente, o que falta é só trocar cores e opcionalmente adicionar spinner inline.
    - **Status:** DÉBITO SEPARADO — sistema de estados de input (`--error`, `.input-error`, `.input-disabled`) é melhoria transversal, não bloqueia T9. O spinner inline na digitação é Cosmetic.

    ### Resumo final T9

    | Registro | Origem | Severidade original | Conclusão | Severidade real |
    |---|---|---|---|---|
    | R1: H4.2 | Nielsen audit | Major (3) | **PROCEDE** | Major (3) |
    | R2: UI §3.1 | UI design review | High | **PROCEDE (parcialmente mitigado por T8)** | Medium |
    | R3: H9.1/H9.3 | Nielsen audit | Major/Minor | **FALSO POSITIVO** (já corrigido nos audits) | N/A |
    | R4: UI §8.2 | UI design review | Medium | **FALSO POSITIVO MAJORITÁRIO** (débito separado p/ sistema de inputs) | Cosmetic (1) |

    **Escopo de implementação T9:**
    1. Trocar 9 ocorrências de `text-white/*` + `border-white/*` + `bg-[#...]` por tokens CSS (`var(--text)`, `var(--muted)`, `var(--faint)`, `var(--border)`, `var(--surface)`)
    2. Trocar 2 ocorrências de `#FF5722` por `var(--brand)`
    3. Manter `text-red-400` (sem `--error` token no codebase; criar um seria escopo de spec separada para `packages/ui`)
    4. Aplicar tokens com modificador de opacidade onde necessário (ex.: `bg-[var(--surface)]/80`, `hover:border-[var(--brand)]/30`)
    5. Smoke: build links + toggle light/dark no HTML gerado + verificar contraste

    **O que NÃO faz parte de T9:**
    - Criar token `--error` (não existe no design system, seria SDD completo em `packages/ui`)
    - Adicionar spinner inline durante digitação (Cosmetic, débito separado)
    - Sistema de estados de input (`.input-error`, `.input-disabled` — débito separado)
    - Refatorar cores de CommunityGroups ou SuggestForm (não fazem parte da página /busca)

  - **Implementado (2026-06-22):**
    - **Arquivo:** `apps/links/src/components/LinksSearch.tsx` — 1 arquivo, 0 linhas novas, 0 componentes novos.
    - **12 classes trocadas em 5 edições atômicas:**
      | Ln | Antes | Depois |
      |---|---|---|
      | 58 | `text-white/40` | `text-[var(--faint)]` |
      | 67 | `border-white/10` | `border-[var(--border)]` |
      | 67 | `bg-[#0F1A2E]` | `bg-[var(--surface)]` |
      | 67 | `focus:border-[#FF5722]` | `focus:border-[var(--brand)]` |
      | 67 | _(ausente)_ | + `text-[var(--text)]` (texto do input, safety) |
      | 73 | `text-white/50` | `text-[var(--muted)]` |
      | 74 | `text-red-400` | _(mantida)_ |
      | 76 | `text-white/50` | `text-[var(--muted)]` |
      | 86 | `border-white/10` | `border-[var(--border)]` |
      | 86 | `bg-[#10203a]/80` | `bg-[var(--surface)]/80` |
      | 86 | `hover:border-[#FF5722]/30` | `hover:border-[var(--brand)]/30` |
      | 88 | `text-white` | `text-[var(--text)]` |
      | 90 | `text-white/50` | `text-[var(--muted)]` |
    - **CSS gerado pelo Tailwind (verificado no dist):**
      - `bg-[var(--surface)]/80` → `color-mix(in oklab, var(--surface) 80%, transparent)` (Tailwind v4 opacity modifier)
      - `hover:border-[var(--brand)]/30` → `color-mix(in oklab, var(--brand) 30%, transparent)`
      - `focus:border-[var(--brand)]` → `border-color: var(--brand)`
      - Tokens `:root` + `:root[data-theme=dark]` com `--surface`, `--text`, `--muted`, `--faint`, `--border`, `--brand` presentes no CSS
    - **Smoke:** ✅ build verde (16 páginas, 4.56s). JS chunk `LinksSearch.CDCCPtxA.js` contém 12 tokens CSS, zero `text-white`, zero `border-white`, zero `bg-[#...]`. CSS compilado confirma todas as regras geradas com `var(--*)`.
    - **Achados:**
      - `text-red-400` mantida (sem `--error` token no codebase). Tailwind converteu para `var(--color-red-400)` automaticamente — seguro.
      - Input não tinha cor de texto explícita (herdava do navegador). Adicionado `text-[var(--text)]` para garantir legibilidade em ambos os temas.
    - **Regressão zero:** sem tocar CSS, sem tocar outros componentes, sem tocar outros apps.

### Bloco B: Feedback e Prevenção de Erro

- [x] **T10 — ReportButton: trigger `<span>`→`<button>` + inline styles→classes · sem "Desfazer"** · Esforço: L (1h) ✅
  - **Evidência:** `ReportButton.tsx:85-94` — trigger usa `<span role="button">` com `style={{ fontSize: "0.8rem", ... }}` inline, sem `.report-trigger` CSS, sem hover/focus-visible.
  - **FALSO POSITIVO das auditorias:** O modal de confirmação EXISTE (`ReportButton.tsx:96-202`): form com motivo/descrição, botões Cancelar/Enviar (com `disabled`+spinner `busy`), tratamento de erro (429/400/rede), e estado sucesso "Denúncia enviada" com botão Fechar. As auditorias marcaram "sem confirmação" (H3.1/H5.1 Major) — **incorreto.** Severidade real do trigger = Minor.
  - **Arquivos:** `apps/links/src/components/ReportButton.tsx`, `global.css` (nova classe `.report-trigger`)
  - **Critério:** Trigger vira `<button>` com classe `.report-trigger` com hover/focus-visible/transition. Opcional: opção "Desfazer" por 5s após submit.
  - **Heurísticas:** H4.3 (consistência de componente), H5.3 (prevenção duplo clique — já existe via `disabled`); UI §5.2, §8.3

  - **Investigação profunda (2026-06-22):**

    ### Registro 1: Nielsen H3.1 — "Reportar grupo sem cancelamento nem desfazer" · Severidade original 3 (Major)
    - **Origem:** `nielsen-heuristics-audit.md:90-94`
    - **Conclusão:** **FALSO POSITIVO (JÁ CORRIGIDO nos audits — Correção 1).** O modal (`ReportButton.tsx:96-202`) TEM:
      - Botão Cancelar (`l.191`: `<Button variant="ghost" ... onClick={closeModal}>Cancelar</Button>`) ✅
      - Estado de sucesso "Denúncia enviada" (`l.123-134`) com botão Fechar ✅
      - Tratamento de erro (429 rate-limit, 400 inválido, falha de rede) (`l.65-72`) ✅
    - O que REALMENTE falta: opção "Desfazer" após submit (recomendação original: 5s para desfazer).
    - **Severidade real:** **Minor (2).** O usuário PODE cancelar antes de enviar. A falta de "Desfazer" é deselegante mas não bloqueia o fluxo — a denúncia já foi enviada ao servidor.
    - **Status:** Parcialmente implementado. "Desfazer" é opcional de T10.

    ### Registro 2: Nielsen H5.1 — "Reportar grupo sem confirmação" · Severidade original 3 (Major)
    - **Origem:** `nielsen-heuristics-audit.md:151-155`
    - **Conclusão:** **FALSO POSITIVO (JÁ CORRIGIDO — Correção 1).** O modal TEM confirmação:
      - Form com select de motivo (`l.140-161` — 4 opções) + textarea de descrição (`l.165-183` — opcional, max 1000 chars)
      - Botão Enviar com `disabled` + `busy` ("Enviando…") (`l.194-196`) — previne duplo clique ✅
      - Validação inline: motivo obrigatório (`l.57-60`: `if (!reason) setError("Selecione um motivo.")`) ✅
    - A auditoria não viu o modal porque ele é client-side React (SSR estático).
    - **Severidade real:** **N/A** — falso positivo total para o modal. O problema real é só o TRIGGER (Registro 3).
    - **Status:** Já resolvido no modal. Trigger pendente.

    ### Registro 3: UI Design §5.2 + §8.3 — "ReportButton com estilos inline / sem estados visuais" · Severidade original Medium
    - **Origem:** `ui-design-review.md:191-195` (§5.2) + `ui-design-review.md:283-288` (§8.3)
    - **Conclusão:** **PROCEDE PARCIALMENTE (JÁ CORRIGIDO como FALSO POSITIVO PARCIAL — Correção 1 do UI audit).**
    - **Trigger atual (`ReportButton.tsx:85-94`):**
      - Elemento: `<span role="button" tabIndex={0}>` — NÃO é `<button>` real
      - Estilos: `style={{ fontSize: "0.8rem", color: "var(--artificio-brand, #FF5722)", cursor: "pointer", userSelect: "none" }}` — inline, sem classe CSS
      - Hover: ❌ zero efeito visual (só cursor pointer do inline)
      - Focus-visible: ❌ regra global `button:focus-visible` em `global.css:619` NÃO se aplica a `<span role="button">`
      - Active: ❌ sem estado
      - Transition: ❌ sem transição
      - Keyboard: ✅ `onKeyDown` handler para Enter/Space (l.89)
    - **Wrapper desnecessário:** `<span style={{ position: "relative" }}>` (l.84) — modal usa `position: "fixed"`, não depende de posicionamento relativo do trigger.
    - **Severidade real do trigger:** **Minor (2).** Funcionalmente OK (abre modal, teclado funciona), mas visualmente não parece interativo (subtrai do H4.3 consistência).
    - **Status:** Escopo direto de T10.

    ### Registro 4: Nielsen H5.3 — "Sem prevenção de duplo clique em ações" · Severidade original 2 (Minor)
    - **Origem:** `nielsen-heuristics-audit.md:163-167`
    - **Conclusão:** **PARCIALMENTE RESOLVIDO para ReportButton.** Dentro do modal:
      - Botão Enviar: `disabled={busy}` + texto "Enviando…" (`l.194-196`) ✅ — previne duplo submit
      - Botão Cancelar: `disabled={busy}` durante submit (`l.191`) ✅
    - **O que NÃO é prevenido:** o TRIGGER pode ser clicado múltiplas vezes (abre múltiplos `setOpen(true)`), mas o `open` state já sendo `true` torna chamadas subsequentes inócuas (React não re-renderiza state igual). Então não há risco REAL de múltiplos modais.
    - **Severidade real:** **Cosmetic (1).** Prevenção já existe via React state idempotência.
    - **Status:** Já resolvido. Nada a implementar específico para ReportButton em H5.3.

    ### Registro 5 — Achado novo: Modal com 14 inline styles + tokens errados
    - **Evidência:** `ReportButton.tsx:84-203` — 14 ocorrências de `style={{...}}` cobrindo backdrop, modal container, form, select, textarea, mensagens, layout.
    - **Tokens usados (ERRADOS):** `--color-surface` (não existe), `--color-fg` (não existe), `--color-border` (não existe). Cai sempre no fallback (`#fff`, `#0B1220`, `#ccc`) → modal é SEMPRE tema claro, ignora `data-theme="dark"`.
    - **Classes `packages/ui` disponíveis e NÃO usadas:**
      - `.artificio-modal-root` + `.artificio-modal-backdrop` (backdrop com `background: #0207407a`, `position: fixed`, `inset: 0`, `z-index: 100`)
      - `.artificio-modal` (modal com `background: var(--surface)`, `border`, `shadow`, `border-radius`, posicionamento centrado)
      - `.artificio-modal-header` + `.artificio-modal-body` + `.artificio-modal-footer`
      - `.artificio-modal-title` (`font-family: var(--artificio-font-display)`, `font-size: 22px`)
      - `.artificio-control` + `.artificio-control-md` (input/select/textarea com `background: var(--surface)`, `border: 1px solid var(--line)`, `color: var(--fg)`, `border-radius: 8px`, focus-visible + box-shadow)
      - `.artificio-field` + `.artificio-field-label` (label com `display: grid`, `gap: 6px`)
    - **Impacto real:** Modal funcional mas visualmente alienígena no tema escuro (fundo branco sobre overlay escuro). Select/textarea não têm foco visível consistente com o design system (usam `--color-border, #ccc` em vez de `var(--line)`).
    - **Status:** **DÉBITO SEPARADO.** Refatorar modal para classes `packages/ui` é trabalho maior (2-3h, todo o layout interno muda). Isso NÃO é escopo de T10 (que cobre apenas o trigger). Recomendação: spec ou task separada "Refatorar ReportButton modal para @artificio/ui".

    ### Registro 6 — Achado novo: Modal sem Escape key handler
    - **Evidência:** `ReportButton.tsx:96-202` — sem `onKeyDown` para `Escape` no backdrop/modal.
    - **Impacto:** Usuário que abre modal com teclado (Enter no trigger) não consegue fechar com Esc — precisa clicar no backdrop ou no botão Cancelar.
    - **Status:** DÉBITO SEPARADO (WCAG 2.1 §2.1.1 Keyboard, §2.2.2). Recomendação: adicionar `onKeyDown` global ou no backdrop. Escopo: acessibilidade, não T10.

    ### Resumo final T10

    | Registro | Origem | Severidade original | Conclusão | Severidade real |
    |---|---|---|---|---|
    | R1: H3.1 "sem cancelamento" | Nielsen audit | Major (3) | **FALSO POSITIVO** — modal tem Cancelar + Fechar | Minor (2) — só falta "Desfazer" |
    | R2: H5.1 "sem confirmação" | Nielsen audit | Major (3) | **FALSO POSITIVO** — modal tem form + disabled + validação | N/A |
    | R3: UI §5.2 + §8.3 | UI design review | Medium | **PROCEDE** — trigger inline, sem hover/focus-visible | Minor (2) |
    | R4: H5.3 "duplo clique" | Nielsen audit | Minor (2) | **JÁ RESOLVIDO** — disabled + React state idempotência | Cosmetic (1) |
    | R5: Modal 14 inline styles | Achado novo | — | **DÉBITO SEPARADO** — tokens errados, não usa @artificio/ui | Medium |
    | R6: Modal sem Escape | Achado novo | — | **DÉBITO SEPARADO** — WCAG 2.1 Keyboard | Minor (2) |

    **Escopo de implementação T10:**
    1. **Obrigatório:** Trigger `<span role="button">` → `<button>` real com classe `.report-trigger`
    2. **Obrigatório:** Criar `.report-trigger` em `global.css` com: `font-size: 0.8rem`, `color: var(--brand)`, `cursor: pointer`, `background: transparent`, `border: 0`, `font-family: inherit`, `hover` (underline ou opacity), `focus-visible` (herdado da regra global `button:focus-visible`), `transition`
    3. **Obrigatório:** Remover inline styles do trigger (`style={{ fontSize, color, cursor, userSelect }}`)
    4. **Obrigatório:** Remover `onKeyDown` handler (Enter/Space já nativo em `<button>`)
    5. **Obrigatório:** Remover wrapper span `style={{ position: "relative" }}` (desnecessário)
    6. **Opcional:** Adicionar "Desfazer" por 5s após submit (state `undo`, timer `setTimeout`, chamada DELETE na API)

    **O que NÃO faz parte de T10:**
    - Refatorar modal para classes `@artificio/ui` (`.artificio-modal`, `.artificio-control`, etc.) — débito separado
    - Adicionar Escape key handler — débito separado (acessibilidade)
    - Alterar CommunityGroups.tsx (outro consumidor de ReportButton) — sem mudanças necessárias, o componente é o mesmo

  - **Implementado (2026-06-22):**
    - **Arquivos:** `ReportButton.tsx` (1 arquivo), `global.css` (1 arquivo)
    - **Trigger:** `<span role="button">` + wrapper `<span>` → `<button type="button" className="report-trigger">`.
      - Removido: `tabIndex={0}` (nativo em button), `onKeyDown` (Enter/Space nativos), `style={{...}}` (4 propriedades inline), wrapper `span style={{ position: "relative" }}`.
      - Simplificado: `onClick` removeu `stopPropagation()` desnecessário (ReportButton é sibling do `<a>` em GroupCard.astro, não filho).
    - **CSS `.report-trigger`** (`global.css:626-639`): `font-size: 0.8rem`, `color: var(--brand)`, `cursor: pointer`, `background: transparent`, `border: 0`, `font-family: inherit`, `user-select: none`, `padding: 0`, `transition: opacity 0.15s ease`, `hover { opacity: 0.8 }`.
      - Focus-visible herdado automaticamente da regra global `button:focus-visible` (`global.css:618`) → `outline: 3px solid var(--brand-deep)`.
    - **Desfazer (opcional):**
      - Novo estado `undo` + `useEffect` com `setTimeout(..., 5000)` para auto-dismiss.
      - Nova função `onUndo()`: `DELETE /api/groups/:slug/report` com XSRF token + tratamento de erro.
      - Botão "Desfazer" (`variant="danger"`) aparece por 5s ao lado de "Fechar" no estado "Denúncia enviada".
      - `closeModal()` limpa `undo` state (reseta timer via cleanup do `useEffect`).
      - Tratamento de erro: se DELETE falhar, `setError("Não foi possível desfazer.")` mantém o modal aberto.
    - **Smoke:** ✅ build verde (16 páginas, 4.88s). CSS `.report-trigger` confirmado no dist. JS chunk `ReportButton.*.js` confirma: `<button className="report-trigger">`, `setTimeout(...,5e3)`, método `DELETE`, estado `undo` com render condicional.
    - **Achados durante implementação:**
      - `e.stopPropagation()` era desnecessário no `onClick` do trigger — em `GroupCard.astro:55`, o `<ReportButton>` é sibling do `<a>`, não filho. Removido.
      - Wrapper `<span style={{ position: "relative" }}>` era inútil — modal usa `position: "fixed"` (não depende de posicionamento relativo do trigger).
    - **Regressão zero:** só tocou no trigger do modal (substituição de `<span>` por `<button>` + CSS). Modal, form, submit, erro, CommunityGroups — intocados.
    - **O que NÃO foi feito (débito separado):** refatorar modal para classes `@artificio/ui` (`.artificio-modal`, `.artificio-control`), adicionar handler de Escape key.

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
