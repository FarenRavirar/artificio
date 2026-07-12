# Tasks — Spec 076 (Downloads-G)

## F0 — Remapeamento obrigatório

- [ ] T0.1 — Reler `docs/agents/infra-map.md` vigente.
- [ ] T0.2 — Reler `deploy-manifest.json`/`_deploy-module.yml` vigentes.
- [ ] T0.3 — Reler `AGENTS.md` §Git/Branch/Deploy vigente.

## F1 — Manifesto

- [ ] T1.1 — Adicionar módulo `downloads` ao `deploy-manifest.json`.
- [ ] T1.2 — `deploy_paths` cobrindo `apps/downloads`.

## F2 — Ambientes

- [ ] T2.1 — Compose/secrets/DB isolados beta.
- [ ] T2.2 — Compose/secrets/DB isolados prod.
- [ ] T2.3 — Cloudflare Tunnel `downloadsbeta.`/`downloads.` (ação do mantenedor).

## F3 — Migrations

- [ ] T3.1 — Header de 5 campos em toda migration do módulo.
- [ ] T3.2 — Validação pelo guard antes de aplicar.

## F4 — Backup/rollback/observabilidade

- [ ] T4.1 — Runbook de backup.
- [ ] T4.2 — Health check HTTP.
- [ ] T4.3 — Trilha de auditoria de moderação separada de log genérico.

## F5 — Smoke beta

- [ ] T5.1 — Deploy beta.
- [ ] T5.2 — Smoke HTTP (200/401/404 conforme rota).
- [ ] T5.3 — Smoke funcional (submissão→moderação→publicação→download ponta a ponta).

## F6 — Promoção e deploy prod

- [ ] T6.1 — Promote `dev→main` fast-forward.
- [ ] T6.2 — Deploy prod via `workflow_dispatch` manual, aprovação nominal.
- [ ] T6.3 — Smoke prod.
