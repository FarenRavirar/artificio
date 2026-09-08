# UX Audit and Rethink Report — Discord Sync (Gestão Mesas)

**Product:** Artifício RPG — Gestão Administrativa / Discord Sync ("Covil do Lich")  
**Date:** 2026-06-23  
**Auditor:** AI Agent (ux-audit-rethink skill)  
**Methodology:** IxDF UX Framework (7 Factors + 5 Usability Characteristics + 5 Interaction Dimensions)  
**Scope:** `apps/mesas/frontend/src/features/discord-sync/` + `GestaoPage.tsx`  
**Target users:** Admin do Artifício RPG (1-2 pessoas, mantenedor), usuário técnico, power user.  
**App description:** Painel de gestão que importa mensagens de canais/fóruns do Discord e as transforma em rascunhos (drafts) de mesas RPG, que depois são revisados, editados e sincronizados como mesas reais no sistema.

---

## Executive Summary

### Overall UX Health Score: 53/85 (C− Grade)

O Discord Sync é **funcionalmente completo e cumpre seu propósito** (útil, valioso), mas a experiência de uso sofre com **navegação fragmentada, feedback pobre, ausência de proteção contra erros e curva de aprendizado íngreme**. O fluxo é conceitualmente linear (configurar → fontes → mensagens → drafts), mas a implementação força o usuário a pular entre 5 abas desconexas sem guia visual sobre o progresso ou o próximo passo.

**Key Findings:**
- O fluxo linear implícito não é comunicado — o usuário descobre por tentativa e erro
- Ações destrutivas têm proteção inconsistente (umas têm `confirm()`, outras não)
- O editor de draft é um modal de tela cheia com 17+ campos — cognitivamente pesado
- A aba "Mensagens" combina filtro + lista + painel de detalhe + ações num layout denso
- Não há breadcrumbs, indicador de progresso, ou atalhos entre abas

**Critical Priorities:**
1. **Wizard/stepper** para guiar o fluxo linear config→fontes→mensagens→drafts
2. **Proteção contra perda de dados** no editor de draft (dirty state sem confirmação ao fechar)
3. **Simplificar o layout Mensagens** (split view atual é bom mas denso demais)
4. **Indicador visual de progresso** entre abas (quantos pendentes em cada etapa)
5. **Consistência de confirmação** para ações destrutivas

---

## 1. UX Factors Assessment (7 Factors)

### Factor Scores

| Factor | Score | Status | Priority |
|--------|-------|--------|----------|
| Useful | 5/5 | ✅ Excellent | None |
| Usable | 2/5 | ❌ Poor | Critical |
| Findable | 2/5 | ❌ Poor | High |
| Credible | 3/5 | ⚠️ Needs work | Medium |
| Desirable | 3/5 | ⚠️ Needs work | Medium |
| Accessible | 2/5 | ❌ Poor | High |
| Valuable | 5/5 | ✅ Excellent | None |

**Total**: 22/35 (63%)

---

### 1. Useful — ⭐⭐⭐⭐⭐ (5/5) — Excellent

**Does it solve real user problems?**

Sim. O fluxo resolve um problema real e complexo: transformar anúncios de mesa postados em canais do Discord em registros estruturados no sistema, sem digitação manual. O pipeline de ingest → parse → draft → review → sync é o caminho correto para este domínio.

**Strengths:**
- Automação de parsing de mensagens Discord para drafts estruturados (título, sistema, vagas, etc.)
- Suporte a múltiplas fontes (canais texto, fórum) e múltiplos formatos de importação (API Discord bot + DiscordChatExporter JSON)
- Diagnóstico de mensagens sem corpo (Message Content Intent ausente)
- Reidratação forçada para corrigir importações incorretas
- Parse em lote para processar múltiplas mensagens pendentes de uma vez

**Gaps:**
- Nenhum. O conjunto de features cobre exatamente o que o admin precisa.

**Evidence:** O código cobre edge cases reais (mensagens sem corpo da API Discord, ambiguidade de vagas X/Y, fóruns com threads, reingestão). O fluxo de trabalho do mantenedor está modelado corretamente.

---

### 2. Usable — ⭐⭐⚪⚪⚪ (2/5) — Poor

**Is it easy to use and navigate?**

Não. Embora cada componente individual funcione, a experiência de junção é fragmentada e desorientadora.

**Critical Issues:**

1. **Fluxo linear não sinalizado.** O usuário precisa saber que deve: (a) configurar token → (b) adicionar fonte → (c) buscar mensagens → (d) revisar → (e) parsear → (f) ir para drafts → (g) revisar draft → (h) sync. Mas as 5 abas são apresentadas como iguais, sem hierarquia ou sequência.

2. **Salto contextual entre abas sem volta.** Quando o usuário clica "Buscar mensagens" numa fonte (aba Fontes), é jogado automaticamente para a aba Mensagens (`setTab('mensagens')` na linha 166 de `DiscordSyncPanel.tsx`). Não há botão "Voltar para Fontes" na aba Mensagens. O mesmo ocorre com "Ver drafts" após importar JSON.

3. **Densidade cognitiva na aba Mensagens.** O layout combina 3 dropdowns de filtro + 2 botões de ação + 4 cards de estatísticas + lista de mensagens + painel de detalhe com 5+ botões de ação + textarea de conteúdo + diagnóstico. Tudo numa única tela. A `grid-cols-[minmax(0,1fr)_400px]` ajuda, mas ainda é excessivo.

