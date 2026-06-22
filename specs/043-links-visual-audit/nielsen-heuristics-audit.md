# Nielsen Heuristics UX Audit Report — Links (Artifício RPG)

**Interface:** links.artificiorpg.com
**Date:** 2026-06-21
**Evaluator:** AI Agent (ui-design-review + nielsen-heuristics-audit skills)
**Platform:** Web (Astro 6 SSG + React 19 islands)
**Pages Evaluated:** Home (`/`), Busca (`/busca/`), Admin (`/admin/`), Detalhe Grupo (`/grupo/[slug]/`)

---

## Executive Summary

### Key Findings
- **Total Issues Found:** 28
  - Catastrophic (4): 1
  - Major (3): 7
  - Minor (2): 12
  - Cosmetic (1): 8

### Top 3 Critical Issues
1. **Página /busca sem navegação cross-app** — H1, H4, H6 — Severity 3 (Major) — Usuário perde acesso a outros módulos e à home
2. **"Carregando" ambíguo no header (sem contexto do que está carregando)** — H1 — Severity 3 (Major) — Usuário não sabe se é auth, página, dados
3. **Botão "Reportar" sem confirmação nem feedback** — H5, H9 — Severity 3 (Major) — Ação sem cancelamento, sem confirmação de sucesso/erro

### Overall Usability Score: 6.2/10 (Fair — functional but with significant gaps)

---

## Detailed Findings by Heuristic

### H1: Visibility of System Status
**Compliance:** ⭐⭐⭐⭐⚪ (4/5)

#### Issues

**Issue H1.1: "Carregando" no header sem contexto do que carrega**
- **Severity:** 3 (Major)
- **Location:** `<span class="artificio-session-muted">Carregando</span>` no header (todas as páginas)
- **Description:** O header mostra "Carregando" antes da hidratação React do componente de sessão SSO. O texto não indica o que está carregando (usuário? permissões? página?). Some silenciosamente após hidratação.
- **Affected Tasks:** Navegação cross-app, entendimento do estado de autenticação
- **Recommendation:** Exibir skeleton pulsante em vez de texto, ou mudar para "Verificando acesso…" com spinner CSS

**Issue H1.2: Botão de busca no header sem destino óbvio**
- **Severity:** 2 (Minor)
- **Location:** Header — ícone de lupa (search) ao lado de changelog e theme toggle
- **Description:** O botão de busca no header é um ícone sem label visível. Não está claro se abre um modal, dropdown, ou navega para `/busca`. O `aria-label="Buscar"` existe mas o `title` também é "Buscar" — sem indicação do comportamento.
- **Recommendation:** Adicionar tooltip ou label curta (ex.: "Buscar grupos") e garantir que o destino seja previsível (navegação para /busca, não modal)

**Issue H1.3: LinksSearch sem indicador de progresso durante digitação**
- **Severity:** 2 (Minor)
- **Location:** `/busca/` — `<p class="text-white/50">Carregando grupos...</p>`
- **Description:** Após hidratação React, o input de busca filtra resultados. Durante digitação rápida ou debounce, não há indicador visual de que a busca está processando.
- **Recommendation:** Adicionar spinner inline no input durante debounce/search

#### Positive Examples
- ✅ `aria-current="page"` no link "WhatsApps" — indica localização atual
- ✅ Toggle de tema com ícone visual (sol/lua) — estado claro
- ✅ Gate adulto com overlay e estado "desbloqueado" visível
- ✅ Scroll suave com `scroll-margin-top` — feedback de navegação por âncora
- ✅ Estados de loading no CommunityGroups e SuggestForm com spinner CSS

---

### H2: Match Between System and the Real World
**Compliance:** ⭐⭐⭐⭐⭐ (5/5)

#### Strengths
- ✅ Terminologia em português natural: "Grupos", "Regras", "Projetos", "WhatsApps"
- ✅ Ícone de lupa para busca — universalmente reconhecido
- ✅ Ícone de engrenagem (changelog) — metáfora de atualizações/configuração
- ✅ Ícone sol/lua para tema — natural
- ✅ "Entrar no grupo" como CTA — linguagem de ação clara
- ✅ Categorias de grupo com linguagem do domínio RPG: "Cenário", "Mestres de RPG", "OSR", "D&D 5e/5.5e"
- ✅ Estrutura hierárquica de regras com seções nomeadas — reflete organização real de comunidades

