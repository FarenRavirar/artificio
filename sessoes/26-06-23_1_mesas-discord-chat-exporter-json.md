# Sessão — 2026-06-23 — Spec 048 DiscordChatExporter JSON

- **Módulo:** `apps/mesas`
- **Spec:** `specs/048-mesas-discord-chat-exporter-json/`
- **Objetivo:** criar spec de continuação da 047 para importar JSON real do Tyrrrz/DiscordChatExporter.
- **Escopo autorizado:** documentação/spec; leitura dos JSONs locais; sem implementação, commit, push, PR, deploy, migration, VM write ou Chrome.

## Contexto recebido

- JSONs reais informados:
  - `C:\projetos\artificio\spec047-backup\extracao_json.json`
  - `C:\projetos\artificio\spec047-backup\extracao_json2.json`
- Decisões do mantenedor:
  - MVP inicial por upload manual no painel admin.
  - Evolução com DiscordChatExporter rodando diariamente na VM.
  - DiscordChatExporter será permanente.
  - Opcionais devem virar tasks explícitas para não serem esquecidos por IAs/chats futuros.

## Auditoria executada

- `extracao_json.json` é JSON válido.
  - 100 mensagens.
  - 85 anexos.
  - 28 embeds.
  - 11 mensagens com Google Forms.
  - 4 mensagens com tags Discord `<t:UNIX:...>`.
  - 60 mensagens com role mentions.
- `extracao_json2.json` está inválido/truncado.
  - Falha de parse por volta da linha 3042.
  - Registrado como fixture negativa obrigatória.
- Código atual verificado:
  - `DiscordImportSourceKind` já aceita `discord_chat_exporter_json`.
  - `ImportRawMessage`/`DiscordRawMessage` tem campos necessários.
  - `discord_import_messages` tem metadados Discord e dedupe por `(discord_channel_id, discord_message_id)`.
  - `parseDiscordAnnouncement` e `normalizeDiscordTableDraft` são reaproveitáveis.

## Revisão posterior contra diff local + VM beta

- VM beta consultada read-only:
  - `/opt/artificio-beta` em `b70367c`.
  - `mesas-beta-app`, `mesas-beta-api`, `mesas-beta-db` healthy.
  - DB beta contém `discord_import_sources`, `discord_import_messages`, `discord_import_table_drafts`, `import_messages`, `import_corrections`.
  - `discord_import_messages` contém `source_kind`, attachments/embeds e constraint unique `(discord_channel_id, discord_message_id)`.
- Diff local relevante:
  - `chrono-node` e `fuzzball` adicionados no backend.
  - fallback DeepSeek adicionado em `manual_paste`, não no importador JSON.
  - Playwright E2E adicionado, mas depende de autenticação admin/cookie.
  - `apps/mesas/scripts/discord-export.sh` adicionado como helper Docker manual; não é desenho seguro de automação diária final.
- A Spec 048 foi atualizada para registrar esses fatos e impedir que outra IA assuma diffs locais como entrega aprovada.

## Decisões registradas na Spec 048

- Usar `discord_import_messages`, não `import_messages`.
- Endpoint recomendado: `POST /api/v1/admin/discord-sync/import-json`.
- MVP sem migration.
- Avaliar `discord_import_runs` apenas se auditoria de execução diária exigir.
- `import_messages` fica reservado para fontes genéricas (`manual_paste`, formulários próprios, social media sem metadados Discord).
- Workflow human-in-the-loop adicionado:
  - importação sempre gera draft revisável no MVP;
  - parser/heurísticas/IA geram extração inicial com score de confiança;
  - admin revisa, corrige, rejeita ou aprova;
  - correções humanas geram registro antes/depois;
  - aprendizado alimenta aliases, heurísticas, validações, testes, evals e prompts;
  - qualquer autoaprovação futura exige shadow mode, métricas, rollback, trilha de auditoria e aprovação explícita do mantenedor.