4. **Editor de draft é um modal massivo.** `DiscordDraftPreview` renderiza um modal fixo com: header + barra de status editável + 3 sub-abas internas + editor de 17 campos + JSON raw + botões de ação. A altura `max-h-[90vh]` força scroll interno em telas menores.

5. **Nomes de ações crípticos.** "Apurar todas pendentes" (com prefixo ✦), "Reidratar" (↺), "Reparsar", "Desambiguar vagas" — terminologia de domínio que faz sentido para o mantenedor mas não é autoexplicativa.

6. **Inconsistência de padrão de confirmação.** `handleReingestForce` usa `window.confirm()`. `handleSyncReady` usa `window.confirm()`. `handleToggleEnabled` não pede confirmação. `handleDelete` (fonte) pede `confirmDeleteId` com dois cliques. `handleDeleteTable` (mesa) usa componente `InlineDeleteConfirmation`. Não há padrão unificado.

---

### 3. Findable — ⭐⭐⚪⚪⚪ (2/5) — Poor

**Can users easily locate content and features?**

Não. A área de gestão sofre de aninhamento excessivo de navegação.

**Issues:**

1. **Duas camadas de tabs.** `GestaoPage` tem 7 abas de topo (Gerenciar Conteúdo, Sugestões, Atividades, Hidratação, Discord Sync, Inbox, Desenvolvimento). A aba "Gerenciar Conteúdo" tem 4 sub-abas. O Discord Sync tem 5 sub-abas próprias. Total: 3 níveis de navegação para chegar a uma ação específica.

2. **Scroll overflow nas tabs do GestaoPage.** Com 7 abas horizontais em `flex gap-3`, em telas menores as abas vazam para fora da viewport sem indicador visual de overflow.

3. **Nomes não intuitivos.** "Hidratação de Dados" é jargão técnico. "Covil do Lich" (título interno do DiscordSyncPanel) não comunica função.

4. **Sem busca global.** Não há como buscar uma mensagem específica por ID, autor ou conteúdo dentro do Discord Sync. O filtro por status/fonte/janela ajuda, mas é limitado.

5. **Sem indicador de "onde estou".** As abas do `DiscordSyncPanel` usam `bg-blue-600` para a ativa, mas as do `GestaoPage` usam `border-b-2 border-blue-500`. Inconsistência visual entre níveis de navegação.

---

### 4. Credible — ⭐⭐⭐⚪⚪ (3/5) — Needs Work

**Does it inspire trust and confidence?**

Parcialmente. O sistema é funcionalmente correto (validações Zod no backend, schemas tipados), mas a UI não transmite essa segurança.

**Issues:**

1. **Mensagens de erro genéricas.** `toast.error(err.message)` expõe mensagens técnicas do backend para o usuário (ex.: "Resposta de importação em formato inesperado").

2. **Sem indicador de "salvo com sucesso" visual persistente.** O toast some após alguns segundos. Se o usuário piscou, perdeu. O draft editor tem `dirty` state mas não mostra indicador visual claro de "alterações não salvas" além do tooltip no botão Sync.

3. **Preview de JSON sem validação progressiva.** Na aba "Importar JSON", o debounce de 400ms faz preview, mas não há indicador de "JSON inválido" além da mensagem de erro genérica após o fetch.

4. **Sem confirmação visual de sync.** Após sincronizar um draft, o modal não fecha automaticamente — o usuário precisa clicar no X manualmente. Isso gera dúvida: "Será que funcionou?"

---

### 5. Desirable — ⭐⭐⭐⚪⚪ (3/5) — Needs Work

**Is it aesthetically appealing and emotionally engaging?**

Aceitável para uma ferramenta interna. Usa o design system do Artifício (fundo escuro `#1B2A4A`, cards `bg-white/5`, bordas sutis). Mas carece de polimento.

**Issues:**

1. **Estética utilitária sem hierarquia visual clara.** Tudo é `bg-white/5 border border-white/10 rounded-lg`. Cartões de estatísticas, lista de mensagens, painel de detalhe, preview — visualmente indistinguíveis.

2. **Ícones ausentes na maioria das ações.** Só o `DiscordSettingsPanel` usa ícones Lucide (`ShieldCheck`, `AlertTriangle`, `Save`, `Trash2`, `Loader2`, `X`). Os outros componentes usam texto puro ou caracteres Unicode (✦, ↺).

3. **Badges de status com contraste baixo.** `bg-yellow-700/40 text-yellow-300` em fundo escuro — a 40% de opacidade no fundo reduz a distinção entre badges.

4. **Cores inconsistentes para ações.** "Importar" é verde (`bg-green-700`), "Selecionar arquivo" é azul (`bg-blue-700`), "Salvar token" é azul (`bg-blue-600`), "Criar Draft" é verde (`bg-green-700`). Verde é usado tanto para "ação primária de criação" quanto para "ação positiva/destrutiva".

5. **Scrollbars padrão do browser** quebrando a estética dark.

---

### 6. Accessible — ⭐⭐⚪⚪⚪ (2/5) — Poor

**Is it inclusive for all users?**

Não. Acessibilidade não foi considerada no design atual.

**Issues:**

1. **Navegação por teclado incompleta.** Tabs são `<button>`, mas não seguem padrão WAI-ARIA para tablist (`role="tablist"`, `role="tab"`, `aria-selected`, setas para navegar).

