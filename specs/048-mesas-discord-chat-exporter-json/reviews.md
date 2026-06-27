# Reviews — 048 Importador DiscordChatExporter JSON

Arquivo reservado para reviews de PR/bots da Spec 048.

Regra herdada da Spec 047:

- Reviews de bot/PR entram aqui.
- Débitos descobertos fora de review entram em `debitos.md`.
- Não responder bots no PR; registrar veredito e correção na spec.

## Auditoria inicial — 2026-06-23

- Sem PR ainda.
- Sem review externo ainda.
- Auditoria local concluiu:
  - `extracao_json.json` válido e útil como fixture real não-versionável.
  - `extracao_json2.json` inválido/truncado e útil como fixture negativa.
  - decisão recomendada: `discord_import_messages`, endpoint em `adminDiscordSync`.

## Reviews — PR #91 (2026-06-23)

### REV-001 — source_id sintético quebra FK UUID

- **Origem:** chatgpt-codex-connector (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/backend/src/discord/chatExporterImportService.ts:78`
- **Resumo:** `source_id` usa string sintética `chat-exporter-${channelId}`, mas `discord_import_messages.source_id` é FK UUID para `discord_import_sources`. Postgres rejeita o insert. Deve buscar ou criar a linha em `discord_import_sources` para o canal exportado e usar o UUID real.
- **Severidade declarada:** P1 (Badge)
- **Status:** implementado ✅
- **Task vinculada:** T-B3 (serviço importDiscordChatExporterJson)
- **Débito vinculado:** —

### Evidência — REV-001

- **Arquivos/linhas:** `apps/mesas/database/migration_115_discord_import.sql:30-31` — `source_id UUID NOT NULL REFERENCES discord_import_sources (id) ON DELETE CASCADE`.
- **Código:** `chatExporterImportService.ts:78` — `source_id: \`chat-exporter-${channelId}\`` — string TEXT, não UUID.
- **Documentação:** Migration define FK explícita. `discord_import_sources` é tabela real com `channel_id UNIQUE`, `guild_id`, `channel_name`, etc.
- **Já existe tratamento no projeto?** Sim — `adminDiscordSync.ts:541-556` faz find-or-create de `discord_import_sources` por `channel_id` para o fluxo normal do bot. Não há função compartilhada de upsert.
- **Impacto real:** Todo insert do importador JSON falha com erro de FK no Postgres. Nenhuma mensagem é importada. É blocker total.
- **Severidade real:** **Crítico (P0)** — bloqueia MVP.
- **Risco de regressão:** Médio. Precisa de upsert em `discord_import_sources` por `channel_id` + `guild_id` e reuso do UUID retornado. Afeta o schema FK, mas não altera a migration.
- **Conclusão:** Procede e deve ser implementado — blocker. Sem solução, o endpoint nunca insere uma linha.
- **Recomendação:** Extrair função compartilhada `ensureDiscordImportSource(db, { channelId, guildId, channelName })` que faz upsert e retorna o UUID. Usar no lugar de `\`chat-exporter-${channelId}\``.

### REV-002 — Atualizações de mensagem editada não persistem message_edited_at

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/backend/src/discord/chatExporterImportService.ts:64-127`
- **Resumo:** Quando `content_hash` muda, o update grava `content_raw`, `content_hash`, `embeds`, `attachments` mas não grava `message_edited_at`. Isso mantém metadado de edição defasado no banco para mensagens alteradas.
- **Severidade declarada:** 🟠 Major | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** T-B8 (mensagem editada)
- **Débito vinculado:** —

### Evidência — REV-002

- **Arquivos/linhas:** `chatExporterImportService.ts:33` — `UpdateRow` não tem campo `messageEditedAt`. `chatExporterImportService.ts:99-105` — `toUpdate.push()` omite `messageEditedAt`. `chatExporterImportService.ts:113-127` — `.set()` omite `message_edited_at`.
- **Código relacionado:** `chatExporterAdapter.ts:69` — `message_edited_at: msg.timestampEdited ? new Date(msg.timestampEdited) : null` — o adapter produz o campo corretamente. O tipo `InsertRow` (line 27) inclui `message_edited_at`. Só o caminho de update está incompleto.
- **Já existe tratamento no projeto?** Sim — o adapter já mapeia `message_edited_at` (adapter.ts:69) e o insert o persiste (importService.ts:93). Só o update não o carrega.
- **Impacto real:** Mensagens reimportadas após edição perdem o timestamp de edição. O campo fica `null` ou desatualizado. Mas o impacto é limitado ao metadado — conteúdo/hash são atualizados.
- **Severidade real:** **Média (Major)** — perda de metadado, sem quebra funcional do MVP.
- **Risco de regressão:** Muito baixo — adicionar campo ao UpdateRow e ao .set() é aditivo.
- **Conclusão:** Procede e deve ser implementado — correção pontual, quick win.
- **Recomendação:** Adicionar `messageEditedAt: Date | null` ao tipo `UpdateRow`, popular no push e incluir no `.set()` do update.

### REV-003 — Idempotência quebra sob concorrência (TOCTOU)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/backend/src/discord/chatExporterImportService.ts:64-127`
- **Resumo:** A lógica lê o estado atual (SELECT) e depois faz inserts/updates. Duas requisições simultâneas com o mesmo payload podem tentar inserir os mesmos `discord_message_id`, resultando em duplicação (se não houver unique) ou erro de constraint (se houver), quebrando a idempotência do import.
- **Severidade declarada:** 🟠 Major | 🏗️ Heavy lift
- **Status:** implementado ✅
- **Task vinculada:** T-B7 (idempotência)
- **Débito vinculado:** —

### Evidência — REV-003

- **Arquivos/linhas:** `chatExporterImportService.ts:64-69` (SELECT) → `chatExporterImportService.ts:109-110` (INSERT). Entre eles não há lock.
- **Código relacionado:** Migration line 48: `CONSTRAINT discord_import_messages_channel_msg_unique UNIQUE (discord_channel_id, discord_message_id)`. A UNIQUE constraint existe — não haveria duplicação silenciosa, mas sim erro de unique violation no Postgres retornando 500 para o admin.
- **Já existe tratamento no projeto?** O fluxo normal do bot (`ingestMessages.ts`) também faz SELECT → INSERT sem lock explícito, mas roda serializado (cron single-thread). O importador JSON é manual/upload, então concorrência real é baixa, mas o gargalo de idempotência é real.
- **Impacto real:** Duas abas abertas com mesmo JSON causam erro 500 na segunda. Baixa probabilidade em cenário normal (admin importa manualmente), mas quebra o contrato de idempotência.
- **Severidade real:** **Média (Major)** — impacto real baixo (admin raramente faz upload simultâneo), mas quebra contrato.
- **Risco de regressão:** Moderado. Solução ideal (`ON CONFLICT DO NOTHING`/`ON CONFLICT DO UPDATE`) muda a estratégia de SELECT→INSERT para INSERT upsert direto. Precisa de migração ou query atômica. Alternativa mais simples e segura: envolver em transaction + `SELECT ... FOR UPDATE` na leitura. Mas `FOR UPDATE` em tabela staging com volume alto pode escalar mal.
- **Conclusão:** Procede. Para o MVP, solução pragmática: usar `ON CONFLICT (discord_channel_id, discord_message_id) DO NOTHING` para inserts (ignora com segurança) e `ON CONFLICT DO UPDATE` para updates. Isso elimina TOCTOU sem lock.
- **Recomendação:** Substituir o SELECT → batch INSERT por single `INSERT INTO ... VALUES ... ON CONFLICT (discord_channel_id, discord_message_id) DO NOTHING RETURNING id`. E o loop de updates por batch `UPDATE ... FROM ... WHERE` ou usando `INSERT ... ON CONFLICT DO UPDATE`. Se Kysely não suportar `ON CONFLICT` em batch, usar `sql` raw ou serializar por mensagem com try/catch.
- **Observação:** A UNIQUE constraint já existe (migration_115 line 48), então não precisa de migration extra para esta correção.

### REV-004 — Validar timestamps com z.string().datetime()

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/backend/src/discord/discordChatExporterTypes.ts:72-74`
- **Resumo:** `timestamp`, `timestampEdited` e `callEndedTimestamp` usam `z.string()` sem validação. O código downstream converte com `new Date()` sem validação prévia. Strings inválidas escapam, resultam em `Invalid Date` e causam falhas silenciosas ou erro 500 em vez de 400. Sugere usar `z.string().datetime()`.
- **Severidade declarada:** 🟠 Major
- **Status:** implementado ✅
- **Task vinculada:** T-B1 (normalizador Zod)
- **Débito vinculado:** —

### Evidência — REV-004

- **Arquivos/linhas:** `discordChatExporterTypes.ts:72-74` — `timestamp: z.string()`, `timestampEdited: z.string().nullable().optional()`, `callEndedTimestamp: z.string().nullable().optional()`.
- **Código downstream:** `chatExporterAdapter.ts:68-69` — `message_created_at: msg.timestamp ? new Date(msg.timestamp) : null` e `message_edited_at: msg.timestampEdited ? new Date(msg.timestampEdited) : null`. Zod valida como `string`, não como `string().datetime()`, então `new Date("invalid")` vira `Invalid Date`.
- **Documentação pública:** `z.string().datetime()` do Zod valida strings no formato ISO 8601 (ex: `2024-01-01T00:00:00.000Z`). O DiscordChatExporter exporta timestamps no formato `2024-01-01T00:00:00.000+00:00` (ISO 8601 com offset), que `z.string().datetime()` aceita com a opção `offset: true` (a partir do Zod 3.23.8+). O default `z.string().datetime()` sem opções exige sufixo `Z` estrito. Precisa verificar se o DiscordChatExporter usa `Z` ou `+00:00`.
  - Testei mentalmente: o formato real do DiscordChatExporter é `2024-01-01T00:00:00.000+00:00` (offset explícito). `z.string().datetime({ offset: true })` suporta ambos. Export do DiscordChatExporter real (arquivo `extracao_json.json`) — preciso confirmar.
- **Já existe tratamento no projeto?** Não há validação ISO-8601 em tempo de schema no projeto para este tipo. `z.string().datetime()` resolveria.
- **Impacto real:** Se o JSON exportado tiver timestamp inválido, `new Date("invalid")` retorna `Invalid Date`, que serializado para JSON vira `null`, que Postgres aceita como `NULL` para `TIMESTAMPTZ`. Silencioso — mensagem é importada com `message_created_at = null`. Não quebra, mas perde dado.
- **Severidade real:** **Média (Major)** — perda silenciosa de dado sem quebra de fluxo.
- **Risco de regressão:** Baixo. `z.string().datetime()` é validação mais restritiva, então pode rejeitar JSONs que antes passavam. Para evitar isso na prática, o DiscordChatExporter sempre produz ISO 8601 válido. Risco tolerável.
- **Conclusão:** Procede e deve ser implementado — validar ISO 8601 no schema elimina falha silenciosa.
- **Recomendação:** Usar `z.string().datetime({ offset: true })` nos 3 campos para aceitar tanto `Z` quanto `+00:00`.

### REV-005 — Adicionar rótulo acessível para textarea de JSON

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review)
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/components/DiscordJsonImportPanel.tsx:67-72`
- **Resumo:** O `<textarea>` depende só de `placeholder`, o que prejudica navegação por leitor de tela. Sugere adicionar `<label htmlFor>` com texto "JSON do DiscordChatExporter" e `id` no textarea.
- **Severidade declarada:** 🟡 Minor | ⚡ Quick win
- **Status:** implementado ✅
- **Task vinculada:** T-D1 (UI upload manual)
- **Débito vinculado:** —

### Evidência — REV-005

- **Arquivos/linhas:** `DiscordJsonImportPanel.tsx:67-72` — `<textarea>` sem `id`, sem `aria-label`. Apenas `placeholder='Cole o JSON aqui...'`.
- **Código relacionado:** O `<textarea>` está dentro de `<div className="space-y-4">` com `<h3>` e `<p>` acima, mas sem associação semântica via `aria-labelledby` ou `htmlFor`.
- **Documentação:** WCAG 2.1 SC 4.1.2 (Name, Role, Value) — todo input precisa de nome acessível. Placeholder não substitui label.
- **Já existe tratamento no projeto?** Outros componentes no mesmo app (DiscordSyncPanel) usam padrão similar sem label. É padrão do código legado do mesas, não exceção.
- **Impacto real:** Usuário de leitor de tela não identifica o campo. UI admin-only (não público), mas acessibilidade é compromisso do projeto (AGENTS.md: Nielsen/ISO 9241-11).
- **Severidade real:** **Baixa (Minor)** — campo admin-only, baixa frequência de uso.
- **Risco de regressão:** Muito baixo — adição de `id` + `aria-label` ou `<label>` sem alteração visual.
- **Conclusão:** Procede e deve ser implementado — quick win de acessibilidade, alinhado com as regras de UI do projeto.
- **Recomendação:** Adicionar `aria-label="JSON do DiscordChatExporter"` ao textarea, ou `<label htmlFor="discord-json-input">` + `id="discord-json-input"`.

### REV-006 — Duplicated Lines 16.8% em chatExporterImportService.ts

- **Origem:** SonarCloud (check)
- **Tipo:** PR (check automatizado)
- **Referência:** `apps/mesas/backend/src/discord/chatExporterImportService.ts` — 23 linhas duplicadas (16.8%)
- **Resumo:** O check de Duplicated Lines do SonarCloud aponta 16.8% de linhas duplicadas (23 linhas) no arquivo novo `chatExporterImportService.ts` — acima do threshold de 4.5% para código novo.
- **Severidade declarada:** 4.5% threshold, 16.8% reportado
- **Status:** implementado ✅
- **Task vinculada:** T-B3 (serviço importDiscordChatExporterJson)
- **Débito vinculado:** —

### Evidência — REV-006

- **Arquivos/linhas:**
  - `chatExporterAdapter.ts:29-35` ↔ `chatExporterImportService.ts:35-41` — função `getContentHash` idêntica (7 linhas, mesmo corpo).
  - `chatExporterImportService.ts:8-10` ↔ `ingestMessages.ts:9-11` — função `asJsonbArray` idêntica (3 linhas).
- **Código relacionado:** `ingestMessages.ts:169-176` — terceira cópia de `getContentHash` (aceita `DiscordApiMessage` em vez de `DiscordChatExporterMessage`, mas corpo idêntico). Esta terceira cópia não está em código novo da spec 048, então SonarCloud não a contou.
- **Já existe tratamento no projeto?** Não. As funções auxiliares `asJsonbArray` e `getContentHash` são reimplementadas em cada arquivo que precisa delas. Não há módulo compartilhado de utilitários Discord.
- **Impacto real:** Código duplicado = manutenção mais cara (3 lugares para corrigir se o algoritmo de hash mudar). Sem quebra funcional.
- **Severidade real:** **Média** — duplicação estrutural, sem quebra, mas gera ruído no quality gate.
- **Risco de regressão:** Médio — extrair para utilitário compartilhado exige mover funções, atualizar imports. Risco baixo se feito com cuidado.
- **Conclusão:** Procede. A duplicação é real — `getContentHash` (2x nos novos arquivos) e `asJsonbArray` (1x no novo, outra existente). Para eliminar, extrair `asJsonbArray` para um shared util e eliminar a duplicação de `getContentHash` no importService (já que o adapter exporta a mesma função).
- **Recomendação:** (1) Mover `getContentHash` para `chatExporterAdapter.ts` (já existe lá) e reexportar/importar de lá no `chatExporterImportService.ts` — elimina 7+7 linhas duplicadas. (2) Extrair `asJsonbArray` para utils compartilhados (ex: `src/discord/shared.ts`) e importar onde necessário — elimina 3+3 linhas duplicadas. Total estimado: ~20 linhas eliminadas.

---

## Implementação — REV-001 (2026-06-23)

### O que foi feito

1. **Criada função `ensureDiscordImportSource()`** em `chatExporterImportService.ts`:
   - Busca por `channel_id` em `discord_import_sources`.
   - Se existir, retorna o UUID existente.
   - Se não existir, cria nova linha com `guild_id`, `channel_id`, `channel_name`, `channel_type` (mapeado), `enabled=true`, `auto_sync_enabled=false` e retorna o UUID gerado.

2. **Criada função `mapChannelType()`** — mapeia o `channel.type` do DiscordChatExporter (`'announcement'`, `'news'`, `'guild_announcement'` → `'announcement'`; `'forum'`, `'guild_forum'` → `'forum'`; default → `'text'`).

3. **Substituída string sintética** `source_id: \`chat-exporter-${channelId}\`` pelo UUID real retornado de `ensureDiscordImportSource()`.

4. **Parâmetros extras extraídos** do export: `channelName` e `channelType` para popular a source corretamente.

### Arquivos alterados

- `apps/mesas/backend/src/discord/chatExporterImportService.ts` — adicionadas `ensureDiscordImportSource()`, `mapChannelType()`; chamada no início de `importDiscordChatExporterJson()`; `source_id` agora usa UUID real.

### Validação

- `pnpm --filter @artificio/mesas-backend build` — ✅ sem erros
- `pnpm --filter @artificio/mesas-backend test` — 180/180 ✅
- `pnpm --filter @artificio/mesas-frontend build` — ✅
- `pnpm --filter @artificio/mesas-frontend test` — 19/19 ✅
- `pnpm run lint` — pendente (rodar no final de todas as tasks)
- `pnpm run build` — pendente (rodar no final de todas as tasks)

---

## Reviews — Código local Fase C/F + reparse (2026-06-26)

### REV-007 — Guard "mesa em andamento" descarta vagas explícitas

- **Origem:** @chatgpt-codex-connector (bot)
- **Data:** 2026-06-26
- **Severidade:** P2
- **Arquivo:** `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts` lines ~213-214 (contexto: bloco `extractSlots`, guard `mesa em andamento` vs `N vaga via forms`)
- **Resumo:** Quando o texto combina "Mesa em andamento" com uma vaga explícita (ex.: `"Atualmente temos 1 vaga via forms"`), o `return { total: null, open: null }` da regex `\bmesa\s+em\s+andamento\b` na linha 251 acontece **antes** do parser de `N vaga via forms` na linha 256, então `slots_total`/`slots_open` ficam `null` e o draft perde uma vaga real.
- **Sugestão:** Tratar "mesa em andamento" como fallback apenas quando não houver contagem explícita de vagas no anúncio, reordenando o fluxo: testar padrões explícitos de vaga primeiro, e só aplicar o guard como último recurso.

#### Evidência — REV-007

- **Arquivos/linhas:** `parseDiscordAnnouncement.ts:250-253` (guard `mesa em andamento`) → `parseDiscordAnnouncement.ts:256-262` (parser `N vaga via forms`).
- **Código:** A função `extractSlots` executa o guard na linha 251-252 **antes** de qualquer padrão de contagem explícita (linhas 256+). Se o texto contém ambas as frases ("Mesa em andamento" e "1 vaga via forms"), a regex do guard casa primeiro e retorna `{ total: null, open: null }`, impedindo que o parser de `N vaga via forms` sequer seja alcançado.
- **Já existe tratamento no projeto?** Não. O guard foi adicionado na Fase C (T-C6, vagas informais) como proteção contra fabricar números em mesas lotadas. Mas a interação com o parser de vagas explícitas não foi tratada.
- **Impacto real:** Perda de vaga real quando o anúncio explicita a vaga junto com "mesa em andamento". O draft fica sem informação de slots.
- **Severidade real:** **Média (P2)** — perda de dado, mas sem quebra de fluxo (draft é criado, só sem contagem de vagas).
- **Risco de regressão:** Baixo. Reordenar: checar padrões explícitos de vaga antes do guard "mesa em andamento". Se algum padrão explícito casar, retornar ele; se nenhum casar, aí aplicar o guard. O guard continua protegendo contra fabricação indevida, só não bloqueia informação real.
- **Conclusão:** **Procede.** Deve ser corrigido reordenando o fluxo: padrões explícitos de vaga antes do guard.
- **Débito vinculado:** DEB-048-16

---

### REV-008 — Filtro de status bloqueia reparse de mensagens já parseadas

- **Origem:** @chatgpt-codex-connector (bot)
- **Data:** 2026-06-26
- **Severidade:** P2
- **Arquivo:** `apps/mesas/backend/src/routes/discord/import.ts` line 47
- **Resumo:** O filtro `where('status', 'in', ['pending', 'needs_review'])` no endpoint `/import-json/reparse` impede reprocessar o caso principal de uso: mensagens do ChatExporter que já passaram pelo parser antigo ficam com `discord_import_messages.status = 'parsed'`, enquanto o estado `needs_review` fica no draft. Mesmo passando `messageIds`, essas linhas são filtradas e o endpoint retorna zero, impedindo que os hardenings da Fase C sejam reaplicados em imports existentes.

#### Evidência — REV-008

- **Arquivos/linhas:** `import.ts:43-51` — query base filtra `status IN ('pending', 'needs_review')`. O filtro por `messageIds` (linha 49-50) é AND adicional — se as mensagens têm `status = 'parsed'`, a query retorna zero linhas.
- **Código relacionado:** O fluxo normal de import (Fase B) grava `status = 'parsed'` ao final do processamento bem-sucedido (`chatExporterImportService.ts`). O reparse foi concebido para reaplicar hardenings do parser em mensagens já importadas, mas o filtro de status impede isso.
- **Já existe tratamento no projeto?** Não. O endpoint `/reparse` foi adicionado na Fase C (T-C8), mas o filtro de status não foi ajustado para o caso de uso real.
- **Impacto real:** O endpoint `/reparse` retorna `{ total: 0, reparsed: 0, errors: 0 }` para qualquer `messageIds` cujas mensagens tenham sido processadas com sucesso. O reparse é inútil para o cenário principal.
- **Severidade real:** **Média (P2)** — funcionalidade parcialmente quebrada. O reparse funciona para mensagens em `pending`/`needs_review`, mas não para o caso de uso principal (reaplicar parser melhorado em mensagens já processadas).
- **Risco de regressão:** Moderado. Relaxar o filtro para incluir `'parsed'` quando `messageIds` é fornecido pode re-processar mensagens que já estão synced (embora o guard `message.status === 'synced'` no loop proteja). Se `messageIds` não for fornecido, manter o filtro original para evitar processar tudo.
- **Conclusão:** **Procede.** Quando `messageIds` é explicitamente fornecido, o filtro deve incluir também `status = 'parsed'` (além de `pending` e `needs_review`). Opcional: só remover o filtro de status completamente quando `messageIds` é fornecido, confiando no guard `synced` dentro do loop.
- **Débito vinculado:** DEB-048-17

---

### REV-009 — Fuso UTC vs local em extractDiscordTimestamp

- **Origem:** @coderabbitai (bot)
- **Data:** 2026-06-26
- **Severidade:** 🟡 Minor (Functional Correctness)
- **Arquivo:** `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts` lines ~313-321 (função `extractDiscordTimestamp`)
- **Resumo:** `extractDiscordTimestamp` usa `getUTCDay()`/`getUTCHours()`/`getUTCMinutes()` e grava esses valores direto no draft como `day_of_week` e `start_time`. Se o consumo esperado é horário local do anúncio (ex.: Brasil UTC-3), o dia e a hora podem ficar deslocados em relação ao que foi publicado no Discord. Ex.: um jogo anunciado às 19h (horário local) aparece como 22h (UTC) no draft.

#### Evidência — REV-009

- **Arquivos/linhas:** `parseDiscordAnnouncement.ts:346-362` — função `extractDiscordTimestamp`.
  - Linha 356: `const dayOfWeek = daysPt[date.getUTCDay()];`
  - Linha 357: `const hh = String(date.getUTCHours()).padStart(2, '0');`
  - Linha 358: `const mm = String(date.getUTCMinutes()).padStart(2, '0');`
- **Código relacionado:** A função é chamada durante o parsing de anúncios na Fase C (T-C1, timestamps Discord `<t:UNIX>`). O valor extraído é injetado em `DiscordTableDraftTable.day_of_week` e `start_time`.
- **Já existe tratamento no projeto?** Não. A função `extractStartTime` (linha 334, regex de "19h"/"19:00") extrai horário literal do texto, que já é o horário local pretendido pelo autor. `extractDiscordTimestamp` é a única que lida com timestamps Unix e aplica UTC sem ajuste.
- **Impacto real:** Para anúncios em fuso brasileiro (UTC-3, maioria), o `start_time` fica 3 horas adiantado. `day_of_week` pode cruzar a meia-noite (ex.: 22h UTC de domingo → "segunda" em vez de "domingo" se o offset cruzar). Isso exige que o admin corrija manualmente o draft.
- **Severidade real:** **Baixa (Minor)** — os drafts exigem revisão humana de qualquer forma, e o admin pode corrigir. Mas a informação extraída fica errada por padrão para o fuso brasileiro, degradando a automação.
- **Risco de regressão:** Moderado. Ajustar para fuso local exige decidir qual fuso alvo (Brasil UTC-3 fixo? Ou inferir do servidor Discord?). Se `extractDiscordTimestamp` é suposto ser UTC, documentar isso no draft (`_notes` ou campo dedicado) evita confusão.
- **Conclusão:** **Procede.** A função deve ou (a) converter para o fuso local alvo (ex.: UTC-3, subtrair 3h), ou (b) marcar explicitamente que o valor é UTC no `_notes` do draft, ou (c) usar `getDay()`/`getHours()`/`getMinutes()` (hora local do servidor) se o ambiente de execução estiver no fuso correto. A opção (a) com constante de offset é a mais previsível.
- **Débito vinculado:** DEB-048-18

---

### REV-010 — Falta Array.isArray em messageIds de payload externo

- **Origem:** @coderabbitai (bot)
- **Data:** 2026-06-26
- **Severidade:** 🟠 Major (Security & Privacy)
- **Arquivo:** `apps/mesas/backend/src/routes/discord/import.ts` lines ~41-51
- **Resumo:** `messageIds` vem de `req.body` (payload externo não confiável). O acesso a `messageIds.length` (linha 49) e o cast `messageIds as any` (linha 50) na cláusula `in` assumem que é um array. Um cliente pode enviar `messageIds: "abc"` (string), fazendo `.length` passar (`3 > 0`) e gerar SQL inválido / comportamento inesperado. **Violação da regra pétrea:** "É proibido usar `.length` sobre payload externo sem `Array.isArray`".

#### Evidência — REV-010

- **Arquivos/linhas:** `import.ts:41-51`:
  - Linha 41: `const { messageIds }: { messageIds?: string[] } = req.body ?? {};` — destructuring com tipo TypeScript, sem validação em runtime.
  - Linha 49: `if (messageIds && messageIds.length > 0)` — `.length` sobre `req.body` sem `Array.isArray`.
  - Linha 50: `query = query.where('discord_message_id', 'in', messageIds as any);` — `as any` bypassa type-check.
- **Código relacionado:** A rota `POST /reparse` é protegida por `requireAdmin`, o que reduz o blast radius (só admin autenticado), mas não elimina o risco de dados malformados.
- **Documentação:** `AGENTS.md` §Normalização obrigatória: "É proibido `.length` sobre payload externo sem `Array.isArray`/schema/fallback explícito."
- **Já existe tratamento no projeto?** Não. Outras rotas no mesas validam payload com Zod (ex.: `patchDraftSchema`, `importInboxSchema`). Esta rota não tem schema Zod para o body.
- **Impacto real:** Um admin enviando payload malformado (string em vez de array) pode causar erro 500 ou SQL injection-like via injeção na cláusula `IN`. Blast radius limitado a admin autenticado, mas viola a regra pétrea de normalização.
- **Severidade real:** **Média (Major)** — rota admin-only reduz criticidade, mas a violação de regra pétrea + bypass de type-safety é grave.
- **Risco de regressão:** Muito baixo. Adicionar `Array.isArray(messageIds) && messageIds.every(id => typeof id === 'string')` antes do `.length` e da cláusula `in`. Remover o `as any`.
- **Conclusão:** **Procede.** Deve validar `messageIds` como array de strings com `Array.isArray` antes de usar `.length` e `in`, eliminando o `as any`.
- **Débito vinculado:** DEB-048-19

---

### REV-011 — Catch interno pode abortar lote inteiro se DB falhar

- **Origem:** @coderabbitai (bot)
- **Data:** 2026-06-26
- **Severidade:** 🟡 Minor (Stability & Availability)
- **Arquivo:** `apps/mesas/backend/src/routes/discord/import.ts` lines ~124-130
- **Resumo:** O `catch` interno (linha 124) executa `await db.updateTable(...)` para marcar a mensagem como `error`. Se essa atualização falhar (ex.: indisponibilidade momentânea do banco), o erro escapa para o `catch` externo (linha 140), que retorna 500 e **interrompe o processamento das mensagens restantes no lote**. Além disso, `parse_error: 'Erro no reparse em lote'` descarta a causa real do erro, dificultando diagnóstico.

#### Evidência — REV-011

- **Arquivos/linhas:** `import.ts:124-130`:
  - Linha 124: `} catch {` — captura erro do loop de processamento, mas não captura erro do próprio `db.updateTable`.
  - Linhas 125-128: `await db.updateTable('discord_import_messages').set({ status: 'error', parse_error: 'Erro no reparse em lote', ... }).execute();` — se esta query falhar, o erro **não é capturado pelo catch atual** (já está dentro do catch, mas `await` pode lançar).
  - Linha 131: `errors++;` — nunca executado se o `updateTable` lançar.
- **Código relacionado:** O loop for (linha 62) processa cada mensagem sequencialmente. Se uma iteração falha no catch → erro propaga para `catch` externo (linha 140) → `res.status(500)` → lote abortado.
- **Já existe tratamento no projeto?** Padrão similar no `ingestMessages.ts` — mas lá o processamento é em lotes menores e idempotente, o que reduz o impacto de abort.
- **Impacto real:** Em condição de stress do banco (conexão cai, deadlock, timeout), uma falha de update em uma mensagem com erro aborta todo o lote de até 500 mensagens. As mensagens processadas antes da falha **já tiveram seus drafts atualizados** (commit automático por statement), mas o endpoint retorna 500 (o admin não sabe quantas foram processadas).
- **Severidade real:** **Baixa (Minor)** — cenário de falha de DB durante catch é raro, mas quando ocorre, o impacto é desproporcional (lote inteiro abortado + inconsistência de estado).
- **Risco de regressão:** Muito baixo. Envolver o `db.updateTable` do catch em seu próprio `try/catch` interno. Se falhar, logar o erro real e continuar o loop. Preservar `error.message` (ou ao menos `error instanceof Error ? error.message : 'unknown'`) no `parse_error` em vez de string genérica.
- **Conclusão:** **Procede.** Deve envolver a atualização de status de erro em `try/catch` próprio e preservar a mensagem de erro real.
- **Débito vinculado:** DEB-048-20

---

### REV-012 — Duplicated Lines 32.4% em import.ts (boilerplate)

- **Origem:** @coderabbitai (bot) — análise de duplicação
- **Data:** 2026-06-26
- **Severidade:** 🟡 Info
- **Arquivo:** `apps/mesas/backend/src/routes/discord/import.ts`
- **Métrica:** 32.4% de linhas duplicadas no novo código (`/reparse`, L38-144); 5.3% no total do PR
- **Resumo:** O endpoint `POST /import-json/reparse` (L38-144) tem sobreposição estrutural com o endpoint `POST /` (L10-34): ambos recebem payload, usam `requireAdmin`, chamam `parseDiscordMessage` (direta ou indiretamente), respondem com envelope `{ data: { ... } }` e têm catch blocks com `console.error` + `res.status(500)`.
- **Status:** investigado — **procede (baixa prioridade)**
- **Task vinculada:** —
- **Débito vinculado:** DEB-048-21

#### Evidência — REV-012

- **Arquivos/linhas:**
  - `import.ts:10-36` — handler `POST /`: extrai payload → `importDiscordChatExporterJson` → `{ data: { total, inserted, updated, ignored, failed } }` + catch com `DiscordChatExporterValidationError`→400 / default→500.
  - `import.ts:38-144` — handler `POST /reparse`: extrai `messageIds` → query DB → loop `parseDiscordMessage` → reconcilia drafts → `{ data: { total, reparsed, errors } }` + catch default→500.
- **Sobreposição:** boilerplate estrutural de handlers Express (try/catch + envelope JSON). Lógicas de negócio são distintas.
- **Conclusão (verificado no código, 2026-06-26):** **Procede** como dívida real, mas **baixa prioridade (Info)**. O dedup correto = extrair helper de resposta de erro compartilhado (`respondImportError`), **sem** abstrair a lógica de negócio. **Fazer por último** no PR-4, depois dos fixes REV-008/010/011 que remodelam o `/reparse`, para evitar churn. Débito: DEB-048-21.

---

## Implementação — REV-006 (2026-06-23)

### O que foi feito

1. **`getContentHash()` exportada de `chatExporterAdapter.ts`** — removida a cópia em `chatExporterImportService.ts` e importada do adapter.
2. **`asJsonbArray()` removida de `chatExporterImportService.ts`** — não é mais usada desde a reescrita do upsert (REV-003) que usa `::jsonb` raw.
3. **Tipos `InsertRow` e `UpdateRow` removidos** — não usados após upsert raw.
4. **`import crypto` removido** de `chatExporterImportService.ts`.

### Linhas economizadas

- `getContentHash`: ~7 linhas (antes copiada, agora importada do adapter)
- `asJsonbArray`: ~3 linhas (removida)
- `InsertRow`/`UpdateRow`: ~30 linhas (removidos como não-usados)
- `import crypto`: 1 linha (removida)

Total: ~41 linhas eliminadas, reduzindo significativamente a métrica de duplicação reportada pelo SonarCloud.

### Arquivos alterados

- `apps/mesas/backend/src/discord/chatExporterAdapter.ts` — `getContentHash` agora é `export function`.
- `apps/mesas/backend/src/discord/chatExporterImportService.ts` — removidos `crypto`, `asJsonbArray`, `InsertRow`, `UpdateRow`, `getContentHash` local; importa `getContentHash` do adapter.

### Validação

- `pnpm --filter @artificio/mesas-backend build` — ✅
- `pnpm --filter @artificio/mesas-backend test` — 180/180 ✅

---

---

## Implementação — REV-005 (2026-06-23)

### O que foi feito

Adicionados `id="discord-json-input"` e `aria-label="JSON do DiscordChatExporter"` ao `<textarea>` em `DiscordJsonImportPanel.tsx`:
- `id` permite associação via `<label htmlFor>` futura ou `aria-labelledby`.
- `aria-label` garante nome acessível para leitores de tela (WCAG SC 4.1.2).

### Arquivos alterados

- `apps/mesas/frontend/src/features/discord-sync/components/DiscordJsonImportPanel.tsx` — textarea ganha `id` e `aria-label`.

### Validação

- `pnpm --filter @artificio/mesas-frontend build` — ✅
- `pnpm --filter @artificio/mesas-frontend test` — 19/19 ✅

## Implementação — REV-004 (2026-06-23)

### O que foi feito

Substituídos `z.string()` por `z.string().datetime({ offset: true })` nos 3 campos de timestamp em `discordChatExporterMessageSchema`:

- `timestamp` — obrigatório, agora valida ISO 8601 com offset
- `timestampEdited` — nullable optional, agora valida ISO 8601 com offset
- `callEndedTimestamp` — nullable optional, agora valida ISO 8601 com offset

A opção `{ offset: true }` foi escolhida porque o DiscordChatExporter exporta timestamps no formato `2026-06-22T22:45:12.54-03:00` (com offset de fuso, não sufixo `Z`). `z.string().datetime()` padrão (sem `offset`) só aceita `Z`. Zod 4.4.3 usado no projeto suporta `{ offset: true }`.

### Arquivos alterados

- `apps/mesas/backend/src/discord/discordChatExporterTypes.ts` — linhas 72-74: `z.string()` → `z.string().datetime({ offset: true })`.

### Validação

- `pnpm --filter @artificio/mesas-backend build` — ✅
- `pnpm --filter @artificio/mesas-backend test` — 180/180 ✅

---

## Implementação — REV-003 (2026-06-23)

### O que foi feito

Substituída a lógica SELECT → INSERT/UPDATE por **upsert atômico** via `INSERT ... ON CONFLICT ... DO UPDATE SET ... WHERE content_hash IS DISTINCT FROM EXCLUDED.content_hash RETURNING CASE WHEN xmax = 0`.

Mudança principal em `importDiscordChatExporterJson()`:

1. **Antes:** SELECT mensagens existentes → batch INSERT para não-existentes → loop UPDATE para hash diferente. TOCTOU entre SELECT e INSERT.
2. **Depois:** Loop serializado por mensagem com `INSERT ... ON CONFLICT (discord_channel_id, discord_message_id) DO UPDATE`. O Postgres resolve atomicamente:
   - `xmax = 0` → foi insert (mensagem nova)
   - `xmax != 0` + WHERE true → foi update (hash mudou)
   - Sem row retornada (WHERE false) → ignored (hash igual)
3. A UNIQUE constraint `discord_import_messages_channel_msg_unique` já existia (migration_115 line 48) — sem migration extra.

### Arquivos alterados

- `apps/mesas/backend/src/discord/chatExporterImportService.ts` — função `importDiscordChatExporterJson` reescrita com upsert atômico. Tipos `InsertRow` e `UpdateRow` removidos (não mais usados). Lógica simplificada.

### Validação

- `pnpm --filter @artificio/mesas-backend build` — ✅
- `pnpm --filter @artificio/mesas-backend test` — 180/180 ✅

---

## Implementação — REV-002 (2026-06-23)

### O que foi feito

1. **Adicionado `messageEditedAt: Date | null`** ao tipo `UpdateRow` em `chatExporterImportService.ts:33`.
2. **Populado no push de `toUpdate`**: `messageEditedAt: adapted.message_edited_at`.
3. **Adicionado no `.set()` do update**: `message_edited_at: upd.messageEditedAt`.

### Arquivos alterados

- `apps/mesas/backend/src/discord/chatExporterImportService.ts` — `UpdateRow` ganha `messageEditedAt`, push e `.set()` incluem o campo.

### Validação

- `pnpm --filter @artificio/mesas-backend build` — ✅ sem erros
- `pnpm --filter @artificio/mesas-backend test` — 180/180 ✅

---

## Reviews — CodeRabbit doc-only (2026-06-26)

> 3 reviews do @coderabbitai sobre documentação da spec 048. Não são de PR — são de auditoria automática nos arquivos de spec. Corrigidos nesta rodada.

### REV-013 — T-C8 em debitos.md com coluna faltante na tabela

- **Origem:** @coderabbitai (bot)
- **Tipo:** doc-only
- **Arquivo:** `specs/048-mesas-discord-chat-exporter-json/debitos.md:38`
- **Resumo:** Linha T-C8 da tabela de análise detalhada ficou com 4 células para uma tabela de 5 colunas. A coluna "Arquivo/linha" foi suprimida após o replanejamento para DEB-048-27, quebrando a renderização Markdown.
- **Severidade:** 🟡 Minor | ⚡ Quick win
- **Status:** ✅ corrigido — reinserida a 4ª coluna com `— (replanejado, ver DEB-048-27)`.

### REV-014 — Resumo da Fase G em tasks.md dessincronizado da seção detalhada

- **Origem:** @coderabbitai (bot)
- **Tipo:** doc-only
- **Arquivo:** `specs/048-mesas-discord-chat-exporter-json/tasks.md:20`
- **Resumo:** O cabeçalho de reconciliação listava T-G4/5/6/7/8 como pendentes, mas a seção detalhada (`§Fase G`, linha 296) já marca T-G1..T-G8 como ✅ COMPLETA. Duas fontes de verdade no mesmo arquivo.
- **Severidade:** 🟡 Minor | ⚡ Quick win
- **Status:** ✅ corrigido — resumo do topo alinhado com a seção detalhada: Fase G marcada como **COMPLETA** com todas as 8 tasks.

### REV-015 — Linha BL-MESAS-DISCORD-EXPORTER-048 no backlog.md com coluna faltante e status desatualizado

- **Origem:** @coderabbitai (bot)
- **Tipo:** doc-only
- **Arquivo:** `specs/backlog.md:105`
- **Resumo:** A linha perdeu a 6ª coluna ("Próximo passo") da tabela e ainda marcava T-G5/T-G7 como 🔵 futuro (spec 052), embora tasks.md e debitos.md já os tratem como implementados (Fase G completa). O campo "Falta para fechar" misturava diagnóstico com próximo passo.
- **Severidade:** 🟡 Minor | ⚡ Quick win
- **Status:** ✅ corrigido — colunas "Falta para fechar" e "Próximo passo" separadas corretamente. T-G5/T-G7 reconhecidos como parte da Fase G completa (infra/dados prontos); a execução de IA real pertence à spec 052 futura. Status alinhado com tasks.md.

---

## Reviews — SonarCloud (2026-06-26)

### REV-016 — Duplicated Lines (%) on New Code (SonarCloud) — **INVESTIGADO**

- **Origem:** SonarCloud (Quality Gate — New Code)
- **Tipo:** PR analysis (métrica de duplicação)
- **Severidade:** 🟡 Info — métrica de qualidade, não bloqueia merge
- **Investigado em:** 2026-06-26 (código lido, comparado par a par)
- **Conclusão geral:** 4 das 6 duplicações são **reais** (lógica idêntica com diferenças pontuais) e têm quick wins de baixo risco. 2 são **boilerplate estrutural aceitável** (handlers Express/Zod).

---

| # | Arquivo | % | Linhas | Par comparado | Veredito | Recomendação |
|---|---------|---|--------|---------------|----------|--------------|
| 1 | `inbox/corrections.ts` | 91.7% | 11 | vs `discord/corrections.ts:12-41` | ✅ **Real** — handlers `POST /:id/correction` são idênticos (só diferem no import path e mensagem de `console.error`). Ambos chamam `registerDraftCorrection`. | 🔵 **Baixa prioridade.** Só ~30 linhas cada; extrair handler compartilhado exigiria unificar imports e roteamento. Ganho real pequeno. Se mexer, extrair `createCorrectionHandler(module: 'inbox'|'discord')`. |
| 2 | `discord/import.ts` | 78.4% | 58 | `POST /` (linhas 21-54) vs `POST /file` (linhas 57-101) | ✅ **Real** — `recordImportRun` + envelope `{ data: { total, inserted, ... } }` + `respondImportError` são idênticos. O `/file` só adiciona validação de buffer. | 🟢 **Quick win.** Extrair `respondImportSuccess(res, result, userId)` que encapsula `recordImportRun` + `res.json({ data })`. Elimina ~20 linhas. Baixo risco. |
| 3 | `discord/preview.ts` | 45.9% | 28 | `POST /preview` (linhas 46-67) vs `POST /preview/file` (linhas 69-105) | ✅ **Real** — Bloco `schema.parse()` + `buildPreviewFromExport()` + catch `ZodError`→400/500 são idênticos. `buildPreviewFromExport` já é helper compartilhado ✅. | 🟢 **Quick win.** Extrair `respondPreviewError(res, error)` que unifica catch `ZodError` + `console.error` + 500. Elimina ~10 linhas de cada handler. Baixo risco. |
| 4 | `discordSyncApi.ts` | 41.6% | 32 | `previewFile` (linhas 292-309) vs `importFile` (linhas 311-328) | ✅ **Real** — Ambos são `FormData` → `authenticatedFetch` → error check → `parseXxxResult`. Diferem só na URL, parser e mensagem de erro. | 🟢 **Quick win.** Extrair `fileApiFetch<T>(url, file, parser, errorLabel)`. Elimina ~15 linhas. Baixo risco. |
| 5 | `useJsonImport.ts` | 36.7% | 22 | `handleFileSelect` (linhas 151-179) vs `handleDrop` (linhas 193-221) | ✅ **Real** — Validação de extensão + tamanho + threshold `<50KB→textarea` vs `≥50KB→backend` é idêntica. Só diferem na extração do arquivo (`event.target.files` vs `event.dataTransfer.files`) e mensagem de erro. | 🟢 **Quick win.** Extrair `processJsonFile(file, source: 'select'|'drop')` que encapsula validação + dispatch. Elimina ~22 linhas. Baixo risco. |
| 6 | `discord/corrections.ts` | 22.1% | 34 | vs `inbox/corrections.ts` (recíproco do #1) | ✅ **Real** — Mesmo handler `POST /:id/correction` duplicado. O restante do arquivo (export few-shot/eval, ~110 linhas) é único. | 🔵 **Baixa prioridade.** Ver #1. |

---

### Plano de ação recomendado (ordem de custo/benefício)

| Prioridade | Ação | Arquivo(s) | Linhas eliminadas | Risco |
|-----------|------|-----------|-------------------|-------|
| 🟢 1 | Extrair `respondImportSuccess` em `import.ts` | `import.ts` | ~20 | Baixíssimo — helper puro, sem lógica de negócio |
| 🟢 2 | Extrair `processJsonFile` em `useJsonImport.ts` | `useJsonImport.ts` | ~22 | Baixo — hook local, sem consumidores externos |
| 🟢 3 | Extrair `fileApiFetch` em `discordSyncApi.ts` | `discordSyncApi.ts` | ~15 | Baixo — API layer, sem estado |
| 🟢 4 | Extrair `respondPreviewError` em `preview.ts` | `preview.ts` | ~10 | Baixíssimo — helper puro |
| 🔵 5 | Unificar handlers `POST /:id/correction` | `inbox/corrections.ts` + `discord/corrections.ts` | ~30 | Médio — mexe em 2 módulos, roteamento, imports |

**Total:** ~97 linhas duplicadas elimináveis com ~67 linhas de helpers novos. Saldo líquido: ~30 linhas a menos.

**Não recomendado:** extrair handlers Express genéricos (ex.: `createCrudHandler`) — sobre-abstração que esconde lógica de negócio e dificulta debug. Cada handler tem seu próprio domínio de erro e contrato de resposta; a duplicação de boilerplate (try/catch/ZodError) é aceitável em arquivos pequenos.

**Status:** ✅ Investigado + ✅ Implementado (2026-06-26, 3 ondas).

**Onda 1 (4 quick wins):**
| Helper | Arquivo | Linhas eliminadas |
|--------|---------|-------------------|
| `respondImportSuccess` | `import.ts` | ~34 → 4 |
| `processJsonFile` | `useJsonImport.ts` | ~44 → 15 |
| `fileApiFetch` | `discordSyncApi.ts` | ~36 → 4 |
| `respondPreviewError` | `preview.ts` | ~12 → 2 |

**Onda 2 (residual — duplicação cruzada):**
| Helper | Arquivo | Linhas eliminadas |
|--------|---------|-------------------|
| `parseUploadedJsonBuffer` | `chatExporterImportService.ts` | ~28 → 2+linhas do helper |

**Onda 3 (unificar correction handlers):**
| Helper | Arquivo | Linhas eliminadas |
|--------|---------|-------------------|
| `createCorrectionHandler` | `discord/utils.ts` | `inbox/corrections.ts`: 41→4 (-37), `discord/corrections.ts`: 153→120 (-33) |

**Total:** 8 arquivos alterados (7 código + reviews.md). ~224 linhas duplicadas eliminadas. 447 testes verdes (284 backend + 163 frontend) em todas as ondas. Lint 15/15, Build 17/17. **Não commitado.**

## Reviews — PR #100 (2026-06-27) — import overhaul

Achados de bots no PR #100 (`feat/048-import-overhaul` → `dev`). **Registrados, ainda NÃO corrigidos** (pendente pesquisa/decisão). Veredito por achado vem depois.

### REV-017 — Autenticar rotas admin/secrets antes do requireAdmin

- **Origem:** chatgpt-codex-connector (bot)
- **Tipo:** PR (review) · **Severidade declarada:** P2 (Badge)
- **Referência:** `apps/accounts/src/adminSecretsRoutes.ts` (`PUT /admin/secrets/:name`)
- **Resumo:** `requireAdmin` só lê `req.session`, mas `createApp` não monta `requireAuth` antes de `createAdminSecretsRoutes` (só `/api/auth/me` usa). Rota retornaria sempre 403 ao salvar a chave DeepSeek pelo painel `/conta`. Montar middleware de auth antes do gate admin (e no GET fallback).
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

### REV-018 — Passar SERVICE_SECRET aos serviços em deploy

- **Origem:** chatgpt-codex-connector (bot)
- **Tipo:** PR (review) · **Severidade declarada:** P2 (Badge)
- **Referência:** `apps/mesas/backend/src/services/adminSecrets.ts:36-39` + `apps/accounts/docker-compose.prod.yml`, `apps/mesas/docker-compose.{beta,prod}.yml`
- **Resumo:** `SERVICE_SECRET` não é exportado aos containers accounts/mesas API, então beta/prod sempre cai no branch `!serviceSecret → return null` de `getSecret`. Enrichment DeepSeek nunca roda mesmo após chave armazenada. Wire do token nos blocks de env/secrets dos dois serviços antes de depender de `X-Service-Token`.
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

### REV-019 — Não zerar cover_public_id após delete falho engolido

- **Origem:** chatgpt-codex-connector (bot)
- **Tipo:** PR (review) · **Severidade declarada:** P2 (Badge)
- **Referência:** `apps/mesas/backend/src/scripts/cleanupOrphanDraftImages.ts:41-42`
- **Resumo:** `@artificio/media.deleteAsset` engole e só loga erros de destroy Cloudinary; o try/catch nunca vê falha de credencial/rede/API. Script incrementa `destroyed` e nula `cover_public_id`, perdendo o único handle p/ retry enquanto o asset pode ainda existir. Fazer deleção reportar sucesso/falha (ou verificar resultado do destroy) antes de limpar colunas.
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

### REV-020 — Normalizar JSON do Discord antes do mapa (refresh-urls)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review) · **Severidade declarada:** 🔵 Trivial (nitpick)
- **Referência:** `apps/mesas/backend/src/discord/uploadDiscordImage.ts:61-73`
- **Resumo:** Retorno de `response.json()` entra por cast; `entry.original/entry.refreshed` usados sem normalizador tipado. Shape parcial/inesperado entra no Map silenciosamente. Guideline: dado externo é `unknown` até normalizador tipado.
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

### REV-021 — Índice duplicado em admin_secrets(name)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review) · **Severidade declarada:** 🔵 Trivial (nitpick)
- **Referência:** `apps/accounts/src/db.ts:53-61`
- **Resumo:** `name text unique not null` já cria índice. `idx_admin_secrets_name` só adiciona custo de escrita/storage em cada upsert. Remover.
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

### REV-022 — Normalizar JSON de erro antes de statusMsg

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review) · **Severidade declarada:** 🟠 Major
- **Referência:** `apps/accounts/frontend/src/main.tsx:212-213`
- **Resumo:** Cast assume `res.json()` sempre `{ error?: string }`, mas payload é externo. Se `error` vier objeto/número, grava não-string em `statusMsg` e o `statusMsg.includes('sucesso')` seguinte quebra o render.
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

### REV-023 — Chave dedicada p/ cifrar admin_secrets (não fallback JWT_SECRET)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review) · **Severidade declarada:** 🔒 Security 🟠 Major
- **Referência:** `apps/accounts/src/adminSecretsRoutes.ts:32-37` (`getSecretsKey`)
- **Resumo:** Fallback `ACCOUNTS_SECRETS_KEY || JWT_SECRET` acopla rotação de auth à legibilidade dos segredos persistidos: trocar JWT_SECRET inutiliza `admin_secrets`, e reusa a mesma chave p/ dois propósitos. Falhar quando `ACCOUNTS_SECRETS_KEY` não definida e migrar legado explicitamente.
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

### REV-024 — Não cast de req.body antes de normalizar

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review) · **Severidade declarada:** 🟠 Major
- **Referência:** `apps/accounts/src/adminSecretsRoutes.ts:69-73`
- **Resumo:** `req.body` vem do cliente e pode ser `null`. `const { value } = req.body as {...}` lança antes da validação → input inválido vira 500. Normalizar p/ objeto/unknown e só então extrair `value`.
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

