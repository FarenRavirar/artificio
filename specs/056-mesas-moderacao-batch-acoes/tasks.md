# 056 — Tasks

> Ações em lote na Moderação + Logs de integração. Escopo `apps/mesas` (FE+BE).
> Autorização por ação (commit/push/PR/merge/deploy cada um pede aprovação nominal própria).

## Implementação (CONCLUÍDA no código — 2026-06-29, lint+build+test+verify:api verdes)

- [x] **T1 — Backend: `PATCH /messages/batch`** (`apps/mesas/backend/src/routes/discord/messages.ts`). `batchMessageSchema` (`ids` uuid 1..200 + `status`). UPDATE `discord_import_messages` `where id in`. Registrado antes de `/:id`.
- [x] **T2 — Backend: `PATCH /drafts/batch`** (`discord/drafts.ts`). `batchDraftSchema` (`status` ∈ `draft|needs_review|rejected`). UPDATE `discord_import_table_drafts` `where id in` + `where status != 'synced'`. Antes de `/:id`.
- [x] **T3 — Frontend API** (`discordSyncApi.ts`): `updateMessagesBatch`, `updateDraftsBatch`, `getIntegrationMetrics`. Tipos `DiscordImportRun`/`DiscordIntegrationMetrics` em `types.ts`.
- [x] **T4 — Rascunhos checklist** (`DiscordDraftReviewTable.tsx`): checkbox por linha (só rejeitáveis; `stopPropagation`), "Selecionar todos", "Rejeitar selecionados (N)", "Limpar todos (N)". Helper `rejectDraftIds` (1 chamada batch). Seleção limpa no reload.
- [x] **T5 — Mensagens checklist** (`useDiscordSync.ts` + `MessagesView.tsx`): estado `selectedMessageIds`, `toggleMessageSelected`, `toggleSelectAllMessages`, `handleIgnoreSelectedMessages`. Checkbox por linha (linha vira wrapper `<div>`, checkbox fora do `<button>`), "Selecionar todas", "Ignorar selecionadas (N)".
- [x] **T6 — Logs de integração** (`IntegrationLogsView.tsx`): substitui stub em `IntegracoesSection`. Timeline `discord_import_runs` via `/metrics` + resumo agregado. Read-only, `Array.isArray` no payload.
- [x] **T7 — a11y:** `aria-label` em checkboxes (select-all + por linha).

## Validação

- [x] `pnpm --filter @artificio/mesas-backend run build` (tsc) verde.
- [x] `pnpm --filter @artificio/mesas-frontend run build` verde.
- [x] `pnpm --filter @artificio/mesas-frontend run lint` zero erros (corrigido `setState` síncrono em effect → IIFE async).
- [x] Testes: discord-sync frontend 122/122; backend adminDiscordSync 4/4.
- [x] `pnpm verify:api`: 0 órfãs, 0 duplicatas, breaking=0, non-breaking=2 (os 2 batch). OpenAPI auto-gerado cobre.

## Pendente (autorização nominal do mantenedor — não feito)

- [ ] **TZ.1 — commit** na branch `feat/mesas-moderacao-batch`.
- [ ] **TZ.2 — push + PR → `dev`** (branch protection exige check `lint+build+test` verde).
- [ ] **TZ.3 — merge PR em `dev`** → deploy beta mesas → smoke em `mesasbeta.artificiorpg.com/gestao/moderacao` e `/gestao/integracoes`.
- [ ] **TZ.4 — promote `dev→main` ff + deploy prod** (gated por aprovação nominal).

## Notas

- Sem migration. Sem rename de valor persistido. `status` reusado.
- Batch limitado a 200 ids/chamada (guard do schema). Acima disso, frontend precisaria paginar — hoje a fila carrega `limit:100`, então não estoura.
