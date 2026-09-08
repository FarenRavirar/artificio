# UI Design Review Report

**Interface:** Discord Sync — Covil do Lich (gestão administrativa do mesas)  
**Date:** 2026-06-23  
**Reviewer:** AI Agent (UI Design Review skill)  
**Pages Reviewed:** 8 componentes + 1 página (9 arquivos)  
**Design System:** `@artificio/ui` (primitives, tokens, theme, styles.css)  
**Target:** `apps/mesas/frontend/src/features/discord-sync/`

---

## Executive Summary

### Visual Design Score: 47/100 (F — Poor)

| Dimension | Score | Status |
|-----------|-------|--------|
| Visual Hierarchy | 5/10 | ⚠️ Adequate |
| Typography | 4/10 | ❌ Below par |
| Color Palette | 5/10 | ⚠️ Adequate |
| Spacing & White Space | 6/10 | ⚠️ Adequate |
| Visual Consistency | 2/10 | ❌ Poor |
| Imagery & Graphics | 5/10 | ⚠️ Adequate |
| Layout & Grid | 6/10 | ⚠️ Adequate |
| Component Design | 2/10 | ❌ Poor |
| Branding & Personality | 3/10 | ❌ Below par |
| Modern Standards | 9/10 | ✅ Excellent |

### Overall Assessment

A UI funcional e operacionalmente correta, mas construída inteiramente com Tailwind utilitário inline — **zero consumo do design system `@artificio/ui`**. Todas as primitivas compartilhadas (`Button`, `Badge`, `Banner`, `Field`, `Panel`, `TextInput`, `Textarea`, `Select`, `Modal`, `Drawer`, `EmptyState`) são ignoradas em favor de `<button>`, `<textarea>`, `<select>` e `<input>` nus com classes utilitárias repetidas. A cor de marca laranja `#FF5722` (D064) não aparece uma única vez na UI do Discord Sync — o azul genérico (`blue-600`) ocupa o lugar de acento primário. O resultado é uma interface que funciona no escuro (default do mesas), mas se parece mais com um dashboard de ferramenta interna genérica do que com um produto da suite Artifício RPG.

### Top 3 Strengths

1. **Layout funcional e bem organizado** — grid de 2 colunas com painel de detalhes em sticky é efetivo para revisão de mensagens
2. **Boas práticas de acessibilidade** — `aria-label`, `role`, `htmlFor`, `readOnly` presentes em vários pontos
3. **Remapeamento de light-mode funciona** — o `index.css` do mesas cobre os hexes hardcoded e classes `text-white/`/`bg-white/` do Discord Sync, então o tema claro não quebra a UI

### Top 3 Issues

1. **CRÍTICO — Zero adoção do design system `@artificio/ui`** — todos os 8 componentes ignoram `Button`, `Badge`, `Banner`, `Field`, `Panel`, `Modal`, `TextInput`, `Textarea`, `Select`, `EmptyState`; cada botão/input/textarea é escrito do zero com Tailwind inline
2. **CRÍTICO — Marca ausente** — a cor laranja canônica `#FF5722` (D064) não é usada em nenhum lugar do Discord Sync; tabs ativas, botões de ação e links usam `blue-600` genérico em vez do acento de marca
3. **ALTO — Botões sem estados visuais** — nenhum botão tem estados `hover`/`focus`/`active`/`disabled` diferenciados com animações; a maioria só troca opacidade com `disabled:opacity-40`

### First Impression

**Immediate Feeling:** Dashboard técnico funcional, estilo ferramenta interna/dev-tool, sem identidade de produto  
**Trust Level:** Medium (funciona, mas não inspira confiança de produto polido)  
**Competitive Standing:** Behind — produtos RPG modernos (D&D Beyond, Roll20) usam marca consistente e design systems próprios

---

## Detailed Analysis

### 1. Visual Hierarchy ⭐⭐⭐⭐⭐⚪⚪⚪⚪⚪ (5/10)

#### Strengths
- ✅ Tabs principais (`Configuração` / `Fontes` / `Mensagens` / `Drafts` / `Importar JSON`) bem definidas e escaneáveis
- ✅ Painel de detalhes (aside sticky) com a mensagem selecionada cria hierarquia clara na aba Mensagens
- ✅ Status badges coloridos (`rounded-full`) diferenciam bem mensagens e drafts por estado
- ✅ Cards de estatísticas (Pendentes / Em revisão / Conferidas / Ignoradas) resumem o pipeline visualmente

#### Issues

**Issue 1.1: Botões de ação competem entre si sem hierarquia**
- **Severity:** High
- **Location:** `DiscordSyncPanel.tsx:458-485` (painel de detalhes da mensagem)
- **Problem:** "✦ Criar Draft" (ação primária), "Mandar para revisão" (secundária) e "Diagnosticar corpo" (terciária) usam o mesmo tamanho (`px-3 py-2 text-xs`) e pesos visuais similares
- **Impact:** Usuário não sabe qual ação é prioritária; overload cognitivo
- **Recommendation:** Fazer "Criar Draft" 1.5× maior ou com preenchimento laranja de marca; ações secundárias em outline/ghost; diagnósticas em texto
- **Effort:** Low (1-2h)

