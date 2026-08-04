# Prompt Codex — Remoção da automação DiscordChatExporter (mesas)

**Origem:** sessão `sessoes/26-08-04_1_remocao-chat-exporter.md` (levantamento completo, leitura obrigatória antes de editar).
**Base:** branch nova a partir de `dev` atualizado (`c519f76`).
**Autor do levantamento:** Claude Code. **Implementação:** Codex.

---

## Objetivo

Retirar integralmente a automação DiscordChatExporter (CLI, perfis, cron, agendamento, import por pasta, rotas automáticas, painel de perfis, binário no container) **preservando integralmente o import manual de JSON** da interface de administração.

A automação nunca funcionou em produção. Produção e beta têm **0 perfis** e **0 chaves globais** de configuração (evidência read-only registrada na sessão, 2026-08-04). Não há dado a migrar.

## Travas do mantenedor — inegociáveis

1. **Não tocar no parser.** Nenhuma edição, renomeação, movimentação ou "limpeza por associação" em `parseDiscordAnnouncement.ts`, seus testes, fixtures, regras de aprendizado, shadow/eval, correções, catálogos, nem nas funções de parse/reparse de `routes/discord/utils.ts`.
2. **Preservar o import manual de JSON por completo.** O rótulo `ChatExporter` em nome de arquivo **não** significa automação: `chatExporterAdapter.ts`, `chatExporterImportService.ts` e `discordChatExporterTypes.ts` são o formato do arquivo JSON manual e **permanecem**.
3. **Nunca remover dado, tipo ou constante só por conter `discord_chat_exporter_json`.** Esse `source_kind` identifica justamente o JSON importado manualmente.
4. **Banco: Opção B — tabela inerte.** Decisão do mantenedor em 2026-08-04. **Não criar migration nesta entrega.** A tabela `discord_chat_exporter_profiles` e as migrations `134`/`135` permanecem no banco e no histórico, sem consumidor. Não apagar, não reescrever, não criar migration de DROP.
5. **`discord:import-folder` sai junto.** Decisão do mantenedor em 2026-08-04. O transporte por diretórios `incoming/processing/processed/error` existe para suportar a automação e não é o import manual da interface.
6. **`vips-dev fftw-dev build-base` também saem** do Dockerfile de mesas. Decisão do mantenedor em 2026-08-04, com base na evidência de orfandade registrada na sessão. Detalhe na Parte 3.
7. **Não commitar, pushar, abrir PR nem deployar sem autorização nominal do mantenedor, por ação.**

---

## Parte 1 — Backend: arquivos removidos por completo

```
apps/mesas/backend/src/discord/chatExporterCliRunner.ts
apps/mesas/backend/src/discord/chatExporterAutomationConfig.ts
apps/mesas/backend/src/discord/chatExporterFolderImportService.ts
apps/mesas/backend/src/discord/chatExporterProfileRunner.ts
apps/mesas/backend/src/discord/chatExporterSchedule.ts
apps/mesas/backend/src/routes/discord/chatExporterAutomation.ts
apps/mesas/backend/src/scripts/exportDiscordChatExporter.ts
apps/mesas/backend/src/scripts/importDiscordChatExporterFolder.ts
apps/mesas/backend/src/scripts/runDiscordChatExporterSchedule.ts
```

Testes correspondentes, também removidos por completo:

```
apps/mesas/backend/src/discord/__tests__/chatExporterCliRunner.test.ts
apps/mesas/backend/src/discord/__tests__/chatExporterFolderImportService.test.ts
apps/mesas/backend/src/discord/__tests__/chatExporterSchedule.test.ts
apps/mesas/backend/src/discord/__tests__/chatExporterAutomationConfig.test.ts
apps/mesas/backend/src/discord/__tests__/chatExporterProfileRunner.security.test.ts
apps/mesas/backend/src/routes/discord/chatExporterAutomation.test.ts
```

**Verificação prévia já feita:** o grafo de imports desses arquivos é fechado. Os únicos consumidores fora do conjunto são `adminDiscordSync.ts` (montagem de rota) e `IntegracoesSection.tsx` (render do painel), tratados abaixo.

**Não remover** (import manual):
`chatExporterAdapter.ts`, `chatExporterImportService.ts`, `discordChatExporterTypes.ts`, `chatExporterAdapter.test.ts`, `chatExporterImportService.test.ts`, `__tests__/fixtures/chatExporterSample.ts`.