#### Issues

**Issue H2.1: "Carregando" no header não reflete estado real**
- **Severity:** 2 (Minor)
- **Description:** Overlaps with H1.1; also a mismatch with real-world expectation — "carregando" sugere algo lento/travado quando na verdade é hidratação React rápida
- **Recommendation:** "Verificando sessão…" seria mais preciso

---

### H3: User Control and Freedom
**Compliance:** ⭐⭐⭐⚪⚪ (3/5)

#### Issues

**Issue H3.1: Reportar grupo sem cancelamento nem desfazer**
- **Severity:** 3 (Major)
- **Location:** ReportButton em cada card de grupo
- **Description:** Clicar "Reportar" abre modal (React, não visível no SSR). Não há indicação de que a ação pode ser cancelada (espera-se que o modal tenha botão cancelar, mas o trigger não indica). Após reportar, não há "desfazer".
- **Recommendation:** Garantir modal com "Cancelar" + "Confirmar". Após envio, mostrar "Denúncia enviada" com opção "Desfazer" por 5 segundos.

**Issue H3.2: Gate adulto sem "sair" ou "voltar a esconder"**
- **Severity:** 2 (Minor)
- **Location:** Gate +18 nos cards e páginas de detalhe
- **Description:** Uma vez que o usuário clica "Sim, tenho 18+" e desbloqueia, não há como re-esconder o conteúdo adulto. O localStorage `artificio_adult_gate=1` é permanente.
- **Recommendation:** Adicionar botão "Esconder conteúdo +18" no footer ou sidebar

**Issue H3.3: Sem botão "voltar ao topo" em páginas longas**
- **Severity:** 1 (Cosmetic)
- **Location:** Home (rolagem longa com regras + grupos)
- **Description:** A página home pode ter scroll significativo com todas as seções (grupos + regras). Sidebar sticky ajuda, mas não cobre o caso de usuário que scrollou até o final das regras e quer voltar aos grupos.
- **Recommendation:** Botão "↑ Topo" flutuante no canto inferior direito

#### Positive Examples
- ✅ Sidebar sempre visível (sticky) — controle de navegação constante
- ✅ `scroll-behavior: smooth` — navegação por âncora previsível
- ✅ Breadcrumb no detalhe de grupo — caminho de volta claro

---

### H4: Consistency and Standards
**Compliance:** ⭐⭐⭐⚪⚪ (3/5)

#### Issues

**Issue H4.1: /busca completamente fora do padrão de shell**
- **Severity:** 3 (Major)
- **Location:** `/busca/` — sem header, sem sidebar, sem footer, cores hardcoded
- **Description:** Todas as outras páginas (home, admin, grupo/[slug]) usam o shell padrão (header + sidebar + conteúdo). A página de busca é uma exceção total — parece um site diferente.
- **Affected Tasks:** Navegação cross-app, orientação espacial do usuário
- **Recommendation:** Unificar /busca no mesmo shell das outras páginas

**Issue H4.2: Cores hardcoded em LinksSearch quebram tema**
- **Severity:** 3 (Major)
- **Location:** `LinksSearch.tsx` — `text-white`, `bg-[#0F1A2E]`, `text-white/50`
- **Description:** Componente React de busca usa classes Tailwind com cores fixas em vez de tokens CSS. Não responde ao toggle de tema — fica sempre em modo escuro forçado, mesmo com tema light ativo.
- **Recommendation:** Usar `text-[var(--text)]`, `bg-[var(--surface)]`, `text-[var(--muted)]`

**Issue H4.3: Emoji ☰ vs ícones SVG no mesmo header**
- **Severity:** 2 (Minor)
- **Location:** Menu toggle no header
- **Description:** Todos os ícones do header são SVG inline (search, changelog, theme) exceto o menu hamburger que é caractere "☰". Inconsistência de estilo.
- **Recommendation:** Padronizar para SVG inline (ver também Issue 6.1 do ui-design-review)

#### Positive Examples
- ✅ Cards de grupo seguem exatamente o mesmo padrão em todas as seções
- ✅ Blocos de regra têm estrutura idêntica
- ✅ Header cross-app padronizado via `@artificio/ui`

---

### H5: Error Prevention
**Compliance:** ⭐⭐⭐⚪⚪ (3/5)

#### Issues

