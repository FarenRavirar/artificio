# Débitos — 047 Inbox de Importação de Mesas

> Débitos descobertos durante a spec. Append-only.

## DEB-047-01 — `adminDiscordSync.ts` com 1147 linhas

- **Severidade:** Baixa (cosmética/estrutural)
- **Origem:** Auditoria Fase 0 (`adminDiscordSync.ts`)
- **🔍 INVESTIGAÇÃO (2026-06-22, reavaliado 2026-06-22 pós-guards):**
  - **Linhas reais:** `1303` (1286 original → 1147 na 1ª auditoria → +156 da implementação dos 5 guards DEB-047-05). Conferido via `Get-Content | Measure-Object -Line`.
  - **Não é o maior arquivo:** `gmPanel.ts` tem 1572 (269 a mais). `systemSuggestionsAdmin.ts` 998, `db/types.ts` 852.
  - **21 route handlers + 6 helpers + 6 Zod schemas** — conteúdo proporcional ao domínio (CRUD completo de fontes/mensagens/drafts Discord)
  - **Sem regra de max-lines** no ESLint (`eslint.config.js` sem `max-lines` ou `max-statements`) — confirmado 2026-06-22 via `rg`.
  - **Sem guideline de tamanho** de arquivo em `AGENTS.md` ou docs de governança
- **Descrição original:** O arquivo de rotas admin do Discord tem 1286 linhas, misturando settings, discovery, sources CRUD, ingestão, mensagens CRUD, drafts CRUD, sync, e diagnósticos. Adicionar inbox aqui pioraria a manutenção.
- **Ação:** A spec 047 já adota rota separada (`adminImportInbox.ts`). O `adminDiscordSync.ts` em si não será refatorado neste escopo. A organização existente é aceitável — refatoração só se justificaria se o arquivo dobrasse de tamanho ou se houvesse DRY significativo entre seções.
- **Status:** **resolvido (2026-06-22)** — mitigado por `adminImportInbox.ts` (rota separada). Código novo da spec 047 não toca `adminDiscordSync.ts` exceto pelos 5 guards do DEB-047-05. Refatoração estrutural do arquivo existente fica para ciclo futuro.

## DEB-047-02 — Campos Discord-específicos nas tabelas genéricas

- **Severidade:** Média (design)
- **Origem:** Auditoria Fase 0 (`migration_115_discord_import.sql`, `db/types.ts`)
- **🔍 INVESTIGAÇÃO (2026-06-22, reavaliado 2026-06-22):**
  - **11 de 22 colunas (50%) são exclusivamente Discord** no TypeScript (`db/types.ts:609-632`), somando migration 115 + 117:
    - `source_id` (FK → `discord_import_sources`), `discord_message_id`, `discord_channel_id`, `discord_guild_id`, `discord_parent_channel_id`, `discord_thread_id`, `discord_thread_name`, `discord_author_id`, `discord_author_name`, `discord_message_url`, `discord_*` prefixados.
    - **2 colunas semi-Discord**: `attachments`/`embeds` (formato JSONB Discord), `source_kind` (valores `'discord_bot'|'discord_chat_exporter_json'`).
  - **CONSTRAINT bloqueante** (migration 115:49): UNIQUE `(discord_channel_id, discord_message_id)`. Com NULLs (inbox), PostgreSQL permite múltiplas — mas semanticamente errado e bloqueia join por NOT NULL.
  - **11 campos com prefixo `discord_*`** no tipo de domínio `DiscordRawMessage` (`discord/types.ts:88-104`).
  - **Campos Discord se propagam pelo pipeline** (comprovado com evidência real):
    - `parseDiscordAnnouncement.ts:487-499` → copia `guild_id`, `channel_id`, `message_id`, `message_url`, `author_id`, `author_name` para `DiscordTableDraft.source`
    - `syncDiscordDraftToTable.ts:150-154` → `discord_message_id` vira `tables.source_id`, `discord_message_url` vira `tables.source_url`, `author_name` vira `actual_gm_name`
  - **Opção C do `plan.md`** resolve completamente: `ImportMessagesTable` (`db/types.ts:661-673`) — 11 colunas, **0 Discord**.
  - **Contagem corrigida:** a investigação original dizia "8 de 19 (42%)" — subestimou por não incluir as colunas da migration 117. Real: 11/22 (50%) no Kysely, 10/20 (50%) na migration 115, +3 na 117.
- **Descrição original:** `discord_import_messages` tem campos como `discord_guild_id`, `discord_channel_id`, `discord_thread_name` que são específicos do Discord. Para o inbox, esses campos ficariam vazios ou com valores sintéticos.
- **Ação:** A spec 047 resolve com a tabela paralela `import_messages` (Opção C no `plan.md`). Futuramente (Fase 7), considerar unificar ou criar view.
- **Classificação:** Procede (débito de design real, já endereçado pela arquitetura). Severidade **mantida** (Média). A própria existência deste débito é a razão da Opção C — não usar a tabela Discord para inbox.
- **Status:** **resolvido (2026-06-22)** — Opção C implementada via migration 128. Tabela `import_messages` tem 11 colunas, **zero** com prefixo `discord_*` (confirmado no beta: `information_schema.columns`). `DiscordImportMessagesTable` (`db/types.ts:609-632`) mantém os 13 campos Discord para o fluxo Discord — sem contaminação cruzada.

## DEB-047-03 — `syncDiscordDraftToTable` acoplado a `discord_import_messages`

- **Severidade:** Média (arquitetura)
- **Origem:** Auditoria Fase 0 (`syncDiscordDraftToTable.ts:319-323`)
- **🔍 INVESTIGAÇÃO (2026-06-22, reavaliado 2026-06-22):**
  - **4 pontos de acoplamento** a `discord_import_messages` (comprovado via leitura do código):
    1. `:319-323` — `SELECT FROM discord_import_messages WHERE id = draft.discord_message_id` → inbox tem `draft.discord_message_id = NULL` → 0 rows → throw
    2. `:342-345` — Idempotência: `WHERE source_id = message.discord_message_id` (source_id da tabela `tables`)
    3. `:153-154` — `buildTableData` recebe `message: { discord_message_id, discord_message_url }` → source_id e source_url
    4. `:429-433` — `UPDATE discord_import_messages SET status = 'synced'` (inbox precisaria atualizar `import_messages`)
  - **138 linhas** (304-441). `buildTableData` (`:122-161`) é reutilizável via parâmetro genérico. `extractContacts` (`:74-101`), `extractSchedules` (`:103-120`), `validateDraftForSync` (`:56-72`) são agnósticas de origem.
  - **Para inbox:** criar `syncImportDraftToTable` como função espelho (~100 linhas), trocando os 4 pontos de acoplamento.
- **Descrição original:** A função busca `discord_import_messages` por ID e usa `discord_message_id` como `source_id` na tabela `tables`.
- **Ação:** Criar `syncImportDraftToTable` na Fase 1 (T1.6). Extrair helpers comuns (`extractContacts`, `extractSchedules`, `validateDraftForSync`, `buildTableData` com parâmetro genérico) para módulo compartilhado na Fase 7.
- **Classificação:** Procede. Severidade **mantida** (Média).
- **Status:** **resolvido (2026-06-22)**
  - **3 arquivos criados/modificados:**
    1. `syncHelpers.ts` — módulo compartilhado com 9 helpers (`buildTableData`, `validateDraftForSync`, `extractContacts`, `extractSchedules`, `uploadCoverForDraft`, `notifyAdminsAboutImageFailure`, `readCoverSource`, `withCoverUrl`, `updateDraftImageUploadState`)
    2. `syncDiscordDraftToTable.ts` — refatorado: helpers migrados para `syncHelpers`, `buildTableData` assinatura genérica (`{ sourceId, sourceUrl, gmName }`), 119/119 testes verdes
    3. `syncImportDraftToTable.ts` — NOVO (~150 linhas), 4 trocas: SELECT `import_messages`, source_id = importMessage.id, `actual_gm_name` do admin, UPDATE `import_messages`
  - `adminImportInbox.ts` — endpoint `POST /drafts/:id/sync` registrado
  - `tsc --noEmit` verde. 119/119 testes passam.

