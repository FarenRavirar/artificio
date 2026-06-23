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
- **Já existe tratamento?** Não — migration 129 foi aplicada diretamente no beta por codex/deepseek (2026-06-22), não pelo runner de deploy. O runner (`apply_required_migrations.sh`) teria falhado com a versão original (RAISE NOTICE standalone).
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
- Backend tests: **21 files / 178 tests** ✅ (era 19/144; +9 syncHelpers + 4 correction + 21 reviews/fixes)
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
- **Validação:** `tsc` limpo, lint 15/15, **21 files / 178 tests** ✅

---

## 2026-06-22 — CodeRabbit pós-commit `1adc156`

### REV-015 — normalizeTime pode produzir horários inválidos (ex: 99:00)

- **Origem:** coderabbitai (bot, pós-push `1adc156`)
- **Tipo:** PR (#87)
- **Referência:** `syncHelpers.ts:61-67` — `normalizeTime` + `syncHelpers.ts:175-195` — `extractSchedules`
- **Resumo:** `normalizeTime("99h")` → `"99:00"`, `normalizeTime("25h30")` → `"25:30"`. `extractSchedules` só verifica se `normalizeTime` retorna `null`, não se o resultado é semanticamente válido (hora 0-23, minuto 0-59). Output inválido chegaria ao INSERT em `table_schedules.start_time TIME NOT NULL`.
- **Severidade declarada:** 🟠 Major
- **Status:** ✅ **investigado — procede (defesa em profundidade)**
- **Classificação:** procede e deve ser implementado (hardening)
- **Severidade real:** 🟡 Minor — `isValidTime` bloqueia todos os cenários no fluxo atual; sem path de falha real

#### 🔍 INVESTIGAÇÃO REV-015

- **Path real no fluxo de sync:**
  1. `syncDraftToTable:392` → `validateDraftForSync(payload)` → `isValidTime(t.start_time)` (linha 139)
  2. `isValidTime("99h")` → regex `/^\d{2}:\d{2}(:\d{2})?$/` falha (sem `:`) → `start_time` em `missingFields` → sync aborta com `DraftSyncValidationError`
  3. `isValidTime("99:00")` → regex passa, mas `h=99 > 23` → retorna false → mesmo resultado
  4. `extractSchedules` (linha 398) SÓ roda se `validateDraftForSync` passou → `normalizeTime` nunca recebe input inválido no fluxo atual
  
- **O review está correto sobre a fragilidade de `normalizeTime`:** a função não tem auto-validação. Se alguém no futuro chamar `normalizeTime("99h")` sem o gate do `isValidTime`, o output "99:00" chegaria ao DB. É hardening, não bug ativo.

- **Único local onde `extractSchedules`/`normalizeTime` é chamado:** `syncHelpers.ts:398`, sempre após `validateDraftForSync:392`

- **Recomendação:** Adicionar `isValidTime` como gate interno em `normalizeTime` — se output for inválido, retornar `null`. Isso torna a função auto-contida e segura para qualquer chamador futuro.

- **Falso positivo?** Parcial — o cenário não se materializa no fluxo atual, mas a função é frágil e merece hardening.

- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-22
- **Implementação:** `syncHelpers.ts:66` — `normalizeTime` agora valida output com `isValidTime(result)` antes de retornar. "99h"→null, "25h30"→null, "12h99"→null. +3 testes em `syncHelpers.test.ts` (9→12). 21 files / 162 testes ✅.

### REV-016 — console.error loga erros esperados (404/422) em adminDiscordSync

- **Origem:** coderabbitai (bot, pós-push `1adc156`)
- **Tipo:** PR (#87)
- **Referência:** `adminDiscordSync.ts:1260-1272` — catch do POST /drafts/:id/sync
- **Resumo:** `console.error` na linha 1260 loga o erro ANTES da classificação por tipo (`DraftNotFoundError`, `DiscordDraftSyncValidationError`, `DraftStateError`). Erros esperados 404/422 viram ruído operacional. Linha 1270 loga o mesmo erro novamente (500).
- **Status:** ✅ **implementado**
- **Classificação:** procede (trivial, quick win)
- **Correção:** Removido `console.error` da linha 1260 (antes dos instanceof). Mantido apenas no fallback 500 (linha 1270). Análogo ao `adminImportInbox.ts` que já segue este padrão (linha 283).

---

## 2026-06-22 — Codex + CodeRabbit pós-PR #88 (UI Inbox)

**PR:** https://github.com/FarenRavirar/artificio/pull/88
**Branch:** `feat/047-inbox-ui-review`
**Commit base:** `5609e33`

### REV-017 — registerCorrection registra diff 0 após updateDraft já ter persistido

- **Origem:** chatgpt-codex-connector (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/frontend/src/features/inbox/components/InboxDraftReviewTable.tsx`, trecho que chama `registerCorrection` depois que o botão "Salvar campos" já persistiu via updateDraft
- **Resumo:** Quando o admin segue o fluxo normal (corrige campos com "Salvar campos" e depois sincroniza), o banco já foi atualizado via updateDraft antes da chamada a registerCorrection. O backend recalcula o diff contra a row atual, então os valores enviados batem com o payload salvo e `fields_corrected` fica 0, deixando o corpus de treino/correção vazio exatamente para as edições humanas que este recurso deveria capturar.
- **Severidade declarada:** P2 (Codex)
- **Status:** ✅ **Investigado — procede**
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:**

#### 🔍 INVESTIGAÇÃO REV-017

- **Classificação:** procede e deve ser implementado
- **Severidade real:** 🟠 Major — corpus de treino fica vazio, anulando o propósito da feature de correções
- **Impacto real:** O corpus de correções (`import_corrections`) registra `fields_corrected = 0` para edições reais, tornando os dados de treino inúteis. O propósito da Spec 047 (coletar correções humanas para melhorar o parser) é anulado.

- **Anatomia do fluxo (com evidências de código):**

  1. **Snapshot inicial** — `InboxDraftReviewTable.tsx:55`: `originalPayloadRef.current = full.normalized_payload` captura o estado original do draft ao abrir o preview
  2. **Admin edita + "Salvar campos"** — `DiscordDraftPreview.tsx:296-306` (`handleSaveFields`): chama `draftApi.updateDraft(draft.id, { normalized_payload: {...} })` → **persiste no backend** → `onUpdate(updated)` → `InboxDraftReviewTable.handleDraftUpdate` (linha 98-101) atualiza `selectedDraft`
  3. **Admin clica Sync** — `DiscordDraftPreview.tsx:401-427` (`handleSync`): chama `onBeforeSync(draft)` → `InboxDraftReviewTable.handleBeforeSync` (linha 62-96)
  4. **handleBeforeSync** — compara `originalPayloadRef.current` (snapshot original, ex: `{ title: "Old" }`) com `current.normalized_payload` (draft após save, ex: `{ table: { title: "New" } }`) → gera diff `{ title: "New" }`
  5. **registerCorrection** — envia `{ title: "New" }` para o backend
  6. **Backend POST /correction** (`adminImportInbox.ts:519-529`): carrega `draft.normalized_payload` do banco (que JÁ tem `{ table: { title: "New" } }` salvo pelo updateDraft). `parsedBefore = normalizeDraftPayload(draft.normalized_payload)` retorna `{ table: { title: "New" } }`. Depois aplica `corrections = { title: "New" }` em cima de `parsedBefore` (`parsedBefore.table = { ...parsedBefore.table, ...corrections }`). O `diff` (linha 522-529) compara `parsedBefore.table.title` ("New") com `corrections.title` ("New") → **igual** → `diff` vazio → `fields_corrected = 0`

- **Causa raiz:** O backend POST /correction foi projetado para receber correções ANTES da persistência (o fluxo original salvava correction + updateDraft juntos na transação). Com o fluxo do frontend (primeiro updateDraft, depois correction), o banco já contém os valores finais quando a correction chega.

- **Soluções possíveis:**
  - **Opção A (backend):** POST /correction aceitar `before` + `after` explicitamente, em vez de comparar com o banco atual. O frontend envia ambos os valores.
  - **Opção B (frontend):** Inverter a ordem: primeiro `registerCorrection` com diff calculado no frontend (comparing `originalPayloadRef` vs `form`), depois `updateDraft` e `syncDraft`. Mas isso quebraria a sequência atual dentro do `DiscordDraftPreview.handleSync`.
  - **Opção C (backend):** POST /correction comparar `corrections[key]` com o valor correspondente no `normalized_payload` do draft obtido via `parsed_before` (que é o payload carregado) — atualmente faz isso, mas o payload já foi sobrescrito. Se o frontend enviasse o valor **original** (before) e o **corrigido** (after), o backend poderia computar o diff corretamente.

- **Risco de regressão:** Alto se mudar a assinatura do endpoint POST /correction (impacta consumidores existentes). Baixo se a mudança for no frontend (só o inbox chama este endpoint).

- **Já existe tratamento?** Não — o fluxo foi implementado como "edit → save → sync" sem considerar que o save persiste antes da correção.

- **Falso positivo?** Não — bug real, corpus fica vazio.

- **Recomendação:** Inverter a ordem dentro de `handleBeforeSync`: primeiro chamar `registerCorrection` com o diff calculado no frontend comparando `originalPayloadRef.current` com `current.normalized_payload`, DEPOIS chamar `syncDraft`. O `updateDraft` já foi chamado em `handleSaveFields` e é necessário para persistir os campos editados — a correção deve capturar o que mudou entre o original e o salvo. Ajuste: `handleBeforeSync` não precisa chamar `syncDraft` — o `handleSync` já o faz no fallback (linha 416). Em vez disso, `handleBeforeSync` só registra a correção e retorna `null` (permitindo que o sync normal ocorra). Para evitar que o backend compute diff 0: adicionar `before` explícito no corpo da requisição, e o backend usar isso em vez de comparar com `normalized_payload` atual.

- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-22**

### REV-018 — Validar ready transitions antes de update em inbox drafts (CHECK constraint)

- **Origem:** chatgpt-codex-connector (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/backend/src/routes/adminImportInbox.ts:385-388`, PATCH /drafts/:id
- **Resumo:** Se admin muda inbox draft para `ready` enquanto `normalized_payload.missing_fields` ainda não está vazio, o update cego atinge a CHECK constraint do banco (`status='ready' => missing_fields=[]`) e retorna 500 genérico. A rota PATCH do Discord Sync já faz a checagem `assertDraftReadyTransition` antes de atualizar; a inbox PATCH deveria fazer o mesmo para retornar 422 claro.
- **Severidade declarada:** P2 (Codex)
- **Status:** ✅ **Investigado — procede**
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:**

#### 🔍 INVESTIGAÇÃO REV-018

- **Classificação:** procede e deve ser implementado
- **Severidade real:** 🟠 Major — 500 genérico em vez de 422 claro, confunde admin e dificulta debug

- **Evidências de código:**

  1. **CHECK constraint no banco** (`migration_118_discord_drafts_invariant.sql`): `status <> 'ready' OR COALESCE(jsonb_array_length(normalized_payload -> 'missing_fields'), 0) = 0` — quando status='ready', missing_fields deve ser array vazio

  2. **PATCH Discord Sync (com proteção)** (`adminDiscordSync.ts:1037-1051`):
     - Linha 1039: `const patchPayload = normalizeDraftPayload(parsed.data.normalized_payload)` — extrai payload
     - Linha 1040: `const currentPayload = normalizeDraftPayload(current.normalized_payload)` — extrai payload atual
     - Linha 1041: chama `assertDraftReadyTransition` com `patchStatus`, `patchPayloadMissing` e `currentPayloadMissing`
     - Linhas 1046-1051: se `!transition.allowed`, retorna 422 com `missing_fields` na resposta
     - Linhas 1053-1058: só executa o update se passou na validação

  3. **assertDraftReadyTransition** (`draftValidation.ts:27-49`): função que:
     - Se `patchStatus !== 'ready'`: permite sempre (retorna `{ allowed: true }`)
     - Tenta extrair `missing_fields` do payload patch, depois do atual, depois `[]`
     - Se `effective.length > 0`: retorna `{ allowed: false, reason, missingFields }`
     - Verifica que `missing_fields` está vazio

  4. **PATCH Inbox (SEM proteção)** (`adminImportInbox.ts:385-390`):
     - Update direto via `db.updateTable().set({ ...parsed.data }).where('id', '=', draftId).returningAll().execute()`
     - NENHUMA chamada a `assertDraftReadyTransition`
     - Se status='ready' e missing_fields não vazio, o PostgreSQL lança `23514` (check constraint violation) → catch (linha 395) → 500 genérico

- **Cenário de falha:**
  1. Admin altera campos mas deixa campo obrigatório vazio (ex: system_id)
  2. Admin muda status manualmente para 'ready' (ou o frontend faz isso via auto-classificação)
  3. PATCH Inbox executa  `UPDATE SET status='ready'`
  4. PostgreSQL rejeita com erro da constraint `discord_drafts_n`
  5. Catch converte para 500 genérico: `{ error: 'Erro ao atualizar draft.' }`
  6. Admin não entende por que o draft não ficou ready — mensagem é inútil

- **Risco de regressão:** Baixo — adicionar a checagem é puramente aditivo, não remove funcionalidade existente. A função `assertDraftReadyTransition` já está testada (`draftValidation.test.ts: 7 testes`)

- **Já existe tratamento?** Não no PATCH Inbox. Sim no PATCH Discord Sync (linhas 1041-1051)

- **Falso positivo?** Não — o gap é real e material

- **Recomendação:** Importar `assertDraftReadyTransition` de `../discord/draftValidation` no `adminImportInbox.ts` e adicionar a checagem antes do update, seguindo o mesmo padrão de `adminDiscordSync.ts:1041-1051`. Testar: status='ready' com missing_fields não vazio → 422. Status='ready' com missing_fields vazio → 200. Status='draft' com missing_fields não vazio → 200.

- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-22**

### REV-019 — thread_name ausente no reparse pode degradar parsing

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/backend/src/routes/adminImportInbox.ts:419-429`, POST /drafts/:id/reparse
- **Resumo:** O reparse reconstrói a mensagem sem `thread_name`, embora este contexto seja persistido no `import_messages` e usado pelo parser para título/sistema. Isso pode degradar o parse e sobrescrever o draft com dados incorretos. Sugere adicionar `thread_name` ao SELECT e passar para `textToRawMessage`.
- **Severidade declarada:** 🟠 Major
- **Status:** ✅ **Investigado — procede**
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:**

#### 🔍 INVESTIGAÇÃO REV-019

- **Classificação:** procede e deve ser implementado
- **Severidade real:** 🟡 Minor — afeta apenas drafts importados com `title_hint`; parser tem fallback

- **Evidências de código:**

  1. **Parser usa `discord_thread_name`** (`parseDiscordAnnouncement.ts:400-414`):
     - Linha 400: `const threadName = message.discord_thread_name ?? ''`
     - Linha 411: `const fullText = ${threadName}\n${body}`
     - Linha 414: `splitThreadName(threadName || body.split('\n')[0] || 'Mesa sem título')` — thread_name é usado para extrair título e dica de sistema
     - Se thread_name vazio: fallback para primeira linha do corpo

  2. **textToRawMessage aceita threadName** (`textToRawMessage.ts:4,18`):
     - Assinatura: `textToRawMessage(rawText: string, threadName?: string)`
     - Linha 18: `discord_thread_name: threadName ?? ''`

  3. **import_messages tem coluna thread_name** (`migration_128_import_messages.sql`): `thread_name TEXT`

  4. **POST /import-text persiste thread_name** (`adminImportInbox.ts`): `thread_name: title_hint ?? null`

  5. **POST /drafts/:id/reparse NÃO carrega thread_name** (`adminImportInbox.ts:419-428`):
     - Linha 421: `.select(['content_raw', 'raw_text'])` — **thread_name ausente**
     - Linha 428: `textToRawMessage(rawContent)` — **sem segundo argumento**
     - Resultado: `discord_thread_name` vazio no parser

  6. **Reparse do Discord Sync** (`adminDiscordSync.ts`): carrega `discord_thread_name` da tabela `discord_import_messages` e passa para `textToRawMessage` equivalente

- **Impacto real:**
  - Draft importado SEM `title_hint`: `thread_name = null` no `import_messages`. Reparse sem `thread_name` = mesmo resultado do parse original (que também não tinha). **Sem regressão.**
  - Draft importado COM `title_hint`: `thread_name = "D&D 5e: Aventura"` no `import_messages`. Reparse SEM `thread_name` perde a dica de título/sistema. O parser usa fallback `body.split('\n')[0]` que pode extrair título mas sem a dica de sistema.
  - **Cenário mais provável:** admin usa reparse quando o parse original falhou (status `needs_review`). Se o parse original já falhou mesmo com `title_hint`, o reparse sem `thread_name` pode degradar ainda mais.

- **Risco de regressão:** Nenhum — adicionar `thread_name` ao SELECT e passar para `textToRawMessage` é puramente aditivo

- **Já existe tratamento?** Não — o reparse Inbox ignora `thread_name`. O reparse Discord Sync (`adminDiscordSync.ts`) não tem este problema porque a tabela `discord_import_messages` tem `discord_thread_name` e é sempre selecionado.

- **Falso positivo?** Não — a omissão é real, embora o impacto seja menor que o declarado

- **Recomendação:** Alterar linha 421 de `.select(['content_raw', 'raw_text'])` para `.select(['content_raw', 'raw_text', 'thread_name'])` e linha 428 de `textToRawMessage(rawContent)` para `textToRawMessage(rawContent, importMsg.thread_name ?? undefined)`. Testar: reparse de draft com `thread_name` preserva no parser; reparse de draft sem `thread_name` continua funcionando.

- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-22**

### REV-020 — Fallback para discordSyncApi.getDraft quando api customizada injetada sem getDraft

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/frontend/src/features/discord-sync/components/DiscordDraftPreview.tsx:404-420`, handleSync
- **Resumo:** Quando `onBeforeSync` é usado (inbox) e `draftApi.getDraft` não está implementado, o código cai para `discordSyncApi.getDraft`, cruzando contextos de integração. Após sync, se `draftApi.getDraft` não existe, não deve fazer fallback — apenas retornar sem `onUpdate`.
- **Severidade declarada:** 🟠 Major
- **Status:** ✅ **Investigado — procede, mas é débito de hardening**
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:**

#### 🔍 INVESTIGAÇÃO REV-020

- **Classificação:** procede, mas é débito de hardening (não se materializa no fluxo atual)
- **Severidade real:** 🟡 Minor — requer injeção de API incompleta para se materializar

- **Evidências de código:**

  1. **handleSync em DiscordDraftPreview** (`DiscordDraftPreview.tsx:401-427`):
     - Linhas 404-414: se `onBeforeSync` retorna resultado, usa `draftApi.getDraft ?? discordSyncApi.getDraft` para recarregar o draft após sync
     - Linhas 416-421: mesmo padrão no fallback após `syncDraft`
     - Ambos: `draftApi.getDraft ? await draftApi.getDraft(draft.id) : await discordSyncApi.getDraft(draft.id)`

  2. **DraftApiOperations.getDraft é opcional** (`discord-sync/types.ts:172`): `getDraft?: (id: string) => Promise<DiscordDraft>;`

  3. **Inbox sempre define getDraft** (`draftAdapter.ts:20`): `getDraft: async (id) => inboxDraftToDiscordDraft(await inboxApi.getDraft(id))`

- **Impacto real:**
  - **Fluxo Inbox:** `buildInboxDraftApi()` sempre define `getDraft` → fallback nunca ativado → sem problema
  - **Fluxo Discord:** não usa `api` prop → usa `discordSyncApi` diretamente (não tem fallback)
  - **Risco futuro:** Se novo consumidor (ex: API de migração de legado) injetar `DraftApiOperations` sem `getDraft`, o fallback para `discordSyncApi.getDraft` retornaria um draft Discord com `discord_message_id` não nulo, quebrando o estado visual do preview. Mas este cenário não existe hoje.

- **Risco de regressão:** Baixo — remover o fallback não afeta o fluxo Inbox (sempre tem `getDraft`) nem o Discord (não usa `api` prop)

- **Já existe tratamento?** Não — o fallback existe como "conveniência" mas é frágil

- **Falso positivo?** Parcial — a preocupação é estruturalmente válida, mas o cenário não se materializa no código atual. É hardening defensivo.

- **Recomendação:** Remover o fallback para `discordSyncApi.getDraft`. Se `draftApi.getDraft` não existe, simplesmente não chamar `onUpdate` após sync (o draft já foi atualizado no backend). O estado local do preview continuará exibindo os dados corretos até o próximo refresh da lista.

  Alternativamente: tornar `getDraft` obrigatório em `DraftApiOperations`, já que todos os consumidores atuais (Discord e Inbox) o implementam. Isso força qualquer novo consumidor a implementá-lo.

- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-22**

### REV-021 — apiFetch frágil: res.json() antes de !res.ok, sem fallback para corpo não-JSON

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/frontend/src/features/inbox/api/inboxApi.ts:15-24`, apiFetch
- **Resumo:** Chamadas não-204 sempre passam por `res.json()` antes da verificação `!res.ok`. Se resposta não for JSON (corpo vazio, proxy HTML, erro de rede), `res.json()` lança `SyntaxError` mascarando status HTTP real. Além disso, `data.error` é acessado sem verificar tipo de `data`. Sugere usar `res.text()` + tentativa de `JSON.parse`.
- **Severidade declarada:** 🟠 Major
- **Status:** ✅ **Investigado — procede (hardening)**
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:**

#### 🔍 INVESTIGAÇÃO REV-021

- **Classificação:** procede, mas é hardening (defesa em profundidade)
- **Severidade real:** 🟡 Minor — fluxo normal nunca falha; cenário de erro só com proxy/nginx

- **Evidências de código:**

  1. **inboxApi.ts:15-24** — `apiFetch` faz `res.json()` antes de `!res.ok`
  2. **discordSyncApi.ts:22-32** — código IDÊNTICO, mesma vulnerabilidade
  3. **Nenhum outro apiFetch** no frontend — só estes dois arquivos têm este padrão

- **Impacto real:**
  - **Fluxo normal** (backend responde JSON): `res.json()` funciona, `data.error` é string → sem problema
  - **Erro de proxy/nginx** (500 com HTML): `res.json()` → `SyntaxError: Unexpected token '<'` → exceção não tratada → `toast.error("SyntaxError: ...")` genérico
  - **Backend com erro interno** (500 sem corpo): `res.json()` → `SyntaxError: Unexpected end of JSON input`
  - **Body vazio 422**: mesmo cenário
  - **`data.error` sem type guard** (linha 23): se `data` for array ou string, `data.error` é `undefined` → mensagem `"HTTP ${status}"` em vez do erro real

- **Probabilidade de ocorrência:**
  - Em produção real (VM Oracle com Docker), erros 500 com HTML de proxy são raros mas possíveis (ex: Cloudflare retorna HTML 502 se o container cair)
  - Em desenvolvimento local (Vite dev server), backend responde sempre JSON — zero risco

- **Risco de regressão:** Baixo — usar `res.text()` + `JSON.parse` com try/catch é defensivo e não muda comportamento no caminho feliz

- **Já existe tratamento?** Não — nenhum dos dois apiFetch tem proteção

- **Falso positivo?** Não — o padrão é frágil, embora a probabilidade de falha seja baixa

- **Recomendação:** Substituir `res.json()` por `res.text()` + `JSON.parse` em ambos os arquivos (`inboxApi.ts` e `discordSyncApi.ts`), com tratamento de erro para corpo não-JSON. Adicionar type guard para `data.error`: `typeof data === 'object' && data !== null && 'error' in data`.

- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-22**

### REV-022 — Fallback silencioso para [] esconde quebra de contrato da lista de drafts

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/frontend/src/features/inbox/api/inboxApi.ts:98-101`, `parseInboxDraftSummaries`
- **Resumo:** Retornar `[]` quando o schema falha oculta quebra de contrato da API e transforma erro real em "nenhum draft encontrado". Sugere lançar exceção em vez de fallback silencioso.
- **Severidade declarada:** 🟠 Major
- **Status:** ✅ **Investigado — procede (padrão existente em todo o frontend)**
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:**

#### 🔍 INVESTIGAÇÃO REV-022

- **Classificação:** procede, mas é débito separado (padrão estabelecido no frontend todo)
- **Severidade real:** 🟡 Minor — schema estável, fallback só ativaria em caso de breaking change não detectado

- **Evidências de código:**

  1. **parseInboxDraftSummaries** (`inboxApi.ts:97-100`):
     ```ts
     const parsed = z.array(inboxDraftSummarySchema).safeParse(value);
     return parsed.success ? parsed.data : [];
     ```

  2. **Mesmo padrão no Discord Sync** (`discordSyncApi.ts:136-153`):
     - `parseDiscordDiscoveredGuilds` (linha 138): `return parsed.success ? parsed.data : []`
     - `parseDiscordDiscoveredChannels` (linha 143): `return parsed.success ? parsed.data : []`
     - `parseDiscordSources` (linha 148): `return parsed.success ? parsed.data : []`
     - `parseDiscordMessages` (linha 153): `return parsed.success ? parsed.data : []`

  3. **Padrão contrário (lança exceção):** métodos que retornam objeto único (não array):
     - `inboxApi.ts:102-106` — `parseInboxDraft`: throw se falha
     - `inboxApi.ts:108-112` — `parseInboxCorrectionResult`: throw se falha
     - `inboxApi.ts:114-118` — `parseInboxSyncResult`: throw se falha
     - `discordSyncApi.ts:156-160` — `parseDiscordMessage`: throw se falha

  4. **Consumidor** (`InboxDraftReviewTable.tsx:32-45` — `loadDrafts`): chama `inboxApi.listDrafts()` → `parseInboxDraftSummaries` → se `[]`, seta `drafts` vazio → UI mostra "Nenhum draft encontrado"

- **Impacto real:**
  - Breaking change no schema de `InboxDraftSummary` (ex: renomear `source_type` para `origin`) → ZOD rejeita → `[]` → UI mostra "Nenhum draft encontrado" sem nenhum erro visível
  - Para descobrir, admin precisa abrir DevTools e ver a resposta da API
  - O mesmo vale para os 4 métodos do Discord Sync — breaking change no schema de `DiscordMessage` silenciosamente mostra lista vazia

- **Risco de regressão:** Baixo — mudar para throw só afeta o caminho de erro. O `loadDrafts` já tem `try/catch` que trata `err` com `toast.error`. Se a API está saudável, zero mudança de comportamento.

- **Já existe tratamento?** Não — o padrão de fallback silencioso para arrays está espalhado em 5 funções (1 inbox + 4 discord).

- **Falso positivo?** Não — o padrão é frágil; mas a severidade real é menor que a declarada porque o schema não muda com frequência

- **Recomendação:** Mudar `parseInboxDraftSummaries` para lançar exceção como as funções irmãs. Para o Discord Sync, criar débito separado (fora do escopo 047) para corrigir os 4 métodos similares.

- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-22**

### REV-023 — Normalize normalized_payload antes de gerar diff no registerCorrection

- **Origem:** coderabbitai (bot)
- **Tipo:** PR
- **Referência:** `apps/mesas/frontend/src/features/inbox/components/InboxDraftReviewTable.tsx:55-76`, handleSelectDraft + handleBeforeSync
- **Resumo:** Casts diretos `as Record<string, unknown>` aceitam payload não-objeto em runtime e podem produzir diff inconsistente. A linha 55 armazena dados brutos da API sem validação; linhas 74-75 fazem cast não-seguro de propriedades aninhadas. Sugere extrair função `toRecord` com guarda `isRecord` para normalizar antes do diff.
- **Severidade declarada:** 🟠 Major
- **Status:** ✅ **Investigado — procede (hardening, alinhamento com guideline)**
- **Task vinculada:** sem vínculo claro
- **Débito vinculado:**

#### 🔍 INVESTIGAÇÃO REV-023

- **Classificação:** procede, mas é hardening (alinhamento com guideline AGENTS.md)
- **Severidade real:** 🟢 Minor/Info — fallbacks existentes protegem contra cenários reais

- **Evidências de código:**

  1. **Cast 1 — snapshot inicial** (`InboxDraftReviewTable.tsx:55`):
     ```ts
     originalPayloadRef.current = full.normalized_payload as Record<string, unknown> | null;
     ```
     `full` vem de `inboxApi.getDraft(draft.id)`, que passa por `parseInboxDraft` com schema `z.unknown()`. Zod aceita qualquer valor. O cast permite que array/string seja tratado como record.

  2. **Cast 2 — payload atual** (`InboxDraftReviewTable.tsx:68`):
     ```ts
     const currentNormalized = current.normalized_payload as Record<string, unknown> | null;
     ```
     `current` é `DiscordDraft` que veio do adaptador `inboxDraftToDiscordDraft`. O adaptador (linha 16) já normaliza com `isRecord(raw.normalized_payload) ? raw.normalized_payload : null`. Então `current.normalized_payload` já é `Record<string, unknown> | null` — **este cast é seguro**.

  3. **Cast 3 — acesso aninhado** (`InboxDraftReviewTable.tsx:74-75`):
     ```ts
     const originalTable = (originalNormalized.table as Record<string, unknown>) || {};
     const currentTable = (currentNormalized.table as Record<string, unknown>) || {};
     ```
     Se `table` for string/array, o cast aceita mas o `for (const key of Object.keys(currentTable))` em linha 77 itera sobre propriedades da string/array, produzindo diff inesperado.

  4. **Adaptador existe** (`draftAdapter.ts:5-7`):
     ```ts
     function isRecord(value: unknown): value is Record<string, unknown> {
       return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
     }
     ```
     Função já disponível e usada em `inboxDraftToDiscordDraft`. Não usada em `InboxDraftReviewTable`.

  5. **Guideline violada** (AGENTS.md): "All external/API/database/JSON/JSONB/query/localStorage/integration data must be typed as unknown and passed through a typed normalizer before entering React state, props, or render."

- **Impacto real:**
  - Cenário 1: `normalized_payload = null` → cast na linha 55 faz `null as Record<string, unknown> | null` = `null` → `!originalNormalized` na linha 64 retorna null (seguro)
  - Cenário 2: `normalized_payload = ["a","b"]` → cast na linha 55 faz `["a","b"] as Record<string, unknown>` (TypeScript aceita) → `originalNormalized.table` = `undefined` → `{}` via `|| {}` → `Object.keys({})` = `[]` → diff vazio (seguro, mas silencioso)
  - Cenário 3: `normalized_payload = { table: ["a"] }` → cast linha 74 faz `["a"] as Record<string, unknown>` → `Object.keys(["a"])` = `["0"]` → itera sobre índice 0 → diff contém `{ "0": "a" }` → registerCorrection tenta corrigir "0" no payload (incorreto)
  - Cenário 3 é improvável porque o backend nunca armazena array em `table` — só objeto ou null

- **Risco de regressão:** Nenhum — usar `isRecord` é uma substituição direta do cast, sem mudança de comportamento no caminho feliz

- **Já existe tratamento?** Parcialmente — o `draftAdapter.ts` usa `isRecord`, mas `InboxDraftReviewTable.tsx` não. O Zod schema `inboxDraftSchema.normalized_payload: z.unknown()` não rejeita arrays.

- **Falso positivo?** Parcial — a preocupação é estruturalmente válida (guideline violation), mas os fallbacks (null check, `|| {}`) cobrem os cenários mais prováveis. O risco de array em `table` é teórico.

- **Recomendação:** Substituir os 3 casts por `isRecord()` do `draftAdapter.ts` (ou importar `isRecord`). Na linha 55: `originalPayloadRef.current = isRecord(full.normalized_payload) ? full.normalized_payload : null`. Nas linhas 74-75: `const originalTable = isRecord(originalNormalized.table) ? originalNormalized.table : {}`. Isso alinha com a guideline AGENTS.md e elimina o risco de array em `table`.

- **Investigado por:** OpenCode (DeepSeek-v4-pro)
- **Data:** 2026-06-22

### REV-024 — Campos removidos não capturados no diff de correções

- **Origem:** CodeRabbit (PR #88, linha 77-83)
- **Tipo:** PR
- **Referência:** `apps/mesas/frontend/src/features/inbox/components/InboxDraftReviewTable.tsx:77-83`
- **Resumo:** O loop `for (const key of Object.keys(currentTable))` só itera sobre chaves que ainda estão em `currentTable`. Se um campo existia em `originalTable` e foi removido (ex: admin apagou um campo no editor), ele nunca entra no diff, então `registerCorrection` não registra a remoção.
- **Severidade declarada:** 🟠 Major
- **Status:** ✅ **Investigado — procede e foi implementado**

#### 🔍 INVESTIGAÇÃO

- **Código original:** `InboxDraftReviewTable.tsx:77-83` (antes da correção):
  ```ts
  for (const key of Object.keys(currentTable)) {
    const before = originalTable[key];
    const after = currentTable[key];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diff[key] = after;
    }
  }
  ```
- **Código corrigido** (implementado 2026-06-22):
  ```ts
  const originalTable = isRecord(originalNormalized.table) ? originalNormalized.table : {};
  const currentTable = isRecord(currentNormalized.table) ? currentNormalized.table : {};

  const allKeys = new Set<string>();
  for (const key of Object.keys(originalTable)) allKeys.add(key);
  for (const key of Object.keys(currentTable)) allKeys.add(key);

  const diff: Record<string, unknown> = {};
  for (const key of allKeys) {
    const before = Object.prototype.hasOwnProperty.call(originalTable, key) ? originalTable[key] : null;
    const after = Object.prototype.hasOwnProperty.call(currentTable, key) ? currentTable[key] : null;
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      diff[key] = after;
    }
  }
  ```
- **Problema:** Se `originalTable = { title: 'Foo', type: 'campanha' }` e `currentTable = { title: 'Foo' }` (type removido), o loop original só vê `title`, e `diff` fica vazio. A remoção de `type` não era registrada.
- **Impacto real:** Admin remove campo no editor → diff sem registro → `registerCorrection` não envia a remoção → `normalized_payload` no banco ainda tem o campo antigo → na próxima edição, o campo reaparece.
- **Severidade real:** 🟠 Major — perda de dados de correção (campo removido não é persistido).
- **Risco de regressão:** Baixo — expandir o Set de chaves não muda comportamento para caminho feliz.
- **Classificação:** procede e foi implementado
- **Achado durante implementação:** `originalTable` e `currentTable` precisaram ser declarados antes do `allKeys` — o código anterior os declarava dentro do loop.
- **Estado:** ✅ código corrigido localmente em `InboxDraftReviewTable.tsx` (8+/4-: união `originalTable ∪ currentTable` via `allKeys` Set). **Não commitado** — vai em commit separado. Não está em nenhum PR ainda. reviews.md e `spec047-backup/` também modificados/untracked localmente.
- **Validação:** lint 15/15, build 17/17, backend 21/178 ✅, frontend 4/19 ✅.
- **Data da implementação:** 2026-06-22

---

## 2026-06-22 — SonarCloud Quality Gate (PR #88)

**Fonte:** SonarCloud, PR #88
**Motivo:** Quality Gate falhou — Reliability Rating < A. 12 warnings.
**Investigador:** OpenCode (DeepSeek-v4-pro)

### SC-001/006 — Negated condition (TextPasteArea.tsx:110)

- **Arquivo/linha:** `apps/mesas/frontend/src/features/inbox/components/TextPasteArea.tsx:110`
- **Problema:** Ternário negado para pluralização manual: `{result.segments_found !== 1 ? 's' : ''}`.
- **Severidade declarada:** Warning (Code Smell)
- **Status:** ✅ **Investigado — procede (cosmético, baixo impacto)**

#### 🔍 INVESTIGAÇÃO

- **Origem:** SonarQube rule S3923 (unexpected negated condition). Prefere `=== 1` com branches invertidos.
- **Código real:** `TextPasteArea.tsx:110`:
  ```tsx
  <span>
    {result.segments_found} segmento{result.segments_found !== 1 ? 's' : ''} encontrado{result.segments_found !== 1 ? 's' : ''}
    , {result.drafts_created} draft{result.drafts_created !== 1 ? 's' : ''} criado{result.drafts_created !== 1 ? 's' : ''}.
  </span>
  ```
- **Alternativa:** Extrair helper `pluralize(n: number): string` ou inverter ternário: `n === 1 ? '' : 's'`.
- **Impacto real:** Zero. Código funcionalmente correto.
- **Severidade real:** 🟢 Info — code smell cosmético.
- **Risco de regressão:** Nenhum.
- **Já existe tratamento?** Não.
- **Falso positivo?** Parcial — a regra é válida como style guide, mas o código é semanticamente correto.
- **Classificação:** procede e deve ser implementado (quick win trivial)
- **Recomendação:** Inverter ternário ou extrair `pluralize()`.

### SC-003/008 — Negated condition (TextPasteArea.tsx:111)

- **Arquivo/linha:** `apps/mesas/frontend/src/features/inbox/components/TextPasteArea.tsx:111`
- **Problema:** Mesmo padrão SC-001, para `drafts_created`.
- **Severidade declarada:** Warning (Code Smell)
- **Status:** ✅ **Investigado — procede (cosmético, mesmo caso que SC-001)**

Idêntico a SC-001. Mesma recomendação.

### SC-002 — Nested template literal (inboxApi.ts:141)

- **Arquivo/linha:** `apps/mesas/frontend/src/features/inbox/api/inboxApi.ts:148`
- **Problema:** Template literal aninhado: `` `/drafts${qsStr ? `?${qsStr}` : ''}` ``.
- **Severidade declarada:** Warning (Code Smell)
- **Status:** ✅ **Investigado — procede (cosmético)**

#### 🔍 INVESTIGAÇÃO

- **Origem:** SonarQube rule S1711 (template literals should not be nested).
- **Código real:** `inboxApi.ts:148`:
  ```ts
  return parseInboxDraftSummaries(await apiFetch<unknown>(`/drafts${qsStr ? `?${qsStr}` : ''}`));
  ```
- **Alternativa:** Extrair URL para variável: `const url = qsStr ? `/drafts?${qsStr}` : '/drafts';`
- **Impacto real:** Zero.
- **Severidade real:** 🟢 Info.
- **Classificação:** procede e deve ser implementado (quick win trivial)
- **Recomendação:** Extrair URL para variável.

### SC-004 — Cognitive Complexity 29 (DiscordDraftPreview.tsx:221)

- **Arquivo/linha:** `apps/mesas/frontend/src/features/discord-sync/components/DiscordDraftPreview.tsx:221`
- **Problema:** Função `DiscordDraftPreview` com Cognitive Complexity 29 (limite 15).
- **Severidade declarada:** 🔴 Failure (Reliability Rating < A)
- **Status:** ✅ **Investigado — procede, mas é débito de refactor estrutural (fora do escopo 047)**

#### 🔍 INVESTIGAÇÃO

- **Origem:** SonarQube rule S3776 (Cognitive Complexity). Disparada no PR #88 (commit `5609e33`).
- **Arquivo:** `DiscordDraftPreview.tsx` — 707 linhas, componente monolítico.
- **Histórico:** O componente existe desde antes da spec 047. A spec 047 só adicionou 2 props (`api`, `onBeforeSync`) e manteve toda a complexidade pré-existente. **A complexidade não é nova deste PR.**
- **O que contribui para a complexidade (29 > 15):**
  - 7 `useState`, 2 `useRef`, 1 `useEffect`, 1 `useMemo`
  - Sincronização síncrona entre renders (linhas 244-251)
  - 7 handlers de ação (handleSaveFields, handleCoverUpload, handleRemoveCover, handleConfirmSlots, handleSync, handleReparse, handleSaveStatus)
  - Render condicional com 3 abas (editor/parsed/normalized)
  - Formulário com 15 campos + slots ambiguity + upload de imagem + edição de status
- **Impacto real:** Manutenção difícil, testabilidade reduzida. Quebrou Quality Gate.
- **Severidade real:** 🟠 Major — problema estrutural real, mas é pré-existente.
- **Risco de regressão:** Alto — refatorar requer extração cuidadosa em múltiplos componentes.
- **Já existe tratamento?** Não.
- **Classificação:** procede, mas é débito separado (refactor estrutural, fora do escopo 047)
- **Recomendação:**
  1. Extrair handlers para hooks customizados: `useDraftForm`, `useDraftSync`, `useCoverUpload`, `useSlotsAmbiguity`
  2. Extrair abas para subcomponentes: `DraftEditorTab`, `DraftNormalizedTab`, `DraftParsedTab`
  3. Reduzir `DiscordDraftPreview` para ~200 linhas (container que orquestra hooks + tabs)
  4. Registrar débito em `debitos.md` (DEB-047-15)
- **Nota:** Este arquivo não é da spec 047 — é do Discord Sync legado. A contribuição da spec 047 para este arquivo é mínima (+2 props). O Quality Gate não deveria exigir refactor completo de componente legado para aprovar PR que só adiciona props.

### SC-005 — Read-only props (DiscordDraftReviewTable.tsx:44)

- **Arquivo/linha:** `apps/mesas/frontend/src/features/discord-sync/components/DiscordDraftReviewTable.tsx:44`
- **Problema:** Props não marcadas como `readonly`.
- **Severidade declarada:** Warning (Code Smell)
- **Status:** ✅ **Investigado — procede (cosmético)**

#### 🔍 INVESTIGAÇÃO

- **Origem:** SonarQube rule S6642 (Props should be marked as read-only).
- **Código:** `DiscordDraftReviewTable.tsx:7-12`:
  ```ts
  interface Props {
    api?: DraftApiOperations;
    listDrafts?: (params?: { status?: DiscordImportDraftStatus; limit?: number; offset?: number }) => Promise<DiscordDraft[]>;
    syncReadyAction?: () => Promise<{ synced: number; failed: number; errors: string[] }>;
    showSyncReady?: boolean;
  }
  ```
- **Impacto real:** Zero. TS não valida readonly em props de função componente.
- **Severidade real:** 🟢 Info.
- **Classificação:** procede e deve ser implementado (quick win)
- **Recomendação:** Adicionar `readonly` em cada campo da interface `Props`.

### SC-007 — Read-only props (TextPasteArea.tsx:14)

- **Arquivo/linha:** `apps/mesas/frontend/src/features/inbox/components/TextPasteArea.tsx:14`
- **Problema:** Props não marcadas como `readonly`.
- **Severidade declarada:** Warning (Code Smell)
- **Status:** ✅ **Investigado — procede (cosmético, mesmo caso que SC-005)**

- **Código:** `TextPasteArea.tsx:7-10`:
  ```ts
  interface TextPasteAreaProps {
    onImportSuccess?: (result: InboxImportResult) => void;
    titleHint?: string;
  }
  ```
- **Recomendação:** Adicionar `readonly`.

### SC-010 — Read-only props (DiscordDraftPreview.tsx:221)

- **Arquivo/linha:** `apps/mesas/frontend/src/features/discord-sync/components/DiscordDraftPreview.tsx:221`
- **Problema:** Props não marcadas como `readonly`.
- **Severidade declarada:** Warning (Code Smell)
- **Status:** ✅ **Investigado — procede (cosmético, mesmo caso que SC-005)**

- **Código:** `DiscordDraftPreview.tsx:7-13`:
  ```ts
  interface Props {
    draft: DiscordDraft;
    onUpdate: (updated: DiscordDraft) => void;
    onClose: () => void;
    api?: DraftApiOperations;
    onBeforeSync?: (draft: DiscordDraft) => Promise<{ tableId: string; created: boolean } | null>;
  }
  ```
- **Recomendação:** Adicionar `readonly`.

### SC-009 — Keyboard listener (InboxDraftReviewTable.tsx:138)

- **Arquivo/linha:** `apps/mesas/frontend/src/features/inbox/components/InboxDraftReviewTable.tsx:138`
- **Problema:** `<div>` com `onClick` sem `onKeyDown`/`role`/`tabIndex`.
- **Severidade declarada:** Warning (Code Smell)
- **Status:** ✅ **Investigado — procede (acessibilidade)**

#### 🔍 INVESTIGAÇÃO

- **Origem:** SonarQube rule S6848 (non-interactive elements should have keyboard listeners).
- **Código:** `InboxDraftReviewTable.tsx:134-159`:
  ```tsx
  <div className="...cursor-pointer..." onClick={() => handleSelectDraft(draft)}>
  ```
- **Problemas:** (1) `<div>` não é focado por Tab — inacessível para teclado. (2) Leitor de tela não anuncia como clicável. (3) Usuário com deficiência motora que usa Tab não consegue selecionar draft.
- **Impacto real:** Admin não consegue navegar drafts sem mouse.
- **Severidade real:** 🟡 Minor — acessibilidade. O admin usa mouse normalmente, mas afeta usuários com deficiência.
- **Risco de regressão:** Baixo — adicionar acessibilidade não muda visual.
- **Já existe tratamento?** Não.
- **Classificação:** procede e deve ser implementado
- **Recomendação:** Trocar `<div>` por `<button>` (semântico) ou adicionar `role="button"`, `tabIndex={0}`, `onKeyDown={(e) => e.key === 'Enter' && handleSelectDraft(draft)}`. `<button>` é preferível.

### SC-012 — Non-native interactive element (InboxDraftReviewTable.tsx:138)

- **Arquivo/linha:** `apps/mesas/frontend/src/features/inbox/components/InboxDraftReviewTable.tsx:138`
- **Problema:** Mesma linha 138 — `<div>` como elemento interativo.
- **Severidade declarada:** Warning (Code Smell)
- **Status:** ✅ **Investigado — mesma causa que SC-009**

**Conclusão:** SC-009 resolve SC-012 automaticamente.

### SC-011 — Nested ternary (InboxDraftReviewTable.tsx:162)

- **Arquivo/linha:** `apps/mesas/frontend/src/features/inbox/components/InboxDraftReviewTable.tsx:144`
- **Problema:** Operador ternário implícito aninhado.
- **Severidade declarada:** Warning (Code Smell)
- **Status:** ✅ **Investigado — procede (cosmético)**

#### 🔍 INVESTIGAÇÃO

- **Origem:** SonarQube rule S3358 (Ternary operators should not be nested).
- **Código:** `InboxDraftReviewTable.tsx:144-145`:
  ```tsx
  <span className={`px-2 py-0.5 text-xs rounded-full ${DRAFT_STATUS_COLORS[draft.status] || 'bg-white/10 text-white/50'}`}>
    {DRAFT_STATUS_LABELS[draft.status] || draft.status}
  </span>
  ```
- `||` é interpretado como ternário implícito.
- **Alternativa:** Extrair para variáveis: `const colorClass = DRAFT_STATUS_COLORS[draft.status] ?? 'bg-white/10 text-white/50'` e `const label = DRAFT_STATUS_LABELS[draft.status] ?? draft.status`.
- **Impacto real:** Zero.
- **Severidade real:** 🟢 Info.
- **Classificação:** procede e deve ser implementado (quick win)
- **Recomendação:** Extrair para variáveis com `??` em vez de `||`.

---

## 2026-06-22 — Smoke beta autenticado (pós-deploy PR #88, run `27996679041`)

> Dois bugs reais reproduzidos no beta (`mesasbeta.artificiorpg.com/gestao` → aba Inbox), sessão admin. Engenheiro fechou diagnóstico; pedreiro só executa o fix descrito. **Não reabrir investigação — causa-raiz confirmada no código.**

### REV-025 — 🔴 `POST /import-text` quebra UI com "Resposta de importação em formato inesperado"

- **Origem:** smoke manual beta (mantenedor autenticado)
- **Tipo:** bug de runtime (contrato backend↔frontend)
- **Sintoma reproduzido:** colar anúncio (18310 chars) → clicar "Importar anúncios" → banner vermelho `⚠️ Resposta de importação em formato inesperado.` Nenhum draft aparece na UI. (O segundo erro de console `A listener indicated an asynchronous response... message channel closed` é **ruído de extensão Chrome**, não é nosso — ignorar.)
- **Severidade real:** 🔴 Critical — bloqueia o fluxo MVP inteiro (T1.13/T1.14 não passam).
- **Status:** ✅ **implementado (2026-06-23)**

#### 🔍 INVESTIGAÇÃO REV-025

- **Causa-raiz:** a coluna `confidence` é `NUMERIC(4,3)` (`migration_115_discord_import.sql:68`). O driver `node-postgres` (`pg`) devolve `NUMERIC`/`DECIMAL` como **string** (ex.: `"0.750"`), **não** como `number` — comportamento padrão do pg para preservar precisão. O tipo Kysely declara `confidence: number | null` (`db/types.ts:646`), mas o tipo **mente sobre o runtime**: Kysely não coage valores, só tipa.
- **Onde estoura:** o backend monta `created[].confidence = draftRow.confidence` (`routes/adminImportInbox.ts:188`) e responde `{ data: { segments_found, drafts_created, drafts } }` (`:193-198`). No frontend, `apiFetch` extrai `.data` (`inboxApi.ts:30`) e `parseInboxImportResult` roda `inboxImportResultSchema.safeParse` (`inboxApi.ts:99-101`). O schema do item exige `confidence: z.number().nullable()` (`inboxApi.ts:37`). String `"0.750"` → `safeParse` falha → throw `'Resposta de importação em formato inesperado.'`.
- **Por que nem sempre quebra:** drafts com `confidence = null` passam no `z.number().nullable()`. Só quebra quando o parser produz confiança não-nula (caso comum em anúncio real). Por isso o sintoma é consistente com anúncio de verdade.
- **Blast radius (mesma raiz, corrigir todos):** todo endpoint inbox que serializa `confidence` numérica:
  1. `POST /import-text` → `inboxImportDraftSchema.confidence` (`inboxApi.ts:37`)
  2. `GET /drafts` → `inboxDraftSummarySchema.confidence` (`inboxApi.ts:54`)
  3. `GET /drafts/:id` e `PATCH /drafts/:id` → `inboxDraftSchema.confidence` (`inboxApi.ts:64`)
- **Falso positivo?** Não. Reproduzido no beta.
- **Por que o painel Discord não quebrou antes:** verificar `discordSyncApi` — ou usa schema diferente, ou já recebia `confidence` null nos drafts testados, ou coage. **O pedreiro deve confirmar que o fix não regride o fluxo Discord** (mesma coluna `discord_import_table_drafts.confidence`).

#### 🔧 INSTRUÇÃO DE OBRA (pedreiro)

- **Fix preferido (na fonte, corrige os 3 endpoints de uma vez):** coagir `confidence` para `number | null` no backend antes de `res.json`, no ponto onde o row vira resposta. Helper único, ex.:
  ```ts
  // util compartilhado no backend (ex.: routes/adminImportInbox.ts topo ou um helpers)
  const toNumberOrNull = (v: unknown): number | null =>
    v == null ? null : typeof v === 'number' ? v : Number(v);
  ```
  Aplicar em:
  1. `routes/adminImportInbox.ts:188` — `confidence: toNumberOrNull(draftRow.confidence)`
  2. no montaador de resposta de `GET /drafts` (linha do `res.json({ data: drafts })` ~`:252`) — mapear cada draft coagindo `confidence`
  3. no `GET /drafts/:id` (`res.json` ~`:333`) e `PATCH` (`:407`) — coagir `confidence` no objeto retornado
- **Não** trocar o tipo Kysely para `string` — o contrato semântico é numérico; o erro é o driver, não o tipo de domínio. Corrigir na borda de serialização.
- **Alternativa aceitável SE houver muitos pontos:** no frontend trocar `z.number()` por `z.coerce.number()` nos 3 schemas de confidence (`inboxApi.ts:37,54,64`). Menos correto (esconde o problema em outros consumidores futuros do backend), mas funciona. **Preferir o fix backend.**
- **Verificação obrigatória:**
  1. Reproduzir o smoke T1.13 no beta após fix → draft aparece com confidence numérica.
  2. Smoke do painel **Discord Sync** (colar/listar) → confirmar zero regressão.
  3. Teste de rota: asserta que `POST /import-text` devolve `confidence` como `number` (não string) quando o parser pontua.
  4. Gates: `pnpm run lint` + `pnpm run build` + testes mesas verdes, contagem registrada.

### REV-026 — 🟡 Textarea do Inbox: texto invisível (fg claro sobre `--artificio-surface` branca) no tema escuro

- **Origem:** smoke manual beta (mantenedor autenticado)
- **Tipo:** bug visual + risco sistêmico de tokens de tema
- **Sintoma reproduzido:** na aba Inbox → "Importar", o texto colado no `<textarea>` fica quase invisível (claro sobre fundo branco) com a página em tema escuro.
- **Severidade real:** 🟡 Major — quebra usabilidade (Nielsen: visibilidade/legibilidade) do fluxo principal, mas não bloqueia funcionalidade.
- **Status:** ✅ **implementado (2026-06-23)**

#### 📸 EVIDÊNCIA DUPLA (dark vs light — smoke beta)

- **Textarea é dark-only.** Comparação direta: no tema **claro** o texto colado renderiza preto-sobre-branco, **legível**; no tema **escuro** fica claro-sobre-branco, **invisível**. Isso confirma cirurgicamente a causa-raiz: `--artificio-surface` NÃO troca no dark (fica `#ffffff`), mas `--artificio-fg` troca para claro. No light os dois ficam consistentes (fg escuro + surface branca), por isso só o dark quebra.
- **Segundo instance da MESMA classe — banner de status.** No mesmo smoke, o banner de erro (`bg-red-50 ... text-red-800` / `dark:bg-red-900/20 dark:text-red-200`, `TextPasteArea.tsx:127-131`) renderiza com texto **apagado/baixo contraste** — só legível ao selecionar. Os banners de `success` (`:107`) e `no-drafts` (`:117`) usam o mesmo padrão de paleta tailwind hardcoded sem verificar contraste contra o fundo realmente renderizado. **Não é token `--artificio-*` aqui** — é paleta tailwind escolhida no olho, mas é a MESMA classe de defeito (cor sem garantia de contraste vs background temático).

#### 🔍 INVESTIGAÇÃO REV-026

- **Causa-raiz:** o textarea casa **manualmente** o par `bg-[var(--artificio-surface)] text-[var(--artificio-fg)]` (`TextPasteArea.tsx:76`). `--artificio-surface` é definido como `#ffffff` fixo no tema base (`packages/ui/src/styles.css:7`). No escopo de tema escuro da `/gestao`, `--artificio-fg` é sobrescrito para um tom claro, mas `--artificio-surface` **não recebe override equivalente nesse escopo** → fg claro sobre surface branca = texto invisível. É **dessincronia de tokens entre temas**: dois tokens que precisam trocar juntos, mas só um troca.
- **Falso positivo?** Não. Reproduzido visualmente no beta.
- **Risco sistêmico (o ponto importante levantado pelo mantenedor):** qualquer call-site que case `surface`+`fg` (ou qualquer par bg/fg) à mão sob um escopo que sobrescreve só um dos dois reproduz o mesmo defeito. **Não é bug isolado do textarea — é classe de bug.**

#### 🔧 INSTRUÇÃO DE OBRA (pedreiro) — fix em 2 camadas

**Camada 1 — fix imediato (destrava o smoke):**
- No `TextPasteArea.tsx:76`, garantir contraste no escopo atual. Trocar o par por tokens que comprovadamente trocam juntos nos dois temas. Confirmar antes qual token escuro existe (ler `packages/ui/src/styles.css` bloco `[data-theme="dark"]`/`.dark` e usar o par bg/fg já pareado lá, ex.: o mesmo par usado por inputs do painel Discord que funcionam no escuro). Espelhar exatamente o que um input legível já usa em `/gestao`.

**Camada 2 — prevenção atômica (impede recorrência da CLASSE de bug):**
- **Opção A (recomendada, mais barata e cobre o ecossistema):** introduzir **tokens de input pareados** dedicados em `packages/ui/src/styles.css` — `--artificio-input-bg` / `--artificio-input-fg` (+ `--artificio-input-placeholder` / `--artificio-input-border` se útil) — definidos em **ambos** os temas (claro e escuro), garantidos a trocar juntos. Estender o `packages/ui/scripts/check-token-parity.mjs` para **falhar o build se um token de input existir num tema e faltar no outro** (paridade obrigatória). Migrar o textarea (e inputs hand-rolled equivalentes) para esses tokens.
- **Opção B (mais robusta, maior esforço):** criar primitivo compartilhado `<Textarea>`/`<Input>` em `packages/ui` com as classes theme-aware corretas embutidas, e migrar apps para consumi-lo, eliminando o hand-roll de par bg/fg. SDD Completo (toca `packages/ui`). Registrar como débito de qualidade se não couber agora.
- **Banners de status (mesmo turno):** auditar os 3 banners de `TextPasteArea.tsx` (`success` `:107`, `no-drafts` `:117`, `error` `:127`) — confirmar contraste WCAG AA do texto contra o fundo em **ambos** os temas. O erro reportado mostra `text-red-800`/`dark:text-red-200` apagado; revisar o tom (ou migrar para o mesmo sistema de tokens/primitivo escolhido na Opção A/B, padronizando "alert/banner" como componente compartilhado com contraste garantido). Não deixar paleta tailwind escolhida no olho.
- **Mapa de recorrência (fazer antes de escolher escopo):** rodar `rg "bg-\[var\(--artificio-surface\)\].*text-\[var\(--artificio-fg\)\]" apps packages` e variações de par bg/fg manual; **e** `rg "bg-(red|green|amber|yellow)-(50|100).*text-\1-(700|800|900)" apps packages` para banners hardcoded. Listar todos os call-sites afetados na sessão. Decidir Opção A vs B pelo número de ocorrências.
- **Verificação obrigatória:**
  1. Smoke beta: colar texto no textarea em tema **escuro** e **claro** → texto legível nos dois.
  2. Disparar os 3 estados de banner (success/no-drafts/error) em **ambos** os temas → texto legível (contraste AA) nos dois.
  3. `check-token-parity.mjs` passa (e falharia se faltasse o par num tema — provar com teste).
  4. Gates lint/build verdes.

> Bugs descobertos em smoke → também devem entrar em `specs/backlog.md` (rastreio) e, se mudarem próximo passo, em `project-state.md`. Engenheiro deixou o diagnóstico aqui; registro de backlog/estado fica para o turno de fechamento da fatia.

---

## 2026-06-23 — Implementação REV-025 + REV-026

**Executor:** OpenCode (DeepSeek-v4-pro)
**Escopo:** Corrigir confidence NUMERIC string→number + textarea/banners theme tokens

### REV-025 — confidence string→number

**Fix dupla camada (backend + frontend):**

- **Backend** (`adminImportInbox.ts`):
  - Helper `toNumberOrNull(v)` no topo — coage `unknown` para `number | null`
  - Aplicado nos 4 pontos de serialização:
    1. `POST /import-text`: draft existente (linha 116) e draft criado (linha 188)
    2. `GET /drafts`: `row.confidence` no map (linha 246)
    3. `GET /drafts/:id`: `res.json` com `confidence: toNumberOrNull(row.confidence)`
    4. `PATCH /drafts/:id`: objeto do `returningAll()` com coação

- **Frontend** (`inboxApi.ts`):
  - 3 schemas de confidence trocados de `z.number().nullable()` para `z.coerce.number().nullable()`:
    - `inboxImportDraftSchema`
    - `inboxDraftSummarySchema`
    - `inboxDraftSchema`

**Por que dupla camada:** `z.coerce.number()` absorve qualquer string residual que endpoint futuro ou outro consumidor do backend produza, sem necessidade de caçar cada call-site.

### REV-026 — Textarea + banners theme tokens

- **Textarea** (`TextPasteArea.tsx:76`):
  - `bg-[var(--artificio-surface)]` → `bg-[var(--surface)]` (token semântico que troca entre claro/escuro)
  - `text-[var(--artificio-fg)]` → `text-[var(--fg)]` (idem)
  - `border-[var(--artificio-border)]` → `border-[var(--line)]` (token semântico de borda)
  - `placeholder:text-[var(--artificio-muted)]` → `placeholder:text-[var(--fg-muted)]`

- **Banners de status** (linhas 107, 117, 128):
  - `bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200` → `bg-[var(--state-success-bg)] border-[var(--state-success-line)] text-[var(--state-success-fg)]`
  - `bg-amber-...` → `bg-[var(--state-warning-bg)] border-[var(--state-warning-line)] text-[var(--state-warning-fg)]`
  - `bg-red-...` → `bg-[var(--state-danger-bg)] border-[var(--state-danger-line)] text-[var(--state-danger-fg)]`

Os tokens de estado (`--state-*-bg/line/fg`) existem em ambos os temas no `packages/ui/styles.css` e garantem contraste WCAG AA.

**Opção A da instrução (tokens de input pareados)** registrada como débito futuro — escopo maior que o necessário para destravar o smoke.

### Validação

- Backend: 21 files / 178 tests ✅
- Lint: 15/15 ✅
- Build: 17/17 ✅

### Status

| REV | Gravidade | Status |
|-----|-----------|--------|
| REV-025 | 🔴 | ✅ resolvido |
| REV-026 | 🟡 | ✅ resolvido |

