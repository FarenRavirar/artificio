# Sessão 26-08-04 · Remoção da automação DiscordChatExporter

**Data:** 2026-08-04  
**Branch observada:** `fix/seguranca-d13-directory-write`  
**Estado:** levantamento concluído · implementação não iniciada  
**Escopo decidido:** retirar a automação DiscordChatExporter e preservar integralmente o import manual de JSON  
**Trava do mantenedor:** não tocar no parser  
**Indexação:** não incluir em `sessoes/index.md`, por pedido nominal do mantenedor

## Resultado central

A automação DiscordChatExporter pode ser removida sem quebrar o import manual. Os dois fluxos compartilham apenas o normalizador/importador do formato JSON; a dependência é unidirecional: a automação chama o importador manual, mas o importador manual não depende de CLI, perfis, cron, pasta monitorada, volume ou configuração automática.

O rótulo `ChatExporter` em nomes de alguns arquivos não significa automação. `chatExporterAdapter.ts`, `chatExporterImportService.ts` e `discordChatExporterTypes.ts` são necessários para aceitar o arquivo JSON manual e devem permanecer.

Nenhum arquivo foi alterado durante o levantamento. Nenhuma migration ou escrita em banco foi executada.

## Fluxo que deve permanecer

```text
JSON colado ou arquivo enviado pelo admin
  -> preview e validação do formato
  -> adapter DiscordChatExporter -> ImportRawMessage
  -> persistência em discord_import_sources/discord_import_messages
  -> parser existente
  -> draft, revisão, duplicatas e métricas
```

### Backend manual — manter

1. Montagem das rotas `/import-json`:
   - `apps/mesas/backend/src/routes/adminDiscordSync.ts:35-36`
   - Não remover `previewRouter` nem `importRouter`.

2. Preview do JSON:
   - `apps/mesas/backend/src/routes/discord/preview.ts:10` — configuração Multer e limite do arquivo.
   - `apps/mesas/backend/src/routes/discord/preview.ts:27` — middleware compartilhado de upload.
   - `apps/mesas/backend/src/routes/discord/preview.ts:58` — `POST /preview`.
   - `apps/mesas/backend/src/routes/discord/preview.ts:75` — `POST /preview/file`.

3. Importação e reparse:
   - `apps/mesas/backend/src/routes/discord/import.ts:161` — `POST /`, JSON no body.
   - `apps/mesas/backend/src/routes/discord/import.ts:182` — `POST /file`, upload manual.
   - `apps/mesas/backend/src/routes/discord/import.ts:213` — `POST /reparse`.
   - `apps/mesas/backend/src/routes/discord/import.ts:102` — auto-parse em lotes.
   - `apps/mesas/backend/src/routes/discord/import.ts:31` — registro de métricas da importação manual.
   - `apps/mesas/backend/src/routes/discord/import.ts:46` — scan de duplicatas após criação/atualização de drafts.

4. Normalização e persistência do formato JSON:
   - `apps/mesas/backend/src/discord/chatExporterImportService.ts:10` — máximo de 2.000 mensagens.
   - `apps/mesas/backend/src/discord/chatExporterImportService.ts:12` — máximo de 10 MB.
   - `apps/mesas/backend/src/discord/chatExporterImportService.ts:51` — leitura do buffer enviado.
   - `apps/mesas/backend/src/discord/chatExporterImportService.ts:71` — criação/reuso da fonte Discord.
   - `apps/mesas/backend/src/discord/chatExporterImportService.ts:93` — importação e persistência.
   - `apps/mesas/backend/src/discord/chatExporterImportService.ts:187` — preview.
   - `apps/mesas/backend/src/discord/chatExporterImportService.ts:209` — extração do payload.

5. Adapter e schemas do formato:
   - `apps/mesas/backend/src/discord/chatExporterAdapter.ts:14` — valida JSON exportado.
   - `apps/mesas/backend/src/discord/chatExporterAdapter.ts:39` — converte mensagem para o formato de importação.
   - `apps/mesas/backend/src/discord/discordChatExporterTypes.ts:3-113` — schemas Zod do arquivo ChatExporter.