2. **Sem `aria-label` na maioria dos botões.** Exceções: `DiscordJsonImportPanel` tem `aria-label` no textarea e no file input. `DiscordSourceList` tem `aria-label` no select de janela. O resto não.

3. **Modal sem trap de foco.** `DiscordDraftPreview` é um modal fixo (`fixed inset-0 z-50`) mas não implementa trap de foco, `aria-modal`, nem `role="dialog"`. Foco não é restaurado ao fechar.

4. **Contraste de texto baixo.** `text-white/40`, `text-white/30` em fundo `#1B2A4A` pode não atingir contraste mínimo WCAG AA (4.5:1 para texto normal).

5. **Sem suporte a redimensionamento de texto.** Layouts com `max-h-[68vh]`, `max-h-[90vh]`, `w-[400px]` fixos quebram com zoom de texto.

6. **Sem labels visíveis em todos os inputs.** Vários `<select>` e `<input>` não têm `<label>` associado (usam `aria-label` ou placeholder como único rótulo). Ex.: selects de filtro na aba Mensagens (linhas 307-335 de `DiscordSyncPanel.tsx`).

---

### 7. Valuable — ⭐⭐⭐⭐⭐ (5/5) — Excellent

**Does it deliver value to users and business?**

Sim. Para o mantenedor (único admin), esta ferramenta economiza dezenas de minutos por dia ao automatizar a transcrição de anúncios do Discord para o sistema de mesas. O ROI é direto e mensurável.

**User Value:** Automação de tarefa manual repetitiva (copiar/colar campos de anúncio do Discord).  
**Business Value:** Mesas publicadas mais rápido → mais conteúdo fresco no site → melhor SEO e engajamento.

---

## 2. Usability Characteristics Assessment

### Usability Scores

| Characteristic | Score | Status | Impact |
|---------------|-------|--------|--------|
| Effectiveness | 4/5 | ✅ Good | High |
| Efficiency | 2/5 | ❌ Poor | Critical |
| Engagement | 3/5 | ⚠️ Needs work | Medium |
| Error Tolerance | 2/5 | ❌ Poor | Critical |
| Ease of Learning | 2/5 | ❌ Poor | High |

**Total**: 13/25 (52%)

---

### 1. Effectiveness — ⭐⭐⭐⭐⚪ (4/5) — Good

O usuário **consegue** completar as tarefas. O pipeline funciona: token → fonte → fetch → parse → draft → sync produz mesas reais. Smoke tests da spec 047 comprovam o fluxo ponta a ponta (import único, múltiplo, edição+sync, rejeição).

**Gap:** Tarefas são completadas apesar da interface, não por causa dela. O usuário experiente desenvolve memória muscular para o fluxo, mas um novato erraria o caminho.

---

### 2. Efficiency — ⭐⭐⚪⚪⚪ (2/5) — Poor

**Muitos cliques para tarefas comuns.**

**Fluxo típico (contagem de cliques):**

| Passo | Ação | Cliques |
|-------|------|---------|
| 1 | Abrir Gestão → clicar "Discord Sync" | 1 |
| 2 | Ir para aba "Fontes" | 1 |
| 3 | Clicar "+" → selecionar servidor → canal → Salvar | 4 |
| 4 | Selecionar janela de tempo → "Buscar mensagens" | 2 |
| 5 | (Automático: vai para Mensagens) | 0 |
| 6 | Clicar mensagem na lista → "Criar Draft" | 2 |
| 7 | (Repetir passo 6 para cada mensagem OU "Apurar todas pendentes") | 1-20 |
| 8 | Ir para aba "Drafts" | 1 |
| 9 | Clicar draft → modal abre | 1 |
| 10 | Preencher campos faltantes → "Salvar campos" | N campos + 1 |
| 11 | "Sincronizar como mesa" | 1 |
| 12 | Fechar modal (X) | 1 |

**Total:** ~16 cliques mínimos para 1 mesa. Com parsing em lote (passo 7), ~16 cliques para N mesas.

**Gargalos:**
- Navegação entre abas é manual (exceto o jump automático Fontes→Mensagens)
- Parse individual requer abrir cada mensagem e clicar "Criar Draft"
- Não há atalho de teclado para ações frequentes
- O editor de draft não tem "Salvar + Sync" em um clique

---

### 3. Engagement — ⭐⭐⭐⚪⚪ (3/5) — Needs Work

Ferramenta interna utilitária — não se espera "delight". Mas a experiência é plana, sem feedback visual satisfatório.

**Positivo:** Toasts informativos com dados quantitativos ("+5 mensagens, 2 atualizadas. 3 drafts criados/atualizados.").

**Negativo:** Sem animações de transição entre abas. Sem skeleton loaders (só "Carregando..."). Sem indicador de progresso em operações longas (parse batch pode demorar com muitas mensagens).

---

### 4. Error Tolerance — ⭐⭐⚪⚪⚪ (2/5) — Poor

**Problemas críticos de prevenção e recuperação de erros.**

1. **Modal de draft fecha sem confirmação de dirty state.** Se o usuário editou campos (form sujo) e clica no X do modal, as alterações são **perdidas silenciosamente**. Não há confirmação "Você tem alterações não salvas. Descartar?".

