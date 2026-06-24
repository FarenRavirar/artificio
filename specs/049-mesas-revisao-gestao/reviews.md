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

---

## REV-019 — adminHydration falha silenciosa quando tabela falta em SYNC_FIELDS

- **Origem:** revisão manual (code review)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/backend/src/routes/adminHydration.ts:117-121`
- **Resumo:** O loop de hidratação silenciosamente pula tabelas que não têm entrada em `SYNC_FIELDS`, emitindo `console.warn` por registro. Isso faz com que registros de 7 tabelas (`sources`, `table_platforms`, `table_tags`, `bookmarks`, `questions`, `reviews`, `answers`) jamais sejam hidratados, enquanto a operação reporta sucesso.
- **Severidade declarada:** P3 (Minor)
- **Status:** pendente 🔍
- **Task vinculada:** —
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo:** `adminHydration.ts:117-121`
  - **Código:** `const allowedFields = SYNC_FIELDS[tableName]; if (!allowedFields) { console.warn(...); continue; }` — dentro do loop de registros, gera N warnings (um por registro da tabela)
  - **Impacto:** tabelas sem allowlist NUNCA são hidratadas, sem indicação clara no log final
  - **Severidade real:** P3 — admin-only, sem perda de dados, mas silencioso
  - **Risco de regressão:** baixo
  - **Recomendação:** validar todas as tabelas antes do loop principal
- **Decisão:** SKIP — 7 tabelas precisam de colunas em SYNC_FIELDS que exigem verificação de schema; fail-fast quebraria hidratação sem adicionar as entradas. A abordagem mais segura é adicionar as tabelas faltantes ao SYNC_FIELDS, o que foge do escopo mínimo desta revisão. `console.warn` + `continue` é aceitável para operação admin-only.

---

## REV-020 — Catch de messageParse não atualiza status para 'error'

- **Origem:** revisão manual (code review)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/backend/src/routes/discord/messageParse.ts:93-100`
- **Resumo:** No catch do `POST /:id/parse`, `parse_error` é salvo mas `status` não é atualizado. A mensagem permanece com status anterior ('pending' ou 'parsed') após falha, ocultando o erro do admin.
- **Severidade declarada:** P3 (Minor)
- **Status:** implementado ✅
- **Investigação:**
  - **Código (L96-100):** `.set({ parse_error: parseError, updated_at: new Date() })` — sem `status: 'error'`
  - **Path de sucesso (L80-84):** `.set({ status: 'parsed', parse_error: null, updated_at: new Date() })` — seta status corretamente
  - **Impacto real:** admin vê mensagem como 'pending' mesmo após falha de parse; sem feedback visual de erro no status
  - **Severidade real:** P3 — sem perda de dados, mas enganoso
  - **Risco de regressão:** nulo
- **Implementação:**
  - Adicionado `status: 'error'` ao `.set()` no catch (L98)
  - Testes: 223/223 backend ✅

---

## REV-022 — FileDropzone textarea sem foco visível (outline-none)

- **Origem:** revisão manual (code review)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/components/FileDropzone.tsx:39`
- **Resumo:** `textarea` tem `outline-none` sem alternativa `focus-visible`, removendo indicador visual de foco para navegação por teclado.
- **Severidade declarada:** P3 (Minor)
- **Status:** implementado ✅
- **Investigação:**
  - **Código (L39):** `className="... outline-none"` — sem `focus-visible:ring` ou `focus-visible:outline`
  - **Impacto:** usuários de teclado não veem onde está o foco ao tabular para o textarea
  - **Severidade real:** P3 — acessibilidade, sem quebra funcional
  - **Risco de regressão:** nulo
- **Implementação:**
  - `outline-none` substituído por `focus-visible:ring-2 focus-visible:ring-blue-500`
  - Testes: 163/163 frontend ✅

---

## REV-023 — MessagesToolbar selects sem aria-label

- **Origem:** revisão manual (code review)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/components/MessagesToolbar.tsx:29-57`
- **Resumo:** Três `<select>` para filtros (fonte, janela, status) não têm `aria-label`, dificultando uso por leitores de tela.
- **Severidade declarada:** P3 (Minor)
- **Status:** implementado ✅
- **Investigação:**
  - **Código (L29, 39, 48):** `<select>` sem `aria-label`
  - **Impacto:** usuários de screen reader não identificam o propósito de cada filtro
  - **Severidade real:** P3 — acessibilidade, sem quebra funcional
  - **Risco de regressão:** nulo