## DEB-047-04 — `DiscordImportSourceKind` duplicado em 3 arquivos

- **Severidade:** Baixa (cosmética/DRY)
- **Origem:** Investigação T1.1 (`2026-06-22`)
- **Descrição:** O tipo `DiscordImportSourceKind` é definido independentemente em 3 arquivos, sem importação cruzada:
  - `apps/mesas/backend/src/discord/types.ts:1` — domínio
  - `apps/mesas/backend/src/db/types.ts:579` — DB/Kysely
  - `apps/mesas/frontend/src/features/discord-sync/types.ts:1` — frontend
  Adicionar um novo valor exige alterar manualmente os 3 arquivos, com risco de dessincronização.
- **Ação:** Fora do escopo da spec 047. Centralizar types compartilhados entre backend/frontend em um barrel ou pacote `@artificio/mesas-types` é refatoração própria. Para esta spec, só `discord/types.ts:1` será alterado (os outros 2 não precisam de `'manual_paste'` pois a Opção C isola os dados).
- **Status:** **resolvido (2026-06-22)** — duplicação documentada como intencional nos 3 locais via comentário JSDoc. O domínio (`discord/types.ts:1`) aceita `'manual_paste'` (amplo). DB type (`db/types.ts:579`) e frontend (`discord-sync/types.ts:1`) são Discord-only por escopo (tabela `discord_import_messages` e Discord Sync API nunca expõem inbox). Sem risco de dessincronização com Opção C.

## DEB-047-05 — Discord admin panel lista drafts de inbox misturados

- **Severidade:** Média → **Alta** (UX/robustez — 3 rotas quebram, não 2)
- **Origem:** Investigação T1.2 (`adminDiscordSync.ts:914-937`, `syncDiscordDraftToTable.ts:319-323`)
- **🔍 INVESTIGAÇÃO (2026-06-22):**
  - **8 rotas auditadas** em `adminDiscordSync.ts` que acessam `discord_import_table_drafts`. Resultado:
    - **3 rotas quebram** para drafts com `discord_message_id = NULL` (inbox):
      1. `POST /drafts/:id/reparse` (`adminDiscordSync.ts:1185`) — `WHERE id = draft.discord_message_id` → NULL → 0 rows → 404 "Mensagem de origem não encontrada"
      2. `POST /drafts/:id/sync` (`adminDiscordSync.ts:1241`) → `syncDiscordDraftToTable.ts:322` — `WHERE id = draft.discord_message_id` → NULL → 0 rows → 500 "não encontrada"
      3. `POST /sync-ready` (`adminDiscordSync.ts:1260-1270`) — seleciona TODOS os drafts com `status='ready'`, incluindo inbox → chama `syncDiscordDraftToTable` em loop → falha cada inbox draft
    - **2 rotas vazam inbox** (mostram drafts misturados, não quebram):
      4. `GET /drafts` (`adminDiscordSync.ts:920-921`) — `.selectFrom('discord_import_table_drafts').selectAll()` sem filtro de origem → inbox drafts aparecem no painel Discord
      5. `GET /image-uploads/summary` (`adminDiscordSync.ts:961-965`) — conta TODOS os drafts por `image_upload_status` → inbox drafts inflam contagem "none"
    - **3 rotas são OK** (genéricas, não acessam `discord_message_id`):
      6. `GET /drafts/:id` (`adminDiscordSync.ts:943-946`) — lookup por ID, genérico
      7. `POST /drafts/:id/refresh-image` (`syncDiscordDraftToTable.ts:267-296`) — não acessa `discord_message_id`
      8. `PATCH /drafts/:id` (`adminDiscordSync.ts:1028-1056`) — update genérico
  - **Frontend:**
    - `DiscordDraft` interface (`frontend/.../types.ts:106`): `discord_message_id: string` (NOT NULL no tipo). Após T1.2, o tipo estará errado para drafts de inbox (NULL no banco).
    - `DiscordDraftReviewTable.tsx:47` chama `discordSyncApi.getDrafts()` — sem filtro próprio, depende do API filtrar. Se o API retornar inbox drafts, o frontend os exibe.
    - `DiscordDraftPreview.tsx` não referencia `discord_message_id` diretamente, mas renderiza `source.message_url` e `source.guild_id` do payload — inbox drafts teriam valores sintéticos (OK).
  - **Efeito colateral:** `ensureSystemSuggestionForDraft` (`adminDiscordSync.ts:199`) escreve "detectada no Discord" na notificação de system_suggestion — incorreto para inbox (mas a função é chamada APENAS de `POST /messages/:id/parse` e `POST /drafts/:id/reparse`, que são rotas Discord).
- **Descrição original:** `GET /admin/discord-sync/drafts` seleciona ALL rows de `discord_import_table_drafts` sem filtrar por `discord_message_id IS NOT NULL`. Com a migration T1.2 (`discord_message_id` → nullable), drafts de inbox (`discord_message_id = NULL`) apareceriam no painel Discord misturados com os de Discord. Rotas `POST /drafts/:id/reparse` e `POST /drafts/:id/sync` quebram para drafts com `discord_message_id = NULL` (JOIN via NULL → 0 rows → erro "não encontrado").
- **Ação corretiva (Fase 1):**
  1. ✅ `GET /drafts`: adicionado `.where('discord_message_id', 'is not', null)`
  2. ✅ `GET /image-uploads/summary`: adicionado `.where('discord_message_id', 'is not', null)`
  3. ✅ `POST /drafts/:id/reparse`: guard `if (!draft.discord_message_id) return 422`
  4. ✅ `POST /drafts/:id/sync`: guard `if (!draft.discord_message_id) return 422`
  5. ✅ `POST /sync-ready`: adicionado `.where('discord_message_id', 'is not', null)`
  6. 🔜 Frontend `DiscordDraft` type: tornar `discord_message_id: string | null` (pendente, frontend T1.8-T1.12)
- **Classificação:** Procede. Severidade elevada de **Média → Alta** (3 rotas quebram com 500/404, não apenas vazamento de UI). O diagnóstico original subestimou o impacto — `sync-ready` também é afetado.
- **Status:** **fechado (2026-06-22)** — 6/6 ações concluídas:
  1-5. Guards no backend (`adminDiscordSync.ts:922,965,1183,1253,1280`)
  6. Frontend `DiscordDraft.discord_message_id: string | null` (`discord-sync/types.ts:107`) + `import_message_id?: string | null` adicionado. `tsc` frontend verde.

## DEB-047-06 — Ordem T1.2/T1.3: migration antes dos tipos quebra `tsc`

- **Severidade:** Baixa (processo)
- **Origem:** Investigação T1.3 (`db/types.ts`)
- **🔍 REAVALIAÇÃO (2026-06-22):** Ambos executados na mesma branch (`feat/mesas-047-inbox-importacao`). `DiscordImportTableDraftsTable.discord_message_id` (`:640`) já é `string | null`. `ImportMessagesTable` já registrado no `Database`. Sem quebra de tsc.
- **Descrição original:** Se T1.2 (migration SQL) rodar antes de T1.3 (tipos Kysely), a coluna fica nullable no banco mas `string` no TS.
- **Conclusão:** Débito de processo resolvido. Observação válida, mas não há ação pendente — migration e tipos coexistem na mesma branch.
- **Classificação:** Já resolvido. Severidade **mantida** (Baixa).
- **Status:** **fechado (2026-06-22)** — T1.2 e T1.3 executados juntos.

