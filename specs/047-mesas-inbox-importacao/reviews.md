# Reviews — 047 Inbox de Importação de Mesas

> Registro de revisões (code review, auditoria, QA). Append-only.

## 2026-06-22 — Auditoria de encaixe (Fase 0)

**Revisor:** OpenCode (DeepSeek-v4-pro)
**Escopo:** Investigação read-only do código existente para diagnóstico de encaixe

### Arquivos lidos (com evidência)

| # | Arquivo | Linhas | Conteúdo relevante |
|---|---|---|---|
| 1 | `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts` | 1-500 | Parser completo; `DiscordRawMessage` → `DiscordTableDraft` |
| 2 | `apps/mesas/backend/src/discord/normalizeDiscordTableDraft.ts` | 1-77 | Normalizador; resolve sistema, recalcula missing_fields |
| 3 | `apps/mesas/backend/src/discord/syncDiscordDraftToTable.ts` | 1-441 | Sync draft → tabela; exige `discord_message_id` |
| 4 | `apps/mesas/backend/src/routes/adminDiscordSync.ts` | 1-1147 | Rotas admin REST (1147 linhas) |
| 5 | `apps/mesas/backend/src/discord/types.ts` | 1-108 | `DiscordRawMessage`, `DiscordTableDraft`, `DiscordImportSourceKind` |
| 6 | `apps/mesas/backend/src/db/types.ts` | 609-671 | Tipos Kysely para tabelas Discord |
| 7 | `apps/mesas/database/migration_115_discord_import.sql` | completo | DDL das 3 tabelas core |
| 8 | `apps/mesas/database/migration_116_discord_settings.sql` | completo | DDL `discord_settings` |
| 9 | `apps/mesas/database/migration_117_discord_forum_threads.sql` | completo | ALTER TABLE (forum/thread) |
| 10 | `apps/mesas/database/migration_118_discord_drafts_invariant.sql` | completo | CHECK constraint |
| 11 | `apps/mesas/database/migration_122_discord_image_upload_status.sql` | completo | ALTER TABLE (image upload) |
| 12 | `apps/mesas/backend/src/discord/ingestMessages.ts` | 1-50 | Ingestão via Discord REST API |
| 13 | `apps/mesas/backend/src/discord/config.ts` | 1-69 | Config do bot Discord |
| 14 | `apps/mesas/backend/src/validators/tableValidators.ts` | 1-233 | Schemas Zod para tabelas |
| 15 | Frontend: `GestaoPage.tsx` | completo | Hub admin com 6 abas |
| 16 | Frontend: `features/discord-sync/` | 7 arquivos | UI completa do Discord Sync |
| 17 | Frontend: `App.tsx` | completo | Rotas do frontend |

### Verdictos

| Item auditado | Veredicto | Evidência |
|---|---|---|
| Parser reutilizável sem alterações? | **Sim** | `parseDiscordAnnouncement.ts:396` — só depende de `content_raw` (texto) |
| Normalizer reutilizável sem alterações? | **Sim** | `normalizeDiscordTableDraft.ts:51` — agnóstico à origem |
| Sync reutilizável sem alterações? | **Não** (corrigido pós-auditoria) | `syncDiscordDraftToTable.ts:304` — acoplado a `discord_import_messages`; inbox usará `syncImportDraftToTable` |
| Adaptador mínimo viável? | **Sim** | ~15 linhas: cria `DiscordRawMessage` com campos sintéticos |
| Rota existente suporta texto bruto? | **Não** | Endpoints atuais partem de mensagem já persistida |
| Migrations necessárias? | **Sim, 3-5 ALTER TABLE** | Colunas NOT NULL + FK + índice UNIQUE |
| UI de revisão reutilizável? | **Sim** | `DiscordDraftPreview.tsx` cobre edição completa |

### Riscos identificados

1. `discord_import_messages.source_id` é `NOT NULL` com FK — texto colado não tem source
2. Índice UNIQUE `(discord_message_id, discord_channel_id)` — texto colado não tem channel_id
3. `syncDiscordDraftToTable` usa `message.discord_message_id` como `source_id` na tabela `tables`
4. Frontend `DiscordDraftPreview` pode esperar campos Discord que estarão ausentes/vazios

### Decisão recomendada

**Opção B: Rota separada `adminImportInbox.ts`** + **Opção C (schema): Tabela paralela `import_messages`**

Justificativas em `plan.md` §2.

## 2026-06-22 — Implementação Fase 1 backend (TASK A–D)

**Executor:** OpenCode (DeepSeek-v4-pro)
**Escopo:** Backend mínimo do Inbox — guards, migration, tipos, adaptador, segmentador, rota

### TASK A — Guards anti-vazamento (`adminDiscordSync.ts`)

