# Tasks — 011 CMS / autoria nativa do site

> Super spec faseada. P0 = núcleo mínimo de autoria/administração; paridade prática com WordPress depende das fases seguintes. Cada fase é PR deployável.
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
- [x] **T16** — Validação Fase 1: E2E autenticado CA1 (post do zero → preview stateless → publish → rebuild → SSG). **Núcleo validado LOCAL (2026-06-08)** com token admin HS256 + pglite: gate 401(sem token)/200(admin); criar draft; preview stateless com `noindex` + XSS sanitizado; preview persistido; **rebuild/SSG completo verde** (astro build 219 arquivos + pagefind 125 páginas + swap atômico via junction). Smoke beta público OK. **Achado:** publish via `/posts/:id/status` não carimbava `published_at` → `date:""` → quebrava RSS no build → corrigido no T17. **E2E com login Google real no beta validado pelo mantenedor (2026-06-08) — T16 FECHADO.**

> **Fase 1 ✅ (backend + UI + OG público).** SPA admin (`apps/site-admin`, pacote próprio toolchain latest) + editor BlockNote + CRUD posts/pages.
> **2 rodadas de revisão Codex — 13 achados, todos corrigidos/verificados** (ver `handoff-review.md`): sanitização robusta (`sanitize-html`), 301 servidos (middleware+reload imediato), rebuild atômico (symlink A/B), rebuild server-side no publish + coalescing, validação de id, taxonomias pré-filtradas, SPA respeita status, pages canonical, preview stateless (não publica).
> **Deploy beta feito** (autorizado). T16/E2E autenticado = validação do mantenedor no ar.
> **Checkpoint pós-deploy:** o admin está funcional como MVP técnico, mas ainda não é paridade WordPress. Bloqueadores para uso editorial real: operações editoriais básicas (arquivar/lixeira/restaurar/apagar), honestidade de publicação (slug/status/noindex/sitemap/OG), mídia/upload, lista editorial completa, agendamento/autosave/revisões, roles editoriais, dashboard/build status, curadoria da home, redirects UI e auditoria. Ver `spec.md` "Checkpoint pós-Fase 1" e `plan.md` "Plano de implementação do delta".

## Fase 2 — Operações editoriais básicas + mídia & taxonomias [P0/P1]

> Prioridade: **operações editoriais básicas + publicação honesta primeiro**. Antes de biblioteca de mídia, o admin precisa administrar o ciclo de vida do conteúdo como o WordPress e não pode expor slug/status/SEO como se estivessem completos quando ainda têm semântica parcial.

- [x] **T17 — Operações editoriais básicas + publicação honesta (R3a/R4/R4a/R4b/R4c/R9/R27/R28/CA2b/CA2c).** Implementado, deployado no beta (`11f1736`) + refino de UX (editor light + SEO/OG Yoast-like, `12ce2ab`); **E2E autenticado validado pelo mantenedor (2026-06-08).** Codex aprovou o diff.
  - [x] Backend posts/pages: lifecycle via `POST /:id/status` (publish/draft=despublicar/archived/trash/restore) com `prev`-status correto no gatilho de rebuild; **fix `published_at` carimbado ao publicar** (`setPostStatus`/`setPageStatus`).
  - [x] Semântica de delete: `DELETE /posts/:id` e `DELETE /pages/:id` (novos) **só a partir de `trash`** (409 `must_trash_first` caso contrário) + confirmação `window.confirm` no front; `deletePost` limpa `post_taxonomies` na mesma statement; `deletePage`.
  - [x] Export/SSG: export já filtra `status='publish'` (trash/archived/draft fora de posts, sitemap via páginas buildadas, RSS, listas); status que entra/sai de `publish` dispara rebuild coalesced (`maybeRebuild(new, prev)`).
  - [x] Integridade: delete remove vínculos de taxonomia; **NÃO** remove `redirects` históricos (R4c) — validado no harness; RSS endurecido p/ ignorar item com data inválida (não quebra build).
  - [x] UI lista/editor: ações por item em PostsList/PagesList (Editar, Ver↗, Publicar, Despublicar, Arquivar, Lixeira, Restaurar, Apagar) + toast de feedback.
  - [x] Filtros por status (dropdown) incl. ver `trash`/`archived` e restaurar.
  - [x] Slug UX: disponibilidade ao vivo (debounce `slug-check`), URL final, aviso explícito de 301 ao mudar slug publicado (PostEditor + PageEditor).
  - [x] Status UX: `scheduled`/`private` desabilitados no select + aviso de indisponibilidade (sem job/regra reais ainda).
  - [x] SEO/OG: UI expõe `og_title`/`og_description`/`twitter_card` (+fallbacks visíveis); `noindex` com aviso honesto (meta tag; remoção de sitemap/RSS ocorre ao sair de `publish`).
  - [x] Testes/smoke: harness `scripts/t17-validate.ts` (repo + filtro de export, 15 checks ✓) + smoke HTTP (401 sem token, 403 user, 409 must_trash_first, 200 delete-from-trash, 404 pós-delete). Ciclo draft→publish→archive→restore→trash→delete ✓.
  - **Feito quando:** CA2b/CA2c passam no beta (mantenedor) e o admin administra lifecycle básico sem tocar banco/API manualmente. *(local ✓; beta autenticado pendente.)*

