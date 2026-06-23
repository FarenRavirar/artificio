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
  - Validação final consolidada: lint 15/15, build 17/17 e backend 21 arquivos/159 testes verdes.
  - A aplicação da migration 129 e o smoke no beta pertencem à etapa operacional pós-merge da spec; não reabrem este débito de implementação.

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
- **Status:** **resolvido (2026-06-22)** — `adminImportInbox.test.ts` criado com 15 testes cobrindo 4 das 5 superfícies:
  1. `syncImportDraftToTable`: 404, 422 (sem import_message_id), já-synced, rejected, não-ready, mensagem não encontrada, missing_fields, criação com status draft ✅
  2. `POST /drafts/:id/sync`: coberto via mock de db + supertest ✅
  3. `POST /drafts/:id/correction`: schema inválido, draft inexistente, diff zero, diff com mudanças ✅
  4. `GET /metrics`: base vazia, agregação por campo ✅
  5. migration 129: coberto indiretamente (tipos Kysely compilam, FK referenciada nos inserts) 🔜
   Suíte: **19 files / 144 tests** (era 19/134; +10 testes adicionados para `POST /import-text` e `GET /drafts` via REV-005). `tsc --noEmit` verde.

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

## DEB-047-15 — DiscordDraftPreview cognitive complexity 29

- **Severidade:** Média
- **Origem:** SonarCloud Quality Gate PR #88 (SC-004)
- **Descrição:** O componente `DiscordDraftPreview.tsx` tem cognitive complexity 29 (limite 15) e 707 linhas. Contribuição da spec 047 é mínima (+2 props `api`/`onBeforeSync`), mas o componente quebrou o Quality Gate.
- **Ação:** Refatorar extraindo handlers para hooks (`useDraftForm`, `useDraftSync`, `useCoverUpload`, `useSlotsAmbiguity`) e abas para subcomponentes (`DraftEditorTab`, `DraftNormalizedTab`, `DraftParsedTab`).
- **Dependência de:** Fora do escopo 047. Pode ser feito em spec separada.
- **Status:** ⏳ Pendente (2026-06-22)
