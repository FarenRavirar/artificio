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

---

## REV-039 — Encadear o AbortSignal do caller no engine HTTP (useMestre)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94 (`debitos/049-restantes-refatoracao`); `apps/mesas/frontend/src/hooks/useMestre.ts:89-110`; `apps/mesas/frontend/src/services/apiClient.ts`
- **Resumo:** `executeHttpRequest` substitui o `signal` recebido por `signal: controller.signal`, então o `controller.abort()` do `useEffect` não cancela a requisição em `useMestre` nem em `useMestreInsights`. Encadeie o `signal` externo ao `AbortController` interno em `apiClient.ts`.
- **Severidade declarada:** 🟠 Major | 🩺 Stability & Availability
- **Status:** implementado ✅
- **Task vinculada:** REV-039 (corrigido 2026-06-24)
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivos analisados:**
    - `apps/mesas/frontend/src/services/apiClient.ts:78-169` (executeHttpRequest)
    - `apps/mesas/frontend/src/services/apiClient.ts:238-247` (authenticatedFetch → authGet)
    - `apps/mesas/frontend/src/hooks/useMestre.ts:69-140` (useMestre)
    - `apps/mesas/frontend/src/hooks/useMestreInsights.ts:33-80` (useMestreInsights)
  - **Cadeia de chamada:**
    1. `useMestre.ts:84` → `authGet('/api/v1/gm/${slug}', { signal: controller.signal })`
    2. `apiClient.ts:246` → `authGet = (endpoint, options) => authenticatedFetch(endpoint, { ...options, method: 'GET' })` — signal é propagado via spread
    3. `apiClient.ts:240` → `authenticatedFetch` chama `executeHttpRequest(url, options, false)`
    4. `apiClient.ts:102, 119` → `const controller = new AbortController();` ... `fetch(url, { ...init, signal: controller.signal, ... })`
  - **Prova da sobreescrita (apiClient.ts:119):**
    ```typescript
    const response = await fetch(url, {
      ...init,               // aqui o signal externo chega (ex.: de useMestre)
      signal: controller.signal,  // AQUI SOBRESCREVE — mesmo que init traga signal
      credentials: 'include',
      ...
    });
    ```
  - **`init` é o parâmetro `options` de authenticatedFetch**, que recebe o spread de `{ ...options, method: 'GET' }` de authGet — logo, `init.signal` contém o AbortSignal do caller, mas é sobrescrito na linha seguinte.
  - **Consumidores afetados:**
    - `useMestre.ts:84` — controller criado em L73, abort() no cleanup L104. Signal ignorado → requisição não cancela no desmonte.
    - `useMestreInsights.ts:54` — controller criado em L42, abort() no cleanup L76. Mesmo problema.
    - `useFetchTables.ts:33-34` — usa `fetch` nativo (não `authGet`), não afetado.
    - `PlayerPage.tsx:77`, `MesaPage.tsx:40` — usam `fetch` nativo, não afetados.
  - **Impacto real:**
    - 🟠 Alta — ao navegar entre perfis ou desmontar o componente, a requisição HTTP antiga continua em flight, consumindo banda e processamento.
    - Resposta de request antigo pode chegar DEPOIS do novo, sobrescrevendo dados atuais (race condition).
    - O catch no hook verifica `AbortError` mas o abort() do useEffect nunca dispara AbortError na requisição — o erro fica engolido como erro genérico, sem distinção.
    - Em hooks que não verificam `AbortError` (ex.: se implementação futura esquecer), stale response escreve dados errados no estado.
  - **Severidade real:** 🟠 Major — confirma a classificação original do coderabbit
  - **Risco de regressão:** médio — corrigir exige alterar `executeHttpRequest` para combinar sinais (não substituir); requer smoke em todos os hooks que passam signal
- **Falso positivo:** não — bug real e reproduzível por leitura de código
- **Novos débitos encontrados:** nenhum além do já descrito — o problema de dedup abrindo mutações (REV-056) e retry em POST (REV-040/055) já estão registrados como REVs separados.
- **Implementação (2026-06-24):**
  - **Arquivo:** `apps/mesas/frontend/src/services/apiClient.ts:92-99` (executeHttpRequest)
  - **Correção:** adicionado listener `init.signal.addEventListener('abort', () => controller.abort(), { once: true })` após criação do `AbortController` interno. Se `init.signal` já estiver aborted, chama `controller.abort()` diretamente.
  - **Comportamento:** agora quando `useMestre`/`useMestreInsights` chamam `controller.abort()` no cleanup do `useEffect`, o sinal se propaga até o `AbortController` interno do `apiClient`, que cancela a requisição `fetch` em flight. Mantém o controller interno para cancelamento de dedup (requisição duplicada).
  - **Linhas modificadas:** +8 linhas adicionadas após L92
  - **Lint:** 15/15 ✅ | **Build:** 17/17 ✅ | **Testes frontend:** 163/163 (15 files) ✅

---

## REV-040 — Evite retry em POST /api/v1/gm/tables (não-idempotente)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/frontend/src/features/create-table/hooks/useCreateTableForm.ts:229-236`
- **Resumo:** `authPost` usa o engine com retry automático em 5xx/429. Como a criação de mesa gera novo slug sem idempotência, retry pode duplicar a mesa.
- **Severidade declarada:** 🟠 Major | 🗄️ Data Integrity & Integration
- **Status:** implementado ✅ (coberto por fix engine REV-055)
- **Task vinculada:** REV-055 (engine-level fix cobre automaticamente)
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivos analisados:**
    - `apps/mesas/frontend/src/features/create-table/hooks/useCreateTableForm.ts:242-243` (submit → authPost)
    - `apps/mesas/frontend/src/services/apiClient.ts:78-169` (executeHttpRequest)
    - `apps/mesas/frontend/src/services/apiClient.ts:238-244` (authenticatedFetch)
    - `apps/mesas/frontend/src/services/apiClient.ts:249-254` (authPost)
    - `apps/mesas/frontend/src/services/apiClient.ts:12-16` (RETRY_CONFIG)
  - **Cadeia de chamada:**
    1. `useCreateTableForm.ts:242` → `authPost('/api/v1/gm/tables', payload)` — criação de mesa, `isEditing = false`
    2. `apiClient.ts:249-254` → `authPost(endpoint, body, options)` — sem `skipRetry` (default `false`), sem `options`
    3. `apiClient.ts:240` → `authenticatedFetch` → `executeHttpRequest(url, options, false)` — `skipRetry = false`
    4. `apiClient.ts:85` → `const maxAttempts = skipRetry ? 0 : RETRY_CONFIG.maxRetries` → `maxAttempts = 3`
    5. `apiClient.ts:130-144` → loop de retry em 5xx/429 — até **3 retentativas** com backoff exponencial (baseDelay=1s, maxDelay=10s)
  - **Risco de duplicação:**
    - POST `/api/v1/gm/tables` gera um novo `id`/`slug` no backend a cada chamada — **não é idempotente**
    - Se o servidor cria a mesa com sucesso mas a resposta HTTP é perdida (timeout de rede, 502, etc.), o retry cria uma **segunda mesa** com os mesmos dados
    - O backend não tem chave de idempotência (idempotency-key)
  - **Probabilidade:** baixa — erro 5xx/429 que ocorre APÓS a persistência mas ANTES do response chegar ao cliente é raro, mas possível
  - **Impacto:** 🟠 Alto — duplicata de mesa com dados idênticos, sem mecanismo de detecção de duplicata no frontend ou backend
  - **Severidade real:** 🟠 Major — confirma classificação original
  - **Risco de regressão:** baixo — corrigir exigiria `skipRetry: true` na chamada de `authPost` + propagação de opção para `executeHttpRequest`, ou chave de idempotência no backend
  - **Falso positivo:** não — risco real de duplicata em cenário de falha de rede pós-persistência
  - **Novos débitos encontrados:** nenhum — o problema de retry em POST também se aplica a outros `authPost`/`authPut` (coberto por REV-055/apiClient retry loop geral)
- **Implementação (2026-06-24):**
  - **Coberto por:** REV-055 — engine-level fix em `apiClient.ts:86-87` que desabilita retry automaticamente para POST/PUT/PATCH/DELETE via `effectiveSkipRetry = skipRetry || !isIdempotent`. Nenhuma mudança necessária nos callers.
  - **Lint:** 15/15 ✅ | **Build:** 17/17 ✅ | **Testes:** 163/163 ✅

---