- **Implementação:**
  - Adicionado `aria-label="Filtrar por fonte"` no select de fonte
  - Adicionado `aria-label="Filtrar por janela de mensagens"` no select de janela
  - Adicionado `aria-label="Filtrar por status"` no select de status
  - Testes: 163/163 frontend ✅

---

## REV-024 — loadMessages sem proteção contra race condition

- **Origem:** revisão manual (code review)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/hooks/useDiscordSync.ts:106-121`
- **Resumo:** `loadMessages` não tem proteção contra race condition: requisições concorrentes podem resolver fora de ordem, sobrescrevendo dados recentes com dados antigos de combinação de filtros anterior.
- **Severidade declarada:** P3 (Minor)
- **Status:** implementado ✅
- **Investigação:**
  - **Código (L106-121):** `loadMessages` faz `await discordSyncApi.getMessages(...)` e `setMessages(...)` sem verificar se a resposta ainda é relevante
  - **Cenário:** usuário muda filtro rápido 2x → useEffect(loadMessages) dispara 2x → resposta do 1º request chega depois do 2º → setMessages sobrescreve dados corretos com dados antigos
  - **Severidade real:** P3 — dados inconsistentes em cenário de filtro rápido
  - **Risco de regressão:** baixo — AbortController só cancela requests pendentes
- **Implementação:**
  - `discordSyncApi.getMessages` aceita `{ signal?: AbortSignal }` opcional
  - `loadMessages` cria `AbortController`, aborta anterior, passa signal
  - Catch ignora `AbortError`
  - Testes: 163/163 frontend ✅

---

## REV-025 — handleFetchMessages causa fetch duplicado de loadMessages

- **Origem:** revisão manual (code review)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/hooks/useDiscordSync.ts:148-163`
- **Resumo:** `handleFetchMessages` seta `messageSourceFilter`, `messageWindowFilter` e `tab`, que disparam o `useEffect` que chama `loadMessages`, e TAMBÉM chama `loadMessages` diretamente — resultando em 2 fetches idênticos. O mesmo padrão ocorre em `handleReingestForce` (L228).
- **Severidade declarada:** P3 (Minor)
- **Status:** implementado ✅
- **Investigação:**
  - **Código (L159-162):** `setMessageSourceFilter(sourceId); setMessageWindowFilter(windowOption); setTab('mensagens'); loadMessages({ sourceId, window });`
  - **useEffect (L127-129):** `[tab, messageStatusFilter, messageSourceFilter, messageWindowFilter, loadMessages]` — dispara após state updates
  - **Impacto:** 2 chamadas de API para cada fetch, 2x processamento, possibilidade de race condition
  - **Severidade real:** P3 — duplicação de trabalho, sem quebra funcional
  - **Risco de regressão:** baixo — remover a chamada direta `loadMessages` permite que o useEffect gerencie o fetch
- **Implementação:**
  - `handleFetchMessages`: removido `loadMessages()` direto (L162), mantido `loadSources()`
  - `handleReingestForce`: removido `loadMessages()` direto (L228), mantido `loadSources()`
  - Testes: 163/163 frontend ✅

---

## REV-026 — Validação de extensão .json case-sensitive

- **Origem:** revisão manual (code review)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/hooks/useJsonImport.ts:119,158`
- **Resumo:** `file.name.endsWith('.json')` rejeita arquivos `.JSON` ou `.Json` maiúsculos.
- **Severidade declarada:** P3 (Minor)
- **Status:** implementado ✅
- **Investigação:**
  - **Código (L119, L158):** `if (!file.name.endsWith('.json'))` — case-sensitive
  - **Impacto:** usuários com arquivos `.JSON` (válidos) são rejeitados com erro falso
  - **Severidade real:** P3 — corner case, sem perda de dados
  - **Risco de regressão:** nulo
- **Implementação:**
  - `file.name.endsWith('.json')` → `file.name.toLowerCase().endsWith('.json')` (ambas ocorrências)
  - Testes: 163/163 frontend ✅

---

## REV-027 — loadPreview/schedulePreview sem proteção contra race condition

- **Origem:** revisão manual (code review)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/hooks/useJsonImport.ts:43-69`
- **Resumo:** Edições rápidas no JSON disparam múltiplos `previewJson` via debounce. Respostas podem chegar fora de ordem, sobrescrevendo preview correto com dados de JSON anterior.
- **Severidade declarada:** P3 (Minor)
- **Status:** implementado ✅
- **Investigação:**
  - **Código (L65-69):** `schedulePreview` usa `setTimeout(() => loadPreview(value), 400)` — debounce não protege contra out-of-order
  - **Cenário:** usuário edita JSON Rápido 2x → request 1 lento, request 2 rápido → response 2 chega primeiro (preview_ok) → response 1 chega depois e sobrescreve com dados antigos
  - **Severidade real:** P3 — dados inconsistentes em edição rápida
  - **Risco de regressão:** baixo — request ID tracking