2. **Botão "Sincronizar todos prontos" sem confirmação granular.** O `confirm()` mostra uma string genérica. Não lista quais drafts serão afetados, nem permite revisar antes de confirmar.

3. **Reidratação é destrutiva e irreversível.** `handleReingestForce` apaga todas as mensagens pendentes da fonte e rebusca. O `window.confirm()` é a única proteção. Não há como desfazer.

4. **Deleção de fonte sem verificação de impacto.** Remover uma fonte não avisa quantas mensagens ou drafts serão orfãos.

5. **"Apurar todas pendentes" sem preview.** O usuário não sabe quantas mensagens serão processadas nem pode revisar a lista antes de disparar o batch.

6. **Sem undo para nenhuma operação.** Nenhuma ação tem desfazer. Se o admin mudar o status de uma mensagem por engano, precisa trocar manualmente de volta.

---

### 5. Ease of Learning — ⭐⭐⚪⚪⚪ (2/5) — Poor

**Curva de aprendizado íngreme para novos administradores.**

1. **Sem onboarding ou tour guiado.** O primeiro uso requer conhecimento prévio do fluxo: configurar token → adicionar fonte → buscar → parsear → revisar → sync.

2. **Conceitos não explicados in-context.** O que é "Parsear"? O que é "Apurar"? O que é "Reidratar"? O que significa cada status de mensagem? O tooltip em "Reidratar" (linha 377 de `DiscordSourceList.tsx`) é a única ajuda contextual — e é um atributo `title` HTML nativo, invisível em mobile.

3. **Estados vazios não guiam.** "Nenhuma mensagem encontrada." (linha 373 de `DiscordSyncPanel.tsx`) — não sugere o próximo passo (ex.: "Adicione uma fonte e busque mensagens primeiro").

4. **Terminologia inconsistente.** "Apurar" vs "Parsear" vs "Criar Draft" — todos significam a mesma ação (transformar mensagem em draft) mas usam verbos diferentes em contextos diferentes.

5. **Aba "Importar JSON" é um atalho não documentado.** Não há indicação de quando usar esta aba vs. o fluxo normal via Fontes.

---

## 3. Interaction Design Dimensions

### Dimension Scores

| Dimension | Score | Key Issues |
|-----------|-------|------------|
| Words | 2/5 | Jargão interno, terminologia inconsistente, labels ausentes |
| Visual Representations | 3/5 | Ícones inconsistentes, hierarquia visual plana, badges de status pouco distintos |
| Physical Objects/Space | 3/5 | Desktop-only, sem responsivo mobile, touch targets pequenos em selects |
| Time | 3/5 | Sem progress indicator em operações longas, sem skeleton loaders |
| Behavior | 2/5 | Feedback fraco, sem undo, confirmação inconsistente, modal sem trap de foco |

**Total**: 13/25 (52%)

---

### 1. Words — ⭐⭐⚪⚪⚪ (2/5) — Poor

**Terminologia de domínio sem explicação:**

| Termo | Significado real | Problema |
|-------|-----------------|----------|
| "Covil do Lich" | Discord Sync panel | Nome temático RPG, zero comunicação de função |
| "Apurar" / "Parsear" / "Criar Draft" | Transformar mensagem em rascunho | 3 verbos para a mesma ação |
| "Reidratar" | Apagar e re-importar mensagens | Jargão técnico; tooltip existe mas é HTML `title` |
| "Desambiguar vagas" | Resolver notação "X/Y" de vagas | Termo técnico de NLP |
| "Hidratação de Dados" | Copiar dados de prod para beta | Jargão de infra |
| "Reparsar" | Re-processar parsing do draft | Não é uma palavra real em português |

**Labels de formulário inconsistentes:**
- "Vagas totais" vs "Vagas abertas" no editor de draft — conceitos diferentes mas visualmente idênticos
- "Preço" (label) vs "Valor" (campo) — relação não óbvia (Valor só aparece se Preço = Paga)
- Campos obrigatórios não marcados com asterisco ou indicador visual

**Microcopy de estados vazios não ajuda:**
- "Nenhuma mensagem encontrada." → Deveria ser: "Nenhuma mensagem importada ainda. Vá para Fontes, selecione um canal e clique em 'Buscar mensagens'."
- "Nenhum draft encontrado." → Deveria ser: "Nenhum draft criado ainda. Vá para Mensagens, selecione mensagens pendentes e clique em 'Criar Draft'."

---

### 2. Visual Representations — ⭐⭐⭐⚪⚪ (3/5) — Needs Work

**Hierarquia visual plana.** Todos os cards usam o mesmo tratamento visual (`bg-white/5 border border-white/10 rounded-lg`). Não há distinção visual entre:
- Cartão de estatísticas (deveria ser mais compacto, sem borda)
- Item de lista interativo (deveria ter affordance de clique mais clara)
- Painel de detalhe (deveria ter peso visual maior)
- Área de preview/resultado

**Ícones:**
- `DiscordSettingsPanel` é o único componente que usa ícones Lucide de forma consistente
- `DiscordSyncPanel` usa caracteres Unicode (✦) como ícones — não escala, não tem semântica
- `DiscordSourceList` não usa ícones em botões de ação
- `DiscordDraftPreview` usa "X" literal como botão de fechar (deveria ser `<X>` Lucide ou `×`)

