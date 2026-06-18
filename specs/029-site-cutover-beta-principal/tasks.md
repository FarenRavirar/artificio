# Tasks — 029 Cutover beta → principal

> Ordem pétrea: DNS (mantenedor) ANTES do flip de links (agente). Cada deploy = aprovação nominal.

## Frente A — infra (mantenedor)
- [x] T1 — Mantenedor apontou raiz → site via redirect interno Cloudflare (D075, NÃO cutover DNS cerimonial Gate C). `artificiorpg.com` serve o site novo Astro; `wp-content` ausente na origem.

## Frente B — código (agente, via PR, após T1)
- [x] T2 — `astro.config.mjs` `site` → `https://artificiorpg.com` (PR #57). Build gera canonical/sitemap/RSS na raiz.
- [x] T3 — Fallbacks `robots.txt.ts`/`rss.xml.ts` → raiz (PR #57). Endpoints servem host raiz (verificado cache-busted na origem).
- [x] T4 — `packages/ui` Footer/Header/modules hrefs → raiz (PR #57). Bundle prod confirma `https://artificiorpg.com`, zero `beta.`.
- [x] T5 — `accounts` `PORTAL_URL` + `PUBLIC_SITE_URL` → raiz (PR #57, `77adbde`).
- [x] T6 — Deploy: PRs #56/#57 mergeados em `dev` (`950a7fc`+`2cc260a`); promote `dev→main` ff (run 27741596778); redeploy PROD glossario (27741699473) / mesas (27741844218) / accounts (27742012941) — 3/3 verdes; smoke 100%; Footer/Portal linkam raiz.
- [x] T7 — SEO/residual na origem cache-busted: robots/sitemap-index/canonical/og:url/RSS → raiz; `wp-content/uploads` servido = 0; nav/footer "Portal" → raiz. Refs beta vistas eram só cache Cloudflare (TTL 7200), purgado pelo mantenedor.

## Pós-cutover
- [x] T8 — Import-on-start OFF por padrão **no código** (PR #57): `docker-entrypoint.sh` + `docker-compose.beta.yml` default → `false` (não depender de env na VM). Motivo (review CodeRabbit): com WP morto, default=`true` rodaria `pnpm run import` no boot e, com `set -e`, derrubaria o site principal antes de servir. Import vira opt-in explícito (`SITE_IMPORT_ON_START=true`, só com WP vivo). Resolve antes da redeploy do cutover (não mais "pós").
- [ ] T9 — `noindex` do `beta.artificiorpg.com` p/ não duplicar índice com a raiz. **Reescopado p/ spec 030:** hack de Host header descartado — a causa raiz (raiz+beta no MESMO container, D075) é resolvida pela 030 (deploy prod próprio); com containers separados o `noindex` no build/env do beta fica trivial. Fecha em 030 T13. · feito quando: 030 entrega beta isolado com noindex e raiz sem noindex.
- [ ] T10 — Submeter sitemap da raiz no Search Console (mantenedor) · feito quando: GSC aceita.
- [ ] T11 — Follow-up gaps `BL-SITE-PRINCIPAL-GAPS` (analytics/newsletter/sitemap.xml/contato) · feito quando: itens fechados ou repriorizados.