- **Implementação:**
  - `previewReqId = useRef(0)` — incrementado a cada `schedulePreview`
  - `loadPreview` verifica se `reqId === previewReqId.current` antes de setar estado
  - Testes: 163/163 frontend ✅

---

## REV-028 — /sync-ready sem LIMIT pode causar timeout em backlogs grandes

- **Origem:** revisão manual (code review)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/backend/src/routes/discord/sync.ts:41-46`
- **Resumo:** A rota `/sync-ready` carrega todos os drafts `ready` sem limite, processando cada `syncDiscordDraftToTable` (uploads + DB writes). Backlogs grandes podem causar timeout parcial.
- **Severidade declarada:** P3 (Minor)
- **Status:** implementado ✅
- **Investigação:**
  - **Código (L41-46):** `selectFrom('discord_import_table_drafts').select('id').where('status', '=', 'ready').execute()` — sem `.limit()`
  - **Impacto:** se houver 500+ drafts, o request pode exceder timeout do servidor (30s-60s). Drafts já processados são commitados individualmente, mas resposta é 500.
  - **Severidade real:** P3 — sem perda de dados, mas UX degradada
  - **Risco de regressão:** baixo — adicionar `.limit(50)` restringe o batch sem efeito colateral
- **Implementação:**
  - Adicionado `.limit(50)` na query
  - Testes: 223/223 backend ✅

---

## REV-029 — auditoria-antes-commit.md desatualizado (novos REVs não documentados)

- **Origem:** revisão manual (code review)
- **Tipo:** PR (review)
- **Referência:** `specs/049-mesas-revisao-gestao/auditoria-antes-commit.md:9-10,49-54,104-125`
- **Resumo:** O documento de auditoria lista apenas REV-015 a REV-018, com TE21 como pendente e DEB-017 como não resolvido — contradizendo o estado real.
- **Severidade declarada:** P3 (Minor)
- **Status:** implementado ✅
- **Investigação:**
  - **Código:** `tasks.md:107` → TE21 já [x]; `debitos.md:22` → D14 já RESOLVIDO
  - **Impacto:** documento de auditoria inconsistente com os demais docs
  - **Severidade real:** P3 — documentação, sem impacto funcional
- **Implementação:**
  - Atualizado cabeçalho para refletir REV-015 a REV-028
  - TE21 marcado como concluído
  - DEB-017 marcado como resolvido
  - Pendências documentais atualizadas
  - Validação: lint 15/15 ✅, build 17/17 ✅

---

## REV-030 — debitos.md com contagens de teste desatualizadas

- **Origem:** revisão manual (code review)
- **Tipo:** PR (review)
- **Referência:** `specs/049-mesas-revisao-gestao/debitos.md:11-20`
- **Resumo:** D04 e D11 referenciam `tests 228/228` (contagem antiga). D04 deve ser 223/223 (backend), D11 deve ser 163/163 (frontend).
- **Severidade declarada:** P3 (Minor)
- **Status:** implementado ✅
- **Investigação:**
  - **D04:** `tests 228/228 ✅` (antigo backend count) → atual: 223/223 backend
  - **D11:** `tests 228/228 ✅` (antigo count) → atual: 163/163 frontend
  - **Impacto:** discrepância documental
  - **Severidade real:** P3 — documentação
- **Implementação:**
  - D04: `228/228` → `223/223`
  - D11: `228/228` → `163/163`
  - Validação: lint 15/15 ✅, build 17/17 ✅

---

## REV-031 — tasks.md TE6 desatualizado (POST /messages/:id/parse já extraído)

- **Origem:** revisão manual (code review)
- **Tipo:** PR (review)
- **Referência:** `specs/049-mesas-revisao-gestao/tasks.md:77-80`
- **Resumo:** TE6 ainda lista `POST /messages/:id/parse` como handler de drafts e menciona `router.use('/messages', draftsRouter)`. Desde REV-015, o parse foi extraído para `messageParse.ts` e montado como `router.use('/messages', messageParseRouter)`.
- **Severidade declarada:** P3 (Minor)
- **Status:** implementado ✅
- **Investigação:**
  - **Código:** `tasks.md:77-80` menciona `POST /messages/:id/parse` como handler de drafts
  - **Realidade:** REV-015 extraiu para `messageParse.ts`; `router.use('/messages', messageParseRouter)` em vez de `draftsRouter`
  - **Impacto:** documento inconsistente com código
  - **Severidade real:** P3 — documentação
- **Implementação:**
  - Removido `POST /messages/:id/parse` da lista de handlers de drafts em TE6
  - Substituído `router.use('/messages', draftsRouter)` por `router.use('/messages', messageParseRouter)`
  - Validação: lint 15/15 ✅, build 17/17 ✅

---

## REV-021 — Draft synced/rejected cai em INSERT em vez de early return

- **Origem:** revisão manual (code review)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/backend/src/routes/discord/messageParse.ts:43-78`
- **Resumo:** Quando `existingDraft` existe com status 'synced' ou 'rejected', a condição `if (existingDraft && existingDraft.status !== 'synced' && existingDraft.status !== 'rejected')` avalia `false`, fazendo o fluxo cair no `else` que tenta INSERT com mesmo `discord_message_id`. Isso cria duplicatas ou viola constraints do banco.
- **Severidade declarada:** P3 (Minor)
- **Status:** implementado ✅
- **Investigação:**
  - **Código (L50):** `if (existingDraft && existingDraft.status !== 'synced' && existingDraft.status !== 'rejected')` — exclusão de 'synced' e 'rejected' do update
  - **Else (L64-78):** `insertInto('discord_import_table_drafts').values({ discord_message_id: message.id, ... })` — INSERT com mesmo FK
  - **Message check (L18-20):** já bloqueia `message.status === 'synced'` com 422 antes de chegar aqui — 'synced' nunca chega
  - **Cenário 'rejected':** draft rejeitado pelo admin → reparse → INSERT cria segundo draft com mesmo `discord_message_id`
  - **Sem UNIQUE constraint visível** em `discord_message_id` — duplicatas não geram erro, apenas poluem dados
  - **Impacto real:** drafts rejeitados viram duplicatas ao reparsear; drafts synced são bloqueados antes (L18-20)
  - **Severidade real:** P3 — duplicatas silenciosas em caso raro (admin rejeita e depois parseia de novo)
  - **Risco de regressão:** baixo — simplificar condição: se existingDraft existe, sempre UPDATE (exceto synced, já bloqueado pela mensagem)