## Parte 2 — Backend: remoções parciais

### 2.1 Montagem de rota

`apps/mesas/backend/src/routes/adminDiscordSync.ts`:
- remover o `import chatExporterAutomationRouter from './discord/chatExporterAutomation.js';`
- remover a linha `router.use('/chat-exporter', chatExporterAutomationRouter);`

Isso derruba doze endpoints: `POST /validate-token`, `GET /config`, `PUT /config`, `GET /profiles`, `POST /profiles`, `PATCH /profiles/:id`, `DELETE /profiles/:id`, `GET /profiles/:id/delta`, `POST /profiles/:id/test`, `POST /profiles/:id/run`, `POST /test`, `POST /run`.

**Preservar as cinco rotas `/import-json/**`:** as duas linhas `router.use('/import-json', previewRouter)` e `router.use('/import-json', importRouter)` permanecem intocadas.

### 2.2 Descoberta Discord — remoção parcial

`apps/mesas/backend/src/discord/discovery.ts` — remover somente:
- `validateDiscordToken` (linha ~157)
- `DISCORD_DELTA_PAGE_LIMIT` (linha ~203)
- `discoverChannelDelta` (linha ~220)

`apps/mesas/backend/src/discord/index.ts:28` — retirar `discoverChannelDelta` e `DISCORD_DELTA_PAGE_LIMIT` do export. `validateDiscordToken` não consta desse export; confirmar antes de editar.

**Manter:** `discoverDiscordGuilds`, `discoverDiscordChannels`, `DiscordDiscoveryError` e helpers do bot.
**Verificação prévia já feita:** após remover `chatExporterAutomation.ts`, esses três símbolos ficam sem nenhum consumidor.

### 2.3 Cron

`apps/mesas/backend/src/scripts/cronRunner.ts:29-30` — remover:
- constante `CHAT_EXPORTER_TICK_MS`
- `setInterval(() => runCommand('npm run discord:chat-exporter-schedule'), CHAT_EXPORTER_TICK_MS)`

### 2.4 Scripts npm

`apps/mesas/backend/package.json` — remover as seis entradas:
```
discord:export-chat
discord:export-chat:dev
discord:import-folder
discord:import-folder:dev
discord:chat-exporter-schedule
discord:chat-exporter-schedule:dev
```
**Nenhuma dependência npm sai** — auditoria confirmou que a automação usa `child_process` nativo, sem pacote exclusivo.

### 2.5 Tipos de banco

`apps/mesas/backend/src/db/types.ts` — após remover todos os consumidores, retirar (linhas ~1045-1078):
- `DiscordChatExporterProfileFrequency`
- `DiscordChatExporterIncludeThreads`
- `DiscordChatExporterAuthType`
- `DiscordChatExporterProfilesTable`
- aliases de select/insert/update correspondentes
- propriedade `discord_chat_exporter_profiles` da interface `Database` (~linha 1159)

**Manter obrigatoriamente:** `DiscordImportSourceKind = 'discord_bot' | 'discord_chat_exporter_json'` (~linha 641) e todos os tipos de `discord_import_sources`, `discord_import_messages`, `discord_import_table_drafts`, `discord_import_runs`.

Consequência esperada e aceita: a tabela `discord_chat_exporter_profiles` continua existindo no banco sem tipo Kysely nem consumidor (Opção B, decisão do mantenedor).

## Parte 3 — Docker e Compose

Toda esta superfície entrou no mesmo commit (`9a4680d`) que trouxe a CLI, ou em `c4f55d0` (D13). Sai inteira.

### 3.1 `apps/mesas/backend/Dockerfile`

Remover:
- estágio `FROM tyrrrz/discordchatexporter:2.47.3 AS discord-chat-exporter` e o separador de comentário logo abaixo (linhas 6-9)
- `ENV DISCORD_CHAT_EXPORTER_BIN=/opt/dce/DiscordChatExporter.Cli` (linha 31)
- `ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false` (linha 32) — variável de runtime .NET, sem uso em Node
- `COPY --from=discord-chat-exporter /opt/app /opt/dce` (linha 96)
- do `RUN` final (linhas 105-106): `chmod +x /opt/dce/DiscordChatExporter.Cli`, o `/opt/dce` do `chown -R node:node`, o `/data/chat-exporter` do `mkdir -p` e do `chown`

