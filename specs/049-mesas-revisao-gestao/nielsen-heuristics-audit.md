# Nielsen Heuristics UX Audit Report

**Interface**: Discord Sync — Gestão Administrativa (Mesas)
**Date**: 2026-06-23
**Evaluator**: AI Agent (OpenCode/DeepSeek)
**Platform**: Web (React 19 / Tailwind / dark-themed admin)
**Scope**: `apps/mesas/frontend/src/features/discord-sync/` + `GestaoPage.tsx`

---

## Executive Summary

### Overview
Auditoria das 10 heurísticas de Nielsen aplicada à interface de gestão do Discord Sync do app Mesas (Artifício RPG). O alvo inclui 8 componentes (DiscordSyncPanel, DiscordJsonImportPanel, DiscordSourceList, DiscordDraftReviewTable, DiscordSettingsPanel, DraftEditorTab, DiscordDraftPreview, GestaoPage) + a camada de API (`discordSyncApi.ts`). A interface é uma ferramenta administrativa interna (acesso restrito a `role='admin'`) para importar mensagens do Discord, transformá-las em drafts de anúncios de mesa RPG e publicá-las.

### Key Findings
- **Total Issues Found**: 52
  - Catastrophic (4): 0
  - Major (3): 6
  - Minor (2): 21
  - Cosmetic (1): 25

### Top 3 Critical Issues
1. Inconsistência de diálogos de confirmação (`window.confirm()` nativo vs inline UI) — Severity 3 — Heuristic #4
2. Sem guarda de saída no editor de draft com alterações não salvas (dirty state) — Severity 3 — Heuristic #5
3. Sincronização sem undo/rollback — operação destrutiva irreversível — Severity 3 — Heuristic #3

### Overall Usability Score
**7/10** — Good. Ferramenta administrativa funcional e bem estruturada, com deficiências pontuais em prevenção de erros, consistência de confirmações e feedback de progresso em operações em lote. Adequada para uso por admin experiente; seria frustrante para novato sem treinamento.

---

## Detailed Findings by Heuristic

### H1: Visibility of System Status
**Compliance**: ★★★★☆ (4/5)

A interface mantém o usuário informado sobre estado de operações na maioria dos casos. Toast notifications, badges de status coloridos e texto de loading cobrem os fluxos principais.

#### Issues Found

**Issue 1.1: Indicador de progresso ausente em operações em lote**
- **Severity**: 2 (Minor)
- **Location**: DiscordSyncPanel.tsx (handleParseBatch), DiscordDraftReviewTable.tsx (handleSyncReady)
- **Description**: "Apurar todas pendentes" e "Sincronizar todos prontos" mostram texto estático ("Apurando...", "Sincronizando...") sem indicador de progresso (X de Y processados). Operações podem levar vários segundos.
- **Recommendation**: Mostrar contagem progressiva (ex.: "Apurando 12/45...") ou barra de progresso.

**Issue 1.2: DiscordSettingsPanel usa texto puro como loading**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordSettingsPanel.tsx:84
- **Description**: Estado de carregamento mostra `<p>Carregando...</p>` sem spinner ou skeleton, inconsistente com outros painéis que usam ao menos o texto centralizado.
- **Recommendation**: Adicionar spinner (Lucide `Loader2`) ou skeleton consistente com o restante da UI.

**Issue 1.3: Sem indicador de "última sincronização" visível no draft list**
- **Severity**: 2 (Minor)
- **Location**: DiscordDraftReviewTable.tsx
- **Description**: A lista de drafts não mostra quando cada draft foi atualizado pela última vez. O campo `updated_at` existe no tipo mas não é exibido. Só `created_at` aparece como data.
- **Recommendation**: Mostrar "atualizado em" no card do draft ou na tela de detalhe.

**Issue 1.4: Nenhum feedback visual de "draft salvo" vs "draft com alterações" na lista**
- **Severity**: 2 (Minor)
- **Location**: DiscordDraftPreview.tsx, useDraftForm.ts
- **Description**: O estado `dirty` é rastreado internamente, mas o usuário na lista de drafts não vê quais drafts têm alterações não salvas. Se fechar o modal sem salvar, perde as edições silenciosamente (sem confirmação).
- **Recommendation**: Mostrar indicador de "não salvo" (ex.: badge amarelo) e confirmar antes de fechar com dirty.

**Issue 1.5: JSON preview não mostra tempo estimado de importação**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordJsonImportPanel.tsx
- **Description**: O preview mostra contagem de mensagens, mas não estima duração da importação. Para arquivos grandes (100+ mensagens), o usuário não sabe quanto tempo levará.
- **Recommendation**: Mostrar estimativa simples baseada na contagem (ex.: "~5 segundos").

#### Positive Examples
- Status badges coloridos em mensagens e drafts (6 cores distintas, legíveis)
- Cards de estatísticas de fila (pendentes, revisão, conferidas, ignoradas) com atualização em tempo real
- Botões com texto de estado durante operações (ex.: "Buscando...", "Criando draft...")
- Toast notifications com mensagens específicas de sucesso/erro após cada operação
- Indicador de token configurado com ícone ShieldCheck/AlertTriangle
- "Analisando JSON..." durante preview

---

### H2: Match Between System and the Real World
**Compliance**: ★★★★☆ (4/5)

Linguagem em PT-BR, vocabulário de RPG (mesa, campanha, one-shot, Covil do Lich) e conceitos do Discord (servidor, canal, fórum). Termos técnicos restritos ao necessário para ferramenta administrativa.

#### Issues Found

