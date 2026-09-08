# Tasks — 026

## Fatia atual (auditoria; sem codigo, sem deploy)

- [x] T1 — Inventario verificado dos 14 workflows · feito quando: tabela em `plan.md`
  cobre papel/trigger/deploy/reuso de cada arquivo, conferida contra leitura real. ✅
- [x] T2 — Mapa de redundancia com custo de manutencao · feito quando: `plan.md` aponta
  clones, `env`-by-ref replicado, lint 2x e snowflake accounts. ✅
- [x] T3 — Mapa de seguranca com severidade · feito quando: tabela de seguranca em
  `plan.md` lista porta exposta, actions sem pin, `secrets:inherit`, cron WAF, permissions. ✅
- [x] T4 — Direcao-alvo registrada (manifesto+matrix; accounts→`_deploy-module`) · feito
  quando: `plan.md` documenta o norte sem implementar. ✅
- [x] T5 — Reconciliar backlog: cada `BL-*`/`D-*` de infra mapeado a uma fatia do roadmap
  abaixo ou marcado fora de escopo · feito quando: `specs/backlog.md` aponta para spec 026
  como guarda-chuva e nenhum item de infra fica orfao. ✅ (`BL-INFRA-WORKFLOWS-026`)
- [x] T-final — Atualizar `specs/backlog.md`, `sessoes/index.md` e `project-state.md` ·
  feito quando: spec 026 aberta como auditoria refletida no mapa geral e na memoria. ✅

## Roadmap de fatias futuras (NAO executar sem aprovacao nominal por fatia)

Cada fatia = SDD Lite/Completo proprio, com pre-condicao de aprovacao, smoke e rollback.

- [x] F1 — **Path-filters raiz** (`BL-DEP-PATHFILTERS`) — IMPLEMENTADO LOCAL. Adicionado
  `package.json`/`pnpm-lock.yaml`/`pnpm-workspace.yaml`/`turbo.json` aos `paths:` (PR+push)
  de `deploy-mesas`/`deploy-glossario`/`deploy-site`. `deploy-accounts` ja roda sem filtro.
  Mudanca de dep raiz agora dispara CI/deploy de modulo.
- [x] F2 — **Pin de actions + secrets explicitos** — IMPLEMENTADO LOCAL.
  `ludeeus/action-shellcheck@00cae500...# 2.0.0` e `reviewdog/action-actionlint@6fb7acc9...# v1.72.0`
  pinados por SHA. `_deploy-module.yml` declara `secrets:` (5 DEPLOY_* required); callers
  (`mesas`/`glossario`/`site`/`break-glass`) passam mapa explicito (era `secrets: inherit`).
  `.github/dependabot.yml` (github-actions semanal) mantem os SHAs pinados frescos via PR.
- [x] F3 — **`env`-by-ref central** (absorve `BL-DEP-MESAS-DISPATCH-ENV`) — IMPLEMENTADO
  LOCAL. Novo job `resolve` no `_deploy-module.yml` deriva env de `github.ref` em UM lugar
  (dev->beta, senao prod; override opcional `inputs.env`). Removida a expressao inline dos
  3 deploys; `site` mantem `env: beta` (beta-only D044) e `break-glass` `env: prod` como
  overrides legitimos. Estruturalmente impossivel dispatch-em-dev virar prod.
  · FECHADO: commit `8713ee0`, push dev. `pr-checks`/actionlint verde (F1/F2/F3 validos,
  pins SHA resolveram). mesas beta deploy run `27635199357` verde com log
  `resolved_env=beta override='' ref='refs/heads/dev'` + smoke mesasbeta `/`=200,
  `/me/options`=401. glossario/site/accounts verdes. F1/F2/F3 provados em prod-beta.