Do segundo `apk add --no-cache` (linha 44), remover **todos os sete pacotes**:
```
vips-dev fftw-dev build-base icu-libs icu-data-full tzdata libstdc++
```
- `icu-libs icu-data-full tzdata libstdc++` são o runtime ICU do .NET *self-contained*; entraram no mesmo commit `9a4680d` que a CLI. `icu-data-full` sozinho pesa ~30 MB.
- `vips-dev fftw-dev build-base` vieram antes, em `be7fafd` (PR #113), atribuídas ao Sharp — mas são órfãs em mesas. Evidência, registrada na sessão: `sharp` só aparece em `apps/site/package.json` e `apps/links/package.json`, nunca em mesas nem em `packages/media`; o Dockerfile de mesas é o único do repositório com `vips-dev`, enquanto `site` e `links`, que de fato usam `sharp`, não o instalam; e `apps/mesas/backend/src/routes/upload.ts` envia imagem direto ao Cloudinary, sem processamento local — regra de produto do `AGENTS.md`.

Com isso o `RUN` da linha 44 deixa de existir. **Preservar o primeiro `apk add`**, com os pinos `curl=8.21.0-r0 libcurl=8.21.0-r0 c-ares=1.34.8-r0 libexpat=2.8.2-r0` e o bloco de comentário sobre os CVEs Snyk — é decisão documentada da spec 081, independente desta remoção.

Se a remoção do segundo `apk add` deixar o `&&` do primeiro pendurado, ajustar a sintaxe para um `RUN` único e válido, sem alterar os pacotes fixados.

Ajustar os comentários que sobrarem para não citar DiscordChatExporter, Sharp, ICU nem `/data/chat-exporter`. Preservar o comentário sobre `/app/logs` (WS4/REV-037).

### 3.2 `apps/mesas/docker-compose.beta.yml` e `apps/mesas/docker-compose.prod.yml`

Em cada arquivo, remover:
- as duas ocorrências de `DISCORD_CHAT_EXPORTER_IMPORT_BASE_DIR=/data/chat-exporter` (serviço API e serviço cron)
- as duas montagens `chat_exporter_data_<env>:/data/chat-exporter`
- a declaração do volume nomeado `chat_exporter_data_beta` / `chat_exporter_data_prod`

**Atenção operacional:** o volume nomeado continua existindo na VM após o deploy; o compose apenas deixa de montá-lo. Remoção do volume no host é ação destrutiva separada e **não** faz parte desta entrega.

## Parte 4 — Frontend

### 4.1 Arquivo removido por completo

```
apps/mesas/frontend/src/features/discord-sync/components/ChatExporterProfilesPanel.tsx
```
(928 linhas / ~41 KB)

### 4.2 Remoções parciais

`apps/mesas/frontend/src/features/admin/components/IntegracoesSection.tsx`:
- remover o import de `ChatExporterProfilesPanel` (linha ~8) e seu render (linha ~127)
- **preservar** a aba "Importar arquivo" (linhas ~95-102) e o painel de upload manual (linhas ~140-143)

`apps/mesas/frontend/src/features/discord-sync/types.ts`:
- remover os tipos de automação (linhas ~245-333)

`apps/mesas/frontend/src/features/discord-sync/api/discordSyncApi.ts`:
- remover schemas/parsers automáticos (linhas ~66-136 e ~241-259)
- remover métodos globais `get/save/validate/test/run` e o CRUD/test/run/delta de perfis (linhas ~555-601)
- **preservar**: `importJson` (~705), `previewJson` (~713), `previewFile` (~727), `importFile` (~730), `reparsePending` (~737), o upload multipart compartilhado (~516) e os schemas de resultado/preview/reparse (~331, ~346, ~365)

`apps/mesas/frontend/src/features/discord-sync/api/discordSyncApi.test.ts`:
- remover o bloco `describe('chatExporter')` (linhas ~73-120)
- **preservar** os casos de `importJson`, `previewJson`, `previewFile`, `importFile`

**Não remover:** `discoverGuilds` nem `discoverChannels` — `DiscordSourceList.tsx:81,115` usa ambos para o bot de Discord.

**Manter:** `IntegrationLogsView.tsx:8`, onde `discord_chat_exporter_json` aparece como rótulo "Importação JSON". É o import manual.

Componentes manuais preservados sem alteração: `DiscordJsonImportPanel.tsx`, `useJsonImport.ts`, `ImportResultGrid.tsx`, `JsonPreviewCard.tsx`, `draftFormUtils.ts`, `DiscordJsonImportPanel.test.tsx`.

## Parte 5 — API gerada

Rodar `rtk pnpm verify:api` **antes** de montar o commit (o hook pre-commit regenera; se só rodar no hook, os artefatos ficam fora do commit).

A regeneração deve **retirar** os doze endpoints automáticos de:
```
docs/api/generated/api-inventory.generated.json
docs/api/generated/api-map.generated.md
docs/api/generated/api-consumers.generated.json
docs/api/generated/artificio-api.bundle.json
docs/api/generated/api-index.generated.md
docs/api/openapi/mesas.openapi.yaml
```
e **preservar** as cinco operações `/import-json/**`. Não editar esses artefatos à mão.

---

## Validação obrigatória antes de declarar concluído

### Busca negativa — automação sumiu

```bash
rtk rg "chat-exporter|chatExporterCliRunner|chatExporterProfileRunner|chatExporterSchedule|chatExporterAutomation|chatExporterFolderImportService|chatExporterAutomationConfig|ChatExporterProfilesPanel" apps packages scripts
rtk rg "DISCORD_CHAT_EXPORTER_BIN|DISCORD_CHAT_EXPORTER_IMPORT_BASE_DIR|discordchatexporter|DOTNET_SYSTEM_GLOBALIZATION|icu-data-full" apps
rtk rg "discord_chat_exporter_profiles|DiscordChatExporterProfile|DiscordChatExporterAuthType" apps
```
Os três devem voltar vazios. Exceção única e esperada: `apps/mesas/database/migration_134_*.sql` e `migration_135_*.sql`, que ficam no histórico (Opção B).

### Busca positiva — manual preservado

```bash
rtk rg "import-json" apps/mesas/backend/src/routes/adminDiscordSync.ts
rtk rg "discord_chat_exporter_json" apps/mesas
rtk rg "chatExporterAdapter|chatExporterImportService|discordChatExporterTypes" apps/mesas/backend/src
```
Todos devem retornar resultado. `discord_chat_exporter_json` precisa continuar em `db/types.ts` e em `IntegrationLogsView.tsx`.

### Parser sem diff

```bash
rtk git diff --stat -- apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts apps/mesas/backend/src/discord/__tests__/
```
`parseDiscordAnnouncement.ts` e fixtures do parser não podem aparecer com modificação. Em `__tests__/` só devem constar as remoções listadas na Parte 1.

### Comandos

```bash
rtk pnpm run lint
rtk pnpm run build
rtk pnpm verify:api
rtk git diff --check
```

Testes, no mínimo: adapter, import service, rota de import, parser (backend); painel manual, hook, API manual (frontend). Depois, suíte completa de mesas nos dois lados.

**Registrar contagem real (`N/N`) de cada suíte.** "Tudo verde" sem número não conta como validação.

### Docker

Se Docker Desktop estiver disponível: `docker build --target production -f apps/mesas/backend/Dockerfile .` precisa passar sem o estágio da CLI. Registrar o tamanho da imagem antes e depois — a redução esperada é da ordem de 200 MB (binário .NET + ICU). Se não estiver disponível, dizer que não rodou, não presumir.

---

## Encerramento

Sem commit, push, PR ou deploy sem autorização nominal do mantenedor, por ação.

Relatório final em português, formato do `AGENTS.md` §Formato do relatório final: resultado em uma linha, números reais de validação, o que foi removido agrupado por efeito, o que foi preservado e por quê, decisão que mais precisa de conferência, achado lateral (se houver) com a pergunta "corrigir agora ou registrar", bloqueios.

## Ponto que exige conferência do mantenedor no relatório

A remoção de `vips-dev fftw-dev build-base` é a única parte desta entrega que **não** decorre da automação. A evidência de orfandade é forte (três verificações independentes, registradas na sessão), mas o efeito só aparece em runtime, num container de produção.

Se o build da imagem passar mas o upload de imagem de mesas quebrar em beta, a causa é esta e o rollback é reinserir os três pacotes no `apk add`. Destacar isso no relatório final como a decisão que mais precisa de conferência, e recomendar que o smoke de beta inclua um upload de imagem real pela interface de administração antes de qualquer promoção para produção.
