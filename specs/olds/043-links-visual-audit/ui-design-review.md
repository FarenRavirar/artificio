# UI Design Review Report — Links (Artifício RPG)

**Interface:** links.artificiorpg.com
**Date:** 2026-06-21
**Pages Reviewed:** Home (`/`), Busca (`/busca/`), Admin (`/admin/`), Detalhe Grupo (`/grupo/[slug]/`)
**Stack:** Astro 6 SSG + React 19 islands + Tailwind + CSS custom (624 linhas)

---

## Executive Summary

### Visual Design Score: 64/100 (C — Acceptable)

| Dimension | Score | Status |
|-----------|-------|--------|
| Visual Hierarchy | 7/10 | ✅ |
| Typography | 5/10 | ⚠️ |
| Color Palette | 8/10 | ✅ |
| Spacing & White Space | 7/10 | ✅ |
| Visual Consistency | 5/10 | ⚠️ |
| Imagery & Graphics | 6/10 | ⚠️ |
| Layout & Grid | 8/10 | ✅ |
| Component Design | 6/10 | ⚠️ |
| Branding & Personality | 7/10 | ✅ |
| Modern Standards | 7/10 | ✅ |

### Top 3 Strengths
1. **Tokens de marca bem definidos e dark/light funcionais** — paleta coesa, variáveis CSS bem estruturadas, tema cross-app consistente
2. **Layout sidebar+content eficaz** — sticky sidebar com scroll independente, navegação hierárquica com `<details>`, boa distribuição de espaço
3. **Gate adulto (+18) bem implementado** — blur progressivo, opt-in explícito com localStorage, estado civilizado em ambos os temas

### Top 3 Issues
1. **Página /busca quebra o shell** — sem header, sem sidebar, cores hardcoded (Tailwind arbitrário em vez de tokens CSS), não respeita tema dark/light
2. **Oswald sem @font-face** — fonte usada em headings de detalhe de grupo mas não declarada; fallback para Arial Narrow pode quebrar o visual
3. **Inconsistência de estilos inline vs. classes** — ReportButton usa `style=` inline (`font-size:0.8rem;color:var(...);cursor:pointer`) em vez de classe CSS; perde hover, focus-visible e consistência com design system

---

## Detailed Analysis

### 1. Visual Hierarchy ⭐⭐⭐⭐⭐⭐⭐⚪⚪⚪ (7/10)

#### Strengths
- ✅ Sidebar à esquerda (280px) claramente separada do conteúdo principal — função distinta: navegação vs. consumo
- ✅ Títulos de seção (`.section-title`) com peso 800 e margem superior generosa (2.5rem) criam hierarquia clara
- ✅ Cards com borda sutil e hover com brand — CTA implícito bem sinalizado
- ✅ Lead paragraph com `color: var(--muted)` e `max-width: 60ch` — desconforto controlado
- ✅ Regras com fundo distinto (`.regras-intro` com borda esquerda brand) — quebra de fluxo eficaz

#### Issues

**Issue 1.1: Sidebar compete visualmente com conteúdo em mobile**
- **Severity:** Medium
- **Location:** Mobile (<760px)
- **Problem:** Sidebar vira bloco estático no topo (`.sidebar { position: static }`), ocupando espaço vertical precioso antes do conteúdo
- **Recommendation:** Colapsar sidebar em drawer/hamburger no mobile, liberando a tela para o conteúdo. Manter só título + botão toggle visível.
- **Effort:** Medium (2-3h)

**Issue 1.2: Sem hierarquia visual entre regras**
- **Severity:** Low
- **Location:** Seção "Regras dos grupos"
- **Problem:** Todas as regras têm o mesmo peso visual (cards idênticos com `h3` do mesmo tamanho); regras críticas (proibido) não se destacam
- **Recommendation:** Adicionar ícone ou cor de destaque para a regra de proibições (ex.: borda esquerda vermelha sutil)
- **Effort:** Low (30min)

#### Recommendations Summary
1. Criar drawer mobile para sidebar (economiza ~300px de scroll vertical)
2. Destacar regra de proibições com tratamento visual distinto

---

### 2. Typography ⭐⭐⭐⭐⭐⚪⚪⚪⚪⚪ (5/10)