6. Orquestração usada pelo import manual:
   - `apps/mesas/backend/src/routes/discord/utils.ts:376` — `recordImportRun`.
   - `apps/mesas/backend/src/routes/discord/utils.ts:511` — índice de conteúdo/replies.
   - `apps/mesas/backend/src/routes/discord/utils.ts:1114` — validação dos IDs no reparse.
   - `apps/mesas/backend/src/routes/discord/utils.ts:1138` — parse/reparse de cada mensagem.
   - `apps/mesas/backend/src/services/tableDuplicateDetection.ts` — scan disparado pelo import manual.

### Frontend manual — manter

1. Entrada visual:
   - `apps/mesas/frontend/src/features/admin/components/IntegracoesSection.tsx:95-102` — aba “Importar arquivo”.
   - `apps/mesas/frontend/src/features/admin/components/IntegracoesSection.tsx:140-143` — painel do upload manual.

2. Componentes e estado:
   - `apps/mesas/frontend/src/features/discord-sync/components/DiscordJsonImportPanel.tsx`
   - `apps/mesas/frontend/src/features/discord-sync/hooks/useJsonImport.ts`
   - `apps/mesas/frontend/src/features/discord-sync/components/ImportResultGrid.tsx`
   - `apps/mesas/frontend/src/features/discord-sync/components/JsonPreviewCard.tsx`
   - `apps/mesas/frontend/src/features/discord-sync/draftFormUtils.ts`

3. Contrato cliente:
   - `apps/mesas/frontend/src/features/discord-sync/api/discordSyncApi.ts:331` — schema do resultado da importação.
   - `apps/mesas/frontend/src/features/discord-sync/api/discordSyncApi.ts:346` — schema do preview.
   - `apps/mesas/frontend/src/features/discord-sync/api/discordSyncApi.ts:365` — schema do reparse.
   - `apps/mesas/frontend/src/features/discord-sync/api/discordSyncApi.ts:516` — upload multipart compartilhado.
   - `apps/mesas/frontend/src/features/discord-sync/api/discordSyncApi.ts:705` — `importJson`.
   - `apps/mesas/frontend/src/features/discord-sync/api/discordSyncApi.ts:713` — `previewJson`.
   - `apps/mesas/frontend/src/features/discord-sync/api/discordSyncApi.ts:727` — `previewFile`.
   - `apps/mesas/frontend/src/features/discord-sync/api/discordSyncApi.ts:730` — `importFile`.
   - `apps/mesas/frontend/src/features/discord-sync/api/discordSyncApi.ts:737` — `reparsePending`.

4. Métricas:
   - `apps/mesas/frontend/src/features/discord-sync/components/IntegrationLogsView.tsx:8` — `discord_chat_exporter_json` aparece como “Importação JSON”. Manter.

### Banco do fluxo manual — manter

- `discord_import_sources`, `discord_import_messages` e `discord_import_table_drafts`, criadas em `migration_115_discord_import.sql`.
- Campo `reference` de `migration_130_discord_reference.sql`.
- `discord_import_runs` de `migration_131_discord_import_runs.sql` — recebe os registros do upload manual.
- Tipos Kysely dessas tabelas em `apps/mesas/backend/src/db/types.ts`.
- `DiscordImportSourceKind = 'discord_bot' | 'discord_chat_exporter_json'` em `apps/mesas/backend/src/db/types.ts:641`.
- Todas as mensagens, drafts, correções, regras de aprendizado, avaliações e duplicatas já geradas.

**Trava importante:** nunca remover dados ou tipos apenas porque contêm `discord_chat_exporter_json`. Esse `source_kind` identifica justamente o JSON importado manualmente.

### Testes e fixtures manuais — manter

