# 2026-06-29 — Spec 052 automação inteligente

## Objetivo

Começar a spec 052 pelo Bloco A local: ingestão operacional de pasta monitorada para JSONs do DiscordChatExporter.

## Escopo

- `specs/052-mesas-automacao-inteligente/`
- `apps/mesas/backend`
- Sem VM write, sem cron, sem segredo, sem deploy.

## Plano

- [x] Confirmar que 048 está em prod e 053 foi mergeada.
- [x] TA.1 — layout/permissões documentados.
- [x] TA.2 — exporter com risco aceito pelo mantenedor: token/cookies via env, DCE recebe `-t/--token`; logs redigem segredo.
- [ ] TA.3 — job agendado. Parcial local; beta exige VM write.
- [x] Implementar importador local de pasta `incoming/processing/processed/error`.
- [x] Adicionar testes de lote misto e idempotência operacional.
- [x] TA.7 — retenção local.
- [ ] TA.8 — smoke beta real. Bloqueado por deploy/VM.
- [x] Validar backend pontual.
- [x] Atualizar spec 052 com evidência.

## Evidência

- PR #108 da 053 mergeado em `dev`.
- 048 consta em `specs/README.md` como em PROD.
- `pnpm --filter @artificio/mesas-backend test -- chatExporterFolderImportService.test.ts` ✅ (31 arquivos/293 testes do pacote executados pelo Vitest).
- `pnpm --filter @artificio/mesas-backend build` ✅.
- Primeiro build falhou por tipagem do mock Vitest; corrigido e rerodado verde.
- Retenção adicionada depois: `pnpm --filter @artificio/mesas-backend test -- chatExporterFolderImportService.test.ts` ✅ (31 arquivos/294 testes).
- Exporter com risco aceito: `pnpm --filter @artificio/mesas-backend test -- chatExporterCliRunner.test.ts chatExporterFolderImportService.test.ts` ✅ (32 arquivos/295 testes).

## Resultado local

- `apps/mesas/backend/src/discord/chatExporterFolderImportService.ts` criado.
- `apps/mesas/backend/src/discord/chatExporterAutomationConfig.ts` criado.
- `apps/mesas/backend/src/discord/chatExporterCliRunner.ts` criado.
- `apps/mesas/backend/src/scripts/importDiscordChatExporterFolder.ts` criado.
- `apps/mesas/backend/src/scripts/exportDiscordChatExporter.ts` criado.
- `specs/052-mesas-automacao-inteligente/operacao-bloco-a.md` criado.
- Scripts `discord:import-folder` e `discord:import-folder:dev` adicionados.
- Sem VM write, sem cron, sem segredo, sem deploy.

## 2026-06-30 — Bloco B local

- IA auxiliar virou sugestão revisável: `_ai_suggestions` no `normalized_payload`, sem sobrescrever campos determinísticos e sem limpar `missing_fields`.
- Kill switch/config: `MESAS_AI_AUTOMATION_MODE=off|suggest|shadow|auto`; `MESAS_AI_KILL_SWITCH=true` força `off`; auto-aprovação real segue bloqueada.
- Privacidade: `minimizeAnnouncementForLlm()` redige IDs Discord e URLs não permitidas antes de chamar IA; prompt bruto não é logado.
- Eval offline: `aiEval.ts`, rota admin `/api/v1/admin/discord/automation/eval` e CLI `discord:ai-eval`.
- Shadow mode reaproveita `discord_shadow_decisions`/`/metrics/shadow` da 048; continua sem agir.
- Validação: `pnpm --filter @artificio/mesas-backend test -- aiAutomation.test.ts utils.test.ts` ✅ (33 files/300 tests do pacote); `pnpm --filter @artificio/mesas-backend build` ✅.

## Critério de conclusão

- Comando local processa arquivos válidos, isola arquivo ruim e não publica mesa automaticamente.
- Bloco B local sugere IA sem aplicar, mede eval offline e mantém auto-aprovação travada.

## 2026-06-30 — Bloco C local

- Escopo: R15-R20 determinísticos do parser/importador, sem VM/deploy/git.
- Plano: mentions como evidência/contato, paga/gratuita já existente mas cobrir regressão, sistema próprio/inspirado já existe mas cobrir regressão, attachments/embeds como evidência, parse automático opcional pós-import.
- Validação alvo: teste backend focado + build/lint/verify:api se rota/contrato mudar.


### Resultado Bloco C local

- R15: role mentions preservadas em _raw_evidence.role_mentions e _notes.
- R16: user mentions em linha de contato viram contact_discord; compat de canal Discord preservada.
- R17: paga/gratuita coberto por regressão; lógica existente mantida.
- R18: sistema próprio/inspirado coberto por regressão; forte descarta, fraco marca _homebrew_suspect.
- R19: attachments/embeds preservados em _raw_evidence e _notes.
- R20: utoParse: true no import JSON/arquivo aciona reparse de mensagens pendentes ChatExporter; continua sem auto-publicação.

### Evidência Bloco C

- pnpm --filter @artificio/mesas-backend test -- parseDiscordAnnouncement.test.ts ✅ (33 files/305 tests do pacote).
- pnpm --filter @artificio/mesas-backend build ✅.
- pnpm run lint ✅ (15/15 tasks).
- pnpm verify:api ✅; mesas breaking=0, non-breaking=3; warnings ambíguos conhecidos.

- pnpm run build ✅ (17/17 packages).

