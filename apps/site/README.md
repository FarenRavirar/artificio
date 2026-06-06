# `@artificio/site` — portal + blog (Astro SSG)

Módulo `site` do Artifício RPG. Blog estático (SSG) saindo do WordPress. Spec: `specs/008-site-foundation/`.

## Arquitetura

```
WP REST (read-only) ──importer──> store Postgres ──export──> src/data/posts.json ──astro build──> dist/ (estático)
                                   (fonte da verdade)         (snapshot/artefato)        + Pagefind index
```

- **Store nativo Postgres** = fonte da verdade pós-import (D005). Schema: `db/migrations/`.
- **Importador WP** (`importer/`) = one-shot, **descartável** pós-cutover, **read-only** sobre o WP. Idempotente por id/slug. DRY-RUN mantém URLs de mídia do WP (Cloudinary entra depois).
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
pnpm --filter @artificio/site run import    # WP REST -> store (dry-run). 'run' evita o builtin pnpm import
pnpm --filter @artificio/site export        # store -> src/data/posts.json
pnpm --filter @artificio/site sync          # migrate + import + export (pipeline completo)
pnpm --filter @artificio/site build         # astro build + pagefind index
pnpm --filter @artificio/site dev           # astro dev (busca Pagefind só no build/preview)
```

`posts.json` versionado = **seed pequeno** (amostra). `pnpm sync` regenera o conteúdo completo do WP (125 posts) localmente; `.pgdata/` é gitignored.

## Mídia (Cloudinary)

O importador migra mídia **env-gated** (`importer/media.ts`, D025/R8):
- **`CLOUDINARY_URL`** (ou `CLOUDINARY_CLOUD_NAME`+`API_KEY`+`API_SECRET`) presente → faz upload do original WP, reescreve `src` (featured + inline) p/ URL Cloudinary, cacheia em `media_map` (idempotente).
- ausente → **dry-run**: mantém URLs do WP (zero credencial, zero rede). É o default local.

Creds = segredo (mantenedor/VM), nunca versionado. Rodar a migração real de mídia = setar `CLOUDINARY_URL` no `.env` e `pnpm sync`.

## Status (spec 008)

- ✅ F2 store (schema/migrations/runner), F3 importador (paridade 125/125), SSG + arquivos + busca Pagefind + RSS/sitemap + SEO.
- ⬜ Cloudinary na mídia, pages institucionais, backend HTTP/admin + rebuild webhook, Header island React, deploy beta.