## REV-041 — Normalize `systemsTree` antes de salvar no estado (SystemSuggestionModal)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/frontend/src/components/SystemSuggestionModal.tsx:75-82`
- **Resumo:** O código confia em `data.data || []` — se a API retornar `data` como objeto truthy, `systemsTree` deixa de ser array e quebra `flattenSystems`/renderização.
- **Severidade declarada:** 🟠 Major | 🩺 Stability & Availability | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** REV-041 (corrigido 2026-06-24)
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivos analisados:**
    - `apps/mesas/frontend/src/components/SystemSuggestionModal.tsx:88` (setSystemsTree)
    - `apps/mesas/frontend/src/components/SystemSuggestionModal.tsx:30-47` (flattenSystems)
    - `apps/mesas/frontend/src/components/SystemSuggestionModal.tsx:64` (useMemo parentOptions)
  - **Código do problema (L88):**
    ```typescript
    const data = await response.json();
    setSystemsTree(data.data || []);
    ```
    - Se `data.data` for array → funciona
    - Se `data.data` for `undefined`/`null` → fallback `[]` (funciona)
    - Se `data.data` for objeto truthy → **`data.data || []` retorna o objeto** não-array, e `systemsTree` vira objeto (TypeError)
  - **Prova da quebra (L30-33):**
    ```typescript
    const flattenSystems = (nodes: SystemNode[], depth = 0) => {
      for (const node of nodes) {  // TypeError: nodes is not iterable se não for array
    ```
  - **Impacto real:**
    - Se API retornar um formato diferente, componente quebra com `TypeError: nodes is not iterable`
    - `parentOptions` (L64) depende de `systemsTree` via `useMemo` → crash na renderização
    - Seletor de sistema pai fica inutilizável
  - **Probabilidade:** baixa — API atual retorna `SystemNode[]`. Risco é de mudança na API.
  - **Severidade real:** 🟠 Major — confirma classificação original
  - **Risco de regressão:** nulo — `Array.isArray(data.data) ? data.data : []` é 1 linha, sem efeito colateral
  - **Falso positivo:** não — código mostra vulnerabilidade real
  - **Novos débitos encontrados:** nenhum

---

## REV-042 — Normalize payload do activity feed antes de atualizar estado (useActivityLog)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/frontend/src/modules/admin/activity/hooks/useActivityLog.ts:104-121`
- **Resumo:** Cast direto para `ActivityFeedResponse` e grava `pagination`/`filters_meta` sem normalização. Payload malformado pode poluir cursor/metadados e quebrar paginação/filtros.
- **Severidade declarada:** 🟠 Major | 🗄️ Data Integrity & Integration | ⚡ Quick win
- **Status:** resolvido ✅ (ja mitigado em D20/D21)
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo analisado:** `useActivityLog.ts:67-179`
  - **Código atual (L128-136):**
    ```typescript
    const payload = await response.json() as ActivityFeedResponse;
    const pageEntries = Array.isArray(payload.data) ? payload.data : [];
    ...
    setHasMore(Boolean(payload.pagination?.has_more));
    setNextCursor(payload.pagination?.next_cursor ?? null);
    setFiltersMeta(payload.filters_meta ?? DEFAULT_ACTIVITY_FILTERS_META);
    ```
  - **O que já foi corrigido durante D20/D21:**
    - `data` protegido com `Array.isArray` (L129) — antes era `payload.data || []`
    - `has_more` usa `Boolean()` (L134) — coerção explícita
    - `next_cursor` usa `?? null` (L135) — fallback seguro
    - `filters_meta` usa `?? DEFAULT_ACTIVITY_FILTERS_META` (L136) — fallback seguro
  - **O que ainda não foi corrigido:** cast `as ActivityFeedResponse` (L128) é type-only, sem validação runtime. Todos os acessos subsequentes têm fallback.
  - **Severidade real:** 🟡 Minor — normalização crítica já implementada. Cast `as` é cosmético.
  - **Risco de regressão:** nulo
  - **Falso positivo:** parcial — problema original (falta de normalização) foi majoritariamente endereçado. O que resta (cast `as`) não causa risco runtime.
  - **Novos débitos encontrados:** nenhum

---

## REV-043 — Valide payload antes de salvar URLs de avatar (ProfileEditPage)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/frontend/src/pages/ProfileEditPage.tsx:366-374,395-403,805-813,834-842`
- **Resumo:** Lê `response.json()` e usa `payload.secure_url` / `payload.data.avatar_url` sem checar tipo. Exija `typeof url === 'string'` antes de atualizar perfil.
- **Severidade declarada:** 🟠 Major | 🗄️ Data Integrity & Integration | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivos analisados:** `ProfileEditPage.tsx:293-982`, `AvatarUploader.tsx:101-105`, `ImageUploader.tsx:148-152`
  - **Caminhos não validados:**
    1. **Profile avatar upload (ProfileEditPage.tsx:370-374):**
       ```typescript
       if (!response.ok || !payload?.secure_url) throw ...;  // truthy check, não typeof
       handleAvatarChange(payload.secure_url);  // typado como string, mas sem runtime
       ```
    2. **Google profile import (ProfileEditPage.tsx:399-403):**
       ```typescript
       if (!response.ok) throw ...;
       handleAvatarChange(payload.data.avatar_url);  // SEM VALIDAÇÃO — pode ser undefined
       ```
    3. **GM avatar upload (ProfileEditPage.tsx:808-812):**
       ```typescript
       if (!response.ok || !payload?.secure_url) throw ...;
       updateGm({ avatar_url: payload.secure_url });  // truthy check apenas
       ```
    4. **GM Google import (ProfileEditPage.tsx:834-842):**
       ```typescript
       updateGm({ avatar_url: payload.data.avatar_url });  // SEM VALIDAÇÃO
       ```
    5. **AvatarUploader.tsx:101-105** e **ImageUploader.tsx:148-152:**
       ```typescript
       onChange(payload.secure_url as string);  // cast type-only, não runtime
       ```
  - **Impacto:**
    - Se Cloudinary API retornar formato inesperado → URL não-string no estado → imagem quebrada
    - `handleAvatarChange` e `updateGm` tipam como `string`, mas sem verificação runtime
  - **Probabilidade:** baixa — Cloudinary API é estável e sempre retorna `string` para `secure_url`
  - **Severidade real:** 🟡 Minor — baixa probabilidade, mas sem normalização. Correção de 1 linha cada ponto.
  - **Risco de regressão:** nulo
  - **Falso positivo:** não — vulnerabilidade real, embora de baixa probabilidade
  - **Novos débitos encontrados:** nenhum

---

## REV-044 — Normalize `data.data` antes de salvar no estado (PlatformsPage)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/frontend/src/modules/admin/platforms/PlatformsPage.tsx:95-108`
- **Resumo:** `authGet` traz payload externo; `data.data || []` aceita objetos truthy e itens sem `name/slug`, quebrando filter/render posterior.
- **Severidade declarada:** 🟠 Major | 🩺 Stability & Availability | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo analisado:** `PlatformsPage.tsx:65-428`
  - **Problema 1 — `data.data` sem `Array.isArray` (L102-103):**
    ```typescript
    const data = await response.json();
    const items = data.data || [];  // sem Array.isArray — objeto truthy passa
    ```
    - Se `data.data` for objeto truthy → `items` vira objeto não-array
    - `setVttPlatforms(items)` ou `setCommunicationPlatforms(items)` recebem não-array
  - **Problema 2 — `.filter()` quebra em não-array (L73-75):**
    ```typescript
    const filteredItems = useMemo(
      () => currentItems.filter((item) => (  // TypeError se currentItems não for array
        item.name.toLowerCase().includes(...)  // TypeError se item.name for null
      )),
      [currentItems, searchQuery]
    );
    ```
    - `currentItems` é `vttPlatforms || communicationPlatforms` — se um deles for não-array, `.filter()` lança TypeError
    - Se item individual não tiver `name` ou `slug`, `.toLowerCase()` lança TypeError
  - **Impacto:** quebra total da listagem de plataformas se API retornar formato inesperado
  - **Severidade real:** 🟠 Major — confirma classificação original
  - **Risco de regressão:** nulo — `Array.isArray` + fallback + guardas de string
  - **Falso positivo:** não — vulnerabilidade real
  - **Novos débitos encontrados:** nenhum

---

## REV-045 — Normalize payloads do onboarding antes de popular formulário (OnboardingPage)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/frontend/src/pages/OnboardingPage.tsx:133-158`
- **Resumo:** Casts para `MePayload`/`OptionsPayload` não validam runtime; campos como `systems_tree`, `tags`, `platforms`, `preferences.languages`, `preferences.weekdays` entram no estado sem proteção e alimentam `.map`/`.length`.
- **Severidade declarada:** 🟠 Major | 🩺 Stability & Availability | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo analisado:** `OnboardingPage.tsx:78-456`
  - **Problema 1 — Casts type-only sem runtime (L103-109):**
    ```typescript
    const meJson = (await meRes.json()) as MePayload;         // cast type-only
    const optionsJson = (await optionsRes.json()) as OptionsPayload; // cast type-only
    ```
  - **Problema 2 — `?? []` não protege contra objeto truthy (L111-118, L120-140):**
    ```typescript
    systemsTree: optionsJson.data.systems_tree ?? [],  // objeto truthy passa
    platforms: optionsJson.data.platforms ?? [],        // objeto truthy passa
    weekdays: meJson.data.preferences.weekdays ?? [],   // objeto truthy passa
    ```
    - `??` só distingue `null`/`undefined` de valores definidos
    - Se API retornar objeto truthy (ex.: `systems_tree: { 0: {...} }`), o objeto passa e quebra funções que esperam array
  - **Problema 3 — `flattenSystemTree` faz `for...of` em `systemsTree` (L60-72):**
    ```typescript
    const flattenSystemTree = (nodes: SystemTreeNode[]) => {
      for (const node of nodes) {  // TypeError se nodes não for array
    ```
    - Chamado em L171: `for (const node of flattenSystemTree(options.systemsTree))`
    - Se `options.systemsTree` for objeto truthy, **crash certo**
  - **Outros campos:** `tags`, `systems`, `platforms`, `weekdays` — usam `??` (vulneráveis a objeto truthy). `languages` tem guarda `&& length > 0` (seguro contra objeto).
  - **Probabilidade:** baixa — API atual retorna arrays consistentemente
  - **Severidade real:** 🟠 Major — confirma classificação original
  - **Risco de regressão:** nulo — `Array.isArray(x) ? x : []` em cada campo
  - **Falso positivo:** não — vulnerabilidade real
  - **Novos débitos encontrados:** nenhum

