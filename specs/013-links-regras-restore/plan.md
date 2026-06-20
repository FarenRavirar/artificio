# 013 — Plano de implementação (`apps/links` diretório comunitário)

> Estratégia técnica. Fonte de requisitos = `spec.md`. Checklist executável = `tasks.md`.
> **Supera o plano estático anterior** (linktree nginx) — escopo virou app completo com SSO/DB/Cloudinary/moderação.

## Arquitetura final (pós-decisões 2026-06-20)

`apps/links` = **app completo, espelhando `apps/mesas`** (Astro público + Express backend + Postgres/Kysely + Cloudinary + SSO), não mais estático puro. Topologia mantida em **um único pacote** `@artificio/links` (não o split frontend/backend do mesas) — Astro + Express juntos, servidos por 1 container.

Árvore real (✅ = implementado; 🟦 = ação mantenedor):
```
apps/links/
  package.json            ✅ @artificio/links — astro + express^5.2 + kysely^0.29 + pg + cloudinary^2.9
                          #   + express-rate-limit + zod + sanitize-html + @artificio/{ui,auth}
  astro.config.mjs        ✅ CSP atualizada (img-src Cloudinary + connect-src self + accounts.artificiorpg.com; sitemap regex ancora /admin)
  database/
    migration_001_init_groups.sql ✅ groups (+slug,tags[]≤3,rules,is_adult,approved_at,submitted_*) + group_tags
  db/
    types.ts              ✅ Kysely Database (groups + group_tags)
    index.ts              ✅ singleton lazy via Proxy (padrão mesas)
    migrate.ts            ✅ runner local (paridade c/ framework de deploy D039)
    seed.ts               ✅ data/groups.ts → groups (curated/active) + vocabulário de tags; og→Cloudinary
  server/
    server.ts             ✅ Express: /healthz, GET /api/groups[/:slug], GET /api/tags (público),
                          #   POST /api/groups/suggest (auth+rate-limit), /api/admin/v1/{groups,tags}/* (requireAuth+requireAdmin),
                          #   POST /api/admin/v1/rebuild (+status), SSR fallback GET /grupo/:slug
    repo/groups.ts        ✅ Kysely queries (grupos + vocabulário de tags)
    lib/cloudinary.ts     ✅ uploadLogoFromUrl (sha256 public_id) + deleteLogo  [BL-CLOUDINARY-SHARED]
    lib/og.ts             ✅ parseInviteUrl (host allowlist) + fetchOgImage
    lib/validate.ts       ✅ zod + sanitize-html (parseSuggestion, cleanText)
    lib/slug.ts           ✅ slugify canônico único (RegExp combinantes U+0300–U+036F)
    lib/render.ts         ✅ renderGroupPage: HTML SSR inline p/ /grupo/:slug (SEO completo)
    jobs.ts               ✅ runner single-flight (rebuild SSG, espelha apps/site)
  src/
    data/groups.ts        ✅ SEED dos 12 curados + 1 canal (permanece)
    data/regras.ts        ✅ regras gerais estáticas (permanece)
    layouts/Base.astro    ✅ SEO (canonical/OG/JSON-LD/GSC) + tema dark/light + script gate +18
    components/Sidebar.astro            ✅ Grupos / Regras / Grupos de RPG / Projetos
    components/GroupCard.astro          ✅ logo+nome+tags+badge+18+datas+gate+18
    components/PortalHeader.astro       ✅ Header SSO island (@artificio/ui)
    pages/index.astro                   ✅ shell + Header SSO + seções
    pages/grupo/[slug].astro            ✅ página publicada (SEO: descrição + rules + JSON-LD + gate+18)
    pages/admin/index.astro             ✅ painel CRUD admin (noindex)
    components/CommunityGroups.tsx      ✅ ISLAND: lista comunitária + filtro tag + gate +18
    components/SuggestForm.tsx          ✅ ISLAND: form de sugestão (só logado)
    components/admin/AdminPanel.tsx     ✅ painel admin CRUD grupos + tags
    lib/groups-source.ts  ✅ fonte SSG (DB ou fallback curados)
    styles/global.css     ✅ tokens marca + tema dark/light + chips + gate+18 + foco visível
  public/
    placeholder.svg       ✅ fallback logo nula
    robots.txt            ✅ Allow /, Disallow /admin, Disallow /admin/, Sitemap
    og-default.png        ✅ imagem OG padrão (logo Artifício)
  Dockerfile              ✅ Express+DB multi-stage (espelha apps/site)
  docker-compose.prod.yml ✅ links-app + links-db + volume pgdata_links_prod
  docker-entrypoint.sh    ✅ migrate → seed → build → serve
```

> **Foundation estática substituída:** `nginx.conf` + Dockerfile/compose estáticos + 13 JPGs + `scripts/fetch-logos.mjs` removidos. Modelo Express+DB+Cloudinary no lugar.

## Stack (DECISÃO 2026-06-20: espelhar `apps/mesas`, não `apps/site`)