**Badges de status com problemas:** As cores dos badges de status de mensagem e draft são semelhantes mas codificam significados diferentes:
- `pending` mensagem = amarelo; `needs_review` mensagem = laranja; `parsed` = azul
- `draft` = branco/cinza; `ready` = verde; `needs_review` = laranja; `synced` = azul
- Dois status diferentes ("parsed" em mensagem e "synced" em draft) usam azul — confusão possível

**Cores semânticas inconsistentes:**
- Verde = "Importar" (ação), "Salvar" (ação), "Habilitado" (estado), "Sincronizar" (ação)
- Azul = "Configuração" (tab ativa), "Salvar token" (ação), "Criar Draft" (botão)
- Verde e azul competem como "ação primária"

---

### 3. Physical Objects/Space — ⭐⭐⭐⚪⚪ (3/5) — Needs Work

**Contexto:** Ferramenta de desktop apenas (admin interno). Mobile não é requisito atual. Mas há problemas de espaço mesmo em desktop.

**Issues:**

1. **Selects nativos em áreas densas.** Os `<select>` na barra de filtro da aba Mensagens (3 selects lado a lado) têm altura inconsistente com os botões adjacentes.

2. **Touch targets pequenos nos botões de ação.** Botões "Remover", "Sim"/"Não" no `DiscordSourceList` usam `px-2 py-1 text-xs` — resultando em ~24px de altura, abaixo do mínimo recomendado de 44px para touch (não crítico para desktop, mas indicativo de densidade excessiva).

3. **Modal de draft ocupa 90% da viewport.** `max-h-[90vh] max-w-5xl` — em telas 1080p, o modal preenche quase toda a tela, perdendo o contexto do que está atrás. O usuário pode esquecer que está num modal.

4. **Lista de mensagens com scroll interno.** `lg:max-h-[68vh] lg:overflow-y-auto` — dois níveis de scroll (página + lista) é propenso a erros de scroll.

5. **Sem responsividade.** O layout usa `lg:` breakpoints mas não tem fallback para telas menores que 1024px. Os grids quebram.

---

### 4. Time — ⭐⭐⭐⚪⚪ (3/5) — Needs Work

**Feedback temporal inadequado.**

1. **Sem progress indicator em operações demoradas.** `handleParseBatch` (parse em lote) e `handleSyncReady` (sync em lote) podem levar vários segundos. Só mostram "Apurando..." / "Sincronizando..." no botão — sem barra de progresso, sem estimativa, sem indicador de quantos itens foram processados.

2. **Preview de JSON com debounce sem feedback visual claro.** `DiscordJsonImportPanel` faz debounce de 400ms antes de chamar preview. O estado "Analisando JSON..." aparece só após o debounce disparar. Durante a digitação, não há indicador de que o sistema está "esperando o usuário parar de digitar".

3. **Toasts somem rápido.** `react-hot-toast` padrão some em ~3-5 segundos. Informações importantes como "3 drafts criados" podem ser perdidas.

4. **Sem transições entre abas.** A troca de aba no `DiscordSyncPanel` é instantânea (sem animação), causando "salto" visual. O conteúdo some e aparece abruptamente.

5. **"Carregando..." genérico.** `DiscordSyncPanel.tsx:290`, `DiscordDraftReviewTable.tsx:142` e outros — texto "Carregando..." sem skeleton ou spinner animado (exceto `DiscordSettingsPanel` que usa `<Loader2>`).

---

### 5. Behavior — ⭐⭐⚪⚪⚪ (2/5) — Poor

**Interações imprevisíveis e feedback insuficiente.**

1. **Navegação automática sem consentimento.** `handleFetchMessages` (linha 166) faz `setTab('mensagens')` automaticamente. O usuário pode não perceber a troca de contexto e se perder. Não há breadcrumb ou botão "Voltar".

2. **Modal sem confirmação de dirty state ao fechar.** `DiscordDraftPreview` não intercepta o fechamento quando `dirty === true`. Clicar X, clicar fora, ou pressionar Esc **descarta alterações silenciosamente**.

3. **Comportamento de duplo-clique em ações.** O botão "Remover" no `DiscordSourceList` exige dois cliques (primeiro mostra "Confirmar?", segundo executa). Mas o toggle Habilitado/Desabilitado é instantâneo. Inconsistência.

4. **Botões não desabilitam durante operações dependentes.** Exemplo: durante o parse de uma mensagem, outros botões no painel de detalhe continuam clicáveis (mas a operação deles pode conflitar).

5. **Lista de mensagens não preserva scroll.** Após atualizar status de uma mensagem, `setMessages` substitui o array — o React pode re-renderizar a lista e perder a posição de scroll.

6. **Preview de JSON não preserva estado ao trocar de aba.** Se o usuário faz preview de um JSON, vai para outra aba, e volta — o estado é perdido (o `useState` do `DiscordSyncPanel` não preserva o estado do filho `DiscordJsonImportPanel` porque o componente é desmontado na troca de tab).

---

## 4. Issues Consolidated & Prioritized

### Critical (P0) — Fix Immediately

**P0-1: Perda de dados no editor de draft (dirty state sem confirmação ao fechar)**
- **Frameworks:** Usability (Error Tolerance 2/5), Behavior (2/5)
- **Impact:** Admin perde edições de campos após preencher o formulário e fechar sem querer
- **Effort:** Baixo (~2h) — Adicionar `window.confirm()` ou diálogo customizado no `onClose` quando `dirty === true`
- **File:** `DiscordDraftPreview.tsx:42` — handler do botão X
- **Recommendation:** Interceptar fechamento com confirmação "Você tem alterações não salvas. Descartar?"

