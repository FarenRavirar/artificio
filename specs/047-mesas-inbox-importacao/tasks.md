# Tasks — 047 Inbox de Importação de Mesas

> Tasks organizadas por fase. Cada task tem critério de conclusão verificável.
> **Regra:** não avançar para a próxima fase sem aprovação do mantenedor.

---

## Fase 0 — Auditoria de encaixe ✅ CONCLUÍDA

- [x] **T0.1** — Ler e mapear `parseDiscordAnnouncement.ts` (dependências de campos Discord)
  - **Evidência:** `parseDiscordAnnouncement.ts:396-499` — parser usa `content_raw`, `discord_thread_name`, `attachments`, `embeds`; campos Discord vão para `source` metadata
- [x] **T0.2** — Ler e mapear `normalizeDiscordTableDraft.ts` (reusabilidade)
  - **Evidência:** `normalizeDiscordTableDraft.ts:51-77` — aceita `DiscordTableDraft` genérico, não depende de campos Discord
- [x] **T0.3** — Ler e mapear `syncDiscordDraftToTable.ts` (pré-requisitos)
  - **Evidência:** `syncDiscordDraftToTable.ts:304-441` — exige `discord_import_messages` com `discord_message_id`; acoplamento inviabiliza reuso direto
  - **Correção (pós-auditoria):** spec.md §8 concluiu **Não** — inbox usará `syncImportDraftToTable` (nova função)
- [x] **T0.4** — Ler e mapear `adminDiscordSync.ts` (rotas existentes)
  - **Evidência:** `adminDiscordSync.ts:1147` — 1147 linhas, rotas REST completas; arquivo grande, melhor rota separada
- [x] **T0.5** — Mapear tipos (`types.ts`, `db/types.ts`)
  - **Evidência:** `DiscordRawMessage` definido em `discord/types.ts:88`; `DiscordImportSourceKind` em `types.ts:1`
- [x] **T0.6** — Mapear migrations (115, 116, 117, 118, 122)
  - **Evidência:** 5 migrations Discord, colunas NOT NULL em `source_id`, `discord_guild_id`, `discord_channel_id`
- [x] **T0.7** — Mapear frontend admin (`GestaoPage.tsx`, `features/discord-sync/`)
  - **Evidência:** `GestaoPage.tsx` com 6 abas; `DiscordDraftPreview.tsx` reutilizável; `DiscordDraftReviewTable.tsx` reutilizável
- [x] **T0.8** — Registrar diagnóstico completo em `spec.md` §Diagnóstico
- [x] **T0.9** — Criar `plan.md` com arquitetura, opções comparadas, decisão recomendada
- [x] **T0.10** — Criar `tasks.md` (este arquivo)

---

## Fase 0.5 — Pesquisa de ferramentas

> Objetivo: confirmar quais bibliotecas, schemas e ferramentas externas devem entrar no pipeline antes de começar a implementação. Esta fase não trava a Fase 1, mas deve ser concluída antes de decisões de arquitetura que dependam de bibliotecas externas.

- [ ] **T0.11** — Avaliar `dateparser` (Python) para datas humanas
  - Testar com datas em português: "sábado às 19h", "hoje às 20h", "quinzenal", "todo domingo"
  - Critério: matriz de 10 exemplos com resultado esperado vs real
  - Referência: https://dateparser.readthedocs.io/
- [ ] **T0.12** — Avaliar `RapidFuzz` (Python) para fuzzy match de sistemas
  - Testar contra base real de sistemas do mesas (via dump local)
  - Medir threshold ótimo (corte entre match e falso positivo)
  - Critério: matriz com precision/recall em 20 aliases
  - Referência: https://rapidfuzz.github.io/RapidFuzz/
- [ ] **T0.13** — Avaliar DeepSeek JSON Output / Tool Calls para extração estruturada
  - Testar com 10 anúncios reais: medir acerto, latência, custo
  - Verificar restrições de JSON Schema (modo strict) e comportamento com retorno vazio
  - Critério: relatório com taxa de acerto, falhas, custo estimado por anúncio
  - Referências: https://api-docs.deepseek.com/guides/json_mode, https://api-docs.deepseek.com/guides/tool_calls
- [ ] **T0.14** — Avaliar Playwright para smoke test da interface
  - Testar fluxo: login → /gestao → colar texto → ver draft criado
  - Critério: 1 teste E2E funcional (não suite completa)
  - Referência: https://playwright.dev/docs/best-practices
- [ ] **T0.15** — Avaliar DiscordChatExporter para export futuro (Fase 7)
  - Verificar compatibilidade com ToS do Discord (README alerta sobre user accounts)
  - Critério: decisão documentada de usar ou não; se sim, formato de saída compatível
  - Referência: https://github.com/Tyrrrz/DiscordChatExporter
- [ ] **T0.16** — Consolidar decisões da Fase 0.5
  - Documentar quais ferramentas entram, quais não, e por quê
  - Atualizar `plan.md` com bibliotecas aprovadas
  - Critério: seção "Ferramentas" no `plan.md` preenchida

---

## Fase 1 — MVP: Texto colado → Draft

### Fase B1 — revisão pré-deploy

- [x] Confirmar branch, diff e escopo.
- [x] Revisar guards, rota, tipos, adaptador, segmentador e migration.
- [x] Adicionar testes do adaptador e segmentador.
- [x] Corrigir split falso causado por linha `Sistema:`.
- [x] Adicionar constraint XOR de origem na migration local.
- [x] TypeScript, testes backend, build repo e `git diff --check` verdes.
- [ ] Resolver `DEB-047-09` e provar lint verde.
- [ ] Resolver `DEB-047-10` no beta com autorização nominal.
- [ ] Apresentar diff final e pedir autorização específica para commit.

> Débitos encontrados nesta fase: `debitos.md` DEB-047-09/10.

> **Status:** Backend 85% concluído. Frontend 0%. Infra: FASE A ✅, FASE B/C 🔜.

| Task | Escopo | Status |
|---|---|---|
| T1.1 | `'manual_paste'` no domínio | ✅ |
| T1.2 | Migration 128 | ✅ criada + aplicada no beta |
| T1.3 | Tipos Kysely | ✅ |
| T1.4 | Adaptador `textToRawMessage` | ✅ |
| T1.5 | Segmentador `segmentation` | ✅ |
| T1.6 | Rota `adminImportInbox` | ⚠️ PARCIAL — 2/3 endpoints |
| T1.7 | Registro em `server.ts` | ✅ |
| T1.18 | Guards anti-vazamento | ✅ |
| T1.19 | Migration no banco beta (FASE A) | ✅ |
| T1.20 | Deploy no beta (FASE B) | 🔜 |
| T1.13-17 | Smoke test manual | 🔜 bloqueado (FASE B) |
| T1.6 sync | `syncImportDraftToTable` | 🔜 |
| T1.8-12 | Frontend UI | 🔜 |
| — | Revert `db/types.ts` | ✅ (correção pós-execução) |
| — | Branch `feat/mesas-047-inbox-importacao` | ✅ |

### 1.1 — Preparação (schema + tipos)

