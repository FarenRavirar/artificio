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

- [ ] F1 — **Path-filters raiz** (`BL-DEP-PATHFILTERS`). Incluir `package.json`,
  `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `turbo.json` nos `paths:` de CI sem disparar
  deploy indevido. Risco baixo. Smoke: PR de bump dispara CI de modulo, nao deploy.
  · Pre: aprovacao + cuidado p/ nao acionar beta.
- [ ] F2 — **Pin de actions + secrets explicitos** (seguranca). `@master`/`@v1` → SHA;
  `secrets: inherit` → lista. Risco baixo. Smoke: `pr-checks` verde.
- [ ] F3 — **`env`-by-ref central** (absorve `BL-DEP-MESAS-DISPATCH-ENV`). Uma derivacao
  unica ref→env; remover copia inline dos 3 deploys. Smoke: dispatch em `dev` = beta,
  push `main` = prod, em todos os modulos. · Pre: aprovacao; validar por dispatch.
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
  - Falta (bloqueado por aprovacao): commit/push + 1 deploy provando `system df` cair (build
    cache ~0 pos-deploy). Mapeado: `BL-INFRA-CACHE-CAP-F10`.
