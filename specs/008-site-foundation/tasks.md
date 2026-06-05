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
- [ ] **T7** — Schema Postgres (`posts`/`taxonomies`/`media`/`pages`/`comments`/`redirects`) + migrations frameworkadas · feito quando: migra limpo em PG vazio; slug único; categoria com hierarquia pai/filho (R1–R3).
- [ ] **T8** — Camada de acesso ao store (queries Kysely tipadas) + testes · feito quando: CRUD de post/taxonomia/redirect testado.

## F3 — Importador WP→store (one-shot, descartável) — agente `wp-importer`

- [ ] **T9** — Cliente REST + paginação + rate-limit gentil · feito quando: lê post/page/category/tag/comment/media sem tocar o WP (só GET).
- [ ] **T10** — Sanitização HTML por allowlist (regra pétrea) + teste de XSS · feito quando: `<script>`/on*/iframe não-allowlist removidos; Gutenberg preservado (R6).
- [ ] **T11** — Mapeamento WP→store (slug imutável, taxonomia aninhada, Yoast→meta SEO) · feito quando: import idempotente por slug; meta migrada 1:1 (R4/R7).
- [ ] **T12** — Mídia: puxa original via REST → Cloudinary → reescreve `src` · feito quando: imagens dos posts servem via Cloudinary; mídia faltante listada (R8, D025).
- [ ] **T13** — Filtro de escopo (só `post`+taxonomias+pages institucionais+comments; ignora CPTs/woo/mesas) · feito quando: relatório mostra só o escopo `site` (R5, D046).
- [ ] **T14** — Relatório de paridade + mapa 301 · feito quando: contagem origem vs store, diff de slugs, 0 perdas, 301 100% (R9/R15, CA2).

## F4 — SSG + rebuild incremental

- [ ] **T15** — Pré-render estático das rotas (`/blog/<slug>/`, pages, arquivos cat/tag aninhados) · feito quando: build gera HTML por rota; post novo aparece no índice pós-rebuild (R10/R12).
- [ ] **T16** — Trigger de rebuild pelo admin (endpoint protegido `role==='admin'`) · feito quando: publish/edit dispara rebuild; não há SSR em runtime (R11).

## F5 — `packages/content` (SEO)

- [ ] **T17** — Pacote `content`: meta tags + JSON-LD (Article/Breadcrumb/Organization) · feito quando: post renderiza meta+JSON-LD válidos (R13).
- [ ] **T18** — `sitemap.xml` + `robots.txt` + canonical + 301 (preparado, ativa no cutover) · feito quando: sitemap lista todos; todo slug WP tem destino; Rich Results Test passa (R14/R15, CA4).

## F6 — `packages/analytics` (GA4 cross)

- [ ] **T19** — Pacote `analytics`: GA4 `cookie_domain` raiz + exclusão de referral interno · feito quando: dispara com cookie `.artificiorpg.com`; 1 property cobre subdomínios (R16, D020).

## F7 — Deploy beta + Gate D

- [ ] **T20** — `deploy-site.yml` via `_deploy-module.yml` (env=beta) + compose + `artificio_net` · feito quando: pipeline verde; snapshot/health/smoke (R18, D039/D041). 🔒 secrets/VM = mantenedor/Codex.
- [ ] **T21** — Subir `beta.artificiorpg.com` (Cloudflare Tunnel hostname→container) · feito quando: smoke home/post/sitemap 200, 404 ok, SSO redireciona p/ `accounts.`, GA4 dispara (CA5). 🔒 DNS/Tunnel = mantenedor.
- [ ] **T22** — Validação Opus (Gate D site) · feito quando: paridade + SEO + smoke + WP inalterado (CA6) conferidos; módulo marcado no roadmap.

## Notas de execução

- Codex executa código; Opus valida por Gate D. Aprovação por ação (commit/push/VM).
- F2–F6 = branch `dev`, sem prod. F7 = beta only (WP raiz intocável, Gate C adiado).
- Fases grandes podem virar specs-filhas (`009-site-importer`, `010-site-ssg`) se o detalhe exigir.
- Reusar agentes: `wp-importer` (F3), `seo-usability-auditor` (gate F5/F7).
