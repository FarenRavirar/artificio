# Tasks — 008 Módulo `site` (fundação)

> Tasks pequenas e verificáveis. Spec antes de código. Aprovação por ação (commit/push/VM).
> Legenda: ✅ feito · 🔄 em curso · ⬜ pendente · 🔒 ação do mantenedor.

## F1 — Fundação (levantamento + decisão + doc) — **prioridade D044**

- [x] **T1** — Recon READ-ONLY do WP (REST) · feito quando: contagens + permalink + HTML + Yoast capturados em `docs/agents/wp-content-inventory.md`. ✅
- [x] **T2** — Resolver 4 decisões abertas com o mantenedor · feito quando: D044–D047 gravadas em `decisions.md`. ✅
- [x] **T3** — Spec 008 (spec/plan/tasks) · feito quando: 3 arquivos criados em `specs/008-site-foundation/`. ✅
- [x] **T4** — Abrir sessão vinculada + atualizar `project-state.md`/`roadmap.md` · feito quando: sessão em `sessoes/` e estado refletem "site F1 em curso". ✅
- [ ] **T5** — Re-confirmar recon volátil antes do import real (números podem mudar) · feito quando: contagens re-validadas na véspera de F3.

## F2 — Store nativo (schema + skeleton)

- [~] **T6** — Esqueleto `apps/site` (Astro SSG, D048) · **frontend Etapa-1+2 ✅**, **backend/store ⬜ (F2)**.
  - **Etapa-1** (zero-JS, paridade c/ protótipo aprovado): build verde, workspace/turbo OK, reusa `@artificio/ui` (CSS+logos), home/artigo/404, dark-light, TOC scrollspy, SEO (canonical/OG/JSON-LD), `.astro` Header/Footer.
  - **Etapa-2** (build **35 páginas**, limpo): arquivos `/blog/` + `/blog/categoria/<slug>/` + `/blog/tag/<slug>/` + pills de categoria; **busca Pagefind** (índice estático, modal marca, `/` e Cmd/Ctrl+K); **RSS** (8 itens) + **sitemap** + **404**.
  - **Pendente Etapa-2:** Header/Footer como **island React** (`@artificio/ui` + session) — risco SSR (`@artificio/auth/client` é browser-only → exigiria `client:only`); recomendação = manter `.astro` zero-JS no header público (perf/leitura), island só se quiser estado de sessão vivo no blog. **Decisão do mantenedor.**
  - Protótipo aprovado (look+UX, desktop). Visual híbrido A+B, marca D040. Bônus: Gutenberg renderiza limpo pós-sanitize (de-risca F3).
- [x] **T7** — Schema Postgres (`posts`/`taxonomies`/`media`/`pages`/`comments`/`redirects`) + migration runner (schema_migrations + advisory lock pg + transacional) · `db/migrations/001_init.sql` + `db/migrate.ts`; slug único, categoria pai/filho via `parent_id`, N:N `post_taxonomies` (R1–R3). Dev=pglite / prod=pg (`db/connection.ts`).
- [~] **T8** — Camada de acesso ao store · adapter `query()` cru (pglite/pg) usado por importador + `export.ts`. **Kysely tipado** = backend HTTP/admin futuro (anotado).

## F3 — Importador WP→store (one-shot, descartável) — agente `wp-importer`

- [x] **T9** — Cliente REST (`importer/wp.ts`) + paginação (X-WP-TotalPages) + sequencial gentil · só GET, WP intocável (R4/D045).
- [x] **T10** — Sanitização allowlist (`importer/sanitize.ts`: script/style/on*/iframe/js: removidos) · Gutenberg preservado (R6). ⬜ teste de XSS dedicado.
- [x] **T11** — Mapeamento WP→store idempotente (`ON CONFLICT id`); slug imutável (UNIQUE); taxonomia aninhada (2 passes parent); Yoast→seo_title/description/canonical/og (R4/R7).
- [x] **T12** — Mídia Cloudinary **env-gated** (`importer/media.ts` + migration `002_media_map`): com `CLOUDINARY_URL` → upload original WP + reescreve `src` (featured+inline) + cache `media_map` idempotente; sem creds → dry-run mantém URLs WP. Funções puras (extract/rewrite/publicId) verificadas. **Falta:** rodar com creds reais (segredo do mantenedor) p/ migração efetiva (R8/D025).
- [x] **T13** — Escopo (`post`+categorias+tags+comentários); CPTs/woo/mesas não buscados; categoria genérica `blog` filtrada no read (R5/D046). ⬜ pages institucionais.
- [x] **T14** — Relatório de paridade · **rodado: posts WP=125 store=125 ✓, taxonomias 82/82, comentários 25/25** (R9/CA2). ⬜ mapa 301 (gera no cutover).