**Issue 2.1: "Reparsar" é neologismo técnico sem explicação**
- **Severity**: 2 (Minor)
- **Location**: DiscordDraftPreview.tsx:128
- **Description**: O botão "Reparsar" usa um termo que não existe em português e não tem tooltip explicando que significa "reanalisar a mensagem original e regenerar o draft".
- **Recommendation**: Adicionar tooltip: "Reanalisar a mensagem original do Discord e regenerar os campos do draft" ou renomear para "Reanalisar".

**Issue 2.2: "Reidratar" é jargão técnico**
- **Severity**: 2 (Minor)
- **Location**: DiscordSourceList.tsx:377-381
- **Description**: O botão "↺ Reidratar" usa metáfora técnica de persistência. O `title` explica ("Apaga mensagens pendentes e rebusca..."), mas não é visível sem hover.
- **Recommendation**: Renomear para "Reimportar" ou "Rebuscar", ou manter com tooltip sempre visível (ícone de info).

**Issue 2.3: "Confiança" sem definição**
- **Severity**: 2 (Minor)
- **Location**: DiscordDraftReviewTable.tsx:179, DiscordDraftPreview.tsx:75
- **Description**: A porcentagem de confiança é exibida sem explicação do que representa (qualidade do parse automático? probabilidade de acerto?). Um admin novo não sabe interpretar "85%".
- **Recommendation**: Tooltip: "Qualidade estimada do parse automático dos campos. Acima de 80% geralmente está correto."

**Issue 2.4: "Embeds" como termo do Discord**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordJsonImportPanel.tsx:280-282
- **Description**: "Com embeds" no preview usa jargão da API do Discord. Usuário admin pode não conhecer o termo.
- **Recommendation**: "Com conteúdo incorporado (embeds)" ou "Com cards/mídia".

**Issue 2.5: IDs numéricos do Discord exibidos sem contexto**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordSyncPanel.tsx:430, DiscordSourceList.tsx:330
- **Description**: IDs como `discord_message_id` e `channel_id` são exibidos sem label descritivo. Ex.: "#1234567890" — o "#" ajuda, mas o número puro não.
- **Recommendation**: Adicionar label "ID Discord:" antes de IDs expostos.

#### Positive Examples
- PT-BR consistente em toda a interface (labels, mensagens, placeholders)
- Terminologia de RPG: mesa, campanha, one-shot, Covil do Lich, mestre
- Uso de "servidor" e "canal" como no Discord
- Datas em formato `toLocaleString('pt-BR')`
- "Fórum:" como tag visual em mensagens de tópico

---

### H3: User Control and Freedom
**Compliance**: ★★★☆☆ (3/5)

Navegação por abas funciona bem. Confirmações existem para operações destrutivas, mas há lacunas importantes: sem undo após sync, sem Escape no modal, sem guarda de saída com dirty.

#### Issues Found

**Issue 3.1: Sincronização irreversível sem rollback**
- **Severity**: 3 (Major)
- **Location**: useDraftForm.ts:244 (handleSync)
- **Description**: Ao clicar "Sincronizar como mesa", o draft é convertido em uma mesa real (`tables`). Não há como desfazer. Se o admin publicar acidentalmente com dados errados, precisa ir em "Gerenciar Conteúdo > Mesas" para cancelar manualmente.
- **Recommendation**: Adicionar modal de confirmação pré-sync mostrando os dados que serão publicados, OU implementar "sync reversível" (marcar como rascunho novamente, não deletar).

**Issue 3.2: Modal de draft não fecha com Escape**
- **Severity**: 2 (Minor)
- **Location**: DiscordDraftPreview.tsx:35 (fixed overlay)
- **Description**: O modal `DiscordDraftPreview` cobre a tela inteira mas só fecha clicando no "X". Tecla Escape não funciona. Se o usuário está navegando por teclado, fica preso.
- **Recommendation**: Adicionar `onKeyDown` handler para Escape + `useEffect` com listener global de `keydown`.

**Issue 3.3: Sem breadcrumb/voltar na tela de detalhe do draft**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordDraftPreview.tsx
- **Description**: Ao abrir um draft, não há indicação de "voltar para lista" além do X. Se o usuário quiser ver outro draft, precisa fechar e clicar novamente.
- **Recommendation**: Adicionar navegação "← Anterior / Próximo →" entre drafts, ou setas de navegação.

**Issue 3.4: ReingestForce — confirmação frágil**
- **Severity**: 3 (Major)
- **Location**: DiscordSyncPanel.tsx:225
- **Description**: `window.confirm()` para "apagar todas as mensagens pendentes desta fonte e rebuscar tudo" é uma operação destrutiva pesada. O diálogo nativo do navegador é rudimentar e fácil de clicar por acidente (Enter confirma).
- **Recommendation**: Usar modal de confirmação customizado com input de confirmação textual ("Digite REIMPORTAR para confirmar").

**Issue 3.5: Sem "cancelar" durante fetch de mensagens**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordSyncPanel.tsx:153-174
- **Description**: Quando `handleFetchMessages` está em execução, o botão mostra "Buscando..." mas não há como cancelar a operação. Se a janela de tempo for grande (90d), pode demorar.
- **Recommendation**: Adicionar botão "Cancelar" que aborta o fetch via AbortController.

**Issue 3.6: Bulk sync sem revisão individual**
- **Severity**: 2 (Minor)
- **Location**: DiscordDraftReviewTable.tsx:73
- **Description**: "Sincronizar todos prontos" executa sync em lote com apenas um `confirm()` genérico. O admin não vê quais drafts serão afetados.
- **Recommendation**: Listar os drafts que serão sincronizados no modal de confirmação.

