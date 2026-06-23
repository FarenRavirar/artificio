# Reviews — 049 Revisão Gestão

Reviews de bots/PR coletados durante o ciclo de revisão do módulo mesas.

## REV-001 — Exibir erros de preview no painel de importação

- **Origem:** chatgpt-codex-connector (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/components/DiscordJsonImportPanel.tsx:73-74`
- **Resumo:** Quando `previewJson` rejeita (JSON inválido, export incompatível ou 413 do body parser), `preview_error` não é renderizado em lugar nenhum. O único banner de erro só aparece com `state === 'error'`. O admin fica com o botão Importar desabilitado sem explicação, parecendo UI travada.
- **Severidade declarada:** P2 (Badge)
- **Status:** implementado ✅
- **Task vinculada:** TE11/TE16 (extrair hook useJsonImport / unificar estados)
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo:** `DiscordJsonImportPanel.tsx`
  - **LoadPreview catch (L71-75):** seta `state('preview_error')` + `errorMessage`
  - **Render (L183-351):** bloco de erro só em `state === 'error'` (L346-350). Nenhum bloco para `preview_error`
  - **Botão Importar (L233):** `disabled={state !== 'preview_ok' && state !== 'success'}` — fica desabilitado em `preview_error`
  - **Impacto real:** usuário vê botão desabilitado sem mensagem. UI parece travada.
  - **Severidade real:** P2 — bloqueia fluxo sem feedback, mas sem perda de dados
  - **Risco de regressão:** baixo — adicionar bloco condicional para `preview_error` no JSX
  - **Recomendação:** adicionar `<div>` de erro para `state === 'preview_error'` análogo ao de `state === 'error'`, ou unificar os dois tratamentos (TE16 propõe `GestaoStateWrapper`)
- **Implementação:**
  - Bloco de render adicionado entre o preview_ok e o success (L302-307): `<div>` com bg-red-900 border-red-600 exibindo `errorMessage` quando `state === 'preview_error'`
  - Testes: 165/165 ✅
  - Build: sem erros ✅

## REV-002 — Alinhe o limite do arquivo ao limite real do POST

- **Origem:** chatgpt-codex-connector (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/components/DiscordJsonImportPanel.tsx:25` (MAX_FILE_SIZE_BYTES), `apps/mesas/backend/src/server.ts:88` (express.json limit)
- **Resumo:** O seletor de arquivo aceita até 10 MB brutos, mas preview/import embrulham o conteúdo em `{json: rawJson}` e enviam pelo `express.json({ limit: '10mb' })`. Exports válidos perto do limite (9-10 MB) inflacionam ao passar por `JSON.stringify` e são rejeitados antes das rotas. Reduza o limite do cliente para o payload codificado ou aumente/trate o limite do servidor.
- **Severidade declarada:** P2 (Badge)
- **Status:** implementado ✅
- **Task vinculada:** TE11 (extrair useJsonImport) ou fix avulso
- **Débito vinculado:** —
- **Investigação:**
  - **Client (L25):** `MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024`
  - **Server (L88):** `express.json({ limit: '10mb' })` — rejeita payloads > 10 MB antes do handler
  - **Preview request (`discordSyncApi.ts:265`):** body = `JSON.stringify({json: rawJson})` — rawJson de 10 MB vira ~10MB + overhead de wrapping (~11 bytes)
  - **Efeito:** exports de 9.5-10 MB passam no client mas são rejeitados pelo Express com 413 antes do handler HTTP → erro genérico no catch do loadPreview
  - **Impacto real:** usuário perde tempo com export grande que falha silenciosamente (erro de preview, REV-001)
  - **Severidade real:** P2 — afeta casos extremos, mas é armadilha frustrante
  - **Risco de regressão:** baixo — aumentar server limit para 12 MB ou reduzir client limit para 9 MB
- **Implementação:**
  - Server `express.json({ limit: '10mb' })` → `'12mb'` (margem de 20% para overhead de wrapping + escaping)
  - Client mantido em 10 MB
  - Testes: 223/223 backend ✅ | 165/165 frontend ✅
  - Build: sem erros ✅

## REV-003 — Não converta falhas de infraestrutura em erro de validação do cliente

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/backend/src/discord/chatExporterImportService.ts:56-61`
- **Resumo:** O catch sem filtro no `ensureDiscordImportSource` transforma qualquer erro de banco em `DiscordChatExporterValidationError`. Como essa exceção vira HTTP 400 na rota de import, falhas internas passam a parecer erro de payload do cliente.
- **Severidade declarada:** 🟠 Major | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** TE1 (já extraiu para chatExporterImportService) — fix pós-extração
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo:** `chatExporterImportService.ts:56-61`
  - **Catch (L59-60):** `catch { throw new DiscordChatExporterValidationError(...) }` — catch **sem parâmetro**, sem log, sem filtro. Erro original descartado.
  - **`ensureDiscordImportSource` (L21-41):** faz SELECT + INSERT no DB — pode lançar erro de conexão, timeout, chave duplicada, etc.
  - **Handler `import.ts:37-38`:** `DiscordChatExporterValidationError` → HTTP 400
  - **Impacto real:** DB down → admin vê "Não foi possível criar a fonte do canal." como se fosse erro de payload. Sem diagnóstico. O erro real não é logado em lugar nenhum.
  - **Severidade real:** 🟠 Major — oculta falha de infra, impede diagnóstico remoto
  - **Risco de regressão:** médio — separar erros de DB de erros de validação muda o fluxo de catch; requer teste de integração
  - **Recomendação:** logar o erro original; relançar como genérico (500), não como validation error (400)
- **Implementação:**
  - Catch agora loga o erro (`console.error`) e relança como `Error` genérico → cai no handler 500 em `import.ts:40-41`
  - `DiscordChatExporterValidationError` removido do import (não mais usado no arquivo)
  - Testes: 223/223 backend ✅
  - Build: sem erros ✅

## REV-004 — Cobrir verified_by no cenário verified: false para evitar regressão de contrato

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/backend/src/routes/adminProfile.test.ts:83-92`
- **Resumo:** O teste valida `covil_verified` e `verified_at` no caso `verified: false`, mas não valida `verified_by`. Isso deixa passar divergência entre persistência e payload de resposta quando o selo é removido.
- **Severidade declarada:** 🟡 Minor | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** task de teste avulsa
- **Débito vinculado:** —
- **Investigação:**
  - **Rota `adminProfile.ts:36-42`:** resposta SEMPRE inclui `verified_by: adminId` (L39), independente de `verified`
  - **Teste (L83-92):** verifica `covil_verified` (L90) e `verified_at` (L91), mas não `verified_by`
  - **Impacto real:** se `verified_by` for removido da resposta (refactor), o teste passa e o contrato quebra silenciosamente
  - **Severidade real:** 🟡 Minor — não afeta runtime, apenas resiliência de teste contra regressão
  - **Risco de regressão:** nulo (adição de assert em teste)
  - **Recomendação:** adicionar `expect(res.body.data.verified_by).toBe('admin-user');` no teste de `verified: false`
- **Implementação:**
  - Adicionado `expect(res.body.data.verified_by).toBe('admin-user');` no teste `verified: false`
  - Testes: 6/6 adminProfile ✅ | 223/223 backend ✅
  - Build: sem erros ✅

## REV-005 — Corrija a semântica de messagesWithAttachments e messagesWithEmbeds

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/backend/src/routes/discord/preview.ts:29-30`
- **Resumo:** O cálculo soma anexos/embeds (`attachmentsCount`, `embedsCount`), mas os campos retornados (`messagesWithAttachments`, `messagesWithEmbeds`) indicam quantidade de mensagens que possuem anexos/embeds, não a soma total de anexos/embeds.
- **Severidade declarada:** 🟡 Minor | ⚡ Quick win
- **Status:** implementado ✅ (decisão: renomear)
- **Task vinculada:** —
- **Débito vinculado:** —
- **Investigação:**
  - **Código `preview.ts:29-30`:** `reduce` soma `attachments.length` e `embeds.length` por mensagem → total de itens
  - **Resposta (L39-40):** campo chamado `messagesWithAttachments` / `messagesWithEmbeds` mas o valor é **soma de anexos/embeds**, não de mensagens
  - **Frontend (`DiscordJsonImportPanel.tsx:277-283`):** renderiza como "Com anexos" e "Com embeds"
  - **Impacto real:** se 1 mensagem tem 5 anexos, mostra "Com anexos: 5" → parece que 5 mensagens têm anexo
  - **Severidade real:** 🟡 Minor — não quebra fluxo, mas engana o admin
  - **Decisão necessária:** mudar o nome do campo no backend (ex.: `totalAttachments`) OU mudar o cálculo para contar mensagens com `attachments.length > 0`
  - **Consumidor:** apenas o frontend do mesas (`DiscordJsonImportPanel.tsx:277-283` + `discordSyncApi.ts:273-274` schema Zod) — mudança isolada
- **Implementação:**
  - Decisão do mantenedor: renomear
  - Backend `preview.ts:39-40`: `messagesWithAttachments` → `totalAttachments`, `messagesWithEmbeds` → `totalEmbeds`
  - Frontend `discordSyncApi.ts:273-274`: Zod schema renomeado
  - Frontend `DiscordJsonImportPanel.tsx`: interface + JSX renomeados, label "Com anexos" → "Anexos", "Com embeds" → "Embeds"
  - Testes `discordSyncApi.test.ts` + `DiscordJsonImportPanel.test.tsx`: mock data renomeado
  - Testes: 165/165 frontend ✅ | 223/223 backend ✅
  - Build: sem erros ✅

## REV-006 — Evite expor mensagens internas de exceção nas respostas da API

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/backend/src/routes/discord/sync.ts:44-45`
- **Resumo:** Mensagens brutas de erro (`error.message`) são devolvidas ao cliente, podendo vazar detalhes internos (query/estrutura/stack fragmentada). Retorne texto genérico ao cliente e mantenha o detalhe apenas em log.
- **Severidade declarada:** 🟠 Major | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** TE4 (separar sync.ts) — fix na separação
- **Débito vinculado:** —
- **Investigação:**
  - **Código `sync.ts:44`:** `const message = error instanceof Error ? error.message : 'Erro ao sincronizar draft.';` — vaza mensagem original do erro
  - **Código `sync.ts:45`:** `return res.status(500).json({ error: message });`
  - **Demais handlers no mesmo módulo:** todos usam string fixa (`preview.ts:49`, `import.ts:41`, `sync.ts:74`)
  - **Impacto real:** erro de banco ou validação interna pode expor SQL, pathnames, estrutura de dados
  - **Severidade real:** 🟡 Minor — risco baixo (só admin acessa /gestao), mas prática insegura
  - **Risco de regressão:** nulo — trocar `error.message` por string fixa `'Erro ao sincronizar draft.'`
- **Implementação:**
  - `sync.ts:44-45`: removido `error.message` — usa string fixa `'Erro ao sincronizar draft.'`
  - Testes: 223/223 backend ✅
  - Build: sem erros ✅

## REV-007 — Erros de pré-visualização/arquivo não ficam visíveis e podem manter estado inconsistente

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/components/DiscordJsonImportPanel.tsx:71-75`
- **Resumo:** `errorMessage` é setado em múltiplos caminhos de preview/arquivo, mas o banner só renderiza em `state === 'error'`. Isso oculta falhas de preview e validação de arquivo, e pode manter `preview_ok` ativo após tentativa inválida.
- **Severidade declarada:** 🟠 Major | ⚡ Quick win
- **Status:** implementado ✅ (integrado a REV-001)
- **Task vinculada:** TE11/TE16
- **Débito vinculado:** —
- **Investigação:**
  - **`loadPreview` catch (L71-75):** seta `state('preview_error')` + `errorMessage` — erro invisível (mesmo caso de REV-001)
  - **`handleFileSelect` (L119-142):** valida formato (L126) e tamanho (L131) e leitura (L140) — setam `errorMessage` mas **não mudam state**. Erro invisível.
  - **`handleDrop` (L156-181):** mesmo padrão — L165, 170, 179 setam `errorMessage` sem state change
  - **Estado inconsistente:** se preview anterior deu `preview_ok` (com preview data visível) e o usuário solta arquivo inválido, `preview_ok` + preview antigo permanecem na tela enquanto `errorMessage` (invisível) contém o erro real
  - **Impacto real:** admin arrasta arquivo muito grande → vê preview velho, sem saber que falhou. Tenta importar → importa dados velhos.
  - **Severidade real:** 🟠 Major — pode causar import de dados errados sem percepção do admin
  - **Risco de regressão:** médio — requer resetar estado ao detectar erro em file/drop/preview
- **Implementação:**
  - Extraído helper `showFileError(msg)` que limpa preview, seta state `'error'` + errorMessage
  - Usado em todos os 6 paths de erro em `handleFileSelect` e `handleDrop` (validação de formato, tamanho, leitura)
  - Testes: 165/165 frontend ✅
  - Build: sem erros ✅

## REV-008 — handleClear deveria cancelar preview pendente

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/components/DiscordJsonImportPanel.tsx:78-83`
- **Resumo:** Se o usuário limpar antes dos 400ms do debounce, o timeout antigo ainda executa e pode restaurar preview/estado com JSON já descartado.
- **Severidade declarada:** 🟡 Minor | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** TE11 (extrair useJsonImport)
- **Débito vinculado:** —
- **Investigação:**
  - **`handleClear` (L111-117):** limpa estado mas **não** `clearTimeout(debounceRef.current)`
  - **`schedulePreview` (L78-82):** seta `debounceRef.current = setTimeout(() => loadPreview(value), 400)`
  - **Cena:** admin digita JSON → <400ms depois clica "Limpar" → UI limpa → timeout dispara `loadPreview(JSON_velho)` → preview reaparece
  - **Impacto real:** admin acha que limpou, mas preview volta. Pode clicar "Importar" importando dado que pensava ter removido.
  - **Severidade real:** 🟡 Minor — confuso, baixo risco de import indesejado (precisa clicar Importar)
  - **Risco de regressão:** nulo — adicionar `clearTimeout` no handleClear
- **Implementação:**
  - Adicionado `if (debounceRef.current) clearTimeout(debounceRef.current)` no início do `handleClear`
  - Testes: 165/165 frontend ✅
  - Build: sem erros ✅

## REV-009 — Evite reimplementar lógica da feature dentro do teste

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/components/DiscordSourceList.test.tsx:21-45`
- **Resumo:** Os blocos `getChannelKindLabel` e `getChannelPrefix` no teste testam helpers locais, não o comportamento real do `DiscordSourceList`. Isso pode passar mesmo com regressão no componente.
- **Severidade declarada:** 🟡 Minor | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:**
- **Débito vinculado:** —
- **Investigação:**
  - **Componente `DiscordSourceList.tsx`:** `getChannelKindLabel` (L42-46) e `getChannelPrefix` (L48-50) — funções internas não exportadas
  - **Teste `DiscordSourceList.test.tsx`:** L22-26 e L36-38 definem as mesmas funções e testam a cópia local
  - **Testes de render já cobrem a lógica:** L145-147 testam labels "Texto"/"Anúncio"/"Fórum" via DOM; L160-162 testam prefixos "#" / "Fórum " via DOM
  - **Impacto real:** se a lógica real mudar, os testes locais passam mas os de render quebram (já que os de render usam o componente real)
  - **Severidade real:** 🟡 Minor — testes redundantes, cobertura indireta já existe
  - **Recomendação:** remover os describe's duplicados (L21-45) do test file, ou exportar as funções do componente
- **Implementação:**
  - Removidos describe `getChannelKindLabel` e `getChannelPrefix` do `DiscordSourceList.test.tsx`
  - Testes: 163/163 frontend ✅ (antes 165, -2 describes redundantes)
  - Build: sem erros ✅

## REV-010 — Teste dependente de ordem de render (fetchButtons[0])

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/components/DiscordSourceList.test.tsx:225-243`
- **Resumo:** O assert usa `fetchButtons[0]` para acionar o botão associado à source `src-1`, mas pode ficar flaky se a ordem da lista mudar. Prefira acionar o botão explicitamente associado à source esperada.
- **Severidade declarada:** 🟡 Minor | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:**
- **Débito vinculado:** —
- **Investigação:**
  - **Teste (L236-242):** `screen.getAllByText('Buscar mensagens')` → `fetchButtons[0]` → assume que o primeiro botão corresponde a `src-1`
  - **mockSources (L47-87):** ordem é `src-1` (text, enabled), `src-2` (announcement, disabled), `src-3` (forum → label diferente)
  - **Hoje funciona** porque `src-1` é o primeiro com label "Buscar mensagens"
  - **Fragilidade:** se `mockSources` for reordenado, ou `src-2` ficar enabled, ou um novo source text for adicionado antes → `fetchButtons[0]` aponta para source errada, assert falha
  - **Impacto real:** teste frágil, pode falhar em refatorações que não tocam a lógica testada
  - **Severidade real:** 🟡 Minor — falso positivo potencial
  - **Recomendação:** usar `within()` ou `data-testid` para associar o botão ao source específico (ex.: encontrar o botão dentro do card que contém "chat-geral")
- **Implementação:**
  - Substituído `fetchButtons[0]` por `within(sourceRow).getByText('Buscar mensagens')` onde `sourceRow` = elemento com `chat-geral` (nome do source)
  - Adicionado `within` ao import do testing-library
  - Testes: 10/10 DiscordSourceList ✅ | 163/163 frontend ✅
  - Build: sem erros ✅

---

## REV-011 — Evitar template literals aninhados

- **Origem:** code quality tool
- **Tipo:** check (código estático)
- **Referência:** `apps/mesas/backend/src/routes/discord/preview.ts:46`
- **Resumo:** Template literals aninhados (template dentro de template) dificultam leitura e manutenção. Refatorar para não usar aninhamento.
- **Severidade declarada:** Major | 10min effort
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Código (L46):** `\`JSON inválido...${issues.length ? \` ${issues.join('; ')}\` : ''}\`` — template aninhado dentro de ternário
  - **Linha:** ~130 chars, lógica condicional + template aninhado na mesma linha
  - **Impacto real:** nulo em runtime; afeta apenas legibilidade e syntax highlighting
  - **Alternativa no projeto:** `import.ts:40-41` e `preview.ts:49` usam strings fixas — não há padrão de template aninhado no módulo
  - **Severidade real:** 🟡 Minor — cosmético, não afeta comportamento
  - **Risco de regressão:** nulo — extrair string para variável é refatoração mecânica
  - **Recomendação:** extrair `const suffix = issues.length ? \` ${issues.join('; ')}\` : '';` antes do return
- **Implementação:**
  - Extraído `const detail = issues.length > 0 ? \` ${issues.join('; ')}\` : '';` antes do return
  - Template aninhado eliminado
  - Testes: 223/223 backend ✅
  - Build: sem erros ✅

## REV-012 — Preferir Blob.text() sobre FileReader.readAsText

- **Origem:** code quality tool
- **Tipo:** check (código estático)
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/components/DiscordJsonImportPanel.tsx:37-44`
- **Resumo:** `FileReader.readAsText` é verboso e propenso a erro. `Blob.text()` (Promise-based) é mais conciso e moderno.
- **Severidade declarada:** Major | 5min effort
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Código (L37-44):** `readText` envolve `FileReader.readAsText` em uma Promise manual
  - **Callers:** L135 (`handleFileSelect`) e L174 (`handleDrop`) — ambos usam `.then()`, compatível com `file.text()` que retorna Promise<string>
  - **Suporte:** `Blob.text()` é padrão desde ES2015; `tsconfig.app.json` target **ES2023** — sem preocupação de compatibilidade
  - **Uso no projeto:** `readText` só existe neste arquivo (não é compartilhada)
  - **Impacto real:** nulo — padrão funcional mas antigo
  - **Severidade real:** 🟡 Minor — modernização sem ganho funcional
  - **Risco de regressão:** nulo — substituição 1:1
  - **Recomendação:** substituir `readText` por `file.text()` inline em L135 e L174, remover a função `readText`
- **Implementação:**
  - Removida função `readText` (FileReader wrapper)
  - Substituídas chamadas `readText(file)` por `file.text()` em handleFileSelect e handleDrop
  - Testes: 163/163 frontend ✅
  - Build: sem erros ✅

## REV-013 — Marcar props do componente como readonly

- **Origem:** code quality tool
- **Tipo:** check (código estático)
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/components/DiscordJsonImportPanel.tsx:33-35`
- **Resumo:** As props da interface `DiscordJsonImportPanelProps` deveriam ser marcadas como `readonly` para evitar mutação acidental e melhorar a intenção do tipo.
- **Severidade declarada:** Minor | 5min effort
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Código (L33-35):** `interface DiscordJsonImportPanelProps { onNavigateToDrafts?: () => void; }` — sem `readonly`
  - **Padrão no projeto:** `DiscordDraftReviewTable.tsx:8-11` e `DiscordDraftPreview.tsx:7-11` já usam `readonly` nas props
  - **Impacto real:** nulo — TypeScript não reclama, mas inconsistente com padrão local
  - **Severidade real:** 🟡 Minor — consistência, sem impacto funcional
  - **Risco de regressão:** nulo — adicionar `readonly` não altera runtime
  - **Recomendação:** `interface DiscordJsonImportPanelProps { readonly onNavigateToDrafts?: () => void; }`
- **Implementação:**
  - Adicionado `readonly` na prop `onNavigateToDrafts`
  - Testes: 163/163 frontend ✅
  - Build: sem erros ✅

## REV-014 — Usar section com aria-label em vez de role="region"

- **Origem:** code quality tool
- **Tipo:** check (código estático)
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/components/DiscordJsonImportPanel.tsx:193-198`
- **Resumo:** O atributo `role="region"` sem `aria-label` ou `aria-labelledby` não é suficientemente acessível. Preferir `<section aria-label="...">` para melhor suporte a leitores de tela.
- **Severidade declarada:** Minor | 5min effort
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Código (L193-198):** `<div role="region" aria-label="Área de importação de JSON" ...>`
  - **Justificativa:** `<section>` tem `role=region` implícito quando tem nome acessível. `aria-label` já existe — a troca é apenas de tag HTML
  - **Única ocorrência:** `rg role=\"region\"` retorna só este arquivo no frontend do mesas
  - **Impacto real:** nenhum — comportamento acessível idêntico
  - **Severidade real:** 🟡 Minor — preferência semântica, sem ganho funcional
  - **Risco de regressão:** nulo — `<section>` é elemento inline-level por padrão, mesmo comportamento de fluxo
  - **Recomendação:** trocar `<div role="region" ...>` por `<section ...>` mantendo `aria-label` e demais props
- **Implementação:**
  - `<div role="region" ...>` → `<section ...>` (implicit role=region)
  - Testes: 163/163 frontend ✅
  - Build: sem erros ✅

## REV-015 — Router de drafts montado em /messages expõe rotas de draft sob URL de mensagens

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/backend/src/routes/adminDiscordSync.ts:682` + `apps/mesas/backend/src/routes/discord/drafts.ts`
- **Resumo:** `router.use('/messages', draftsRouter)` reaproveita o router inteiro de drafts em /messages, publicando também `GET /messages/:id`, `POST /messages/:id/reparse` e `POST /messages/:id/refresh-image` onde `:id` passa a ser tratado como draft id dentro de URL de mensagens. Extrair só o parse de mensagem para um router dedicado.
- **Severidade declarada:** 🟠 Major | 🏗️ Heavy lift
- **Status:** implementado ✅
- **Task vinculada:** TE6 (extração de drafts)
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo:** `adminDiscordSync.ts:682` → `router.use('/messages', draftsRouter)`
  - **Drafts router (`drafts.ts`):** contém `GET /`, `GET /:id`, `PATCH /:id`, `POST /:id/refresh-image`, `POST /:id/reparse`, `POST /:id/parse`
  - **Rotas intencionais já existentes em `/messages`:** `GET /messages` (L580), `PATCH /messages/:id` (L617), `POST /messages/:id/diagnose-content` (L639), `POST /messages/parse-batch` (L478) — todas registradas ANTES do sub-router (L682), então matcheam primeiro
  - **Rotas expostas não intencionalmente via sub-router:**
    - `GET /messages/` (drafts `GET /`): lista drafts em URL de mensagens — **alcançável** se trailing slash
    - `GET /messages/:id` (drafts `GET /:id`): retorna draft por ID em URL de mensagens — **alcançável**, sem handler `GET /messages/:id` top-level
    - `POST /messages/:id/reparse` (drafts `POST /:id/reparse`): **alcançável**, mas frontend usa `/drafts/:id/reparse`
    - `POST /messages/:id/refresh-image` (drafts `POST /:id/refresh-image`): **alcançável**, frontend não chama
  - **Rota intencional:** `POST /messages/:id/parse` (drafts `POST /:id/parse`, L209) — comentário explícito "mounted at /messages" (L207). Usada pelo frontend em `discordSyncApi.ts:218`
  - **Sem conflito para `PATCH /messages/:id`** — handler top-level L617 registrado primeiro (Express processa em ordem), sub-router não alcançado
  - **Frontend não chama:** `GET /messages/:id`, `POST /messages/:id/reparse`, `POST /messages/:id/refresh-image`
  - **Impacto real:** API surface poluída com 4 rotas fantasmas que operam em drafts mas parecem operar em mensagens. Nenhuma quebra funcional. Todas requerem admin auth. Sem bypass de segurança ou corrupção de dados.
  - **Severidade real:** 🟡 Minor — confusão de API, sem quebra funcional, sem risco de dados
  - **Risco de regressão:** baixo-médio — extrair `POST /:id/parse` para router dedicado requer mover handler e atualizar import; erro quebra `parseMessage` do frontend
  - **Recomendação:** extrair `POST /:id/parse` de `drafts.ts` para router próprio (ex.: `messageParseRouter.ts`) montado em `/messages`; remover `router.use('/messages', draftsRouter)` de adminDiscordSync. Rotas fantasmas somem, rota intencional permanece.
- **Conclusão:** Procede. Severidade real Minor (não Major). Deve ser implementado: extrair handler de parse para router dedicado.
- **Implementação:**
  - Criado `apps/mesas/backend/src/routes/discord/messageParse.ts`: router dedicado com `POST /:id/parse`, copiado de `drafts.ts`
  - Corrigido indentação do `const parsed` que estava com 8 espaços extras (L223 do drafts.ts original)
  - `adminDiscordSync.ts`: adicionado import de `messageParseRouter`, substituído `router.use('/messages', draftsRouter)` por `router.use('/messages', messageParseRouter)`
  - `drafts.ts`: removido handler `POST /:id/parse` (L207-303)
  - Testes: 223/223 backend ✅
  - Build: sem erros ✅

## REV-016 — Patch parcial substitui normalized_payload inteiro em vez de mesclar

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/backend/src/routes/discord/drafts.ts:104-106`
- **Resumo:** `updateDraftPayloadSchema` aceita patches parciais, mas `.set({ ...parsed.data })` grava `normalized_payload` como substituição completa. Um PATCH com apenas `{ normalized_payload: { table: { title } } }` apaga source, missing_fields e demais campos já salvos. Mesclar o payload parcial antes de persistir.
- **Severidade declarada:** 🟠 Major | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** TE6 (extração de drafts)
- **Débito vinculado:** DEB-017 (merge parcial de normalized_payload no PATCH de drafts)
- **Investigação:**
  - **Arquivo:** `drafts.ts:104-106`
  - **Código:** `.set({ ...parsed.data, updated_at: new Date() })` — spread direto de `parsed.data` no objeto de update do Kysely. `normalized_payload` presente em `parsed.data` → coluna JSONB inteira substituída
  - **Schema:** `updateDraftPayloadSchema` (L18-20) = `.passthrough()` — aceita qualquer chave em `normalized_payload`, inclusive parciais
  - **Kysely behavior:** `undefined` em `.set()` é ignorado pelo Kysely — não envia a coluna. Quando `normalized_payload` não está em `parsed.data` (handleSaveStatus), a coluna não é tocada. CORRETO.
  - **Frontend (`useDraftForm.ts`):** 3 chamadas:
    - `handleSaveFields` (L133): envia `normalized_payload` **completo** (merge via `buildUpdatedPayload`) ✅
    - `handleConfirmSlots` (L227): envia `normalized_payload` **completo** com slots corrigidos ✅
    - `handleSaveStatus` (L292): envia **apenas** `{ status, review_notes }` — sem `normalized_payload`. Kysely não toca a coluna. ✅
  - **Cenário de risco:** admin envia PATCH manual (`curl`, Postman, ferramenta futura) com `{ normalized_payload: { table: { title } } }` — validação passa (`.passthrough()`), DB sobrescreve coluna inteira, perde `source`, `missing_fields`, `table.system`, `table.owner`, `table.slots`, etc.
  - **Impacto real:** NENHUM no runtime atual — frontend nunca envia payload parcial. Risco futuro: refatoração ou chamada manual.
  - **Severidade real:** 🟡 Minor — design flaw sem manifestação atual
  - **Risco de regressão:** baixo — merge adiciona segurança sem quebrar chamadas existentes (frontend sempre envia payload completo, merge resultaria no mesmo valor)
  - **Recomendação:** mergear `normalized_payload` recebido com o existente antes de persistir. Ex.: `const mergedPayload = { ...(current.normalized_payload as Record<string, unknown>), ...(parsed.data.normalized_payload ?? {}) }` e usar `mergedPayload` no `.set()` em vez de `parsed.data.normalized_payload`. Isto garante semântica PATCH real.
- **Conclusão:** Procede tecnicamente, mas impacto real zero no momento. A correção é preventiva. Registrar como débito separado já que depende de mudança no backend (merge) e a tarefa original (TE6) é de extração, não correção de comportamento.
- **Implementação:**
  - `drafts.ts:104-112`: adicionado `mergedNormalizedPayload` que faz merge shallow em nível top-level do `normalized_payload` recebido com o existente (`current.normalized_payload`)
  - Se `normalized_payload` não está presente no PATCH body, o campo não é passado ao `.set()` (coluna não é tocada pelo Kysely)
  - Testes: 223/223 backend ✅
  - Build: sem erros ✅

## REV-017 — parseJsonField inconsistente entre branch string e branch objeto

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/backend/src/routes/discord/utils.ts:15-16`
- **Resumo:** Quando o campo antigo vem como string contendo `{ "items": [...] }` ou `{ "data": [...] }`, o branch string retorna `[]`, embora o branch de objeto suporte esses wrappers. Reaproveitar a normalização após `JSON.parse` para manter o comportamento consistente.
- **Severidade declarada:** 🟡 Minor | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** TE6 (utils.ts)
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo:** `utils.ts:7-19` — função `parseJsonField`
  - **Branch objeto (L9-14):** suporta `{ items: [...] }` e `{ data: [...] }` via acesso direto a propriedades. ✅
    - `record.items` → se array, retorna
    - `record.data` → se array, retorna
    - fallback: `Object.values(record)`
  - **Branch string (L15-16):** `JSON.parse(value)` → `Array.isArray(parsed) ? parsed : []`
    - Se o JSON string contém array puro `'[1,2,3]'` → retorna array ✅
    - Se o JSON string contém objeto wrapper `'{"items": [1,2,3]}'` → `JSON.parse` → objeto → `Array.isArray` false → retorna `[]` ❌
  - **Inconsistência:** o branch string NÃO reaproveita a lógica de normalização do branch objeto. O mesmo dado em formatos diferentes produz resultados diferentes.
  - **Dados reais:** tabela `discord_import_messages` tem colunas `attachments` e `embeds` como JSONB com tipo Kysely `Generated<unknown[]>`. Todos os caminhos de escrita gravam arrays puros (`ingestMessages.ts:240-241`, `chatExporterImportService.ts:85`). Nenhum caminho de escrita atual produz `{"items": [...]}`, `{"data": [...]}` ou string JSON.
  - **Cenário de risco:** apenas dados legados ou migração manual que armazene attachments/embeds como string JSON com wrapper. Nenhum caminho atual de produção atinge esse cenário.
  - **Impacto real:** NENHUM no runtime atual — dados sempre chegam como array. Defesa para cenário improvável.
  - **Severidade real:** 🟡 Minor — inconsistência em código defensivo, sem trigger real
  - **Risco de regressão:** nulo — reaproveitar a normalização do branch objeto no branch string é aditivo (só muda comportamento para o caso que hoje retorna `[]` incorretamente)
  - **Recomendação:** no branch string, após `JSON.parse(parsed)`, se não for array, fazer as mesmas verificações de `items`/`data` que o branch objeto faz. Ex.: `if (typeof parsed === 'object' && parsed && Array.isArray((parsed as Record<string, unknown>).items)) return (parsed as Record<string, unknown>).items;`
- **Conclusão:** Procede. Inconsistência real em código defensivo. Sem trigger atual, mas a correção é trivial e torna o comportamento consistente entre todos os formatos de entrada possíveis.
- **Implementação:**
  - `utils.ts:15-26`: branch string de `parseJsonField` agora replica a lógica de normalização do branch objeto — após `JSON.parse`, se não for array, verifica `record.items` e `record.data` antes de retornar `[]`
  - Testes: 223/223 backend ✅
  - Build: sem erros ✅

## REV-018 — ensureSystemSuggestionForDraft sem try/catch pode derrubar parse concluído

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/backend/src/routes/discord/utils.ts:54-101`
- **Resumo:** `ensureSystemSuggestionForDraft` é efeito colateral pós-parse; se o select/insert em `system_suggestions` falhar, os endpoints que já criaram/atualizaram o draft retornam 500 e podem deixar mensagem/draft em estado inconsistente. Isolar essa falha com try/catch + console.error.
- **Severidade declarada:** 🟠 Major | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** TE6 (utils.ts)
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo:** `utils.ts:54-101` — `ensureSystemSuggestionForDraft`
  - **Código:** SELECT + INSERT em `system_suggestions` + `notifyAdmins`. SELECT e INSERT SEM try/catch interno. `notifyAdmins` (adminNotifications.ts:26-53) já tem try/catch interno que engole erro — não propaga.
  - **Call sites (4):**

    | # | Local | Tipo | Ocorrência | Impacto do throw |
    |---|---|---|---|---|
    | 1 | `adminDiscordSync.ts:169-173` — `createOrUpdateDraftFromMessage()` | Auto-parse em lote | Chamado por `parsePendingMessagesForSource` (L205) | Catch (L208) seta msg status='error', parse_error=msg erro. Parse já tinha setado status='parsed' (L164-167) e draft já foi criado (L137-161). **Msg regride de 'parsed' para 'error' → re-parse no próximo ciclo** |
    | 2 | `adminDiscordSync.ts:554-558` — POST /messages/parse-batch | Parse em lote manual | Na iteração do for | Catch (L561) seta msg status='error', parse_error. **Mesmo impacto: regride para 'error'** |
    | 3 | `drafts.ts:194-198` — POST /:id/reparse | Reparse manual | Fora do loop, após update do draft (L181-192) | Catch (L201) retorna 500. Draft já atualizado. **Retorna 500 mesmo com reparse bem-sucedido. Idempotente, sem corrupção.** |
    | 4 | `drafts.ts:286-290` — POST /:id/parse | Parse manual | Após criar/atualizar draft e setar msg='parsed' (L249-284) | Catch (L293) seta parse_error na msg mas **não altera status** (msg fica 'parsed'). HTTP 500. **Msg fica com parse_error enganoso (sugestão falhou, não o parse).** |

  - **Fluxo de falha (pior caso, path #1):**
    1. Parse bem-sucedido → draft criado/atualizado ✅
    2. Message status setado para 'parsed' ✅
    3. `ensureSystemSuggestionForDraft` falha (DB timeout, constraint) ❌
    4. Catch do loop seta message de volta para 'error' com parse_error = "violação de chave duplicada em system_suggestions"
    5. Próximo parse-batch re-processa a mensagem → cria/atualiza draft novamente (idempotente)
    6. **Trabalho desperdiçado, sem corrupção permanente**
  - **Cenário pior (path #1):** Se DB de suggestions está persistentemente quebrado (schema issue), a mensagem fica num loop infinito de parse → erro → re-parse → erro, consumindo recursos a cada ciclo.
  - **Impacto real:** Moderado. Mensagens corretamente parseadas são marcadas como erro e re-processadas. Drafts não são corrompidos (idempotentes). Mas consumo de recursos é desperdiçado e logs ficam poluídos.
  - **Severidade real:** 🟠 Major — side effect falho contamina o estado da mensagem e causa re-trabalho no ciclo de parse
  - **Risco de regressão:** nulo — envolver a chamada em try/catch é aditivo, só muda comportamento na falha
  - **Recomendação:** envolver cada chamada de `ensureSystemSuggestionForDraft` em try/catch local que loga o erro e não propaga. A sugestão é best-effort, não deve abortar o parse. Fix ideal: fazer o catch no próprio `ensureSystemSuggestionForDraft` (assim todos os call sites ganham proteção automática) ou em cada call site. A primeira opção (try/catch dentro da função) é mais robusta contra novos call sites.
- **Conclusão:** Procede. Mantém severidade 🟠 Major. Correção deve isolar o efeito colateral (sugestão) do fluxo principal (parse), seja por try/catch interno na função ou em cada call site. A falha não deve contaminar o estado da mensagem nem causar re-trabalho.
- **Implementação:**
  - `utils.ts:54-102`: função `ensureSystemSuggestionForDraft` agora envolve todo o corpo (após early return) em try/catch que loga o erro via `console.error` e não propaga
  - A função continua sendo chamada nos mesmos 4 call sites — agora é segura por padrão (proteção automática para novos call sites)
  - Testes: 223/223 backend ✅
  - Build: sem erros ✅
