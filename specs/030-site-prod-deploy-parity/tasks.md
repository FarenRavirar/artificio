# Tasks — 030 Site deploy PROD próprio (paridade)

> Ordem pétrea: código (PR) → stand-up prod (sem rota) → seed DB (mantenedor) → flip rota (mantenedor) → noindex beta. DNS/Tunnel = mantenedor. Cada deploy/VM-write/seed/rota = aprovação nominal por ação.
>
> **ATENÇÃO (2026-06-18): Fases 2-4 BLOQUEADAS por spec 031** (`specs/031-site-prod-data-fluxo/`). A spec 031 corrige o fluxo de dados (prod canônico → beta staging) e cobre seed, flip autoria, sync beta e flip rota. Executar spec 031 primeiro antes de retomar estas fases.

## Fase 0 — código ✅ CONCLUIDA (PR #58, `49ef112`)
- [x] T1a — `apps/site/docker-compose.beta.yml:30`: `PUBLIC_SITE_URL` → `https://beta.artificiorpg.com` (R11). · `f808527`
- [x] T1 — `apps/site/docker-compose.prod.yml`: `site-prod-app` (build Dockerfile, expose 4322, `PUBLIC_SITE_URL=https://artificiorpg.com`, `SITE_IMPORT_ON_START` default `false`, `deploy.resources.limits.memory` ~512m, `healthcheck.start_period` ≥180s, comentário `SITE_FORCE_REBUILD`) + `site-prod-db` (postgres:16-alpine, `POSTGRES_DB=site`, volume `pgdata_site_prod`), network externa `artificio_net`. · arquivo criado, build site OK.
- [x] T2 — `deploy-manifest.json` entrada `site` → paridade (R2): `env_override=""`, `compose_file`/`_beta`, `compose_project=site`/`_beta=site-beta`, `db_service=site-prod-db`/`_beta=site-beta-db`, `health_containers=["site-prod-app"]`/`_beta=["site-beta-app"]`, `db_name=site`, `db_user=admin`, `push_branches=["dev"]`, `deploy_paths=["apps/site","apps/site-admin"]`, `reconcile_same_project_orphans=true`. `critical_routes` Fase 1: `[]` (smoke interno manual; spec 031 T3b substitui por URLs públicas). · manifest JSON válido.
- [x] T3 — `noindex` no beta (R8): `X-Robots-Tag: noindex, nofollow` via env (`SITE_NOINDEX=true` no `docker-compose.beta.yml` → middleware no `server.ts`). · build/test verdes.
- [x] T4 — Gate Fase 0: PR #58 mergeado em `dev` (`49ef112`), promovido a `main` (`594c9a5`). Check `lint + build + test` verde, `actionlint`, build `site`/`site-admin` OK.

## Fase 1 — stand-up prod na VM ✅ CONCLUIDA
- [x] T5 — Secrets do GitHub Environment `production` do site (8 keys): `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `JWT_SECRET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `PUBLIC_GA_ID=G-8XN5BGPJP3`. Setados 2026-06-18. Deploy usa `--env-file` do disco; secrets são paridade/redundância.
- [x] T5b — `.env` prod criado na VM: `/opt/artificio/apps/site/.env` (7 keys, chmod 600, JWT casado com accounts, CLOUDINARY copiados). · validado com `grep -c` redacted.
- [x] T6 — Deploy prod dispatch: `gh workflow run deploy.yml -f module=site -f mode=deploy --ref main` (run 27779276620). `site-prod-db` healthy, `site-prod-app` em boot loop. Raiz segue no redirect→beta (D075).
- [x] T7 — Gate Fase 1: ✅ resolvido via spec 031. `site-prod-app` healthy após seed (T1c 031).

## Fase 2 — seed do conteúdo → **SPEC 031** (bloqueadora)
- [x] T8 → spec 031 T1a (snapshots) ✅
- [x] T9 → spec 031 T1c (pg_dump beta→psql prod) ✅
- [x] T10 → spec 031 T2a (contagens prod==beta, healthz posts>0) ✅

## Fase 3 — flip da rota + aposentar redirect → **SPEC 031**
- [x] T11 → spec 031 T3c (mantenedor reaponta Tunnel raiz→site-prod-app) ✅
- [x] T12 → spec 031 T3d (smoke público raiz, SEO limpo) ✅

## Fase 4 — fechar T9 da 029 + staging real → **SPEC 031**
- [x] T13 → spec 031 T3e (validar noindex beta, raiz sem) ✅ — resolvido com rebuild imagem `--build` + source `.env.beta` + limpeza cache tsx.
- [x] T14 → spec 031 T4b/T4c (registro docs, fechar T9 029) ✅ — PR #60 mergeado em `dev` (`37d9b4d`), promovido a `main`. backlog `BL-SITE-PROD-PARITY-030` FECHADO.

## Notas
- DNS autoritativo/registro = intocado (Gate C segue adiado, D016).
- Cloudinary compartilhado: mídia migrada serve igual em prod (URLs absolutas).
- Fonte de verdade de conteúdo pós-cutover = prod; beta = staging descartável/sincronizável.
- **Fluxo de dados invertido detectado:** todo conteúdo (125 posts) está no beta, prod vazio. Spec 031 corrige a direção (prod canônico → beta staging).
- **Container prod em boot loop:** `Card.astro:9` quebra com DB vazio. Só sobe após seed (spec 031 T1c).
- **critical_routes prod:** manter `[]` até spec 031 T3b (pós-seed, pré-flip rota).