## Retomada após stash da Spec 048

- Em 2026-06-23, durante correção separada da PR #90, os arquivos untracked da Spec 048 foram guardados em `stash@{0}` (`wip-048-before-fix-pr90`).
- Sintoma observado: `specs/README.md` ainda citava a Spec 048, mas a pasta `specs/048-mesas-discord-chat-exporter-json/` não aparecia no working tree.
- Ação executada nesta sessão: restaurados apenas os artefatos documentais da Spec 048 e a sessão a partir de `stash@{0}^3`.
- Não foram restaurados como entrega da Spec 048 os arquivos de código experimentais do stash (`deepseek.ts`, E2E Playwright, script `discord-export.sh` etc.).

## Atualização pedida pelo mantenedor — plano MVP + arquitetura da solução

- `plan.md` recebeu a seção **Arquitetura da solução**:
  - fonte de entrada;
  - camada de ingestão;
  - camada de preservação;
  - camada de extração;
  - camada de draft/revisão;
  - camada de publicação manual em `tables.status='draft'`.
- Após pedido de alinhamento com a Spec 047, `plan.md` recebeu também um diagrama operacional em caixas ASCII no mesmo estilo:
  - UI admin;
  - endpoint backend;
  - novos tipos/adapter/serviço;
  - parser existente com hardening 048;
  - tabelas DB;
  - futuro permanente na VM;
  - futuro opcional de automação inteligente/IA auxiliar.
- `plan.md` recebeu o **Plano MVP atualizado, herdado da Spec 047**:
  - upload manual JSON;
  - validação e preservação da fonte Discord;
  - import idempotente;
  - drafts revisáveis;
  - resumo/falhas;
  - correção humana;
  - zero auto-publicação no MVP.
- O plano evolutivo da 047 foi transferido para a 048:
  - normalização melhorada;
  - resolução de sistema;
  - score de qualidade;
  - UI de revisão inteligente;
  - heurísticas reaproveitáveis;
  - roadmap futuro.
- `tasks.md` recebeu a **Fase A2 — Arquitetura e plano MVP herdado da Spec 047**, para qualquer IA futura executar sem depender do chat.

## PR #90 mergeada e base da Spec 048 realinhada

- PR #90 (`chore/047-debitos-finais`) foi mergeada em `dev` em 2026-06-23.
- Merge commit: `f0e2e56`.
- Correção final da PR #90: remoção do DeepSeek acidental da Spec 047; CI ficou verde antes do merge.
- A branch local `feat/048-discord-chat-exporter-json` foi avançada por fast-forward para `origin/dev`.
- Conferência: `git log origin/dev..HEAD` vazio.
- T0.7 marcado como concluído em `tasks.md`.
- Próxima etapa antes de implementar código da 048: executar T-A11/T-H, separando o que é documentação aceita da Spec 048 do que são experimentos locais (`chrono-node`, `fuzzball`, DeepSeek, Playwright E2E, script `discord-export.sh`).

## Auditoria pré-implementação + handoff OpenCode/DeepSeek

- Pedido do mantenedor: preparar a execução para OpenCode/DeepSeek V4 Pro porque Codex terá pouca disponibilidade.
- Auditoria do diff local contra `origin/dev`:
  - documentação da Spec 048 está coerente e deve ser fonte canônica;
  - `chrono-node` e `fuzzball` aparecem em backend deps/código e precisam de decisão: remover ou manter com matriz de testes;
  - `@playwright/test`/scripts E2E aparecem no frontend, mas `apps/mesas/frontend/e2e/` não existe no working tree atual;
  - `deepseek.ts` não existe no working tree atual; DeepSeek foi removido da 047 pela PR #90 e não entra no MVP 048;
  - `apps/mesas/scripts/discord-export.sh` não existe no working tree atual; VM diária continua futura;
  - alteração em `AGENTS.md` deve ser ignorada por pedido explícito do mantenedor.
