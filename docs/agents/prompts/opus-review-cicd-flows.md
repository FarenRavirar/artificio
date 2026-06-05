# Prompt Para Opus — Revisar Fluxos CI/CD G1

Opus, revisar CDX-309/CDX-309B do Artificio G1 antes de merge/Parte C.

Contexto:
- Repo: `FarenRavirar/artificio`.
- PR: `#1 feat/003-fase2-monorepo-sso -> main`.
- Gate atual: B aprovado; Gate D mesas ainda aberto.
- Regra mantenedor: deploy/codigo via GitHub Actions; VM manual so bootstrap/conexao/instalacao operacional/diagnostico/rollback aprovado. Se GitHub cobre, GitHub faz.
- VM/Parte C ainda NAO executada. Nao aprovar write na VM sem checklist.

Arquivos principais:
- `docs/agents/deploy-flow.md` — fonte operacional nova do fluxo D039.
- `.github/workflows/pr-checks.yml`
- `.github/workflows/_lint-shell.yml`
- `.github/workflows/_enforce-migration-dir.yml`
- `.github/workflows/_deploy-module.yml`
- `.github/workflows/deploy-mesas.yml`
- `.github/workflows/break-glass-deploy-prod.yml`
- `.github/workflows/deploy-accounts.yml` — transicional/legado, alvo CDX-310.
- `scripts/deploy/lib_migrations.sh`
- `scripts/deploy/apply_required_migrations.sh`
- `docs/agents/github-actions-secrets.md`
- `docs/agents/infra-map.md`
- `docs/agents/operating-model.md`
- `AGENTS.md`
- `.specify/memory/decisions.md` D039

O que Codex fez:
- Criou CI/CD canonico de modulo por GitHub Actions.
- PR checks: ShellCheck + actionlint + enforce migration dir.
- `deploy-mesas` roda CI em PR; deploy real so `workflow_dispatch mode=deploy`.
- `_deploy-module` faz CI com Postgres service; deploy faz SSH, `git fetch/reset`, valida `.env`, compara `JWT_SECRET`, snapshot, migrations, compose, health, smoke, rollback.
- `break-glass` ainda passa por GitHub Actions.
- Scripts migration generalizados por modulo.
- Amazon Q blockers corrigidos:
  - sem `eval`;
  - JWT lido por `grep/cut`;
  - SQL destrutivo bloqueado mesmo em comentario multi-linha;
  - loops health/smoke sem pipe-subshell.
- CDX-309C corrigiu:
  - `_enforce-migration-dir.yml` sem `sed`, usando glob bash nativo e self-test;
  - migrations com `flock` interno autoritativo do antes-de-listar ate fim;
  - `pg_advisory_xact_lock` por migration dentro da transaction;
  - self-test concorrente `scripts/deploy/test_migration_lock.sh` rodando no `_lint-shell.yml`.

Checks verdes no PR:
- ShellCheck success.
- actionlint success.
- enforce migration dir success.
- `mesas / CI mesas` success.
- deploy job skipped em PR.

Pedir revisao:
1. Revisar arquitetura de workflows e remover redundancias ruins.
2. Decidir se `deploy-mesas.yml` deve manter `_lint-shell.yml` como gate proprio ou confiar so em `pr-checks.yml`.
3. Revisar se `pr-checks.yml` e `deploy-mesas.yml` duplicam paths/triggers de modo aceitavel.
4. Revisar `_deploy-module.yml` para riscos de quoting, command injection, rollback, `git reset --hard`, health/smoke e secrets.
5. Revisar scripts migration: headers, drift, `flock`, `pg_advisory_xact_lock`, transacao, bloqueio destrutivo, manual-risk, `schema_migrations`.
6. Definir CDX-310: reconciliar `deploy-accounts.yml` para o modelo `_deploy-module.yml` ou manter excecao documentada.
7. Revisar docs e apontar onde condensar:
   - `AGENTS.md` deve ficar regra petrea curta;
   - `docs/agents/context-capsule.md` deve ficar T0 minimo;
   - `docs/agents/deploy-flow.md` deve ser fonte longa;
   - `docs/agents/infra-map.md` so prereqs/topologia;
   - `docs/agents/github-actions-secrets.md` so nomes/caminhos de secrets.
8. Preparar checklist final da Parte C (converter VM para clone) com rollback e criterios de sucesso.

Saida esperada:
- `OK para merge` ou lista de bloqueios.
- Ajustes recomendados em ordem.
- Prompt/tarefas Codex para aplicar ajustes, se houver.
- Checklist Parte C revisado.

Regras:
- Nao imprimir segredo.
- Nao aprovar VM write sem bloco formal.
- Auth/dados sagrados.
- Deploy/codigo GitHub-first.