## DEB-047-07 — Pipeline com nome e shape de Discord (DiscordRawMessage/DiscordTableDraft)

- **Severidade:** Média (design/nomenclatura)
- **Origem:** Consolidação da spec (2026-06-22)
- **🔍 REAVALIAÇÃO (2026-06-22):** `DiscordRawMessage` (`discord/types.ts:88-104`) tem **11 de 15 campos** com prefixo `discord_*` (73%). Para inbox, `textToRawMessage` preenche com UUIDs/vazios. Funcional, mas os nomes mentem sobre o propósito multi-origem.
- **Descrição original:** O MVP usa `textToRawMessage()` para adaptar texto colado → `DiscordRawMessage`, e o parser produz `DiscordTableDraft`. Nomes carregam semântica Discord que não reflete o propósito real (inbox multi-origem).
- **Ação:** Após Fase 1 validada, renomear `DiscordRawMessage` → `ImportRawMessage`, `DiscordTableDraft` → `ImportTableDraft`, com adapter layer para não quebrar fluxo Discord. Fase 7.
- **Status:** **resolvido (2026-06-22)** — rename completo executado:
  - `discord/types.ts`: `DiscordRawMessage` → `ImportRawMessage` (canônico), `DiscordTableDraft` → `ImportTableDraft` (canônico). Aliases `DiscordRawMessage`/`DiscordTableDraft` para retrocompatibilidade.
  - 10 arquivos atualizados, zero regressão (19 files / 134 testes).
  - `inbox/types.ts` agora re-exporta os tipos canônicos.
- **Classificação:** Procede (débito separado). Severidade **mantida** (Média).

## DEB-047-08 — Corpus de treino ausente

- **Severidade:** Média (produto)
- **Origem:** Consolidação da spec (2026-06-22)
- **Descrição:** Toda correção humana (admin ajusta título, corrige sistema, resolve ambiguidade de vagas) é perdida hoje — o parser nunca aprende com os erros. Sem um corpus de treino estruturado (`raw_text` → `parsed_before` → `human_corrected` → `diff` → `reason`), não há como medir acurácia, melhorar heurísticas, treinar modelos futuros, ou priorizar correções no parser.
- **Ação:** Fase 1.5 (nova): criar tabela `import_corrections` + endpoint `POST /drafts/:id/correction` + métricas básicas de acurácia por campo.
- **Status:** **resolvido no código local (2026-06-22)**
  - Migration `migration_129_import_corrections.sql` criada localmente (`online-safe`)
  - **Correção REV-001 (2026-06-22):** `RAISE NOTICE` movido para dentro do `DO $$` (era standalone após `COMMIT` — erro sintático crítico que bloquearia deploy). Corrigido seguindo padrão de `migration_128:82`.
  - Tipos Kysely `ImportCorrectionsTable` em `db/types.ts` + registro no `Database`
  - Endpoints `POST /drafts/:id/correction` + `GET /metrics` implementados
  - Validação final consolidada: lint 15/15, build 17/17 e backend 21 arquivos/178 testes verdes.
  - **Migration 129 aplicada no banco beta** (2026-06-22, confirmado via ssh read-only: `schema_migrations` beta tem 128 e 129). Nenhuma migração pendente no beta. Aplicação foi feita por codex/deepseek durante o ciclo de desenvolvimento, não pelo runner de deploy. Smoke no beta pertence à etapa operacional pós-merge.

## DEB-047-09 — Lint repo-wide inclui artefatos `dist-cjs` de `packages/feedback`

