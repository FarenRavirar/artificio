# `@artificio/site` — portal + blog (Astro SSG)

Módulo `site` do Artifício RPG. Blog estático (SSG). Spec: `specs/008-site-foundation/`.

> **Importador WordPress removido em 2026-07-27.** Era one-shot e descartável por desenho; o cutover terminou (D074/spec 029), o WP saiu do ar e o store Postgres é a fonte de verdade. Saíram `importer/` inteiro, os scripts `import`/`inventory`/`prep`, a rota `POST /admin/import` e as env `WP_BASE`/`SITE_IMPORT_ON_START`. Os helpers de HTML que moravam em `importer/sanitize.ts` **não** eram do importador (servem o runtime) e viraram `server/lib/content-html.ts`.

## Arquitetura

```
store Postgres ──export──> src/data/posts.json ──astro build──> dist/ (estático)
(fonte da verdade)          (snapshot/artefato)        + Pagefind index
```

- **Store nativo Postgres** = fonte da verdade (D005). Schema: `db/migrations/`.
- **Export** (`db/export.ts`) = gera `src/data/posts.json` do store. Desacopla o build do banco (sem driver no bundle Astro). É o "Content Layer" pragmático; rebuild incremental (D006) = `export` + `astro build`.
- **Astro** lê `posts.json` → 1 página por rota (`/blog/<slug>/`, arquivos de categoria/tag, home), zero-JS, marca `@artificio/ui`.

## Banco: dev vs prod

`db/connection.ts` escolhe driver por env:
- **dev** (sem `DATABASE_URL`): **pglite** (Postgres WASM in-process, persiste em `.pgdata/`). Sem Docker.
- **prod**: `DATABASE_URL` → **pg** (PG16). Mesmas migrations SQL, mesmo código.

> Kysely (typed, canon) entra no backend HTTP/admin futuro. O importador descartável usa SQL parametrizado cru.

## Comandos

```bash
pnpm --filter @artificio/site migrate      # aplica db/migrations (schema_migrations + lock + transacional)
pnpm --filter @artificio/site export        # store -> src/data/posts.json
pnpm --filter @artificio/site sync          # migrate + export
pnpm --filter @artificio/site rebuild       # export + astro build + pagefind (gatilho SSG, D006)
pnpm --filter @artificio/site build         # astro build + pagefind index
pnpm --filter @artificio/site serve         # backend HTTP (admin + rebuild webhook) :4322
pnpm --filter @artificio/site dev           # astro dev (busca Pagefind só no build/preview)
```

## Backend HTTP (`server/`)

Express + `@artificio/auth` (cookie `artificio_session`, SSO compartilhado). Estático (Astro `dist/`) é servido à parte; o backend só faz admin/health:
- `GET /healthz` — `{ ok, posts }` (deploy/smoke, sem auth).
- `GET /admin/status` — stats do store + último job (**role=admin**).
- `POST /admin/rebuild` — dispara `rebuild` (export+build+pagefind) — gatilho de publicação SSG incremental (D006). **role=admin**.

Jobs = single-flight (um por vez, lock em memória; `server/jobs.ts`). Smoke verificado: health 200, admin 401 sem cookie.

`posts.json` versionado = **seed pequeno** (amostra); `.pgdata/` é gitignored.

## Mídia (Cloudinary)

A migração de mídia era feita pelo importador (`importer/media.ts`, D025/R8), removido junto com ele: as imagens já estão no Cloudinary, com o mapeamento persistido em `media_map`. As credenciais seguem no compose porque o **upload de imagem do admin** continua usando Cloudinary com signed preset (regra pétrea: upload sempre pelo backend, nunca credencial hardcoded).

## Deploy beta (D044/D049)

2 containers em `artificio_net` (`docker-compose.beta.yml`):
- **`site-beta-app`** — `Dockerfile` (Node/Express). Entrypoint (`docker-entrypoint.sh`) roda IN-CONTAINER: `migrate → import(WP) → export → astro build → pagefind → serve`. O Express serve o `dist/` estático + `/healthz` + `/admin/*`.
- **`site-beta-db`** — `postgres:16-alpine` (o store; vol `pgdata_site_beta`).

`beta.artificiorpg.com` → `site-beta-app:4322` via Cloudflare Tunnel. Esteira = `deploy-site.yml` (push `dev`, espelha `deploy-mesas` via `_deploy-module.yml`). Smoke local do server único: `/ /blog/ /sobre-nos/ /healthz /robots.txt` 200, `/admin/*` 401, inexistente 404.

**Ação do mantenedor p/ habilitar:** GitHub Environment + secrets (`POSTGRES_PASSWORD`, `DATABASE_URL`, `JWT_SECRET`=prod, opc. `CLOUDINARY_URL`/`PUBLIC_GA_ID`); rota Cloudflare `beta.→site-beta-app`; validar passo de migração do `_deploy-module` (site migra no entrypoint).

## Status (spec 008)

- ✅ F2 store (schema/migrations/runner), F3 importador (paridade 125/125), SSG + arquivos + busca Pagefind + RSS/sitemap + SEO.
- ⬜ Cloudinary na mídia, pages institucionais, backend HTTP/admin + rebuild webhook, Header island React, deploy beta.