---

## REV-046 — drafts.ts: Validar e salvar patch mesclado em vez do payload cru

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/discord/drafts.ts:60`
- **Resumo:** O handler valida e salva o patch cru em vez do payload final mesclado, permitindo que campos como `table` sejam sobrescritos por objeto parcial. Ajustar para primeiro aplicar merge no payload atual, validar o resultado e só então persistir.
- **Severidade declarada:** 🟠 Major
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo analisado:** `apps/mesas/backend/src/routes/discord/drafts.ts:59-103` (PATCH /:id handler)
  - **Fluxo atual:**
    1. L60: `patchDraftSchema.safeParse(req.body)` — valida body
    2. L68-73: Busca draft atual (`current`)
    3. **L75: `validateDraftStatusTransition(parsed.data, current)`** — valida usando PATCH data **CRU** (não merged)
    4. **L83-85: Cria `mergedNormalizedPayload`** — `{ ...current.normalized_payload, ...parsed.data.normalized_payload }`
    5. L87-96: `.set({ ...parsed.data, normalized_payload: mergedNormalizedPayload, updated_at })` — salva
  - **O que já está correto:**
    - A persistência (L90-91) usa `mergedNormalizedPayload` — o `normalized_payload` salvo é o **merged**, não o cru ✅
    - `parsed.data` só contém `{ normalized_payload?, status?, review_notes? }` — campos seguros
  - **O que ainda é problema — validação usa dados crus (L75):**
    - `validateDraftStatusTransition(parsed.data, current)` usa `data.normalized_payload ?? current.normalized_payload`
    - Se o PATCH enviar `normalized_payload` parcial (ex.: só `{ table: { title } }`), a checagem de `missing_fields` opera sobre o payload parcial, **não sobre o merged final**
    - Exemplo: PATCH envia `{ normalized_payload: { table: { title: "Novo" } }, status: "ready" }` — a validação vê `table` parcial (sem system_id, type, modality...) e pode rejeitar incorretamente, mesmo que o draft atual já tenha todos os campos preenchidos
  - **Probabilidade:** muito baixa — frontend sempre envia payload completo. Cenário só ocorre em chamadas manuais à API.
  - **Severidade real:** 🟡 Minor — edge case que não afeta fluxo normal (frontend sempre envia payload completo)
  - **Risco de regressão:** baixo — inverter ordem: primeiro merge, depois validar
  - **Falso positivo:** **parcial** — a parte de "salvar patch cru" está INCORRETA (o código já salva merged). A parte de "validar antes do merge" é resíduo válido.
  - **Novos débitos encontrados:** nenhum

---

## REV-047 — fetch.ts: Draft upsert pode deixar message status inconsistente

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/discord/fetch.ts:70-101`
- **Resumo:** A lógica de draft upsert pode deixar `discord_import_messages` marcada como `parsed` mesmo quando nenhum draft foi alterado (ex.: `existingDraft` já `synced` ou `rejected`). A atualização do status da mensagem só deve ocorrer quando um draft foi efetivamente inserido/atualizado.
- **Severidade declarada:** 🟠 Major
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo analisado:** `apps/mesas/backend/src/routes/discord/fetch.ts:64-101`
  - **Código do problema:**
    ```typescript
    // L70-82 — SÓ atualiza draft se não for synced/rejected
    if (existingDraft && existingDraft.status !== 'synced' && existingDraft.status !== 'rejected') {
      // UPDATE draft
    } else if (!existingDraft) {
      // INSERT draft
    }
    // Se for synced/rejected → não faz nada com o draft (correto)
    
    // L98-101 — MAS SEMPRE marca mensagem como 'parsed' (INCORRETO!)
    await db.updateTable('discord_import_messages')
      .set({ status: 'parsed', parse_error: null, updated_at: new Date() })
      .where('id', '=', message.id)
      .execute();
    ```
  - **Impacto:**
    - Quando `existingDraft` é `synced` ou `rejected`: o draft é preservado (correto), mas a mensagem de origem é sobrescrita para `'parsed'` (incorreto)
    - Mensagens que já estavam `synced` voltam a aparecer como `parsed` no admin
    - Inconsistência: mensagem `parsed` mas draft `synced` / `rejected`
  - **Probabilidade:** alta — ocorre em todo re-fetch de mensagens que já têm draft em estado terminal
  - **Severidade real:** 🟠 Major — confirma classificação original. Inconsistência de estado entre message e draft.
  - **Risco de regressão:** baixo — mover update da mensagem para dentro dos branches de UPDATE/INSERT
  - **Falso positivo:** não — bug real e verificável
  - **Novos débitos encontrados:** nenhum

---

## REV-048 — messages.ts: Discord REST call sem timeout/AbortController

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/discord/messages.ts:28-31`
- **Resumo:** A chamada REST ao Discord não tem timeout e pode pendurar indefinidamente. Usar AbortController (padrão já usado em `ingestMessages` e `discovery`).
- **Severidade declarada:** 🟠 Major
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo analisado:** `apps/mesas/backend/src/routes/discord/messages.ts:26-31` (fetchDiscordMessageDiagnostic)
  - **Código sem timeout (L28-31):**
    ```typescript
    const response = await fetch(
      `${DISCORD_API_BASE}/channels/.../messages/...`,
      { headers: { Authorization: `Bot ${token}` } }
    );  // SEM AbortController, SEM timeout
    ```
  - **Padrão existente no mesmo módulo (discord/discovery.ts:78):**
    ```typescript
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    // ...
    clearTimeout(timeout);
    ```
  - **Padrão existente (discord/ingestMessages.ts:140):**
    ```typescript
    const controller = new AbortController();
    // ...
    ```
  - **Impacto:** se Discord API não responder, a requisição HTTP do admin fica pendurada até timeout do servidor (pode levar minutos). Recursos de conexão não liberados.
  - **Probabilidade:** baixa — Discord API é estável, mas possível em casos de rate limit ou instabilidade
  - **Severidade real:** 🟡 Minor — impacto limitado ao diagnóstico manual. Não afeta fluxo principal de importação.
  - **Risco de regressão:** nulo — adicionar AbortController + timeout de 15s (padrão do módulo)
  - **Falso positivo:** não — falta confirmada
  - **Novos débitos encontrados:** nenhum

---

## REV-049 — parse-batch.ts: Sobrescreve drafts synced/rejected incondicionalmente

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/discord/parse-batch.ts:54-68`
- **Resumo:** O batch upsert sobrescreve estados de draft existentes incondicionalmente. Preservar drafts já marcados como `synced` ou `rejected`, pulando atualizações de status/normalized_payload para drafts terminais.
- **Severidade declarada:** 🟠 Major
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo analisado:** `apps/mesas/backend/src/routes/discord/parse-batch.ts:54-85`
  - **Código do problema (L59-69):**
    ```typescript
    if (existing) {
      await db.updateTable('discord_import_table_drafts')
        .set({
          status: normalized.status,  // Sobrescreve status sem verificar terminal
          ...
        })
        .where('id', '=', existing.id)
        .execute();
    }
    ```
  - **Comparação com fetch.ts (L70):** `fetch.ts` tem guarda explícita:
    ```typescript
    if (existingDraft && existingDraft.status !== 'synced' && existingDraft.status !== 'rejected') {
      // SÓ atualiza se NÃO for terminal
    }
    ```
    `parse-batch.ts` **não tem essa guarda** — atualiza qualquer draft, inclusive `synced`/`rejected`.
  - **Mesmo problema da mensagem (L82-85):** marca mensagem como `'parsed'` incondicionalmente, mesmo se draft não foi alterado (mesmo bug do REV-047).
  - **Impacto:**
    - Draft `synced` (já publicada como mesa) → overwrite para `'draft'`/`'needs_review'` → perde dados de sincronização
    - Draft `rejected` → reaberto sem revisão administrativa
    - Mensagem `parsed` mesmo quando draft estava terminal
  - **Probabilidade:** média — ocorre em todo parse-batch que encontra mensagens já processadas e em estado terminal
  - **Severidade real:** 🟠 Major — confirma classificação original
  - **Risco de regressão:** baixo — adicionar mesma guarda de fetch.ts + mover update da mensagem para dentro do branch
  - **Falso positivo:** não — bug real
  - **Novos débitos encontrados:** nenhum