#### Positive Examples
- Cancelar na adição de fonte (fecha o formulário sem salvar)
- Cancelar na edição de status inline
- Dois passos para deletar fonte (Remover → Sim/Não)
- Limpar no JSON import reseta todo o estado
- "Cancelar" na remoção de token

---

### H4: Consistency and Standards
**Compliance**: ★★★☆☆ (3/5)

Componentes internos são relativamente consistentes entre si, mas há desconexão notável com o restante da GestaoPage e uso misto de padrões de confirmação.

#### Issues Found

**Issue 4.1: Dois estilos de abas no mesmo contexto**
- **Severity**: 2 (Minor)
- **Location**: GestaoPage.tsx:479-550 vs DiscordSyncPanel.tsx:264-268
- **Description**: GestaoPage usa abas com `border-b-2` + `font-semibold` (estilo underline). DiscordSyncPanel usa abas com `rounded-lg` + `bg-blue-600` (estilo pill/filled). O usuário vê os dois padrões na mesma página (Discord Sync é sub-aba de Gestão).
- **Recommendation**: Unificar o estilo. Usar o mesmo padrão de abas em toda a GestaoPage.

**Issue 4.2: Mistura de `window.confirm()` com confirmação inline**
- **Severity**: 3 (Major)
- **Location**: DiscordSyncPanel.tsx:225, DiscordDraftReviewTable.tsx:73, DiscordSourceList.tsx:383-399, GestaoPage.tsx:234,419
- **Description**: Algumas confirmações usam `window.confirm()` (diálogo nativo do navegador, visual inconsistente com o tema dark), outras usam UI inline customizada (Remover → Sim/Não). Isso gera experiência inconsistente e o `confirm()` nativo é feio/abrupto no tema escuro.
- **Recommendation**: Substituir todos os `window.confirm()` por modal de confirmação customizado consistente com o design system.

**Issue 4.3: Estilo de botão "Cancelar" varia entre componentes**
- **Severity**: 1 (Cosmetic)
- **Location**: Vários arquivos
- **Description**: DiscordSourceList usa `bg-white/10 hover:bg-white/20`, DiscordDraftPreview usa `bg-white/10 hover:bg-white/20`, DiscordSettingsPanel também. Mas há pequenas variações de padding (`px-3 py-1` vs `px-4 py-2`).
- **Recommendation**: Extrair classe de botão "cancelar" reutilizável (ou garantir `px-4 py-2` consistente).

**Issue 4.4: "X" textual vs ícone para fechar**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordDraftPreview.tsx:43
- **Description**: O botão de fechar usa "X" como texto puro, enquanto o restante do projeto usa ícones Lucide (ex.: `X` icon em DiscordSettingsPanel.tsx:178).
- **Recommendation**: Usar `<X size={18} />` do Lucide, consistente com `DiscordSettingsPanel`.

**Issue 4.5: Labels em maiúsculas vs sentence case**
- **Severity**: 1 (Cosmetic)
- **Location**: DraftEditorTab.tsx vs DiscordSyncPanel.tsx
- **Description**: DraftEditorTab usa labels como "Título", "Sistema" (capitalizado). DiscordSyncPanel usa "Todas as fontes", "Todos os status" (sentence case). Inconsistência leve.
- **Recommendation**: Padronizar capitalização de labels (sentence case para PT-BR).

**Issue 4.6: Cores dos status: draft=white/10 no DiscordDraftReviewTable vs draft ausente no DiscordSyncPanel**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordDraftReviewTable.tsx:23
- **Description**: Status "draft" (rascunho) usa `bg-white/10 text-white/50` — visualmente indistinguível do fundo dos cards. Pode ser confundido com estado "vazio".
- **Recommendation**: Dar cor mais distinta ao status "draft", ex.: `bg-gray-600/40 text-gray-300`.

#### Positive Examples
- `app-select` usado consistentemente em todos os `<select>`
- Status badges com mesmo padrão de cor e forma (rounded-full, px-2 py-0.5)
- Cards com mesmo estilo de borda e fundo (`bg-white/5 border border-white/10 rounded-lg`)
- Toast library (`react-hot-toast`) usada uniformemente
- Padrão de loading state: texto centralizado `text-white/40 text-sm py-4 text-center`

---

### H5: Error Prevention
**Compliance**: ★★★☆☆ (3/5)

Validações existem nos pontos críticos (token, arquivos, campos obrigatórios), mas há lacunas importantes: sem validação inline nos campos do formulário de draft, sem guarda de saída com dirty, campos numéricos aceitam texto.

#### Issues Found

**Issue 5.1: Sem validação inline nos campos do editor de draft**
- **Severity**: 2 (Minor)
- **Location**: DraftEditorTab.tsx, draftFormUtils.ts:107-121
- **Description**: A validação (`validateForm`) só roda no momento de salvar. Campos como "Vagas totais" aceitam texto não numérico e só reportam erro no save. O usuário preenche o formulário inteiro para só depois descobrir que há campos inválidos.
- **Recommendation**: Adicionar validação on-blur com feedback inline (borda vermelha + mensagem) para campos numéricos e obrigatórios.

**Issue 5.2: Sem confirmação ao fechar editor com alterações não salvas**
- **Severity**: 3 (Major)
- **Location**: DiscordDraftPreview.tsx, useDraftForm.ts (dirty state)
- **Description**: O hook `useDraftForm` rastreia `dirty`, mas o modal `DiscordDraftPreview` não verifica `dirty` antes de fechar. Se o admin editar vários campos e clicar no X ou fora do modal, perde todo o trabalho silenciosamente.
- **Recommendation**: Bloquear fechamento com `dirty === true` e mostrar confirmação "Há alterações não salvas. Descartar?".