- `apps/mesas/backend/src/discord/__tests__/chatExporterAdapter.test.ts`
- `apps/mesas/backend/src/discord/__tests__/chatExporterImportService.test.ts`
- `apps/mesas/backend/src/routes/discord/import.test.ts`
- `apps/mesas/frontend/src/features/discord-sync/components/DiscordJsonImportPanel.test.tsx`
- Casos manuais em `apps/mesas/frontend/src/features/discord-sync/api/discordSyncApi.test.ts`, especialmente `importJson`, `previewJson`, `previewFile` e `importFile`.
- `apps/mesas/backend/src/discord/__tests__/fixtures/chatExporterSample.ts` — também alimenta testes do parser; não remover.

## Parser — intocável

Não editar, mover, renomear ou “limpar” por associação:

- `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts`
- Testes `parseDiscordAnnouncement*.test.ts`
- `parseLearning.test.ts`
- Fixtures do parser, inclusive `chatExporterSample.ts` e `parserPhase11Samples.ts`
- Regras de aprendizado, shadow/eval, correções e catálogos usados pelo parser
- Funções de parse/reparse em `routes/discord/utils.ts`

`chatExporterImportService.ts` importa `sanitizeJsonValue` do parser. Essa dependência deve continuar como está.

## Automação que pode ser removida

### Arquivos backend inteiros

1. `apps/mesas/backend/src/discord/chatExporterCliRunner.ts`
2. `apps/mesas/backend/src/discord/chatExporterAutomationConfig.ts`
3. `apps/mesas/backend/src/discord/chatExporterFolderImportService.ts`
4. `apps/mesas/backend/src/discord/chatExporterProfileRunner.ts`
5. `apps/mesas/backend/src/discord/chatExporterSchedule.ts`
6. `apps/mesas/backend/src/routes/discord/chatExporterAutomation.ts`
7. `apps/mesas/backend/src/scripts/exportDiscordChatExporter.ts`
8. `apps/mesas/backend/src/scripts/importDiscordChatExporterFolder.ts`
9. `apps/mesas/backend/src/scripts/runDiscordChatExporterSchedule.ts`

`importDiscordChatExporterFolder.ts` pode ser disparado manualmente pela CLI, mas não é o import manual da interface. Ele implementa o transporte por diretórios `incoming/processing/processed/error` e existe para suportar a automação. Recomendação do levantamento: remover junto.

### Rotas automáticas

Remover a montagem em `apps/mesas/backend/src/routes/adminDiscordSync.ts:39` e os doze endpoints de `chatExporterAutomation.ts`:

1. `POST /validate-token`
2. `GET /config`
3. `PUT /config`
4. `GET /profiles`
5. `POST /profiles`
6. `PATCH /profiles/:id`
7. `DELETE /profiles/:id`
8. `GET /profiles/:id/delta`
9. `POST /profiles/:id/test`
10. `POST /profiles/:id/run`
11. `POST /test`
12. `POST /run`

As cinco rotas `/import-json/**` descritas na seção manual permanecem.

### Cron e scripts npm

Remover de `apps/mesas/backend/src/scripts/cronRunner.ts:27-30`:

- constante `CHAT_EXPORTER_TICK_MS`;
- `setInterval` de `discord:chat-exporter-schedule`.

Remover de `apps/mesas/backend/package.json:26-37`:

- `discord:export-chat`
- `discord:export-chat:dev`
- `discord:import-folder`
- `discord:import-folder:dev`
- `discord:chat-exporter-schedule`
- `discord:chat-exporter-schedule:dev`

### Docker e Compose

Remover do `apps/mesas/backend/Dockerfile`:

- stage `tyrrrz/discordchatexporter:2.47.3` em `:6-7`;
- `DISCORD_CHAT_EXPORTER_BIN` em `:31`;
- pacotes/comentários exclusivos da CLI, após verificar quais ainda servem ao backend;
- `COPY --from=discord-chat-exporter /opt/app /opt/dce` em `:96`;
- `chmod/chown` de `/opt/dce` em `:105-106`.

