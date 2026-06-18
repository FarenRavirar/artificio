# Tasks — 030 Site deploy PROD próprio (paridade)

> Ordem pétrea: código (PR) → stand-up prod (sem rota) → seed DB (mantenedor) → flip rota (mantenedor) → noindex beta. DNS/Tunnel = mantenedor. Cada deploy/VM-write/seed/rota = aprovação nominal por ação.

## Fase 0 — código (branch+PR, sem deploy)
- [x] T1a — `apps/site/docker-compose.beta.yml:30`: `PUBLIC_SITE_URL` → `https://beta.artificiorpg.com` (R11, hoje hardcoded raiz). Após separação, beta deve gerar canonical/OG/sitemap com hostname beta. · `f808527`
- [x] T1 — `apps/site/docker-compose.prod.yml`: `site-prod-app` (build `apps/site/Dockerfile`, expose 4322, `PUBLIC_SITE_URL=https://artificiorpg.com`, `SITE_IMPORT_ON_START` default `false`, `deploy.resources.limits.memory` ~512m, `healthcheck.start_period` ≥180s, comentário `SITE_FORCE_REBUILD`) + `site-prod-db` (postgres:16-alpine, `POSTGRES_DB=site`, volume `pgdata_site_prod`), network externa `artificio_net`. Espelha `docker-compose.beta.yml`. · arquivo criado, YAML válido, build site OK.
- [x] T2 — `deploy-manifest.json` entrada `site` → paridade (R2): `env_override=""`, `compose_file`/`_beta`, `compose_project=site`/`_beta=site-beta`, `db_service=site-prod-db`/`_beta=site-beta-db`, `health_containers=["site-prod-app"]`/`_beta=["site-beta-app"]`, `db_name=site`, `db_user=admin`, `push_branches=["dev"]`, `deploy_paths=["apps/site","apps/site-admin"]`, `reconcile_same_project_orphans=true`. `critical_routes` Fase 1: `[]` (smoke interno manual via `docker compose exec`; substituir por URLs públicas raiz na Fase 3). · manifest JSON válido, todos os campos conferidos.
- [x] T3 — `noindex` no beta (R8): `X-Robots-Tag: noindex, nofollow` via env (`SITE_NOINDEX=true` no `docker-compose.beta.yml` → middleware no `server.ts`), default prod ausente. · middleware emite header quando `SITE_NOINDEX=true`; build/test verdes.
- [ ] T4 — Gate Fase 0: PR aberto, check `lint + build + test` verde, `actionlint`, build `site`/`site-admin` OK. Revisão governança (g1-governance-reviewer) sem P0/P1. · feito quando: PR mergeável aprovado.

## Fase 1 — stand-up prod na VM (dispatch, rota intocada)
- [ ] T5 — (mantenedor) Secrets do GitHub Environment prod do site: `POSTGRES_PASSWORD`, `DATABASE_URL`→`site-prod-db`, `JWT_SECRET`(=prod), `CLOUDINARY_*`, `PUBLIC_GA_ID`. · feito quando: secrets presentes no Environment.
- [ ] T5b — (mantenedor) Bootstrap do arquivo `apps/site/.env` no disco da VM (R12). `_deploy-module.yml:325` lê do disco — sem o arquivo deploy aborta. Conteúdo mínimo: `POSTGRES_PASSWORD`, `JWT_SECRET` (casar com `apps/accounts/.env`), `CLOUDINARY_*` (opcional), `PUBLIC_GA_ID` (opcional), `DATABASE_URL=postgres://admin:<pwd>@site-prod-db:5432/site`, `POSTGRES_USER=admin`. · feito quando: arquivo existe na VM e contém as chaves obrigatórias (validar com `ssh faren "grep -c '^POSTGRES_PASSWORD=' apps/site/.env && grep -c '^JWT_SECRET=' apps/site/.env && grep -c '^DATABASE_URL=' apps/site/.env"` → 1/1/1; nunca fazer `cat` do .env que expõe secrets no terminal/log).
- [ ] T6 — Deploy prod dispatch: `gh workflow run deploy.yml -f module=site -f mode=deploy --ref main` (após promote `dev→main` ff do PR; `--ref main` obrigatório porque default branch = `dev` (D073) → sem `--ref` rodaria em `dev`=beta em vez de `main`=prod). Sobe `site-prod-app`+`site-prod-db`. Raiz **segue** no redirect→beta. · feito quando: run SUCCESS.
- [ ] T7 — Gate Fase 1: `site-prod-app`+`site-prod-db` `healthy`; smoke INTERNO (health do container, posts>0 via `/healthz` no container — `critical_routes` provisórias internas no manifest, NÃO URL pública raiz que ainda redireciona pro beta). Raiz pública inalterada. · feito quando: health verde + posts>0.

## Fase 2 — seed do conteúdo (VM write, mantenedor)
- [ ] T8 — (mantenedor) Snapshot `site-beta-db` + `site-prod-db`; congelar autoria no beta (janela). · feito quando: dumps salvos off-VM.
- [ ] T9 — (mantenedor) `pg_dump site-beta-db` → `psql site-prod-db` (conteúdo: posts/pages/taxonomies/comments/media_map/redirects). · feito quando: restore sem erro.
- [ ] T10 — Gate Fase 2: contagens prod == beta (posts/pages/taxonomies/media_map/redirects); `/healthz` prod posts>0. · feito quando: diffs zero.

## Fase 3 — flip da rota (mantenedor) + aposentar redirect
- [ ] T11 — (mantenedor) Reapontar Tunnel `artificiorpg.com` + `www.artificiorpg.com` → `site-prod-app`; remover redirect interno beta→raiz. · feito quando: rota aplicada.
- [ ] T12 — Gate Fase 3 (raiz prod): `https://artificiorpg.com/healthz` 200, home/`/blog/`/1 post/1 page 200, canonical/`/sitemap-index.xml`/`/rss.xml` = raiz, grep `wp-content/uploads` servido = 0. Prova de isolamento: editar/rebuild no beta NÃO altera a raiz. · feito quando: smoke 100% + isolamento provado.

## Fase 4 — fechar T9 da 029 + staging real
- [ ] T13 — Validar `beta.artificiorpg.com` retorna `X-Robots-Tag: noindex` (ou meta) e raiz **não**. · feito quando: `curl -sI` beta tem noindex, raiz não.
- [ ] T14 — Registro: sessão `26-06-..._site_prod-parity`; spec 029 T9 marcado done; `BL-SITE-CUTOVER-029` follow-up T9 fechado; `project-state.md` (site com prod próprio, redirect aposentado); decisão nova se aplicável (aposentadoria do D075-hack). Via PR/ff conforme regra. · feito quando: docs atualizados e aprovados.

## Notas
- DNS autoritativo/registro = intocado (Gate C segue adiado, D016). Esta spec usa Tunnel/rota Cloudflare + container, não cerimônia DNS.
- Cloudinary compartilhado: mídia migrada serve igual em prod (URLs absolutas).
- Fonte de verdade de conteúdo pós-cutover = prod; beta = staging descartável/sincronizável (definir sync se necessário).