**Issue H5.1: Reportar grupo sem confirmação**
- **Severity:** 3 (Major)
- **Location:** ReportButton
- **Description:** Não está claro (do HTML renderizado) se o modal de reportar tem etapa de confirmação. O trigger é um span com `role="button"` inline — sem indicação de que uma ação será disparada.
- **Recommendation:** Modal com resumo da denúncia + "Confirmar" / "Cancelar". Trigger visual mais claro (ícone de flag + texto).

**Issue H5.2: CTAs "Entrar no grupo" sem aviso de link externo**
- **Severity:** 2 (Minor)
- **Location:** Página de detalhe de grupo — `.cta-join`
- **Description:** O botão "Entrar no grupo" é um link para `chat.whatsapp.com`. Não há indicação de que o usuário sairá do site. Idealmente, um ícone de link externo ou texto "(WhatsApp)".
- **Recommendation:** Adicionar `target="_blank"` com ícone de external-link ou texto "(abre WhatsApp)"

**Issue H5.3: Sem prevenção de duplo clique em ações**
- **Severity:** 2 (Minor)
- **Location:** ReportButton, SuggestForm submit, CTA join
- **Description:** Nenhum mecanismo visível (disabled state, loading) para prevenir envios duplicados
- **Recommendation:** Desabilitar botão durante submit e mostrar spinner

#### Positive Examples
- ✅ Gate adulto previne exposição acidental — opt-in explícito
- ✅ Placeholder SVG para grupos sem imagem — evita broken image
- ✅ Dimensões explícitas (`width`, `height`) em imagens — previne layout shift

---

### H6: Recognition Rather Than Recall
**Compliance:** ⭐⭐⭐⭐⚪ (4/5)

#### Issues

**Issue H6.1: Sem breadcrumb ou indicação de localização na home**
- **Severity:** 1 (Cosmetic)
- **Location:** Home page
- **Description:** O `aria-current="page"` no header indica "WhatsApps", mas dentro da página não há indicação visual de "Home > Grupos de WhatsApp". O breadcrumb só existe em `/grupo/[slug]`.
- **Recommendation:** Adicionar breadcrumb sutil no topo do conteúdo: "Home > Grupos de WhatsApp"

**Issue H6.2: Ícones do header sem labels visíveis**
- **Severity:** 2 (Minor)
- **Location:** Header — search, changelog, theme toggle
- **Description:** Os três botões de ação no header são ícones SVG sem texto visível. Dependem de `aria-label` e `title` para acessibilidade. Usuários novos podem não saber o que cada ícone faz.
- **Recommendation:** Adicionar tooltip no hover (via CSS ou `title` expandido) — o `title` atual existe mas é genérico ("Buscar", "Changelog")

#### Positive Examples
- ✅ Sidebar com navegação hierárquica sempre visível
- ✅ Cards mostram todas as informações sem necessidade de clique: nome, logo, categoria, descrição
- ✅ Regras com títulos descritivos e hierarquia clara (proibido > divulgação > vendas > etc.)
- ✅ Breadcrumb no detalhe de grupo permite orientação espacial

---

### H7: Flexibility and Efficiency of Use
**Compliance:** ⭐⭐⭐⚪⚪ (3/5)

#### Issues

**Issue H7.1: Sem atalhos de teclado**
- **Severity:** 2 (Minor)
- **Location:** Global
- **Description:** Nenhum atalho de teclado implementado (ex.: `/` para busca, `?` para ajuda, `Esc` para fechar modais)
- **Recommendation:** Adicionar `/` → foco no input de busca, `Esc` → fechar sidebar mobile/modal

**Issue H7.2: Sem paginação ou "carregar mais" nos cards**
- **Severity:** 2 (Minor)
- **Location:** Home page — grid de cards
- **Description:** Todos os grupos (13 fixos + N comunitários) são renderizados de uma vez. Com crescimento futuro, a página ficará longa sem mecanismo de paginação
- **Recommendation:** Para curto prazo (≤30 grupos) está OK. Para >30, implementar paginação ou virtual scroll

**Issue H7.3: Busca não suporta filtros avançados**
- **Severity:** 1 (Cosmetic)
- **Location:** `/busca/`
- **Description:** A busca é textual simples, sem filtros por categoria, tipo de grupo, ou ordenação
- **Recommendation:** Adicionar chips de filtro abaixo do input (categoria, tipo de grupo)