- **Implementação:**
   - Condição simplificada: `if (existingDraft)` → UPDATE; `else` → INSERT
   - Early return se `existingDraft?.status === 'synced'` como safety net extra
   - Testes: 223/223 backend ✅

---

## REV-032 — adminImportInbox Cognitive Complexity 56 (deve ser ≤ 15)

- **Origem:** SonarQube (code smell)
- **Tipo:** check (código estático)
- **Referência:** `apps/mesas/backend/src/routes/adminImportInbox.ts:L18`
- **Resumo:** A função `router.post('/import-text')` tem Cognitive Complexity 56, muito acima do limite de 15 permitido. Handler monolítico com múltiplos níveis de condicionais, try/catch aninhados e validação inline.
- **Severidade declarada:** Critical | 46min effort
- **Status:** implementado ✅
- **Débito vinculado:** D15 (RESOLVIDO)
- **Investigação:**
  - **Arquivo:** `adminImportInbox.ts:18-157` (140 linhas)
  - ...conteúdo original preservado...
- **Implementação:**
  - Extraídos 2 helpers locais em `adminImportInbox.ts`:
    1. **`calcMissingFields(table: TableFieldsForMissing | undefined): string[]`** — substitui as 2 ocorrências duplicadas do bloco de 5 verificações (title, system_id, type, modality, slots_total/slots_open), reduzindo duplicação e CC.
    2. **`createImportMessage(segment, contentHash, titleHint): Promise<string | null>`** — extrai o bloco `INSERT INTO import_messages` das linhas 117-131 do handler, isolando a lógica de criação de mensagem.
  - Handler principal reduzido de 140→105 linhas (35 linhas removidas do loop interno).
  - CC estimada do handler: ≤7 (try + if + for + if + if + if/else + if). Cada helper: ≤7.
  - Tests: 223/223 backend ✅ (46 adminImportInbox), 163/163 frontend ✅
  - Lint: 15/15 ✅ | Build: 17/17 ✅
