# Sessao 26-06-18_1 — site cutover beta->raiz EFETIVADO em PROD (spec 029)

Data: 2026-06-18
Modulo/projeto: `apps/site` + consumidores de `packages/ui` (glossario, mesas, accounts)
Gate: Deploy PROD (promote dev->main + 3 redeploys). DNS/Tunnel/WAF fora de escopo (mantenedor).

## Objetivo

Fechar o cutover beta->principal (spec 029, D075): promover `dev->main` e redeployar em PROD os
consumidores de `packages/ui` p/ que o Footer/Portal compartilhado aponte para a raiz
`artificiorpg.com` em vez de `beta.`.

## T0/T1 lidos

`project-state.md`, `context-capsule.md`, `decisions.md` (D072/D073/D074/D075), `tasks.md` 029,
`deploy.yml` + `deploy-manifest.json` + `promote-prod-fast-forward.yml`, `sessoes/26-06-17_3`.

## Estado de partida (recalibrado)

- Flip beta->raiz por redirect interno Cloudflare do mantenedor (D075) — NAO Gate C cerimonial.
- PRs #56 (docs) + #57 (flip + import-on-start default=false + PUBLIC_SITE_URL->raiz) JA mergeados
  em `dev` (`950a7fc`+`2cc260a`).
- Boot-loop do deploy site resolvido: `.env.beta` na VM tinha `SITE_IMPORT_ON_START=true` sobrepondo
  o default false do compose -> import no boot com WP 502 derrubava container. sed->false na VM;
  deploy run 27740681518 SUCCESS, `site-beta-app` healthy, log "import pulado".
- SEO origem cache-busted OK; refs beta vistas eram so cache Cloudflare (TTL 7200).

## Modo de trabalho

Claude planeja; OpenCode (DeepSeek `deepseek-v4-pro`) executa via MCP `opencode` (escopo local,
`C:\projetos\artificio`). Cada acao = aprovacao nominal por acao do mantenedor.

## Execucao

### Fase 1 — read-only (validar ff + inspecionar workflow)
- `main` (origin `e61606e`) ancestral de `dev` (`950a7fc`); `origin/dev..origin/main`=0; ff limpo.
- `promote-prod-fast-forward.yml`: dispatch manual, input `confirm=PROMOTE_DEV_TO_MAIN`, fetch refs
  remotos frescos, valida invariante via `scripts/deploy/validate_branch_invariant.sh`, push ff puro.

### Passo 1 — promote dev->main (autorizado)
- `gh workflow run promote-prod-fast-forward.yml -f confirm=PROMOTE_DEV_TO_MAIN`.
- Run **27741596778 SUCCESS** (9s). Pos: `origin/main`=`origin/dev`=`950a7fc`; `origin/dev..origin/main`=0.

### Passo 2 — deploy PROD consumidores de packages/ui (autorizado ate deploy, Claude validando)
Workflow unico `deploy.yml --ref main -f module=<m> -f mode=deploy` (manifest: mesas/glossario env
deriva do ref=main->prod; accounts env_override=prod sempre). Sequencial:
- glossario: run **27741699473 SUCCESS**. Smoke `/`=200, `/api/terms`=200.
- mesas: run **27741844218 SUCCESS**. Smoke `/`=200, `/api/v1/me/options`=401.
- accounts: run **27742012941 SUCCESS**. Smoke `/health`=200, `/login`=200, `/api/auth/me`=401.
- Footer/nav compartilhado (bundle prod): aponta `https://artificiorpg.com`, **zero `beta.`**.

### Passo 3 — purge cache Cloudflare da raiz
- Feito pelo mantenedor (mata refs beta cacheadas antes do TTL 7200).

## Resultado

Cutover spec 029 EFETIVADO em PROD. `main`=`dev`=`950a7fc`; site na raiz; 3 consumidores
redeployados apontando Portal->raiz; smoke 100%; cache purgado. `BL-SITE-CUTOVER-029` FECHADO.

## Follow-up (aberto)

- T9 — noindex/redirect do `beta.artificiorpg.com` (evitar indice duplicado com a raiz).
- T10 — submeter sitemap da raiz no Search Console (mantenedor).
- `BL-SITE-PRINCIPAL-GAPS` — PUBLIC_GA_ID vazio, newsletter `[newsletter]` literal, `/sitemap.xml` 404, contato.
- `BL-SITE-VM-MEDIA-LIBRARY` (spec 028) — re-host dos 6 PDFs na VM.
- WP/Hostinger EOL ~2026-06-20 (`SITE_IMPORT_ON_START=false` ja aplicado no `.env.beta`).

## Registro

Working tree atualizado (tasks 029, backlog, project-state, esta sessao). **SEM commit** — registro
via branch+PR (D072/D073) pendente de aprovacao nominal.

---

# Continuacao — spec 030 Fase 0 (F1/F2/F3 implementados)

Data: 2026-06-18 (mesma sessao, apos aprovacao)
Modulo/projeto: `apps/site` + `deploy-manifest.json`
Gate: Fase 0 codigo (PR, sem deploy)

## Objetivo

Fechar F1-F3 da Fase 0 da spec 030 (docker-compose.prod.yml, manifest paridade, noindex beta).
Inconsistencia detectada na spec: plan.md listava F0a+F1+F2+F3 juntos, mas so T1a estava feito.
Decisao: completar F1-F3 agora.

## Execucao