> **F2/F3 rodados local (pglite):** `migrate → import → export → build` = **209 páginas** (125 artigos+arquivos+home) de conteúdo WP real. Pipeline em `apps/site/README.md`.

## F4 — SSG + rebuild incremental

- [x] **T15** — Pré-render estático das rotas (`/blog/<slug>/`, `/blog/`, `/blog/categoria/<slug>/`, `/blog/tag/<slug>/`, home, 404) · build gera HTML por rota (209 páginas) (R10/R12). ⬜ pages institucionais.
- [x] **T16** — Backend HTTP (`server/`, Express + `@artificio/auth`): `GET /healthz`, `GET /admin/status`, `POST /admin/rebuild` (export+build+pagefind, gatilho SSG D006), `POST /admin/import` — admin endpoints gated `role==='admin'`; jobs single-flight (`server/jobs.ts`). Smoke: health 200 `{posts:125}`, admin 401 sem cookie (R11). ⬜ UI de admin, webhook→GH Actions p/ prod.

## F5 — `packages/content` (SEO)

- [x] **T17** — Pacote `@artificio/content` (TS puro, zero deps): `buildMeta` (OG/Twitter), `articleLd`/`breadcrumbLd`/`organizationLd`/`websiteLd`, `sitemapXml`, `robotsTxt`, `SITE`/`canonicalUrl`. 6/6 testes. Integrado no site (Base/[slug]/index/robots.txt) (R13). Reusável por mesas/glossário.
- [~] **T18** — **sitemap.xml** (@astrojs/sitemap) + **RSS** (@astrojs/rss) + **robots.txt** (via `@artificio/content`) + canonical raiz + JSON-LD via `content` ✅. ⬜ mapa 301 (gera no cutover), Rich Results Test, `sitemapXml` do content p/ módulos não-Astro (R14/R15/CA4).

## F6 — `packages/analytics` (GA4 cross)

- [x] **T19** — Pacote `@artificio/analytics` (TS puro): `gtagSrc`/`gtagInlineConfig` (cookie_domain raiz `.artificiorpg.com` = cross-subdomínio) + `trackEvent`/`trackPageview`. 3/3 testes. Integrado no site (`Analytics.astro`, gated `PUBLIC_GA_ID`; verificado loader+config injetados). Reusável por mesas/glossário (R16, D020). ⬜ exclusão de referral interno + 1 property = config no painel GA4 (mantenedor); G-ID real (mantenedor).

## F7 — Deploy beta + Gate D

- [ ] **T20** — `deploy-site.yml` via `_deploy-module.yml` (env=beta) + compose + `artificio_net` · feito quando: pipeline verde; snapshot/health/smoke (R18, D039/D041). 🔒 secrets/VM = mantenedor/Codex.
- [ ] **T21** — Subir `beta.artificiorpg.com` (Cloudflare Tunnel hostname→container) · feito quando: smoke home/post/sitemap 200, 404 ok, SSO redireciona p/ `accounts.`, GA4 dispara (CA5). 🔒 DNS/Tunnel = mantenedor.
- [ ] **T22** — Validação Opus (Gate D site) · feito quando: paridade + SEO + smoke + WP inalterado (CA6) conferidos; módulo marcado no roadmap.

## Notas de execução

- Codex executa código; Opus valida por Gate D. Aprovação por ação (commit/push/VM).
- F2–F6 = branch `dev`, sem prod. F7 = beta only (WP raiz intocável, Gate C adiado).
- Fases grandes podem virar specs-filhas (`009-site-importer`, `010-site-ssg`) se o detalhe exigir.
- Reusar agentes: `wp-importer` (F3), `seo-usability-auditor` (gate F5/F7).