#### Strengths
- ✅ Inter como fonte principal — limpa, moderna, boa legibilidade
- ✅ Stack de fallback robusto: `Inter, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`
- ✅ Tamanhos responsivos com `clamp()` (`.page-title: clamp(1.6rem, 3vw, 2.2rem)`)
- ✅ Sidebar nav com uppercase + letter-spacing controlado (`0.06em`) — distinção funcional sem gritar

#### Issues

**Issue 2.1: Oswald sem @font-face / carregamento**
- **Severity:** High
- **Location:** `.group-head h1`, `.admin h1` — `font-family: Oswald, "Arial Narrow", system-ui, sans-serif`
- **Problem:** Fonte não declarada em `@font-face` nem linkada via Google Fonts/CDN. Só renderiza se o usuário tiver Oswald instalada localmente (raro em Windows/Linux). Fallback Arial Narrow não tem o mesmo caráter condensed
- **Impact:** Headings de páginas de grupo e admin renderizam com fonte diferente do design intencionado para 99% dos usuários
- **Recommendation:** Ou adicionar `@font-face` com woff2 local em `/public/fonts/`, ou link Google Fonts com `preconnect` no `<head>`, ou substituir por uma fonte do sistema (`system-ui` condensed) e remover Oswald
- **Effort:** Low (1h — adicionar woff2 + @font-face)

**Issue 2.2: Sidebar nav com fonte muito pequena (0.8rem = ~12.8px)**
- **Severity:** Medium
- **Location:** `.nav-group > summary`, `.nav-solo`
- **Current:** `font-size: 0.8rem` (≈12.8px) com `text-transform: uppercase`
- **Problem:** Texto pequeno + uppercase compromete legibilidade, especialmente para usuários com dificuldade visual. WCAG recomenda mínimo 14px para body
- **Recommendation:** Subir para `0.85rem` (≈13.6px) e remover uppercase dos itens de submenu (`.nav-sub a`)
- **Effort:** Low (15min CSS)

**Issue 2.3: Line-height inconsistente**
- **Severity:** Low
- **Location:** Múltiplos locais
- **Current:** `.card .desc { line-height: 1.35 }`, `.regra li { line-height: 1.45 }`, `.regras-intro { line-height: 1.5 }`, `.group-desc { line-height: 1.6 }`
- **Problem:** Variação entre 1.35 e 1.6 sem sistema aparente. Cards têm line-height muito apertado (1.35) para texto descritivo
- **Recommendation:** Padronizar: body text → 1.5, compacto (cards/chips) → 1.4
- **Effort:** Low (1h — ajuste em 4-5 seletores)

#### Recommendations Summary
1. **Urgente:** Resolver Oswald — ou carregar fonte ou substituir
2. Subir tamanho de fonte da sidebar para 0.85rem mínimo
3. Padronizar line-height (1.5 body, 1.4 compacto)

---

### 3. Color Palette ⭐⭐⭐⭐⭐⭐⭐⭐⚪⚪ (8/10)