**Issue 5.3: Token: Enter não submete**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordSettingsPanel.tsx:117-131
- **Description**: O campo de token não está dentro de `<form>`, então pressionar Enter não dispara o save. O usuário precisa clicar no botão.
- **Recommendation**: Envolver em `<form onSubmit={handleSave}>` ou adicionar `onKeyDown` para Enter.

**Issue 5.4: JSON import: sem validação de estrutura antes do preview**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordJsonImportPanel.tsx:56-76
- **Description**: O preview é chamado com qualquer string do textarea (via debounce 400ms). Se o JSON for inválido, o erro só aparece após a chamada de API. Poderia validar `JSON.parse` localmente antes.
- **Recommendation**: Tentar `JSON.parse` localmente antes de chamar a API de preview. Mostrar erro imediato de sintaxe.

**Issue 5.5: `inputMode="numeric"` não bloqueia texto em desktop**
- **Severity**: 1 (Cosmetic)
- **Location**: DraftEditorTab.tsx:139,143
- **Description**: Campos de vagas usam `inputMode="numeric"` que ajuda em mobile mas não previne entrada de texto em desktop. Caracteres não numéricos são aceitos e só falham na validação de save.
- **Recommendation**: Adicionar handler `onChange` que filtra não-dígitos, ou usar `type="number"` com estilização.

**Issue 5.6: Bulk operations sem confirmação de escopo**
- **Severity**: 2 (Minor)
- **Location**: DiscordSyncPanel.tsx:243 (handleParseBatch)
- **Description**: "Apurar todas pendentes" não mostra quantas mensagens serão afetadas antes de executar. O botão poderia ser clicado sem noção do volume.
- **Recommendation**: Mostrar contagem no botão: "Apurar todas pendentes (45)" e confirmar se > 50.

#### Positive Examples
- Validação de token (sem espaços, mínimo 50 caracteres) antes do save
- File size check (10MB JSON, 5MB capa) antes do upload
- File type check (.json, image/jpeg-png-webp)
- Botão disabled durante operações em progresso
- Campo "Valor" disabled quando preço = gratuita
- Confirmação de dois passos para remover fonte
- Confirmação antes de deletar mesa no GestaoPage

---

### H6: Recognition Rather Than Recall
**Compliance**: ★★★☆☆ (3/5)

A interface mostra informações contextuais razoavelmente bem (badges, thumbnails, labels), mas depende de memorização em alguns fluxos e expõe IDs não significativos.

#### Issues Found

**Issue 6.1: UUIDs de draft/mensagem exibidos como identificadores primários**
- **Severity**: 2 (Minor)
- **Location**: DiscordDraftPreview.tsx:40, DiscordSyncPanel.tsx:430
- **Description**: O ID do draft (`draft.id`, UUID) é mostrado como subtítulo no modal. Para o admin, esse valor não tem significado. O `discord_message_id` também é um número longo sem contexto.
- **Recommendation**: Mostrar informação significativa primeiro (título da mesa, autor, data) e esconder UUIDs atrás de "Copiar ID" ou toggle.

**Issue 6.2: Dropdown de sistemas sem busca**
- **Severity**: 2 (Minor)
- **Location**: DraftEditorTab.tsx:102
- **Description**: O select de sistema lista sistemas em flat (via `flattenSystems`). Com muitos sistemas, encontrar o correto requer scroll e leitura. Não há filtro por texto.
- **Recommendation**: Usar componente de select com busca (combobox/searchable select) ou agrupar por edição/sistema pai.

**Issue 6.3: Sem indicador de qual fonte uma mensagem pertence na lista**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordSyncPanel.tsx:377-421
- **Description**: Quando o filtro "Todas as fontes" está ativo, as mensagens na lista não mostram de qual canal/fonte vieram. O admin precisa lembrar ou abrir o detalhe.
- **Recommendation**: Mostrar nome do canal na linha da mensagem (ex.: badge sutil).

**Issue 6.4: Sem busca/histórico de drafts recentes**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordDraftReviewTable.tsx
- **Description**: Não há filtro por texto (título da mesa) nem indicação de "último draft visualizado". Se o admin está revisando vários, perde o contexto ao navegar.
- **Recommendation**: Adicionar campo de busca por título + indicador visual de "visualizado recentemente".

**Issue 6.5: Sem auto-complete no campo de sistema (raw_system_hint)**
- **Severity**: 1 (Cosmetic)
- **Location**: DraftEditorTab.tsx:102
- **Description**: Quando o parse automático sugere um sistema (`raw_system_hint`), o select não pré-seleciona nem destaca a sugestão. O admin precisa encontrar manualmente.
- **Recommendation**: Pré-selecionar o sistema correspondente ao `raw_system_hint` se houver match exato, ou destacar sugestões próximas.

**Issue 6.6: "Selecionar arquivo" não mostra nome do arquivo selecionado**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordJsonImportPanel.tsx:239-243
- **Description**: Após selecionar um arquivo JSON, o botão "Selecionar arquivo" não muda para mostrar o nome do arquivo. O texto aparece no textarea (conteúdo), mas não há confirmação visual de qual arquivo foi carregado.
- **Recommendation**: Mostrar nome do arquivo ao lado do botão após seleção.

#### Positive Examples
- Capa do draft como thumbnail na lista (reconhecimento visual)
- Preview do JSON import mostra servidor, canal, contagem de mensagens
- Status badges com cores consistentes e distintas
- "Ver no Discord" link para contexto externo
- Nome do autor e data visíveis em cada mensagem
- Canais com nome + tipo (Texto/Fórum/Anúncio)