Kysely **^0.29.2** + pg **^8.20** + cloudinary **^2.9** + express **^5.2.1** + express-rate-limit **^8.5.2** + zod **^4.4.3** + sanitize-html + `@artificio/auth`. DB **pg-only** (sem pglite). Conexão = singleton lazy via Proxy (`db/index.ts`, padrão mesas). Migrations = framework de deploy D039 (`database/migration_*.sql` + header obrigatório + `schema_migrations(migration_name)`; online-safe sem DROP/DELETE). Runner local `db/migrate.ts`.

## Modelo de dados

### Tabela `groups`

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid | PK `gen_random_uuid()` |
| `name` | text | nome do grupo/canal |
| `slug` | text null | **SEO**: slug da página publicada `/grupo/<slug>` (UNIQUE entre não-nulos; gerado na ativação; editável pelo admin) |
| `tags` | text[] | **até 3** slugs referenciando `group_tags` (CHECK ≤3) |
| `description` | text null | sanitizado |
| `rules` | text null | **regras próprias do grupo** (sanitizado, até ~4000), além da descrição |
| `invite_url` | text | `chat.whatsapp.com/*` ou `whatsapp.com/channel/*` (validado, UNIQUE) |
| `kind` | text | `group` \| `channel` |
| `category` | text | `artificio` \| `tematicos` \| `parceiros` \| `comunidade` |
| `is_adult` | bool | **+18** (default false; admin edita) |
| `logo_url` | text null | Cloudinary secure_url |
| `logo_public_id` | text null | Cloudinary public_id |
| `status` | text | `pending` \| `active` \| `archived` \| `rejected` |
| `source` | text | `curated` \| `community` |
| `submitted_by` | text null | SSO user id (comunidade) |
| `sort_order` | int | ordenação |
| `approved_at` | timestamptz null | **quando o admin aprovou** (set no accept); exibido no card |
| `created_at` | timestamptz | **quando foi enviado/sugerido**; exibido no card |
| `updated_at` | timestamptz | |

> Sugestão = `INSERT status=pending source=community`. Curados = seed `status=active source=curated`. Dedupe por `invite_url` UNIQUE.

### Tabela `group_tags` (vocabulário gerido pelo admin)

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid | PK |
| `slug` | text | UNIQUE, **imutável** (grupos referenciam por slug) |
| `label` | text | rótulo exibido (editável). Ex.: "Mestres", "Jogadores", "DnD", "Cenários" |
| `sort_order` | int | ordenação |
| `created_at`/`updated_at` | timestamptz | |

> CRUD admin em `/api/admin/v1/tags/*`. Remover tag → `array_remove(groups.tags, slug)` em todos os grupos.

## Reuso (evitar duplicação — pétrea)

> Mirror primário = **`apps/mesas`** (D-LNK-10). `apps/site` é referência secundária (mesmo `requireAdmin`).

| Necessidade | Reusar de | Status / como |
|---|---|---|
| SSO verify / requireAuth | `@artificio/auth` | ✅ `import { requireAuth }` + tipo `AuthenticatedRequest` |
| requireAdmin (role==='admin') | `apps/site/server/server.ts:37-44` | ✅ handler de 4 linhas copiado p/ `server.ts` |
| Kysely connection (singleton Proxy) | `apps/mesas/backend/src/db/index.ts` | ✅ espelhado em `db/index.ts` |
| Cloudinary upload | `apps/mesas/.../uploadDiscordImage.ts` (upload_stream) | ✅ copiado em `lib/cloudinary.ts` → **débito `BL-CLOUDINARY-SHARED`** (3 consumidores) |
| og:image fetch | padrão `apps/site/importer/media.ts` | ✅ helper próprio `lib/og.ts` (allowlist de host) |
| Rate-limit submissão | `express-rate-limit` (canon mesas) | ✅ `suggestLimiter` (15min/10) |
| Sanitização de input | `sanitize-html` + `zod` (canon mesas) | ✅ `lib/validate.ts` |
| Header SSO + login | `@artificio/ui` Header (`userMenu`/`onLoginClick`/`loginLabel`) | ✅ island `PortalHeader.astro` (client:load) |
| Migrations framework | `scripts/deploy/apply_required_migrations.sh` (D039) | ✅ `database/migration_*.sql` + runner local; deploy aplica c/ `MIGRATIONS_DIR=apps/links/database` |
| Deploy | **`deploy.yml` unificado** (matrix do `deploy-manifest.json` → `_deploy-module.yml`) | ✅ código: +entrada no manifest + `"links"` no enum `workflow_dispatch`. 🟦 deploy/tunnel/.env = mantenedor. |

## SEO / descoberta (Google Search Console) — req. 2026-06-20

