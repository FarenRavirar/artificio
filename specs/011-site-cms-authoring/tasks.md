# Tasks — 011 CMS / autoria nativa do site

> Super spec faseada. P0 = MVP que substitui o essencial do WP. Cada fase é PR deployável.
> Push/deploy/VM **só com autorização explícita do mantenedor** (regra pétrea).

## Fase 0 — Spikes & fundação
- [x] **T1** — Spec/plan/tasks 011 criadas + sessão vinculada (`26-06-06_1_site_cms-authoring`). Revisada p/ portal/hub completo (área K).
- [x] **T2** — **Spike 0 (pipeline)** ✅ → **D053**. Descoberto: `astro build` limpa `dist/` → rebuild = downtime (R6 só cobre restart). Fix: rebuild atômico (build→`dist.next`→swap). Preview = render no Express (sem adapter Node; público segue SSG puro). Doc: `spike-findings.md`.
- [x] **T3** — **Spike 1 (roles)** ✅ → **D052**. SSO só tem `user|admin` → capabilities no `apps/site` (`site_users`→editorial_role); `packages/auth` intocado. Mapa role→caps + `requireCapability`. Doc: `spike-findings.md`.
- [x] **T4** — **Editor de blocos** ✅ → **D051**. **BlockNote** (block-UX pronta, ProseMirror, MIT, HTML in/out, custom blocks React). Fonte dupla: `block_doc` JSON + `content_html` sanitizado. Validar HTML/bundle no T11; fallback TipTap+blocos. Doc: `spike-findings.md`.
- [x] **T5** — **Migration base** `003_authoring.sql`: `posts.block_doc JSONB`(D051) + OG(`og_title`/`og_description`/`twitter_card`/`noindex`) + `author_id` + `created_at`; pages idem (+`excerpt`/`seo_title`/`published_at`); sequence `site_content_id_seq` (ids nativos ≥1e6, não colidem c/ WP). Aplicada em pglite. `revisions`/`site_users` adiados (P1/roles fora deste escopo). 
- [x] **T6** — Camada `db/repo/*` tipada (posts/pages/taxonomies/redirects) sobre `query()` dual. **Kysely adiado** (atrito de dialect pglite) — mesmo padrão SQL parametrizado do site; anotado. Smoke tsx ✅.

## Fase 1 — MVP de autoria [P0] (Dashboard/roles ADIADOS a pedido do mantenedor — foco: add/editar posts+pages)
- [x] **T7** — API `/api/admin/v1/{posts,pages,taxonomies,redirects,slug-check,rebuild}` (CRUD) + sanitização na escrita (`sanitize`+`withToc`, tira `<script>`/handlers). Gate = `requireAdmin` (roles granulares `requireCapability` = fase futura, D052). · smoke repo ✅; tsc limpo.
- [x] **T8** — **Slug**: `slug-check` (sugestão slugify PT + unicidade), 301 automático ao mudar slug de post/page publicado (`redirects`). · testado (slug único + taken).
- [x] **T9** — **SPA admin** `@artificio/site-admin` (pacote PRÓPRIO, toolchain latest sem gambiarra: vite 8 + plugin-react 6 + react 19.2 + router 7 + blocknote 0.51) em `/admin`, servida pelo Express do site (static + fallback SPA). Shell + sidebar + rotas. Smoke local: `/admin/` 200 (base ok), client-routes 200, `/admin/status`+API 401 sem SSO. *(Dashboard R44 adiado.)*
- [x] **T10** — Lista de posts + lista de pages (busca, badges de status) + rotas de edição, consumindo `/api/admin/v1`.
- [x] **T11** — **Editor de blocos BlockNote** (D051) integrado (`BlockEditor`): UX de blocos pronta; carrega `block_doc` (ou HTML do WP via `tryParseHTMLToBlocks`); salva `block_doc`+`content_html` (`blocksToHTMLLossy`). Typecheck+build vite verdes. *(Fidelidade HTML em conteúdo real = validar no deploy.)*
- [x] **T12** — Campos no admin (excerpt/featured/tax inline/SEO/OG/canonical/noindex/status) ✅ + **público emite OG**: `@artificio/content` `buildMeta` estendido (aditivo: ogTitle/ogDescription/twitterCard/noindex; 6/6 testes ✅, só o site consome); `export.ts` emite seo_title/og_*/canonical/noindex; `Base.astro` + `[slug].astro`(blog+pages) repassam. Rebuild: 125 posts, HTML servido tem `og:title`/`og:description`/`og:image`/`twitter:*` com fallback p/ importados. R26/R27 ✅ (preview social = ver no compartilhamento; campo de preview visual no admin = refino futuro).
- [x] **T13** — **Status/workflow** draft/pending/publish/scheduled/private/trash/archived (API `:id/status` + create/update). *(Checagem por capacidade adiada com roles.)*
- [x] **T14** — **Rebuild atômico on publish** (`scripts/rebuild.mjs`: build→`dist.next`→swap; reusa `runJob`/`/admin/rebuild`). Sem downtime (R37/D053).
- [x] **T15** — **Preview** de rascunho `/admin/preview/:type/:id` (render no Express, CSS do design system, noindex). (R8/R38/D053).
- [ ] **T16** — Validação Fase 1: E2E local CA1 (post do zero → preview → publish → SSG via UI); builds turbo + `pr-checks` verdes; SSO intacto.