As mudanças D13 ainda locais também deixam de fazer sentido:

- `/data/chat-exporter` no Dockerfile;
- `DISCORD_CHAT_EXPORTER_IMPORT_BASE_DIR` nos compose;
- volumes `chat_exporter_data_beta` e `chat_exporter_data_prod`;
- montagem compartilhada do volume entre API e cron.

Efeito operacional esperado: imagem menor, sem binário de terceiros e sem volume persistente exclusivo da automação.

### Frontend automático

Remover integralmente:

- `apps/mesas/frontend/src/features/discord-sync/components/ChatExporterProfilesPanel.tsx` — 928 linhas.

Remover parcialmente:

- import/render de `ChatExporterProfilesPanel` em `IntegracoesSection.tsx:8,127`;
- tipos de automação em `features/discord-sync/types.ts:245-333`;
- schemas/parsers automáticos em `discordSyncApi.ts:66-136,241-259`;
- métodos `get/save/validate/test/run` globais e CRUD/test/run/delta dos perfis em `discordSyncApi.ts:555-601`;
- bloco de testes `describe('chatExporter')` em `discordSyncApi.test.ts:73-120`.

Não remover `discoverGuilds` nem `discoverChannels`: `DiscordSourceList.tsx:81,115` ainda usa ambos para o bot de Discord.

### Descoberta Discord — remoção parcial

Em `apps/mesas/backend/src/discord/discovery.ts`, remover somente:

- `validateDiscordToken` em `:157`, exclusivo da automação;
- `DISCORD_DELTA_PAGE_LIMIT` em `:203`;
- `discoverChannelDelta` em `:220`.

Remover os exports correspondentes de `apps/mesas/backend/src/discord/index.ts:28`.

Manter `discoverDiscordGuilds`, `discoverDiscordChannels`, `DiscordDiscoveryError` e helpers usados pelo bot.

### Tipos de banco automáticos

Após remover todos os consumidores, retirar de `apps/mesas/backend/src/db/types.ts:1045-1078`:

- `DiscordChatExporterProfileFrequency`
- `DiscordChatExporterIncludeThreads`
- `DiscordChatExporterAuthType`
- `DiscordChatExporterProfilesTable`
- aliases de select/insert/update
- propriedade `discord_chat_exporter_profiles` da interface `Database`, hoje em `:1159`

Não tocar nos tipos do import manual descritos acima.

### Testes automáticos

Remover:

- `chatExporterCliRunner.test.ts`
- `chatExporterFolderImportService.test.ts`
- `chatExporterSchedule.test.ts`
- `chatExporterAutomationConfig.test.ts`
- `chatExporterProfileRunner.security.test.ts`
- `routes/discord/chatExporterAutomation.test.ts`

Os três últimos foram criados localmente durante D13 e ainda não estão rastreados.

### API gerada

Depois da remoção, rodar `rtk pnpm verify:api`. A geração deve retirar os doze endpoints automáticos de:

- `docs/api/generated/api-inventory.generated.json`
- `docs/api/generated/api-map.generated.md`
- `docs/api/generated/api-consumers.generated.json`
- `docs/api/generated/artificio-api.bundle.json`
- `docs/api/generated/api-index.generated.md`
- `docs/api/openapi/mesas.openapi.yaml`
- HTML gerado, se alterado pelo pipeline

As cinco operações `/import-json/**` devem permanecer.

## Banco real — evidência read-only de 2026-08-04

Consulta executada em produção e beta, sem imprimir payload, token ou configuração:

```sql
SELECT
  (SELECT count(*) FROM discord_chat_exporter_profiles),
  (SELECT count(*)
     FROM discord_settings
    WHERE guild_id IS NULL
      AND key IN ('chat_exporter_config', 'chat_exporter_token'));
```

Resultado:

| Ambiente | Perfis | Config/token global |
|---|---:|---:|
| Produção | 0 | 0 |
| Beta | 0 | 0 |