- [x] F4 — **Consolidacao manifesto + matrix** — FECHADO (PR #44 mergeado em dev, merge
  `0ba09e1`; commits `6691b6d`/`f3bb9de`/`2821cb8`). 3 deploy-*.yml clones -> 1
  `.github/deploy-manifest.json` + 1 `deploy.yml` (job `build-matrix` absorve detect/F11 ->
  deploy matrix via `fromJSON` -> `uses: _deploy-module.yml`). Validado beta 3/3
  (glossario/mesas/site), zero prod. `deploy.yml` ganhou input dispatch `env`
  (default/beta/prod) p/ forcar beta de qualquer branch. accounts ficou DE FORA (= F5).
  Decisoes resolvidas: F11 absorvido; clones deletados (historico preserva); `on:paths`
  amplia CI (aceito).
- [x] F-SEC — **Revisao/checks gratis nativos (sem cadastro/App/token externo)** — IMPLEMENTADO
  LOCAL + PR #40 (`chore/026-security-ci`). Adiciona: dependabot npm; `ci.yml` (lint+build+test
  monorepo, postgres+env dummy); `codeql.yml` (js/ts); `dependency-review.yml`; `osv-scanner.yml`
  (reusavel oficial, `fail-on-vuln:false`); `secret-scan.yml` (TruffleHog OSS); `scorecard.yml`
  (`publish_results:false`); `semgrep.yml` (OSS `--config auto --metrics=off`). Terceiros pinados
  por SHA (F2). Permissao minima, zero secret/token externo, nao toca deploy/prod. `sessoes/
  26-06-16_11`, `BL-INFRA-SEC-SCAN`. Settings habilitados pelo mantenedor: Dependency graph +
  Secret scanning + Push protection.
  · FALTA fechar PR #40: corrigir TruffleHog `version: 3.95.5` (tag sem `v`; unico check
    vermelho), esperar+validar re-revisao dos revisores externos, merge dev com aprovacao
    nominal. Debito exposto: `BL-CI-ESLINT-FLAT-CONFIG` (lint advisory ate corrigir flat config).
- [x] F5 — **`accounts` → `_deploy-module`** (`BL-CDX-310`) — FECHADO EM PROD (PR #45 merge
  `0b4ec43`, promote `dev→main` ff, deploy prod run `27656716758` verde). Prova real: run
  `healthy_accounts-api=true`, `smoke_health=200`/`login=200`/`me_no_cookie=401`, snapshot
  criado; VM pos-deploy: `accounts-api` configfile agora = `/opt/artificio/apps/accounts/
  docker-compose.prod.yml` (clone git, era tarball), `health=healthy`, project=`accounts` +
  volume `accounts_accounts_pgdata` preservados (DB SSO intacto). Dry-run de build no clone
  validado antes. Fix de seguranca (review): `POSTGRES_PASSWORD` sem default `admin` (`${VAR:?}`).
  Apos inspecao read-only na VM (accounts-api project=`accounts`, **NO-HEALTHCHECK**, deploy
  por tarball em `/opt/artificio/accounts`, volume `accounts_accounts_pgdata`; anchor prod
  `/opt/artificio/apps/accounts/.env` com 9 chaves SSO; **sem accountsbeta** = D042).
  - `apps/accounts/docker-compose.prod.yml` versionado (substitui shim/symlink VM): add
    HEALTHCHECK no accounts-api (gate de saude da esteira), env via `environment: ${VAR}`
    (`--env-file`), project/volume PRESERVADOS (zero perda do DB SSO), `ports:3000:3000`
    mantido (F6 troca p/ expose).
  - Manifesto: 4a entrada `accounts` **PROD-only** (`env_override:prod`, dispatch-only,
    smoke health/login/me=401). Migrations no-op (accounts migra in-container no boot).
  - `deploy.yml`: `accounts` no choice + guard que BLOQUEIA env=beta p/ accounts (D042).
  - `deploy-accounts.yml` DELETADO (historico preserva -> rollback = revert + re-dispatch).
  - Validacao local: YAML lint 3/3, manifest parse 4 modulos, runner no-op confirmado.
  · Validado: dry-run VM (build no clone) + deploy prod (run `27656716758`) + smoke
    `/health`/`login`/`me` verdes. Rollback = revert F5 em main + re-dispatch.
  · `BL-DEP-MESAS-LEGACY-SCRIPTS` (limpeza `apps/mesas/scripts/deploy/*`) deixado FORA deste
    PR SSO-focado (toca outro modulo + orfa refs em docs); fatia mesas separada.
