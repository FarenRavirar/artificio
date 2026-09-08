# 030 — Site: deploy PROD próprio (paridade de infra com os outros módulos)

- **Módulo/Pacote:** apps/site (+ apps/site-admin no build) | infra (deploy-manifest, Tunnel, DB prod)
- **Gate relacionado:** Gate C-adjacente (toca domínio raiz `artificiorpg.com`). NÃO é a cerimônia DNS do Gate C (provedor/registro intocado); é stand-up de container/rota igual aos demais módulos.
- **Origem:** decisão do mantenedor 2026-06-18 (esta sessão) — a spec 029 virou principal por **redirect interno Cloudflare** (D075) como gambiarra de prazo (WP EOL ~06-20). Infra precisa ficar no padrão definitivo: beta E prod separados, como mesas/glossario/accounts.
- **Status:** Fase 0 (código) ✅ concluída (PR #58). Fase 1 parcial (T5b .env ✅, T6 dispatch ✅). **Fases 2-4 delegadas à spec 031** (correção do fluxo de dados + seed + flip autoria + flip rota). **Spec 031 é bloqueadora das Fases 2-4 desta spec.**

## Problema

O cutover 029 apontou a raiz `artificiorpg.com` para o **mesmo container `site-beta-app`** (redirect interno Cloudflare, D075). Consequências:

1. **`beta.` deixou de ser staging real** — raiz e beta = mesmo container + **mesmo DB** (`site-beta-db`). Qualquer rebuild/import/edição de autoria no beta reflete na produção pública. Não há ambiente seguro para testar o site.
2. **Fora do padrão canônico** — site é o único módulo com `env_override="beta"` no `deploy-manifest.json` e **sem `docker-compose.prod.yml`**. mesas/glossario/accounts têm beta+prod com projetos/DBs/hosts distintos, deploy por `deploy.yml` derivando env do ref (`dev`→beta, `main`→prod).
3. **SEO duplicado (T9 da 029)** — desindexar `beta.` sem afetar a raiz exige hack de Host header justamente porque é 1 container só.

Estado-alvo: site com **`site-prod-app` + `site-prod-db`** próprios, raiz servida pelo container prod, beta de volta a ser staging isolado, deploy pela esteira canônica. O redirect interno é aposentado. O T9 vira trivial (build beta emite `noindex`).

## Dependência pétrea de ordem

1. **Stand-up prod ANTES de qualquer flip de rota.** Subir `site-prod-app`+`site-prod-db` (dispatch), provar `healthy` + smoke interno, **sem** tocar a rota da raiz ainda (raiz segue no redirect→beta como está).
2. **Seed do DB prod a partir do DB beta** (conteúdo vive no `site-beta-db`). Dump→restore one-shot. **VM write = mantenedor.** Congelar autoria no beta durante a janela (evitar drift).
3. **Só depois** o mantenedor reaponta a rota Tunnel `artificiorpg.com` (+`www`) do redirect→beta para `site-prod-app`. **DNS/Tunnel/WAF = ação exclusiva do mantenedor** (regra pétrea).
4. **Só depois** do prod servir a raiz e smoke verde, beta recebe `noindex` (T9) e volta a ser staging.

## Requisitos (numerados, testáveis)

- **R1** — Criar `apps/site/docker-compose.prod.yml`: serviços `site-prod-app` (build `apps/site/Dockerfile`, expose 4322, `PUBLIC_SITE_URL=https://artificiorpg.com`, `SITE_IMPORT_ON_START` default `false`) + `site-prod-db` (postgres:16-alpine, `POSTGRES_DB=site`, volume nomeado prod). Espelha `docker-compose.beta.yml` trocando nomes beta→prod. Network externa `artificio_net`. **Paridade de robustez (review DeepSeek):** `deploy.resources.limits.memory` no `site-prod-app` (≈512m, padrão mesas/glossario — build Astro em VM compartilhada sem cgroup = risco OOM) e `healthcheck.start_period` explícito (≥180s, igual ao beta, pois rebuild Astro demora; sem isso o loop de health do runner 60×3s pode estourar antes do `/healthz` subir).
- **R1b** — `SITE_IMPORT_ON_START=false` em prod depende de `SITE_FORCE_REBUILD`/ausência de `dist/index.html` para o `docker-entrypoint.sh:8-11` rodar o build inicial. Documentar a dependência no compose (comentário) — sem `dist`, rebuild roda naturalmente; com `dist` cacheado, exige `SITE_FORCE_REBUILD=true` p/ regenerar.
- **R2** — `deploy-manifest.json` entrada `site` vira paridade: `env_override=""` (deriva do ref como mesas/glossario), `compose_file="docker-compose.prod.yml"`, `compose_file_beta="docker-compose.beta.yml"`, `compose_project="site"` / `compose_project_beta="site-beta"`, `db_service="site-prod-db"` / `db_service_beta="site-beta-db"`, `health_containers=["site-prod-app"]` / `_beta=["site-beta-app"]`. **Campos obrigatórios completos (review DeepSeek — não omitir):** `db_name`, `db_user`, `push_branches`, `deploy_paths`, `reconcile_same_project_orphans=true` (projeto compose `site` pode ter órfãos da era pré-rename → conflito de nome no 1º deploy prod sem reconcile). Espelhar o shape exato de mesas/glossario.
- **R2b** — `critical_routes` por fase (review DeepSeek — o runner sempre testa o que está no manifest): **Fase 1** (stand-up, rota raiz ainda no redirect→beta), `critical_routes` prod = smoke INTERNO (`docker compose exec`/health do container) — NÃO usar URL pública da raiz (testaria o beta = falso-positivo). **Fase 3** (pós-flip): `critical_routes` finais = raiz `https://artificiorpg.com/` (home/healthz/blog/admin_protected). `_beta` segue `beta.` sempre.
- **R3** — `auto_deploy_on_push` permanece `false` (dispatch-only) até o 1º deploy prod verde + rota apontada; depois pode habilitar `push:dev`→beta (decisão registrada).
- **R4** — Volume prod nomeado distinto do beta (`pgdata_site_prod` ≠ `pgdata_site_beta`); zero risco de colisão de dados. `container_name` prod distinto (`site-prod-app`/`site-prod-db`).
- **R5** — Seed: `site-prod-db` recebe dump do `site-beta-db` (`pg_dump`→`psql`) no stand-up. Migrations do site rodam no entrypoint normalmente (`docker-entrypoint.sh:14` → `pnpm run migrate` → Kysely). Conteúdo (posts/pages/taxonomies/media_map/redirects) idêntico ao que a raiz serve hoje.
- **R5b** — Divergência consciente de migração (review DeepSeek): site migra schema via Kysely no entrypoint, NÃO via SQL runner (`apply_required_migrations.sh`). `_deploy-module.yml:439` chama o script (no-op porque `apps/site/database/` não existe), mas a porta canônica de schema é o entrypoint. Se futuramente adicionarem `database/` ao site, definir qual é a fonte de verdade (Kysely ou SQL) para evitar dupla porta de migração.
- **R6** — Secrets prod no GitHub Environment: `POSTGRES_PASSWORD`, `DATABASE_URL` (aponta `site-prod-db`), `JWT_SECRET` (=prod, SSO D042), `CLOUDINARY_*`, `PUBLIC_GA_ID`. Cloudinary é compartilhado (URLs absolutas) — mídia já migrada serve igual.
- **R7** — Rota Tunnel `artificiorpg.com` + `www.artificiorpg.com` → `site-prod-app` (mantenedor). Redirect interno beta→raiz aposentado. `beta.artificiorpg.com` → `site-beta-app` (inalterado).
- **R8** — `beta` emite `noindex,nofollow` (fecha T9): flag de build/runtime (ex.: `PUBLIC_SITE_ENV=beta`) → `Base.astro` passa `noindex` no `buildMeta`, OU `X-Robots-Tag` no `docker-compose.beta.yml`/server por env. Prod = index. Validar header/meta por host.
- **R9** — Rollback armado: enquanto prod não provado, redirect→beta permanece como está; reverter = manter rota no redirect. Snapshot do DB prod + do beta antes do seed.
- **R10** — Sem regressão residual-zero: grep `wp-content/uploads` no servido da raiz prod = 0 após cutover.
- **R11** — Atualizar `apps/site/docker-compose.beta.yml:30`: `PUBLIC_SITE_URL=https://beta.artificiorpg.com` (hoje hardcoded `https://artificiorpg.com`). Após separação, beta deve gerar canonical/OG/sitemap/Pagefind com hostname beta, não raiz. Noindex sozinho não resolve — search engines ainda veriam self-referencing canonicals apontando pro domínio errado. O compose prod (R1) já nasce com `PUBLIC_SITE_URL=https://artificiorpg.com`.
- **R12** — Pré-requisito de bootstrap na VM (Fase 1): `_deploy-module.yml:325` lê `apps/site/.env` do disco da VM antes de qualquer deploy. **Não basta** GitHub Environment secrets (T5) — o arquivo `.env` precisa existir no diretório `apps/site/` com `POSTGRES_PASSWORD`, `JWT_SECRET`, `CLOUDINARY_*`, `PUBLIC_GA_ID` e `DATABASE_URL` apontando para `site-prod-db`. Sem isso, o runner aborta na validação de secrets. Criar antes do primeiro dispatch de deploy prod (T5b).

## Critérios de aceite

- `site-prod-app` + `site-prod-db` `healthy` na VM; deploy prod via `gh workflow run deploy.yml -f module=site -f mode=deploy` (env deriva automaticamente de `github.ref` → `refs/heads/main` → prod) verde.
- `https://artificiorpg.com/` servido pelo `site-prod-app` (não mais redirect→beta): `/healthz` 200, home/blog/posts/pages 200, canonical/OG/sitemap/RSS = raiz, `wp-content/uploads` servido = 0.
- `https://beta.artificiorpg.com/` servido por `site-beta-app` isolado, retorna `X-Robots-Tag: noindex`/meta noindex; raiz **não** retorna noindex.
- Editar/rebuild no beta **não** altera o que a raiz serve (ambientes isolados, DBs distintos).
- `deploy-manifest.json` do site espelha o shape de mesas/glossario (env derivado do ref), com todos os campos obrigatórios (`db_name`, `db_user`, `push_branches`, `deploy_paths`, `reconcile_same_project_orphans`).
- Smoke prod do site nas `critical_routes` da raiz, igual aos outros módulos (pós-flip da Fase 3; na Fase 1 smoke é interno).

## Fora de escopo

- Cerimônia DNS Gate C (registro/provedor) — segue adiada (D016). Esta spec usa Tunnel/rota Cloudflare, não troca de DNS autoritativo.
- Gaps de paridade de conteúdo (`BL-SITE-PRINCIPAL-GAPS`: GA_ID, newsletter, sitemap.xml, contato) — follow-up paralelo.
- Biblioteca de mídia/PDFs (spec 028).
- Build em CI→GHCR (`BL-INFRA-GHCR-F12`) — site segue buildando na VM como hoje.

## Riscos e impacto

- **DNS/Tunnel = mantenedor.** Agente só verifica read-only + escreve código/compose/manifest. A rota da raiz é a única coisa que "vira oficial" e é ação do mantenedor.
- **Drift de conteúdo na janela de seed:** se autoria mexer no beta entre o dump e o flip da rota, prod nasce desatualizado. Mitigação: congelar autoria no beta; ou re-dump imediatamente antes do flip.
- **Cutover de escrita:** após o flip, autoria (admin/rebuild) passa a mirar o prod. Definir qual ambiente é fonte de verdade de conteúdo pós-cutover (prod) e que beta é descartável/sincronizável.
- **SSO:** `JWT_SECRET` prod igual ao accounts; cookie `Domain=.artificiorpg.com` vale em ambos. Sem mudança de contrato.
- **Volume/DB:** nomes prod distintos do beta evitam colisão; snapshot antes do seed protege rollback.
- **Aposentar o redirect:** só após smoke prod verde; manter como fallback até lá.