**Issue 1.2: Tabs internas dos drafts sem distinção suficiente**
- **Severity:** Medium
- **Location:** `DiscordDraftPreview.tsx:85-89` (tabs Campos / Normalizado / Bruto)
- **Problem:** Três tabs internas com mesmo estilo, sem indicar qual é a principal (Campos)
- **Impact:** Navegação entre JSON bruto e formulário não guia o usuário
- **Recommendation:** Separador visual entre "Campos" (ação primária) e as tabs de inspeção de dados
- **Effort:** Low (30min)

#### Recommendations Summary
1. Criar hierarquia de botões: primário (fill laranja) > secundário (outline) > terciário (texto)
2. Agrupar ações no painel de detalhes por prioridade
3. Separar tabs de edição das tabs de inspeção no DraftPreview

---

### 2. Typography ⭐⭐⭐⭐⚪⚪⚪⚪⚪⚪ (4/10)

#### Strengths
- ✅ Família tipográfica `Inter` (sans-serif) definida no `body` de `index.css` — limpa e legível
- ✅ Uso consistente de `font-semibold` para títulos de seção e `font-medium` para labels

#### Issues

**Issue 2.1: Texto de corpo excessivamente pequeno (12px)**
- **Severity:** Critical
- **Location:** Todo o Discord Sync (`text-xs` usado em ~80% dos textos de UI)
- **Problem:** `text-xs` = 12px (0.75rem) é usado para labels, conteúdo, botões, mensagens de status e dados informativos
- **Standard:** 14px mínimo para UI funcional; 16px para corpo de leitura
- **Impact:** Fadiga visual, baixa legibilidade, aparência amadora
- **Recommendation:** Escala tipográfica mínima: `text-sm` (14px) para UI, `text-base` (16px) para conteúdo de leitura, `text-xs` (12px) só para metadados/auxiliares
- **Effort:** Medium (1 dia — trocar `text-xs` por `text-sm` em todo o módulo)

**Issue 2.2: Sem uso da fonte display (Oswald)**
- **Severity:** Low
- **Location:** Todo o Discord Sync
- **Problem:** O design system define `--artificio-font-display: "Oswald"` para headings (D040), mas nenhum título no Discord Sync usa
- **Impact:** Perda de personalidade da marca
- **Recommendation:** Usar `font-display` no título principal "Discord Sync — Covil do Lich" e em cabeçalhos de seção
- **Effort:** Low (30min)

**Issue 2.3: Line-height não definido**
- **Severity:** Medium
- **Location:** Textareas de conteúdo (`DiscordSyncPanel.tsx:500-504`)
- **Problem:** O textarea de conteúdo completo usa `text-sm` sem `leading-*` explícito, herdando o default do Tailwind (1.25) que é apertado para leitura
- **Standard:** 1.5-1.6 para texto de leitura
- **Recommendation:** Adicionar `leading-relaxed` (1.625) ao textarea de conteúdo e áreas de descrição
- **Effort:** Low (15min)

#### Recommendations Summary
1. Migrar `text-xs` → `text-sm` para toda a UI funcional (botões, labels, dados)
2. Usar `text-base` para conteúdo de leitura (descrições, corpo de mensagens)
3. Adotar `font-display` (Oswald) em títulos de seção
4. Definir `leading-relaxed` em áreas de texto multilinha

---

### 3. Color Palette ⭐⭐⭐⭐⭐⚪⚪⚪⚪⚪ (5/10)

#### Strengths
- ✅ Paleta escura consistente (navy-azulado: `#0F1A2E`, `#1B2A4A`, `#0a1628`)
- ✅ Status semânticos bem mapeados (verde=sucesso/conferido, amarelo=pendente, laranja=revisão, vermelho=erro)
- ✅ Boa legibilidade no dark mode (branco sobre navy com opacidades graduadas)
- ✅ Light mode remapeado corretamente no `index.css` — hexes hardcoded e classes `text-white/`/`bg-white/` são cobertos

#### Issues