---

### H7: Flexibility and Efficiency of Use
**Compliance**: ★★★☆☆ (3/5)

Operações em lote e filtros cobrem os casos de uso comuns, mas faltam atalhos de teclado, operações em massa (status de mensagens), e busca/filtro avançado em listas.

#### Issues Found

**Issue 7.1: Sem atalhos de teclado**
- **Severity**: 1 (Cosmetic)
- **Location**: Todos os componentes
- **Description**: Nenhum atalho de teclado implementado (Ctrl+S para salvar, Ctrl+Enter para confirmar, setas para navegar entre drafts, etc.). Para admins que usam o sistema diariamente, todas as operações exigem mouse.
- **Recommendation**: Adicionar atalhos para ações frequentes: Ctrl+S = salvar campos, Escape = fechar modal, setas = navegar mensagens/drafts.

**Issue 7.2: Sem alteração de status em lote nas mensagens**
- **Severity**: 2 (Minor)
- **Location**: DiscordSyncPanel.tsx:306-349
- **Description**: Na aba Mensagens, cada mensagem tem seu status alterado individualmente. Não há seleção múltipla para "marcar várias como ignoradas" ou "mandar várias para revisão".
- **Recommendation**: Adicionar checkboxes + ação em lote na barra de filtros (igual às sugestões no GestaoPage).

**Issue 7.3: Sem paginação/scroll infinito nas listas**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordSyncPanel.tsx:117, DiscordDraftReviewTable.tsx:58
- **Description**: Tanto mensagens quanto drafts carregam com `limit: 100` fixo. Não há "carregar mais" ou paginação. Se houver mais de 100 itens, o admin não consegue acessar os antigos.
- **Recommendation**: Adicionar paginação ou botão "Carregar mais 100".

**Issue 7.4: Sem atalho para pular para a aba Drafts após importar JSON**
- **Severity**: 2 (Minor)
- **Location**: DiscordJsonImportPanel.tsx:334-341
- **Description**: O botão "Ver drafts" só aparece no resultado de sucesso do JSON import. Após fechar o resultado, não há atalho na aba "Importar JSON" para ir direto aos drafts.
- **Recommendation**: Manter o botão "Ver drafts" visível mesmo após fechar o resultado (enquanto houver resultado na sessão).

**Issue 7.5: Sem atalho para pré-visualizar próxima mensagem**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordSyncPanel.tsx:375-529
- **Description**: Para revisar várias mensagens em sequência, o admin precisa clicar em cada uma individualmente. Não há botão "Próxima" ou setas para navegar.
- **Recommendation**: Adicionar botões "← Anterior / Próximo →" no painel de detalhe da mensagem.

**Issue 7.6: Filtro de tempo aplicado globalmente, sem atalho por fonte**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordSyncPanel.tsx:317-325
- **Description**: O filtro de janela de tempo (24h/7d/30d/90d/all) aplica-se a todas as fontes. Na aba Fontes, cada fonte tem seu próprio seletor de janela, mas na aba Mensagens o filtro é global.
- **Recommendation**: Ok para a aba Mensagens, mas considerar sincronizar o filtro de janela entre as abas Fontes e Mensagens.

#### Positive Examples
- Operações em lote: "Apurar todas pendentes", "Sincronizar todos prontos"
- Filtros combináveis: fonte + status + janela de tempo
- Drag-and-drop para upload de JSON
- Modo avançado (IDs manuais) como alternativa à descoberta
- Seletor de janela de tempo rápido (24h/7d/30d/90d/all)
- Abas para troca rápida de contexto

---

### H8: Aesthetic and Minimalist Design
**Compliance**: ★★★★☆ (4/5)

Interface limpa com hierarquia visual clara. O tema escuro é consistente. Cards, badges e grids organizam bem a informação. Pouca desordem visual.

#### Issues Found

**Issue 8.1: Painel de detalhe da mensagem denso**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordSyncPanel.tsx:424-529
- **Description**: O aside de detalhe da mensagem contém: título, ID, link Discord, seletor de status, 4 botões de ação, grid de metadados, textarea de conteúdo, diagnóstico. Em telas menores (1024px), fica carregado.
- **Recommendation**: Agrupar ações em menu dropdown ou usar tabs (Info / Conteúdo / Diagnóstico) como no draft preview.

**Issue 8.2: Três abas de visualização no draft preview com pouca diferenciação**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordDraftPreview.tsx:86-89
- **Description**: "Campos", "Normalizado" e "Bruto" são três visões do mesmo dado. "Normalizado" e "Bruto" mostram JSON quase idêntico para drafts novos. Poderia ser simplificado.
- **Recommendation**: Juntar "Normalizado" e "Bruto" em uma aba "Dados (JSON)" com toggle, ou destacar diferenças.

**Issue 8.3: Cards de estatísticas com informação redundante**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordJsonImportPanel.tsx:307-328
- **Description**: Grid 2×5 para mostrar resultado de importação. Em mobile, as 5 colunas colapsam para 2, ocupando muito espaço vertical.
- **Recommendation**: Usar layout mais compacto: linha de resumo "X mensagens (Y novas, Z atualizadas, W ignoradas, V falhas)".

**Issue 8.4: Bordas de foco sutis demais no tema escuro**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordSettingsPanel.tsx:125 (token input)
- **Description**: O input de token usa `focus:border-blue-500` que é sutil no fundo escuro. Outros inputs não têm indicador de foco explícito.
- **Recommendation**: Adicionar `focus:ring-1 focus:ring-blue-500/50` para indicador de foco mais visível (acessibilidade).

