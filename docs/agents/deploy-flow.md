# Deploy Flow — Artificio G1

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
2. Abrir PR para `main`.
3. GitHub roda `pr-checks.yml`:
   - `_lint-shell.yml` = ShellCheck + actionlint.
   - `_enforce-migration-dir.yml` = migrations SQL so em `apps/<modulo>/database/`.
4. Workflow do modulo roda CI em PR. Exemplo: `deploy-mesas.yml` chama `_deploy-module.yml` com `deploy=false`.
5. Merge para `main` so apos revisao/aprovacao.
6. Deploy real so por `workflow_dispatch mode=deploy` no workflow do modulo.
7. Runner entra por SSH e a VM faz `git fetch origin main --tags` + `git reset --hard origin/main`.
8. Workflow valida `.env`, `JWT_SECRET` compartilhado, DB, snapshot, migrations, build, health e smoke.
9. Falha em deploy aciona rollback por snapshot + `docker compose up -d`.

## Workflows

| Workflow | Papel | Deploy real |
|---|---|---|
| `.github/workflows/pr-checks.yml` | Gate de PR: shell/workflow lint + contrato migration | Nunca |
| `.github/workflows/_lint-shell.yml` | Reutilizavel: ShellCheck + actionlint | Nunca |
| `.github/workflows/_enforce-migration-dir.yml` | Reutilizavel: bloqueia `.sql` fora de `apps/*/database/` | Nunca |
| `.github/workflows/_deploy-module.yml` | Reutilizavel: CI + deploy parametrizado | So quando input `deploy=true` |
| `.github/workflows/deploy-mesas.yml` | CI/deploy do modulo `mesas` | So `workflow_dispatch mode=deploy` |
| `.github/workflows/break-glass-deploy-prod.yml` | Emergencia rastreada, ainda via GitHub | So `workflow_dispatch` com `BREAK_GLASS` |
| `.github/workflows/deploy-accounts.yml` | Legado/transicional de `accounts` | Reconciliar em CDX-310 |

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
- `pg_advisory_lock` evita concorrencia;
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

## Sucesso CDX-309B

PR #1: `feat/003-fase2-monorepo-sso -> main`.

Checks esperados:
- `lint-shell / ShellCheck` = success;
- `lint-shell / actionlint` = success;
- `enforce-migration-dir / Enforce migration dir` = success;
- `mesas / CI mesas` = success;
- `mesas / Deploy ...` = skipped em PR.