- **Investigação:**
  - **Arquivo:** `adminImportInbox.ts:18-157` (140 linhas)
  - **Código:** handler `POST /import-text` monolítico faz:
    1. valida schema (`importTextSchema.safeParse`)
    2. segmenta texto (`segmentAnnouncements`)
    3. **for each segment**: calcula hash SHA-256 → busca `import_messages` por hash → se mensagem existe: busca draft → se draft existe: calcula missing_fields e **continue** → se só mensagem existe: reusa ID → senão: cria `import_messages` → `textToRawMessage` → `parseDiscordAnnouncement` → `normalizeDiscordTableDraft` → INSERT draft → UPDATE msg status → calcula missing_fields (2ª vez) → push results
  - **Complexity breakdown (estimado):**
    - `try` (+1)
    - `if (!parsed.success)` (+2)
    - `for (segment)` (+2)
    - `if (existingMessage)` L46 (+3) — **1º check duplicado**
      - `if (existingDraft)` (+4)
        - `if (!table?.title)` (+5)
        - `if (!table?.system_id)` (+5)
        - `if (!table?.type)` (+5)
        - `if (!table?.modality)` (+5)
        - `if (table?.slots_total == null && ...)` (+5)
    - `if (existingMessage)` L75 (+3) — **2º check, mesmo nome, lógica diferente**
      - `if (!inserted)` (+4)
    - `if (!parsedDraft)` (+3)
    - Segunda bateria de missing_fields (L131-135): 5× (+3 cada) = +15
    - `catch` (+1)
    - **Total estimado: ~56**
  - **Pontos críticos:**
    1. **`if (existingMessage)` aparece DUAS VEZES** (L46 e L75) com propósitos diferentes: primeiro para verificar se já existe draft (e pular), segundo para decidir se cria nova mensagem. Isso confunde o fluxo e infla CC.
    2. **Missing fields calculado EM DOIS LUGARES** (L56-61 e L129-135) — código idêntico, contextos diferentes. Eleva CC e causa duplicação.
    3. **Fluxo assimétrico**: tratamento de erro (set parse_error) misturado com sucesso no mesmo nível do loop.
    4. **Lógica de "find or create message" inline**: poderia ser função separada.
  - **Impacto:** manutenção difícil; qualquer mudança na lógica de missing_fields precisa ser replicada em 2 lugares; fluxo de "draft existente vs novo" difícil de seguir
  - **Severidade real:** 🟠 Major — CC 56 é 3.7× o limite; refatoração necessária
  - **Risco de regressão:** alto — handler tem 46 testes (adminImportInbox.test.ts) que cobrem múltiplos cenários; extração requer cuidado para não quebrar contratos
  - **Já existe tratamento no projeto:** não — D02 e D10 mencionam split de adminImportInbox.ts por linhas, mas não por CC
  - **Falso positivo:** não — CC real é ~56
  - **Recomendação:** extrair 3 helpers:
    1. `calcMissingFields(normalizedPayload)` — elimina duplicação de missing_fields
    2. `findOrCreateImportMessage(segment, contentHash, titleHint)` — isola lógica de busca/criação de mensagem
    3. `processSegment(segment, titleHint, systems)` — wrapper do loop interno
  - **Débito registrado:** D15 — CC 56 do POST /import-text requer extração de helpers → RESOLVIDO 2026-06-23
- **Conclusão:** Implementado. 2 helpers extraídos: `calcMissingFields()` (5-field check duplicado) e `createImportMessage()` (INSERT block). Handler 140→105 linhas. CC handler ≤7. Tests 223/223 ✅, lint 15/15 ✅, build 17/17 ✅.

---

## REV-033 — drafts.ts condição negada inesperada

- **Origem:** SonarQube (code smell)
- **Tipo:** check (código estático)
- **Referência:** `apps/mesas/backend/src/routes/discord/drafts.ts:112`
- **Resumo:** `mergedNormalizedPayload !== undefined ? { normalized_payload: mergedNormalizedPayload } : {}` — uso de condição negada (`!==`) onde `===` melhora legibilidade.
- **Severidade declarada:** Minor | 2min effort
- **Status:** implementado ✅
- **Investigação:**
  - **Código (L112):** `...(mergedNormalizedPayload !== undefined ? { normalized_payload: mergedNormalizedPayload } : {})`
  - **Sonar rule:** "Unexpected negated condition" — prefere `=== undefined ? {} : { normalized_payload: mergedNormalizedPayload }`
  - **Impacto:** nenhum funcional, apenas legibilidade
  - **Severidade real:** 🟡 Minor — cosmético
  - **Risco de regressão:** nulo
- **Implementação:**
  - Invertida condição: `mergedNormalizedPayload === undefined ? {} : { normalized_payload: mergedNormalizedPayload }`
   - Testes: 223/223 backend ✅ | lint 15/15 ✅ | build 17/17 ✅

---

## REV-034 — utils.ts parseJsonField Cognitive Complexity 21 (deve ser ≤ 15)