- [x] **T1.1** — Adicionar `'manual_paste'` ao tipo `DiscordImportSourceKind`
  - Arquivo: `apps/mesas/backend/src/discord/types.ts:1`
  - De: `export type DiscordImportSourceKind = 'discord_bot' | 'discord_chat_exporter_json';`
  - Para: `export type DiscordImportSourceKind = 'discord_bot' | 'discord_chat_exporter_json' | 'manual_paste';`
  - **Critério:** `tsc --noEmit` sem erros em `apps/mesas/backend`
  - ✅ **EXECUTADO (2026-06-22):** `discord/types.ts:1` (domínio). `db/types.ts:579` foi revertido após auditoria — `'manual_paste'` não pertence ao DB type (Opção C isola inbox em `import_messages`). `ingestMessages.ts:88,260` usa type assertion para estreitar no ponto de insert.

  **🔍 INVESTIGAÇÃO (2026-06-22):**

  **Achado 1 — Tipo duplicado em 3 arquivos.** `DiscordImportSourceKind` é definido independentemente em:
  - `apps/mesas/backend/src/discord/types.ts:1` (domínio)
  - `apps/mesas/backend/src/db/types.ts:579` (DB/Kysely)
  - `apps/mesas/frontend/src/features/discord-sync/types.ts:1` (frontend)

  Nenhum importa do outro — cada arquivo tem sua própria definição. Se `'manual_paste'` só for adicionado em `discord/types.ts`, os outros dois ficam dessincronizados.

  **Achado 2 — `db/types.ts:579` NÃO precisa de `'manual_paste'` em teoria (Option C isola).** Na prática, `ingestMessages.ts:260` constrói inserts com o tipo de domínio (`discord/types.ts`), e o Kysely valida contra `db/types.ts:579`. A divergência quebrou `tsc`. **Corrigido na execução:** inicialmente `db/types.ts:579` recebeu `'manual_paste'`, mas foi **revertido** (2026-06-22). A solução final usa type assertion em `ingestMessages.ts:88,260` (`source_kind: sourceKind as 'discord_bot' | 'discord_chat_exporter_json'`). O DB type permanece semanticamente correto — `discord_import_messages.source_kind` nunca receberá `'manual_paste'`.

  **Achado 3 — Frontend Zod schema é um BLOQUEIO latent.** `apps/mesas/frontend/src/features/discord-sync/api/discordSyncApi.ts:113`:
  ```ts
  source_kind: z.enum(['discord_bot', 'discord_chat_exporter_json']),
  ```
  Este schema valida respostas da API de listagem de mensagens do painel Discord. Se uma mensagem com `source_kind: 'manual_paste'` passar por este endpoint, o Zod rejeita. **Com Option C isso não acontece** (tabela separada = API separada), mas o frontend `types.ts` ficaria dessincronizado do backend.

  **Achado 4 — Banco NÃO tem CHECK constraint.** `migration_115_discord_import.sql:44`: `source_kind TEXT NOT NULL DEFAULT 'discord_bot'` — tipo TEXT puro, aceita qualquer string. Nenhuma migration necessária para o novo valor.

  **Achado 5 — Sem switch/case exaustivo.** Nenhum código faz `switch(source_kind)` ou `if/else` exaustivo sobre os valores. Funções `ingestMessages`/`ingestForumMessages` usam `sourceKind` apenas como parâmetro com default `'discord_bot'`, sem branching condicional.

  **Achado 6 — `source_kind` NÃO vai para o draft.** `parseDiscordAnnouncement.ts:487-499` — o campo `source_kind` do `DiscordRawMessage` NÃO é copiado para `DiscordTableDraft.source` (que só tem `guild_id`, `channel_id`, `message_id`, `message_url`, `author_id`, `author_name`). Portanto o valor `'manual_paste'` não "vaza" para a tabela de drafts via JSONB.

  **Conclusão:** T1.1 `PROCEDE` com escopo reduzido.
  - **Alterado:** `apps/mesas/backend/src/discord/types.ts:1`
  - **NÃO alterar no DB type:** `db/types.ts:579` — revertido (2026-06-22). `'manual_paste'` não pertence ao tipo de `discord_import_messages.source_kind`. `ingestMessages.ts:88,260` estreita o tipo via assertion.
  - **NÃO alterar:** `frontend/.../types.ts:1` (API separada isola), `frontend/.../discordSyncApi.ts:113` (API separada isola)
  - **Risco:** BAIXO — union type expansion no domínio, sem breaking change. Nenhum código consome o tipo de forma exaustiva.
  - **Débito registrado:** Duplicação do tipo em 3 arquivos é DRY violation (DEB-047-04, ver `debitos.md`).

- [x] **T1.2** — Criar migration `migration_128_import_messages.sql`
  - ✅ **EXECUTADO (2026-06-22):** migration criada com headers padrão, CREATE TABLE + ALTER TABLE + 4 índices + DO $$ validação
  - Arquivo: `apps/mesas/database/migration_128_import_messages.sql`
  - Cria tabela `import_messages`:
    ```sql
    CREATE TABLE import_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_type TEXT NOT NULL DEFAULT 'manual_paste',
      raw_text TEXT,
      content_raw TEXT NOT NULL,
      thread_name TEXT,
      metadata JSONB DEFAULT '{}',
      content_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      parse_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ```
  - ALTER TABLE `discord_import_table_drafts`:
    ```sql
    ALTER TABLE discord_import_table_drafts
      ADD COLUMN import_message_id UUID REFERENCES import_messages(id) ON DELETE CASCADE;
    ```
    ```sql
    ALTER TABLE discord_import_table_drafts
      ALTER COLUMN discord_message_id DROP NOT NULL;
    ```
  - **Critério:** SQL válido, migration numerada corretamente, headers `@class`/`@requires-backup` conforme padrão do monorepo

  **🔍 INVESTIGAÇÃO (2026-06-22):**

  **Achado 1 — `migration_128` livre.** Última migration: `migration_127_table_archiving.sql`. Sem colisão.

  **Achado 2 — Convenção de headers.** Runner (`apply_required_migrations.sh`) exige 5 campos no cabeçalho:
  - `@class:` — `online-safe` (CREATE TABLE + ALTER TABLE sem DROP/TRUNCATE/DELETE) ou `manual-risk`
  - `@requires-backup:` — `false` (migration aditiva, não destrutiva)
  - `@author:` — identificador (ex: `spec-047`)
  - `@created:` — data ISO (ex: `2026-06-22`)
  - `@description:` — descrição curta
  - Ref: `lib_migrations.sh:10-49` (parse_header), `lib_migrations.sh:52-67` (validate_sql_against_class)
  - Exemplo canônico: `migration_127_table_archiving.sql` (headers + BEGIN/COMMIT + DO $$ validação)

  **Achado 3 — `discord_message_id` PRECISA virar nullable.** A spec T1.2 original omitia este ALTER.
  - Schema atual: `discord_message_id UUID NOT NULL REFERENCES discord_import_messages(id) ON DELETE CASCADE` (`migration_115:64`)
  - Se mantido NOT NULL: drafts de inbox (sem mensagem Discord) NÃO podem ser inseridos
  - Veredito: **DEVE** incluir `ALTER COLUMN discord_message_id DROP NOT NULL`
  - O `ON DELETE CASCADE` continua válido — se `discord_message_id IS NULL`, não há cascade risk

  **Achado 4 — Índices ausentes na spec.** A tabela `import_messages` precisa de:
  ```sql
  CREATE INDEX idx_import_messages_status ON import_messages(status);
  CREATE INDEX idx_import_messages_source_type ON import_messages(source_type);
  CREATE INDEX idx_import_messages_content_hash ON import_messages(content_hash);
  ```
  E o novo FK precisa de índice:
  ```sql
  CREATE INDEX idx_discord_import_table_drafts_import_message_id ON discord_import_table_drafts(import_message_id);
  ```

  **Achado 5 — Impacto em queries existentes.** Funções que acessam `draft.discord_message_id`:
  | Arquivo:linha | Operação | Comportamento com NULL |
  |---|---|---|
  | `syncDiscordDraftToTable.ts:322` | `SELECT ... WHERE id = draft.discord_message_id` | NULL ≠ UUID → 0 rows → `throw Error("não encontrada")` |
  | `adminDiscordSync.ts:1185` | idem (reparse) | idem |
  | `adminDiscordSync.ts:245,751,1105` | `WHERE discord_message_id = message.id` | message.id nunca é NULL → seguro |
  - **Mitigação:** Inbox drafts NÃO passam pelo Discord admin panel (API separada). Rotas `/reparse` e `/sync` do Discord precisam de guard: `if (!draft.discord_message_id) return 422`.

  **Achado 6 — GET /drafts retorna TODOS os drafts (Discord + inbox).**
  - `adminDiscordSync.ts:914-937` — `SELECT * FROM discord_import_table_drafts` sem join com messages
  - Inbox drafts apareceriam misturados. **Solução:** adicionar filtro `WHERE discord_message_id IS NOT NULL` por padrão no painel Discord (ou novo query param `origin=discord|inbox`).

  **Achado 7 — Runner compatível sem alterações.** `list_pending_by_set_diff` (`lib_migrations.sh:77`) faz `find ... -name "migration_*.sql" | sort` e compara com `schema_migrations`. Novo arquivo `migration_128_*.sql` é auto-detectado.

  **Achado 8 — Validação.** Convenção é incluir bloco `DO $$ ... END $$` que verifica via `information_schema` se colunas/tabelas foram criadas e emite `RAISE NOTICE` (sucesso) ou `RAISE EXCEPTION` (falha). Exemplo canônico: `migration_122_discord_image_upload_status.sql:17-52`.

  **Conclusão:** T1.2 `PROCEDE` com escopo ampliado.
  - **Alterações em relação à spec original:**
    1. + `ALTER COLUMN discord_message_id DROP NOT NULL` (necessário para Option C)
    2. + 3 índices em `import_messages`
    3. + 1 índice em `discord_import_table_drafts.import_message_id`
    4. + Bloco DO $$ de validação
  - **Risco:** BAIXO. Migration `online-safe` (aditiva, sem DROP/TRUNCATE/DELETE). Runner aplica automaticamente.
  - **Mesmo sem o ALTER de `discord_message_id`, o CREATE TABLE pode ser aplicado sem quebrar nada** (tabela nova, zero rows, sem queries que a referenciem).
  - **Débito registrado:** T1.2 original omitia DROP NOT NULL e índices (gap corrigido nesta investigação).
  - **FASE A (2026-06-22):** Migration aplicada no banco beta (`mesas-beta-db` / `mesas_rpg`). Backup em `/tmp/spec047-backup/`. Registro idempotente em `schema_migrations`. Ver `reviews.md`.

