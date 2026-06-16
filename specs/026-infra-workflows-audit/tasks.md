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
- [ ] F4 — **Consolidacao manifesto + matrix** (absorve clones; `BL-DEP-CONTAINER-NAMES`
  avaliado junto). Manifesto declarativo + 1 workflow. Risco medio (toca todos os deploys).
  · Pre: SDD Completo, aprovacao, validar 1 modulo por vez por dispatch.
- [ ] F5 — **`accounts` → `_deploy-module`** (`BL-CDX-310` + `BL-DEP-MESAS-LEGACY-SCRIPTS`
  + compose versionado). SSO sagrado. · Pre: SDD Completo, aprovacao nominal, smoke
  `login/me/logout` + allowlist de retorno, rollback por snapshot.
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
- [x] F11 — **Eficiencia da esteira (CI cache + auto-deploy gating)** — IMPLEMENTADO LOCAL.
  Diagnostico (runs `27635199357` mesas vs `27635198756` glossario): mesas demora porque e
  o UNICO que auto-deploya no push (glossario/site/accounts pulam deploy = dispatch-only);
  CI sem cache (~2m18s mesas) + deploy VM `--no-cache` (~2m08s). A F1 ainda ampliou os paths
  -> mesas auto-deployava ate em commit de infra.
  - CI cache (`_deploy-module.yml`): pnpm movido antes do setup-node + `cache: pnpm`
    (pnpm store keyed por lock) + `actions/cache@v4` em `.turbo` + `--cache-dir=.turbo` em
    build/test. Corta re-download/rebuild em TODOS os modulos.
  - Auto-deploy gating (`deploy-mesas.yml`): novo job `detect` (git diff `apps/mesas/**`);
    `deploy` so true em push:dev quando o app do mesas muda, ou dispatch mode=deploy. before
    invalido -> deploya por seguranca. Mata o "dispara toda vez".
  - Decisao do mantenedor: gating por app mesas (nao packages/infra) + cache CI agora.
  · Validacao local: YAML ok. Falta (aprovacao): commit/push -> CI verde + provar 2 coisas:
    (a) este push (toca `_deploy-module`/workflow, NAO apps/mesas) NAO auto-deploya mesas;
    (b) run seguinte com cache quente cai o tempo de CI. Mapeado: `BL-INFRA-CI-EFFICIENCY-F11`.
- [ ] F12 — **Build em CI + GHCR + VM pull** (planejado; reconcilia F10). Hoje a VM builda
  `--no-cache --pull` (lento; cache local inutil). Alvo: GitHub Actions builda a imagem (com
  cache), push GHCR, VM so `docker compose pull` + `up`. Elimina build na VM, deploy vira
  pull+migrate+up+smoke. GHCR ja e stack decidida (D008) mas nao usada. · Pre: SDD Completo,
  registry/auth, refs de imagem no compose, reconciliar F10 (cache vive no CI/GHCR).
  Mapeado: `BL-INFRA-GHCR-F12`.