### REV-025 — Preservar DiscordSettingsDecryptError no caminho v2

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review) · **Severidade declarada:** 🎯 Functional 🟠 Major
- **Referência:** `apps/mesas/backend/src/discord/settingsCrypto.ts:41-49`
- **Resumo:** Se `decryptSecret()` falha em payload v2, branch devolve `SecretDecryptError` direto e pula `DiscordSettingsDecryptError`, apesar do contrato acima dizer que consumidores esperam a classe/nome do mesas. Quebra `instanceof` e mensagem legada no formato novo.
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

### REV-026 — Persistir cover_public_id antes do sync poder falhar

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review) · **Severidade declarada:** 🗄️ Data Integrity 🟠 Major
- **Referência:** `apps/mesas/backend/src/discord/syncHelpers.ts` (`cover_public_id: null` na transação final)
- **Resumo:** Upload pode criar asset novo bem antes do `cover_public_id: null`. Se qualquer write falhar entre `uploadCoverForDraft(...)` e a transação final, o draft nunca registra o public_id e o cron de órfãs não localiza o asset p/ limpeza.
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

### REV-027 — Não devolver erro da 1ª tentativa após refresh funcionar

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review) · **Severidade declarada:** 🎯 Functional 🟠 Major
- **Referência:** `apps/mesas/backend/src/discord/uploadDiscordImage.ts:151-158`
- **Resumo:** Se URL foi refreshada e a 2ª tentativa falha por network/cloudinary, o `return firstResult` reclassifica tudo como `expired_url`. Persiste motivo errado no draft e atrapalha retry/diagnóstico.
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