- [x] **T1.3** — Adicionar tipos Kysely para `import_messages` em `db/types.ts`
  - ✅ **EXECUTADO (2026-06-22):** `ImportMessagesTable` + type aliases + `Database` + `DiscordImportTableDraftsTable` alterado (`discord_message_id: string | null`, `import_message_id: string | null`)
  - Interface `ImportMessagesTable`, type aliases `ImportMessage`, `NewImportMessage`, `ImportMessageUpdate`
  - Registrar tabela no interface `Database`
  - **Critério:** `tsc --noEmit` sem erros

  **🔍 INVESTIGAÇÃO (2026-06-22):**

  **Achado 1 — Padrão de tipos Kysely confirmado.** Estrutura em `db/types.ts`:
  ```ts
  // Migration XXX: descrição
  export interface NomeTabelaTable {
    id: Generated<string>;                          // UUID com DEFAULT
    col_text_not_null: string;                      // TEXT NOT NULL
    col_text_null: string | null;                   // TEXT (nullable)
    col_jsonb_default: Generated<unknown>;          // JSONB com DEFAULT
    col_with_default: Generated<string>;            // TEXT com DEFAULT
    col_timestamp: Generated<Date>;                 // TIMESTAMPTZ DEFAULT NOW()
    col_enum: Generated<SomeEnumType>;              // TEXT com DEFAULT + type alias
  }
  export type NomeTabela = Selectable<NomeTabelaTable>;
  export type NewNomeTabela = Insertable<NomeTabelaTable>;
  export type NomeTabelaUpdate = Updateable<NomeTabelaTable>;
  ```
  Ref: `DiscordImportMessagesTable` (`db/types.ts:609-636`), `DiscordImportTableDraftsTable` (`638-657`).

  **Achado 2 — `Generated<T>` resolve corretamente.** Kysely desembrulha `Generated<T>` → `T` no `Selectable`, torna opcional no `Insertable`, e mantém opcional no `Updateable`. Colunas com DEFAULT no SQL devem usar `Generated<T>`.

  **Achado 3 — Mapeamento coluna→tipo para `import_messages`:**

  | Coluna SQL | Kysely | Justificativa |
  |---|---|---|
  | `id UUID PK DEFAULT gen_random_uuid()` | `Generated<string>` | UUID auto-generado |
  | `source_type TEXT NOT NULL DEFAULT 'manual_paste'` | `Generated<string>` | DEFAULT presente |
  | `raw_text TEXT` | `string \| null` | TEXT sem NOT NULL nem DEFAULT |
  | `content_raw TEXT NOT NULL` | `string` | TEXT NOT NULL sem DEFAULT |
  | `thread_name TEXT` | `string \| null` | TEXT sem NOT NULL |
  | `metadata JSONB DEFAULT '{}'` | `Generated<unknown>` | JSONB com DEFAULT (padrão: `DiscordImportMessagesTable.attachments:631`) |
  | `content_hash TEXT NOT NULL` | `string` | TEXT NOT NULL, preenchido via código |
  | `status TEXT NOT NULL DEFAULT 'pending'` | `Generated<string>` | DEFAULT presente |
  | `parse_error TEXT` | `string \| null` | TEXT sem NOT NULL |
  | `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` | `Generated<Date>` | Timestamp auto |
  | `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` | `Generated<Date>` | Timestamp auto |

  **Achado 4 — `Database` interface.** Registrar nova tabela no interface `Database` (`db/types.ts:673-727`):
  ```ts
  // Migration 128: Inbox de importação de mesas
  import_messages: ImportMessagesTable;
  ```
  A interface é consumida por `db/index.ts:3` e `db/prod.ts:3` via `import { Database } from './types'`.

  **Achado 5 — Alteração colateral em `DiscordImportTableDraftsTable`.** A migration T1.2 vai:
  - `discord_message_id: string` **(linha 640)** → precisa virar `string | null` (DROP NOT NULL)
  - Adicionar `import_message_id: string | null` (nova coluna FK)

  **A T1.3 deve incluir essas 2 alterações**, caso contrário `tsc` quebra:
  - Sem DROP NOT NULL: Insert de inbox draft falha no tipo (tenta inserir `null` em campo `string`)
  - Sem `import_message_id`: Kysely não reconhece a nova coluna

  **Achado 6 — Impacto TypeScript do DROP NOT NULL.** Kysely `.where('id', '=', draft.discord_message_id)` aceita `string | null` (ReferenceExpression inclui null). Não quebra `tsc`. Mas runtime: valor null → 0 rows → erro "não encontrado" (`syncDiscordDraftToTable.ts:322`, `adminDiscordSync.ts:1185`, `adminDiscordSync.ts:322`). Já coberto por DEB-047-05.

  **Achado 7 — Frontend NÃO precisa de tipos neste estágio.** T1.8 (inboxApi.ts) terá seus próprios tipos Zod. Nenhum consumo frontend dos tipos Kysely.

  **Conclusão:** T1.3 `PROCEDE` com escopo ampliado.
  - **Alterações em `db/types.ts`:**
    1. NOVO: `ImportMessagesTable` interface (11 colunas)
    2. NOVO: `ImportMessage`, `NewImportMessage`, `ImportMessageUpdate` type aliases
    3. NOVO: registro `import_messages: ImportMessagesTable` no `Database`
    4. ALTERAR: `discord_message_id: string` → `string | null` em `DiscordImportTableDraftsTable:640`
    5. NOVO: `import_message_id: string | null` em `DiscordImportTableDraftsTable`
    6. NOVO: section header `// Migration 128: Inbox de importação de mesas`
  - **Risco:** BAIXO. Tipos aditivos. Alteração #4 é backward-compatible (expandir `string` → `string | null` é seguro; Kysely aceita null em wheres).
  - **Débito:** Se T1.2 rodar antes de T1.3, `tsc` quebrará temporariamente (colunas no DB que o TypeScript não conhece). Executar T1.3 ANTES ou JUNTO com T1.2.

### 1.2 — Backend: adaptador + rota