---

## REV-050 — sources.ts: Guild/channel IDs sem validação de snowflake Discord

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/discord/sources.ts:8-14`
- **Resumo:** `createSourceSchema` aceita qualquer string não-vazia para `guild_id` e `channel_id`, permitindo persistir IDs Discord inválidos. Validar como snowflake Discord (inteiro de 64-bit).
- **Severidade declarada:** 🟠 Major
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivos analisados:** `sources.ts:8-14`, `utils.ts:160-162`
  - **Problema (sources.ts:8-14):**
    ```typescript
    const createSourceSchema = z.object({
      guild_id: z.string().min(1),    // qualquer string não-vazia
      channel_id: z.string().min(1),   // qualquer string não-vazia
    });
    ```
  - **Padrão existente (utils.ts:160-162):**
    ```typescript
    export const snowflakeParamSchema = z.object({
      guildId: z.string().regex(/^\d{5,30}$/, 'Servidor Discord inválido.'),
    });
    ```
  - **Impacto:** Inexistente atualmente (admin só cadastra fontes com IDs reais). Risco futuro: erro de digitação, dados corrompidos, ou IDs de teste que poluem o banco.
  - **Probabilidade:** baixa — admins inserem dados manualmente
  - **Severidade real:** 🟡 Minor — validação de formato, sem impacto funcional imediato
  - **Risco de regressão:** nulo — reutilizar regex existente
  - **Falso positivo:** não — falta de validação confirmada
  - **Novos débitos encontrados:** nenhum

---

## REV-051 — utils.ts: Normalize `content_raw` antes de `parseDiscordAnnouncement`

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/discord/utils.ts:115-130`
- **Resumo:** O cast atual não converte em runtime; `parseDiscordAnnouncement()` pode chamar `.trim()` em valor não-string. Coagir `content_raw` para string (ou fallback seguro) antes de passar adiante.
- **Severidade declarada:** 🟠 Major
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo analisado:** `apps/mesas/backend/src/routes/discord/utils.ts:115-126`
  - **Código do problema (L126):**
    ```typescript
    content_raw: (msg.content_raw as string) ?? '',
    ```
    - `as string` é **type-only** (não converte em runtime)
    - `?? ''` só captura `null`/`undefined`
    - Se `content_raw` for número ou objeto → passa como não-string
  - **Campos vizinhos que usam `String()` corretamente (L117-118):**
    ```typescript
    discord_message_id: String(msg.discord_message_id ?? ''),   // ✅
    discord_channel_id: String(msg.discord_channel_id ?? ''),   // ✅
    ```
  - **Impacto:** Se `content_raw` chegar como número (ex.: `253463`), `parseDiscordAnnouncement` pode chamar `.trim()` nisso e lançar `TypeError: msg.content_raw.trim is not a function`
  - **Probabilidade:** muito baixa — `content_raw` vem sempre como string da API Discord
  - **Severidade real:** 🟡 Minor — improvável mas quebra total se ocorrer
  - **Risco de regressão:** nulo — trocar `as string` por `String()`
  - **Falso positivo:** não — padrão inconsistente com campos vizinhos
  - **Novos débitos encontrados:** nenhum

---

## REV-052 — HydrationAdminPanel: Retry automático em POST não-idempotente

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/frontend/src/modules/admin/hydration/HydrationAdminPanel.tsx:63`
- **Resumo:** Chamada de hidratação usa `authPost` e herda retry automático do `apiClient`, podendo repetir operação não-idempotente. Desabilitar retry ou adicionar chave de idempotência.
- **Severidade declarada:** 🟠 Major
- **Status:** implementado ✅ (coberto por fix engine REV-055)
- **Task vinculada:** REV-055 (engine-level fix cobre automaticamente)
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo analisado:** `HydrationAdminPanel.tsx:52-80` (handleHydrate)
  - **Código (L63):**
    ```typescript
    const response = await authPost(`/api/v1/admin/sync/hydrate?dry_run=${dryRun}`);
    ```
    - `authPost` → `authenticatedFetch` → `executeHttpRequest` com `skipRetry = false`
    - Retry up to 3x em 5xx/429
  - **Problema:** hidratação modifica o banco de testes. Retry pode executar a sincronização duas vezes, causando duplicatas ou inconsistências. Mesmo padrão de REV-040.
  - **Impacto:** duplicação de registros no banco de testes se response for perdido após persistência bem-sucedida
  - **Probabilidade:** baixa (mesma do REV-040)
  - **Severidade real:** 🟠 Major — confirma classificação original
  - **Risco de regressão:** baixo — `authPost(endpoint, body, { skipRetry: true })`
  - **Falso positivo:** não — mesmo risco do REV-040
  - **Novos débitos encontrados:** nenhum
- **Implementação (2026-06-24):**
  - **Coberto por:** REV-055 — engine-level fix em `apiClient.ts:86-87` desabilita retry automaticamente para POST. Nenhuma mudança necessária no caller.
  - **Lint:** 15/15 ✅ | **Build:** 17/17 ✅ | **Testes:** 163/163 ✅

---

## REV-053 — GestaoPage: Normalizar `data.data` antes de `setAllTables`

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/frontend/src/pages/GestaoPage.tsx:197-200`
- **Resumo:** Resposta de `authGet('/api/v1/tables')` é armazenada diretamente em estado; `allTables.filter(...)` pode quebrar se receber não-array. Usar `Array.isArray` com fallback.
- **Severidade declarada:** 🟠 Major
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo analisado:** `GestaoPage.tsx`
  - **Código (fetchAllTables):**
    ```typescript
    const data = await response.json();
    setAllTables(data.data || []);  // sem Array.isArray
    ```
  - **Código (filter posterior):**
    ```typescript
    const filteredTables = allTables.filter(t =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
    ```
  - **Problema:** `data.data || []` — se `data.data` for objeto truthy, `allTables` vira não-array e `.filter()` lança TypeError
  - **Impacto:** quebra total da listagem de mesas se API retornar formato inesperado
  - **Probabilidade:** baixa
  - **Severidade real:** 🟠 Major — confirma classificação original. Mesmo padrão de REV-041/044.
  - **Risco de regressão:** nulo
  - **Falso positivo:** não
  - **Novos débitos encontrados:** nenhum

---

## REV-054 — ScenariosAdminView: Normalizar scenarios response

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/frontend/src/pages/ScenariosAdminView.tsx:44-47`
- **Resumo:** `setScenarios` pode receber não-array e quebrar `scenarios.find(...)`. Normalizar com `Array.isArray` e validar campos mínimos.
- **Severidade declarada:** 🟠 Major
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo analisado:** `ScenariosAdminView.tsx:33-183`
  - **Código (L48-50):**
    ```typescript
    const data = await response.json();
    setScenarios(data.data || []);  // sem Array.isArray
    ```
  - **Código downstream que quebra (L69):**
    ```typescript
    const selectedScenario = scenarios.find(s => s.id === selectedId);
    ```
  - **Problema:** `data.data || []` — se `data.data` for objeto truthy, `scenarios` vira não-array. `.find()` lança TypeError.
  - **Impacto:** quebra total do painel de cenários
  - **Probabilidade:** baixa
  - **Severidade real:** 🟠 Major — confirma classificação original. Mesmo padrão de REV-041/044/053.
  - **Risco de regressão:** nulo
  - **Falso positivo:** não
  - **Novos débitos encontrados:** nenhum

---

## REV-055 — apiClient: Retry loop aplica a toda request (risco em mutações POST/PATCH/DELETE)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/frontend/src/services/apiClient.ts:97-99`
- **Resumo:** Retry automático em cada request pode duplicar side effects em chamadas mutantes. Retry deve ser habilitado só para métodos seguros/idempotentes GET/HEAD.
- **Severidade declarada:** 🟠 Major
- **Status:** implementado ✅
- **Task vinculada:** REV-055 (corrigido 2026-06-24)
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo analisado:** `apiClient.ts:78-169` (executeHttpRequest)
  - **Código (L82-85):**
    ```typescript
    const maxAttempts = skipRetry ? 0 : RETRY_CONFIG.maxRetries;  // maxRetries = 3
    ```
  - **Problema:** `skipRetry` só é passado como `false` por `authenticatedFetch` e seus consumidores (authGet, authPost, authPut, authPatch, authDelete). Retry automático em POST/PATCH/DELETE pode duplicar side effects.
  - **Impacto:** duplicação de registros (REV-040), execução dupla de operações não-idempotentes (REV-052)
  - **Severidade real:** 🟠 Major — confirma classificação original
  - **Risco de regressão:** médio — mudar retry para só GET/HEAD requer alteração no `executeHttpRequest` + smoke em todos os fluxos
  - **Falso positivo:** não — bug real
  - **Novos débitos encontrados:** nenhum