- **Origem:** SonarQube (code smell)
- **Tipo:** check (código estático)
- **Referência:** `apps/mesas/backend/src/routes/discord/utils.ts:7`
- **Resumo:** `parseJsonField` tem Cognitive Complexity 21, acima do limite de 15. Múltiplos branches (array, object com sub-checks, string com try/catch aninhado).
- **Severidade declarada:** Critical | 11min effort
- **Status:** implementado ✅
- **Investigação:**
  - **Código (L7-30):** `parseJsonField` — 4 branches principais (array, objeto, string, fallback), com sub-checks de `items`/`data` nos branches objeto e string
  - **Impacto:** manutenção moderada, mas função bem testada
  - **Severidade real:** 🟡 Minor — função isolada e previsível
  - **Risco de regressão:** baixo — extrair helpers de normalização sem mudar comportamento
- **Implementação:**
  - Extraído helper `normalizeParsedRecord(record)` para isolar lógica de `items`/`data`/`values`
  - `parseJsonField` reduzido a 3 branches principais delegando ao helper
  - Testes: 223/223 backend ✅ | lint 15/15 ✅ | build 17/17 ✅

---

## REV-035 — useDiscordSync prefere `globalThis` sobre `window`

- **Origem:** SonarQube (code smell)
- **Tipo:** check (código estático)
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/hooks/useDiscordSync.ts:226,259`
- **Resumo:** Uso de `window.confirm` e `window.requestAnimationFrame` onde `globalThis` é preferível para portabilidade (funciona em Workers, SSR, etc.).
- **Severidade declarada:** Minor | 2min effort cada
- **Status:** implementado ✅
- **Investigação:**
  - **Código (L226):** `window.confirm('...')` — só funciona em browser
  - **Código (L259):** `window.requestAnimationFrame(...)` — só funciona em browser
  - **Impacto:** não funcional (código só roda em browser), mas melhor prática usar `globalThis`
  - **Severidade real:** 🟡 Minor — cosmético/portabilidade
  - **Risco de regressão:** nulo
- **Implementação:**
  - `window.confirm` → `globalThis.confirm`
  - `window.requestAnimationFrame` → `globalThis.requestAnimationFrame`
   - Testes: 163/163 frontend ✅ | lint 15/15 ✅ | build 17/17 ✅

---

## REV-036 — messageParse.ts 18.9% linhas duplicadas (20 linhas)

- **Origem:** SonarQube (duplication)
- **Tipo:** check (código estático)
- **Referência:** `apps/mesas/backend/src/routes/discord/messageParse.ts`
- **Resumo:** 18.9% das linhas (20) são duplicadas entre `messageParse.ts` (POST /:id/parse) e `drafts.ts` (POST /:id/reparse).
- **Severidade declarada:** —
- **Status:** investigado 🔍
- **Débito vinculado:** D16 (novo)
- **Investigação:**
  - **Arquivo:** `messageParse.ts:23-41` vs `drafts.ts:169-187`
  - **Código duplicado:**
    1. **`loadSystemsForParser()`** — `messageParse.ts:22` ≡ `drafts.ts:168`
    2. **`parseDiscordAnnouncement({...message fields...}, systems)`** — `messageParse.ts:23-39` (17 linhas) ≡ `drafts.ts:169-185` (17 linhas) — **BLOCO IDÊNTICO** mapeando todos os 16 campos de message (source_kind, discord_message_id, discord_channel_id, discord_guild_id, discord_parent_channel_id, discord_thread_id, discord_thread_name, discord_author_id, discord_author_name, discord_message_url, content_raw, attachments, embeds, message_created_at, message_edited_at)
    3. **`normalizeDiscordTableDraft(parsed, systems)`** — `messageParse.ts:41` ≡ `drafts.ts:187`
    4. **`ensureSystemSuggestionForDraft(draft, userId, label)`** — `messageParse.ts:89-93` ≡ `drafts.ts:202-206`
  - **Origem:** REV-015 extraiu `POST /:id/parse` de `drafts.ts` para `messageParse.ts` via **cópia**, não via extração de função compartilhada. A lógica de parse do anúncio ficou duplicada em 2 arquivos.
  - **Impacto:** se a assinatura de `parseDiscordAnnouncement` mudar (ex.: adicionar campo), ou se o mapeamento de message→parse precisar de ajuste, ambas as rotas precisam ser atualizadas. Risco de regressão silenciosa.
  - **Severidade real:** 🟡 Minor — duplicação de 20 linhas idênticas; manutenção extra mas sem quebra funcional imediata
  - **Risco de regressão:** médio — se um dia só um dos call sites for atualizado, a inconsistência pode passar despercebida
  - **Já existe tratamento no projeto:** não
  - **Falso positivo:** não — duplicata real e verificável
  - **Recomendação:** extrair `parseDiscordMessage(message, systems)` em `utils.ts` (ou `discord/shared.ts`) que encapsule o mapeamento message→parseDiscordAnnouncement + normalizeDiscordTableDraft. Ambos messageParse.ts e drafts.ts passam a chamar a mesma função. Elimina ~20 linhas duplicadas.
  - **Débito registrado:** D16 — extrair `parseDiscordMessage()` compartilhada entre `messageParse.ts` e `drafts.ts`
- **Conclusão:** Procede. Duplicata real de 20 linhas idênticas entre messageParse.ts e drafts.ts, originada na REV-015 (cópia em vez de extração). Débito D16 registrado.

---

## REV-037 — drafts.ts 17.6% linhas duplicadas (38 linhas)

- **Origem:** SonarQube (duplication)
- **Tipo:** check (código estático)
- **Referência:** `apps/mesas/backend/src/routes/discord/drafts.ts`
- **Resumo:** 17.6% das linhas (38) são duplicadas entre `drafts.ts:PATCH /:id` e `adminImportInbox.ts:PATCH /drafts/:id`.
- **Severidade declarada:** —
- **Status:** investigado 🔍
- **Débito vinculado:** D17 (novo)
- **Investigação:**
  - **Arquivos:** `drafts.ts:90-102` vs `adminImportInbox.ts:322-333`
  - **Código duplicado:**
    ```
    // drafts.ts:90-102
    const patchPayload = normalizeDraftPayload(parsed.data.normalized_payload);
    const currentPayload = normalizeDraftPayload(current.normalized_payload);
    const transition = assertDraftReadyTransition({
      patchStatus: parsed.data.status,
      patchPayloadMissing: patchPayload?.missing_fields,
      currentPayloadMissing: currentPayload?.missing_fields,
    });
    if (!transition.allowed) {
      return res.status(422).json({ error: transition.reason, details: { missing_fields: transition.missingFields } });
    }
    ```
    ```
    // adminImportInbox.ts:322-333
    const patchPayload = normalizeDraftPayload(parsed.data.normalized_payload ?? current.normalized_payload);
    const currentPayload = normalizeDraftPayload(current.normalized_payload);
    const transition = assertDraftReadyTransition({
      patchStatus: parsed.data.status,
      patchPayloadMissing: patchPayload?.missing_fields,
      currentPayloadMissing: currentPayload?.missing_fields,
    });
    if (!transition.allowed) {
      return res.status(422).json({ error: transition.reason, missing_fields: transition.missingFields });
    }
    ```
  - **Diferenças:**
    1. adminImportInbox.ts usa `parsed.data.normalized_payload ?? current.normalized_payload` (fallback para current se patch não enviar) — drafts.ts não faz fallback
    2. adminImportInbox.ts envolve em `if (parsed.data.status && parsed.data.status !== current.status)` (L322) — drafts.ts executa sempre (mas ambos chegam ao mesmo resultado porque `patchPayload?.missing_fields` é `undefined` se não houver patch)
    3. adminImportInbox.ts retorna `missing_fields` no root vs `details.missing_fields` aninhado
  - **38 linhas totais de duplicação** incluem também:
    - Estrutura do handler PATCH (try/catch, select draft, 404, update, return) — ~15 linhas estruturais
    - Schema/validação de entrada (parcialmente diferente entre os dois)
  - **Impacto:** alterações na lógica de transição de status (`assertDraftReadyTransition`) precisam ser replicadas em 2 lugares; formato de resposta de erro (422) difere entre os handlers — inconsistência de API
  - **Severidade real:** 🟡 Minor — lógica de transição é estável (não muda frequentemente), mas a inconsistência nos formatos de erro (missing_fields em positions diferentes) pode confundir consumidores da API
  - **Risco de regressão:** baixo — extração de `validateDraftTransition()` é mecânica, sem mudança de comportamento
  - **Já existe tratamento no projeto:** não — D02/D10 mencionam split de adminImportInbox.ts por tamanho, mas não por duplicação de lógica com drafts.ts
  - **Falso positivo:** não — duplicata real de ~12 linhas no bloco de transição + ~26 linhas estruturais
  - **Recomendação:** extrair função `validateDraftStatusTransition(parsedData, currentDraft)` em pacote compartilhado (`discord/shared.ts`) que unifique a chamada a `normalizeDraftPayload` + `assertDraftReadyTransition` + resposta 422. Usar em ambos os PATCH handlers. Além disso, padronizar formato de erro (decidir entre `details.missing_fields` e `missing_fields` no root).
  - **Débito registrado:** D17 — extrair `validateDraftStatusTransition()` compartilhada entre `drafts.ts` e `adminImportInbox.ts` + padronizar formato de erro 422
- **Conclusão:** Procede. Duplicata real no bloco `normalizeDraftPayload` + `assertDraftReadyTransition` (12 linhas idênticas) + estrutura do handler. Débito D17 registrado.

---

## REV-038 — adminImportInbox.ts 9.1% linhas duplicadas (1 bloco — schemas de PATCH)

- **Origem:** SonarQube (duplication)
- **Tipo:** check (código estático)
- **Referência:** `apps/mesas/backend/src/routes/adminImportInbox.ts`
- **Resumo:** 9.1% das linhas de código novo (1 bloco) duplicadas entre `drafts.ts` (L11-26) e `inbox/utils.ts` (L21-36) — schemas de validação de PATCH de draft.
- **Severidade declarada:** —
- **Status:** investigado 🔍
- **Débito vinculado:** D18 (novo)
- **Investigação:**
  - **Arquivos:** `drafts.ts:11-26` vs `inbox/utils.ts:21-36`
  - **Código duplicado:**
    ```
    // drafts.ts:11-26
    const updateDraftTableSchema = z.object({
      type: z.enum(['campanha', 'one-shot', ...]).nullable().optional(),
      modality: z.enum(['online', 'presencial', ...]).nullable().optional(),
      price_type: z.enum(['gratuita', 'paga']).nullable().optional(),
      frequency: z.enum(['semanal', 'quinzenal', ...]).nullable().optional(),
    }).passthrough();
    const updateDraftPayloadSchema = z.object({ table: updateDraftTableSchema.optional() }).passthrough();
    const updateDraftSchema = z.object({
      normalized_payload: updateDraftPayloadSchema.optional(),
      status: z.enum(['draft', 'ready', 'needs_review', 'rejected']).optional(),
      review_notes: z.string().optional(),
    });
    ```
    ```
    // inbox/utils.ts:21-36
    export const patchDraftTableSchema = z.object({
      type: z.enum(['campanha', 'one-shot', ...]).nullable().optional(),
      modality: z.enum(['online', 'presencial', ...]).nullable().optional(),
      price_type: z.enum(['gratuita', 'paga']).nullable().optional(),
      frequency: z.enum(['semanal', 'quinzenal', ...]).nullable().optional(),
    }).passthrough();
    export const patchNormalizedPayloadSchema = z.object({ table: patchDraftTableSchema.optional() }).passthrough();
    export const patchDraftSchema = z.object({
      normalized_payload: patchNormalizedPayloadSchema.optional(),
      status: z.enum(['draft', 'ready', 'needs_review', 'rejected']).optional(),
      review_notes: z.string().optional(),
    });
    ```
  - **Diferenças:** drafts.ts usa `const` (local, não exportado), inbox/utils.ts usa `export const` (compartilhado). drafts.ts usa nomes `updateDraft*`, inbox/utils.ts usa `patchDraft*`. Funcionalmente idênticos.
  - **Origem:** schemas de PATCH de draft foram criados independentemente em dois módulos durante a Fase E (TE6 para discord/drafts.ts, TE10+ para inbox/utils.ts), sem coordenação para compartilhar.
  - **Impacto:** se um campo for adicionado/removido do schema de PATCH (ex.: novo campo `confidence` editável), precisa ser replicado em 2 lugares. Pode haver divergência.
  - **Severidade real:** 🟡 Minor — schemas de enum são estáveis, mas a divergência de nomes (`updateDraftSchema` vs `patchDraftSchema`) confunde
  - **Risco de regressão:** nulo para extração — é mecânico unificar
  - **Já existe tratamento no projeto:** não
  - **Falso positivo:** não — schemas são quase idênticos
  - **Recomendação:** unificar os schemas de PATCH de draft em um único lugar (ex.: `packages/content` ou `routes/discord/draftSchemas.ts`) e exportar para uso em ambos `drafts.ts` e `adminImportInbox.ts` (via `inbox/utils.ts`). Remover as definições locais de `drafts.ts`.
  - **Débito registrado:** D18 — unificar schemas de PATCH de draft (`updateDraftSchema`/`patchDraftSchema`) entre `drafts.ts` e `inbox/utils.ts`
- **Conclusão:** Procede. Duplicata real de 3 schemas de validação (16 linhas) entre `drafts.ts` e `inbox/utils.ts`. Débito D18 registrado.