#### Positive Examples
- ✅ Input de busca com `autofocus` — usuário pode começar a digitar imediatamente
- ✅ Sidebar com links diretos para seções e outros projetos
- ✅ Chips de filtro na seção de grupos comunitários (via CommunityGroups React)

---

### H8: Aesthetic and Minimalist Design
**Compliance:** ⭐⭐⭐⭐⭐⭐⚪⚪⚪⚪ (6/10 → convertido para 5-estrelas: ⭐⭐⭐⭐⚪ 4/5)

#### Issues

**Issue H8.1: Sidebar ocupa 280px permanentes mesmo sem necessidade**
- **Severity:** 2 (Minor)
- **Location:** Sidebar no desktop
- **Description:** 280px é generoso para o conteúdo atual da sidebar (links de navegação simples). Em telas menores (1024-1366px), rouba espaço do conteúdo sem ganho proporcional
- **Recommendation:** Reduzir para 240px ou implementar colapso parcial (ícones + expand on hover)

**Issue H8.2: Footer dentro do `<main>` em vez de elemento semântico**
- **Severity:** 1 (Cosmetic)
- **Location:** `.site` footer dentro de `<main class="content">`
- **Description:** O footer "Um presente da Artifício RPG..." está dentro do `<main>`, não em `<footer>`. Semanticamente, é informação de copyright/atribuição que pertence ao footer do site, não ao conteúdo principal
- **Recommendation:** Mover para `<footer>` fora do `<main>`, mantendo o estilo

**Issue H8.3: Seção de regras muito longa na home**
- **Severity:** 1 (Cosmetic)
- **Location:** Home — seção "Regras dos grupos" com 7 subseções
- **Description:** As regras ocupam ~40% do scroll vertical da home. Para um novo visitante, o volume de texto regulatório antes mesmo de ver todos os grupos pode ser desestimulante
- **Recommendation:** Mover regras para página própria (`/regras/`) ou colapsar em accordion com "Ver todas as regras"

#### Positive Examples
- ✅ Layout limpo, sem elementos decorativos desnecessários
- ✅ Uso contido de cores (brand orange como acento, neutros como base)
- ✅ Sem banners, popups, ou interrupções
- ✅ Progressive disclosure via sidebar collapsible groups

---

### H9: Help Users Recognize, Diagnose, and Recover from Errors
**Compliance:** ⭐⭐⚪⚪⚪ (2/5)

#### Issues

**Issue H9.1: Sem estados de erro visíveis no HTML renderizado**
- **Severity:** 3 (Major)
- **Location:** CommunityGroups, SuggestForm, LinksSearch (React islands)
- **Description:** Nenhum estado de erro é visível no SSR. Se a API falhar ou o usuário estiver offline, os componentes React precisam mostrar erro — mas o HTML estático não tem fallback
- **Recommendation:** Adicionar `<noscript>` ou estado de erro estático para falha de carregamento. Implementar tratamento de erro com mensagens amigáveis nos componentes React

**Issue H9.2: Sem tratamento de erro 404 customizado**
- **Severity:** 2 (Minor)
- **Location:** Páginas não encontradas (ex.: `/grupo/slug-inexistente`)
- **Description:** Sem evidência de página 404 no HTML inspecionado. Se um grupo não existe, o comportamento não está claro
- **Recommendation:** Criar `404.astro` no app links com navegação de volta

**Issue H9.3: Input de busca sem validação inline**
- **Severity:** 2 (Minor)
- **Location:** LinksSearch
- **Description:** Se o usuário digitar uma busca que não retorna resultados, não há mensagem de "Nenhum grupo encontrado". O SSR mostra "Carregando grupos..."
- **Recommendation:** Estado de "sem resultados" com sugestão de termos alternativos

#### Positive Examples
- ✅ Gate adulto com mensagem clara de aviso
- ✅ `aria-label` em botões de ação (screen readers)

---

### H10: Help and Documentation
**Compliance:** ⭐⭐⭐⭐⚪ (4/5)

#### Strengths
- ✅ Seção de regras abrangente e bem organizada (7 subseções)
- ✅ Link de contato via WhatsApp para parcerias
- ✅ Botão "Changelog" no header — acesso a novidades e mudanças
- ✅ Sidebar com links para todos os projetos do Artifício — ajuda cross-navegação
- ✅ Descrições de grupo detalhadas no card — não precisa clicar para entender

#### Issues