### REV-028 — Ampliar fallback do requestLogger p/ EPERM/EROFS

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review) · **Severidade declarada:** 🩺 Stability 🟠 Major
- **Referência:** `apps/mesas/backend/src/middleware/requestLogger.ts:77-85`
- **Resumo:** Só `EACCES` desarma a escrita em arquivo. Em bind mount read-only ou FS read-only, `appendFileSync` falha com `EPERM/EROFS` e o logger segue tentando gravar a cada request em vez de degradar p/ stdout.
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

### REV-029 — Reaproveitar a mesma lista de systems na re-normalização do LLM

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review) · **Severidade declarada:** 🎯 Functional 🟠 Major
- **Referência:** `apps/mesas/backend/src/routes/discord/utils.ts:499-514`
- **Resumo:** Quando `processDiscordMessageToDraft()` roda com `systems === undefined` (ex.: via `reparseOneMessage()`), `parseDiscordMessage()` carrega os systems reais, mas o 2º `normalizeDiscordTableDraft()` cai em `systems ?? []`. Nesse caminho o `system_hint` enriquecido nunca fecha `system_id`, mantém `system_name:unmatched_hint` e pode disparar sugestão falsa em `ensureSystemSuggestionForDraft()`.
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

### REV-030 — Limpar cover_url no payload do draft órfão

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review) · **Severidade declarada:** 🗄️ Data Integrity 🟠 Major
- **Referência:** `apps/mesas/backend/src/scripts/cleanupOrphanDraftImages.ts:49-61`
- **Resumo:** Só colunas auxiliares são zeradas; `normalized_payload.table.cover_url` segue apontando p/ asset removido, e `uploadCoverForDraft()` usa esse campo como short-circuit. Draft órfão pode ser sincronizado depois com URL quebrada e sem novo upload da origem.
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