- [x] **T1.4** — Criar adaptador `textToRawMessage.ts`
  - ✅ **EXECUTADO (2026-06-22):** `apps/mesas/backend/src/inbox/adapters/textToRawMessage.ts` — função pura, ~15 linhas
  - Arquivo: `apps/mesas/backend/src/inbox/adapters/textToRawMessage.ts`
  - Função: `textToRawMessage(rawText: string, threadName?: string): DiscordRawMessage`
  - Preenche campos obrigatórios com valores sintéticos (UUID para message_id, strings vazias para guild/channel)
  - **Critério:** `tsc --noEmit` sem erros; testes unitários opcionais nesta fase

  **🔍 INVESTIGAÇÃO (2026-06-22):**

  **Achado 1 — Mapeamento campo-a-campo.** O parser (`parseDiscordAnnouncement.ts:396-500`) consome cada campo assim:
  | Campo | Usado para | Valor adaptador |
  |---|---|---|
  | `content_raw` | CORPO do texto (linha 401). Retorna `null` se vazio (408). | **texto colado** (essencial) |
  | `discord_thread_name` | Hint de título/sistema (linha 400, 414). | `threadName` opcional ou string vazia |
  | `attachments` | Extração de capa (`extractCoverFromAttachments`, linha 447). | `[]` |
  | `embeds` | Fallback de conteúdo (`extractBodyFromEmbeds`, linha 403). | `[]` |
  | `discord_guild_id` | `source.guild_id` (linha 489). Metadata, não afeta parsing. | `''` |
  | `discord_channel_id` | `source.channel_id` (linha 490). Metadata. | `''` |
  | `discord_message_id` | `source.message_id` (linha 491). Metadata. | `crypto.randomUUID()` |
  | `discord_message_url` | `source.message_url` (linha 492). Vira `source_url` em `tables` (`syncDiscordDraftToTable.ts:154`). | `null` |
  | `discord_author_id` | `source.author_id` (linha 493). Metadata. | `null` |
  | `discord_author_name` | `source.author_name` (linha 494). Vira `actual_gm_name` (`syncDiscordDraftToTable.ts:150`). | `null` |
  | `discord_parent_channel_id` + `discord_thread_id` | NÃO usados pelo parser. | `null` |
  | `message_created_at` / `message_edited_at` | NÃO usados pelo parser. | `new Date()` / `null` |
  | `source_kind` | NÃO usado pelo parser. Só armazenado em coluna DB. | `'manual_paste'` (depende de T1.1) |

  **Achado 2 — `crypto.randomUUID()` disponível.** Node 18+ (requisito Express 5). Já usado em `middleware/csrfProtection.ts:17`. Padrão: `import crypto from 'node:crypto'` (preferido) ou `import crypto from 'crypto'`.

  **Achado 3 — Dependência de T1.1.** `source_kind` precisa do literal `'manual_paste'`, que só existe após T1.1 adicioná-lo ao union type `DiscordImportSourceKind`. **T1.4 depende de T1.1 concluída.**

  **Achado 4 — Sanitização.** `content_raw` é usado apenas para parsing (não para renderização HTML). `parseDiscordAnnouncement:401` já faz `content_raw ?? ''` com null-safe. O único risco é texto marcadamente malicioso causar parse incorreto (ex: injeção de campos falsos) — mitigado pelo score/confiança e revisão humana obrigatória.

  **Achado 5 — Test helper como referência.** `makeMessage()` no arquivo de teste (`parseDiscordAnnouncement.test.ts:5-24`) é o padrão de construção de `DiscordRawMessage` existente. Usa strings simples (`'1000'`) como IDs, não UUIDs.

  **Achado 6 — Formato UUID vs string simples.** O parser não valida formato de `discord_message_id`. Ele é armazenado em `source.message_id` (string) e `discord_import_messages.discord_message_id` (UNIQUE constraint com `discord_channel_id`). Como usamos tabela `import_messages` separada (Opção C), não há constraint atingida. UUID ou string simples — ambos funcionam. Recomendação: `crypto.randomUUID()` para unicidade forte.

  **Conclusão:** T1.4 `PROCEDE` conforme especificado. Função ~15 linhas.
  - **Entrada:** `rawText: string` + `threadName?: string`
  - **Saída:** `DiscordRawMessage` com 15 campos preenchidos
  - **Pré-requisitos:** T1.1 (`'manual_paste'` no union type) + diretório `inbox/adapters/` criado
  - **Risco:** MUITO BAIXO. Função pura, sem I/O, sem dependências externas além de `node:crypto`.

- [x] **T1.5** — Criar segmentador `segmentation.ts`
  - ✅ **EXECUTADO (2026-06-22):** `apps/mesas/backend/src/inbox/segmentation.ts` — 3 estratégias, ~30 linhas
  - Arquivo: `apps/mesas/backend/src/inbox/segmentation.ts`
  - Função: `segmentAnnouncements(rawText: string): string[]`
  - Heurísticas: separadores explícitos (`---`, `===`), blocos por header (`Sistema:`, `Mesa:`, `Título:`), fallback único
  - **Critério:** função exportada; cobre pelo menos 3 estratégias de segmentação

  **🔍 INVESTIGAÇÃO (2026-06-22):**

  **Achado 1 — `parseDiscordAnnouncement` processa UM anúncio por chamada.** O parser (`parseDiscordAnnouncement.ts:396-500`) extrai campos de um único bloco de texto. Não faz segmentação. Cada chamada → 1 draft (ou null se texto vazio). O segmentador será invocado ANTES do parser, e cada segmento será passado individualmente via `textToRawMessage()` (T1.4).

  **Achado 2 — Nenhum segmentador existente.** Zero resultados para `segment`, `splitAnnounce`, `textToBlocks` em todo `apps/mesas/backend/src`. Função nova, sem padrão a seguir.

  **Achado 3 — Corpus de anúncios reais (dos testes).** Os testes `parseDiscordAnnouncement.test.ts:93-108` usam anúncios no formato label:value:
  ```
  Sistema: Dungeons & Dragons
  Mesa: A Torre dos Tres Sabores
  Tipo: Campanha
  Modalidade: Online
  Preco: R$ 25
  Vagas: 4
  Dia: sexta
  Horario: 20:00
  Contato: https://forms.gle/example
  Descricao: Uma aventura culinaria...
  ```
  Este é o formato típico do Covil do Lich (e de servidores de RPG em geral).

  **Achado 4 — Risco de falsos positivos na segmentação.** Três cenários de risco:

  | Risco | Exemplo | Severidade | Mitigação |
  |---|---|---|---|
  | Separador no meio da descrição | `Descrição: Parte 1 --- Parte 2` → falso split | **ALTA** | Regex com `\n` antes e depois: `/\n\s*[-=*]{3,}\s*\n/` |
  | Header label no corpo do texto | `Descrição: Usamos o sistema de honra...` → "sistema de honra" detectado como novo header | **MÉDIA** | Exigir que o header esteja no início da linha E seguido por valor curto (não sentença longa) |
  | Texto livre sem estrutura | Parágrafo sem labels → segmentação produz 1 bloco gigante | **BAIXA** | Fallback já é o texto completo; não há "falso split", só "não splitou" |

  **Achado 5 — Estratégia 1 (separadores) é a mais segura.** Separadores explícitos (`---`, `===`, `***`) são usados INTENCIONALMENTE para dividir posts. Regex `/\n\s*[-=*]{3,}\s*\n/` com exigência de quebra de linha antes e depois reduz falsos positivos a quase zero. Nenhum anúncio real do corpus de teste contém `---` inline.

  **Achado 6 — Estratégia 2 (header labels) tem risco moderado.** Regex `/\n(?=(?:Sistema|Mesa|Jogo|T[ií]tulo|Aventura)\s*[:：])/i` pode capturar menções acidentais. Exigir que o header esteja precedido por `\n\n` (linha em branco) ou `\n` E que o valor após `:` seja curto (< 80 chars) reduz falsos positivos. Documentar como "melhor esforço" (best-effort), com fallback para revisão humana.

  **Achado 7 — Fluxo downstream.** O endpoint `POST /import-text` (T1.6) vai:
  1. Chamar `segmentAnnouncements(text)` → `string[]`
  2. Para cada segmento: `textToRawMessage()` → `parseDiscordAnnouncement()` → `normalizeDiscordTableDraft()` → persistir
  3. Retornar array de drafts criados com contagem de segmentos

  **Conclusão:** T1.5 `PROCEDE` conforme especificado. Função pura, ~30 linhas.
  - **3 estratégias**, ordenadas por segurança (separador → header → fallback)
  - **Cada estratégia só avança se a anterior não produziu múltiplos segmentos**
  - **Mínimo 10 caracteres por segmento** para evitar lixo
  - **Trim + filtro de vazios** em cada segmento
  - **Risco:** BAIXO para estratégia 1 (separadores), MÉDIO para estratégia 2 (headers). Ambos mitigáveis.
  - **Débito registrado:** Se falso split ocorrer, admin pode colar 1 anúncio por vez (workaround trivial). Melhorias de segmentação → Fase 2 (normalização melhorada).

