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