### REV-031 — failed>0 vaza erro p/ drafts que limparam com sucesso

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review) · **Severidade declarada:** 🗄️ Data Integrity 🟡 Minor
- **Referência:** `apps/mesas/backend/src/scripts/cleanupOrphanDraftImages.ts:54-57`
- **Resumo:** Após a 1ª falha do lote, todos os updates seguintes gravam `orphan_cleanup_partial` mesmo quando o `deleteAsset()` daquele draft funcionou. Usar flag por iteração, não o contador global `failed`.
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

### REV-032 — Usar cache stale também em erros HTTP temporários (adminSecrets)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review) · **Severidade declarada:** 🩺 Stability 🟠 Major
- **Referência:** `apps/mesas/backend/src/services/adminSecrets.ts:52-58`
- **Resumo:** Só exceções de rede caem p/ `cached?.value`. Se accounts responder 500/503 por instabilidade, `getSecret()` volta `null` mesmo com segredo fresco em memória, e o llmAssist desliga o enrichment naquele parse sem necessidade.
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

### REV-033 — Permissão em ./logs ou volume nomeado (compose)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review) · **Severidade declarada:** 🩺 Stability 🟡 Minor
- **Referência:** `apps/mesas/docker-compose.prod.yml:111-112` (bind `./logs:/app/logs`)
- **Resumo:** Bind mount depende do diretório do host ser gravável; se falhar, `requestLogger` cai p/ stdout e logs do `mesas-cron` deixam de persistir em arquivo. Garantir permissão ou usar volume nomeado.
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