### F1 — docker-compose.prod.yml
- Novo arquivo `apps/site/docker-compose.prod.yml` espelhando beta:
  - `site-prod-app` (build Dockerfile, expose 4322, `PUBLIC_SITE_URL=https://artificiorpg.com`)
  - `site-prod-db` (postgres:16-alpine, `POSTGRES_DB=site`, volume `pgdata_site_prod`)
  - `deploy.resources.limits.memory: 512m` (padrao mesas)
  - `healthcheck.start_period: 180s` (igual beta)
  - Comentario `SITE_FORCE_REBUILD` (R1b)
  - Network externa `artificio_net`

### F2 — deploy-manifest.json paridade
Site entry atualizado:
- `env_override: ""` (deriva do ref)
- `compose_file: "docker-compose.prod.yml"`
- `db_service: "site-prod-db"`
- `health_containers: ["site-prod-app"]`
- `reconcile_same_project_orphans: true`
- `critical_routes: []` (Fase 1 — smoke interno manual; Fase 3 substitui por URLs publicas raiz)
- `critical_routes_beta`: mantido com URLs beta
- Campos `db_name=site`, `db_user=admin`, `push_branches=["dev"]`, `deploy_paths` preservados

### F3 — noindex beta (X-Robots-Tag)
- `docker-compose.beta.yml`: adicionado `SITE_NOINDEX=true`
- `server.ts` (linha 28-34): middleware condicional — se `SITE_NOINDEX===true`, emite `X-Robots-Tag: noindex, nofollow` em toda resposta

## Validacao

- `site test`: 22/22 ✅
- `site build`: 46 paginas ✅
- `site lint`: ✅ (echo "lint TODO")
- `site-admin lint`: ✅ (echo "lint TODO")
- `deploy-manifest.json`: JSON valido, todos os campos presentes ✅
- docker-compose YAML: arquivos legiveis ✅

## Tasks spec 030 atualizadas

- T1a (public_site_url beta): ✅ (f808527)
- T1 (docker-compose.prod.yml): ✅
- T2 (manifest paridade): ✅
- T3 (noindex beta): ✅
- T4 (PR): pendente de aprovacao para commit+push+PR

## Follow-up

- T4: abrir PR p/ `dev` (branch `spec/030-site-prod-deploy-parity`)
- Fase 1+: T5 (secrets mantenedor), T5b (.env na VM), T6 (dispatch deploy prod), etc.
- `critical_routes` prod Fase 3: atualizar para URLs publicas raiz pos-flip

---

# Correcoes de review (chatbot) — 3 itens

## Item 1 — T6 sem `--ref main`
Bug documental: `gh workflow run deploy.yml -f module=site -f mode=deploy` sem `--ref` roda na default branch (`dev`=beta, D073), nao em `main`=prod. Corrigido em `tasks.md` e `plan.md`: adicionado `--ref main`.

## Item 2 — PUBLIC_SITE_URL nao wireado no build
Bug real: `astro.config.mjs:9` hardcodava `site: "https://artificiorpg.com"` e `packages/content/src/site.ts:6` hardcodava `origin: "https://artificiorpg.com"`. A env var `PUBLIC_SITE_URL` do compose nunca chegava no build Astro → beta gerava canonical/OG/sitemap com host raiz (falso). Corrigido:
- `astro.config.mjs`: `site: process.env.PUBLIC_SITE_URL || "https://artificiorpg.com"`
- `packages/content/src/site.ts`: `origin: process.env.PUBLIC_SITE_URL || "https://artificiorpg.com"`
- Build e test revalidados (46 paginas, 22/22).

## Item 3 — T5b cat .env expoe secrets
Bug de seguranca: `ssh faren "cat apps/site/.env"` jogaria `POSTGRES_PASSWORD`, `JWT_SECRET` e secrets Cloudinary no terminal/log. Corrigido em `tasks.md`: check redacted com `grep -c '^CHAVE='` (prova existencia sem expor valores).

---

# Continuacao — T5b (.env prod) + atualizacao docs infra

Data: 2026-06-18 (mesma sessao)
Gate: Fase 1 (preparacao) + documentacao

## T5b — .env prod criado na VM

- `/opt/artificio/apps/site/.env` criado (350 bytes, 7 linhas, chmod 600):
  - POSTGRES_USER=admin
  - POSTGRES_PASSWORD (nova, openssl rand -hex 16, 32 chars)
  - DATABASE_URL=postgres://admin:<pwd>@site-prod-db:5432/site
  - JWT_SECRET (copiado de /opt/artificio/apps/accounts/.env — identico, 64 chars)
  - CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (copiados do .env.beta)
- JWT_SECRET validado identico ao accounts (grep + cut + diff)
- Pronto para T6 (dispatch deploy prod --ref main)

## Atualizacao docs infra (PR #59)

Arquivos atualizados para refletir estado real da infra apos spec 029/030:

### `.specify/arquiteture.md`
- Secao 4 (Roteamento): tabela de hosts corrigida — raiz=site Astro (nao mais WP), beta=staging noindex
- Secao 7 (CI/CD): deploy-manifest.json, --env-file, env por ref, tabela completa de .env no disco da VM (modulo, keys, localizacao), regra JWT_SECRET identico, bootstrap .env ausente

### `.specify/memory/project-state.md`
- Spec 030 Fase 0 concluida (PR #58 mergeado, docker-compose.prod.yml, manifest paridade, noindex beta, PUBLIC_SITE_URL wireado)
- T5b executado (.env prod na VM)
- apps/site descrito na raiz (nao mais "no beta")
- Spec 029 follow-up T9 reescopado para 030

### `.specify/memory/decisions.md`
- D076: spec 030 — site deploy prod proprio, paridade de infra com mesas/glossario/accounts

## PRs abertos
- PR #58: Fase 0 codigo → MERGEADO em dev (49ef112)
- PR #59: docs infra atualizados → aberto, aguardando merge