- `tasks.md` atualizado:
  - T-A11 concluída;
  - T-H1 e T-H4 concluídas como “não presentes/não entram no MVP”;
  - T-H2/T-H3/T-H5 deixadas abertas para o executor limpar/decidir;
  - criado bloco **Handoff de execução para OpenCode / DeepSeek V4 Pro** com contexto, ordem obrigatória, não-fazer, gates e resultado esperado.

## Artefatos criados

- `specs/048-mesas-discord-chat-exporter-json/spec.md`
- `specs/048-mesas-discord-chat-exporter-json/plan.md`
- `specs/048-mesas-discord-chat-exporter-json/tasks.md`
- `specs/048-mesas-discord-chat-exporter-json/debitos.md`
- `specs/048-mesas-discord-chat-exporter-json/reviews.md`

## Artefatos atualizados

- `specs/README.md`
- `specs/backlog.md`
- `.specify/memory/project-state.md`
- `sessoes/index.md`

## Débitos abertos

- DEB-048-01 — JSON inválido/truncado precisa de erro amigável.
- DEB-048-02 — Automação diária com DiscordChatExporter exige desenho seguro.
- DEB-048-03 — Parser ainda não cobre padrões reais do JSON.
- DEB-048-04 — Import runs podem precisar de auditoria própria.
- DEB-048-05 — Script DiscordChatExporter local não é desenho seguro de automação permanente.
- DEB-048-06 — Fallback DeepSeek está no diff local, mas não pertence diretamente ao importador JSON.
- DEB-048-07 — `chrono-node`/`fuzzball` já aparecem no diff, mas precisam de matriz real.
- DEB-048-08 — Playwright E2E local depende de autenticação admin não resolvida.

## Execução do handoff (2026-06-23, OpenCode)

### T-H5 — Limpeza do diff
- `chrono-node`, `fuzzball`, Playwright e mudanças de parser revertidos (`git checkout --`).
- Diff local agora contém só documentação, sessão e backend MVP + UI.
- `AGENTS.md` não foi tocado.

### Fase B — Backend MVP upload manual
- **T-B1**: `src/discord/discordChatExporterTypes.ts` — schemas Zod completos para export DiscordChatExporter.
- **T-B2**: `src/discord/chatExporterAdapter.ts` — `adaptMessageToImportRaw()`, sem `segmentAnnouncements()`, `nickname ?? name`.
- **T-B3**: `src/discord/chatExporterImportService.ts` — `importDiscordChatExporterJson()` com idempotência via content_hash.
- **T-B4**: `POST /api/v1/admin/discord-sync/import-json` em `adminDiscordSync.ts` (+37 linhas).
- **T-B6**: JSON sem `messages[]` → 400 amigável. Zod valida schema completo.
- **T-B7**: content_hash impede duplicatas. Mesmo JSON 2× = 0 inserted.
- **T-B8**: Hash diferente → update + status `pending` + `parse_error=null`.
- **T-B5**: **ADIADO** — parse automático pós-import fica para depois do MVP.

### Fase C — mínimo
- Parser existente (`parseDiscordAnnouncement` + `normalizeDiscordTableDraft`) já lida com `content_raw` das mensagens importadas. Hardening específico (Google Forms, timestamps, vagas) é melhoria contínua.

### Fase D — UI admin
- **T-D1 a T-D5**: `DiscordJsonImportPanel.tsx` — textarea para colar JSON, botão Importar, resultado com total/inserted/updated/ignored, erro amigável.
- Sub-aba `import-json` adicionada ao `DiscordSyncPanel` (5ª aba).
- API client `importJson` em `discordSyncApi.ts`.

### Validação
- Lint 15/15 ✅
- Build 17/17 ✅
- Backend tests 180/180 ✅
- Frontend tests 19/19 ✅

### Próximo passo
- Fase B5 (parse automático pós-import) — opcional, adiado
- Fase E (VM diária) exige autorização nominal futura
- Commit/PR pendente de autorização