### REV-034 — Nomes acessíveis nos dois filtros (select)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review) · **Severidade declarada:** 🎯 Functional 🟠 Major (Nielsen/ISO 9241-11)
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/components/DiscordDraftReviewTable.tsx:127-136`
- **Resumo:** Dois `<select>` (origem e status) sem label/aria-label: leitor de tela não distingue, e o teste já precisou indexá-los por posição. Adicionar nome acessível em ambos.
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

### REV-035 — Mover setAuthTag(...) p/ dentro do try (secretCrypto)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR (review) · **Severidade declarada:** 🩺 Stability 🟡 Minor
- **Referência:** `packages/config/src/secretCrypto.ts:77-89`
- **Resumo:** Só `decipher.update/final` está protegido. `setAuthTag(...)` pode lançar `TypeError` antes do catch, escapando de `SecretDecryptError` e quebrando o 409 esperado em `apps/accounts/src/adminSecretsRoutes.ts`.
- **Status:** pendente · **Task vinculada:** — · **Débito vinculado:** —

## Veredito PR #100 — 2026-06-27

Investigado + aplicado o que não é prejudicial (incl. cosméticos). **17 procedem e aplicados**, **2 pendentes** (decisão do mantenedor). Validação repo-wide pós-fixes: **build 17/17, lint 15/15, test 24/24 (285 mesas-backend + 163 frontend + accounts) — verde.** Nada commitado.

| REV | Veredito | Fix |
|-----|----------|-----|
| REV-017 | procede | `requireAuth` antes de `requireAdmin` no PUT + no fallback do GET (`adminSecretsRoutes.ts`) |
| REV-018 | procede | `SERVICE_SECRET` (e `ACCOUNTS_URL` no cron) nos compose accounts/mesas beta+prod |
| REV-019 | procede | novo export aditivo `destroyAssetResult` (media) reporta sucesso; cleanup preserva `public_id` em falha |
| REV-020 | procede (cosmético) | `typeof === 'string'` nos pares do refresh-urls (`uploadDiscordImage.ts`) |
| REV-021 | procede (cosmético) | removido índice duplicado `idx_admin_secrets_name` (`db.ts`) |
| REV-022 | procede | normaliza `error` (só string) antes de `statusMsg` (`main.tsx`) |
| REV-023 | **pendente** | remover fallback `JWT_SECRET` exige `ACCOUNTS_SECRETS_KEY` no deploy ou quebra (500) — decisão de env do mantenedor |
| REV-024 | procede | normaliza `req.body` (null/não-objeto) antes de extrair `value` |
| REV-025 | procede | v2 só re-lança erros do mesas; genérico vira `DiscordSettingsDecryptError` |
| REV-026 | procede | persiste `cover_public_id` ANTES da etapa de sync (handle p/ cron de órfãs) |
| REV-027 | procede | retorna `secondResult` após refresh OK (motivo real, não `expired_url`) |
| REV-028 | procede | fallback do requestLogger amplia p/ `EPERM`/`EROFS` |
| REV-029 | procede | `parseDiscordMessage` expõe `systems` resolvidos; re-normalização do LLM os reusa |
| REV-030 | procede | cleanup zera `cover_url` no payload em sucesso (`stripCoverUrl`) |
| REV-031 | procede | erro por iteração (`ok`), não contador global `failed` |
| REV-032 | procede | cache stale em 5xx/HTTP temporário (`adminSecrets.ts`) |
| REV-033 | **pendente** | volume nomeado p/ `./logs` perderia logs no host; REV-028 já mitiga o crash — preferência operacional |
| REV-034 | procede | `aria-label` nos dois `<select>` de filtro (Nielsen/ISO) |
| REV-035 | procede | `setAuthTag` movido p/ dentro do try (`secretCrypto.ts`) |

## Reviews — PR #100 SonarCloud (2026-06-27)

Achados do SonarCloud no PR #100. **2 failures** (quality gate — cognitive complexity) + 7 warnings. Registrados; veredito + fix abaixo.

### REV-036 — main() cleanupOrphanDraftImages cognitive complexity 16→15

- **Origem:** sonarqubecloud (bot) · **Tipo:** PR (check) · **Severidade:** failure (gate)
- **Referência:** `apps/mesas/backend/src/scripts/cleanupOrphanDraftImages.ts:14`
- **Resumo:** Refactor REV-019/030/031 elevou a CC de `main()` p/ 16. Extrair o corpo do loop p/ helper.
- **Status:** pendente

### REV-037 — Merge RUN consecutivos (Dockerfile)

- **Origem:** sonarqubecloud (bot) · **Tipo:** PR (check) · **Severidade:** warning
- **Referência:** `apps/mesas/backend/Dockerfile:60`
- **Resumo:** Dois `RUN` consecutivos — fundir em um p/ reduzir layers.
- **Status:** pendente

### REV-038 — Union type → type alias (DiscordDraftReviewTable)

- **Origem:** sonarqubecloud (bot) · **Tipo:** PR (check) · **Severidade:** warning
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/components/DiscordDraftReviewTable.tsx:10`
- **Resumo:** União repetida (`'discord' | 'inbox' | 'all'`) — extrair `type OriginFilter`.
- **Status:** pendente

