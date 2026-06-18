# Tasks — 029 Cutover beta → principal

> Ordem pétrea: DNS (mantenedor) ANTES do flip de links (agente). Cada deploy = aprovação nominal.

## Frente A — infra (mantenedor)
- [ ] T1 — Mantenedor aponta `artificiorpg.com` (+`www`) → Tunnel → container do site · feito quando: agente verifica read-only `artificiorpg.com/healthz`=200, home/post 200, `wp-content` ausente.

## Frente B — código (agente, via PR, após T1)
- [ ] T2 — `astro.config.mjs` `site` → `https://artificiorpg.com` · feito quando: build local gera canonical/sitemap/RSS na raiz.
- [ ] T3 — Fallbacks `robots.txt.ts`/`rss.xml.ts` → raiz · feito quando: endpoints servem host raiz.
- [ ] T4 — `packages/ui` Footer/Header/modules hrefs → raiz · feito quando: `pnpm --filter @artificio/ui build`+test verdes.
- [ ] T5 — `accounts` `PORTAL_URL` + `site-admin` preview → raiz · feito quando: builds verdes.
- [ ] T6 — Deploy: site (beta/raiz) + redeploy PROD glossario/mesas/accounts (consumidores UI) · feito quando: deploys verdes + smoke por módulo; Footer/Portal linkam raiz.
- [ ] T7 — Verificação SEO/residual: canonical/OG/sitemap/RSS na raiz; grep `wp-content/uploads` dist/live=0; URLs antigas resolvem (301/200) · feito quando: tudo provado.

## Pós-cutover
- [x] T8 — Import-on-start OFF por padrão **no código** (PR #57): `docker-entrypoint.sh` + `docker-compose.beta.yml` default → `false` (não depender de env na VM). Motivo (review CodeRabbit): com WP morto, default=`true` rodaria `pnpm run import` no boot e, com `set -e`, derrubaria o site principal antes de servir. Import vira opt-in explícito (`SITE_IMPORT_ON_START=true`, só com WP vivo). Resolve antes da redeploy do cutover (não mais "pós").
- [ ] T9 — Decidir `noindex`/redirect do `beta.artificiorpg.com` p/ não duplicar índice com a raiz · feito quando: política aplicada e validada.
- [ ] T10 — Submeter sitemap da raiz no Search Console (mantenedor) · feito quando: GSC aceita.
- [ ] T11 — Follow-up gaps `BL-SITE-PRINCIPAL-GAPS` (analytics/newsletter/sitemap.xml/contato) · feito quando: itens fechados ou repriorizados.