- [x] **T1.6** — Criar rota `adminImportInbox.ts` (PARCIAL)
  - ✅ **PARCIAL (2026-06-22):** `POST /import-text` + `GET /drafts` implementados. `POST /drafts/:id/sync` pendente — depende de `syncImportDraftToTable` (função ~130 linhas, similar a `syncDiscordDraftToTable`). `loadSystemsForParser` duplicada (~25 linhas) — extração para módulo compartilhado fica para Fase 7.
  - Arquivo: `apps/mesas/backend/src/routes/adminImportInbox.ts`
  - Endpoints:
    - `POST /import-text` — ✅ recebe `{ text, title_hint? }`, segmenta, cria `DiscordRawMessage`, parseia, normaliza, persiste em `import_messages` + `discord_import_table_drafts`
    - `GET /drafts` — ✅ lista drafts com query params `status`, `limit`, `offset`
    - `POST /drafts/:id/sync` — ❌ pendente (syncImportDraftToTable)
  - **Critério:** 2 de 3 endpoints funcionais; auth middleware + admin check; validação Zod nos inputs

- [x] **T1.7** — Registrar rota no server principal
  - ✅ **EXECUTADO (2026-06-22):** `server.ts` +2 linhas (import + `app.use('/api/v1/admin/inbox', adminInboxRoutes)`)
  - Arquivo: `apps/mesas/backend/src/server.ts`
  - Adicionar: `import adminInboxRoutes from './routes/adminImportInbox'` + `app.use('/api/v1/admin/inbox', adminInboxRoutes)`
  - **Critério:** rota acessível; `tsc --noEmit` sem erros

  **🔍 INVESTIGAÇÃO (2026-06-22) — T1.6 e T1.7 investigadas juntas por acoplamento direto:**

  **Achado 1 — Padrão de rotas admin no mesas.** Toda rota admin segue este template:
  ```ts
  import { Router, Request, Response } from 'express';
  import { z } from 'zod';
  import { db } from '../db';
  import { authMiddleware } from '../middleware/auth';
  // ...outros imports...
  const router = Router();
  // schemas Zod
  // helper isAdmin() ou requireRole('admin')
  // router.METHOD('/path', authMiddleware, async (req, res) => { ... })
  // res.json({ data: ... }) ou res.status(4xx).json({ error: '...' })
  export default router;
  ```
  Ref: `adminDiscordSync.ts:13-1147` (1147 linhas), `adminTables.ts:9-137`, `adminHydration.ts:35-489`.

  **Achado 2 — Registro no `server.ts` é 2 linhas.** Padrão:
  ```ts
  import adminDiscordSyncRoutes from './routes/adminDiscordSync';  // linha 29
  app.use('/api/v1/admin/discord-sync', adminDiscordSyncRoutes);    // linha 126
  ```
  Para o inbox (seguindo o padrão existente):
  ```ts
  import adminInboxRoutes from './routes/adminImportInbox';           // após linha 29
  app.use('/api/v1/admin/inbox', adminInboxRoutes);                  // após linha 127
  ```
  Ref: `server.ts:110-139`.

  **Achado 3 — T1.6 tem 5 pré-requisitos.** A rota integra todas as peças criadas em T1.1-T1.5:
  | Dependência | Artefato | Função |
  |---|---|---|
  | T1.1 | `'manual_paste'` em `DiscordImportSourceKind` | `textToRawMessage` compila |
  | T1.2 | Tabelas `import_messages` + `discord_import_table_drafts.import_message_id` | Persistência |
  | T1.3 | Tipos Kysely `ImportMessagesTable`, `ImportMessage`, etc. | `db.insertInto('import_messages')` compila |
  | T1.4 | `textToRawMessage()` | Texto → `DiscordRawMessage` |
  | T1.5 | `segmentAnnouncements()` | Texto bruto → `string[]` |

  **Achado 4 — `loadSystemsForParser()` precisa ser acessível.** A função existe em `adminDiscordSync.ts:126-149` mas não é exportada. Opções:
  - **A) Extrair para módulo compartilhado** (ex: `discord/systemLoader.ts`): melhor arquitetura, mas +1 arquivo. Refatoração segura (a função é pura, só faz SELECT).
  - **B) Duplicar em `adminImportInbox.ts`**: ~25 linhas, simples, sem risco de quebrar Discord. Aceitável para MVP.
  - **C) Tornar exportável no `adminDiscordSync.ts`**: polui o contrato da rota.
  - **Recomendação:** Opção A para qualidade, Opção B para velocidade (MVP).

  **Achado 5 — `syncImportDraftToTable` precisa ser criada.** `syncDiscordDraftToTable.ts:304-441` (138 linhas) é acoplada a `discord_import_messages`. A versão inbox difere em:
  | Linha | Discord | Inbox |
  |---|---|---|
  | 319-323 | `SELECT FROM discord_import_messages WHERE id = draft.discord_message_id` | `SELECT FROM import_messages WHERE id = draft.import_message_id` |
  | 342-346 | Idempotência por `source_id = message.discord_message_id` | Idempotência por `source_id = import_message.id` |
  | 154 | `source_url: message.discord_message_url` | `source_url: null` (ou metadata.source_url) |
  | 150, 375 | `actual_gm_name: draft.source.author_name` | `actual_gm_name: adminUser.displayName` (admin que fez sync) |
  | 429-433 | Atualiza `discord_import_messages.status = 'synced'` | Atualiza `import_messages.status = 'synced'` |
  - **Recomendação:** Criar `apps/mesas/backend/src/inbox/syncImportDraftToTable.ts` como função separada, ~130 linhas. Extrair helpers comuns (`extractContacts`, `extractSchedules`, `validateDraftForSync`, `buildTableData`) para módulo compartilhado no futuro (Fase 7).

  **Achado 6 — Content hash: sha256 de `content_raw`.** Padrão existente em `ingestMessages.ts:170-177`:
  ```ts
  crypto.createHash('sha256').update(content).digest('hex')
  ```
  Para inbox: `crypto.createHash('sha256').update(content_raw).digest('hex')`.

  **Achado 7 — `req.user?.userId` disponível.** Todas as rotas autenticadas têm acesso a `req.user` (definido por `authMiddleware`). Campos: `userId`, `role`, `displayName` (provavelmente). O admin que faz sync pode ser registrado como autor da operação.

  **Achado 8 — Escopo dos 3 endpoints:**

  | Endpoint | Descrição | Complexidade |
  |---|---|---|
  | `POST /import-text` | Zod(`{text, title_hint?}`) → `segmentAnnouncements` → `textToRawMessage` → `parseDiscordAnnouncement` → `normalizeDiscordTableDraft` → INSERT em `import_messages` + `discord_import_table_drafts` → retorna drafts criados | **ALTA** (~80 linhas) |
  | `GET /drafts` | Zod(query params) → SELECT `discord_import_table_drafts` JOIN `import_messages` WHERE `import_message_id IS NOT NULL` → retorna drafts com source_type | **BAIXA** (~30 linhas) |
  | `POST /drafts/:id/sync` | Zod(`{draftId}`) → `syncImportDraftToTable()` → retorna `{ tableId, created }` | **MÉDIA** (~40 linhas + `syncImportDraftToTable.ts` ~130 linhas) |

  **Conclusão:** T1.6+T1.7 `PROCEDEM` conforme especificado.
  - **T1.6:** 3 endpoints + 1 nova função `syncImportDraftToTable.ts`. ~250 linhas totais.
  - **T1.7:** 2 linhas em `server.ts` (import + `app.use`). Trivial.
  - **Pré-requisitos:** T1.1 a T1.5 executados.
  - **Risco:** MÉDIO. Muitas dependências encadeadas. Falha em qualquer pré-requisito = rota não compila.
  - **Ordem de execução:** T1.7 imediatamente após T1.6 (mesmo commit).