- **Implementação (2026-06-24):**
  - **Arquivo:** `apps/mesas/frontend/src/services/apiClient.ts:86-87, L116, L150, L171`
  - **Correção:** adicionado `const isIdempotent = init.method === 'GET' || init.method === 'HEAD' || !init.method` e `const effectiveSkipRetry = skipRetry || !isIdempotent`. Todos os 3 checks de retry (`maxAttempts`, response retry, catch retry) usam `effectiveSkipRetry` em vez de `skipRetry`. Isso desabilita automaticamente retry para POST/PUT/PATCH/DELETE.
  - **Cobertura:** REV-040 e REV-052 resolvidos automaticamente por este fix engine-level.
  - **Lint:** 15/15 ✅ | **Build:** 17/17 ✅ | **Testes:** 163/163 ✅

---

## REV-056 — apiClient: Dedup só deve aplicar para GET/HEAD

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/frontend/src/services/apiClient.ts:84-90`
- **Resumo:** Deduplicação atual usa só method+URL e pode abortar mutações legítimas (POST/PUT/PATCH/DELETE). Só aplicar para requisições idempotentes.
- **Severidade declarada:** 🟠 Major
- **Status:** implementado ✅
- **Task vinculada:** REV-056 (corrigido 2026-06-24)
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo analisado:** `apiClient.ts:94-101` (executeHttpRequest)
  - **Código (L94-101):**
    ```typescript
    const requestKey = `${init.method || 'GET'}:${url}`;
    if (pendingRequests.has(requestKey)) {
      pendingRequests.get(requestKey)?.abort();  // Cancela request anterior
    }
    ```
  - **Problema:** para POST/PATCH/DELETE, se o usuário clicar rapidamente duas vezes no mesmo formulário, a primeira requisição é abortada e a segunda prossegue. Mas se a primeira já foi processada no backend, o abort não desfaz a mutação.
  - **Cenário de risco:** usuário clica "Criar mesa" duas vezes → primeira POST é abortada → segunda POST cria a mesa → resultado: 1 criação OK. Mas se a primeira POST já criou no backend antes do abort chegar → a segunda POST cria outra → **2 mesas iguais**.
  - **Impacto:** duplicação de mutações em cenário de clique rápido
  - **Probabilidade:** baixa
  - **Severidade real:** 🟠 Major — mesmo risco de REV-040/055
  - **Risco de regressão:** baixo — guardar `if (init.method === 'GET' || init.method === 'HEAD')` antes do dedup
  - **Falso positivo:** não
  - **Novos débitos encontrados:** nenhum
- **Implementação (2026-06-24):**
  - **Arquivo:** `apps/mesas/frontend/src/services/apiClient.ts:92, L99-101`
  - **Correção:** dedup agora usa `isIdempotent` para decidir se cancela requisição duplicada anterior (`if (isIdempotent && pendingRequests.has(requestKey))`) e se registra o controller no mapa de dedup (`if (isIdempotent) { pendingRequests.set(...) }`). Para POST/PUT/PATCH/DELETE, não há dedup — múltiplos cliques geram múltiplas requisições independentes.
  - **Lint:** 15/15 ✅ | **Build:** 17/17 ✅ | **Testes:** 163/163 ✅

---

## REV-057 — apiClient: Signal sobrescrito (abort externo ignorado)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/frontend/src/services/apiClient.ts:102-105`
- **Resumo:** O `fetch` sobrescreve `init.signal` com `controller.signal`, ignorando signal passado pelo chamador. Encadear ambos os sinais no AbortController interno.
- **Severidade declarada:** 🟠 Major
- **Status:** implementado ✅ (coberto por REV-039)
- **Task vinculada:** REV-039
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo analisado:** `apiClient.ts:119` (executeHttpRequest)
  - **Prova (L119):**
    ```typescript
    const response = await fetch(url, {
      ...init,               // init.signal chega aqui
      signal: controller.signal,  // SOBRESCREVE init.signal
      ...
    });
    ```
  - **Relação com REV-039:** REV-039 documenta o mesmo bug pelos consumidores `useMestre`/`useMestreInsights`. REV-057 é o mesmo bug visto pelo código fonte do `apiClient`. Mesma causa raiz.
  - **Impacto:** qualquer chamador que passe `{ signal }` para `authGet`/`authPost` tem o signal ignorado. A requisição não pode ser cancelada externamente.
  - **Severidade real:** 🟠 Major
  - **Falso positivo:** não
  - **Novos débitos encontrados:** nenhum

---

## REV-058 — apiClient: authPut/authPatch stringify FormData incorretamente

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/frontend/src/services/apiClient.ts:250-269`
- **Resumo:** `authPut`/`authPatch` stringificam todo payload não-vazio, transformando `FormData` em `{}` e descartando bodies falsy válidos. Preservar `FormData` e só stringificar objeto/JSON.
- **Severidade declarada:** 🟠 Major
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo analisado:** `apiClient.ts:250-269`
  - **Comparação entre funções:**
    ```typescript
    // authPost (L254) — ✅ CORRETO
    body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
    
    // authPut (L261) — ❌ SEM GUARDA
    body: body ? JSON.stringify(body) : undefined,
    
    // authPatch (L268) — ❌ SEM GUARDA
    body: body ? JSON.stringify(body) : undefined,
    ```
  - **Impacto:** Se algum consumidor passar `FormData` para `authPut`/`authPatch`, o FormData é convertido para `'{}'` via `JSON.stringify`. A requisição envia `Content-Type: application/json` com body `'{}'` — dados perdidos.
  - **Consumidores atuais:** nenhum — busca no código não encontrou `authPut`/`authPatch` com `FormData`. Bug latente.
  - **Probabilidade:** baixa — nenhum consumidor atual usa este padrão
  - **Severidade real:** 🟡 Minor — latente, sem impacto atual
  - **Risco de regressão:** nulo — copiar a guarda de `authPost`
  - **Falso positivo:** não — código inconsistente entre funções. Risco real para futuros consumidores.
  - **Novos débitos encontrados:** nenhum

---

## REV-059 — specs/backlog.md: D07 inconsistente com spec 049

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `specs/backlog.md:91`
- **Resumo:** Item de status da Spec 049 mostra D07 como aberto no backlog, enquanto `specs/049-mesas-revisao-gestao/debitos.md` e `tasks.md` já marcam como resolvido.
- **Severidade declarada:** 🟠 Major
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivos analisados:** `specs/backlog.md:91`, `specs/049-mesas-revisao-gestao/debitos.md:15`
  - **Backlog.md:91:** `D01-D18 resolvidos exceto D06-D07` — D07 listado como NÃO resolvido
  - **Debitos.md:15:** `D07 | ~~adminTablesAutoArchive.test.ts...~~ | Legado | **RESOLVIDO (2026-06-24)**`
  - **Inconsistência:** backlog afirma que D07 está aberto, mas o débito foi resolvido (git mv + PR)
  - **Impacto:** apenas documentação. Não afeta runtime.
  - **Severidade real:** 🟡 Minor — documentação desatualizada
  - **Risco de regressão:** nulo
  - **Falso positivo:** não — inconsistência confirmada
  - **Novos débitos encontrados:** nenhum

---

## REV-060 — debitos.md D21: Padronizar contagem de avisos no catálogo

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `specs/049-mesas-revisao-gestao/debitos.md:30-35`
- **Resumo:** Descrição registra "3 avisos catalogados" mas total final informa "2 avisos". Ambiguidade no fechamento.
- **Severidade declarada:** 🟡 Minor | 🎯 Functional Correctness | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo analisado:** `debitos.md:30-35`
  - **Inconsistência:**
    - L30: `1 erro de lint corrigido, 3 avisos catalogados` — diz **3**
    - L35: `**1 erro corrigido ✅ + 2 avisos catalogados 📋**` — total diz **2**
  - **Contagem real:** linhas catalogadas: L32 (1) + L33 (1) = **2 avisos catalogados**
  - **Impacto:** apenas documentação. Sem efeito funcional.
  - **Severidade real:** 🟡 Minor — documentação ambígua
  - **Falso positivo:** não — inconsistência real

---

## REV-061 — debitos.md D20: Corrigir células insuficientes na tabela Markdown

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `specs/049-mesas-revisao-gestao/debitos.md:28`
- **Resumo:** Linha D20 tem menos células que o cabeçalho exige (`# | Débito | Origem | Próximo passo`), quebrando renderização/lint de Markdown.
- **Severidade declarada:** 🟡 Minor | 📐 Maintainability & Code Quality | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo analisado:** `debitos.md:28`
  - **Prova:**
    - Cabeçalho (L7): `| # | Débito | Origem | Próximo passo |` — **4 colunas**
    - Linha D20 (L28): `| D20 | (...) | **RESOLVIDO (2026-06-24):** (...) |` — **3 células**
    - Faltando a 4ª célula
  - **Impacto:** tabela Markdown pode renderizar incorretamente em alguns visualizadores. A célula "Próximo passo" fica vazia.
  - **Severidade real:** 🟡 Minor — cosmético
  - **Falso positivo:** não

---