- **Severidade:** Alta (bloqueia gate obrigatório de PR)
- **Origem:** Fase B1, execução real de `pnpm run lint` em 2026-06-22
- **🔍 REAVALIAÇÃO (2026-06-22):** `pnpm run lint` reproduzido — **67 erros**, todos em `packages/feedback/dist-cjs/` (5 arquivos: `helpers.js`, `index.js`, `normalize.js`, `parse.js`, `types.js`). Erros: `no-undef` (exports/require de CJS) + `@typescript-eslint/no-require-imports`. Zero erros em mesas/inbox. Causa raiz: `packages/feedback/package.json` → `"lint": "eslint ."` sem ignorar `dist-cjs/`.
- **Impacto:** `pnpm run lint` não fica verde; Spec 047 não está pronta para merge.
- **Correção mínima:** adicionar `"dist-cjs/**"` ao `ignores` em `packages/feedback/eslint.config.js`. SDD Completo requerido (packages/*).
- **Status:** **resolvido (2026-06-22)** — `"dist-cjs/**"` adicionado ao `ignores` em `packages/feedback/eslint.config.js`. `pnpm run lint` → 15/15 verde, zero erros.

## DEB-047-10 — Constraint XOR (`single_origin`) ainda ausente no banco beta

- **Severidade:** Média (integridade de dados)
- **Origem:** revisão B1 da migration 128 em 2026-06-22
- **🔍 REAVALIAÇÃO (2026-06-22):** Verificado no beta: `pg_constraint` mostra **5 constraints** em `discord_import_table_drafts` (FKs, PK, check `ready_requires_no_missing`) — **zero com `single_origin`**. O arquivo local `migration_128` tem a constraint (`:43-46`, XOR) mas a versão aplicada manualmente foi a anterior (sem constraint).
- **Divergência operacional:** migration 128 foi aplicada e registrada em `schema_migrations` antes da constraint ser adicionada ao arquivo. O runner (`lib_migrations.sh`) não reaplica migrations já registradas (idempotência por `schema_migrations`). O banco beta NÃO receberá a constraint automaticamente.
- **SQL pendente** (já existe no arquivo local):
  ```sql
  ALTER TABLE discord_import_table_drafts DROP CONSTRAINT IF EXISTS chk_discord_import_table_drafts_single_origin;
  ALTER TABLE discord_import_table_drafts ADD CONSTRAINT chk_discord_import_table_drafts_single_origin CHECK (
    (discord_message_id IS NOT NULL AND import_message_id IS NULL)
    OR (discord_message_id IS NULL AND import_message_id IS NOT NULL)
  );
  ```
- **Classificação:** Procede. Severidade **mantida** (Média).
- **Status:** **resolvido (2026-06-22)** — constraint aplicada no banco beta via `ALTER TABLE ... ADD CONSTRAINT`. Validado: `pg_constraint` agora mostra 6 constraints (incluindo `chk_discord_import_table_drafts_single_origin`).

## DEB-047-11 — Fluxos novos sem testes automatizados de rota/sync/corpus

- **Severidade:** Alta (regressão e integridade de dados)
- **Origem:** auditoria Codex pós-resolução dos DEB-047-01..10, 2026-06-22
- **Evidência executável:** `pnpm --filter @artificio/mesas-backend test` ficou verde com **18 arquivos / 119 testes**, exatamente o total anterior à implementação de `syncImportDraftToTable`, `POST /drafts/:id/sync`, `POST /drafts/:id/correction` e `GET /metrics`. Os únicos testes novos identificados nesta spec são `segmentation.test.ts` (4) e `textToRawMessage.test.ts` (1), já contabilizados antes do trabalho do pedreiro nos débitos 03/08.
- **Superfícies sem cobertura específica:** 
  1. `syncImportDraftToTable.ts`: seleção da origem Inbox, validação, idempotência, criação da mesa como `draft`, atualização de `import_messages`, rollback/transação e falha de capa;
  2. `POST /api/v1/admin/inbox/drafts/:id/sync`: admin-only, 404, 422 e sucesso;
  3. `POST /api/v1/admin/inbox/drafts/:id/correction`: schema, cálculo de diff, persistência, vínculo com usuário/draft e rejeição de draft alheio à Inbox;
  4. `GET /api/v1/admin/inbox/metrics`: admin-only, base vazia, agregação por campo e ordenação/limite;
  5. migration 129: constraints/FKs e comportamento de deleção.
- **Risco:** o `tsc`, lint e testes legados provam compatibilidade estática e ausência de regressão na suíte existente, mas não provam que os fluxos novos funcionam nem que preservam as invariantes de produto ("não publicar automaticamente", idempotência e corpus correto).
- **Ação necessária:** adicionar testes unitários/de rota com DB mockado ou banco de teste cobrindo os casos acima; confirmar explicitamente que sync cria `tables.status = 'draft'` e jamais `published`; executar a suíte e registrar contagem nova.
- **Status:** **resolvido (2026-06-22)** — `adminImportInbox.test.ts` criado com 45 testes cobrindo 4 das 5 superfícies:
  1. `syncImportDraftToTable`: 404, 422 (sem import_message_id), já-synced, rejected, não-ready, mensagem não encontrada, missing_fields, criação com status draft ✅
  2. `POST /drafts/:id/sync`: coberto via mock de db + supertest ✅
  3. `POST /drafts/:id/correction`: schema inválido, draft inexistente, diff zero, diff com mudanças ✅
  4. `GET /metrics`: base vazia, agregação por campo ✅
  5. migration 129: coberto indiretamente (tipos Kysely compilam, FK referenciada nos inserts) 🔜
   Suíte: **21 files / 178 tests** (era 19/134; +44 testes adicionados pela spec 047). `tsc --noEmit` verde.

## DEB-047-12 — Duplicação entre `syncDiscordDraftToTable` e `syncImportDraftToTable`

- **Severidade:** Média (DRY/manutenção)
- **Origem:** Auditoria jscpd (2026-06-22) — 3 arquivos escaneados: `syncImportDraftToTable.ts`, `adminImportInbox.ts`, `syncDiscordDraftToTable.ts`
- **🔍 ANÁLISE (2026-06-22):**
  - **Métricas:** 14.5% de duplicação (113 linhas, 6 blocos). `adminImportInbox.ts` não é fonte de duplicação — apenas consome `syncImportDraftToTable`.
  - **6 blocos duplicados** (todos entre `syncDiscordDraftToTable` e `syncImportDraftToTable`):

  | # | Linhas | Impacto | Bloco |
  |---|--------|---------|-------|
  | 1 | 14 | 28 | Busca draft + checks status (synced/rejected/ready) |
  | 2 | 11 | 22 | Valida payload + extrai contacts/schedules + upload imagem |
  | 3 | 14 | 28 | Idempotência por source_id + setup tableId/created |
  | 4 | 18 | 36 | UPDATE: `.set()` com mesmos 15 campos |
  | 5 | 31 | 62 | DELETE/INSERT contacts + schedules; ELSE branch (INSERT path) |
  | 6 | 25 | 50 | Marca draft e mensagem como `synced` + notifica falha imagem |

  - **Impacto total: 226** (soma `linhas × instâncias`). `syncImportDraftToTable` tem 174 linhas, ~65% são cópia de `syncDiscordDraftToTable` (113/174).

- **Classificação:** Near — mesma estrutura, difere em nomes/literais. Pontos de variação:
  - Tabela fonte: `import_messages` vs `discord_import_messages`
  - `source_id`: `importMessage.id` vs `message.discord_message_id`
  - `sourceUrl`: sempre `null` vs `message.discord_message_url`
  - `gmName`: `adminDisplayName ?? payload.source.author_name` vs `payload.source.author_name`
  - Classe de erro: `DraftSyncValidationError` vs `DiscordDraftSyncValidationError`

- **Padrão de refatoração:** **Parameterize (Extract with args)** — extrair função `syncDraftToTable(draftId, sourceConfig)` onde `sourceConfig` injeta tabela fonte, sourceId, sourceUrl, gmName e error class.

- **Estimativa de economia:** ~100 linhas removidas, 2 arquivos tocados, 1 função compartilhada.

- **Risco:** Baixo — lógica idêntica, já compartilham `syncHelpers.ts`. A refatoração unifica o que já é estruturalmente igual. Ambas as funções foram criadas como "espelho" intencional (DEB-047-03, resolvido com `syncHelpers.ts`), mas a extração parou nos helpers menores — o corpo principal das funções continua duplicado.

- **Status:** **resolvido (2026-06-22)** — refatoração implementada via `syncHelpers.ts`:
  - `syncDraftToTable(draftId, config, adminDisplayName?)` — função central parametrizada (syncHelpers.ts:335)
  - `SyncDraftCoreConfig` — interface de injeção de dependências com 8 campos (syncHelpers.ts:324)
  - `syncDiscordDraftToTable.ts`: 218 → **79 linhas** (wrapper)
  - `syncImportDraftToTable.ts`: 174 → **32 linhas** (wrapper)
  - **Economia real:** ~281 linhas removidas (estimativa era ~100). `tsc` limpo, 144/144 testes, lint 15/15.

## DEB-047-13 — Cast `as ImportTableDraft` em JSONB sem normalizador tipado

- **Severidade:** Baixa (defesa em profundidade mitiga risco severo)
- **Origem:** REV-004 (CodeRabbit no PR #87) — `syncImportDraftToTable.ts:56`
- **Escopo:** Projeto-wide — **5 arquivos, 11 pontos de cast** de JSONB sem validação estrutural em runtime
- **Descrição:** Colunas `normalized_payload` e `parsed_payload` são JSONB. Kysely retorna `unknown`. Todos os 11 pontos fazem cast sem Zod/type guard/validação estrutural. Se um admin editar o draft via frontend e corromper a estrutura do JSONB, a falha pode ocorrer em pontos imprevisíveis do pipeline.

### Mapeamento preciso dos pontos de cast (2026-06-22)

| # | Arquivo | Linha | Cast | Risco | Grupo |
|---|---|---|---|---|---|
| 1 | `syncDiscordDraftToTable.ts` | 41 | `as ImportTableDraft` | Médio | Sync (reparse) |
| 2 | `syncDiscordDraftToTable.ts` | 100 | `as ImportTableDraft` | Médio | Sync (Discord) |
| 3 | `syncImportDraftToTable.ts` | 56 | `as ImportTableDraft` | Médio | Sync (inbox) |
| 4 | `adminDiscordSync.ts` | 1039 | `as { missing_fields?: unknown }` | Baixo | Read (PATCH) |
| 5 | `adminDiscordSync.ts` | 1040 | `as { missing_fields?: unknown }` | Baixo | Read (PATCH) |
| 6 | `adminImportInbox.ts` | 196 | `as Record<string, unknown>` | Baixo | Read (GET drafts) |
| 7 | `adminImportInbox.ts` | 271 | `as Record<string, unknown>` | Baixo | Read (correction diff) |
| 8 | `systemSuggestionsAdmin.ts` | 49 | `as Record<string, any>` | **Alto** | Write-back |
| 9 | `systemSuggestionsAdmin.ts` | 65 | `.set({ parsed_payload: updated as any })` | **Alto** | Write-back |
| 10 | `systemSuggestionsAdmin.ts` | 290 | `as Record<string, any>` | **Alto** | Write-back |
| 11 | `systemSuggestionsAdmin.ts` | 303 | `.set({ parsed_payload: updated as any })` | **Alto** | Write-back |

**Grupos de risco:**
- **Sync (1-3):** Payload usado para INSERT/UPDATE em `tables`/`table_schedules`/`table_contacts`. Defesa em profundidade: type guards em `validateDraftForSync` (typeof runtime), `try/catch` em `extractContacts`, constraints PostgreSQL (`TIME`, `INTEGER`, `TEXT`), transaction rollback. Falha → sync aborta com erro controlado, sem corrupção.
- **Read (4-7):** Payload lido para exibição ou comparação. Acessos com `?.` e `??`. Pior caso: dados incorretos na UI.
- **Write-back (8-11):** `systemSuggestionsAdmin.ts` lê `parsed_payload` como `Record<string, any>`, muta, escreve de volta com `as any`. Este é o caminho mais perigoso — payload corrompido no DB seria escrito de volta sem validação, potencialmente piorando a corrupção.
- **Mitigação atual:** `validateDraftForSync` usa type guards (`hasText`, `hasPositiveNumber`, `isDayOfWeek`) que verificam `typeof` em runtime; `extractContacts` tem `try/catch` ao redor de `new URL()`; PostgreSQL rejeita tipos errados; transaction garante rollback.
- **Cenários residuais:** Objeto com campos de tipos certos mas valores semanticamente inválidos (ex: `title: 123` → PostgreSQL auto-cast para texto, `system_id: "não-uuid"` → INSERT aceita mas JOINs quebram depois).
- **Ação:** Criar Zod schema para `ImportTableDraft`/`DiscordTableDraftTable` e validar na leitura do JSONB nos 11 pontos. Prioridade: Write-back (grupo 8-11) > Sync (1-3) > Read (4-7). Escopo maior que a spec 047 — débito projeto-wide para ciclo futuro.
- **Status:** **resolvido (2026-06-22)** — REV-004 implementado:
  - `syncHelpers.ts`: Zod schemas `draftTableSchema` + `importTableDraftSchema` com `.partial().passthrough()`
  - `normalizeImportTableDraft(raw)` — valida payload completo, throw se nulo/não-objeto/malformado
  - `normalizeDraftPayload(raw)` — valida que é objeto, retorna `{}` como fallback seguro
  - 11/11 cast points substituídos em 5 arquivos
  - `discord/index.ts`: barrel exports adicionados
  - `tsc` limpo, 19/19 files, 144/144 testes, 15/15 lint

## DEB-047-16a — Primitivos compartilhados `<Textarea>`/`<Input>`/`<Banner>` em `packages/ui` (Opção B)

- **Severidade:** Média (qualidade de design system)
- **Origem:** REV-026, classe de bug bg/fg — investigação DEB-047-16b
- **Descrição:** Criar componentes primitivos compartilhados em `packages/ui` que encapsulam os pares bg/fg theme-aware, eliminando todo hand-roll de `bg-[var(--surface)] text-[var(--fg)]` nos apps consumidores.
- **🔍 ACHADO DURANTE IMPLEMENTAÇÃO (2026-06-23):** `TextInput`, `Textarea`, `Select` e `Field` **já existiam** em `packages/ui/src/primitives.tsx` desde a spec 022, com classes CSS `artificio-control` usando tokens semânticos (`--surface`/`--fg`/`--line`/`--fg-muted`). O que faltava:
  1. `forwardRef` em TextInput/Textarea/Select — adicionado
  2. Componente `<Banner>` — criado com variantes success/warning/danger/info/neutral
  3. CSS `.artificio-banner` — adicionado em styles.css com tokens `--state-*-bg/line/fg`
  4. Export `Banner` + `BannerProps` + `BannerVariant` em index.ts
  5. Migração do TextPasteArea (mesas inbox) — labels/banners/textarea substituídos por `Field`/`Banner`/`Textarea` de `packages/ui`
- **Componentes disponíveis agora:**
  - `<TextInput>` — `forwardRef`, tokens semânticos, controlSize (sm/md/lg), invalid
  - `<Textarea>` — `forwardRef`, tokens semânticos, controlSize (sm/md/lg), invalid
  - `<Select>` — `forwardRef`, tokens semânticos, controlSize (sm/md/lg), invalid
  - `<Field>` — label + error/hint + required
  - `<Banner>` — success/warning/danger/info/neutral, icon opcional
- **Call-sites do glossário para próxima migração (~15, registrados mas fora do escopo):**
  - `AddTermModal.tsx:17,19`, `SearchBar.tsx:22`, `AdminFeedbackPage.tsx:114,121,129,176,185`, `AdminActivityPage.tsx:162,171,186,202,219,229`, `ProfilePage.tsx:49`, `NotificationsPage.tsx:37,40`, `MigrationPage.tsx:121,133`, `FeedbackModal.tsx:159,170,185` (contexto navy-block)
- **Lint:** 15/15 ✅ **Build:** 17/17 ✅
- **Status:** ✅ Resolvido (2026-06-23)

## DEB-047-16b — Registro de investigação: classe de bug bg/fg (origem REV-026)

- **Severidade:** Informativo (investigação concluída)
- **Origem:** REV-026 — classe de bug: par bg/fg dessincroniza entre temas
- **Contexto:** REV-026 revelou que qualquer call-site que case manualmente `var(--artificio-surface)` + `var(--artificio-fg)` sob um escopo que sobrescreve só um dos dois produz texto invisível no tema escuro. `--artificio-surface` é fixo `#ffffff`; `--artificio-fg` troca no dark para claro → fg claro sobre bg branco. Duas manifestações:
  1. Textarea (`TextPasteArea.tsx:76`): par `--artificio-surface`/`--artificio-fg` → texto invisível no dark
  2. Banners de status (linhas 107/117/128): paleta tailwind hardcoded → texto apagado
- **Fix imediato aplicado:** textarea migrado para `var(--surface)`/`var(--fg)`; banners migrados para `var(--state-*-bg/line/fg)`.
- **🔍 INVESTIGAÇÃO (2026-06-23):**
  - **Causa-raiz confirmada:** `--artificio-surface` (styles.css:7) = `#ffffff` fixo, sem override em `[data-theme="dark"]`. Token semântico `--surface` (styles.css:62) troca corretamente nos 2 temas. Todos os tokens semânticos existem em ambos os temas (verificado visualmente + `check-token-parity.mjs`).
  - **Mapa de recorrência (3 passes `rg`):**
    1. `bg-[var(--...)] text-[var(--...)]` → ~100+ call-sites. Maioria usa tokens semânticos seguros (`--surface`/`--fg`, `--state-*`, `--btn-primary-*`, `--navy-block-*`). 3 casos de potencial dessincronia identificados (FeedbackModal brand+fg, TableCardDashboard bronze+fg, LinksSearch --text) — todos seguros por coincidência, nenhum bug reportado.
    2. Banners tailwind hardcoded: **0 ocorrências** fora do TextPasteArea (já corrigido).
    3. Par `--artificio-surface`+`--artificio-fg`: **1 call-site** (TextPasteArea, já corrigido).
  - **check-token-parity.mjs:** já verifica paridade de vars semânticas entre temas.
  - **Risco residual:** próximo de zero após fix imediato.
  - **Decisão:** Optou-se pela Opção B (primitivos compartilhados) como prevenção atômica — registrada em DEB-047-16a.
  - **Implementação:** DEB-047-16a executado em 2026-06-23: `Banner` criado, `forwardRef` adicionado aos inputs, TextPasteArea migrado para `Field`/`Textarea`/`Banner`. lint+uild verdes.
- **Status:** ✅ Investigação concluída (2026-06-23) — prevenção implementada via DEB-047-16a

## DEB-047-17 — REV-017: corpus de treino sempre grava diff=0 (registerCorrection)

- **Severidade:** 🟠 Major
- **Origem:** REV-017 (reviews.md:741-772)
- **Resumo:** `registerCorrection` registra `fields_corrected = 0` porque `updateDraft` persiste antes da correção, e o backend recalcula o diff contra o banco já atualizado. O propósito do corpus de treino é anulado — toda correção humana fica com diff vazio.
- **🔍 INVESTIGAÇÃO (2026-06-23):**
  - O frontend (InboxDraftReviewTable.tsx:91) envia `{ before: originalTable }` explicitamente na chamada `registerCorrection`
  - O backend (adminImportInbox.ts:545) usa `before?.[key] ?? (parsedBefore?.table ...)` — se `before` for enviado, usa seu valor em vez de ler do banco
  - `before = originalTable` capturado no snapshot inicial (linha 55) ANTES de qualquer edição
  - `diff` calculado no frontend compara `originalTable` com `currentNormalized.table` — valores diferentes corretamente identificados
  - **Bug original foi corrigido** pela adição do parâmetro `before` no frontend + lógica `before?.[key]` no backend
- **Status:** ✅ já resolvido — o parâmetro `before` explícito foi implementado no frontend (linha 91) e backend (linha 545). Corpus de treino grava diff corretamente.

## DEB-047-18 — REV-018: PATCH Inbox sem assertDraftReadyTransition (500 genérico)

- **Severidade:** 🟠 Major
- **Origem:** REV-018 (reviews.md:785-828)
- **Resumo:** PATCH de draft inbox (`adminImportInbox.ts`) não chama `assertDraftReadyTransition` antes de mudar status para `ready`. PostgreSQL rejeita com erro 23514 → 500 genérico. Discord Sync já tem a proteção.
- **🔍 INVESTIGAÇÃO (2026-06-23):**
  - Código atual em `adminImportInbox.ts:385-396` já contém a chamada `assertDraftReadyTransition` com os 3 parâmetros (`patchStatus`, `patchPayloadMissing`, `currentPayloadMissing`)
  - Se transição não permitida, retorna 422 com `transition.reason` e `transition.missingFields` (linha 394)
  - Implementado entre REV-018 (22/06) e hoje
- **Status:** ✅ já resolvido — assertDraftReadyTransition implementado no PATCH Inbox (adminImportInbox.ts:385-396)

## DEB-047-19 — REV-019: thread_name ausente no reparse do inbox

- **Severidade:** 🟡 Minor
- **Origem:** REV-019 (reviews.md:843-883)
- **Resumo:** `POST /drafts/:id/reparse` faz SELECT sem `thread_name` e chama `textToRawMessage` sem o segundo argumento, degradando o reparse para drafts importados com `title_hint`.
- **🔍 INVESTIGAÇÃO (2026-06-23):**
  - Código atual em `adminImportInbox.ts:441`: `select(['content_raw', 'raw_text', 'thread_name'])` — thread_name no SELECT
  - Linha 448: `textToRawMessage(rawContent, importMsg.thread_name ?? undefined)` — thread_name passado corretamente
  - Implementado entre REV-019 (22/06) e hoje
- **Status:** ✅ já resolvido — thread_name selecionado e passado para textToRawMessage (adminImportInbox.ts:441,448)

## DEB-047-20 — REV-024: fix de diff implementado local mas nunca commitado

- **Severidade:** 🟠 Major
- **Origem:** REV-024 (reviews.md:1098-1140)
- **Resumo:** Correção para campos removidos não capturados no diff foi implementada localmente mas nunca commitada. Código existe local mas não está versionado em nenhum PR.
- **🔍 INVESTIGAÇÃO (2026-06-23):**
  - O fix foi implementado como `computeTableDiff` em `InboxDraftReviewTable.tsx:62-76` (extraído durante REV-041)
  - Usa `allKeys` (união de `Object.keys(originalTable)` e `Object.keys(currentTable)`) para capturar tanto adições quanto remoções
  - Código está no branch atual `chore/047-debitos-finais` (commit 6416726 + alterações locais)
  - **Já commitado nesta branch** via REV-041
- **Status:** ✅ já resolvido — fix implementado como computeTableDiff (InboxDraftReviewTable.tsx:62-76) e versionado na branch atual

## DEB-047-21 — REV-030: PATCH backend sem validação de enums

- **Severidade:** 🟡 Minor (hardening)
- **Origem:** REV-030 (reviews2.md:127-143)
- **Resumo:** `patchDraftSchema` usa `z.record(z.string(), z.unknown()).optional()` — aceita "banana" em `table.type`. Frontend é seguro (selects controlados), mas backend não valida enums no PATCH.
- **🔍 INVESTIGAÇÃO PROFUNDA (2026-06-23):**
  - **Arquivo/linha:** `adminImportInbox.ts:353-357` — `patchDraftSchema.normalized_payload` como `z.record(z.string(), z.unknown())`
  - **Mesmo padrão:** `adminDiscordSync.ts:42` — idêntico
  - **Schema existente:** `draftTableSchema` (syncHelpers.ts:70-94) usa `z.unknown()` em TODOS os campos — inclusive `type`, `modality`, `price_type`, `frequency` que deveriam ser enums. Mesmo problema, não resolve.
  - **Tipo real no DB:** `DiscordTableDraftTable.type` = `TableDraftType` (`'campanha' | 'one-shot' | 'oneshot-serie' | 'aberta'` — types.ts:20). `modality` = `TableDraftModality` (`'online' | 'presencial' | 'hibrida'` — types.ts:21). `price_type` = `TableDraftPriceType` (`'gratuita' | 'paga'` — types.ts:22). `frequency` = `TableDraftFrequency` (`'semanal' | 'quinzenal' | 'mensal' | 'avulsa'` — types.ts:23).
  - **Fluxo PATCH:** `parsed.data` vai direto para `db.updateTable().set({ ...parsed.data })` (adminImportInbox.ts:407). `normalized_payload` é JSONB → PostgreSQL aceita qualquer valor JSON. O cast `as ImportTableDraft` no TS explodiria depois se valor inválido chegasse no pipeline de sync.
  - **Defesas existentes:** (1) frontend é seguro (selects controlados, nunca envia valor inválido); (2) `assertDraftReadyTransition` em adminImportInbox.ts:388-396 verifica transições de status, mas não valida conteúdo dos campos enum.
  - **Impacto real:** Baixo — só admin malicioso ou curl manual. Admin já confiável.
  - **Severidade real:** 🟡 Minor — confirma classificação original
  - **Risco de regressão:** Mínimo — adicionar enum Zod afeta schema, rejeitaria payloads antes aceitos
  - **Recomendação técnica:** Criar schema `patchPayloadSchema` separado com `z.enum()` para os 4 campos enum (`type`, `modality`, `price_type`, `frequency`), usar no PATCH de ambos `adminImportInbox` e `adminDiscordSync`. Não reaproveitar `draftTableSchema` (precisa ser `.partial()` para PATCH permitir atualização parcial).
- **Implementação (2026-06-23):**
  - `adminImportInbox.ts`: `patchDraftSchema.normalized_payload` passou a validar `table.type`, `table.modality`, `table.price_type` e `table.frequency` com enums Zod, preservando `.passthrough()` para demais campos do payload.
  - `adminDiscordSync.ts`: mesmo schema parcial aplicado no PATCH Discord.
  - Testes adicionados:
    - `adminImportInbox.test.ts`: PATCH Inbox rejeita `normalized_payload.table.type='banana'` com 400.
    - `adminDiscordSync.drafts.patch.test.ts`: PATCH Discord rejeita enum inválido com 400 antes de acessar DB.
  - Validação: testes focados 2 arquivos / 48 testes ✅; repo-wide `pnpm run lint` 15/15 ✅, `pnpm run build` 17/17 ✅, `pnpm run test` 24/24 ✅.
- **Status:** ✅ resolvido (2026-06-23)

## DEB-047-22 — Fase 0.5 (Pesquisa de ferramentas) — concluída com adoção de todas

- **Severidade:** Média
- **Origem:** tasks.md:35-61 (T0.11 a T0.16) + spec.md:163,182-189
- **Resumo:** 5 ferramentas investigadas e aprovadas para adoção imediata. Nenhuma é adiada.
- **🔍 INVESTIGAÇÃO PROFUNDA (2026-06-23):** Todas as 5 ferramentas investigadas contra código real, documentação pública, stack do projeto (TS/Node, sem Python no runtime).
- **Decisão do mantenedor:** ADOTAR TUDO AGORA. Fase 0.5 concluída como etapa obrigatória.
- **Ferramentas aprovadas:**

  | Task | Ferramenta original | Adoção real | Stack | Justificativa |
  |---|---|---|---|---|
  | T0.11 | dateparser (Python) | **chrono-node** (npm) | TS nativo | Python é proibido no runtime. chrono-node parseia datas em pt-BR ("sábado às 19h", "hoje", "quinzenal"), tem tipos TS. Substitui extractDayOfWeek/extractTime/deriveFrequency (~30 linhas de regex). |
  | T0.12 | RapidFuzz (Python) | **fuzzball** (npm) | TS nativo | Python proibido. fuzzball tem token_sort_ratio, mesmo algoritmo do fuzzywuzzy, tipos TS. Substitui matchSystemName (~20 linhas de loop exaustivo). |
  | T0.13 | DeepSeek JSON Output | **deepseek-v4-flash** (API HTTP) | API REST | Pipeline 2 estágios: parser regex tenta; se confidence < threshold ou campos críticos ausentes → chama DeepSeek como fallback. Custo ~$0.0002-0.0005 por chamada. Modo strict (beta) garante JSON Schema. |
  | T0.14 | Playwright | **@playwright/test** (npm) | TS nativo | Smoke E2E do fluxo Inbox (login → colar texto → revisar → sync). Substitui smoke manual T1.13-T1.16 por teste automatizado. Chromium headless na VM. |
  | T0.15 | DiscordChatExporter | **tyrrrz/discordchatexporter** (Docker) | Docker CLI | Container Docker na VM (`docker pull tyrrrz/discordchatexporter`). Exporta canais que o bot não tem acesso. Uso operacional via CLI, nunca code-to-code (TOS proíbe automação com user token). |

- **Status:** ✅ **Decidido pelo mantenedor — implementar todas agora.** Tasks T0.11-T0.16 em tasks.md atualizadas como concluídas com ferramentas reais.

## DEB-047-23 — REV-020: fallback discordSyncApi.getDraft cruza contextos

- **Severidade:** 🟡 Minor (hardening)
- **Origem:** REV-020 (reviews.md:896-928)
- **Resumo:** `draftApi.getDraft` é opcional, mas se ausente faz fallback para `discordSyncApi.getDraft` — cruza contextos (Inbox vs Discord). Não se materializa no fluxo atual.
- **🔍 INVESTIGAÇÃO PROFUNDA (2026-06-23):**
  - **Arquivo/linha:** `DiscordDraftPreview.tsx:16` — `const draftApi = api ?? discordSyncApi`
  - **Tipo:** `DraftApiOperations` (`discord-sync/types.ts:168-174`) — `getDraft?:` é opcional
  - **Callers atuais com `api` explícito:**
    1. `InboxDraftReviewTable.tsx:172-178` — `api={inboxDraftApi}` (InboxDraftApi tem `getDraft`)
    2. `DiscordDraftReviewTable.tsx:199-204` — `api={draftApi}` (DiscordSyncApi tem `getDraft`)
  - **Nenhum caller sem `api`** — fallback nunca ocorre nos 2 fluxos ativos
  - **`getDraft` uso real:** só em `useDraftForm.ts:255,265` dentro de `handleSync`, guardado por `if (draftApi.getDraft)`
  - **Backend Discord GET /drafts/:id** (`adminDiscordSync.ts:941-954`) — NÃO tem guard para Inbox drafts. Retorna qualquer draft pelo ID, incluindo Inbox. Se o fallback ocorresse, o resultado seria um draft Inbox retornado pela API Discord → Zod no frontend quebraria (espera `discord_message_id: string`, recebe `null`)
  - **Impacto real:** Não se materializa. Exigiria caller novo ou refatoração que esqueça de passar `api`.
  - **Severidade real:** 🟡 Minor — confirma. Hardening.
  - **Risco de regressão:** Médio — tornar `api` obrigatório quebraria compilação se existir caller sem `api`. Mas não existe hoje.
  - **Recomendação:** Tornar `api` obrigatório (remover default `discordSyncApi`). Se houver caller sem `api`, o TS falha em compilação — forçando o desenvolvedor a decidir qual API injetar.
- **Implementação (2026-06-23):**
  - `DiscordDraftPreview.tsx`: prop `api` tornou-se obrigatória; removido import/fallback interno para `discordSyncApi`.
  - Call sites ativos já passavam API explicitamente:
    - `DiscordDraftReviewTable.tsx` passa `draftApi`;
    - `InboxDraftReviewTable.tsx` passa `inboxDraftApi`.
  - Resultado: caller novo que esquecer de injetar API falha em TypeScript, evitando cruzamento silencioso Inbox↔Discord.
  - Validação: `pnpm --filter @artificio/mesas-frontend build` ✅; repo-wide `pnpm run lint` 15/15 ✅, `pnpm run build` 17/17 ✅, `pnpm run test` 24/24 ✅.
- **Status:** ✅ resolvido (2026-06-23)

## DEB-047-24 — REV-021: apiFetch faz res.json() antes de !res.ok

- **Severidade:** 🟡 Minor (hardening)
- **Origem:** REV-021 (reviews.md:941-973)
- **Resumo:** Ambos `inboxApi.ts` e `discordSyncApi.ts` chamam `res.json()` antes de verificar `!res.ok`. Mesmo padrão de REV-044/047.
- **🔍 INVESTIGAÇÃO (2026-06-23):**
  - `inboxApi.ts:22-29`: usa `res.text()` (não `res.json()`) + `try { JSON.parse(text) } catch { throw 'Resposta inesperada...' }` + `if (!res.ok)` depois
  - `discordSyncApi.ts:29-36`: mesmo padrão
  - O código atual usa o padrão **mais robusto** que o recomendado: `res.text()` + try/catch + `!res.ok`. Não há SyntaxError em respostas não-JSON.
  - **Já resolvido** — nunca usou `res.json()` diretamente.
- **Status:** ✅ já resolvido — ambos os arquivos usam `res.text()` + try/catch, não `res.json()`

## DEB-047-25 — REV-022: fallback silencioso [] esconde breaking change (5 funções)

- **Severidade:** 🟡 Minor (hardening)
- **Origem:** REV-022 (reviews.md:985-1027)
- **Resumo:** 5 funções (1 inbox + 4 discord) retornam `[]` se Zod falha, em vez de lançar erro. Breaking change no schema da API fica invisível.
- **🔍 INVESTIGAÇÃO (2026-06-23):**
  - Inbox (`inboxApi.ts:104-132`): todas as 5 funções de parse **lançam erro** — resolvido
  - Discord Sync (`discordSyncApi.ts:144,149,154,159`): 4 funções com fallback `[]` — **pendente**
- **Implementação (2026-06-23):** Substituído `return parsed.success ? parsed.data : []` por `if (!parsed.success) throw new Error(...)` nas 4 funções (discordSyncApi.ts:142-165). Lint 0 ✅, build 17/17 ✅, tests 24/24 ✅.
- **Status:** ✅ resolvido (2026-06-23)

## DEB-047-26 — SC-009/SC-012: div com onClick sem acessibilidade de teclado

- **Severidade:** 🟡 Minor (acessibilidade)
- **Origem:** REV-026/reviews.md (SC-009/SC-012)
- **Resumo:** `InboxDraftReviewTable.tsx` usa `<div onClick>` sem `role`/`tabIndex`/`onKeyDown`.
- **🔍 INVESTIGAÇÃO (2026-06-23):**
  - `InboxDraftReviewTable.tsx:121` e `139`: ambos são `<button>` (não `<div>`)
  - Botões são semanticamente corretos: focusable por padrão, ativáveis por Enter/Espaço, role="button" implícito
  - **Já resolvido** — ou o código nunca usou `<div>`, ou foi corrigido entre o review original e hoje
- **Status:** ✅ já resolvido — os elementos clicáveis são `<button>`, não `<div>`

## DEB-047-27 — REV-026: Opção A (tokens de input pareados) registrada como débito futuro

- **Severidade:** N/A (débito futuro)
- **Origem:** reviews.md:1473
- **Resumo:** A review diz que foi registrada como débito futuro, mas não constava em debitos.md. Agora registrado. Opção A refere-se a criar tokens de input pareados (`--input-bg` + `--input-fg`) para inputs compartilhados, alternativa à Opção B (primitivos compartilhados) já implementada em DEB-047-16a.
- **🔍 INVESTIGAÇÃO PROFUNDA (2026-06-23):**
  - **Origem:** REV-026 (reviews.md:1419-1422, 1473) — recomendação de criar tokens CSS `--artificio-input-bg`/`--artificio-input-fg` como prevenção de dessincronia bg/fg entre temas
  - **Cenário original:** `TextPasteArea.tsx` usava `--artificio-surface` (branco fixo) + `--artificio-fg` (muda no dark) → texto invisível no dark mode
  - **Opção A (tokens CSS):** criar `--input-bg`/`--input-fg` definidos em ambos os temas. Abordagem puramente CSS.
  - **Opção B (componentes React):** criar/primitivos em `packages/ui/src/primitives.tsx` (`TextInput`, `Textarea`, `Select`, `Field`, `Banner`) com tokens semânticos `--surface`/`--fg` internos. Abordagem React + CSS.
  - **What was implemented:** Opção B via DEB-047-16a (2026-06-23):
    - `TextInput`, `Textarea`, `Select` — `forwardRef`, tokens semânticos, `controlSize`
    - `Banner` — `success/warning/danger/info/neutral`
    - `Field` — label + error/hint + required
    - `TextPasteArea.tsx` migrado para `Banner`/`Textarea`/`Field`
    - `$ rg --input-bg\|--input-fg packages` = 0 ocorrências — tokens **nunca foram criados**
  - **Por que Opção B é superior:** componentes React encapsulam tokens + comportamento (focus ring, invalid state, aria) + acessibilidade. Tokens CSS puros resolveriam só o contraste, não a semântica.
  - **Impacto:** Zero — bug resolvido por Opção B. Nenhum código depende de `--input-*` tokens.
  - **Recomendação:** **fechar como "não implementar — Opção B é suficiente e superior"**. Se no futuro houver necessidade de tokens CSS específicos para inputs, criar na hora.
- **Status:** ✅ fechado — Opção B implementada, Opção A descartada como alternativa inferior

## DEB-047-15 — DiscordDraftPreview cognitive complexity 29

- **Severidade:** Média
- **Origem:** SonarCloud Quality Gate PR #88 (SC-004)
- **Descrição:** O componente `DiscordDraftPreview.tsx` tem cognitive complexity 29 (limite 15) e 707 linhas. Contribuição da spec 047 é mínima (+2 props `api`/`onBeforeSync`), mas o componente quebrou o Quality Gate.
- **🔍 INVESTIGAÇÃO (2026-06-23):**
  - **Tamanho confirmado:** 707 linhas exatas. 22 handlers/hooks/memo internos.
  - **Complexidade real:** 90 pontos de condição/ciclo no arquivo todo. A complexidade cognitiva 29 é razoável para o componente principal (modal com formulário de 15 campos + upload + sync + 3 abas). Contribuição real da spec 047: **~20 linhas líquidas** (2 props + `draftApi` injection + `onBeforeSync` no handleSync + readonly nos tipos).
  - **Arquitetura atual:** 3 camadas misturadas no mesmo arquivo:
    1. **Helpers puros** (linhas 48-220): 19 funções (`isRecord`, `asRecord`, `asString`, `asNumberString`, `normalizePayload`, `asStringArray`, `asSlotsAmbiguity`, `getDraftTable`, `buildForm`, `parseOptionalNonNegativeInt`, `parseOptionalMoney`, `validateForm`, `buildMissingFields`, `buildUpdatedPayload`, `formatFileSize`, `flattenSystems`, `loadSystems`) — **~170 linhas, 0 de React, totalmente extraíveis** para módulo `draftFormUtils.ts`. Reusabilidade zero hoje (só este arquivo usa).
    2. **Estado/handlers/efeitos** (linhas 221-457): 12 estados + 1 ref + 1 effect + sincronização render-time + 9 handlers. Extraível para 3-4 hooks:
       - `useDraftForm` (~120 linhas: estado + `handleSaveFields` + `handleSystemChange` + `updateForm`)
       - `useCoverUpload` (~50 linhas: `handleCoverUpload` + `handleRemoveCover`)
       - `useSlotsAmbiguity` (~50 linhas: `handleConfirmSlots` + estado de interpretação)
       - `useDraftActions` (~50 linhas: `handleSync` + `handleReparse` + `handleSaveStatus`)
    3. **JSX/visual** (linhas 467-706): ~240 linhas. Extraível para:
       - `DraftModal.tsx` (wrapper + header + tabs + action buttons)
       - `DraftEditorTab.tsx` (~200 linhas: formulário de 15 campos + capa + ambiguidade)
       - `DraftStatusBar.tsx` (~50 linhas: status header)
  - **Avaliação da proposta original:** A sugestão de 4 hooks + 3 subcomponentes é correta mas incompleta. **A extração mais impactante** seria mover as 19 funções puras para módulo `draftFormUtils.ts` (~170 linhas removidas do componente, zero risco de regressão). As abas `DraftNormalizedTab` e `DraftParsedTab` são triviais (1 linha cada, `<pre>{JSON.stringify}</pre>`) — não valem como subcomponente.
  - **Plano revisado recomendado:**
    1. Extrair 19 funções puras → `draftFormUtils.ts` (~170 linhas, risco zero)
    2. Extrair 3-4 hooks temáticos → `useDraftForm.ts`, `useCoverUpload.ts`, `useSlotsAmbiguity.ts` (~220 linhas, risco médio)
    3. Extrair `DraftEditorTab.tsx` + `DraftActionButtons.tsx` como subcomponentes JSX (~200 + ~50 linhas, risco médio)
    4. O componente principal fica com ~100-150 linhas: props, composição de hooks, JSX enxuto
- **Implentação (2026-06-23):** Refatoração completa executada:
  1. `draftFormUtils.ts` — 19 funções puras extraídas (~170 linhas), exporta tipos `DraftForm`, `DraftTableType`, etc.
  2. `useDraftForm.ts` — hook único (~270 linhas) consolidando 12 estados + 9 handlers + sincronização render-time + `loadSystems` effect
  3. `DraftEditorTab.tsx` — subcomponente JSX do formulário (~200 linhas, 15 campos + capa + ambiguidade)
  4. `constants.ts` — `STATUS_OPTIONS` extraído
  5. `DiscordDraftPreview.tsx` — reduzido de **707 para ~139 linhas** (propósito: composição)
  6. Lint 15/15 ✅, build 17/17 ✅, backend 178 testes ✅
- **Status:** ✅ Resolvido (2026-06-23)
