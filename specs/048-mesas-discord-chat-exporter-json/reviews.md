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