**P0-2: Confirmação inconsistente para ações destrutivas**
- **Frameworks:** Usability (Error Tolerance 2/5), Behavior (2/5)
- **Impact:** Risco de perda de dados por clique acidental
- **Effort:** Médio (~4h) — Unificar padrão de confirmação (componente `ConfirmDialog` reutilizável)
- **Files:** `DiscordSyncPanel.tsx:224-225`, `DiscordSourceList.tsx:184-196`, `DiscordDraftReviewTable.tsx:72-73`
- **Recommendation:** Criar `ConfirmDialog` compartilhado com: título, descrição do impacto, botão Cancelar + Confirmar. Usar em todas as ações destrutivas.

**P0-3: Navegação automática entre abas sem aviso**
- **Frameworks:** Usability (Findable 2/5), Behavior (2/5)
- **Impact:** Desorientação do usuário ao ser teleportado para outra aba
- **Effort:** Baixo (~1h) — Adicionar toast informativo + botão "Voltar" na aba destino
- **File:** `DiscordSyncPanel.tsx:166` (`handleFetchMessages`), `DiscordSyncPanel.tsx:539`
- **Recommendation:** Mostrar toast "Mensagens buscadas! Visualize na aba Mensagens." e adicionar botão "← Voltar para Fontes" na aba Mensagens quando `messageSourceFilter` está definido.

### High Priority (P1) — Fix This Sprint

**P1-1: Wizard/stepper visual para guiar o fluxo linear**
- **Frameworks:** Usability (Learnability 2/5, Efficiency 2/5), Visual (3/5)
- **Impact:** Novo admin leva 30+ minutos para entender o fluxo; experiente perde tempo navegando
- **Effort:** Alto (~16h) — Implementar stepper horizontal com 4 passos (Configurar → Fontes → Mensagens → Drafts) + badges de contagem
- **Recommendation:** Stepper no topo do `DiscordSyncPanel` com:
  - Passo 1: ⚙️ Configuração — mostra status do bot (✓ configurado / ⚠ pendente)
  - Passo 2: 📡 Fontes — mostra contagem de fontes ativas
  - Passo 3: 📥 Mensagens — badge com contagem de pendentes
  - Passo 4: 📝 Drafts — badge com contagem de "ready"
  - Passos clicáveis, com indicador visual do passo atual
  - Próximo passo sugerido quando o atual está completo

**P1-2: Consolidar "Apurar"/"Parsear"/"Criar Draft" em terminologia única**
- **Frameworks:** Words (2/5), Learnability (2/5)
- **Impact:** Confusão conceitual para novos usuários
- **Effort:** Baixo (~2h) — Renomear labels e tooltips
- **Recommendation:** Padronizar como **"Gerar rascunho"** em toda a UI:
  - Botão individual: "Gerar rascunho"
  - Botão batch: "Gerar rascunhos de todas pendentes (N)"
  - Toast: "N rascunhos gerados."
  - Aba: "Rascunhos" (já é "Drafts", manter ou traduzir)

**P1-3: Adicionar skeleton loaders e progress indicators**
- **Frameworks:** Time (3/5), Engagement (3/5)
- **Impact:** Percepção de lentidão em operações batch; ansiedade em loads
- **Effort:** Médio (~6h) — Implementar skeletons para listas + progress bar para batch
- **Recommendation:**
  - Skeleton cards para listas de mensagens e drafts (3-4 itens fantasma)
  - Barra de progresso para parse batch: "Processando X de Y mensagens..."
  - Spinner animado em vez de "Carregando..." texto

**P1-4: Acessibilidade básica nos modais e tabs**
- **Frameworks:** Accessible (2/5)
- **Impact:** Ferramenta inutilizável por teclado; não atende WCAG A
- **Effort:** Médio (~8h)
- **Recommendation:**
  - `role="tablist"`, `role="tab"`, `aria-selected` nas abas
  - `role="dialog"`, `aria-modal="true"`, trap de foco no `DiscordDraftPreview`
  - `aria-label` em todos os botões sem texto visível
  - Labels associados a inputs (`htmlFor`/`id`)

### Medium Priority (P2) — Next Release

**P2-1: Melhorar estados vazios com call-to-action**
- Estados vazios devem sugerir o próximo passo
- Ex.: "Nenhuma mensagem encontrada" → "Adicione uma fonte na aba Fontes e busque mensagens."

**P2-2: Preservar estado de componentes filhos ao trocar abas**
- `DiscordSyncPanel` desmonta componentes ao trocar de tab (renderização condicional)
- Alternativa: `display: none` ou `visibility: hidden` para preservar estado

**P2-3: Adicionar ícones consistentes em todos os botões de ação**
- Usar Lucide em vez de Unicode (✦, ↺, X)
- Ícones padronizados: Search, Refresh, Play, Save, Trash, X

**P2-4: Dark scrollbar customizada**
- Adicionar estilo para scrollbars (Webkit `::-webkit-scrollbar`) que combine com o tema dark

**P2-5: Copiar ID com um clique**
- IDs de mensagem, draft e mesa são expostos como texto — adicionar botão de cópia

### Low Priority (P3) — Backlog

**P3-1: Atalhos de teclado**
- Ctrl+Enter para "Salvar campos" no editor
- Ctrl+S para "Salvar + Sincronizar"
- Setas para navegar entre mensagens na lista

