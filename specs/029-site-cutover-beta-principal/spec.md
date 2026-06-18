# 029 — Cutover beta → principal (site no domínio raiz)

- **Módulo/Pacote:** apps/site, apps/site-admin, apps/accounts, packages/ui | infra (DNS/Tunnel)
- **Gate relacionado:** D074 (beta vira principal por redirect do mantenedor) — NÃO é o cutover cerimonial Gate C; mexe no domínio raiz, então tratar com cuidado de Gate C
- **Origem:** decisão do mantenedor 2026-06-17 (`sessoes/26-06-17_3_site_media-finalize.md`)

## Problema

A migração WP→site está concluída (residual-zero) e o `beta.artificiorpg.com` deve virar **o site principal** no domínio raiz `artificiorpg.com` (D074). Hoje a raiz ainda serve o **WordPress** (verificado: `wp-content`, Elementor, Site Kit, AMP no HTML; `/healthz`=404). O WP/Hostinger sai do ar ~2026-06-20. Toda referência interna ao site usa `beta.artificiorpg.com` e precisa migrar para a raiz, sem regressão de SEO.

## Dependência pétrea de ordem

1. **DNS/Tunnel = AÇÃO DO MANTENEDOR** (regra pétrea: agente nunca escreve DNS/Tunnel/WAF). Apontar `artificiorpg.com` (raiz + `www`) → Cloudflare Tunnel → container do site (o mesmo que serve `beta.`). Isto é o que efetivamente "vira principal".
2. **Só DEPOIS** da raiz servir o site novo, o flip de canonical/links para a raiz é correto — senão os links apontam para o WP que está sendo substituído.

## Requisitos (numerados, testáveis)

- **R1** — `apps/site/astro.config.mjs` `site` passa de `https://beta.artificiorpg.com` para `https://artificiorpg.com`. Propaga para canonical (`Astro.site`), sitemap-index, RSS e robots.
- **R2** — Fallbacks hardcoded em `apps/site/src/pages/robots.txt.ts` e `rss.xml.ts` (`?? "https://beta..."`) passam para a raiz.
- **R3** — `packages/ui/src/{Footer,Header,modules}.tsx` (`brandHref`, `copyrightHref`, Portal href) passam para a raiz. **Impacto compartilhado:** força rebuild+redeploy PROD de `glossario`, `mesas`, `accounts` (consumidores da UI).
- **R4** — `apps/accounts/frontend/src/main.tsx` `PORTAL_URL` passa para a raiz.
- **R5** — `apps/site-admin/src/pages/{PageEditor,PostEditor}.tsx` URL de preview passa para a raiz.
- **R6** — Canonical dos posts já é raiz (`https://artificiorpg.com/blog/<slug>/`, vindo do importador); confirmar que pages e home também emitem canonical na raiz após R1.
- **R7** — 301 preservado: slugs WP `/blog/<slug>/` e `/<slug>/` resolvem na raiz (mesmo permalink, D047). O `redirect-cache` do site segue ativo. Validar que URLs antigas do WP não quebram.
- **R8** — Sitemap publicado na raiz (`/sitemap-index.xml`) com URLs de raiz; submeter no Search Console. (`/sitemap.xml` 404 — ver gaps.)
- **R9** — Sem regressão de residual-zero: grep `wp-content/uploads` no dist/live = 0 após rebuild.

## Critérios de aceite

- `https://artificiorpg.com/` serve o site novo (Astro/Pagefind), `/healthz` 200, posts/pages/home 200.
- Canonical, OG `url`, sitemap e RSS apontam para `https://artificiorpg.com/...`.
- Footer/Header/Portal de glossario/mesas/accounts (prod) linkam para a raiz; deploys prod verdes.
- URLs antigas do blog resolvem (301/200), sem `wp-content/uploads` no servido.
- `www.artificiorpg.com` resolve para a raiz (canônico único).

## Fora de escopo

- Os gaps de paridade (analytics `PUBLIC_GA_ID` vazio, newsletter `[newsletter]` quebrada, `/sitemap.xml` 404, form de contato) — decisão do mantenedor 2026-06-17: **virar principal mesmo assim**, gaps viram follow-up (`BL-SITE-PRINCIPAL-GAPS`).
- Biblioteca de mídia/PDFs (spec 028) — paralelo.
- Mudança de provedor de DNS / certificados (gerido por Cloudflare).

## Riscos e impacto em outros módulos

- **Ordem com o DNS:** flip de links antes do DNS aponta para o WP. Coordenar: DNS (mantenedor) → flip+redeploy (agente).
- **packages/ui compartilhado:** blast radius em glossario/mesas/accounts (prod). SDD Completo; deploy prod dos 3 + site.
- **SEO inegociável:** mudança de canonical beta→raiz; garantir 301 e submissão de sitemap; evitar conteúdo duplicado (beta + raiz indexados). Avaliar `noindex`/redirect do `beta.` após o cutover para não competir com a raiz.
- **WP EOL:** após o DNS, a raiz não pode mais depender do WP; o import-on-start do site deve ir a `SITE_IMPORT_ON_START=false` (store canônico).
- **DNS/Tunnel:** ação exclusiva do mantenedor; agente só verifica read-only e faz o código.