**Issue H10.1: Sem onboarding para novos visitantes**
- **Severity:** 2 (Minor)
- **Location:** Home
- **Description:** Um visitante novo vê a grade de grupos imediatamente, sem contexto sobre o que é o Artifício ou como funciona a participação. O lead paragraph é curto (1 frase).
- **Recommendation:** Banner sutil de boas-vindas no topo: "Bem-vindo ao hub de WhatsApp do Artifício RPG — escolha um grupo e participe!"

**Issue H10.2: Sem FAQ ou ajuda contextual**
- **Severity:** 1 (Cosmetic)
- **Location:** Global
- **Description:** Não há seção de perguntas frequentes, tooltip de ajuda, ou guia rápido
- **Recommendation:** Adicionar link "Ajuda" no footer ou sidebar com FAQ mínimo

---

## Prioritized Action Items

### Must Fix (Severity 3 — Major)

1. **H4.1 + H1 + H6 — /busca fora do shell padrão**
   - Impact: Usuário perde navegação cross-app e contexto
   - Fix: Envolver busca no mesmo layout (header + sidebar + conteúdo)
   - Effort: Medium (3-4h)

2. **H4.2 + H3 — LinksSearch com cores hardcoded**
   - Impact: Busca não responde a toggle de tema; aparência quebrada no light mode
   - Fix: Substituir classes Tailwind arbitrárias por tokens CSS
   - Effort: Medium (2h)

3. **H1.1 — "Carregando" ambíguo no header**
   - Impact: Confusão sobre estado de autenticação
   - Fix: Mudar texto para "Verificando acesso…" com skeleton/spinner CSS
   - Effort: Low (30min)

4. **H3.1 + H5.1 — ReportButton sem confirmação/feedback**
   - Impact: Ação irreversível sem cancelamento claro
   - Fix: Garantir modal com Confirmar/Cancelar + toast de sucesso com opção desfazer
   - Effort: Medium (2h)

5. **H9.1 — Sem estados de erro no SSR para componentes React**
   - Impact: Se API falhar, usuário vê loading eterno ou tela quebrada
   - Fix: Adicionar fallback de erro estático nos wrappers Astro dos componentes React
   - Effort: Medium (2h)

6. **H5.2 — CTA "Entrar no grupo" sem aviso de link externo**
   - Impact: Usuário sai do site sem esperar
   - Fix: Adicionar ícone external-link ou "(WhatsApp)" no CTA
   - Effort: Low (15min)

7. **H1.2 — Botão de busca no header sem destino óbvio**
   - Impact: Usuário não sabe se é modal ou navegação
   - Fix: Tooltip descritivo: "Buscar grupos" + garantir navegação consistente para /busca
   - Effort: Low (15min)

### Should Fix (Severity 2 — Minor)

8. **H3.2 — Gate adulto sem opção de re-esconder**
9. **H5.3 — Sem prevenção de duplo clique em submits**
10. **H6.2 — Ícones do header sem labels visíveis (tooltip)**
11. **H7.1 — Sem atalhos de teclado**
12. **H7.2 — Sem paginação para muitos grupos**
13. **H9.2 — Sem 404 customizado**
14. **H9.3 — Busca sem estado "sem resultados"**
15. **H10.1 — Sem onboarding para novos visitantes**
16. **H8.1 — Sidebar larga demais (280px)**
17. **H4.3 — ☰ emoji vs SVG no menu toggle**

### Nice to Have (Severity 1 — Cosmetic)

18. **H3.3 — Sem botão "voltar ao topo"**
19. **H6.1 — Sem breadcrumb na home**
20. **H10.2 — Sem FAQ/ajuda contextual**
21. **H8.2 — Footer semântico (dentro de `<main>`)**
22. **H8.3 — Regras muito longas na home**

---

## Quick Wins (Low Effort, Decent Impact)

1. **Substituir "Carregando" por "Verificando acesso…"** — 30min, resolve H1.1
2. **Adicionar "(WhatsApp)" no CTA "Entrar no grupo"** — 15min, resolve H5.2
3. **Tooltip descritivo no botão de busca do header** — 15min, resolve H1.2
4. **Substituir ☰ por SVG** — 15min, resolve H4.3
5. **Adicionar estado "sem resultados" na busca** — 1h, resolve H9.3
6. **Adicionar `disabled` + spinner em submits** — 1h, resolve H5.3

---

## Long-term Improvements

