# 056 — Mesas: ações em lote na Moderação + Logs de integração

- **App/escopo:** `apps/mesas` (frontend + backend)
- **Gate:** D (mesas em prod) · alvo de validação: beta
- **Modo:** SDD Completo (toca contrato de API — rotas batch novas em `apps/mesas/backend`)
- **Origem:** pedido direto do mantenedor (2026-06-29) sobre `/gestao/moderacao` e `/gestao/integracoes`.
- **Relacionada:** [054 — gestão IA sidebar](../054-mesas-gestao-ia-sidebar/) (reorg da `/gestao` que criou Moderação/Integrações). Esta spec estende a Moderação entregue na 054.
- **PR:** [#107](https://github.com/artificio-rpg/artificio/pull/107) — mergeado em `dev` (2026-06-29, 12:06:43 UTC, commit `a77270a863c654a05d37ad57daa55363d86ce0d2`). Branch `feat/mesas-moderacao-batch`, 3 commits.

## Problema

Na `/gestao/moderacao` não havia seleção múltipla: para rejeitar rascunhos ou ignorar mensagens era preciso abrir um a um. Em `/gestao/integracoes`, "Logs de integração" era stub "em breve".

## Objetivo

1. **Moderação › Rascunhos:** checklist (selecionar cada / todos) + **Rejeitar selecionados** + **Limpar todos**.
2. **Moderação › Mensagens capturadas:** checklist (selecionar cada / todas) + **Ignorar selecionadas**.
3. **Endpoints batch** no backend para que as ações em lote sejam 1 chamada (não loop client-side) — otimização operacional.
4. **Integrações › Logs de integração:** substituir stub por log real read-only.

## Decisões

- **Ação por entidade:** Rascunhos → status `rejected`; Mensagens → status `ignored`. (Não há DELETE; "limpar" = rejeição em massa, reversível por status.)
- **Batch genérico de status**, não endpoint dedicado por ação — `PATCH …/messages/batch` e `PATCH …/drafts/batch` com `{ ids, status }`. Cobre rejeitar/ignorar e futuras ações em lote.
- **Sem migration / sem coluna nova.** Reusa `status` existente (balde c intocado, alinhado à Fase 0 da 054).
- **Logs de integração = `discord_import_runs` existente** via `GET /api/v1/admin/discord/metrics` (já existia). Zero migration, read-only.
- **Drafts unificados (Discord+Inbox)** = mesma tabela `discord_import_table_drafts` → 1 batch cobre as duas origens.

## Contrato de API (novo)

| Método | Rota | Body | Resposta | Regras |
|---|---|---|---|---|
| PATCH | `/api/v1/admin/discord/messages/batch` | `{ ids: uuid[] (1..200), status }` | `{ data: { updated, messages } }` | `requireAdmin`; status enum de mensagem |
| PATCH | `/api/v1/admin/discord/drafts/batch` | `{ ids: uuid[] (1..200), status: draft\|needs_review\|rejected }` | `{ data: { updated, drafts } }` | `requireAdmin`; **não** atualiza `synced`; registrado antes de `/:id` |

Consumido: `discordSyncApi.updateMessagesBatch` / `updateDraftsBatch` / `getIntegrationMetrics`.

## Fora de escopo

- Endpoint de log dedicado (reusa `/metrics`).
- DELETE físico de drafts/mensagens.
- Paginação dos logs (mostra últimas 20 rodadas como o `/metrics` já entrega).