**P3-2: Histórico de ações recentes**
- Lista das últimas N ações (mensagens parseadas, drafts sincronizados) com links diretos

**P3-3: Preview de mensagem no hover da lista**
- Tooltip com conteúdo completo ao passar o mouse sobre uma mensagem truncada

**P3-4: Dark mode / light mode do painel admin**
- Respeitar o tema global (`artificio_theme`) — atualmente o painel é hardcoded dark

---

## 5. Redesign Proposals

### Proposal 1: Stepper Wizard para Fluxo Guiado

**Current State:** 5 abas horizontais planas, sem hierarquia ou sequência.

**Proposed Solution:**

```
┌─────────────────────────────────────────────────────────────┐
│  Discord Sync — Covil do Lich                               │
│                                                             │
│  ●━━━●━━━●━━━○  (stepper horizontal)                       │
│  ⚙️    📡   📥   📝                                        │
│  Conf  Fontes Msgs  Drafts                                  │
│   ✓     3     12    5                                       │
│                                                             │
│  [Conteúdo do passo atual]                                  │
│                                                             │
│  ← Voltar    Próximo: Fontes →                              │
└─────────────────────────────────────────────────────────────┘
```

- Stepper com 4 passos (Configuração, Fontes, Mensagens, Drafts)
- Badge numérico em cada passo mostrando itens pendentes
- Passos concluídos mostram ✓ verde
- Botões "Próximo" e "Voltar" para navegação linear
- Passos também clicáveis para navegação direta (power user)
- "Importar JSON" vira ação dentro do passo "Fontes" (atalho: "Importar de arquivo JSON")

**Expected Impact:**
- Learnability: 2/5 → 4/5
- Efficiency: 2/5 → 4/5
- Findable: 2/5 → 4/5
- **Effort:** ~16h

---

### Proposal 2: Modal de Draft Redesenhado

**Current State:** Modal 90vh com 3 sub-abas, 17 campos, múltiplos botões de ação.

**Proposed Solution:**

```
┌──────────────────────────────────────────────────┐
│  Draft: "Mesa de D&D 5e"                    [✕]  │
│  Status: ○ Pronto (3 pendências)                 │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌─ Campos Obrigatórios ─────────────────────┐  │
│  │ Título* [________________]  Sistema* [___▾]│  │
│  │ Tipo*   [___▾]  Modalidade* [___▾]        │  │
│  │ Vagas*  [___]    Preço* [___▾]             │  │
│  │ Dia*    [___▾]   Horário* [___]            │  │
│  │ Descrição* [_____________________________] │  │
│  │ Contato* [________________]                │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ Campos Opcionais ────────────────────────┐  │
│  │ ▶ Capa, Links, Frequência...              │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  ┌─ Dados Brutos (Debug) ────────────────────┐  │
│  │ ▶ JSON original da mensagem               │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
├──────────────────────────────────────────────────┤
│  [Reparsar]  [Salvar rascunho]  [Sincronizar →]  │
│                         ↑ primário   ↑ secundário │
└──────────────────────────────────────────────────┘
```

**Mudanças chave:**
1. Agrupar campos por obrigatoriedade (obrigatórios sempre visíveis, opcionais colapsados)
2. Seções colapsáveis para reduzir carga cognitiva inicial
3. Hierarquia visual clara: obrigatórios → opcionais → debug
4. Botão primário = "Salvar rascunho", secundário = "Sincronizar" (ação final)
5. Status consolidado: badge + "N pendências" em vez de lista de missing fields
6. Tab "Bruto" / "Normalizado" movida para seção colapsável de debug (admin avançado)

**Expected Impact:**
- Error Tolerance: 2/5 → 4/5 (dirty state protection)
- Efficiency: 2/5 → 4/5 (menos scroll, ações agrupadas)
- Engagement: 3/5 → 4/5

---

### Proposal 3: Fluxo Unificado de Mensagem → Mesa

**Current State:** O usuário trabalha em dois contextos separados (Mensagens e Drafts) que são etapas do mesmo pipeline.

**Proposed Solution — "Quick Parse + Review":**

Na aba Mensagens, ao selecionar uma mensagem e clicar "Gerar rascunho":
1. O parse acontece no backend
2. Um **mini-editor inline** abre no lugar do painel de detalhe (não um modal)
3. O admin preenche campos faltantes ali mesmo
4. "Salvar + Sync" em um clique

O modal completo (`DiscordDraftPreview`) continua existindo para edição avançada (acessível via "Editar completo" no mini-editor ou via aba Drafts).

```
┌── Lista de Mensagens ──┬── Mini-Editor ──────────────┐
│ ● Msg 1 (Pendente)     │ Título* [________________]   │
│ ● Msg 2 (Parseada) ✓   │ Sistema* [D&D 5e      ▾]    │
│ ● Msg 3 (Revisar)      │ Tipo*    [Campanha    ▾]    │
│                         │ Vagas*   [5]  Dia* [Dom ▾]  │
│                         │ Horário* [19:00]            │
│                         │                             │
│                         │ [Salvar]  [Salvar + Sync →] │
│                         │ [Abrir editor completo]     │
└─────────────────────────┴─────────────────────────────┘
```