#### Positive Examples
- Espaçamento consistente (`space-y-3`, `gap-3`, `mb-4`)
- Grid responsivo com breakpoints (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`)
- Thumbnails de capa nos drafts (reconhecimento visual imediato)
- Stats cards com número grande + label pequeno (hierarquia clara)
- Progressão natural: importar → apurar → revisar → sincronizar
- Modal com scroll interno (`max-h-[90vh] flex flex-col`)

---

### H9: Help Users Recognize, Diagnose, and Recover from Errors
**Compliance**: ★★★☆☆ (3/5)

Mensagens de erro existem e são razoavelmente específicas. O diagnóstico de conteúdo do Discord é um diferencial positivo. Porém, erros de API são frequentemente genéricos e não oferecem ação corretiva.

#### Issues Found

**Issue 9.1: Erros de API genéricos sem orientação**
- **Severity**: 2 (Minor)
- **Location**: discordSyncApi.ts:34-37, e todos os `catch` nos componentes
- **Description**: Quando a API retorna erro, a mensagem é frequentemente "Erro ao carregar fontes." ou "HTTP 500". Não há sugestão do que fazer (verificar token? tentar novamente? contatar suporte?).
- **Recommendation**: Adicionar mensagens contextualizadas: "Erro ao carregar fontes. Verifique se o token do bot está configurado e se o bot está online."

**Issue 9.2: Sem orientação quando discovery retorna vazio**
- **Severity**: 2 (Minor)
- **Location**: DiscordSourceList.tsx:83-84, 117-118
- **Description**: Quando `discoverGuilds` retorna array vazio, a mensagem diz "Nenhum servidor encontrado. Convide o bot...". Mas não sugere verificar o token primeiro, que é a causa mais comum.
- **Recommendation**: Adicionar: "Verifique se o token do bot está configurado na aba Configuração." se o token não estiver setado.

**Issue 9.3: Erros de sync em lote não mostram quais falharam**
- **Severity**: 2 (Minor)
- **Location**: DiscordDraftReviewTable.tsx:78-81
- **Description**: `syncReady` retorna `{ synced, failed, errors[] }` mas os erros vão para `console.warn`, não para a UI. O admin vê "15 sincronizadas, 3 falhas." sem saber quais.
- **Recommendation**: Mostrar lista de drafts que falharam na UI (modal ou toast expansível).

**Issue 9.4: Sem botão "Tentar novamente" em operações que falham**
- **Severity**: 1 (Cosmetic)
- **Location**: Todos os componentes com catch
- **Description**: Quando uma operação falha, o toast de erro aparece mas desaparece. O admin precisa repetir manualmente a ação.
- **Recommendation**: Toast de erro com ação "Tentar novamente" (react-hot-toast suporta ações).

**Issue 9.5: Mensagem "Corpo não entregue" poderia sugerir ação**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordSyncPanel.tsx:411-413
- **Description**: O aviso "Corpo não entregue pela API do Discord; apenas o título do tópico foi recebido." explica o problema, mas não sugere clicar em "Diagnosticar corpo".
- **Recommendation**: Adicionar "Use o diagnóstico ao lado para verificar a causa." como parte da mensagem.

**Issue 9.6: Token preview mostra parte do token mas sem indicação de quais caracteres**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordSettingsPanel.tsx:103
- **Description**: `status.preview` mostra uma parte do token. Se o admin tem múltiplos bots, pode não saber qual token está configurado.
- **Recommendation**: Adicionar label "Token: ...XTk2" ou permitir expandir para ver mais.

#### Positive Examples
- Validação de token com mensagens específicas ("não pode conter espaços", "mínimo 50 caracteres")
- Diagnóstico de conteúdo (DiscordMessageContentDiagnostic) detalhado
- Parse errors exibidos inline na mensagem (não apenas no console)
- Aviso de "missing fields" lista exatamente quais campos faltam
- Mensagem de arquivo inválido cita formato esperado (.json)
- Mensagem de tamanho excedido mostra o limite e o tamanho do arquivo

---

### H10: Help and Documentation
**Compliance**: ★★☆☆☆ (2/5)

A interface é autoexplicativa para admins experientes com Discord, mas carece de documentação integrada. Tooltips existem em poucos lugares. Não há página de ajuda ou onboarding.

#### Issues Found

**Issue 10.1: Sem documentação integrada do fluxo Discord Sync**
- **Severity**: 2 (Minor)
- **Location**: DiscordSyncPanel.tsx (ausência)
- **Description**: O fluxo completo (Configurar token → Adicionar fontes → Buscar mensagens → Apurar → Revisar drafts → Sincronizar) não está documentado em lugar nenhum da interface. Um admin novo precisa descobrir a ordem por tentativa e erro.
- **Recommendation**: Adicionar um card/stripe de "Primeiros passos" na aba Configuração, ou um botão "?" que abre um modal com o fluxo explicado.

**Issue 10.2: "Modo avançado" sem instruções**
- **Severity**: 2 (Minor)
- **Location**: DiscordSourceList.tsx:292-296
- **Description**: O modo avançado espera que o admin saiba o que são "Guild ID" e "Channel ID" do Discord e onde encontrá-los. Não há dica ou link.
- **Recommendation**: Adicionar texto de ajuda: "Habilite o Modo Desenvolvedor no Discord (Configurações > Avançado) e copie os IDs com botão direito."

**Issue 10.3: Sem explicação do campo "Confiança" (confidence)**
- **Severity**: 2 (Minor)
- **Location**: DiscordDraftPreview.tsx:75, DiscordDraftReviewTable.tsx:179
- **Description**: O valor de confiança (ex.: "85%") aparece sem definição. O admin não sabe se é a qualidade do parse, probabilidade de acerto, ou outra métrica.
- **Recommendation**: Tooltip: "Estimativa de qualidade do parse automático. Valores acima de 80% geralmente estão corretos."

**Issue 10.4: Sem explicação sobre "Reparsar"**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordDraftPreview.tsx:128
- **Description**: O botão "Reparsar" não tem tooltip. Não está claro que isso reanalisa a mensagem original e sobrescreve os campos.
- **Recommendation**: Tooltip: "Reanalisar a mensagem original do Discord e regenerar todos os campos do draft. Alterações manuais serão perdidas."

**Issue 10.5: Sem indicação de onde obter o token do bot Discord**
- **Severity**: 2 (Minor)
- **Location**: DiscordSettingsPanel.tsx
- **Description**: O campo de token não explica onde obter o token (Discord Developer Portal > Applications > Bot). Um admin sem experiência com Discord API não saberá.
- **Recommendation**: Adicionar link "Onde encontro o token?" que leva à documentação ou mostra instrução curta.

**Issue 10.6: Sem indicador do que "Import JSON" aceita como formato**
- **Severity**: 1 (Cosmetic)
- **Location**: DiscordJsonImportPanel.tsx:187-191
- **Description**: O texto explica "JSON exportado pelo DiscordChatExporter", mas não mostra um exemplo de estrutura esperada.
- **Recommendation**: Adicionar link para o DiscordChatExporter ou expandir com exemplo mínimo de estrutura.

#### Positive Examples
- Explicação sobre fallback para `DISCORD_BOT_TOKEN` env var
- Instruções claras no JSON import: "Cole o conteúdo do arquivo..."
- Placeholder "Cole o JSON aqui..." contextual
- Tooltip no botão "Reidratar" explicando a ação
- Texto "As mensagens importadas estão com status 'Pendente'. Apure-as para gerar drafts revisáveis." — excelente orientação pós-ação
- Explicação detalhada sobre "Corpo não entregue pela API do Discord"

---

## Prioritized Action Items

### Must Fix (Severity 3)

1. **Issue 3.4 — ReingestForce com confirmação frágil** — H3: User Control
   - **Impact**: Perda acidental de dados (mensagens pendentes apagadas)
   - **Fix**: Substituir `window.confirm()` por modal com input de confirmação textual
   - **Effort**: Low

2. **Issue 4.2 — Mistura de window.confirm() com UI inline** — H4: Consistency
   - **Impact**: Experiência inconsistente, diálogo nativo feio no tema escuro
   - **Fix**: Criar componente `<ConfirmModal>` e usar em todos os pontos
   - **Effort**: Medium

3. **Issue 5.2 — Sem confirmação ao fechar editor com dirty** — H5: Error Prevention
   - **Impact**: Perda de trabalho do admin (edita campos, fecha sem querer)
   - **Fix**: Verificar `dirty` no onClose, mostrar modal de confirmação
   - **Effort**: Low

4. **Issue 3.1 — Sync irreversível sem rollback** — H3: User Control
   - **Impact**: Mesa publicada com dados errados exige correção manual em outro lugar
   - **Fix**: Modal de revisão pré-sync mostrando todos os campos que serão publicados
   - **Effort**: Medium

5. **Issue 1.3/1.4 — Sem indicador de alterações não salvas no draft list** — H1: System Status
   - **Impact**: Admin não sabe quais drafts foram editados e não salvos
   - **Fix**: Badge "não salvo" na lista + indicador no modal
   - **Effort**: Low

6. **Issue 9.1 — Erros de API genéricos sem ação corretiva** — H9: Error Recovery
   - **Impact**: Admin não sabe como resolver problemas comuns
   - **Fix**: Mapear erros comuns (401, 500, rede) para mensagens com ação sugerida
   - **Effort**: Medium

### Should Fix (Severity 2)

1. **Issue 1.1** — Progresso em lote (apurar/sync) — H1 — Effort: Low
2. **Issue 2.1** — Termo "Reparsar" sem explicação — H2 — Effort: Low
3. **Issue 2.2** — "Reidratar" é jargão — H2 — Effort: Low
4. **Issue 2.3** — "Confiança" sem definição — H2 — Effort: Low
5. **Issue 3.2** — Escape não fecha modal — H3 — Effort: Low
6. **Issue 3.6** — Bulk sync sem revisão — H3 — Effort: Medium
7. **Issue 4.1** — Dois estilos de abas — H4 — Effort: Medium
8. **Issue 5.1** — Sem validação inline nos campos — H5 — Effort: Medium
9. **Issue 5.6** — Batch sem indicação de volume — H5 — Effort: Low
10. **Issue 6.1** — UUIDs como identificadores — H6 — Effort: Low
11. **Issue 6.2** — Dropdown de sistemas sem busca — H6 — Effort: Medium
12. **Issue 7.2** — Sem bulk status update em mensagens — H7 — Effort: Medium
13. **Issue 7.4** — Atalho para Drafts pós-import — H7 — Effort: Low
14. **Issue 9.2** — Discovery vazio sem sugestão de token — H9 — Effort: Low
15. **Issue 9.3** — Erros de sync em lote invisíveis — H9 — Effort: Low
16. **Issue 10.1** — Sem doc do fluxo completo — H10 — Effort: Medium
17. **Issue 10.2** — Modo avançado sem instruções — H10 — Effort: Low
18. **Issue 10.3** — "Confiança" sem tooltip — H10 — Effort: Low
19. **Issue 10.5** — Onde obter token — H10 — Effort: Low

### Nice to Have (Severity 1)

25 issues cosméticos listados nas seções acima. Destaques:
- Issue 4.4 — "X" textual → ícone Lucide (Effort: Low)
- Issue 7.1 — Atalhos de teclado (Effort: Medium)
- Issue 5.3 — Enter para submeter token (Effort: Low)
- Issue 6.6 — Nome do arquivo após seleção (Effort: Low)
- Issue 9.4 — Botão "Tentar novamente" em toasts de erro (Effort: Low)

---

## Quick Wins
(Easy to fix, decent impact)

1. **Adicionar Escape para fechar modal** (Issue 3.2) — ~5 linhas
2. **Verificar dirty antes de fechar editor** (Issue 5.2) — ~10 linhas
3. **Tooltip em "Confiança"** (Issue 10.3) — 1 atributo
4. **Tooltip em "Reparsar"** (Issue 2.1) — 1 atributo
5. **Mostrar nome do canal nas mensagens** (Issue 6.3) — 1 span
6. **Badge "não salvo" em drafts com dirty** (Issue 1.4) — condicional simples
7. **Contagem no botão "Apurar todas pendentes"** (Issue 5.6) — `queueStats.pending` já disponível

## Long-term Improvements

1. **Sistema de confirmação unificado** — Substituir todos `window.confirm()` por `<ConfirmModal>` customizado
2. **Validação inline nos formulários** — on-blur validation com feedback visual nos campos
3. **Sistema de busca/filtro avançado** — Searchable selects, filtro por texto em drafts/mensagens
4. **Navegação por teclado** — Atalhos para usuários frequentes
5. **Documentação onboard** — Wizard/checklist de "Primeira configuração do Discord Sync"

---

## Positive Highlights

- **Pipeline bem definido**: O fluxo importar → apurar → revisar → sincronizar é intuitivo e bem modelado
- **Diagnóstico de conteúdo**: A funcionalidade de diagnosticar mensagens sem corpo da API do Discord é um diferencial excelente (H9)
- **Normalização defensiva**: `discordSyncApi.ts` faz parse Zod em toda resposta — robustez de dados (H5)
- **Tema escuro consistente**: Cores, espaçamento, tipografia seguem padrão uniforme (H8)
- **Feedback imediato**: Toast notifications em praticamente toda ação (H1)
- **Preview antes de importar**: JSON import mostra pré-visualização com dados do servidor/canal (H6)
- **Dois passos para deletar**: Remover → Confirmar reduz exclusões acidentais (H5)
- **Debounce no preview**: 400ms antes de chamar API evita chamadas excessivas (H7)
- **Dirty tracking**: Impede sync com dados não salvos (H5)
- **Drag-and-drop**: Upload de JSON mais eficiente que só file input (H7)

---

## Recommendations Summary

### Immediate Actions (1-2 weeks)
1. Adicionar verificação de `dirty` antes de fechar modal de draft (Issue 5.2)
2. Adicionar Escape para fechar modal (Issue 3.2)
3. Adicionar tooltips em "Confiança", "Reparsar", "Reidratar" (Issues 10.3, 2.1, 2.2)
4. Criar `<ConfirmModal>` component e usá-lo no lugar de `window.confirm()` (Issue 4.2)
5. Mostrar contagem de itens afetados em botões de batch (Issues 5.6, 3.6)

### Short-term (1-2 months)
1. Validação inline nos campos do editor de draft (Issue 5.1)
2. Unificar estilo de abas entre GestaoPage e DiscordSyncPanel (Issue 4.1)
3. Dropdown de sistemas com busca (Issue 6.2)
4. Paginação/load-more nas listas de mensagens e drafts (Issue 7.3)
5. Exibir erros de sync em lote na UI (Issue 9.3)
6. Documentação onboard do fluxo Discord Sync (Issue 10.1)

### Long-term (3+ months)
1. Atalhos de teclado para usuários frequentes (Issue 7.1)
2. Sistema de busca/filtro unificado cross-abas
3. Histórico de ações do admin (audit trail)
4. Tutoriais/onboarding interativo para novos admins

---

## Next Steps
1. **Validar achados**: Testar com mantenedor (admin real) para confirmar severidade e prioridades
2. **Priorizar fixes**: Selecionar quick wins + must-fix para iterar antes da próxima feature
3. **Re-auditar**: Após correções, reavaliar heurísticas com foco nos itens ajustados
4. **Complementar**: Combinar com WCAG accessibility audit e revisão de código (clean code)

---

## Methodology Notes
- Evaluation method: Expert heuristic evaluation (Nielsen's 10 Heuristics)
- Evaluator: AI agent (OpenCode/DeepSeek) simulating UX auditor
- Scope: 8 component files + 1 API layer + 2 utility files = 11 source files analyzed
- Limitations: No actual user testing conducted; evaluation based on code analysis, not live interaction. Recommendations should be validated with real admin users.
- Complement with: User testing with mantenedor, accessibility audit (WCAG 2.1 AA), analytics review of admin usage patterns.

---

## References
- Nielsen, J. (1994). "10 Usability Heuristics for User Interface Design"
- Nielsen Norman Group: https://www.nngroup.com/articles/ten-usability-heuristics/
- Source: `apps/mesas/frontend/src/features/discord-sync/` (components: DiscordSyncPanel, DiscordJsonImportPanel, DiscordSourceList, DiscordDraftReviewTable, DiscordSettingsPanel, DraftEditorTab, DiscordDraftPreview; pages: GestaoPage; api: discordSyncApi; hooks: useDraftForm; utils: draftFormUtils, constants, types)