Cada grupo ativo é **publicado** numa página própria indexável: **`/grupo/<slug>`** (card + descrição + **regras do grupo** + tags + badge +18 + datas enviado/aprovado). Requisitos:
- **Slug** estável por grupo (col. `slug`, UNIQUE). Gerado na ativação; admin pode reescrever. Não muda sozinho ao editar nome (não quebra URL indexada).
- **Sitemap** (`@astrojs/sitemap`) incluindo todas as páginas `/grupo/<slug>` ativas + home. Regenerado no build.
- **Google Search Console:** meta de verificação (`google-site-verification`) via env `PUBLIC_GSC_VERIFICATION`; `robots.txt` permitindo indexação (prod) e `Sitemap:` apontando o sitemap.
- **Meta por página:** `<title>`, `<meta description>`, **canonical**, Open Graph (og:title/description/image=logo Cloudinary) e **JSON-LD** (`Organization`/`ItemList`) p/ rich results.
- **Renderização (DECIDIDO 2026-06-20):** **SSG** das páginas `/grupo/<slug>` ativas no build, lendo o DB (espelha o gatilho de rebuild do site D006). Aprovar/editar no painel admin dispara **rebuild** (job, como `/admin/rebuild` do site). A seção comunitária na home continua **island** (hidrata `/api/groups`) p/ refletir aprovações sem esperar rebuild; já as páginas indexáveis por slug são estáticas (SEO estável). Fallback: se o slug não existir no dist (aprovado e ainda sem rebuild), o Express serve a página via `/grupo/:slug` (SSR mínimo, renderGroupPage) até o próximo build.

## Deploy / infra

- **Deploy unificado (spec 026 F4) — links respeita a matriz, NÃO ganha workflow próprio.** O `deploy.yml` único carrega `.github/deploy-manifest.json`, gera `matrix.include` e chama `_deploy-module.yml` por módulo (substituiu os `deploy-{mesas,site,…}.yml`). Para links: (1) **5ª entrada** no manifest (PROD-only `env_override:"prod"`, `auto_deploy_on_push:false` dispatch-only, `deploy_paths:["apps/links"]`, `db_service:"links-db"`, `health_containers:["links-app"]`, `critical_routes` = healthz/home/api_groups 200 + admin 401); (2) **adicionar `"links"` ao enum `inputs.module.options`** do `workflow_dispatch` em `deploy.yml` (senão o dispatch não lista links); (3) migrations via framework D039 com `MIGRATIONS_DIR=./apps/links/database` (snippet pronto em `tasks.md` T5b). Como links tem DB+SSO, encaixa no padrão (o antigo blocker "workflow assume DB" sumiu).
- `.env` (VM, gitignored): `DATABASE_URL`, `POSTGRES_PASSWORD`, `JWT_SECRET` (= accounts, D042), `CLOUDINARY_*`, `PUBLIC_LINKS_URL`, `PUBLIC_GSC_VERIFICATION` (Google Search Console), `TRUSTED_PROXY_CIDR`.
- **Tunnel `links.` = ação do mantenedor** (token CF sem escopo tunnel; probe 403 em 2026-06-20). DNS read OK pelo token.
- Beta/prod **(DECIDIDO 2026-06-20): prod-only no 1º corte** (como accounts). Beta entra depois só se a moderação precisar de staging.
- **Painel admin (DECIDIDO 2026-06-20):** vive **dentro do `apps/links`** em `src/pages/admin/*` (rota gated client-side + API `/api/admin/v1`), não em app separado. Reusa Header SSO + primitives `@artificio/ui`.

## Fases

- **F0 — Scaffolding app completo ✅:** package.json, db, server Express, reuso cloudinary/og/auth/validate. typecheck verde.
- **F1 — Seed curado ✅:** `db/seed.ts` (vocabulário + 12+1 curados). migrate+seed validados em postgres:16 (13 grupos + 10 tags). JPGs/fetch-logos limpos.
- **F2 — Frontend ✅:** sidebar, cards (tags/+18/datas), regras, `/grupo/[slug]` + SEO/JSON-LD/sitemap/GSC, Header SSO, ilhas comunitárias (lista+filtro+gate+18), tema dark/light. TC5 (SSR fallback), robots.txt, og-default.png, UX-1/UX-2/UX-8 feitos. Build 15 páginas verde.
- **F3 — Painel CRUD admin ✅:** `/admin` (noindex) + `AdminPanel.tsx`. CRUD grupos + vocabulário tags; email/nome do remetente + datas. Validado E2E.
- **F4 — Nav ✅:** label "WhatsApps" em `modules.ts`. Smoke consumidores pendente (pós-deploy `links.` no ar).
- **F5 — Deploy 🟦 (código ✅, ação mantenedor 🟦):** Dockerfile Express+DB + docker-compose.prod.yml + entrada manifest + enum deploy.yml feitos. 🟦 `.env` VM, tunnel `links.`, deploy dispatch.

## Rollback

Container fora não afeta nada (páginas estavam fora do ar — estado atual É o estado de falha). `git revert` do código; remover entrada do manifest; tunnel não criado = sem efeito.

## Validação

Build turbo verde; `curl` 200 home + `/api/groups`; fluxo sugestão→moderação→lista; smoke nav consumidores; mantenedor valida E2E + Nielsen/ISO.
