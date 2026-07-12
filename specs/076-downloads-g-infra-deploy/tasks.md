# Tasks — Spec 076 (Downloads-G)

## F0 — Remapeamento obrigatório

- [x] T0.1 — Reler `docs/agents/infra-map.md` vigente.
- [x] T0.2 — Reler `deploy-manifest.json`/`_deploy-module.yml` vigentes.
- [x] T0.3 — Reler `AGENTS.md` §Git/Branch/Deploy vigente.

## F1 — Manifesto

- [x] T1.1 — Adicionado módulo `downloads` ao `.github/deploy-manifest.json` (entrada nova, sem tocar módulos existentes; padrão idêntico a `mesas` — front+back separados, dispatch-only até 1º deploy verde).
- [x] T1.2 — `deploy_paths: ["apps/downloads"]`.

## F2 — Ambientes

- [x] T2.1 — `apps/downloads/docker-compose.beta.yml` criado: `downloads-beta-app` (nginx) + `downloads-beta-api` (node) + `downloads-beta-db` (postgres, volume próprio `pgdata_downloads_beta`). Sintaxe validada (`docker compose config`).
- [x] T2.2 — `apps/downloads/docker-compose.prod.yml` criado: mesmo padrão, volume `pgdata_downloads_prod`, DB/containers isolados de beta.
- [x] T2.3 — Cloudflare Tunnel `downloadsbeta.`/`downloads.` criado pelo mantenedor em 2026-07-12 (painel Zero Trust).

## F3 — Migrations

- [x] T3.1 — Confirmado: as 19 migrations existentes (`apps/downloads/database/migration_001` a `migration_019`) já têm os 5 campos de header obrigatórios (`@class`, `@requires-backup`, `@author`, `@created`, `@description`) — checado por script, nenhuma exigiu correção.
- [x] T3.2 — Todas `@class: online-safe`, nenhuma `@requires-backup: true`, nenhum DDL destrutivo (`DROP TABLE/COLUMN`, `TRUNCATE`, `DELETE FROM`) em migration online-safe — validação pelo guard (`lib_migrations.sh`) passará sem ajuste.

## F4 — Backup/rollback/observabilidade

- [x] T4.1 — Runbook de backup: seção "Bootstrap do `downloads`" adicionada a `docs/agents/deploy-runbook.md` (mesmo padrão de mesas/glossario/site/links), incluindo migrations (`apply_required_migrations.sh`, mesmo framework do mesas).
- [x] T4.2 — Health check HTTP: `GET /api/v1/health` já existia desde a spec 070 (`server.ts`); usado nos healthchecks Docker dos 2 composes e nas `critical_routes` do manifesto.
- [x] T4.3 — Trilha de auditoria de moderação separada de log genérico: `services/moderationAuditLog.ts` emite linha JSON `[moderation-audit]` (ator/ação/timestamp/motivo), integrada em `moderation.ts` (submit/approve/reject/batch) e `reports.ts` (decisão de mérito). DEB-076-01 fechado (2026-07-12).

## F5 — Smoke beta

- [ ] T5.1 — Deploy beta.
- [ ] T5.2 — Smoke HTTP (200/401/404 conforme rota).
- [ ] T5.3 — Smoke funcional (submissão→moderação→publicação→download ponta a ponta).

## F6 — Promoção e deploy prod

- [ ] T6.1 — Promote `dev→main` fast-forward.
- [ ] T6.2 — Deploy prod via `workflow_dispatch` manual, aprovação nominal.
- [ ] T6.3 — Smoke prod.