5 guards aplicados:
1. `GET /drafts` — `.where('discord_message_id', 'is not', null)`
2. `GET /image-uploads/summary` — `.where('discord_message_id', 'is not', null)`
3. `POST /drafts/:id/reparse` — guard `if (!draft.discord_message_id) return 422`
4. `POST /drafts/:id/sync` — busca draft antes do sync, guard `if (!draft.discord_message_id) return 422`
5. `POST /sync-ready` — `.where('discord_message_id', 'is not', null)`

### TASK B — Migration + tipos

- `migration_128_import_messages.sql`: CREATE TABLE `import_messages` (11 colunas) + ALTER `discord_import_table_drafts` + 4 índices + DO $$ validação
- `db/types.ts`: `ImportMessagesTable` + type aliases + `Database` + `discord_message_id: string | null` + `import_message_id: string | null`
- `discord/types.ts`: `'manual_paste'` em `DiscordImportSourceKind`
- **CORREÇÃO (2026-06-22):** `db/types.ts:579` foi revertido — `'manual_paste'` removido do DB type. `ingestMessages.ts:88,260` usa type assertion (`sourceKind as 'discord_bot' | 'discord_chat_exporter_json'`) para estreitar no ponto de insert. O DB type permanece semanticamente correto: `discord_import_messages.source_kind` nunca receberá `'manual_paste'`.

### TASK C — Adaptador e segmentador

- `inbox/adapters/textToRawMessage.ts`: `textToRawMessage(rawText, threadName?)` → `DiscordRawMessage` (~15 linhas)
- `inbox/segmentation.ts`: `segmentAnnouncements(rawText)` → `string[]` com 3 estratégias (~30 linhas)

### TASK D — Rota do Inbox

- `routes/adminImportInbox.ts`: `POST /import-text` + `GET /drafts`; `loadSystemsForParser` duplicada (~25 linhas)
- `server.ts`: +2 linhas (import + `app.use`)

### Validação

- `tsc --noEmit`: zero erros
- `pnpm run lint`: zero erros nos arquivos mesas

### Pendente

- `POST /drafts/:id/sync` (syncImportDraftToTable)
- Teste manual com anúncio real (T1.13)
- Frontend (T1.8–T1.12)

## 2026-06-22 — Correção de tipo: revert `'manual_paste'` do `db/types.ts`

**Executor:** OpenCode (DeepSeek-v4-pro)
**Escopo:** Reverter alteração semanticamente incorreta e corrigir ponto de insert

### O quê

- `db/types.ts:579`: `'manual_paste'` removido do union type `DiscordImportSourceKind` (volta a ser `'discord_bot' | 'discord_chat_exporter_json'`)
- `ingestMessages.ts:88`: `InsertRow.source_kind` estreitado para `'discord_bot' | 'discord_chat_exporter_json'`
- `ingestMessages.ts:260`: type assertion `sourceKind as 'discord_bot' | 'discord_chat_exporter_json'`

### Por quê

`discord_import_messages.source_kind` mapeia para a coluna real do banco. Com a Opção C, `manual_paste` vai para `import_messages.source_type`. Zero inserções de `'manual_paste'` em `discord_import_messages`. Expandir o DB type seria semanticamente incorreto.

### Validação

- `npx tsc --noEmit`: zero erros
- `pnpm run lint`: zero erros nos arquivos mesas

## 2026-06-22 — FASE A: Migration 128 aplicada no banco beta

**Executor:** OpenCode (DeepSeek-v4-pro)
**Escopo:** Backup + aplicação da migration 128 + registro em `schema_migrations` + validações

### Pré-migration

- Alvo: `mesas-beta-db` / `mesas_rpg` / `admin`
- Contagem: 184 drafts, todos com `discord_message_id` (184 = 184)

### Backup

- `/tmp/spec047-backup/backup_128_drafts_schema.sql` (3.6 KB)
- `/tmp/spec047-backup/backup_128_drafts_data.sql` (1.2 MB)
- `/tmp/spec047-backup/backup_128_migrations.sql` (5.4 KB)
- Baixados localmente em `spec047-backup/`

### Aplicação

- `psql -f migration_128_import_messages.sql`: BEGIN → CREATE TABLE → 3× CREATE INDEX → 2× ALTER TABLE → CREATE INDEX → DO $$ → COMMIT
- NOTICE: `migration_128: import_messages criada, discord_import_table_drafts adaptada para FK polimorfica`
- Registro idempotente em `schema_migrations`: `INSERT 0 1` (2026-06-22 13:34:54 UTC)

### Pós-migration (6 validações)

| Validação | Resultado |
|---|---|
| `import_messages` existe | ✅ |
| 3 índices (`status`, `source_type`, `content_hash`) | ✅ |
| Índice `idx_discord_import_table_drafts_import_message_id` | ✅ |
| `discord_message_id` nullable | ✅ `YES` |
| `import_message_id` existe | ✅ `YES` |
| 184 drafts, `discord_message_id` = 184, `import_message_id` = 0 | ✅ |
| Registro em `schema_migrations` | ✅ |
