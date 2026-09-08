# Débitos — Spec 070 (Downloads-A)

Achados internos de investigação, lint, build ou auditoria.

**Nota de recuperação (2026-07-12):** este arquivo (junto com `spec.md`/`plan.md`/`tasks.md`/`reviews.md` da spec 070) sumiu da working tree local desta branch de trabalho (`feat/070-downloads-schema-api`) — a branch nasceu de um ponto anterior ao commit `99c032e`/`c54f49b` (PR #150, `docs(downloads): fecha definição de produto 061 e abre specs filhas 070-076`) que criou os esqueletos das specs 070-076 em `dev`. Recuperado via `git show docs/070-076-downloads-specs:specs/070-.../<arquivo>` (branch remota que contém o commit). Não é arquivo apagado/perdido — é branch de trabalho que nunca recebeu aquele commit; ao sincronizar com `dev`, checar conflito. Débitos abaixo atualizados para refletir o estado real do código (as specs filhas já fecharam os 3 débitos originais).

## DEB-070-01 — 🟢 Fechado — Frontend do app downloads não existia ainda

Escopo original desta spec era só backend (schema/API/ownership). `apps/downloads/frontend` foi criado na spec 073 (descoberta pública) e ampliado nas specs 074/075. Hoje existe completo: rotas públicas, painel `/painel/*`, gestão `/gestao/*`.

## DEB-070-02 — 🟢 Fechado — Rotas de leitura pública ainda não filtravam por catálogo/taxonomia

T2.1 entregou só `GET /api/v1/materials/:slug` (ficha individual). Listagem/busca/filtro por sistema-edição/material_type/access_kind foi implementada na spec 073 (`GET /api/v1/materials`, `apps/downloads/backend/src/routes/materials.ts`).

## DEB-070-03 — 🟢 Fechado — Máquina de estados editorial completa não implementada

`editorial_state` nascia sempre `draft` via API. Máquina de estados completa (draft→in_review→published/rejected/withdrawn, fila de moderação, transições validadas) implementada na spec 072 (`services/editorialStateMachine.ts`, `routes/moderation.ts`).