> **Fase 1 ✅ (backend + UI + OG público).** SPA admin (`apps/site-admin`, pacote próprio toolchain latest) + editor BlockNote + CRUD posts/pages.
> **2 rodadas de revisão Codex — 13 achados, todos corrigidos/verificados** (ver `handoff-review.md`): sanitização robusta (`sanitize-html`), 301 servidos (middleware+reload imediato), rebuild atômico (symlink A/B), rebuild server-side no publish + coalescing, validação de id, taxonomias pré-filtradas, SPA respeita status, pages canonical, preview stateless (não publica).
> **Deploy beta feito** (autorizado). T16/E2E autenticado = validação do mantenedor no ar.

## Fase 2 — Mídia & taxonomias [P0/P1]
- [ ] **T17** — **Biblioteca de mídia**: upload (validação tipo/tamanho no backend), listagem/busca, alt/legenda/título, dimensões/`srcset`, Cloudinary gated (R18/R19). · feito quando: CA3.
- [ ] **T18** — Inserir mídia no editor (da biblioteca/upload na hora) + **áudio/vídeo/embeds oEmbed** com allowlist (R13/R15/R20). · feito quando: embed sanitizado, sem `<script>` arbitrário.
- [ ] **T19** — **CRUD taxonomias** completo: categorias aninhadas + tags, descrição/slug, apagar com órfãos tratados, `count` atualizado (R22/R24). · feito quando: CA4.

## Fase 3 — Portal/Hub: curadoria + navegação + redirects [P1]
- [ ] **T20** — Migration `site_settings`/`curation`/`nav_items`/`audit_log` (online-safe, D039) + export emite `home.json`/`nav.json`. · feito quando: migrate roda pglite+PG; export gera os JSON.
- [ ] **T21** — **Curadoria da home (R45)**: hero/destaque, posts fixados (sticky), ordem das seções, blocos editoriais (banner/CTA/destaque de módulo); `index.astro` lê a curadoria. · feito quando: home reflete hero+sticky+ordem após rebuild (parte de CA9).
- [ ] **T22** — **Navegação editável (R46)**: nav secundário do blog + links do footer hub (ordenáveis). · feito quando: muda no admin → reflete no SSG; nav cross-módulo do `@artificio/ui` **intacto**.
- [ ] **T23** — **Redirects 301 UI (R47)**: CRUD da tabela `redirects` (inclui os gerados por mudança de slug). · feito quando: redirect criado responde no público (parte de CA9).

## Fase 4 — Workflow & usuários [P1]
- [ ] **T24** — **Agendamento** (`scheduled` + cron de publicação) (R6). · feito quando: post agendado entra no ar na data via rebuild.
- [ ] **T25** — **Autosave + revisões + restaurar** (R7). · feito quando: histórico navegável e restauração funciona.
- [ ] **T26** — **Gestão de usuários editores/roles** no site (R33) sem tocar SSO. · feito quando: atribuir/revogar papel editorial; backend valida.
- [ ] **T27** — Lista de posts com **busca/filtro/ordenação/paginação** + **bulk/quick edit** (R9/R41). · feito quando: filtros funcionam server-side.
- [ ] **T28** — **Log de auditoria (R48)**: middleware grava ação/usuário/alvo/timestamp em toda mutação; dashboard mostra. · feito quando: criar/editar/publicar/apagar aparecem no log.

## Fase 5 — Páginas, snippets, refinos [P1/P2]
- [ ] **T29** — **CRUD de pages** com o mesmo editor + slug/301 (R25).
- [ ] **T30** — **Snippets/blocos reutilizáveis** (R14) + bloco HTML cru (capacidade elevada) + download/arquivo (R16).
- [ ] **T31** — **Moderação de comentários** importados (R35) + ligar/desligar por post.
- [ ] **T32** — **Settings** do site (R42) + **métricas GA4 no dashboard (R49)** + assist de legibilidade/SEO (R29).
- [ ] **T33** — 🔒 Mantenedor: autorizar deploy beta de cada fase; smoke + validação Opus; rumo ao **Gate D do site**.

## Dependências / ordem
- T2–T4 (spikes) **antes** de T7+. T5/T6 antes da API. Fase 1 inteira antes da 2. Deploy de cada fase só com autorização.
- Fase 3 (curadoria) depende do MVP de posts (Fase 1) p/ ter o que curar.
- Toque em `packages/auth`/`packages/ui` = SDD Completo: testar mesas/accounts antes de mergear.