Não há dado de automação atual a migrar. Isso não autoriza apagar mensagens ou runs com `source_kind = 'discord_chat_exporter_json'`, pois pertencem ao import manual.

## Migrations 134 e 135

As migrations abaixo já fazem parte do histórico e não devem ser apagadas nem reescritas:

- `apps/mesas/database/migration_134_discord_chat_exporter_profiles.sql`
- `apps/mesas/database/migration_135_discord_chat_exporter_auth_type.sql`

Há duas opções para o estado final:

### Opção A — cleanup completo, recomendada pelo levantamento

Criar migration nova que:

1. remove `discord_chat_exporter_profiles`;
2. remove de `discord_settings` apenas as chaves globais `chat_exporter_config` e `chat_exporter_token`.

É migration destrutiva: `DROP TABLE`/`DELETE` exigem classe `manual-risk`, backup, plano de rollback e autorização nominal antes da ação.

### Opção B — tabela inerte

Remover todo código, UI, CLI, cron e deploy, mas deixar tabela e eventuais chaves sem consumidores. Menos risco operacional imediato; deixa resíduo técnico deliberado.

## Relação com D13

A correção D13 foi implementada localmente antes da decisão de retirar a automação. Ela adicionou contenção de diretório, testes, base `/data/chat-exporter` e volumes.

Se a automação e o import por pasta forem removidos, D13 deixa de ter sink e sua implementação não deve seguir como correção independente. Os arquivos/trechos D13 serão removidos ou absorvidos pela retirada, não commitados separadamente.

Não apagar nem resetar nada sem revisar o worktree: há mudanças locais de outras frentes.

## Estado do worktree observado

Além do trabalho D13, apareceram alterações locais em arquivos de contatos/XSS durante o levantamento:

- `apps/mesas/backend/src/utils/contactUrls.ts`
- `apps/mesas/backend/src/utils/contactUrls.test.ts`
- `apps/mesas/backend/src/validators/tableValidators.ts`
- `apps/mesas/frontend/src/components/mestre/ContactMethodsEditor.tsx`
- `apps/mesas/frontend/src/features/create-table/utils/validation.ts`
- `apps/mesas/frontend/src/test/contactXss.test.tsx`
- `apps/mesas/frontend/src/utils/safeExternalUrl.ts`

Essas alterações não foram inspecionadas nem tocadas nesta investigação. `sessoes/prompt-codex-d13.md` também permanece não rastreado.

## Decisões pendentes antes de implementar

1. Confirmar que “import manual” significa a interface de upload/JSON colado e que `discord:import-folder` também deve sair. Recomendação: remover.
2. Escolher cleanup do banco:
   - migration nova destrutiva; ou
   - tabela inerte.
3. Confirmar como tratar as mudanças locais simultâneas antes de editar/commitar. Nenhum reset, descarte ou separação de escopo pode ser inferido pelo agente.

## Validação exigida após implementação

1. Busca final por automação:
   - nenhum endpoint `/chat-exporter`;
   - nenhum perfil, cron, CLI, binário, env ou volume de automação;
   - nenhum método/tipo frontend automático.
2. Busca negativa garantindo preservação:
   - cinco endpoints `/import-json/**` presentes;
   - `chatExporterAdapter`, `chatExporterImportService` e schemas presentes;
   - parser sem diff;
   - `discord_chat_exporter_json` presente nos contratos e métricas manuais.
3. Testes backend do adapter, import service, import route e parser.
4. Testes frontend do painel manual, hook e API manual.
5. Testes completos do backend e frontend de mesas.
6. `rtk pnpm run lint`.
7. `rtk pnpm run build`.
8. `rtk pnpm verify:api`.
9. `git diff --check`.

## Encerramento desta sessão

Levantamento concluído. Nenhuma implementação, commit, push, PR, deploy ou escrita em banco autorizada/executada. Sessão criada sem atualização de `sessoes/index.md`, conforme pedido.