## REV-062 — inbox/drafts.ts: `updated` pode ser indefinido após transação (PATCH)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/inbox/drafts.ts:251-274`
- **Resumo:** A transação retorna `[result]`; se `updateTable` interno não retornar linhas (ex.: linha removida entre verificação e update), `updated` será `undefined` e resposta será `{ data: undefined }` com 200. Responder 404 se ausente.
- **Severidade declarada:** 🟡 Minor | 🎯 Functional Correctness | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - `inbox/drafts.ts:271-274`: `return [result]` e `return res.json({ data: updated })` — sem guarda contra `undefined`
  - Comparação com PATCH handler (L194-201) que tem `if (!draft) return 404`
  - Race condition improvável (draft verificado antes em L219), mas possível
  - **Severidade real:** 🟡 Minor

---

## REV-063 — inbox/import.ts: Proteger contra `draftRow` indefinido

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/inbox/import.ts:135-162`
- **Resumo:** `const [draftRow] = await db.insertInto(...).returning(...).execute()` retorna array; se nenhuma linha retornada, `draftRow` é `undefined` e acesso a `draftRow.id` lança. Guarda explícito evita exceção.
- **Severidade declarada:** 🟡 Minor | 🩺 Stability & Availability | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - `inbox/import.ts:135-146`: insertInto + returning → destructuring `[draftRow]`
  - L156-162: `draftRow.id`, `draftRow.status`, `draftRow.confidence` sem guarda
  - Insert sempre retorna linha (PK collision é erro, não empty), mas falta guarda defensiva
  - **Severidade real:** 🟡 Minor

---

## REV-064 — inbox/drafts.ts: Erros de validação de query retornam 500 em vez de 400

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/inbox/drafts.ts:16-18`
- **Resumo:** `listDraftsSchema.parse(req.query)` lança `ZodError` em parâmetros inválidos, capturado pelo catch genérico que responde 500. Usar `safeParse` e retornar 400 com detalhes.
- **Severidade declarada:** 🟡 Minor | 🎯 Functional Correctness | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - `inbox/drafts.ts:18`: `listDraftsSchema.parse(req.query)` — usa `.parse()` (throw)
  - L60-62: catch genérico retorna 500
  - PATCH handler (L153-155) usa `.safeParse()` corretamente — inconsistência
  - **Severidade real:** 🟡 Minor

---

## REV-065 — inbox/metrics.ts: `total_corrections` como string no runtime

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/inbox/metrics.ts:11-14`
- **Resumo:** `countAll<number>()` só afeta tipo; com `pg`, `count()` pode chegar como string em runtime. Coagir com `Number()` antes de `res.json`. Renomear `totalDrafts` para `totalCorrections`.
- **Severidade declarada:** 🟡 Minor | 🎯 Functional Correctness
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - `inbox/metrics.ts:11-14`: `countAll<number>().as('count')` — type-only
  - L33: `total_corrections: totalDrafts?.count ?? 0` — sem `Number()` coercion
  - PostgreSQL `count()` retorna string (bigint) em runtime
  - **Severidade real:** 🟡 Minor

---

## REV-066 — messages.ts: Rejeitar `limit` e `offset` negativos antes da query

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/discord/messages.ts:52-68`
- **Resumo:** `Math.min(Number(limit) || 50, 100)` aceita `-1`; `Number(offset) || 0` aceita offsets negativos. Validar como inteiros positivos antes da query.
- **Severidade declarada:** 🟡 Minor | 🩺 Stability & Availability | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - `messages.ts:52-68`: `Math.min(Number(limit) || 50, 100)` — `-1` → `Number(-1) || 50` = `50`
  - `Number(offset) || 0` — `-5` → `Number(-5) || 0` = `-5` (negativo passa)
  - Validação de datas (L56-61) existe mas paginação não validada
  - **Severidade real:** 🟡 Minor

---

## REV-067 — fetch.ts: Atualizar `last_synced_at` em todo fetch bem-sucedido

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/discord/fetch.ts:186-191`
- **Resumo:** `last_synced_at` só é atualizado quando `result.inserted > 0 || result.updated > 0 || result.total === 0`. Fetch que retorna só mensagens já conhecidas não atualiza timestamp, deixando fonte parecendo desatualizada.
- **Severidade declarada:** 🟡 Minor | 🎯 Functional Correctness | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - `fetch.ts:186-191`: condicional que só atualiza se `inserted > 0 || updated > 0 || total === 0`
  - Se existirem mensagens conhecidas (já importadas), fetch bem-sucedido não atualiza `last_synced_at`
  - Fonte parece desatualizada no admin mesmo após sync bem-sucedido
  - Condição deve ser removida: atualizar sempre em fetch bem-sucedido
  - **Severidade real:** 🟡 Minor

---

## REV-068 — messageParse.ts: Marcar mensagens sem conteúdo como `ignored` no parse manual

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/discord/messageParse.ts:21-22`
- **Resumo:** `parseDiscordMessage()` retornar `null` devolve 422 mas deixa mensagem em `pending`/`error` para reprocessar. Marcar como `ignored` antes de responder.
- **Severidade declarada:** 🟡 Minor | 🎯 Functional Correctness | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - `messageParse.ts:21-22`: `if (!result) return res.status(422).json(...)` — sem update no banco
  - Mensagem permanece `pending` → pode ser reprocessada infinitamente
  - Compare com `parse-batch.ts:46-49` que marca como `ignored` antes de continuar
  - **Severidade real:** 🟡 Minor

---

## REV-069 — inbox/import.ts: Draft insert e status update não são atômicos

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/inbox/import.ts:135-152`
- **Resumo:** Inserção em `discord_import_table_drafts` e update de `import_messages` para `status: 'parsed'` são operações independentes. Se a segunda falhar, draft existe mas mensagem permanece `pending`. Envolver em `db.transaction()`.
- **Severidade declarada:** 🔵 Trivial | 🩺 Stability & Availability | ⚡ Quick win
- **Status:** pendente (test mock nao suporta transaction)
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - `inbox/import.ts:135-146` (insert draft) + `148-152` (update message) — operações separadas
  - Se L148-152 falhar, draft existe mas mensagem `pending`
  - Compare com `inbox/drafts.ts:251-272` (reparse) que usa `db.transaction()`
  - **Severidade real:** 🔵 Trivial — improvável (erro só em falha de banco)

---

## REV-070 — inbox/metrics.ts: Agregação de campos corrigidos carrega tabela inteira em memória

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/inbox/metrics.ts:16-29`
- **Resumo:** `selectFrom('import_corrections').select('diff').execute()` traz todas as linhas para o processo e itera em JS. Com crescimento, vira gargalo de memória/CPU. Agregar no banco (jsonb_object_keys + GROUP BY) ou paginar.
- **Severidade declarada:** 🔵 Trivial | 🚀 Performance & Scalability
- **Status:** pendente (test mock nao suporta executeQuery)
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - `inbox/metrics.ts:16-29`: busca todas as linhas de `import_corrections` e itera em JS
  - `Object.keys(diff)` em cada linha → O(n*m) onde n=linhas, m=chaves por diff
  - Solução: `SELECT jsonb_object_keys(diff) AS key, COUNT(*) AS cnt FROM import_corrections GROUP BY key`
  - **Severidade real:** 🔵 Trivial — tabela pequena atualmente, mas não escala

---

## REV-071 — Codex: Revisão geral do PR #94

- **Origem:** chatgpt-codex-connector (bot)
- **Tipo:** PR (review)
- **Referência:** PR #94 (`debitos/049-restantes-refatoracao`); commit `67c75323f3`
- **Resumo:** Revisão automática do Codex. Mensagem institucional sobre configuração do bot no repositório. Sem sugestões inline específicas de código no comentário. O Codex revisou o PR e não postou comentários adicionais sobre problemas específicos.
- **Severidade declarada:** N/A (review geral)
- **Status:** encerrado sem acao
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** —
- **Investigação:**
  - Comentário do Codex (chatgpt-codex-connector) é uma mensagem boilerplate do serviço
  - Informa que o code review foi executado, sem apontar issues específicas
  - **Nenhum débito ou issue encontrado**
  - **Status:** encerrado sem ação

---

## REV-072 — ProfileEditPage.tsx 80% linhas duplicadas (2 blocos de upload)