### 1.3 — Frontend: UI de colar + revisar

- [ ] **T1.8** — Criar API client `inboxApi.ts`
  - Arquivo: `apps/mesas/frontend/src/features/inbox/api/inboxApi.ts`
  - Funções: `importText(text, titleHint?)`, `listDrafts(params?)`, `syncDraft(draftId)`
  - Reutilizar padrão de `discordSyncApi.ts`
  - **Critério:** 3 funções tipadas; usa `apiClient` compartilhado

- [ ] **T1.9** — Criar `InboxPanel.tsx` (container principal)
  - Arquivo: `apps/mesas/frontend/src/features/inbox/components/InboxPanel.tsx`
  - Sub-abas: "Importar" (colar texto) e "Drafts" (revisar)
  - **Critério:** componente renderiza; integrado como aba na `/gestao`

- [ ] **T1.10** — Criar `TextPasteArea.tsx`
  - Arquivo: `apps/mesas/frontend/src/features/inbox/components/TextPasteArea.tsx`
  - Textarea grande, botão "Importar", feedback de resultado (quantos drafts criados)
  - **Critério:** colar texto → chamar API → mostrar resultado

- [ ] **T1.11** — Integrar aba "Inbox" no `GestaoPage.tsx`
  - Arquivo: `apps/mesas/frontend/src/pages/GestaoPage.tsx`
  - Adicionar 7ª aba: "Inbox" com `<InboxPanel />`
  - **Critério:** aba visível; navegação funcional

  **🔍 INVESTIGAÇÃO (2026-06-22) — T1.8 a T1.11 investigadas juntas:**

  **Achado 1 — Padrão de API client.** `discordSyncApi.ts` usa `fetch` direto com helper `apiFetch<T>` customizado. O arquivo compartilhado `apiClient.ts` (`services/apiClient.ts:93-190`) é mais robusto (retry, dedup, AbortController, toast automático), mas `discordSyncApi` NÃO o usa. Recomendação: seguir o padrão do `discordSyncApi` (fetch direto + `apiFetch`) para consistência com features admin vizinhas. Alternativa: usar `apiClient` diretamente (mais moderno). **Ambas aceitáveis.**

  **Achado 2 — BASE URL.** Seguindo o padrão:
  ```ts
  const API_BASE = import.meta.env.VITE_API_URL || '';
  const BASE = `${API_BASE}/api/v1/admin/inbox`;
  ```
  Ref: `discordSyncApi.ts:20` — `const BASE = \`${API_BASE}/api/v1/admin/discord-sync\`;`

  **Achado 3 — Zod no frontend.** O `discordSyncApi.ts:95-118` valida respostas da API com `z.object({...}).parse()` antes de retornar ao componente. Para o inbox, validar:
  - `importText` response: `z.object({ segments_found, drafts_created, drafts[] })`
  - `listDrafts` response: `z.object({ data: z.array(draftSchema) })`
  - `syncDraft` response: `z.object({ table_id, created })`

  **Achado 4 — Padrão de tabs no GestaoPage.** Estado `activeTab` como union type com 6 valores (linha 140). Cada aba é um `<button>` com `onClick={() => setActiveTab('...')}` + classe condicional (linhas 478-538). Conteúdo é `{activeTab === '...' && <Componente />}` (linhas 541-691).

  Para adicionar a 7ª aba "Inbox":
  ```tsx
  // Linha 140: adicionar 'inbox' ao union type
  const [activeTab, setActiveTab] = useState<'systems' | 'crud' | 'activity' | 'hydration' | 'discord' | 'inbox' | 'dev'>('crud');

  // Após linha 528 (botão "Discord Sync"): adicionar botão "Inbox"
  <button onClick={() => setActiveTab('inbox')} className={...}>
    Inbox
  </button>

  // Após linha 684 (conteúdo "discord"): adicionar conteúdo
  {activeTab === 'inbox' && <InboxPanel />}
  ```

  **Achado 5 — Padrão de sub-tabs do DiscordSyncPanel.** `DiscordSyncPanel.tsx:27,71-278` usa `tab` state com tipo `PanelTab` (4 valores). Sub-tabs renderizadas inline com `<button>` + classe condicional. Para o InboxPanel:
  ```tsx
  type InboxTab = 'importar' | 'drafts';
  const [tab, setTab] = useState<InboxTab>('importar');
  // 2 botões: "Importar" e "Drafts"
  // {tab === 'importar' && <TextPasteArea />}
  // {tab === 'drafts' && <DraftReviewTable />}
  ```

  **Achado 6 — TextPasteArea não existe.** Nenhum componente similar de textarea para colar texto grande no admin. Criar do zero. Componente simples:
  - `<textarea>` com placeholder descritivo, altura ~200px
  - Input opcional `title_hint` (texto curto, dica de título)
  - Botão "Importar Anúncios" com estado `loading`
  - Área de resultado: `✅ 3 drafts criados a partir de 3 segmentos` ou `⚠️ Nenhum anúncio reconhecido`
  - Usar `react-hot-toast` para erros (padrão já presente em `DiscordSyncPanel.tsx:2`)

  **Achado 7 — Estrutura do diretório `features/inbox/`.** Espelhar `features/discord-sync/`:
  ```
  features/inbox/
  ├── types.ts                 # Tipos frontend (ImportMessage, ImportDraft, InboxDraft)
  ├── api/
  │   └── inboxApi.ts          # API client (T1.8)
  └── components/
      ├── InboxPanel.tsx        # Container principal (T1.9)
      └── TextPasteArea.tsx     # Área de colar texto (T1.10)
  ```
  O `types.ts` define tipos Zod e TypeScript para as respostas da API. Padrão ref: `features/discord-sync/types.ts`.

  **Achado 8 — Dependências frontend.** T1.8 (API client) é pré-requisito para T1.9 e T1.10 (componentes chamam a API). T1.11 (integração no GestaoPage) é o último passo e depende de T1.9 (InboxPanel exportado).

  **Achado 9 — T1.12 (adaptar DiscordDraftPreview) NÃO está no escopo desta investigação.** A spec pede T1.8-T1.11 apenas. T1.12 fica para depois.

  **Conclusão:** T1.8-T1.11 `PROCEDEM` conforme especificado.
  - **T1.8:** ~50 linhas (3 funções + 3 schemas Zod), `features/inbox/api/inboxApi.ts`
  - **T1.9:** ~80 linhas (2 sub-tabs, state management), `features/inbox/components/InboxPanel.tsx`
  - **T1.10:** ~100 linhas (textarea, loading, result), `features/inbox/components/TextPasteArea.tsx`
  - **T1.11:** +5 linhas em `GestaoPage.tsx` (1 import + 1 botão + 1 conteúdo condicional)
  - **Risco:** BAIXO. Componentes isolados, sem alteração em código existente (exceto T1.11 que adiciona 1 aba).
  - **Ordem:** T1.8 → T1.9 e T1.10 (paralelo) → T1.11

