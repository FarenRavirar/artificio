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
|---|---|---|
| `import_messages` existe | ✅ |
| 3 índices (`status`, `source_type`, `content_hash`) | ✅ |
| Índice `idx_discord_import_table_drafts_import_message_id` | ✅ |
| `discord_message_id` nullable | ✅ `YES` |
| `import_message_id` existe | ✅ `YES` |
| 184 drafts, `discord_message_id` = 184, `import_message_id` = 0 | ✅ |
| Registro em `schema_migrations` | ✅ |

## 2026-06-22 — PR #87 reviews (bots)

**PR:** https://github.com/FarenRavirar/artificio/pull/87
**Commit:** `3e7f9da76d`

### REV-001 — RAISE NOTICE fora de bloco PL/pgSQL em migration_129

- **Origem:** chatgpt-codex-connector (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/database/migration_129_import_corrections.sql:44` — `RAISE NOTICE` standalone após `COMMIT`
- **Resumo:** `RAISE NOTICE` é inválido como SQL standalone — só funciona dentro de bloco `DO $$ ... $$`. O deploy runner (`apply_required_migrations.sh`) usa `psql -v ON_ERROR_STOP=1`, então a migration falhará após criar a tabela e não será registrada em `schema_migrations`, travando deploys subsequentes.
- **Severidade declarada:** P1 (Codex)
- **Status:** ✅ **investigado — procede** ✅ **implementado (2026-06-22)**
- **Débito vinculado:** DEB-047-08

#### 🔍 INVESTIGAÇÃO REV-001

- **Classificação:** procede e deve ser implementado
- **Severidade real:** 🔴 Critical — bloqueia deploy
- **Impacto real:** `psql -v ON_ERROR_STOP=1` (confirmado em `apply_required_migrations.sh:131`) aborta ao encontrar `RAISE NOTICE` standalone como erro de sintaxe. O runner envolve a migration em `BEGIN; ... INSERT INTO schema_migrations ... COMMIT;` (linhas 132-135) — a falha em linha 44 rola o outer transaction, impedindo registro em `schema_migrations`. Cada deploy subsequente re-tenta e re-falha migration_129 — **deploy do app mesas congelado até correção.**
- **Evidências de código:**
  1. `migration_129_import_corrections.sql:44` — `RAISE NOTICE 'migration_129: import_corrections ok';` **fora** do `DO $$ ... END $$` (encerrado na linha 40)
  2. `apply_required_migrations.sh:131` — `psql -v ON_ERROR_STOP=1` confirma que erro aborta imediatamente
  3. `apply_required_migrations.sh:132-135` — runner envolve migration em outer transaction com `INSERT INTO schema_migrations`; falha → rollback → sem registro
  4. `migration_128_import_messages.sql:82` — padrão correto: `RAISE NOTICE` **dentro** do bloco `DO $$ ... END $$` (linhas 48-83)
  5. **30 ocorrências de `RAISE NOTICE`** no projeto (`apps/mesas/database/`), **30/30 dentro** de bloco `DO $$ ... END $$` — migration_129 é a **única** com `RAISE NOTICE` standalone
- **Risco de regressão:** Nenhum (já está quebrado no deploy)
- **Já existe tratamento?** Não — migration 129 nunca foi aplicada em banco real
- **Falso positivo?** Não
- **Recomendação:** Mover `RAISE NOTICE` para dentro do bloco `DO $$` antes do `COMMIT`, seguindo o padrão de migration_128:82. Ou, alternativamente, remover e usar `\echo` no runner (mas isso exigiria mudança de runner).
- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-22

### REV-002 — Validar start_time como horário antes de persistir

- **Origem:** chatgpt-codex-connector (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/backend/src/discord/syncHelpers.ts:47,91-93` — `validateDraftForSync` + `extractSchedules`
- **Resumo:** `validateDraftForSync` aceita qualquer string em `start_time` (só valida `hasText`). Depois, `extractSchedules` formata `start_time.includes(':') ? start_time : '${start_time}:00'`. Entradas como `20h` ou `noite` passam na validação mas podem quebrar a transação no banco. Sugere regex `HH:MM` e formatador condicional.
- **Severidade declarada:** 🟠 Major
- **Status:** ✅ **investigado — procede** ✅ **implementado (2026-06-22)**
- **Task vinculada:** T1.6 (sync)
- **Débito vinculado:** sem vínculo claro

#### 🔍 INVESTIGAÇÃO REV-002

- **Classificação:** procede e deve ser implementado
- **Severidade real:** 🟡 Medium — impacto controlado
- **Impacto real:** Edições manuais no frontend (`DiscordDraftPreview.tsx:631`) com `start_time` inválido (ex: "20h", "noite") passam na validação do backend (`hasText("20h")` → true) e chegam a `extractSchedules`, que produz `"20h:00"`. O PostgreSQL (`start_time TIME NOT NULL`, migration_12:17) rejeita → rollback da transação. Sem corrupção de dados, apenas sync falha com erro limpo.
- **Análise de blast radius:**
  - **Parser Discord** (`parseDiscordAnnouncement.ts:270-278`): `extractStartTime` usa regex `\b(\d{1,2})[hH:](\d{0,2})\b` e sempre normaliza para `HH:MM` — **seguro**. Ex: "20h" → "20:00", "20:30" → "20:30", "noite" → null (validação bloqueia).
  - **Inbox** (`adminImportInbox.ts`): Reusa o mesmo parser → **seguro**.
  - **Frontend admin edit** (`DiscordDraftPreview.tsx:631`): `<input type="text">` free-form sem validação de formato `.trim()`. O `validateForm` do frontend (linha 128: `!form.start_time.trim()`) só checa não-vazio. Payload editado é salvo no draft e depois vai para `extractSchedules` via sync → **vulnerável**.
  - **REST API schedules** (`tableSchedules.ts:43`): `req.body` como `Partial<NewTableSchedule>` sem Zod — também não valida formato (pré-existente, fora do escopo 047).
- **Evidências de código:**
  1. `syncHelpers.ts:47` — `if (!hasText(t.start_time))` — só checa string não-vazia
  2. `syncHelpers.ts:86` — `if (!isDayOfWeek(day_of_week) || !start_time) return []` — early return se falsy, mas "20h" é truthy
  3. `syncHelpers.ts:91` — `start_time: start_time.includes(':') ? start_time : '${start_time}:00'` — formatação naive: "20h" → "20h:00" (inválido), "noite" → "noite:00" (inválido)
  4. `parseDiscordAnnouncement.ts:270-278` — parser sempre produz `HH:MM` válido ou null
  5. `DiscordDraftPreview.tsx:95` — `start_time: asString(table.start_time)` — converte para string do form, sem validação
  6. `DiscordDraftPreview.tsx:631` — `<input ... placeholder="19:00" />` — input free-text, não `type="time"`
  7. `migration_12_table_schedules.sql:17` — `start_time TIME NOT NULL` — rejeita string inválida
- **Risco de regressão:** Baixo — parsers automáticos (Discord/Inbox) já produzem formato válido
- **Já existe tratamento?** Parcialmente — `parseDiscordAnnouncement` embute validação de formato no extrator; `tableValidators.ts:36` tem regex Zod (`/^\d{2}:\d{2}(:\d{2})?$/`) mas NÃO é usado no fluxo sync (só nas rotas de criação/edição de mesa)
- **Falso positivo?** Não — bug real, embora severidade seja menor que a declarada
- **Recomendação:** Adicionar validação de regex `HH:MM` em `validateDraftForSync` (backend) E/OU usar `type="time"` no input do `DiscordDraftPreview` (frontend). Ambas proteções são complementares.
- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-22

## 2026-06-22 — Implementação REV-002 (Validação de start_time HH:MM)

**Executor:** OpenCode (DeepSeek-v4-pro)
**Escopo:** Adicionar validação de formato `HH:MM` no backend para `start_time`

### O quê

- `syncHelpers.ts`: +2 funções + 2 alterações em funções existentes:
  1. `isValidTime(v: unknown)` (linha 38) — type guard com regex `/^\d{2}:\d{2}(:\d{2})?$/` (compatível com `tableValidators.ts:36`)
  2. `normalizeTime(raw: string)` (linha 42) — extrai dígitos de padrões como "19h", "20h30", "19:30" → `HH:MM` (mesma lógica de `extractStartTime` no parser)
  3. `validateDraftForSync` (linha 63): `hasText` → `isValidTime` para `start_time`
  4. `extractSchedules` (linhas 104-105): formatação naïve `includes(':') ? x : x + ':00'` substituída por `normalizeTime` com fallback para skip

### Comportamento

| Entrada | Antes (`hasText`) | Antes (`extractSchedules`) | Depois (`isValidTime`) | Depois (`normalizeTime`) |
|---|---|---|---|---|
| `"19:00"` | válido | `"19:00"` | válido | `"19:00"` |
| `"20:30"` | válido | `"20:30"` | válido | `"20:30"` |
| `"19"` | válido | `"19:00"` | **inválido** ❌ | `"19:00"` (se chegasse) |
| `"20h"` | válido ⚠️ | `"20h:00"` 💥 | **inválido** ✅ | `"20:00"` (se chegasse) |
| `"20h30"` | válido ⚠️ | `"20h30:00"` 💥 | **inválido** ✅ | `"20:30"` (se chegasse) |
| `"noite"` | válido ⚠️ | `"noite:00"` 💥 | **inválido** ✅ | `null` → skip |
| `""` | inválido | — | inválido | — |

### Validação

- `tsc --noEmit`: zero erros
- `pnpm --filter @artificio/mesas-backend test`: 19 files / 134 tests ✅
- `pnpm run lint` (repo-wide): 15/15 ✅
- `parseDiscordAnnouncement.test.ts` (33 testes): todas as extrações de horário do parser continuam funcionando — o parser já produzia `HH:MM` válido
- Cobertura de regressão: via `adminDiscordSync.drafts.patch.test.ts` (transition guard) e `adminImportInbox.test.ts` (15 testes sync/correction/metrics)

### Impacto

- **Parser Discord** (`extractStartTime`, linha 270): já produz `HH:MM` válido — zero impacto
- **Inbox** (via `parseDiscordAnnouncement`): mesmo parser — zero impacto
- **Frontend admin edit** (`DiscordDraftPreview.tsx:631`): input free-text ainda vulnerável — se admin digitar "19h:00" ou "noite", sync será bloqueado com erro `start_time` faltando em vez de explodir com erro PostgreSQL
- **Backend PATCH admin** (`adminDiscordSync.ts:1028`): edições de payload via API agora são validadas — sync aborta com erro controlado em vez de crash

### Status

- **REV-002:** ✅ **resolvido (backend)** — validação `HH:MM` implementada
- **Futuro:** `type="time"` no frontend (input HTML nativo com picker) para defesa em profundidade no cliente — débito separado (não bloqueia spec 047)

---

### REV-003 — Reconhecimento de link Discord incompleto (discord.gg)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/backend/src/discord/syncHelpers.ts:67-69` — `extractContacts`
- **Resumo:** A função `extractContacts` só classifica como canal `discord` links com hostname `discord.com` ou subdomínio `.discord.com`. Links de convite `discord.gg` (comuns) são classificados como `form`, degradando a categorização de contato.
- **Severidade declarada:** 🟡 Minor
- **Status:** ✅ **investigado — procede** ✅ **implementado (2026-06-22)**
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:** sem vínculo claro

#### 🔍 INVESTIGAÇÃO REV-003

- **Classificação:** procede e deve ser implementado
- **Severidade real:** 🟡 Minor — classificação cosmética, link funciona
- **Impacto real:** URLs com hostname `discord.gg` (oficial Discord URL shortener para convites) caem no fallback `'form'` em vez de `'discord'`. Na UI o contato aparece como "Ticket / Inscrição" (label genérico) em vez de "Discord". O link em si permanece funcional — o clique no link ainda abre o convite no Discord. Degradação de UX, não perda de funcionalidade.
- **Evidências de código:**
  1. `syncHelpers.ts:67` — `parsed.hostname === 'discord.com' || parsed.hostname.endsWith('.discord.com')` — só cobre `.discord.com`
  2. `syncHelpers.ts:69` — else → `'form'` com label `'Ticket / Inscrição'` (linha 74) — semanticamente errado para convite Discord
  3. Frontend `ContactsFormBlock.tsx:119` — placeholder `"https://discord.gg/..."` — confirma que `discord.gg` é domínio usado no projeto
  4. Frontend `TableContacts.tsx:57` — `return 'https://discord.gg/${inviteCode}'` — o próprio código gera links `discord.gg`
- **Domínios Discord oficiais para invites:**
  - `discord.com` — canônico (ex: `discord.com/invite/CODE`)
  - `discord.gg` — URL shortener oficial (ex: `discord.gg/CODE`)
  - `discordapp.com` — legado (redireciona para `discord.com`)
- **Testes:** `extractContacts` não tem cobertura de testes (zero arquivos de teste para `syncHelpers.ts`)
- **Risco de regressão:** Nenhum — adição simples ao condicional existente, sem refatoração
- **Já existe tratamento?** Não
- **Falso positivo?** Não — `discord.gg` é domínio oficial Discord, deve ser reconhecido
- **Recomendação:** Adicionar `discord.gg` à verificação: `parsed.hostname === 'discord.gg' || parsed.hostname.endsWith('.discord.gg')` OU usar um Set de domínios oficiais para facilitar extensão futura. Avaliar também `discordapp.com` (legado).
- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-22
- **Implementação:** `syncHelpers.ts:82-87` — condicional extraído para variável `isDiscordHost` com 4 cláusulas: `discord.com`, `.discord.com`, `discord.gg`, `.discord.gg`. Lint ✅, `tsc --noEmit` ✅.

### REV-004 — Payload do banco tratado como tipo confiável sem validação

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/backend/src/inbox/syncImportDraftToTable.ts:56-57`
- **Resumo:** `draft.normalized_payload ?? draft.parsed_payload` é afirmado diretamente como `ImportTableDraft` sem normalizador tipado. Contraria diretriz de código (dados de banco devem ser `unknown` até validar). Payload corrompido falharia em pontos imprevisíveis.
- **Severidade declarada:** 🟡 Minor
- **Status:** ✅ **investigado — procede, mas é débito separado**
- **Task vinculada:** T1.6 (sync)
- **Débito vinculado:** DEB-047-13 (novo — validação estrutural de JSONB)

#### 🔍 INVESTIGAÇÃO REV-004

- **Classificação:** procede, mas é débito separado (projeto-wide)
- **Severidade real:** 🟡 Minor — defesa em profundidade existente mitiga risco de corrupção severa
- **Impacto real:** `normalized_payload` e `parsed_payload` são colunas JSONB (`discord_import_table_drafts`). Kysely retorna `unknown`/`any`. O cast `as ImportTableDraft` (linha 56) é puramente TypeScript — zero validação em runtime da estrutura do objeto. Payload malformado (ex: admin edita via frontend e corrompe estrutura) pode produzir falhas em cascata em `validateDraftForSync`, `extractContacts`, `extractSchedules`, e `buildTableData`.
- **Defesa em profundidade existente (mitigação parcial):**
  1. Linha 57: `if (!payload?.table) throw new Error(...)` — barreira contra null/undefined
  2. `validateDraftForSync` (syncHelpers.ts:34-49): todos os type guards (`hasText`, `hasPositiveNumber`, `isDayOfWeek`) verificam `typeof` em runtime — valores de tipo errado são marcados como `missing`, sync aborta com erro controlado
  3. `extractContacts` (syncHelpers.ts:52-79): `try/catch` ao redor de `new URL(rawUrl)` — URL inválida cai para fallback `'form'`
  4. `extractSchedules` (syncHelpers.ts:81-98): `isDayOfWeek` + truthiness check → early return `[]`
  5. PostgreSQL: constraints `TIME`, `INTEGER`, `TEXT` nos inserts rejeitam tipos errados
  6. Transaction wrapper (linhas 87-132 e 146-167): falha em qualquer INSERT → rollback completo
- **Cenários que escapam da defesa:**
  - `payload.table` é um objeto com campos de tipos certos mas valores semanticamente errados (ex: `system_id: "not-a-uuid"`, `title: 123` → PostgreSQL auto-cast para texto)
  - `payload` é um objeto mas não contém `source` → `payload.source?.author_name` (linha 72) retorna `undefined` → fallback null (seguro via `??`)
  - `payload.table` é `{ title: 123 }` → `!t.title` é false (123 truthy) → passa validação → `generateSlug(123)` pode produzir slug inválido → INSERT pode falhar ou inserir dados incorretos
- **Padrão pré-existente (não é novidade da spec 047):**
  - `syncDiscordDraftToTable.ts:49` — mesmo cast (reparse)
  - `syncDiscordDraftToTable.ts:100` — mesmo cast (sync Discord)
  - `adminDiscordSync.ts:42` — Zod schema do PATCH aceita `z.record(z.string(), z.unknown()).optional()` (valida só "é objeto", não estrutura)
  - `systemSuggestionsAdmin.ts:49,290` — `as Record<string, any> | null` (padrão ainda mais frágil)
- **Diretriz violada (AGENTS.md):** "todo dado de API/banco/JSON/JSONB/query/localStorage/integração externa é unknown até passar por normalizador tipado" — a diretriz menciona React/props/render, mas o princípio de segurança de tipos vale para backend também
- **Risco de regressão:** Baixo — a defesa em profundidade cobre a maioria dos cenários; corrupção de JSONB por admin edit é o vetor mais provável
- **Já existe tratamento?** Parcial (defesa em profundidade) mas sem normalizador estrutural
- **Falso positivo?** Não — a preocupação é válida, mas o impacto isolado no inbox é baixo porque o padrão é herdado do código Discord existente
- **Recomendação:**
  - Curto prazo (spec 047): aceitar como débito — o padrão é pré-existente e a defesa em profundidade cobre os casos comuns
  - Longo prazo (débito projeto-wide): criar Zod schema para `ImportTableDraft` + `DiscordTableDraftTable` e validar todo JSONB na leitura do banco. Afeta ~5 arquivos (3 casts sync + PATCH admin + systemSuggestions)
- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-22

### REV-005 — Cobertura de testes incompleta: sem testes para POST /import-text e GET /drafts

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/backend/src/routes/__tests__/adminImportInbox.test.ts:67-430`
- **Resumo:** O arquivo testa `/drafts/:id/sync`, `/drafts/:id/correction` e `/metrics`, mas não cobre `POST /import-text` (endpoint principal de importação com segmentação e parsing) nem `GET /drafts` (listagem paginada com filtros). Ambos têm lógica significativa.
- **Severidade declarada:** 🟠 Major
- **Status:** ✅ **investigado — procede** ✅ **implementado (2026-06-22)**
- **Débito vinculado:** DEB-047-11

#### 🔍 INVESTIGAÇÃO REV-005

- **Classificação:** procede e deve ser implementado
- **Severidade real:** 🟠 Major — `POST /import-text` é o endpoint crítico de entrada do inbox com zero cobertura
- **Cobertura atual do arquivo de teste (14 testes, 4 describe blocks):**
  | Bloco | Testes | Cobertura |
  |---|---|---|
  | `POST /drafts/:id/sync` | 6 | 404, 422 sem import_message_id, já-synced, rejected, não-ready, import_message não encontrada, missing_fields |
  | `POST /drafts/:id/correction` | 5 | 404 empty ID, payload inválido, draft inexistente, diff zero, diff com mudanças |
  | `GET /metrics` | 2 | base vazia, agregação por campo |
  | `syncImportDraftToTable` criação | 1 | criação com status draft |
- **Endpoints NÃO cobertos:**

  1. **`POST /import-text` (zero testes)** — endpoint crítico de entrada, ~97 linhas (64-161):
     - Zod validation (`importTextSchema`: min 10 chars)
     - `loadSystemsForParser()` — 2 queries DB + alias map
     - `segmentAnnouncements(text)` — 3 estratégias de split (separadores, headers, fallback)
     - Loop de segmentos: SHA256 hash → INSERT `import_messages` → `textToRawMessage` → `parseDiscordAnnouncement` → `normalizeDiscordTableDraft` → INSERT `discord_import_table_drafts` → UPDATE status → análise de missing fields
     - Tratamento de segmento não-parseável (status `error`)
     - Resposta agregada com `segments_found`, `drafts_created`, array de drafts
     - **Risco:** Refatorar `segmentAnnouncements`, `textToRawMessage`, `parseDiscordAnnouncement` ou o schema de `import_messages`/`discord_import_table_drafts` pode quebrar o pipeline sem detecção em CI

  2. **`GET /drafts` (zero testes)** — endpoint de listagem, ~49 linhas (165-214):
     - Zod validation de query params (`status`, `limit`, `offset`, `origin`)
     - INNER JOIN `discord_import_table_drafts` ↔ `import_messages`
     - Filtro por `status` e `origin`
     - Paginação com `limit` (max 100) e `offset`
     - Extração de `normalized_payload` (JSONB) como `Record<string, unknown>`
     - **Risco:** Mudanças no JOIN, campos do SELECT, ou filtros quebram a UI de listagem

- **Cenários de teste ausentes (mínimo recomendado):**
  - `POST /import-text`: texto válido cria drafts, texto < 10 chars rejeitado (400), segmentação com separadores `---`, segmentação por headers `Mesa:`, resposta inclui `segments_found`/`drafts_created`/drafts individuais, segmento não-parseável gera status `error` sem quebrar o loop
  - `GET /drafts`: lista vazia retorna [], filtro por status `ready`, filtro por origem `manual_paste`, paginação (limit=2, offset=1), payload sem `table` não quebra a extração
- **Risco de regressão:** Alto — sem cobertura de teste no endpoint crítico, qualquer mudança no pipeline de parsing/segmentação/normalização ou schema pode quebrar o inbox silenciosamente
- **Já existe tratamento?** Não — zero testes para estes endpoints
- **Falso positivo?** Não — a ausência é real e significativa
- **Recomendação:** Adicionar cobertura mínima de 4-6 testes para `POST /import-text` e 3-4 testes para `GET /drafts`. Priorizar `POST /import-text` (endpoint crítico). Os mocks de db do arquivo existente (chain mocking pattern) são reutilizáveis.
- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-22
- **Implementação:** +10 testes (3 para `POST /import-text`, 7 para `GET /drafts`). Cobertura: 400 texto curto, 400 sem campo text, 200 com parser mockado + checks de resposta, lista vazia, extração de título, payload sem `table`, `normalized_payload` null, filtro por status, filtro por origin, paginação defaults. Suíte: **19 files / 144 tests** (era 19/134). Lint ✅, `tsc --noEmit` ✅.

### REV-006 — Sem verificação de duplicidade em import_messages.content_hash

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/backend/src/routes/adminImportInbox.ts:84-99` — `POST /import-text`
- **Resumo:** `content_hash` é calculado e armazenado, mas não há verificação se já existe mensagem com o mesmo hash antes do INSERT. Permite que o mesmo texto seja importado múltiplas vezes, criando drafts duplicados.
- **Severidade declarada:** 🟡 Minor
- **Status:** ✅ **investigado — procede**
- **Task vinculada:** T1.6 (POST /import-text)
- **Débito vinculado:** sem vínculo claro

#### 🔍 INVESTIGAÇÃO REV-006

- **Classificação:** procede e deve ser implementado
- **Severidade real:** 🟡 Minor — duplicação de dados, não corrupção
- **Impacto real:** Admin cola o mesmo texto duas vezes → `import_messages` recebe duas linhas com mesmo `content_hash` (IDs UUID diferentes) → duas linhas em `discord_import_table_drafts` → dois syncs criam duas mesas duplicadas em `tables`. Sem perda ou corrupção de dados existentes — apenas desperdício e trabalho manual de limpeza.
- **Evidências de código:**
  1. `adminImportInbox.ts:85` — `contentHash = crypto.createHash('sha256').update(segment).digest('hex')` — hash é calculado
  2. `adminImportInbox.ts:87-98` — INSERT direto em `import_messages` sem SELECT prévio por `content_hash`
  3. `migration_128_import_messages.sql:17` — `content_hash TEXT NOT NULL` sem UNIQUE constraint
  4. `migration_128_import_messages.sql:26` — `CREATE INDEX idx_import_messages_content_hash` é índice REGULAR, não UNIQUE
- **Contraste com pipeline Discord** (`ingestMessages.ts:229-263`):
  - Discord faz `SELECT` por `discord_message_id` (natural key) antes de INSERT
  - Se já existe e hash mudou: UPDATE (trata como edição)
  - Se já existe e hash igual: SKIP (idempotente)
  - O inbox NÃO tem equivalente — `import_messages` não tem natural key como `discord_message_id`; `content_hash` seria o dedup key natural
- **Considerações de design:**
  - **SHA256 colisão:** Probabilidade negligível (~1 em 2^128), aceitável como dedup key
  - **Re-import intencional:** Se o admin cola o mesmo anúncio duas vezes de propósito (ex: erro no primeiro parse), a segunda tentativa deveria ser idempotente ou avisar?
  - **Deduplicação vs idempotência:** Um `SELECT` antes do INSERT com retorno do draft existente tornaria o endpoint idempotente — o admin veria "este texto já foi importado (draft X)" em vez de criar duplicata silenciosa
- **Risco de regressão:** Nenhum — adicionar dedup check é puramente aditivo
- **Já existe tratamento?** Não — zero verificação antes do INSERT
- **Falso positivo?** Não — a ausência de dedup é real
- **Recomendação:** Adicionar `SELECT` por `content_hash` antes do INSERT no loop de segmentos. Se encontrado, retornar referência ao draft existente (comportamento idempotente) em vez de criar duplicata. Alternativa: adicionar UNIQUE constraint em `content_hash` + `ON CONFLICT DO NOTHING` (exige nova migration).
- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-22

## 2026-06-22 — Implementação REV-006 (Deduplicação por content_hash)

**Executor:** OpenCode (DeepSeek-v4-pro)
**Escopo:** Adicionar SELECT por `content_hash` antes do INSERT em `import_messages` no `POST /import-text`

### O quê

- `adminImportInbox.ts:85-145`: adicionado bloco de dedup antes do INSERT:
  1. `SELECT import_messages WHERE content_hash = hash` (nova query)
  2. Se encontrado: `SELECT discord_import_table_drafts WHERE import_message_id = id`
  3. Se draft existe: retorna dados do draft existente (idempotente, **skip**)
  4. Se import_message existe mas sem draft: reusa `importMessageId` existente, cria novo draft
  5. Se nada encontrado: fluxo normal (INSERT import_message + parse + INSERT draft)

### Comportamento

| Cenário | Antes | Depois |
|---|---|---|
| 1ª importação | INSERT import_message + draft | igual |
| 2ª importação (mesmo texto) | INSERT duplicado + novo draft | **retorna draft existente** (skip) |
| import_message existe, draft deletado | INSERT duplicado + novo draft | **reusa import_message**, novo draft |
| Texto diferente | INSERT novo (hash diferente) | igual |

### Validação

- `tsc --noEmit`: zero erros
- `pnpm --filter @artificio/mesas-backend test`: 19 files / 144 tests ✅
- `pnpm run lint` (repo-wide): 15/15 ✅
- Mock atualizado (`dedupNotFoundChain`) para cobrir as 2 queries novas no teste `POST /import-text`

### Impacto

- **Idempotência**: re-import do mesmo texto retorna o draft existente em vez de criar duplicata
- **Sem breaking change**: endpoint, resposta, e estrutura de dados mantidos
- **Performance**: +2 SELECTs por segmento (com índice `idx_import_messages_content_hash`)
- **Futuro**: UNIQUE constraint em `content_hash` (nova migration) tornaria a verificação ainda mais robusta

### Status

- **REV-006:** ✅ **resolvido**

---

### REV-007 — Contrato DB↔Kysely inconsistente para metadata

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/database/migration_128_import_messages.sql:16` vs `apps/mesas/backend/src/db/types.ts:668`
- **Resumo:** A coluna `metadata` na migration permite NULL (`metadata JSONB DEFAULT '{}'` sem `NOT NULL`), mas o tipo Kysely (`ImportMessagesTable.metadata: Generated<unknown>`) não inclui `| null`. INSERT explícito com NULL causaria erro em runtime.
- **Severidade declarada:** 🟠 Major
- **Status:** ✅ **investigado — procede** ✅ **implementado (2026-06-22)**
- **Débito vinculado:** sem vínculo claro

#### 🔍 INVESTIGAÇÃO REV-007

- **Classificação:** procede e deve ser implementado
- **Severidade real:** 🟡 Minor — coluna não usada em código, risco futuro apenas
- **Contrato atual:**
  - **DB** (`migration_128:16`): `metadata JSONB DEFAULT '{}'` — sem `NOT NULL`, aceita NULL explícito, default `'{}'` quando omitido
  - **Kysely** (`db/types.ts:668`): `metadata: Generated<unknown>` — `Selectable` resolve para `unknown` (sem comunicar nullabilidade); `Insertable` torna opcional (pode omitir, usa DEFAULT)
- **O que Kysely faz:**
  - `Selectable<ImportMessagesTable>.metadata` → `unknown` — TypeScript permite `null` (unknown é supertype de tudo), mas o tipo **não comunica** que null é possível. Desenvolvedor que acessa `(row.metadata as any).field` sem null-check → crash se coluna for NULL
  - `Insertable<ImportMessagesTable>.metadata` → `unknown | undefined` (opcional via `Generated`) — omitir usa DEFAULT `'{}'`; passar `null` é aceito por TypeScript e pelo DB → NULL armazenado
- **Uso atual da coluna no código:**
  - `adminImportInbox.ts:87-98` (POST /import-text): **não inclui** `metadata` no INSERT → DB usa DEFAULT `'{}'` → sem problema
  - **Nenhum SELECT** lê `metadata` de `import_messages` em todo o código do mesas (confirmado via `rg` — zero leituras)
  - Coluna existe na tabela mas é **não utilizada** — placeholder para uso futuro (ex: metadados do importador, origem, timestamp)
- **Cenário de falha (futuro):**
  1. INSERT explícito com `metadata: null` → NULL armazenado
  2. SELECT lê a linha → `row.metadata` é `null` (TypeScript: `unknown`)
  3. Código acessa `(row.metadata as Record<string, unknown>).field` → `TypeError: Cannot read properties of null`
- **Risco de regressão:** Nenhum — coluna não é lida em produção. A correção é puramente defensiva (alinhar tipo ao schema)
- **Já existe tratamento?** Não — o tipo está dessincronizado do schema DB
- **Falso positivo?** Não — a inconsistência é real, mas severidade é menor que a declarada porque a coluna não é consumida
- **Recomendação:** Alterar `db/types.ts:668` para `metadata: Generated<unknown | null>` — alinha o tipo Kysely com a nullabilidade real da coluna. Se desejar garantir que metadata nunca seja NULL (coluna sempre tem valor), adicionar `NOT NULL` na migration (exige nova migration). Apenas o fix de tipo (sem migration) já elimina o gap de contrato.
- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-22
- **Implementação:** `db/types.ts:668` — `Generated<unknown>` → `Generated<unknown | null>`. Fix colateral: `syncHelpers.ts:95` — `as ImportTableDraft` → `as unknown as ImportTableDraft` (Zod retorna tipo genérico que não casa com a interface). Lint ✅, `tsc --noEmit` ✅, 144/144 testes ✅.

### REV-008 — RAISE NOTICE fora de bloco PL/pgSQL em migration_129 (coderabbitai)

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/database/migration_129_import_corrections.sql:44`
- **Resumo:** Mesma falha de REV-001, reportada por bot diferente. `RAISE NOTICE` standalone gera erro sintático no PostgreSQL. Sugere mover o NOTICE para dentro do bloco `DO $$ ... END $$` antes do `COMMIT`.
- **Severidade declarada:** 🔴 Critical
- **Status:** ✅ **investigado — procede (duplicata de REV-001)**
- **Task vinculada:** T1.2 (migration 128 — padrão)
- **Débito vinculado:** DEB-047-08
- **Investigação:** Mesma conclusão de REV-001 — ver evidências acima. Ambos os bots identificaram o mesmo erro sintático real com severidade crítica.

## 2026-06-22 — Implementação REV-001 (Correção migration_129 RAISE NOTICE)

**Executor:** OpenCode (DeepSeek-v4-pro)
**Escopo:** Corrigir `RAISE NOTICE` standalone em `migration_129_import_corrections.sql`

### O quê

- `migration_129_import_corrections.sql:44` → movido para linha 41, dentro do bloco `DO $$ ... END $$`, antes do `COMMIT`
- Padrão seguido: `migration_128_import_messages.sql:82` (RAISE NOTICE dentro do DO $$, COMMIT depois)

### Validação

- `rg "RAISE" migration_129` — 3 ocorrências (2× RAISE EXCEPTION + 1× RAISE NOTICE), todas dentro de `DO $$ ... END $$`
- `tsc --noEmit`: zero erros (migration é SQL, sem impacto TS)
- `pnpm --filter @artificio/mesas-backend test`: 19 files / 134 tests ✅

### Por quê

`RAISE NOTICE` é inválido como SQL standalone — só funciona dentro de bloco `DO $$`. O deploy runner (`apply_required_migrations.sh:131`) usa `psql -v ON_ERROR_STOP=1`. Sem a correção, `RAISE NOTICE` em linha 44 causaria erro de sintaxe → outer transaction rollback → sem registro em `schema_migrations` → deploys subsequentes sempre re-tentariam e re-falhariam migration_129.

### Status

- **REV-001:** ✅ **resolvido**
- **REV-008:** ✅ **resolvido (duplicata, mesma correção)**
- **DEB-047-08:** migration_129 sintaticamente corrigida; pendente de deploy beta

---

## 2026-06-22 — Implementação REV-004 (Zod para JSONB payloads)

**Executor:** OpenCode (DeepSeek-v4-pro)
**Escopo:** Substituir todos os casts `as ImportTableDraft` e `as Record<string, unknown>` por normalizadores Zod tipados

### O quê

- **`syncHelpers.ts`**: +Zod schemas + 2 funções normalizadoras:
  - `draftTableSchema` + `importTableDraftSchema` — `z.object()` com `.partial().passthrough()` para aceitar payloads parciais e chaves extra
  - `normalizeImportTableDraft(raw: unknown): ImportTableDraft` — valida payload completo, throw se nulo/não-objeto/malformado
  - `normalizeDraftPayload(raw: unknown): Record<string, unknown>` — valida que é objeto, retorna `{}` como fallback seguro
- **11 cast points eliminados em 5 arquivos:**

| # | Arquivo | Cast original | Substituído por |
|---|---|---|---|
| 1 | `syncDiscordDraftToTable.ts:42` | `as ImportTableDraft` | `normalizeImportTableDraft()` |
| 2 | `syncHelpers.ts:371` | `as ImportTableDraft` | `normalizeImportTableDraft()` |
| 3-4 | `adminDiscordSync.ts:1039-1040` | `as { missing_fields?: unknown }` | `normalizeDraftPayload()` |
| 5-8 | `adminImportInbox.ts:196-272` | `as Record<string, unknown>` (×4) | `normalizeDraftPayload()` |
| 9-11 | `systemSuggestionsAdmin.ts:49-303` | `as Record<string, any>` (×4) + `.set(... as any)` | `normalizeDraftPayload()` + tipagem correta |

- **`discord/index.ts`**: +exports `normalizeImportTableDraft`, `normalizeDraftPayload` no barrel
- **`adminImportInbox.test.ts`**: mock delegado para `vi.importActual()` — normalizadores reais nos testes

### Comportamento

| Cenário | Antes (cast) | Depois (normalizador) |
|---|---|---|
| Payload nulo | `null` → crash em `payload.table` | `normalizeImportTableDraft`: throw "Payload JSONB está nulo." |
| Payload primitivo (string/number) | crash imprevisível | `normalizeDraftPayload`: retorna `{}`; `normalizeImportTableDraft`: throw |
| Payload sem `.table` | `undefined.table` → crash | `normalizeImportTableDraft`: throw Zod error |
| Payload com campos extras | aceito (`.passthrough()`) | aceito (`.passthrough()`) |
| Payload com tipo errado em campo | crash em `validateDraftForSync` | `validateDraftForSync` rejeita com missing_fields |

### Validação

- `tsc --noEmit`: zero erros
- `pnpm --filter @artificio/mesas-backend test`: 19 files / 144 tests ✅
- `pnpm run lint` (repo-wide): 15/15 ✅
- Normalizadores são testados via mock real (`vi.importActual`) nos testes de rota

### Status

- **REV-004:** ✅ **resolvido**
- **DEB-047-13:** ✅ **fechado** — todos os 11 cast points normalizados
- Sem regressão: 10 novos testes de import-text/drafts adicionados no mesmo ciclo (REV-005)

---

## 2026-06-22 — Correções de bugs e riscos (pós-PR #87)

**Executor:** OpenCode (DeepSeek-v4-pro)
**Escopo:** 5 correções no endpoint de correção e validação de horário

### REV-009 — 🔴 Correção POST /drafts/:id/correction: corpus não atualizava normalized_payload

- **Arquivo:** `adminImportInbox.ts:312-338`
- **Problema:** Correção gravava em `import_corrections` mas NÃO atualizava `discord_import_table_drafts.normalized_payload`. Sync posterior usava valores antigos.
- **Correção:** Inserção e update agora em transação única (`db.transaction()`): INSERT `import_corrections` + UPDATE `discord_import_table_drafts.normalized_payload`
- **Teste:** `adminImportInbox.test.ts` — verifica que `mockDb.transaction` foi chamado e que `trx.updateTable('discord_import_table_drafts')` ocorreu

### REV-010 — 🔴 Rejeitar draft Discord (import_message_id=null) com 422

- **Arquivo:** `adminImportInbox.ts:304-310`
- **Problema:** Endpoint aceitava draft Discord (`import_message_id=null`), permitindo correção em draft que não é inbox
- **Correção:** `if (!draft.import_message_id) return res.status(422).json({ error: '...não é de inbox...' })`
- **Teste:** `adminImportInbox.test.ts` — cenário `import_message_id: null` → 422

### REV-011 — 🔴 raw_text nulo no corpus; buscar de import_messages

- **Arquivo:** `adminImportInbox.ts:326-335`
- **Problema:** `raw_text: null` era sempre gravado, perdendo o texto original exigido pela Spec 047 para o corpus de treino
- **Correção:** SELECT `raw_text, content_raw` da tabela `import_messages` antes do INSERT e persiste `rawText`
- **Teste:** `adminImportInbox.test.ts` — verifica que `SELECT FROM import_messages` foi feito com draft.import_message_id

### REV-012 — 🟡 HTTP codes específicos: 404/422, não 500 genérico

- **Arquivo:** `adminImportInbox.ts:304-318`
- **Problema:** Draft inexistente, synced ou rejected virava 500 genérico
- **Correção:**
  - `!draft` → 404 (já existia)
  - `status === 'synced'` → 422 (novo)
  - `status === 'rejected'` → 422 (novo)
  - 500 reservado para falha inesperada
- **Teste:** `adminImportInbox.test.ts` — cenários synced e rejected → 422

### REV-013 — 🟡 isValidTime aceitava horários impossíveis como 99:99

- **Arquivo:** `syncHelpers.ts:37-41`
- **Problema:** Regex `/^\d{2}:\d{2}(:\d{2})?$/` permitia `99:99`, `24:00`, `12:60` — valores inválidos para coluna `TIME NOT NULL` no PostgreSQL
- **Correção:** Validação semântica pós-regex: `h >= 0 && h <= 23 && min >= 0 && min <= 59`. Rejeita `99:99`, `24:00`, `12:60`; aceita `00:00`–`23:59`
- **Teste:** `syncHelpers.test.ts` (novo) — 9 testes cobrindo válidos (HH:MM, HH:MM:SS), inválidos (99:99, 24:00, 12:60, formatos não-numéricos)

### Validação

- `tsc --noEmit`: zero erros
- Backend tests: **20 files / 157 tests** ✅ (era 19/144; +9 syncHelpers + 4 correction)
- `pnpm run lint` (repo-wide): 15/15 ✅

### Status

| REV | Gravidade | Status |
|---|---|---|
| REV-009 | 🔴 | ✅ resolvido |
| REV-010 | 🔴 | ✅ resolvido |
| REV-011 | 🔴 | ✅ resolvido |
| REV-012 | 🟡 | ✅ resolvido |
| REV-013 | 🟡 | ✅ resolvido |

### REV-014 — 🟡 Sync genérico 500 para erros de estado (DraftNotFound/DraftState)

- **Arquivos:** `syncHelpers.ts` (core) + `adminImportInbox.ts` + `adminDiscordSync.ts` + `syncImportDraftToTable.ts`
- **Problema:** `syncDraftToTable` lançava `new Error(...)` genéricos para draft não encontrado, rejeitado, não-ready, sem payload, etc. Ambas rotas (Discord e Inbox) convertiam tudo para 500 exceto `DraftSyncValidationError` (campos ausentes).
- **Correção:**
  - `syncHelpers.ts`: criadas classes `DraftNotFoundError` e `DraftStateError` exportadas. 10 pontos de `throw new Error(...)` substituídos por throws tipados (1× DraftNotFoundError, 9× DraftStateError)
  - `syncImportDraftToTable.ts`: removido wrapper de pattern-matching em mensagens (frágil). Erros do core propagam diretamente como classes tipadas
  - `adminImportInbox.ts`: catch mapeia `DraftNotFoundError`→404, `DraftStateError`→422, `DraftSyncValidationError`→422, desconhecido→500
  - `adminDiscordSync.ts`: mesmo mapeamento + removido pattern-matching textual (`message.includes('não encontrado')`)
  - `discord/index.ts`: barrel export para `DraftNotFoundError`, `DraftStateError`
- **Testes:**
  - Inbox: 5 testes de sync atualizados (404/422 em vez de 500)
  - Discord: novo arquivo `adminDiscordSync.sync.test.ts` com 2 testes de erro tipado (404 DraftNotFound + 422 DraftStateError)
- **Validação:** `tsc` limpo, lint 15/15, **21 files / 159 tests** ✅