### REV-039 — processDiscordMessageToDraft cognitive complexity 83→15

- **Origem:** sonarqubecloud (bot) · **Tipo:** PR (check) · **Severidade:** failure (gate)
- **Referência:** `apps/mesas/backend/src/routes/discord/utils.ts:414`
- **Resumo:** Função grande (parse + reconcile + LLM enrichment + upsert + sugestão). Extrair o bloco de enriquecimento LLM p/ helper reduz drasticamente a CC. Maior parte pré-existente, mas é new-code no gate.
- **Status:** pendente

### REV-040 — reduce() sem valor inicial (parseDiscordAnnouncement)

- **Origem:** sonarqubecloud (bot) · **Tipo:** PR (check) · **Severidade:** warning
- **Referência:** `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts:97`
- **Resumo:** `reduce()` sem initial value lança em array vazio. Adicionar valor inicial.
- **Status:** pendente

### REV-041 — Regex super-linear (llmAssist)

- **Origem:** sonarqubecloud (bot) · **Tipo:** PR (check) · **Severidade:** warning (ReDoS)
- **Referência:** `apps/mesas/backend/src/discord/llmAssist.ts:125`
- **Resumo:** Regex com backtracking super-linear. Simplificar p/ evitar ReDoS.
- **Status:** pendente