- [ ] **T18 — Biblioteca de mídia / schema + API (R18/R19).**
  - [ ] Migration online-safe para mídia nativa: suportar `source` (`wp|cloudinary|local`), `url`, `cloudinary_public_id`, `mime`, `size_bytes`, `width`, `height`, `alt`, `caption`, `title`, `created_by`, `created_at`, `updated_at`; preservar compatibilidade com `media`/`media_map` importados.
  - [ ] API `GET /api/admin/v1/media` com busca, paginação e filtro por tipo.
  - [ ] API `POST /api/admin/v1/media` multipart com validação backend de MIME, extensão e tamanho; rejeitar SVG sem sanitização.
  - [ ] API `PUT /api/admin/v1/media/:id` para alt/legenda/título; `DELETE` só se não quebrar referências ou com regra clara.
  - [ ] Cloudinary gated: com `CLOUDINARY_URL`, upload real e persistência de public id/secure url; sem credencial, modo dev/local/dry-run documentado.
  - [ ] Testes: tipo inválido, arquivo grande, sem auth, sem admin, upload válido, update metadata.
  - **Feito quando:** CA3 passa: upload de imagem com alt aparece no corpo e no `og:image`; público serve URL correta após rebuild.

- [ ] **T19 — UI de mídia + inserção no editor (R11/R13/R15/R20).**
  - [ ] Nova rota `Mídia` no `apps/site-admin` com grid/lista, busca, preview, metadados e botão upload.
  - [ ] Modal/seletor de mídia reutilizável para imagem destacada, OG image e blocos do editor.
  - [ ] Integrar BlockNote: inserir imagem a partir da biblioteca ou upload na hora; preservar alt/legenda no HTML sanitizado.
  - [ ] Embeds por URL com allowlist de provedores; nada de `<script>` arbitrário. Áudio/vídeo começam por URL/Cloudinary antes de processamento local.
  - [ ] Dependências prováveis: `multer` ou `busboy` para multipart, `file-type` para validação. Evitar instalar `ffmpeg`/ImageMagick/Sharp na VM até necessidade concreta.
  - **Feito quando:** editor cria post com imagem inline + featured + OG usando mídia cadastrada, preview e publicação funcionam.

- [ ] **T20 — CRUD taxonomias completo (R22/R24).**
  - [ ] Tela `Categorias/Tags` com criar/editar nome, slug, descrição e parent de categoria.
  - [ ] Validação de slug único por kind, prevenção de ciclo em categoria parent.
  - [ ] Tratamento de exclusão: bloquear se em uso, reatribuir, ou remover associação com aviso explícito.
  - [ ] Recalcular/atualizar `count` após edição/publicação/rebuild.
  - [ ] Filtros de posts por categoria/tag usam estes dados.
  - **Feito quando:** CA4 passa; páginas de arquivo refletem alterações após rebuild.

## Fase 3 — Portal/Hub: dashboard + curadoria + navegação + redirects [P1]
- [ ] **T21 — Migration/config do hub.** Migration `site_settings`/`curation`/`nav_items`/`audit_log` (online-safe, D039) + export emite `home.json`/`nav.json`. · feito quando: migrate roda pglite+PG; export gera JSON estável.
- [ ] **T22 — Dashboard mínimo (R44).**
  - [ ] API `/api/admin/v1/dashboard`: contagens por status, mídia, taxonomias, último job, erro de build, atividade recente.
  - [ ] UI inicial do admin troca a lista direta de posts por dashboard com ações rápidas: novo post, upload mídia, rebuild, ver site.
  - [ ] Histórico de job persistente ou ao menos log consultável pós-restart; memória pura é insuficiente para operação.
