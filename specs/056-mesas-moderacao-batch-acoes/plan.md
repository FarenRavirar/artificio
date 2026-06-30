# 056 — Plano

> Ações em lote na Moderação + Logs de integração. Escopo `apps/mesas` (FE+BE).
>
> **Estado:** Implementação completa (T1–T7). PR #107 mergeado em `dev` (2026-06-29, commit `a77270a863c654a05d37ad57daa55363d86ce0d2`). Branch `feat/mesas-moderacao-batch`, 3 commits. Deploy beta + smoke pendentes.

## Fase 0 — Investigação

- Auditoria read-only das rotas existentes em `apps/mesas/backend/src/routes/discord/`: `adminDiscordSync.ts`, `messages.ts`, `drafts.ts`, `metrics.ts`.
- Mapeamento das entidades: `discord_import_messages` (status), `discord_import_table_drafts` (status), `discord_import_runs` (log real já existente).
- Consulta ao MCP `artificio-api-governance` para entender o contrato de rotas existentes.
- Decisão: reusar `discord_import_runs` via `GET /metrics` para Logs de integração — zero migration.

## Fase 1 — Backend (T1–T2) ✅ IMPLEMENTADA

- **T1 — `PATCH /messages/batch`** em `apps/mesas/backend/src/routes/discord/messages.ts`. Schema `batchMessageSchema` (`ids` uuid[] 1..200 + `status`). UPDATE `discord_import_messages WHERE id IN`. Registrada **antes** de `/:id`.
- **T2 — `PATCH /drafts/batch`** em `discord/drafts.ts`. Schema `batchDraftSchema` (`status` ∈ `draft|needs_review|rejected`). UPDATE `discord_import_table_drafts WHERE id IN` + `WHERE status != 'synced'`. Antes de `/:id`.

## Fase 2 — Frontend API (T3) ✅ IMPLEMENTADA

- **T3** em `discordSyncApi.ts`: `updateMessagesBatch`, `updateDraftsBatch`, `getIntegrationMetrics`. Tipos `DiscordImportRun`/`DiscordIntegrationMetrics` em `types.ts`.

## Fase 3 — Frontend UI (T4–T7) ✅ IMPLEMENTADA

- **T4 — Rascunhos checklist** em `DiscordDraftReviewTable.tsx`: checkbox por linha (só rejeitáveis; `stopPropagation`), "Selecionar todos", "Rejeitar selecionados (N)", "Limpar todos (N)". Helper `rejectDraftIds` (1 chamada batch). Seleção limpa no reload.
- **T5 — Mensagens checklist** em `useDiscordSync.ts` + `MessagesView.tsx`: estado `selectedMessageIds`, `toggleMessageSelected`, `toggleSelectAllMessages`, `handleIgnoreSelectedMessages`. Checkbox por linha (wrapper `<div>`, checkbox fora do `<button>`), "Selecionar todas", "Ignorar selecionadas (N)".
- **T6 — Logs de integração** em `IntegrationLogsView.tsx`: timeline `discord_import_runs` via `/metrics` + resumo agregado. Read-only, `Array.isArray` no payload. Substitui stub em `IntegracoesSection`.
- **T7 — a11y:** `aria-label` em checkboxes (select-all + por linha).

## Decisões de arquitetura

- **Batch genérico de status**: `PATCH …/batch` com `{ ids, status }`, não endpoint dedicado por ação. Cobre rejeitar/ignorar e futuras ações em lote.
- **Reuso de `/metrics`**: Logs de integração = `discord_import_runs` existente via `GET /api/v1/admin/discord/metrics` (já existia). Zero migration, read-only.
- **Sem migration**: sem coluna nova, sem rename de valor persistido. `status` reusado.
- **Drafts unificados**: Discord+Inbox na mesma tabela `discord_import_table_drafts` → 1 batch cobre as duas origens.
- **Batch limitado a 200 ids/chamada** (guard do schema). Fila carrega `limit:100`, não estoura.

## Arquivos tocados

| Arquivo | Mudança |
|---|---|
| `apps/mesas/backend/src/routes/discord/messages.ts` | `PATCH /batch` + schema |
| `apps/mesas/backend/src/routes/discord/drafts.ts` | `PATCH /batch` + schema |
| `apps/mesas/frontend/src/features/discord-sync/api/discordSyncApi.ts` | `updateMessagesBatch`/`updateDraftsBatch`/`getIntegrationMetrics` |
| `apps/mesas/frontend/src/features/discord-sync/types.ts` | `DiscordImportRun`/`DiscordIntegrationMetrics` |
| `apps/mesas/frontend/src/features/discord-sync/components/DiscordDraftReviewTable.tsx` | checklist + rejeitar/limpar lote |
| `apps/mesas/frontend/src/features/discord-sync/components/MessagesView.tsx` | checklist + ignorar lote |
| `apps/mesas/frontend/src/features/discord-sync/hooks/useDiscordSync.ts` | estado/handlers de seleção de mensagens |
| `apps/mesas/frontend/src/features/discord-sync/components/IntegrationLogsView.tsx` | NOVO — logs de integração |
| `apps/mesas/frontend/src/features/admin/components/IntegracoesSection.tsx` | liga `IntegrationLogsView` (remove stub) |
| `docs/api/openapi/mesas.openapi.yaml` + `docs/api/generated/*` | auto-gerado pelo verify:api |

## Riscos e mitigação

- **Race condition em batch rejection** — mitigado com shadow check de status + transação atômica (fix CodeRabbit, commit `3834f7d`).
- **parseBatchResult engolia falha** — corrigido para throw (CodeRabbit rodada 2, commit `3834f7d`).
- **OpenAPI genérico** — schemas batch com `additionalProperties:true` (auto-gerado). Melhoria do gerador = escopo spec 055, não fix manual.
- **Limite de 200 ids** — fila carrega `limit:100`, não estoura hoje. Se paginar >200 no futuro, paginar chamada batch no frontend.