- [ ] **T1.12** — Adaptar `DiscordDraftPreview` para drafts do inbox
  - Se necessário: prop `showDiscordMetadata?: boolean` (default true)
  - Quando origem é `manual_paste`, esconder campos Discord (guild, channel, message URL)
  - **Critério:** preview de draft funciona para ambas as origens

  **🔍 INVESTIGAÇÃO (2026-06-22):**

  **Achado 1 — `DiscordDraftPreview` NÃO renderiza metadados Discord no UI principal.** O componente (`DiscordDraftPreview.tsx:1-690`) é um modal de edição de campos de mesa (título, sistema, tipo, vagas, horário, preço, contato, capa, descrição). NENHUM desses campos é Discord-específico. Os metadados Discord (`guild_id`, `channel_id`, `message_id`, `message_url`, `author_id`, `author_name`) só aparecem no `parsed_payload.source` (aba "Bruto"/raw JSON). **A prop `showDiscordMetadata` sugerida na spec original é desnecessária — não há nada para esconder.**

  **Achado 2 — O problema REAL é o API client hardcoded.** O componente chama `discordSyncApi` diretamente em 5 pontos:
  | Linha | Chamada | Endpoint Discord |
  |---|---|---|
  | ~314 | `discordSyncApi.updateDraft(draft.id, ...)` | `PATCH /admin/discord-sync/drafts/:id` |
  | ~419 | `discordSyncApi.updateDraft(draft.id, ...)` | `PATCH /admin/discord-sync/drafts/:id` |
  | ~449 | `discordSyncApi.updateDraft(draft.id, ...)` | `PATCH /admin/discord-sync/drafts/:id` |
  | ~467 | `discordSyncApi.syncDraft(draft.id)` | `POST /admin/discord-sync/drafts/:id/sync` |
  | ~478 | `discordSyncApi.reparseDraft(draft.id)` | `POST /admin/discord-sync/drafts/:id/reparse` |

  Para drafts do inbox, estes endpoints NÃO funcionam (usam `discord_message_id` que é `NULL`). Precisam chamar os endpoints do inbox:
  - `PATCH /admin/inbox/drafts/:id` (atualizar campos)
  - `POST /admin/inbox/drafts/:id/sync` (sincronizar → mesa)
  - `POST /admin/inbox/drafts/:id/reparse` (reparsar do texto original)

  **Achado 3 — Tipo `DiscordDraft` precisa mudar.** A interface (`types.ts:121-131`):
  ```ts
  export interface DiscordDraft {
    discord_message_id: string;   // → precisa virar string | null
    // faltando: import_message_id?: string | null;
  }
  ```
  Com a migration T1.2, `discord_message_id` vira nullable. E `import_message_id` é a nova FK para inbox drafts.

  **Achado 4 — `DiscordDraftReviewTable` também precisa de adaptação.** O componente (`DiscordDraftReviewTable.tsx:1-197`) carrega drafts via `discordSyncApi.getDrafts()` (linha ~56). Para o inbox, precisa carregar via `inboxApi.listDrafts()`. A tabela de drafts do inbox (T1.9) deve usar seu próprio componente ou adaptar este.

  **Achado 5 — Estratégia de adaptação recomendada.** Em vez de modificar `DiscordDraftPreview` para suportar dual-origin (poluiria o componente), criar um **componente wrapper** ou adaptar via props:

  **Opção A (recomendada): Passar API client como prop.**
  ```tsx
  interface Props {
    draft: DiscordDraft;
    api: InboxApi | DiscordSyncApi;  // duck-typing: precisa de updateDraft, syncDraft, reparseDraft, getDraft
    onUpdate: (updated: DiscordDraft) => void;
    onClose: () => void;
  }
  ```
  `DiscordSyncPanel` passa `discordSyncApi`, `InboxPanel` passa `inboxApi`. O componente não sabe de onde veio — só chama os métodos.

  **Opção B: Detecção automática via `draft.import_message_id`.**
  ```tsx
  const isInbox = Boolean(draft.import_message_id);
  const api = isInbox ? inboxApi : discordSyncApi;
  ```
  Mais simples, mas acopla o componente aos dois APIs.

  **Conclusão:** T1.12 `PROCEDE` com escopo REVISADO.
  - **NÃO é sobre esconder metadados Discord** (não há nada para esconder no UI)
  - **É sobre roteamento de API** — para qual endpoint enviar update/sync/reparse
  - **Mudanças necessárias:**
    1. Tipo `DiscordDraft`: `discord_message_id: string | null`, adicionar `import_message_id?: string | null`
    2. `DiscordDraftPreview`: aceitar `api` como prop (Opção A) ou detectar automaticamente (Opção B)
    3. `DiscordDraftReviewTable`: aceitar `api` como prop ou delegar para `DiscordSyncPanel`/`InboxPanel`
    4. `InboxPanel` (T1.9): passar `inboxApi` ao invés de `discordSyncApi`
  - **Risco:** BAIXO (Opção A) / MÉDIO (Opção B). Opção A é mudança puramente aditiva no contrato de props.
  - **Depende de:** T1.8 (inboxApi.ts com métodos updateDraft, syncDraft, reparseDraft) + T1.9 (InboxPanel)

### 1.4 — Validação Fase 1

**Executado:**
- [x] **T1.18** — Verificar guards anti-vazamento (DEB-047-05)
  - ✅ **EXECUTADO (2026-06-22):** 5 guards em `adminDiscordSync.ts` (GET /drafts, GET /image-uploads/summary, POST reparse, POST sync, POST /sync-ready)
- [x] **T1.19** — Aplicar migration 128 no banco beta (FASE A)
  - ✅ **EXECUTADO (2026-06-22):** Migration aplicada em `mesas-beta-db` / `mesas_rpg`. Backup criado em `/tmp/spec047-backup/` + baixado localmente. Registro idempotente em `schema_migrations`. Todas as validações pós-migration passaram (ver reviews.md).

**Pendente / Bloqueado:**
- [ ] **T1.17** — Build + lint completos
  - `npx tsc --noEmit`: ✅ verde (backend mesas)
  - `cd apps/mesas && pnpm run build`: ❌ pendente (frontend não compila sem T1.8-T1.12)
  - `pnpm run lint` repo-wide: ❌ pendente (pré-existente em `packages/feedback/dist-cjs`, não relacionado)
- [ ] **T1.20** — Deploy do código no beta (FASE B)
  - ⏳ Aguardando push + PR + merge em `dev` + `git pull` + rebuild `mesas-beta-api`
- [ ] **T1.13** — Teste manual: colar 1 anúncio → draft criado
  - ⏳ Bloqueado — aguarda FASE B (deploy do código no beta) + FASE C (auth admin)
  - Critério: texto de anúncio real → draft aparece com título, sistema, tipo, vagas
- [ ] **T1.14** — Teste manual: colar múltiplos anúncios → segmentação
  - ⏳ Bloqueado — aguarda FASE B + FASE C
  - Critério: 3 anúncios separados por `---` → 3 drafts criados
- [ ] **T1.15** — Teste manual: revisar draft → editar campos → aprovar → sync
  - ⏳ Bloqueado — aguarda `syncImportDraftToTable` (T1.6 pendente) + frontend
  - Critério: `syncImportDraftToTable` cria mesa na tabela `tables` com status `draft` (NÃO `published`)
- [ ] **T1.16** — Teste manual: rejeitar draft
  - ⏳ Bloqueado — aguarda frontend (T1.8-T1.12)
  - Critério: status muda para `rejected`; não aparece na lista de "prontos"
- [ ] **T1-final** — Atualizar `specs/backlog.md`, sessão, `project-state.md`

---

## Fase 1.5 — Corpus de treino

> Depende de: Fase 1 concluída e aprovada

- [ ] **T1.5.1** — Criar tabela `import_corrections` (ou coluna JSONB em `import_messages`)
  - Campos: `draft_id`, `raw_text`, `parsed_before` (JSONB), `human_corrected` (JSONB), `diff` (JSONB), `reason` (TEXT)
  - Critério: migration nova (`migration_129_import_corrections.sql`) + tipos Kysely
- [ ] **T1.5.2** — Endpoint `POST /drafts/:id/correction`
  - Registra diff entre parsed e human_corrected ao aprovar/sync
  - Critério: endpoint funcional; Zod validation
- [ ] **T1.5.3** — Métricas básicas de acurácia
  - Dashboard admin: taxa de acerto por campo, campos mais corrigidos, sistemas mais confundidos
  - Critério: `GET /admin/inbox/metrics` retorna JSON com breakdown por campo

---

## Fase 2 — Normalização melhorada

> Depende de: Fase 1 concluída e aprovada

- [ ] **T2.1** — Múltiplos dias: "sábado e domingo às 19h"
  - Alterar `extractDayOfWeek` para retornar array? Ou manter 1 dia + nota?
  - **Decisão:** schema atual (`table_schedules`) suporta múltiplos schedules; parser deve criar 1 schedule por dia detectado
- [ ] **T2.2** — Frequência quinzenal: "a cada 15 dias", "quinzenal"
  - Adicionar detecção em `deriveFrequency` ou nova função `extractFrequency`
- [ ] **T2.3** — Mesa semanal explícita: "todo sábado"
  - Regex `\btodo\s+(sábado|domingo|...)\b` → frequency=semanal
- [ ] **T2.4** — One-shot: "hoje às 19h"
  - Detectar "hoje" + horário → type=one-shot, data relativa