**Issue 3.1: Cor de marca laranja `#FF5722` completamente ausente**
- **Severity:** Critical
- **Location:** Todo o Discord Sync
- **Problem:** O laranja canônico da marca Artifício RPG (`#FF5722`, D064) não é usado em nenhum lugar do módulo Discord Sync. Tabs ativas, botões de ação principal, links e indicadores de foco usam `blue-600` genérico
- **Impact:** Zero identidade visual de marca; parece ferramenta genérica
- **Recommendation:** Trocar `blue-600` → `--artificio-brand` (#FF5722) em todos os indicadores de tab ativa, botões de ação primária e links
- **Effort:** Medium (3-4h — requer troca sistemática em 8 arquivos)

**Issue 3.2: Azul (`blue-600`) usado como cor de acento primário inconsistente com a marca**
- **Severity:** High
- **Location:** `DiscordSyncPanel.tsx:266` (tabClass), `DiscordSourceList.tsx:204,364` (botões de ação), `DiscordDraftPreview.tsx:31` (tabClass), `DiscordDraftReviewTable.tsx:33` (botão sync)
- **Problem:** `bg-blue-600`, `bg-blue-700`, `hover:bg-blue-*` e `text-blue-400` são usados para ações primárias, tabs ativas e links
- **Impact:** Inconsistência com o resto da suite Artifício (que usa laranja como acento)
- **Recommendation:** Mapear `blue-600` → brand laranja; `blue-700` → brandDeep; `text-blue-400` → `text-orange-400` (com remap light)
- **Effort:** Medium (mesmo esforço do Issue 3.1)

**Issue 3.3: Cores de status duplicadas e inconsistentes**
- **Severity:** Medium
- **Location:** `DiscordSyncPanel.tsx:19-26` (MESSAGE_STATUS_COLORS) e `DiscordDraftReviewTable.tsx:22-28` (DRAFT_STATUS_COLORS)
- **Problem:** Dois mapas de cores de status definidos inline em arquivos diferentes, com pequenas diferenças. O status `draft` em DRAFT_STATUS_COLORS usa `bg-white/10 text-white/50` enquanto `pending` em MESSAGE_STATUS_COLORS usa `bg-yellow-700/40 text-yellow-300`
- **Impact:** Inconsistência visual entre mensagens e drafts; duplicação de código
- **Recommendation:** Extrair para um mapa único em `constants.ts` ou usar tokens semânticos `--state-*` do design system
- **Effort:** Low (30min)

**Issue 3.4: Sem uso de tokens semânticos de estado**
- **Severity:** Medium
- **Location:** Todo o Discord Sync
- **Problem:** O design system define tokens como `--state-success-bg`, `--state-success-fg`, `--state-warning-*`, `--state-danger-*`, `--state-info-*` — nenhum é usado. Componentes usam Tailwind utilitário (`bg-green-700/40 text-green-300`) em vez disso
- **Impact:** Se o design system evoluir (ex: novas cores de estado), esta UI fica desatualizada
- **Recommendation:** Migrar status badges e banners para os tokens semânticos `--state-*`
- **Effort:** Medium (2-3h)

#### Recommendations Summary
1. **Prioridade máxima:** Trocar `blue-600`/`blue-700` → laranja de marca (`#FF5722`/`#E64A19`) em todos os acentos de UI
2. Unificar mapas de cores de status em `constants.ts`
3. Migrar status colors para tokens semânticos `--state-*`
4. Verificar contraste AA após troca de cores

---

### 4. Spacing & White Space ⭐⭐⭐⭐⭐⭐⚪⚪⚪⚪ (6/10)

#### Strengths
- ✅ Uso consistente da escala de spacing do Tailwind (gap-2, gap-3, mb-4, p-3, p-4)
- ✅ Cards têm padding interno adequado (`px-4 py-3`)
- ✅ Separação clara entre seções com `space-y-*` e `mb-*`
- ✅ Painel de detalhes com altura mínima `min-h-[360px]` evita colapso

#### Issues

**Issue 4.1: Grid de mensagens muito denso na lista**
- **Severity:** Medium
- **Location:** `DiscordSyncPanel.tsx:376` (lista de mensagens)
- **Problem:** `space-y-2` entre mensagens é apertado para cards com 3-4 linhas de informação cada
- **Impact:** Escaneabilidade reduzida; cartões se fundem visualmente
- **Recommendation:** Aumentar para `space-y-3` ou adicionar `mb-1` nos cards
- **Effort:** Low (5min)

**Issue 4.2: Padding inconsistente em botões**
- **Severity:** Low
- **Location:** Vários arquivos
- **Problem:** Botões usam `px-3 py-2`, `px-4 py-2`, `px-3 py-1`, `px-2 py-1` sem padrão claro. Botões de mesma importância visual têm tamanhos diferentes
- **Impact:** Sensação de desleixo; inconsistência tátil
- **Recommendation:** Padronizar: ação primária = `px-4 py-2`, secundária = `px-3 py-1.5`, chip/tag = `px-2 py-0.5`
- **Effort:** Medium (1h — revisão sistemática)

**Issue 4.3: Área de drag-and-drop sem padding interno suficiente**
- **Severity:** Low
- **Location:** `DiscordJsonImportPanel.tsx:198-218`
- **Problem:** A área de drop tem `p-4` mas o textarea interno ocupa quase todo o espaço (`min-h-[280px]`); a borda tracejada fica colada ao textarea
- **Impact:** Área de drop pouco evidente visualmente
- **Recommendation:** Aumentar padding para `p-6` ou reduzir `min-h` do textarea para dar respiro à borda tracejada
- **Effort:** Low (5min)

#### Recommendations Summary
1. Aumentar `space-y-2` → `space-y-3` na lista de mensagens
2. Padronizar padding de botões (3 tamanhos: sm/md/lg)
3. Dar mais respiro à área de drop de arquivo

---

### 5. Visual Consistency ⭐⭐⚪⚪⚪⚪⚪⚪⚪⚪ (2/10)

#### Strengths
- ✅ Estrutura de cards consistente (`bg-white/5 border border-white/10 rounded-lg`) em toda a UI
- ✅ Padrão de filtros (select + botão "Recarregar") repetido em Mensagens e Drafts

#### Issues

**Issue 5.1: ZERO uso de primitivas do design system**
- **Severity:** Critical
- **Location:** Todos os 8 componentes
- **Problem:** Nenhum componente do Discord Sync usa as primitivas de `@artificio/ui`. `Button`, `Badge`, `Banner`, `Field`, `Panel`, `TextInput`, `Textarea`, `Select`, `Modal`, `Drawer`, `EmptyState`, `LoadingState` — todas disponíveis e nenhuma usada
- **Impact:** Cada botão, input, select, textarea e estado vazio é reimplementado do zero com Tailwind inline. Isso cria 8 "design systems" paralelos e incompatíveis
- **Evidence:**
  - `discordSyncApi.ts` importa `z` do Zod (bom) mas nenhum componente importa de `@artificio/ui`
  - `DiscordSettingsPanel.tsx` importa ícones do `lucide-react` (consistente com o resto do app) mas não importa `Button`/`Field`/`TextInput`
  - `DiscordDraftPreview.tsx:35-144` implementa um modal do zero com `fixed inset-0 bg-black/60 backdrop-blur-sm` em vez de usar `<Modal>` do design system
  - `DiscordDraftReviewTable.tsx:142-143` tem `<p>Carregando...</p>` em vez de `<LoadingState>`
- **Recommendation:** Refatorar para usar as primitivas: `<Button variant="primary">`, `<Badge variant="warning">`, `<Panel>`, `<Field>`, `<Modal>`, `<EmptyState>`
- **Effort:** High (3-5 dias — refatoração de 8 componentes)

**Issue 5.2: Três estilos diferentes de tabs**
- **Severity:** High
- **Location:** Todo o Discord Sync + GestaoPage
- **Problem:** Existem 3 estilos de navegação por tabs:
  1. `GestaoPage.tsx:480-549` — tabs com `border-b-2 border-blue-500` (underline style)
  2. `DiscordSyncPanel.tsx:264-267` — tabs com `bg-blue-600 text-white rounded-lg` (pill style)  
  3. `DiscordDraftPreview.tsx:29-32` — sub-tabs com `bg-blue-600 text-white rounded-lg text-xs` (mini pill)
- **Impact:** Navegação inconsistente dentro da mesma página; o usuário precisa reaprender o padrão de tab a cada nível
- **Recommendation:** Unificar para um único estilo de tab (preferir o underline do GestaoPage por ser o padrão da indústria para navegação principal) ou usar o componente `Tabs` do design system (se existir)
- **Effort:** Medium (2-3h)

**Issue 5.3: Botões de ação com estilos inconsistentes para a mesma função**
- **Severity:** Medium
- **Location:** Vários
- **Problem:** "Salvar" em DiscordSettingsPanel (`bg-blue-600 hover:bg-blue-500`) vs "Salvar campos" em DiscordDraftPreview (`bg-blue-600 hover:bg-blue-700`). "Cancelar" em um lugar é `bg-white/10 hover:bg-white/20`, em outro é `bg-white/5 hover:bg-white/10`
- **Impact:** Mesma ação visualmente diferente confunde o usuário
- **Recommendation:** Padronizar com `<Button variant="primary">` para salvar, `<Button variant="secondary">` para cancelar
- **Effort:** Low (1h — se usar primitivas)

**Issue 5.4: Tratamento de loading/empty/error inconsistente**
- **Severity:** Medium
- **Location:** Vários
- **Problem:** Estados de carregamento são `<p className="text-white/40 text-sm py-4 text-center">Carregando...</p>` em todos os lugares; sem spinner, sem componente dedicado. Estados vazios são `<p>Nenhum X encontrado.</p>`
- **Impact:** Aparência de baixo orçamento; sem feedback visual de progresso
- **Recommendation:** Usar `<LoadingState>` e `<EmptyState>` do design system (que já incluem spinner e estrutura)
- **Effort:** Low (1h)

#### Recommendations Summary
1. **Prioridade máxima:** Adotar primitivas do `@artificio/ui` em todo o módulo
2. Unificar estilos de tabs (um único padrão)
3. Padronizar variantes de botão via `Button` component
4. Usar `LoadingState`/`EmptyState`/`ErrorState` do design system

---

### 6. Imagery & Graphics ⭐⭐⭐⭐⭐⚪⚪⚪⚪⚪ (5/10)

#### Strengths
- ✅ Ícones do `lucide-react` usados em `DiscordSettingsPanel` (Save, Loader2, ShieldCheck, AlertTriangle, Trash2, X) — biblioteca consistente com o resto do mesas
- ✅ Thumbnails de capa com `object-cover` e `rounded-md` nos cards de draft
- ✅ Preview de capa com proporção landscape (`h-24 w-40`) no editor de draft

#### Issues

**Issue 6.1: Ícones ausentes na maioria dos componentes**
- **Severity:** Medium
- **Location:** DiscordSyncPanel, DiscordSourceList, DiscordDraftReviewTable, DiscordJsonImportPanel, DraftEditorTab
- **Problem:** Apenas `DiscordSettingsPanel` usa ícones. Os outros 7 componentes usam texto puro ("Recarregar", "+ Adicionar canal", "✦ Criar Draft", "X", "Remover")
- **Impact:** Aparência textual e menos profissional; ícones auxiliam no escaneamento rápido
- **Recommendation:** Adicionar ícones lucide-react em botões de ação (RefreshCw, Plus, Wand2, X, Trash2, Upload, FileJson)
- **Effort:** Medium (2-3h)

**Issue 6.2: Fallback de capa sem placeholder visual**
- **Severity:** Low
- **Location:** `DiscordDraftReviewTable.tsx:160-165` e `DraftEditorTab.tsx:48-52`
- **Problem:** Quando não há capa, mostra `<div className="h-full w-full bg-white/5" />` ou "Sem capa" em texto — sem ícone de placeholder
- **Impact:** Aparência de estado quebrado/vazio
- **Recommendation:** Usar ícone `ImageIcon` do lucide-react como placeholder
- **Effort:** Low (15min)

**Issue 6.3: Botão de fechar do modal é texto "X" em vez de ícone**
- **Severity:** Low
- **Location:** `DiscordDraftPreview.tsx:42-44`
- **Problem:** `<button onClick={onClose}>X</button>` usa caractere literal em vez de `<X size={18} />` do lucide-react
- **Impact:** Inconsistência com `DiscordSettingsPanel` que usa `<X size={16} />` do lucide-react
- **Recommendation:** Trocar para `<X size={20} />` do lucide-react
- **Effort:** Trivial (2min)

#### Recommendations Summary
1. Adicionar ícones lucide-react em todos os botões de ação
2. Placeholder de capa com ImageIcon
3. Fechar modal com ícone X do lucide-react

---

### 7. Layout & Grid ⭐⭐⭐⭐⭐⭐⚪⚪⚪⚪ (6/10)

#### Strengths
- ✅ Grid de 2 colunas (`grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]`) bem calibrado para lista + detalhes
- ✅ Painel de detalhes com `lg:sticky lg:top-4` — acompanha o scroll
- ✅ Grid responsivo de cards de estatísticas (`grid-cols-2 lg:grid-cols-4`)
- ✅ Flex-wrap bem usado para filtros e ações

#### Issues

**Issue 7.1: Layout de formulário no DraftEditor não usa grid responsivo otimizado**
- **Severity:** Low
- **Location:** `DraftEditorTab.tsx:95-184`
- **Problem:** Grid `grid-cols-1 md:grid-cols-2` coloca campos em 2 colunas, mas a ordem não é ótima — campos relacionados (Dia + Horário, Preço + Valor) ficam em colunas diferentes
- **Impact:** Leve fricção de preenchimento
- **Recommendation:** Agrupar campos relacionados lado a lado (Dia|Horário, Preço|Valor, Vagas total|Vagas abertas) e usar `md:col-span-2` para campos longos
- **Effort:** Low (15min — só reordenar elementos)

**Issue 7.2: Barra de filtros das mensagens sem wrap otimizado**
- **Severity:** Low
- **Location:** `DiscordSyncPanel.tsx:306-349`
- **Problem:** `flex flex-wrap items-center gap-3` funciona, mas em telas menores os filtros se empilham de forma desordenada
- **Impact:** UX degradada em viewports estreitos
- **Recommendation:** Agrupar filtros e ações em um `<Toolbar>` do design system ou usar grid com `grid-cols-[auto_auto_auto_1fr_auto]`
- **Effort:** Low (30min)

#### Recommendations Summary
1. Reordenar campos do formulário de draft para agrupar relacionados
2. Melhorar wrap dos filtros em telas menores
3. Considerar Toolbar do design system para barras de ação

---

### 8. Component Design ⭐⭐⚪⚪⚪⚪⚪⚪⚪⚪ (2/10)

#### Strengths
- ✅ `app-select` customizado com foco laranja (único lugar onde a marca aparece na UI)
- ✅ `textarea` de conteúdo com `resize-y` para ajuste de altura
- ✅ File input com drag-and-drop + fallback de clique

#### Issues

**Issue 8.1: Botões sem estados interativos visuais**
- **Severity:** Critical
- **Location:** Todos os componentes
- **Problem:** Botões usam apenas `transition-colors` + troca de bg no hover. Faltam:
  - Estado `:focus-visible` (apenas `app-select` tem)
  - Estado `:active` (pressionado)
  - Animação de feedback (escala, elevação)
  - Estado `:disabled` é só `opacity-40/50` sem cursor change (alguns têm `disabled:opacity`, outros não)
- **Impact:** Baixa affordance; usuário não sabe se o clique foi registrado; aparência de protótipo
- **Recommendation:** Adotar `<Button>` do design system que já tem todos os estados. Ou no mínimo adicionar `focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E64A19]` e `active:scale-[0.98]`
- **Effort:** Low (se usar `<Button>`) / Medium (se manter custom)

**Issue 8.2: Inputs e selects sem componente Field (label + hint + error integrados)**
- **Severity:** High
- **Location:** DraftEditorTab, DiscordSettingsPanel, DiscordSourceList
- **Problem:** Cada input/select tem seu `<label>` escrito manualmente com classes diferentes. DiscordSettingsPanel usa `<label className="block text-sm font-medium text-white/80" htmlFor="...">`; DraftEditorTab usa `<span className={labelClass}>` (sem `htmlFor`!). Não há tratamento de erro inline
- **Impact:** Inconsistência de labels; falta de acessibilidade (sem `htmlFor` em DraftEditorTab)
- **Recommendation:** Usar `<Field label="Título" hint="Nome da mesa"> <TextInput .../> </Field>` do design system
- **Effort:** Medium (2-3h)

**Issue 8.3: Modal do DraftPreview implementado do zero**
- **Severity:** High
- **Location:** `DiscordDraftPreview.tsx:35-144`
- **Problem:** O modal de preview de draft é um `<div className="fixed inset-0 z-50...">` com backdrop manual. Não usa `<Modal>` ou `<Drawer>` do design system. Faltam:
  - Fechar com Escape (o design system tem `useEscapeClose`)
  - Foco aprisionado (trap focus)
  - `aria-modal`, `aria-labelledby`, `role="dialog"`
  - Prevenção de scroll do body
- **Impact:** Acessibilidade prejudicada; comportamento inconsistente com outros modais da suite
- **Recommendation:** Migrar para `<Modal open={!!selectedDraft} title="Draft de mesa" onClose={...}>` com o conteúdo interno
- **Effort:** Medium (2-3h)

**Issue 8.4: Select sem tratamento de option vazio**
- **Severity:** Low
- **Location:** `DiscordSourceList.tsx:223` (select de servidor)
- **Problem:** `<option className="bg-white text-slate-900" value="">` — o `className` em `<option>` não funciona consistentemente em todos os browsers
- **Impact:** Estilização de options quebrada em alguns navegadores
- **Recommendation:** Remover classes de `<option>` e confiar no `select option` do `index.css` (`background: #ffffff; color: #0f172a;`)
- **Effort:** Trivial (5min)

**Issue 8.5: Botão de confirmação de deleção sem delay de segurança**
- **Severity:** Low
- **Location:** `DiscordSourceList.tsx:383-399`
- **Problem:** O padrão "confirmar? Sim / Não" aparece inline, o que é bom, mas o botão "Sim" não tem delay ou contagem regressiva
- **Impact:** Deleção acidental possível com clique duplo
- **Recommendation:** OK para ferramenta admin; manter como está, mas considerar countdown de 2s no botão "Sim"
- **Effort:** Low (30min)

#### Recommendations Summary
1. Adotar `<Button>` com todos os estados interativos
2. Usar `<Field>` + `<TextInput>`/`<Textarea>`/`<Select>` para formulários
3. Migrar modal custom para `<Modal>` do design system
4. Remover classes de `<option>`

---

### 9. Branding & Personality ⭐⭐⭐⚪⚪⚪⚪⚪⚪⚪ (3/10)

#### Strengths
- ✅ Nome "Covil do Lich" no título (personalidade RPG)
- ✅ Emoji 🏰 usado em `GestaoPage.tsx:654` para "Covil do Lich" (personalidade)
- ✅ Termo "Apurar" consistente com o domínio (mesa de RPG)

#### Issues

**Issue 9.1: Cor de marca laranja completamente ausente**
- **Severity:** Critical
- **Location:** Todo o Discord Sync
- **Problem:** `#FF5722` (D064) não aparece em nenhum componente do Discord Sync. A cor de acento é `blue-600` (genérico)
- **Impact:** Zero reconhecimento de marca; parece um produto diferente do resto da suite Artifício
- **Recommendation:** Substituir todos os acentos azuis por laranja de marca
- **Effort:** Medium (parte do Issue 3.1)

**Issue 9.2: Sem uso da tipografia display (Oswald) — zero personalidade tipográfica**
- **Severity:** Medium
- **Location:** Todo o Discord Sync
- **Problem:** A fonte display `Oswald` (condensada, bold, usada no wordmark e headings da marca) não é usada em nenhum título
- **Impact:** Tipografia genérica; não evoca a identidade RPG da marca
- **Recommendation:** Aplicar `font-display` no título "Discord Sync — Covil do Lich" e headers de seção
- **Effort:** Low (15min)

**Issue 9.3: Nenhum elemento decorativo ou de atmosfera**
- **Severity:** Low
- **Location:** Todo o Discord Sync
- **Problem:** A UI é puramente funcional — cards, botões, textos. Nenhum elemento visual que evoque RPG, fantasia ou a atmosfera do Artifício (glows laranja, texturas sutis, ornamentos)
- **Impact:** Experiência fria; não diferencia de um dashboard CRUD genérico
- **Recommendation:** Adicionar `orange-glow` sutil no fundo (já existe em `index.css`), ou gradiente `from-[#0F1A2E] via-[#1B2A4A] to-[#0F1A2E]` como no GestaoPage
- **Effort:** Low (1h)

#### Recommendations Summary
1. Laranja de marca em todo acento de UI
2. Fonte display Oswald em títulos
3. Gradiente de fundo ou glow decorativo sutil

---

### 10. Modern Design Standards ⭐⭐⭐⭐⭐⭐⭐⭐⭐⚪ (9/10)

#### Strengths
- ✅ Tailwind utilitário — abordagem moderna e eficiente
- ✅ Design responsivo com breakpoints `md:` e `lg:`
- ✅ Drag-and-drop de arquivo (DiscordJsonImportPanel)
- ✅ Feedback em tempo real com debounce de preview (400ms)
- ✅ `backdrop-blur-sm` no modal
- ✅ `sticky` positioning para painel de detalhes
- ✅ `useReducer` para gerenciamento de estado complexo (useDraftForm)
- ✅ Sem pendências de padrões obsoletos (sem jQuery, sem tabelas para layout, sem GIFs animados)

#### Issues

**Issue 10.1: Falta de micro-interações**
- **Severity:** Low
- **Location:** Todos os componentes
- **Problem:** Transições são apenas `transition-colors`. Faltam micro-interações que elevam a percepção de qualidade: scale no clique, skeleton loaders, animações de entrada/saída
- **Impact:** Parece funcional mas "plástico"
- **Recommendation:** Adicionar `active:scale-[0.98]` em botões, `animate-fadeIn` em cards, skeleton em loading
- **Effort:** Low (1-2h com Tailwind)

**Issue 10.2: Sem skeleton/loading states**
- **Severity:** Low
- **Location:** Todos os componentes com loading
- **Problem:** Loading é sempre `<p>Carregando...</p>` — sem shimmer, skeleton ou spinner
- **Impact:** Percepção de performance pior que a real
- **Recommendation:** Usar `LoadingState` do design system ou adicionar animação `animate-pulse` em placeholders
- **Effort:** Low (1h)

#### Recommendations Summary
1. Adicionar micro-interações (scale, fade)
2. Skeleton loaders em vez de texto "Carregando..."
3. Animações de transição entre tabs

---

## Component Audit

### Buttons
**Status:** ❌ Problematic  
**Issues:** Sem componente compartilhado; 4-5 variações de padding diferentes; sem estados focus/active; azul em vez de laranja  
**Recommendation:** Migrar para `<Button variant="primary|secondary|danger">` do `@artificio/ui`

### Forms (Inputs / Selects / Textareas)
**Status:** ❌ Problematic  
**Issues:** Sem `Field` wrapper; labels inconsistentes; sem `htmlFor` em alguns lugares; sem mensagens de erro inline  
**Recommendation:** Migrar para `<Field>` + `<TextInput>`/`<Select>`/`<Textarea>`

### Status Badges
**Status:** ⚠️ Needs improvement  
**Issues:** Mapeamento de cores duplicado em 2 arquivos; cores Tailwind inline em vez de tokens semânticos  
**Recommendation:** Extrair para `constants.ts` + migrar para `<Badge variant="...">`

### Cards
**Status:** ✅ Good  
**Strengths:** Consistente (`bg-white/5 border border-white/10 rounded-lg`); padding adequado; hover sutil  
**Minor:** Poderia usar `<Panel>` para header/body/footer estruturados

### Modal
**Status:** ❌ Problematic  
**Issues:** Implementado do zero sem acessibilidade (sem Escape, sem trap focus, sem aria-modal)  
**Recommendation:** Migrar para `<Modal>` do design system

### Tables (lista de drafts/mensagens)
**Status:** ⚠️ Needs improvement  
**Strengths:** Layout de card-list funcional; thumbnails  
**Issues:** Sem cabeçalho de coluna em tela larga; ordenação não aparente  
**Note:** Card-list é aceitável para admin tool; tabela seria overkill

### Loading States
**Status:** ❌ Problematic  
**Issues:** Texto puro "Carregando..." sem spinner  
**Recommendation:** `<LoadingState>` ou ao menos um spinner CSS

### Empty States
**Status:** ❌ Problematic  
**Issues:** Texto puro "Nenhum X encontrado." sem ação sugerida  
**Recommendation:** `<EmptyState message="..." action={<Button>Adicionar</Button>}>`

### Error States
**Status:** ⚠️ Needs improvement  
**Issues:** Toast notifications via `react-hot-toast` (bom), mas inline errors são inconsistentes (banner amarelo em um lugar, texto vermelho em outro)  
**Recommendation:** Usar `<Banner variant="danger">` para erros inline

---

## Design System Assessment

**Overall Score:** 0/10 (No adoption)

### What the Design System Provides (`@artificio/ui`)
- ✅ `Button` (primary/secondary/ghost/danger/success, sizes sm/md/lg/icon, loading state)
- ✅ `Badge` (neutral/brand/success/warning/danger/info)
- ✅ `Banner` (success/warning/danger/info/neutral, with icon)
- ✅ `Field` (label + hint + error + required)
- ✅ `TextInput`, `Textarea`, `Select` (with invalid state, control sizes)
- ✅ `Panel` (default/subtle/elevated/danger/warning, with header/actions/footer)
- ✅ `Modal` (with Escape close, backdrop, aria, title, description, footer)
- ✅ `Drawer` (right/left/bottom, same a11y features as Modal)
- ✅ `Toolbar` (leading/content/trailing)
- ✅ `LoadingState`, `EmptyState`, `ErrorState`, `SuccessState`
- ✅ Design tokens: `--artificio-brand: #FF5722`, `--artificio-ink: #020740`, `--fg`, `--surface`, `--line`, `--fill`
- ✅ Semantic state tokens: `--state-success-*`, `--state-warning-*`, etc.
- ✅ Theme system: `useTheme()`, `ThemeToggle`, `applyTheme()`, `data-theme`
- ✅ Typography: `--artificio-font-display` (Oswald), `--artificio-font-sans` (Inter)
- ✅ CSS variables for light/dark mode

### What Discord Sync Uses
- ❌ Zero imports from `@artificio/ui`
- ❌ Raw `<button>` with Tailwind classes instead of `<Button>`
- ❌ Raw `<input>` / `<textarea>` / `<select>` instead of `<TextInput>` / `<Textarea>` / `<Select>`
- ❌ Manual `<label>` instead of `<Field>`
- ❌ Custom modal div instead of `<Modal>`
- ❌ Text "Carregando..." instead of `<LoadingState>`
- ❌ Text "Nenhum X encontrado." instead of `<EmptyState>`
- ❌ `blue-600` instead of `--artificio-brand` (#FF5722)
- ❌ `text-white`/`bg-white/N` instead of `--fg`/`--surface`/`--fill`
- ❌ Hardcoded hexes (`#0F1A2E`, `#1B2A4A`) instead of `--artificio-dark-*` tokens

### Assessment
O design system existe, é completo e é usado por outros apps da suite (site, glossário, links). O módulo Discord Sync simplesmente não o adota. É um caso de "construído rápido, não integrado".

---

## Prioritized Recommendations

### Phase 1: Quick Wins (2-3h, Alto ROI visual)

| # | Ação | Impacto | Esforço |
|---|------|---------|---------|
| 1 | Trocar `blue-600` → `var(--artificio-brand)` em todos os acentos (tabs, botões primários, links) | ★★★★★ | 1h |
| 2 | Adicionar ícones lucide-react em todos os botões de ação | ★★★★☆ | 1h |
| 3 | Trocar "X" texto por `<X size={20} />` no modal | ★☆☆☆☆ | 5min |
| 4 | Adicionar `focus-visible:outline` laranja em botões e inputs | ★★★☆☆ | 30min |
| 5 | Aplicar `font-display` no título "Discord Sync — Covil do Lich" | ★★☆☆☆ | 10min |

### Phase 2: Design System Adoption (3-5 dias)

| # | Ação | Impacto | Esforço |
|---|------|---------|---------|
| 6 | Migrar todos os `<button>` para `<Button variant="...">` | ★★★★★ | 4h |
| 7 | Migrar formulários para `<Field>` + `<TextInput>`/`<Select>`/`<Textarea>` | ★★★★★ | 3h |
| 8 | Migrar modal de draft para `<Modal>` | ★★★★☆ | 2h |
| 9 | Migrar badges de status para `<Badge variant="...">` | ★★★★☆ | 1h |
| 10 | Migrar loading/empty states para `<LoadingState>` / `<EmptyState>` | ★★★☆☆ | 1h |
| 11 | Usar tokens `--state-*` para cores de status | ★★★☆☆ | 1h |
| 12 | Extrair status labels/colors para `constants.ts` (single source) | ★★★☆☆ | 30min |

### Phase 3: Polish (2-3 dias)

| # | Ação | Impacto | Esforço |
|---|------|---------|---------|
| 13 | Adicionar micro-interações (active:scale, fadeIn) | ★★★☆☆ | 2h |
| 14 | Skeleton loaders no lugar de "Carregando..." | ★★★☆☆ | 2h |
| 15 | Aumentar `text-xs` → `text-sm` em toda UI funcional | ★★★★☆ | 3h |
| 16 | Padronizar padding de botões (sm/md/lg) | ★★★☆☆ | 1h |
| 17 | Adicionar gradiente de fundo ou orange glow sutil | ★★☆☆☆ | 1h |

---

## Design Quality Checklist

### Typography ✓
- [ ] Body text 14px+ para UI funcional
- [ ] Fonte display (Oswald) em títulos de seção
- [ ] Line-height ≥ 1.5 em áreas de texto multilinha
- [ ] Max 2 typefaces (Inter + Oswald = ✅)
- [ ] Font weights intencionais

### Color ✓
- [ ] Laranja de marca `#FF5722` presente na UI
- [ ] Acentos usam brand, não azul genérico
- [ ] Status colors consolidados em tokens semânticos
- [ ] Contraste AA verificado em light e dark

### Spacing ✓
- [ ] Padding de botões padronizado (sm/md/lg)
- [ ] Espaçamento entre cards ≥ 12px
- [ ] Sem valores arbitrários de spacing

### Components ✓
- [ ] `<Button>` do design system em uso
- [ ] `<Field>` + inputs do design system em formulários
- [ ] `<Modal>` para overlays
- [ ] `<Badge>` para status
- [ ] `<LoadingState>` / `<EmptyState>` para estados

### Consistency ✓
- [ ] Mesmas ações = mesma aparência
- [ ] Um único estilo de tab navigation
- [ ] Ícones do lucide-react em todos os botões
- [ ] Cores de status em fonte única

---

## Accessibility-Visual Overlap

### Color Contrast
- ✅ `text-white` sobre `bg-[#1B2A4A]` = ~12:1 (AAA)
- ✅ `text-green-300` sobre `bg-green-700/40` ≈ ~6:1 no dark (AA)
- ⚠️ `text-white/40` sobre `bg-white/5` ≈ ~2:1 (falha AA) — usado para texto secundário e placeholders
- ⚠️ Se migrar para laranja: `#FF5722` sobre `#020740` ≈ ~5.5:1 (AA) ✅; sobre `#FFFFFF` ≈ ~3.8:1 (falha AA) ❌ → laranja não pode ser texto de corpo sobre branco

### Typography Readability
- ❌ `text-xs` (12px) usado como tamanho principal de UI — abaixo do mínimo de 14px
- ✅ `text-sm` (14px) usado para conteúdo em textarea — aceitável

### Touch Targets
- ⚠️ Botões com `px-2 py-1` = ~28px altura — abaixo do mínimo de 44px (WCAG 2.5.5)
- ✅ Botões com `px-3 py-2` = ~36px — próximo do recomendado
- ✅ Links "Ver no Discord" e selects — adequados

### Visual Indicators
- ✅ Status usa cor + texto (badge com label)
- ✅ Links têm cor diferenciada (`text-blue-400`)
- ⚠️ Campos obrigatórios não marcados com asterisco ou indicador visual

---

## Methodology Notes

- **Evaluation Method:** Expert visual design review (código-fonte)
- **Standards:** Design system `@artificio/ui` como referência canônica; tokens em `packages/ui/src/tokens.ts`; decisões D038/D040/D064/D066/D067
- **Focus:** Consistência com o design system, adoção de primitivas, identidade de marca
- **Limitations:** Revisão por código (sem screenshots/browser); análise estática; sem teste com usuários
- **Complement with:** Teste visual no browser (light + dark), auditoria Nielsen, smoke de tema cross-subdomínio

---

**Version:** 1.0  
**Date:** 2026-06-23  
**Status:** Final — pronto para revisão do mantenedor