- [ ] **T23 — Curadoria da home (R45).** Hero/destaque, posts fixados (sticky), ordem das seções, blocos editoriais (banner/CTA/destaque de módulo); `index.astro` lê curadoria em vez de escolher sempre o post mais recente. · feito quando: home reflete hero+sticky+ordem após rebuild (parte de CA9).
- [ ] **T24 — Navegação editável (R46).** Nav secundário do blog + links do footer hub (ordenáveis). · feito quando: muda no admin → reflete no SSG; nav cross-módulo do `@artificio/ui` **intacto**.
- [ ] **T25 — Redirects 301 UI (R47).** CRUD da tabela `redirects` (inclui os gerados por mudança de slug), busca, validação `from!=to`, code {301,302,307,308}, teste visual do destino. · feito quando: redirect criado responde no público (parte de CA9).

## Fase 4 — Workflow & usuários [P1]
- [ ] **T26 — Lista editorial completa (R9/R41).**
  - [ ] API posts/pages retorna total count e aceita `q`, `status`, `category`, `tag`, `author`, `limit`, `offset`, `sort`, `direction`.
  - [ ] UI com filtros por status/categoria/autor, paginação, ordenação, seleção múltipla.
  - [ ] Bulk actions: publicar, rascunho, arquivar, lixeira, recategorizar.
  - [ ] Quick edit: título, slug, status, data.
  - **Feito quando:** filtros funcionam server-side e a lista serve para administrar acervo importado + nativo.
- [ ] **T27 — Agendamento real (R6).** `scheduled` + job periódico publica posts com `published_at <= now()` e dispara rebuild. Começar com timer no backend; cron/systemd/VM somente se necessário e aprovado. · feito quando: post agendado entra no ar na data.
- [ ] **T28 — Autosave + revisões + restaurar (R7).**
  - [ ] Tabelas `post_revisions`/`page_revisions` com snapshot de título, `block_doc`, `content_html`, status, usuário e timestamp.
  - [ ] Autosave com debounce e estado visual salvando/salvo/erro.
  - [ ] UI para listar revisões e restaurar.
  - **Feito quando:** histórico navegável e restauração funciona sem publicar acidentalmente.
- [ ] **T29 — Gestão de usuários editores/roles (R30–R34).**
  - [ ] `site_users` com `editorial_role`; SSO/login continua em `accounts.`.
  - [ ] `requireCapability(cap)` no `apps/site`, sem alterar `@artificio/auth`.
  - [ ] UI para listar usuários conhecidos, atribuir/revogar papel editorial.
  - [ ] Testes: Contribuidor não publica; Autor não edita post de outro; Editor edita todos.
- [ ] **T30 — Log de auditoria (R48).** Middleware grava ação/usuário/alvo/timestamp em toda mutação; dashboard mostra. · feito quando: criar/editar/publicar/apagar/arquivar/restaurar aparecem no log.

## Fase 5 — Páginas, snippets, refinos [P1/P2]
- [ ] **T31** — **CRUD de pages** com o mesmo editor + slug/301 (R25). *(Já existe MVP; refino aqui = lista/filtros/preview/roles/revisões com paridade dos posts.)*
- [ ] **T32** — **Snippets/blocos reutilizáveis** (R14) + bloco HTML cru (capacidade elevada) + download/arquivo (R16).
- [ ] **T33** — **Moderação de comentários** importados (R35) + ligar/desligar por post.
- [ ] **T34** — **Settings** do site (R42) + **métricas GA4 no dashboard (R49)** + assist de legibilidade/SEO (R29).
- [ ] **T35** — 🔒 Mantenedor: autorizar deploy beta de cada fase; smoke + validação Opus; rumo ao **Gate D do site**.

## Dependências / ordem
- T2–T4 (spikes) **antes** de T7+. T5/T6 antes da API. Fase 1 inteira antes da 2. Deploy de cada fase só com autorização.
- Fase 3 (curadoria) depende do MVP de posts (Fase 1) p/ ter o que curar.
- Toque em `packages/auth`/`packages/ui` = SDD Completo: testar mesas/accounts antes de mergear.