### REV-042 — Optional chain (utils.ts:577)

- **Origem:** sonarqubecloud (bot) · **Tipo:** PR (check) · **Severidade:** warning
- **Referência:** `apps/mesas/backend/src/routes/discord/utils.ts:577`
- **Resumo:** Preferir optional chain.
- **Status:** pendente

### REV-043 — Optional chain (adminSecretsRoutes:25)

- **Origem:** sonarqubecloud (bot) · **Tipo:** PR (check) · **Severidade:** warning
- **Referência:** `apps/accounts/src/adminSecretsRoutes.ts:25`
- **Resumo:** `session?.user || session.user.role` → optional chain `session?.user?.role`.
- **Status:** pendente

### REV-044 — Label sem control associado (main.tsx:226)

- **Origem:** sonarqubecloud (bot) · **Tipo:** PR (check) · **Severidade:** warning (a11y)
- **Referência:** `apps/accounts/frontend/src/main.tsx:226`
- **Resumo:** `<label>` sem `htmlFor`/control associado. Associar via `htmlFor`+`id`.
- **Status:** pendente

## Veredito PR #100 SonarCloud — 2026-06-27

**9/9 procedem e aplicados** (nenhum prejudicial). Validação repo-wide pós-fix: **build 17/17, lint 15/15, test 24/24 (285 backend + 163 frontend) — verde.** Nada commitado.

