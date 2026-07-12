# Plan — Spec 076 (Downloads-G)

## Fase 0 — Remapeamento obrigatório

- Reler `docs/agents/infra-map.md`, `deploy-manifest.json`, `_deploy-module.yml`, `AGENTS.md` §Git/Branch/Deploy vigentes.
- Não usar T6.1 de `061/spec.md` como fonte de verdade — só como formato esperado.

## Fase 1 — Manifesto e módulo

- Adicionar `downloads` ao `deploy-manifest.json`.
- `deploy_paths` cobrindo `apps/downloads`.

## Fase 2 — Ambientes

- Compose/secrets/DB isolados beta/prod.
- Cloudflare Tunnel para `downloadsbeta.`/`downloads.` (ação do mantenedor, mesmo padrão de outros módulos — token CF do agente sem escopo `cfd_tunnel`).

## Fase 3 — Migrations

- Header completo de 5 campos em toda migration.
- Validação pelo guard antes de qualquer deploy aplicar.

## Fase 4 — Backup/rollback/observabilidade

- Runbook de backup igual aos demais módulos.
- Health check HTTP.
- Trilha de auditoria de moderação separada de log genérico.

## Fase 5 — Smoke beta

- Deploy beta.
- Smoke real (HTTP 200/401/404 conforme rota, fluxo de submissão/moderação ponta a ponta).

## Fase 6 — Promoção e deploy prod

- Promote `dev→main` fast-forward.
- Deploy prod via `workflow_dispatch` manual explícito, aprovação nominal.
- Smoke prod.

## Gate de saída

Downloads em produção real, Gate D do módulo fechado — spec 061 e toda a cadeia A–G encerradas.