- **Origem:** SonarQube (duplication)
- **Tipo:** check (código estático)
- **Referência:** PR #94; `apps/mesas/frontend/src/pages/ProfileEditPage.tsx`
- **Resumo:** 80% das linhas novas do arquivo são duplicadas entre seção de avatar do perfil e avatar do GM. Bloco de upload via `authPost('/api/v1/upload')` e import via `authPost('/api/v1/profile/me/google-picture')` aparecem 2 vezes cada.
- **Severidade declarada:** — (SonarQube)
- **Status:** implementado ✅
- **Débito vinculado:** D22 (novo)
- **Investigação:**
  - **Arquivo:** `ProfileEditPage.tsx:361-377` (profile avatar upload) vs `ProfileEditPage.tsx:800-813` (GM avatar upload)
  - **Bloco duplicado 1 — Upload via backend (17 linhas cada):**
    ```typescript
    const response = await authPost('/api/v1/upload', formData);
    const payload = await response.json();
    if (!response.ok || !payload?.secure_url) {
      throw new Error(payload?.error || 'Falha ao enviar imagem.');
    }
    handleAvatarChange(payload.secure_url);  // vs updateGm({ avatar_url: payload.secure_url })
    ```
  - **Bloco duplicado 2 — Google photo import (8 linhas cada):**
    ```typescript
    const response = await authPost('/api/v1/profile/me/google-picture');
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || 'Erro ao buscar foto do Google.');
    handleAvatarChange(payload.data.avatar_url);  // vs updateGm({ avatar_url: payload.data.avatar_url })
    ```
  - **Diferença:** profile usa `handleAvatarChange(url)` (→ `updateProfile({ avatar_url: url })`), GM usa `updateGm({ avatar_url: url })`
  - **Total:** ~25 linhas duplicadas (diferença de 1 linha de callback entre os blocos)
  - **Impacto:** qualquer mudança no fluxo de upload (troca de endpoint, tratamento de erro) precisa ser replicada em 2 lugares
  - **Severidade real:** 🟡 Minor — duplicata de bloco de upload entre profile avatar e GM avatar
  - **Recomendação:** extrair `async function uploadAvatar(file: File): Promise<string>` e `async function importGoogleAvatar(): Promise<string>` em `ProfileEditPage.tsx` ou em `utils/upload.ts`
  - **Débito registrado:** D22 — extrair blocos de upload duplicados entre profile e GM

---

## REV-073 — parse-batch.ts 19.8% linhas duplicadas (22 linhas)

- **Origem:** SonarQube (duplication)
- **Tipo:** check (código estático)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/discord/parse-batch.ts`
- **Resumo:** 19.8% das linhas (22) duplicadas entre `parse-batch.ts` e `fetch.ts` — bloco `parseDiscordAnnouncement` com 16 campos de message.
- **Severidade declarada:** — (SonarQube)
- **Status:** implementado ✅
- **Débito vinculado:** D23 (novo)
- **Investigação:**
  - **Arquivos:** `parse-batch.ts:28-44` vs `fetch.ts:37-52`
  - **Bloco duplicado (17 linhas cada):**
    ```typescript
    const parsed = parseDiscordAnnouncement({
      source_kind: message.source_kind,
      discord_message_id: message.discord_message_id,
      discord_channel_id: message.discord_channel_id,
      ... // 16 campos idênticos
    }, systems);
    ```
  - **Origem:** ambos extraídos de `adminDiscordSync.ts` (D09) sem extrair função compartilhada
  - **Impacto:** se a assinatura de `parseDiscordAnnouncement` mudar (ex.: adicionar campo), ambos precisam ser atualizados. Risco de regressão silenciosa.
  - **Severidade real:** 🟡 Minor — mesmas 17 linhas idênticas. Já existia como débito D16 (resolvido) para `messageParse.ts` vs `drafts.ts` — mesmo padrão.
  - **Recomendação:** extrair `parseDiscordMessage(message, systems)` em `discord/shared.ts` que encapsule o mapeamento dos 16 campos
  - **Débito registrado:** D23 — extrair `parseDiscordAnnouncement` call block compartilhado entre `parse-batch.ts` e `fetch.ts`

---

## REV-074 — inbox/drafts.ts 12.4% linhas duplicadas (35 linhas)

- **Origem:** SonarQube (duplication)
- **Tipo:** check (código estático)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/inbox/drafts.ts`
- **Resumo:** 12.4% das linhas (35) duplicadas entre `inbox/drafts.ts:PATCH` e `discord/drafts.ts:PATCH` — estrutura do handler de atualização de draft.
- **Severidade declarada:** — (SonarQube)
- **Status:** implementado ✅
- **Débito vinculado:** D24 (novo)
- **Investigação:**
  - **Arquivos:** `inbox/drafts.ts:150-206` vs `discord/drafts.ts:57-103`
  - **Estrutura duplicada (~20 linhas estruturais):**
    - Schema parse: `patchDraftSchema.safeParse(req.body)` + 400 return (schema já compartilhado via REV-038)
    - Empty check: `Object.keys(parsed.data).length === 0` return 400
    - Try/catch com estrutura idêntica
    - Fetch current draft: `db.selectFrom('discord_import_table_drafts').select(...).where('id','=')...`
    - 404 check: `if (!current) return 404`
    - Transition validation: `validateDraftStatusTransition(parsed.data, current)` + 422 return
    - Update: `db.updateTable('discord_import_table_drafts').set({...}).where('id','=','...').returningAll().execute()`
    - 404 check após update
    - Return `res.json({ data: draft })`
    - Catch: `console.error(...)` + `return res.status(500).json(...)`
  - **Diferenças:**
    - `inbox/drafts.ts` tem validações extras: import_message_id, synced check, published check
    - `discord/drafts.ts` tem merge de normalized_payload
  - **Impacto:** handler estruturalmente duplicado. Alterações no fluxo de PATCH (ex.: novo campo, nova validação) podem ser aplicadas inconsistentemente.
  - **Severidade real:** 🟡 Minor — handlers já divergem em validações específicas, mas estrutura boilerplate é igual
  - **Recomendação:** extrair middleware/função `handlePatchDraft(req, currentChecks)` que encapsule o boilerplate, mantendo as validações específicas como callbacks
  - **Débito registrado:** D24 — extrair boilerplate de PATCH handler compartilhado entre `inbox/drafts.ts` e `discord/drafts.ts`

---

## REV-075 — discord/drafts.ts 11.1% linhas duplicadas (1 linha)