#### Strengths
- ✅ Tokens CSS bem definidos com 12 variáveis cobrindo brand, page, surface (3 níveis), text (3 níveis), border (2 níveis)
- ✅ Tema dark/light com toggle funcional via `data-theme` + cookie + localStorage — implementação cross-app consistente
- ✅ Brand orange (#FF5722) com shade deep (#E64A19) — hover states cobertos
- ✅ Contraste adequado: `--text` (#0B1220) sobre `--page` (#F4F6FB) no light; `--text` (#EEF1F8) sobre `--page` (#0F1830) no dark
- ✅ Chip adulto com tratamento de cor específico por tema (danger 700 no light, tom claro no dark)

#### Issues

**Issue 3.1: /busca usa cores hardcoded fora do token system**
- **Severity:** High
- **Location:** `/busca/` page — `class="text-white"`, `bg-[#0F1A2E]`, `text-white/50`, `text-white/40`
- **Problem:** Cores Tailwind arbitrárias ignoram completamente o sistema de tokens. Fundo `#0F1A2E` é próximo mas não idêntico ao `--page` dark (#0F1830). Texto `white` não tem equivalente no token system. A página não responde a troca de tema.
- **Impact:** Quebra visual cross-theme; página fica quebrada no tema light (fundo escuro com texto claro fixo)
- **Recommendation:** Usar tokens CSS: `bg-[var(--page)]`, `text-[var(--text)]`, `text-[var(--muted)]` em vez de classes Tailwind arbitrárias
- **Effort:** Medium (2h — refatorar `LinksSearch.tsx` + layout da página)

**Issue 3.2: `--border` com opacidade rgba gera overlap visual**
- **Severity:** Low
- **Location:** Bordas em cards, sidebar, footer
- **Current:** `--border: rgba(2, 7, 64, 0.12)` — muito sutil no light
- **Problem:** Em telas com baixo contraste/brilho, bordas podem desaparecer, fazendo cards perderem definição
- **Recommendation:** Subir opacidade para 0.15 no light e 0.15 no dark
- **Effort:** Trivial (mudar 1 valor)

#### Recommendations Summary
1. **Urgente:** Refatorar /busca para usar tokens CSS em vez de Tailwind arbitrário
2. Aumentar sutilmente opacidade de `--border` no light

---

### 4. Spacing & White Space ⭐⭐⭐⭐⭐⭐⭐⚪⚪⚪ (7/10)

#### Strengths
- ✅ Grid de cards com `gap: 0.9rem` — consistente
- ✅ Sidebar com padding adequado (`1.5rem 1rem`)
- ✅ Área de conteúdo com padding responsivo: `clamp(1rem, 4vw, 3rem)`
- ✅ Margem generosa entre seções (`.section-title { margin: 2.5rem 0 0.25rem }`)

#### Issues

**Issue 4.1: Cards de regra com padding interno muito pequeno**
- **Severity:** Low
- **Location:** `.regra li { padding: 0.6rem 0.8rem }`
- **Problem:** Texto de regras mais longas (ex.: divulgação) fica apertado com padding horizontal de apenas 0.8rem
- **Recommendation:** Subir para `0.75rem 1rem` para itens com texto multilinha
- **Effort:** Trivial

**Issue 4.2: Gap entre breadcrumb e título no detalhe de grupo quase nulo**
- **Severity:** Low
- **Location:** `.group-page` — breadcrumb `margin-bottom: 1.5rem` mas o `h1` dentro de `.group-head` não tem margem superior própria
- **Problem:** Visualmente, breadcrumb e título de grupo ficam muito próximos quando não há logo
- **Recommendation:** Garantir margem mínima entre breadcrumb e grupo-head independente da presença de logo
- **Effort:** Trivial

---

### 5. Visual Consistency ⭐⭐⭐⭐⭐⚪⚪⚪⚪⚪ (5/10)

#### Strengths
- ✅ Card pattern repetido consistentemente em todas as seções
- ✅ Chips de categoria seguem sempre o mesmo estilo
- ✅ Blocos de regra têm estrutura idêntica (intro + ul > li)
- ✅ Header cross-app consistente via `@artificio/ui` (spec 041)

#### Issues

**Issue 5.1: /busca rompe com o shell completamente**
- **Severity:** Critical
- **Location:** `/busca/` page
- **Problem:** A página de busca não tem header (LinksHeader), sidebar, nem footer. É uma página standalone com `class="max-w-4xl mx-auto px-4 py-8"` e cores hardcoded. O usuário perde contexto de navegação e a experiência cross-page é quebrada.
- **Impact:** Usuário não consegue navegar para outros apps ou voltar à home sem usar o back do browser. Experiência "silo" que contradiz o modelo hub do Artifício.
- **Recommendation:** Envolver busca no mesmo shell (`.shell` com sidebar + conteúdo, LinksHeader no topo)
- **Effort:** Medium (3-4h — refatorar layout da página Astro)

**Issue 5.2: ReportButton com estilos inline**
- **Severity:** Medium
- **Location:** `ReportButton.tsx` — `<span style="font-size:0.8rem;color:var(--artificio-brand, #FF5722);cursor:pointer;user-select:none">`
- **Problem:** Estilos inline em vez de classes CSS. Perde hover state, focus-visible (acessibilidade), transições, e consistência com design system
- **Recommendation:** Criar classe `.report-trigger` em `global.css` e aplicar via className
- **Effort:** Low (30min)

**Issue 5.3: "Carregando" no header usa HTML plain sem estilo de carregamento**
- **Severity:** Low
- **Location:** `<span class="artificio-session-muted">Carregando</span>` no header
- **Problem:** Estado "Carregando" antes da hidratação React do SSO é texto estático sem skeleton/spinner. Após hidratação some. Pode causar flash.
- **Recommendation:** Adicionar CSS de shimmer/skeleton ao estado de loading da sessão
- **Effort:** Low (30min CSS)

---

### 6. Imagery & Graphics ⭐⭐⭐⭐⭐⭐⚪⚪⚪⚪ (6/10)

#### Strengths
- ✅ Logos de grupos com `object-fit: cover`, dimensões explícitas (52x52, 104x104), `loading="lazy"` — boa performance
- ✅ Imagens via Cloudinary com CDN — entrega rápida
- ✅ Ícones SVG inline no header (search, changelog, theme) — consistentes, stroke-based
- ✅ Placeholder SVG para grupos sem logo

#### Issues

**Issue 6.1: Ícone de menu mobile é emoji (☰)**
- **Severity:** Medium
- **Location:** `.artificio-menu-toggle` no header
- **Current:** Texto "☰" como ícone de menu hamburger
- **Problem:** Renderização do ☰ varia por sistema operacional e fonte. Pode aparecer como caractere estranho, box vazio, ou com estilo inconsistente com os ícones SVG ao redor
- **Recommendation:** Substituir por SVG inline de 3 barras, igual aos outros ícones do header
- **Effort:** Low (15min)

**Issue 6.2: Logo do Artifício no header é base64 inline enorme**
- **Severity:** Low
- **Location:** Header — `<img src="data:image/png;base64,iVBOR...">` com ~4KB de base64
- **Problem:** Base64 inline bloqueia o parsing do HTML e não pode ser cacheado. Em cada página, os mesmos ~4KB são baixados novamente
- **Recommendation:** Mover para asset estático (`/logo.png`) ou importar no bundle para hash + cache
- **Effort:** Medium (1-2h — requer coordenação com `@artificio/ui`)

**Issue 6.3: Emojis nos títulos de regras**
- **Severity:** Low
- **Location:** Títulos de regras: 🚫📢🧾🎭🤝📣🎲
- **Problem:** Renderização de emoji varia radicalmente entre Windows (Segoe UI Emoji), macOS (Apple Color Emoji), Android e Linux. Estilo inconsistente quebra o visual sóbrio
- **Recommendation:** Substituir por ícones SVG inline consistentes com o design system
- **Effort:** Medium (1h — criar/importar 7 SVGs)

---

### 7. Layout & Grid ⭐⭐⭐⭐⭐⭐⭐⭐⚪⚪ (8/10)

#### Strengths
- ✅ Grid sidebar+content com `grid-template-columns: 280px minmax(0, 1fr)` — racional, previsível
- ✅ Cards em `repeat(auto-fill, minmax(260px, 1fr))` — responsivo sem media queries
- ✅ Sidebar sticky com `height: 100vh; overflow-y: auto` — navegação sempre acessível
- ✅ Conteúdo principal com `max-width: 880px` — linha de leitura controlada

#### Issues

**Issue 7.1: Sidebar sempre visível rouba 280px em telas pequenas (760-1024px)**
- **Severity:** Medium
- **Location:** Breakpoint 760px
- **Problem:** Entre 760px e ~1024px, sidebar ocupa 280px fixos, deixando apenas ~480px para conteúdo em tablet. Só colapsa abaixo de 760px
- **Recommendation:** Breakpoint intermediário: abaixo de 900px, sidebar vira top bar ou drawer. Ou reduzir largura para 220px em <1024px.
- **Effort:** Low (1h — media query adicional)

---

### 8. Component Design ⭐⭐⭐⭐⭐⭐⚪⚪⚪⚪ (6/10)

#### Strengths
- ✅ Cards com hover state sutil (`border-color: brand + translateY(-2px)`) — feedback claro
- ✅ Chips com estado ativo (`chip-active`) e hover distinto — boa affordance
- ✅ CTA "Entrar no grupo" com brand color, bold, border-radius consistente
- ✅ Partner CTA com borda dashed para diferenciar de cards normais

#### Issues

**Issue 8.1: Cards de regra sem hover state**
- **Severity:** Low
- **Location:** `.regra li`
- **Problem:** Itens de regra são estáticos, sem hover. Não é grave (são informativos), mas inconsistente com o resto da interface onde quase tudo tem hover
- **Recommendation:** Adicionar leve shift de background no hover (`background: var(--surface-soft)`)
- **Effort:** Trivial

**Issue 8.2: Form inputs sem tratamento de estados**
- **Severity:** Medium
- **Location:** AdminPanel (React), SuggestForm (React), LinksSearch
- **Problem:** Input de busca em `/busca` tem foco customizado (`focus:border-[#FF5722]`) mas sem validação visual de erro, disabled, ou loading. Inputs do admin são renderizados pelo React (não visíveis no SSR)
- **Recommendation:** Criar classes CSS reutilizáveis para estados de input (`.input`, `.input-error`, `.input-disabled`) em `global.css`
- **Effort:** Medium (2h — afeta AdminPanel + SuggestForm + LinksSearch)

**Issue 8.3: Botão "Reportar" sem estados visuais**
- **Severity:** Medium
- **Location:** `ReportButton.tsx` — `<span role="button" tabindex="0">`
- **Problem:** Botão de reportar não tem hover, active, focus-visible nem cursor pointer (só inline). Invisível como elemento interativo
- **Recommendation:** Converter para `<button>` real ou aplicar classes CSS com todos os estados
- **Effort:** Low (30min)

---

### 9. Branding & Personality ⭐⭐⭐⭐⭐⭐⭐⚪⚪⚪ (7/10)

#### Strengths
- ✅ Brand orange (#FF5722) aplicado consistentemente: CTAs, links, hover, foco
- ✅ Tom de voz adequado a RPG brasileiro: informal mas não infantil ("bora jogar", "expurgado como um goblin inconveniente")
- ✅ Hub cross-app com navegação consistente entre módulos
- ✅ Crédito claro: "Um presente da Artifício RPG — hub de projetos de RPG em português. Gratuito, sem anúncios, sem coleta desnecessária."

#### Issues

**Issue 9.1: Sidebar parece genérica (falta identidade visual do Artifício)**
- **Severity:** Low
- **Location:** Sidebar
- **Problem:** Sidebar usa apenas texto uppercase + muted colors. Nenhum elemento visual da marca (logo, ícone, cor brand) no topo ou na sidebar
- **Recommendation:** Adicionar logo small ou brand dot no topo da sidebar
- **Effort:** Low (30min)

---

### 10. Modern Design Standards ⭐⭐⭐⭐⭐⭐⭐⚪⚪⚪ (7/10)

#### Strengths
- ✅ `scroll-behavior: smooth` — suave em âncoras
- ✅ `color-scheme` implícito via `data-theme` — boa integração com browser
- ✅ Transições sutis em hover (0.15s ease) — moderno sem exagero
- ✅ `focus-visible` implementado com outline brand — atende WCAG 2.4.7
- ✅ CSS custom properties em vez de pré-processador — nativo, performático

#### Issues

**Issue 10.1: Sem animação de transição de tema**
- **Severity:** Low
- **Location:** Global — troca light/dark
- **Problem:** Toggle de tema é instantâneo, sem transição. Pode causar flash visual
- **Recommendation:** Adicionar `transition: background-color 0.2s ease, color 0.2s ease` em `html` ou `body` para troca suave
- **Effort:** Trivial (1 linha CSS)

---

## Component Audit

### Navigation (Header — `@artificio/ui`)
- Status: ✅ Good
- Brand logo com link para portal
- Nav list cross-app com `aria-current="page"` no módulo ativo
- Session area: search, changelog, theme toggle, user status
- Menu toggle para mobile (☰ emoji — ver Issue 6.1)

### Sidebar
- Status: ✅ Good
- Navegação hierárquica com `<details>` — excelente progressive enhancement
- Projetos cross-linkados
- Uppercase + muted para itens de nav — funcional mas um pouco pequeno (Issue 2.2)

### Cards (GroupCard.astro)
- Status: ✅ Good
- Layout consistente: logo + body (name, chips, desc)
- Hover com brand border + translateY — polido
- ReportButton acoplado com `client:visible` — lazy loading correto

### Buttons
- CTA "Entrar no grupo": ✅ Good — brand bg, white text, bold, border-radius 8px, hover deep brand
- Reportar: ❌ Problematic — inline styles, sem estados, `<span role="button">` em vez de `<button>`
- Adult gate CTA: ✅ Good — brand bg, padding adequado, hover deep
- Changelog/Search/Theme header: ✅ Good — ações ícone com aria-label

### Forms
- LinksSearch input: ⚠️ Needs improvement — cores hardcoded, sem estados de erro
- SuggestForm: ⚠️ React-only (não visível no SSR) — sem análise completa
- AdminPanel forms: ⚠️ React-only — sem análise completa

### Loading States
- CommunityGroups: ✅ Mostra "Carregando grupos da comunidade…" com spinner via `artificio-state`
- SuggestForm: ✅ Mostra "Verificando sua sessão…" com spinner
- Auth header: ❌ "Carregando" texto estático sem spinner

---

## Design System Assessment

**Overall Score: 5/10 (Some system, gaps)**

### What Exists
- ✅ 12 variáveis CSS de cor (brand, page, surface×3, text×3, border×2)
- ✅ Tema dark/light via `data-theme`
- ✅ Sistema de fontes (Inter + stack)
- ✅ Padrões de card, chip, CTA definidos
- ✅ Grid system (sidebar+content, auto-fill cards)
- ✅ Focus-visible global
- ✅ Adult content gate reutilizável

### What's Missing
- ❌ Tipografia sistemática (escala de tipos documentada)
- ❌ Espaçamento padronizado (escala 4px/8px)
- ❌ Estados de formulário (input error, disabled, success)
- ❌ Skeleton/loading states padronizados
- ❌ Tratamento de empty states
- ❌ Estilos de componente transversais (`.btn`, `.btn-primary`, `.btn-ghost`)

---

## Prioritized Recommendations

### Phase 1: Critical Fixes (2-3h, High ROI)

1. **Refatorar /busca para usar tokens CSS + shell consistente** — Impact: Critical (Issue 5.1, 3.1)
2. **Resolver Oswald (carregar fonte ou substituir)** — Impact: High (Issue 2.1)
3. **Converter ReportButton de inline styles para classes CSS** — Impact: Medium (Issue 5.2, 8.3)
4. **Substituir ☰ por SVG no menu toggle** — Impact: Medium (Issue 6.1)

### Phase 2: Polish (4-6h)

5. **Padronizar line-height (1.5 body / 1.4 compacto)** — Impact: Low-Medium (Issue 2.3)
6. **Subir tamanho de fonte da sidebar para 0.85rem** — Impact: Low (Issue 2.2)
7. **Adicionar shimmer ao "Carregando" do header** — Impact: Low (Issue 5.3)
8. **Substituir emojis por SVGs nos títulos de regras** — Impact: Low (Issue 6.3)
9. **Adicionar transição de tema** — Impact: Low (Issue 10.1)

### Phase 3: Enhancement (8-12h)

10. **Criar drawer mobile para sidebar** — Impact: Medium (Issue 1.1)
11. **Breakpoint intermediário para sidebar (900px)** — Impact: Medium (Issue 7.1)
12. **Sistema de classes para estados de formulário** — Impact: Medium (Issue 8.2)
13. **Mover logo base64 para asset cacheável** — Impact: Low (Issue 6.2) — requer coordenação com `@artificio/ui`

---

**Methodology:** Expert visual design review baseada em análise de CSS fonte (624 linhas) + HTML renderizado de 3 páginas em produção. Sem acesso a renderização React client-side completa (AdminPanel, SuggestForm, LinksSearch interativo).

---

## Correções pós-investigação de código (2026-06-22)

**Correção 1 — ReportButton (Issue 5.2, 8.3): FALSO POSITIVO PARCIAL.** O relatório descreveu "ReportButton sem estados visuais" e "sem confirmação". Investigação do código fonte (`ReportButton.tsx:96-202`) mostra que o componente TEM modal completo com form (motivo + descrição), botões Cancelar/Enviar com `disabled`+spinner, tratamento de erro (429, 400, rede) e estado "Denúncia enviada" com botão Fechar. O que REALMENTE falta: trigger `<span role="button">` em vez de `<button>`, estilos inline em vez de classes CSS, sem hover/focus-visible no trigger. Severidade real do trigger = Minor (era Medium no relatório original).

**Correção 2 — LinksSearch estados de erro (Issue 8.2): FALSO POSITIVO PARCIAL.** `LinksSearch.tsx:73-78` implementa estados loading/error/empty/results com mensagens. O componente tem cobertura de estados — o que falta é apenas usar tokens CSS em vez de cores hardcoded.