- [ ] **T2.5** — Horários com intervalo: "19h às 23h"
  - Nova função `extractTimeRange` → `{ start_time, end_time }`
  - Campo `end_time` já existe em `table_schedules`
- [ ] **T2.6** — Vagas ambíguas: "3 de 5", "3/5", "5 sobreviventes"
  - Melhorar `extractSlots` com padrões adicionais
  - Marcar `_slots_ambiguity` quando houver dúvida
- [ ] **T2.7** — Recrutamento: "me chame no privado", "comentários abaixo", "formulário", `forms.gle`, Discord mention
  - Nova função `extractRecruitmentChannel`
  - Valores: `discord_dm`, `comments`, `form`, `discord_mention`
- [ ] **T2.8** — Mesa paga: "MESA PAGA", "R$160 mensal", "R$55 sessão avulsa", "sessão 0 gratuita"
  - Melhorar `extractPrice` para detectar padrões adicionais
  - Campo `session_zero_free: boolean` já existe em `tables`

---

## Fase 3 — Resolução de sistema

> Depende de: Fase 1 concluída e aprovada

- [ ] **T3.1** — Match exato por nome canônico
  - Já implementado em `findSystemMatch` (`parseDiscordAnnouncement.ts:98`)
- [ ] **T3.2** — Match por alias
  - Já implementado (aliases carregados de `system_aliases`)
- [ ] **T3.3** — Match normalizado (sem acento, case-insensitive)
  - Já implementado via função `normalize()`
- [ ] **T3.4** — Detecção de sistema próprio
  - Regex: "sistema próprio", "sistema autoral", "homebrew", "inspirado em X"
  - Criar `system_suggestion` com `node_type='system'`, `status='pending'`
  - Marcar `raw_system_hint` com o texto original
- [ ] **T3.5** — Detecção de "inspirado em"
  - "Sistema próprio inspirado em Ordem Paranormal" → sistema próprio (não Ordem Paranormal)
  - Regex: `\b(?:inspirado|baseado)\s+(?:em|no|na)\s+([A-Za-zÀ-ÿ]+)`
  - Extrair inspiração e registrar como nota, não como sistema
- [ ] **T3.6** — Sugestão automática
  - Já implementado via `ensureSystemSuggestionForDraft` (`adminDiscordSync.ts:159`)
  - Reutilizar no fluxo do inbox

---

## Fase 4 — Score de qualidade

> Depende de: Fase 1 concluída e aprovada

- [ ] **T4.1** — Criar `scoring.ts`
  - Arquivo: `apps/mesas/backend/src/inbox/scoring.ts`
  - Função: `calculateDraftScore(draft: DiscordTableDraft): DraftScore`
- [ ] **T4.2** — Implementar dimensões do score
  - `field_completeness_score` (0-100): proporção de campos preenchidos
  - `system_match_score` (0-100): 100 se match exato, 80 se alias, 50 se hint sem match, 0 se sem sistema
  - `schedule_confidence_score` (0-100): dia+horário=100, só dia=60, só horário=40, nenhum=0
  - `contact_confidence_score` (0-100): URL+mention=100, só URL=80, só mention=60, nenhum=0
  - `slots_confidence_score` (0-100): total+open sem ambiguidade=100, com ambiguidade=60, ausente=0
  - `publication_readiness_score` (0-100): média ponderada
- [ ] **T4.3** — Implementar thresholds
  - 0-49: `needs_review` obrigatório
  - 50-79: `needs_review` recomendado
  - 80-94: `ready` (pronto para revisão rápida)
  - 95-100: `ready` (candidato a auto-aprovação futura — feature flag desligada)
- [ ] **T4.4** — Score explica o motivo
  - Campo `reasons: string[]` no retorno
  - Ex: `["Sistema vinculado por alias exato", "Contato encontrado por menção Discord", "Vagas ambíguas em formato 3/5"]`
- [ ] **T4.5** — Integrar score no fluxo de importação
  - `POST /import-text` retorna score junto com draft
  - `GET /drafts` inclui score no response

---

## Fase 5 — UI de revisão inteligente

> Depende de: Fase 1 concluída e aprovada

- [ ] **T5.1** — Preview mostrando anúncio bruto original lado a lado com extraídos
  - Layout: 2 colunas (esquerda: texto bruto destacado, direita: campos extraídos)
- [ ] **T5.2** — Destacar campos ausentes
  - Badge "ausente" em campos não preenchidos
  - Sugestão do parser quando disponível (ex: "sistema não reconhecido: 'D&D 5e'")
- [ ] **T5.3** — Mostrar ambiguidades
  - Campo de vagas mostra "3/5 — pode ser 3 preenchidas de 5 ou 3 abertas de 5"
  - Botão "Resolver" → admin escolhe interpretação correta
- [ ] **T5.4** — Mostrar score com breakdown
  - Barra de progresso colorida (vermelho/amarelo/verde)
  - Tooltip com dimensões individuais e reasons
- [ ] **T5.5** — Botões de ação
  - "Editar" → abre DiscordDraftPreview (já existente)
  - "Aprovar" → status → `ready`
  - "Rejeitar" → status → `rejected` + motivo opcional
  - "Sync" → cria mesa (status `draft`, NÃO publicada)
  - "Reparse" → re-parseia do texto original
- [ ] **T5.6** — Histórico de reprocessamento
  - Se o draft foi reparseado, mostrar diff entre versões (antes/depois)
  - Campo `reparse_count` e `last_reparsed_at`

---

## Fase 6 — Heurísticas reaproveitáveis

> Depende de: Fase 2 concluída

- [ ] **T6.1** — Criar `heuristics.ts`
  - Arquivo: `apps/mesas/backend/src/inbox/heuristics.ts`
  - Array de regras: `{ pattern: RegExp | string, field: string, value: string, confidence: number }`
- [ ] **T6.2** — Popular regras iniciais
  - Recrutamento: `"me chame no privado"` → `recruitment_channel: 'discord_dm'`
  - Recrutamento: `"comentários abaixo"` → `recruitment_channel: 'comments'`
  - Recrutamento: `"forms.gle"` → `recruitment_channel: 'form'`
  - Frequência: `"quinzenal"` → `frequency: 'quinzenal'`
  - Frequência: `"a cada 15 dias"` → `frequency: 'quinzenal'`
  - Frequência: `"todo sábado"` → `frequency: 'semanal'`
  - Mesa paga: `"MESA PAGA"` → `price_type: 'paga'`
  - Mesa paga: `"sessão 0 gratuita"` → `session_zero_free: true`
- [ ] **T6.3** — Integrar heurísticas no fluxo
  - Aplicar após `parseDiscordAnnouncement`, antes de `normalizeDiscordTableDraft`
  - Heurísticas só preenchem campos ausentes (não sobrescrevem)
  - Cada aplicação registra `_heuristic_applied: true` no campo

---

## Fase 7 — Roadmap futuro

> Só planejar — NÃO implementar agora

- [ ] **T7.1** — Documentar especificação para Discord Bot/API oficial
- [ ] **T7.2** — Documentar especificação para importador JSON
- [ ] **T7.3** — Documentar especificação para redes sociais
- [ ] **T7.4** — Documentar especificação para auto-aprovação por score
- [ ] **T7.5** — Documentar especificação para deduplicação de anúncios
- [ ] **T7.6** — Documentar especificação para métricas de acurácia

---

## Task recomendada para começar

**T1.13** — Teste manual: aplicar migration em ambiente dev e testar `POST /api/v1/admin/inbox/import-text` com um anúncio real colado.

T1.1 a T1.7 + T1.18 já executados (2026-06-22). Backend compila limpo (`tsc --noEmit` verde). Pendente: T1.6 sync (`POST /drafts/:id/sync`), T1.8-T1.12 frontend, T1.13-T1.17 validação.

---

## Atualizar ao fechar

- [ ] `specs/backlog.md` — adicionar item `BL-MESAS-INBOX-047` na seção P1/Produto
- [ ] `.specify/memory/project-state.md` — próximo passo
- [ ] `sessoes/26-06-22_9_mesas-inbox-importacao.md` — sessão