- **Origem:** SonarQube (duplication)
- **Tipo:** check (código estático)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/discord/drafts.ts`
- **Resumo:** 11.1% das linhas (1) duplicadas — `patchDraftSchema.safeParse` import compartilhado de `inbox/utils`.
- **Severidade declarada:** — (SonarQube)
- **Status:** investigado — falso positivo (duplicata já resolvida)
- **Débito vinculado:** já resolvido (D18)
- **Investigação:**
  - O SonarQube detectou 1 linha duplicada em `discord/drafts.ts` (11.1% das linhas novas no diff)
  - A linha duplicada é `import { patchDraftSchema } from '../inbox/utils';` — **import de schema compartilhado**
  - Esta duplicata foi o motivo do D18 (REV-038), já **RESOLVIDO** — `drafts.ts` agora importa o schema de `inbox/utils.ts` em vez de defini-lo localmente
  - **Falso positivo:** SonarQube detecta o `import` como linha duplicada, mas é uma dependência legítima de código compartilhado
  - **Severidade real:** N/A — falso positivo
  - **Recomendação:** nenhuma — D18 já resolvido

---

## REV-076 — fetch.ts 9.5% linhas duplicadas (23 linhas)

- **Origem:** SonarQube (duplication)
- **Tipo:** check (código estático)
- **Referência:** PR #94; `apps/mesas/backend/src/routes/discord/fetch.ts`
- **Resumo:** 9.5% das linhas (23) duplicadas entre `fetch.ts` e `parse-batch.ts` — mesmo bloco `parseDiscordAnnouncement` de 16 campos + `normalizeDiscordTableDraft`.
- **Severidade declarada:** — (SonarQube)
- **Status:** implementado ✅ (junto com REV-073)
- **Débito vinculado:** D23 (já registrado em REV-073)
- **Investigação:**
  - **Mesma duplicata do REV-073**, vista pelo outro lado
  - Bloco `parseDiscordAnnouncement({...16 campos...}, systems)` em `fetch.ts:37-52` ≡ `parse-batch.ts:28-44`
  - Bloco `normalizeDiscordTableDraft(parsed, systems)` em `fetch.ts:53` ≡ `parse-batch.ts:44`
  - Total: ~23 linhas duplicadas entre os dois arquivos
  - **Débito vinculado:** D23 (mesmo débito do REV-073)
  - **Falso positivo:** não — duplicata real com `parse-batch.ts`
  - **Severidade real:** 🟡 Minor
  - **Recomendação:** mesmo do REV-073 — extrair função compartilhada em `discord/shared.ts`

---

## REV-077 — parse-batch.ts: Mensagem não reconciliada quando draft já é terminal (synced/rejected)

- **Origem:** coderabbitai (bot) — PR #94, comentário duplicado (♻️)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/backend/src/routes/discord/parse-batch.ts:43-84`
- **Resumo:** Quando o draft existente já está em estado terminal (`synced` ou `rejected`), o fluxo preserva o draft (REV-049) mas não reconcilia o status da mensagem, não interrompe side effects (`ensureSystemSuggestionForDraft`) e conta como sucesso no contador — causando loop de reprocessamento infinito.
- **Severidade declarada:** 🟠 Major | 🗄️ Data Integrity & Integration | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** —
- **Débito vinculado:** —
- **Investigação:**
  - **Arquivo:** `parse-batch.ts:25-92`
  - **Código analisado (L38-84):**
    ```typescript
    const existing = await db.selectFrom('discord_import_table_drafts')
      .select(['id', 'status'])
      .where('discord_message_id', '=', message.id)
      .executeTakeFirst();

    // REV-049: preservar drafts synced/rejected (igual fetch.ts)
    if (existing && existing.status !== 'synced' && existing.status !== 'rejected') {
      // UPDATE draft + mark message as parsed
    } else if (!existing) {
      // INSERT draft + mark message as parsed
    }
    // REV-049: se existing é synced/rejected, não altera nem draft nem mensagem

    await ensureSystemSuggestionForDraft(        // <-- side effect em terminal
      normalized.draft,
      req.user?.userId,
      message.discord_thread_name ?? message.discord_message_id,
    );

    succeeded++;  // <-- contado como sucesso mesmo sem ter feito nada
    ```
  - **Fluxo de falha quando `existing.status` é `'synced'` ou `'rejected'`:**
    1. `parseDiscordMessage(message, systems)` executa parse completo (L28) — trabalho desperdiçado
    2. `existing` encontrado com status terminal (L38-41)
    3. Guarda de terminal (L44) → `false` — nenhum branch executado ✅ draft preservado
    4. `else if (!existing)` (L60) → `false` — `existing` é truthy
    5. **Nenhuma atualização na mensagem** — `discord_import_messages` continua `pending` ou `error` ❌
    6. `ensureSystemSuggestionForDraft(...)` executado (L78-82) — side effect com dados recém-parseados sobre draft já terminal ❌
    7. `succeeded++` (L84) — contador inflado artificialmente ❌
    8. Loop continua → mensagem ainda `pending`/`error` → **processada novamente no próximo parse-batch** 🔄
  - **Mesmo padrão em `fetch.ts` (`createOrUpdateDraftFromMessage`):**
    `fetch.ts:55-98` tem a MESMA estrutura:
    ```typescript
    async function createOrUpdateDraftFromMessage(message, systems, adminId): Promise<'draft' | 'ignored'> {
      const parsedResult = await parseDiscordMessage(message, systems);  // parse sempre executa
      if (!parsedResult) return 'ignored';
      const { parsed, normalized } = parsedResult;
      const existingDraft = await db.selectFrom('discord_import_table_drafts')
        .select(['id', 'status']).where('discord_message_id', '=', message.id).executeTakeFirst();

      if (existingDraft && existingDraft.status !== 'synced' && existingDraft.status !== 'rejected') {
        // UPDATE draft + mark message as parsed
      } else if (!existingDraft) {
        // INSERT draft + mark message as parsed
      }
      // REV-047: if synced/rejected, don't change message status

      await ensureSystemSuggestionForDraft(...);  // ← side effect em terminal
      return 'draft';                              // ← sempre 'draft', conta como sucesso
    }
    ```
    - **3 problemas idênticos:** mensagem não atualizada, side effect executado, contador inflado
    - Chamado APENAS via `parsePendingMessagesForSource` (fetch.ts:129), que por sua vez é chamado por 2 rotas:
      - `POST /fetch` (fetch.ts:183) — admin clica "Buscar mensagens" para uma fonte específica
      - `POST /sources/:sourceId/reingest-force` (fetch.ts:223) — admin força re-ingestão de uma fonte
  - **Análise comparativa de escopo e impacto:**

    | Aspecto | `parse-batch.ts` | `fetch.ts` |
    |---------|-----------------|------------|
    | **Escopo da query** | Global: todas as mensagens `pending`/`error` **sem filtro de source** (parse-batch.ts:12-17) | Por source: mensagens `pending`/`error` **filtradas por source_id** (fetch.ts:109-115) |
    | **Gatilho** | Botão "Processar lote" no admin + pode ser chamado programaticamente (cron) | Apenás via ação admin "Buscar mensagens" ou "Re-ingestar" por fonte |
    | **Frequência potencial** | Alta — pode ser disparado repetidamente, acumula mensagens de todas as fontes | Baixa — admin precisa executar manualmente para cada fonte |
    | **Reprocessamento** | Mensagens terminais de TODAS as fontes são reprocessadas a cada ciclo | Mensagens terminais de UMA fonte específica são reprocessadas apenas quando admin busca aquela fonte |
    | **Reingest-force** | N/A (não deleta mensagens) | `reingest-force` deleta mensagens `pending`/`error` antes de re-ingestar (fetch.ts:207-211), então mensagens terminais são removidas, não reprocessadas — bug só ocorre no fluxo `POST /fetch` |
  - **Impacto real:**
    - 🟠 **ALTO em `parse-batch.ts`:** loop global de reprocessamento. Mensagens terminais acumuladas de todas as fontes são re-parseadas a cada execução, desperdiçando CPU, DB I/O e chamadas `ensureSystemSuggestionForDraft`. Sem intervenção manual (admin alterar status da mensagem ou excluir draft), o loop é infinito.
    - 🟡 **MÉDIO em `fetch.ts`:**
      - `POST /fetch`: mensagens terminais da fonte são re-parseadas cada vez que admin busca aquela fonte. Frequência baixa (admin-dependente), mas o desperdício ocorre.
      - `POST /sources/:sourceId/reingest-force`: mensagens `pending`/`error` são DELETADAS antes (fetch.ts:207-211), então o bug NÃO se manifesta neste fluxo — as mensagens terminais somem junto com o delete.
    - 🟠 **Side effect indesejado (ambos):** `ensureSystemSuggestionForDraft` chamado com `normalized.draft` recém-computado para um draft já terminal, podendo criar sugestões desalinhadas com revisão humana.
    - 🟡 **Contadores enganosos (ambos):** `succeeded++` inclui mensagens terminais como sucesso, mascarando métricas reais.
  - **Probabilidade:**
    - `parse-batch.ts`: 🟠 alta — ocorre em toda execução,
    - `fetch.ts` (`POST /fetch`): 🟡 média — admin-dependente, mas inevitável se houver mensagens terminais na fonte
  - **Severidade real combinada:** 🟠 Major — confirma classificação original. O impacto global do `parse-batch.ts` domina a severidade.
  - **Risco de regressão:** baixo em ambos — alteração aditiva (early return / continue) sem efeito nos fluxos existentes
  - **Falso positivo:** não — bug real e verificável por leitura de código em ambos os arquivos
  - **Novos débitos encontrados:** nenhum
  - **Decisão — aplicar fix em ambos:**
    Recomenda-se **corrigir ambos os arquivos** em uma única alteração coordenada:
    - **`parse-batch.ts`:** adicionar `if (existing?.status === 'synced' || existing?.status === 'rejected')` com `continue` antes da guarda REV-049 existente (linha 43). Atualizar `discord_import_messages.status` para `'synced'` (draft synced) ou `'ignored'` (draft rejected). Interrompe fluxo antes de `ensureSystemSuggestionForDraft` e `succeeded++`.
    - **`fetch.ts` (`createOrUpdateDraftFromMessage`):** adicionar o mesmo early check antes da guarda existente (linha 55). Como é função (não loop inline), usar **early return** em vez de `continue`:
      ```typescript
      if (existingDraft?.status === 'synced' || existingDraft?.status === 'rejected') {
        await db.updateTable('discord_import_messages')
          .set({ status: existingDraft.status === 'synced' ? 'synced' : 'ignored', parse_error: null, updated_at: new Date() })
          .where('id', '=', message.id)
          .execute();
        return 'draft';  // caller conta como succeeded (já era terminal, mas status reconciliado)
      }
      ```
    - **Por que ambos?** (a) consistência de comportamento entre módulos que fazem a mesma operação; (b) o fix é idêntico em lógica (diferença só de sintaxe: `continue` vs `return`); (c) risco zero de regressão por ser aditivo. Se houver restrição de escopo, priorizar `parse-batch.ts` (impacto ALTO) e tratar `fetch.ts` como follow-up (impacto MÉDIO).
- **Implementação (2026-06-24):**
  - **Estratégia anti-duplicação:** criada função compartilhada `reconcileTerminalDraft()` em `discord/utils.ts` que unifica o padrão em um único lugar. Ambos os callers usam a mesma função — elimina duplicação de código entre `parse-batch.ts` e `fetch.ts`.
  - **Arquivo:** `apps/mesas/backend/src/routes/discord/utils.ts:247-264` — nova função `reconcileTerminalDraft()`
  - **`parse-batch.ts`:**
    - Import `reconcileTerminalDraft` de `./utils`
    - Adicionado early check com `continue` após o fetch do `existing`
    - Guarda REV-049 simplificada de `if (existing && existing.status !== 'synced' && ...)` → `if (existing)` (terminal já tratado acima)
    - Mensagem update movido para fora dos branches (não mais duplicado)
  - **`fetch.ts`:**
    - Import `reconcileTerminalDraft` de `./utils`
    - Adicionado early check com `return 'draft'` após o fetch do `existingDraft`
    - Guarda simplificada: `if (existingDraft && ...)` → `if (existingDraft)`
    - Mensagem update consolidado para fora dos branches (elimina duplicação de 4 linhas)
  - **Validação:** build repo-wide 17/17 ✅, testes backend 28 files 223/223 ✅