**Expected Impact:**
- Efficiency: 2/5 → 5/5 (fluxo rápido: parse → preencher → sync em 3 passos)
- Error Tolerance: 2/5 → 4/5 (menos contexto para perder)

---

## 6. Research Recommendations

### Immediate Research Needs

**1. Teste de usabilidade com o mantenedor (1 sessão, 30 min)**
- Observar o fluxo real de importação de um anúncio do Discord
- Medir: tempo total, cliques, hesitações, erros
- Coletar: impressões sobre terminologia, pontos de confusão

**2. Revisão de terminologia**
- Listar todos os termos usados na UI (jargão técnico, nomes de ações)
- Validar com o mantenedor se são compreensíveis
- Criar glossário de termos para referência em tooltips

**3. Analytics de uso (quando disponível via spec 032)**
- Abas mais acessadas
- Taxa de abandono no editor de draft
- Tempo médio entre fetch e sync de uma mensagem

---

## 7. Implementation Roadmap

### Phase 1: Safety & Learnability (P0 + P1) — Week 1-2
1. Dirty state protection no modal (P0-1)
2. Unificar confirmações destrutivas (P0-2)
3. Botão "Voltar" + toast em navegação automática (P0-3)
4. Padronizar terminologia (P1-2)
5. Acessibilidade básica em tabs e modal (P1-4)

**Expected Impact:** Error Tolerance 2→4, Learnability 2→3

### Phase 2: Flow & Efficiency (P1) — Week 3-4
6. Stepper wizard (P1-1)
7. Skeleton loaders + progress indicators (P1-3)
8. Estados vazios com CTA (P2-1)

**Expected Impact:** Efficiency 2→4, Findable 2→4

### Phase 3: Polish (P2 + P3) — Week 5+
9. Ícones consistentes (P2-3)
10. Preservar estado entre abas (P2-2)
11. Scrollbar customizada (P2-4)
12. Copiar ID (P2-5)
13. Keyboard shortcuts (P3-1)

**Expected Impact:** Desirable 3→4, Engagement 3→4

### Success Metrics
- **Overall UX Score:** 53/85 → 70+/85 (C− → B+)
- **Tempo médio por mesa:** ~16 cliques → ~8 cliques
- **Erros de "draft perdido":** Eliminados (dirty state protection)
- **Onboarding autônomo:** Novo admin consegue importar 1 mesa sem ajuda externa

---

## 8. Strengths (What's Working Well)

1. **Pipeline conceitual sólido.** O fluxo config→fontes→fetch→parse→draft→review→sync é o design correto para o domínio. Nenhuma mudança arquitetural necessária — só camada de apresentação.

2. **Validação de dados robusta.** Zod schemas no frontend e backend. Tipagem forte. Normalização de payload externo antes de entrar no estado React (conforme regra de normalização do AGENTS.md). Zero `any` types nos tipos compartilhados.

3. **Tratamento de edge cases.** Mensagens sem corpo da API Discord (Message Content Intent), ambiguidade de vagas X/Y, fóruns com threads, múltiplos formatos de source.

4. **Feedback informativo.** Toasts com dados quantitativos ("+5 mensagens, 2 atualizadas. 3 drafts criados.") são excelentes — o padrão deve ser mantido e expandido.

5. **API layer limpa.** `discordSyncApi.ts` é bem estruturado, com parsing tipado de todas as respostas. Separação clara entre HTTP fetch e lógica de negócio.

6. **Hook custom bem encapsulado.** `useDraftForm.ts` isola toda a lógica de estado do editor de draft (reducer pattern, upload de capa, slots ambiguity), deixando os componentes de UI finos.

---

## 9. Conclusion

O Discord Sync é uma ferramenta **poderosa e corretamente arquitetada** que sofre de uma camada de apresentação que não acompanhou a maturidade do backend. Os problemas são quase exclusivamente de **UX de superfície**: navegação, feedback, proteção contra erros e terminologia. Nenhum problema arquitetural ou de pipeline foi identificado.

As propostas de redesign focam em **reduzir atrito** sem reescrever lógica de negócio: stepper para orientação, confirmações para segurança, mini-editor para eficiência. O investimento estimado é de ~3-4 semanas para atingir um patamar de UX sólido (nota B+).

---

## Methodology Notes

- **Framework:** IxDF "The Basics of User Experience Design"
- **Standards:** 7 UX Factors + 5 Usability Characteristics + 5 Interaction Dimensions
- **Approach:** Expert review (código-fonte + simulação de fluxos)
- **Limitations:** Avaliação estática (código-fonte) sem observação de usuário real. Não foram realizados testes com o mantenedor. Validações de contraste e acessibilidade são estimativas visuais — um audit WCAG completo exigiria ferramentas automatizadas (axe-core, Lighthouse).
- **Complement with:**
  - Nielsen Heuristics Audit (usabilidade detalhada)
  - WCAG Accessibility Audit (conformidade A/AA)
  - UI Design Review (polimento visual)

---

## References

- Interaction Design Foundation — "The Basics of User Experience Design"
- Peter Morville — User Experience Honeycomb (7 Factors)
- ISO 9241-11 — Usability definition and metrics
- Gillian Crampton Smith & Kevin Silver — 5 Dimensions of Interaction Design
- AGENTS.md — Artifício RPG Governance
- Spec 047 — Mesas Inbox Importação (DEB-047-21, DEB-047-23)

---

**Version:** 1.0  
**Last Updated:** 2026-06-23
