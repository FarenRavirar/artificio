# Deploy Flow — Artifício RPG

> Fonte operacional do fluxo de deploy D039. Segredo nunca aqui. Deploy/codigo via GitHub Actions; VM manual so bootstrap, diagnostico ou rollback aprovado.

## Regra Mae

Se GitHub Actions cobre a acao, usar GitHub Actions.

VM direta (`ssh faren`) fica para:
- bootstrap inicial do clone `/opt/artificio`;
- instalar prereqs operacionais (`git`, `docker`, `docker compose`, `flock`, `curl`, `jq`);
- diagnostico read-only;
- rollback aprovado;
- acao excepcional que o workflow ainda nao cobre.

Nao usar `scp`, tarball, bundle local ou `docker compose up/down` manual como caminho normal de deploy.

## Fluxo Normal

1. Desenvolver em `feat/*`.
2. Abrir PR para `dev`.
3. GitHub roda `pr-checks.yml`:
   - `_lint-shell.yml` = ShellCheck + actionlint.
   - `_enforce-migration-dir.yml` = migrations SQL so em `apps/<modulo>/database/`, com self-test permitido/bloqueado.
4. Workflow do modulo roda CI em PR. Exemplo: `deploy-mesas.yml` chama `_deploy-module.yml` com `deploy=false`.
5. Merge para `dev` so apos revisao/aprovacao; beta roda em `/opt/artificio-beta`.
6. Deploy real so por `workflow_dispatch mode=deploy` no workflow do modulo, ou por push `dev` quando o modulo ja estiver fora do bootstrap inicial.
7. Runner entra por SSH e a VM faz `git fetch origin <branch> --tags` + `git reset --hard origin/<branch>` (`dev` para beta, `main` para prod).
8. Workflow valida `.env`, `JWT_SECRET` compartilhado, DB, snapshot, migrations, build, health e smoke.
9. Falha em deploy aciona rollback por snapshot + `docker compose up -d`.
10. Promocao para prod usa `promote-prod-fast-forward.yml` preservando `main ⊆ dev`; nao usar squash/merge commit em `dev→main`.

## Workflows

| Workflow | Papel | Deploy real |
|---|---|---|
| `.github/workflows/pr-checks.yml` | Gate de PR: shell/workflow lint + contrato migration | Nunca |
| `.github/workflows/_lint-shell.yml` | Reutilizavel: ShellCheck + actionlint | Nunca |
| `.github/workflows/_enforce-migration-dir.yml` | Reutilizavel: bloqueia `.sql` fora de `apps/*/database/` | Nunca |
| `.github/workflows/_deploy-module.yml` | Reutilizavel: CI + deploy parametrizado | So quando input `deploy=true` |
| `.github/workflows/deploy-mesas.yml` | CI/deploy do modulo `mesas` | So `workflow_dispatch mode=deploy` |
| `.github/workflows/deploy-glossario.yml` | CI/deploy do modulo `glossario` | Bootstrap dispatch-only; beta em `dev`, prod em `main` apos modulo existir |
| `.github/workflows/break-glass-deploy-prod.yml` | Emergencia rastreada, ainda via GitHub | So `workflow_dispatch` com `BREAK_GLASS` |
| `.github/workflows/deploy-accounts.yml` | Legado/transicional de `accounts` | Reconciliar em CDX-310 |

## Caso `glossario`

`deploy-glossario.yml` usa `_deploy-module.yml` e preserva os volumes legados:
- BETA: `/opt/artificio-beta`, branch `dev`, `.env.beta`, compose project `glossario-beta`, volume `glossario-beta_pgdata_beta`, rota `glossariobeta.artificiorpg.com` -> `http://glossario-beta-app:80`.
- PROD: `/opt/artificio`, branch `main`, `.env`, compose project `glossario`, volume `glossario_pgdata_prod`, rota `glossario.artificiorpg.com` -> `http://glossario-app:80`.

No primeiro cutover beta/prod, o legado usa o mesmo compose project (`glossario-beta`/`glossario`) com service labels antigas (`app-beta`/`api-beta`/`db-beta` ou `app-prod`/`api-prod`/`db-prod`). Isso nao e coberto pelo R1 original da spec 009 (outro project). Por isso `deploy-glossario.yml` liga `reconcile_same_project_orphans`: o reusable workflow roda `docker compose down --remove-orphans` no project alvo, sem `-v`, antes do primeiro `up` do DB.

Nao fazer deploy prod enquanto `origin/main` nao contiver `apps/glossario`. `glossariorpg.artificiorpg.com` era alias historico pre-monorepo e nao e rota ativa a preservar; o host canonico do modulo e `glossario.artificiorpg.com`.

## Migration Contract

Arquivos:
- `scripts/deploy/lib_migrations.sh`
- `scripts/deploy/apply_required_migrations.sh`

Regras:
- migration vive em `apps/<modulo>/database/migration_*.sql`;
- header obrigatorio: `@class`, `@requires-backup`, `@author`, `@created`, `@description`;
- classes: `online-safe` ou `manual-risk`;
- `online-safe` bloqueia `DROP`, `TRUNCATE`, `DELETE FROM`;
- sem `eval`;
- `schema_migrations` registra aplicado;
- `flock` interno do script segura a execucao inteira antes de listar pendentes ate aplicar tudo;
- `pg_advisory_xact_lock` roda dentro de cada transaction de migration;
- manual-risk exige `ALLOW_MANUAL_MIGRATIONS=true` e backup quando configurado.

## Bootstrap VM — Parte C

Requer aprovacao formal antes de qualquer write na VM.

Checklist:
- backup off-VM de `/opt/artificio` atual antes da conversao;
- `/opt/artificio` vira clone do monorepo;
- remote `origin` aponta para `FarenRavirar/artificio`;
- `.env` de cada modulo preservado e gitignored;
- prereqs presentes: `git`, `docker`, `docker compose`, `flock`, `curl`, `jq`;
- `artificio_net` existe;
- containers atuais seguem `Up/healthy` apos conversao, sem deploy ainda.

## Redundancias Conhecidas

- `deploy-accounts.yml` ainda e transicional e usa padrao diferente do `_deploy-module.yml`; alvo CDX-310.
- `deploy-mesas.yml` chama `_lint-shell.yml`, e `pr-checks.yml` tambem chama. Redundancia aceita como defesa; Opus deve decidir se centraliza so no PR gate ou mantem gate local do workflow.
- Comentarios de GitHub-first existem em varios docs; este arquivo deve ser a fonte operacional longa.
- Path-filters dos deploys de modulo ainda nao cobrem todos os manifests raiz (`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json`). Isso pode deixar mudanca de dependencia/root sem CI/deploy de modulo; E004 expôs a classe. Corrigir em spec/PR proprio, pois tocar `deploy-mesas.yml`/`deploy-site.yml` pode disparar betas existentes.

## Sucesso CDX-309B

PR #1: `feat/003-fase2-monorepo-sso -> main`.

Checks esperados:
- `lint-shell / ShellCheck` = success;
- `lint-shell / actionlint` = success;
- `enforce-migration-dir / Enforce migration dir` = success;
- `Migration lock self-test` dentro do ShellCheck job = success;
- `mesas / CI mesas` = success;
- `mesas / Deploy ...` = skipped em PR.
