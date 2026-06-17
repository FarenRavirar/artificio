# Sessão 26-06-16_14 — Spec 026 F5: accounts → _deploy-module (BL-CDX-310)

## Objetivo
Reconciliar o snowflake `accounts` (SSO central) à esteira reusável `_deploy-module.yml`:
compose PROD versionado + 4ª entrada no manifesto declarativo + deletar `deploy-accounts.yml`.
SSO sagrado, blast radius alto. SDD Completo, PR próprio base dev.

## Inspeção read-only na VM (precede o desenho — lição project-state)
`ssh faren` (read-only sempre liberado):
- `accounts-api`: project=`accounts`, configfile = **tarball** `/opt/artificio/accounts/apps/accounts/docker-compose.yml`, **NO-HEALTHCHECK**, `ports 3000:3000` publicado, net `artificio_net`.
- `accounts-db`: healthy, volume `accounts_accounts_pgdata`, db `artificio_auth`, user `admin`.
- Deploy atual = tarball+scp em `/opt/artificio/accounts/` (NÃO-git), `.env` (9 chaves SSO) via `env_file: ../../.env`.
- Anchor prod (git clone) `/opt/artificio/apps/accounts/.env` = **9 chaves completas** (Google OAuth+JWT+DB).
- Anchor beta `/opt/artificio-beta/apps/accounts/.env.beta` = **só JWT_SECRET**.
- **Sem accountsbeta** — beta reusa accounts PROD (D042).
- `/health` interno 200, cf 200; `/login` 200; `/api/auth/me` (sem cookie) 401.
- `docker-compose.prod.yml` na VM = symlink manual **não-git** (o shim).

## Bloqueio resolvido (decisão do mantenedor)
accounts não tem realm beta (D042). "Validar beta primeiro" não se aplica.
Mantenedor escolheu: **dry-run VM (build da imagem no clone, sem recreate) → deploy prod real** com rollback por snapshot. accounts = manifesto PROD-only.

## Implementado (local)
1. `apps/accounts/docker-compose.prod.yml` (arquivo versionado, substitui o shim/symlink):
   - **HEALTHCHECK** no accounts-api (`wget --spider 127.0.0.1:3000/health`) — sem isso o gate `.State.Health.Status==healthy` da esteira nunca passaria.
   - env via `environment: ${VAR}` (expandido pelo `--env-file` que a esteira passa), não mais `env_file` fixo.
   - project=`accounts` + volume key `accounts_pgdata` PRESERVADOS → volume `accounts_accounts_pgdata` continua o mesmo (zero perda do DB SSO no cutover).
   - `ports:3000:3000` mantido por paridade (F6 = expose).
2. `.github/deploy-manifest.json`: 4ª entrada `accounts` PROD-only (`env_override:prod`, `auto_deploy_on_push:false`, smoke health/login/me=401). Campos `*_beta` espelham prod (defensivo, nunca exercitados).
3. `.github/workflows/deploy.yml`: `accounts` no choice de dispatch + **guard** que bloqueia env=beta p/ accounts (D042).
4. `.github/workflows/docker-cleanup.yml`: comentário do lock atualizado (accounts entrou na esteira).
5. `deploy-accounts.yml` DELETADO (`git rm`); histórico preserva → rollback = revert + re-dispatch.

Migrations: no-op (accounts migra in-container no boot via Dockerfile CMD `node dist/migrate.js`; sem `apps/accounts/database/` → `apply_required_migrations.sh` retorna `exit 0`). `_deploy-module` já exime accounts do JWT-share check (linha 339).

## Validação local
- YAML lint 3/3 OK (deploy.yml, docker-cleanup.yml, docker-compose.prod.yml).
- Manifest parse: 4 módulos (mesas/glossario/site/accounts); accounts env_override=prod.
- Migration runner no-op confirmado para accounts.

## Fora desta fatia
`BL-DEP-MESAS-LEGACY-SCRIPTS` (limpar `apps/mesas/scripts/deploy/*`): código morto no monorepo, mas toca outro módulo + órfã refs em docs → fatia mesas separada.

## Git hygiene
Branch `infra/026-f5-accounts-deploy-module` off `origin/dev`. Alheio mesas-perf-025 (App.tsx, FeedbackButton, backlog/tasks 025) guardado em stash holdout, fora do commit F5. Stash `f4-wip-docs-t3` (closure docs F4 + regra AGENTS "nunca responder bots") popado e pega carona neste commit de código F5 (regra doc-only do mantenedor). F4 status forward-corrigido (PR #44 mergeado).

## Falta (aprovação nominal por ação)
commit → push → `gh pr create --base dev` → CI verde → **dry-run VM** (build no clone, sem recreate; write na VM) → **deploy prod** (`module=accounts mode=deploy`) → smoke login/me/logout. Rollback = revert + re-dispatch deploy-accounts.yml.