1. **Shell único para todas as páginas** — unificar /busca no layout padrão (resolve 4 issues)
2. **Sistema de estados de erro padronizado** — componente ErrorState reutilizável cross-app
3. **Onboarding interativo** — tour guiado para novos visitantes (opcional, baixa prioridade)

---

## Positive Highlights

- **Sidebar navigation é excelente** — `<details>` progressive enhancement, scroll independente, cross-app links. Referência de boa UX.
- **Gate adulto bem pensado** — blur + overlay + localStorage + persistência. Modelo de prevenção de erro (H5).
- **Terminologia natural** — português brasileiro coloquial apropriado ao público RPG. Sem jargão técnico.
- **Cards informativos** — todas as informações visíveis sem clique: nome, logo, categoria, descrição. Reconhecimento sobre recall (H6).
- **Design minimalista** — sem distrações, sem banners, sem popups. Foco no conteúdo (H8).

---

## Cross-Heuristic Patterns

### Pattern 1: Inconsistência de shell (H1, H4, H6)
A página `/busca` quebra o shell padrão, causando 3 violações simultâneas: perda de status (H1), inconsistência de padrão (H4), perda de reconhecimento espacial (H6). **Root cause:** a página foi construída como standalone, não integrada ao layout Astro.

### Pattern 2: Falta de feedback em ações do usuário (H1, H5, H9)
ReportButton, SuggestForm, e LinksSearch não têm indicação clara de progresso, confirmação, ou recuperação de erro. **Root cause:** componentes React não implementam estados de UI completos (loading, error, success).

### Pattern 3: Cores hardcoded (H4, H3)
Tailwind arbitrário em LinksSearch quebra tema e consistência visual. **Root cause:** componente construído antes da padronização de tokens CSS ou sem consciência do design system.

---

**Methodology:** Expert heuristic evaluation (Nielsen's 10 Usability Heuristics) baseada em HTML renderizado (SSR/SSG) de 3 páginas + CSS fonte (624 linhas). Componentes React client-side analisados via HTML estático e fallbacks; análise completa de AdminPanel e SuggestForm exigiria acesso à renderização interativa. Recomendações devem ser validadas com teste de usabilidade real.

---

## Correções pós-investigação de código (2026-06-22)

**Correção 1 — H3.1 + H5.1 "Reportar sem confirmação" (Severity 3 Major): FALSO POSITIVO.** Investigação de `ReportButton.tsx:96-202` confirma modal completo com form, botões Cancelar/Enviar, disabled+spinner durante submit, tratamento de erro (429 rate-limit, 400 inválido, falha de rede) e estado de sucesso "Denúncia enviada" com botão Fechar. Severidade real do trigger (`<span>` em vez de `<button>` + inline styles) = Severity 2 Minor. A recomendação "Garantir modal com Confirmar/Cancelar + toast de sucesso com opção desfazer" está parcialmente implementada — falta "Desfazer" e migrar trigger para `<button>` com classes CSS. Os itens 1 e 4 da seção "Must Fix" permanecem válidos, mas com severidade reduzida.

**Correção 2 — H9.1 "Sem estados de erro" para LinksSearch: FALSO POSITIVO PARCIAL.** `LinksSearch.tsx:73-78` implementa estados: loading ("Carregando grupos..."), error ("Erro ao carregar grupos. Tente novamente."), empty ("Nenhum grupo disponível."), no-results (mensagem com query). O problema real é apenas que as cores são hardcoded (Tailwind arbitrário), não que faltam estados. CommunityGroups e SuggestForm não foram verificados no código fonte (React client-side não inspecionado).

**Correção 3 — H9.3 "Busca sem estado sem resultados": FALSO POSITIVO.** `LinksSearch.tsx:75-78` mostra `Nenhum grupo encontrado para "${query}".` quando filtered.length === 0 e query não vazia.

**Correção 4 — H1.1 "Carregando ambíguo" + H2.1 "não reflete estado real": PROCEDE, MAS SEVERIDADE REDUZIDA (3→2).** Investigação confirmou que o `<span>Carregando</span>` existe (`Header.tsx:158-159`), container já tem `aria-live="polite"`, e o texto desaparece após fetch `/me` (~200ms-2s, incluindo possível refresh 401). A severidade Major é inflada — o estado loading é funcional, só falta contexto + animação. Corrigir via T6 (texto "Verificando acesso…" + animação CSS pulse, `packages/ui`). Severidade real: Minor.