- [ ] F6 — **`accounts` `ports`→`expose`** (`BL-ACCOUNTS-PORT`). Hardening. · Pre:
  aprovacao; smoke SSO (porta interna na `artificio_net`).
- [ ] F7 — **Cron auto-archive seguro** (`BL-MESAS-AUTO-ARCHIVE-CF`). Caminho interno OU
  bypass WAF nomeado p/ rota cron. Toca Cloudflare. · Pre: aprovacao nominal; nao mexer
  WAF/DNS sem ela.
- [ ] F8 — **Trilho de update de app** (`D-DEP2`). Spec propria: apt/Node/pnpm/imagens
  Docker/deps npm com plano seguro, janela e backup VM. · Pre: spec dedicada.
- [ ] F9 — **Express 5 por backend** (`D-DEP1`/`BL-MESAS-EXPRESS5-016`). Spec/fatia por
  app, sem big-bang, smoke por consumidor. · Pre: spec dedicada.
- [x] F10 — **Limpeza de build cache no deploy** — IMPLEMENTADO LOCAL (sem deploy).
  Revisado apos inspecao read-only na VM (Docker 29.5.3): imagens nao acumulam (1 tag/repo,
  `dangling=0`); vilao real = **build cache ~20GB reclaimable <7d**, e o build usa
  `--no-cache --pull` => cache nunca reusado.
  - `_deploy-module.yml` pos-deploy: `docker image prune -f` + **`docker builder prune -f`**
    (total, sem filtro de idade).
  - `docker-cleanup.yml` semanal: `builder prune` total (rede de seguranca).
  - **Cap de imagem por repo DESCARTADO** (no-op no naming atual); scripts
    `lib_image_cache.sh`/`prune_module_image_cache.sh`/`check_image_cache_policy.sh` e o
    self-test no `_lint-shell.yml` REMOVIDOS — sem codigo morto.
  - FECHADO: commits `06a5ded`/`a727ab2`, push dev, deploy mesas beta (run `27633842040`)
    verde. Prova real (`docker system df` na VM): build cache 20.89GB reclaimable -> **0B**,
    images 28->10GB. `BL-INFRA-CACHE-CAP-F10` fechado.
- [ ] F11 — **Eficiencia da esteira (CI cache)** — pendente. Verificado 2026-06-17: o cache
  pnpm/turbo **nao esta em `origin/main`** (0 matches). Foi trabalho "local"; pode ter se
  perdido na reescrita de historico (repo publico) — NAO e "extraviado/falso positivo", e
  reaplicar do desenho. (SHA ausente != trabalho desfeito — ver memoria `repo-public-history-rewrite`.)
  - CI cache (`_deploy-module.yml`): pnpm antes do setup-node + `cache: pnpm` + `actions/cache`
    em `.turbo` + `--cache-dir=.turbo`. Reaplicar + PR.
  - Auto-deploy gating: obsoleto — `deploy-mesas.yml` deletado no F4; `build-matrix` ja gateia por path.
  - Mapeado: `BL-INFRA-CI-EFFICIENCY-F11`.
- [ ] F12 — **Build em CI + GHCR + VM pull** (planejado; reconcilia F10). Hoje a VM builda
  `--no-cache --pull` (lento; cache local inutil). Alvo: GitHub Actions builda a imagem (com
  cache), push GHCR, VM so `docker compose pull` + `up`. Elimina build na VM, deploy vira
  pull+migrate+up+smoke. GHCR ja e stack decidida (D008) mas nao usada. · Pre: SDD Completo,
  registry/auth, refs de imagem no compose, reconciliar F10 (cache vive no CI/GHCR).
  Mapeado: `BL-INFRA-GHCR-F12`.