| REV | Veredito | Fix |
|-----|----------|-----|
| REV-036 | procede (gate) | corpo do loop extraído p/ `cleanupOneOrphan()` (CC 16→abaixo) |
| REV-037 | procede | dois `RUN` fundidos em um (`Dockerfile`) |
| REV-038 | procede (cosmético) | `type OriginFilter` extraído |
| REV-039 | procede (gate) | enriquecimento LLM extraído p/ `enrichDraftWithLlm()` + `buildLlmUpdates()` (CC 83→abaixo) |
| REV-040 | procede | `reduce()` com valor inicial `candidates[0]` |
| REV-041 | procede | regex sem `\s*` ambíguo (prefixo `[ \t]*\r?\n?`) — anti-ReDoS |
| REV-042 | procede (cosmético) | `draftResult?.status` |
| REV-043 | procede (cosmético) | `session?.user?.role !== 'admin'` |
| REV-044 | procede | `htmlFor="deepseek-api-key"` + `id` no input |

## Reviews — PR #100 rodada 2 (2026-06-27) — CodeRabbit pós-fix

Achados na revisão do commit `96ad93e`. **Todos procedem e aplicados.**

### REV-045 — refresh-urls lê campo errado (`refreshed` vs `refreshed_urls`)

- **Origem:** coderabbitai (bot) · **Tipo:** PR (review) · **Severidade:** 🗄️ Data Integrity 🟠 Major
- **Referência:** `apps/mesas/backend/src/discord/uploadDiscordImage.ts:61-63`
- **Resumo:** Discord responde `{ refreshed_urls: [...] }`, mas o código lia `body.refreshed` → sempre `undefined` → retry caía em null e nunca tentava a URL renovada. **Bug real** (o REV-020 mexeu só nos entries internos, não no campo de topo).
- **Status:** implementado ✅ — campo corrigido p/ `refreshed_urls`.

### REV-046 — SERVICE_SECRET obrigatório no compose accounts prod

- **Origem:** coderabbitai (bot) · **Tipo:** PR (review) · **Severidade:** 🩺 Stability 🟠 Major
- **Referência:** `apps/accounts/docker-compose.prod.yml:59-60`
- **Resumo:** `${SERVICE_SECRET}` puro permite subir sem o token; GET /admin/secrets deixa de aceitar auth serviço-a-serviço e a integração mesas quebra silenciosa. Usar interpolação obrigatória (`:?`).
- **Status:** implementado ✅ — `${SERVICE_SECRET:?...}`.

### REV-047 — SERVICE_SECRET obrigatório no compose mesas beta

- **Origem:** coderabbitai (bot) · **Tipo:** PR (review) · **Severidade:** 🩺 Stability 🟠 Major
- **Referência:** `apps/mesas/docker-compose.beta.yml:69-70`
- **Resumo:** Mesmo problema do lado consumidor: sem a env, `getSecret()` vira null p/ tudo e o enrichment some silencioso.
- **Status:** implementado ✅ — `${SERVICE_SECRET:?...}`.

### REV-048 — SERVICE_SECRET obrigatório no compose mesas prod

- **Origem:** coderabbitai (bot) · **Tipo:** PR (review) · **Severidade:** 🩺 Stability 🟠 Major
- **Referência:** `apps/mesas/docker-compose.prod.yml` (api + cron)
- **Resumo:** Idem — falhar no deploy em vez de quebrar parse/enrichment em runtime.
- **Status:** implementado ✅ — `${SERVICE_SECRET:?...}` na api e no cron.

---

## ⚠️ AÇÃO DO MANTENEDOR — segredos novos de deploy (REV-023 + REV-018) — ✅ REALIZADO (2026-06-27)

**REV-023 aplicado:** `getSecretsKey` não usa mais fallback `JWT_SECRET`; agora exige `ACCOUNTS_SECRETS_KEY`. E os compose passaram a **exigir** `SERVICE_SECRET` (REV-046/47/48). Por isso, **o deploy agora FALHA se estas envs não existirem**. Os segredos foram gerados e inseridos via SSH direto na VM (não via GitHub Secrets).

### 1. `SERVICE_SECRET` (token serviço-a-serviço mesas ↔ accounts)

- **O que é:** token compartilhado que o mesas envia no header `X-Service-Token` p/ o accounts liberar `GET /admin/secrets/:name` (busca da chave DeepSeek).
- **Onde:** o **MESMO valor** em **4 serviços**: `accounts-api` (prod), `mesas-api` (prod), `mesas-cron` (prod) e `mesas-beta-api` (beta).
- **Valor gerado:** `randomBytes(32).toString('base64url')` — armazenado localmente pelo mantenedor.

### 2. `ACCOUNTS_SECRETS_KEY` (chave de cifra do admin_secrets)

- **O que é:** chave AES p/ cifrar/decifrar a tabela `admin_secrets` no accounts (onde mora a chave DeepSeek cifrada).
- **Onde:** só no `accounts-api` (prod).
- **Valor gerado:** `randomBytes(48).toString('base64url')` — armazenado localmente pelo mantenedor.
- **⚠️ ESTÁVEL PARA SEMPRE:** se você trocar essa chave depois, **todos os segredos já cifrados ficam ilegíveis** (teria que regravá-los). Gere uma vez e não rotacione sem migração.

### Onde foram inseridos (via SSH, `echo >>` nos `.env` da VM)

| Arquivo | SERVICE_SECRET | ACCOUNTS_SECRETS_KEY |
|---------|:---:|:---:|
| `/opt/artificio/apps/accounts/.env` | ✅ | ✅ |
| `/opt/artificio/apps/mesas/.env` | ✅ | ➖ |
| `/opt/artificio-beta/apps/accounts/.env.beta` | ✅ | ✅ |
| `/opt/artificio-beta/apps/mesas/.env.beta` | ✅ | ➖ |

Os arquivos `.env` já existiam na VM (gitignored) e foram editados com append via `ssh faren`. O `SERVICE_SECRET` é **idêntico** nos 4 arquivos, como exigido pelo contrato de serviço-a-serviço.

**Não foi usado GitHub Secrets** — a esteira de deploy lê os `.env` diretamente da VM via `--env-file`, então a inserção local é suficiente.

### Checklist — ✅ resolvido

- [x] `SERVICE_SECRET` definido e **idêntico** em accounts + mesas (prod) + mesas (beta).
- [x] `ACCOUNTS_SECRETS_KEY` (≥32 chars) definido no accounts e **guardado em local seguro** (rotação quebra segredos).
- [ ] Após deploy do accounts: gravar a chave DeepSeek pelo painel `/conta` (admin logado).
- [ ] Smoke: parse de uma mensagem dispara enrichment (mesas consegue `getSecret('deepseek_api_key')` no accounts).

**Deploy agora não falha mais por falta dessas envs. Os dois itens pendentes (gravar chave DeepSeek + smoke) dependem do redeploy dos serviços com os compose atualizados.**

## Veredito rodada 2 + REV-023 — 2026-06-27

| REV | Veredito | Fix |
|-----|----------|-----|
| REV-023 | **procede e aplicado** | removido fallback `JWT_SECRET`; exige `ACCOUNTS_SECRETS_KEY` (+ env obrigatória no compose) |
| REV-045 | procede | campo `refreshed_urls` (bug de retry de imagem) |
| REV-046 | procede | `SERVICE_SECRET` obrigatório (accounts prod) |
| REV-047 | procede | `SERVICE_SECRET` obrigatório (mesas beta) |
| REV-048 | procede | `SERVICE_SECRET` obrigatório (mesas prod api+cron) |

**Ainda pendente (decisão tua):** REV-033 (volume nomeado p/ logs — REV-028 já mitiga o crash).

