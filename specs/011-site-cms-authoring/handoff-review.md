# Handoff de revisão — spec 011 (área administrativa do site)

> Inventário da entrega para revisão de código. Estado: **local, não commitado, não deployado.**
> Branch base: `dev` = `origin/dev` = `7f2fbd1` (spec 010 fechada).

## Escopo entregue
Fase 0 (spikes/decisões) + Fase 1 (MVP de autoria de **posts e páginas**) da spec 011.
Backend de autoria + SPA admin (`/admin`) com editor de blocos + emissão de SEO/OG no público.
Fora desta entrega: mídia/upload (Fase 2), dashboard, curadoria portal/hub, roles granulares, agendamento/revisões.

## Decisões (em `.specify/memory/decisions.md`)
- **D051** editor = BlockNote (persistir `block_doc` JSON + `content_html` sanitizado).
- **D052** roles/capabilities no `apps/site` (`site_users` adiado); gate atual = `requireAdmin` (role SSO `admin`). `packages/auth` intocado.
- **D053** rebuild SSG **atômico** (build→`dist.next`→swap) p/ zero downtime; preview render no Express (sem adapter Astro).
- **D054** admin = pacote próprio `apps/site-admin` no toolchain latest (vite 8 + plugin-react 6 + react 19.2 + router 7 + blocknote 0.51).

## Arquivos novos
- `apps/site-admin/**` — SPA React (vite): `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`,
  `src/{main.tsx,App.tsx,api.ts,styles.css}`, `src/editor/BlockEditor.tsx`,
  `src/pages/{PostsList,PostEditor,PagesList,PageEditor}.tsx`.
- `apps/site/db/migrations/003_authoring.sql` — colunas de autoria + sequence de ids nativos.
- `apps/site/db/repo/{posts,pages,taxonomies,redirects}.ts` — camada de dados (SQL parametrizado sobre adapter dual pglite/pg).
- `apps/site/server/admin-api.ts` — API `/api/admin/v1/*`.
- `apps/site/server/preview.ts` — preview de rascunho.
- `apps/site/server/lib/content.ts` — slugify PT, slug único, excerpt (reusa sanitize/toc do importador).
- `apps/site/scripts/rebuild.mjs` — rebuild atômico.
- `specs/011-site-cms-authoring/**`, `sessoes/26-06-06_1_site_cms-authoring.md`.

## Arquivos modificados
- `apps/site/server/server.ts` — monta `adminApi`, rota de preview, serve a SPA admin em `/admin`.
- `apps/site/package.json` — script `rebuild` → `node scripts/rebuild.mjs`.
- `apps/site/Dockerfile` — COPY `apps/site-admin` + turbo build do `@artificio/site-admin`.
- `apps/site/db/export.ts` — exporta campos SEO/OG (posts e pages).
- `apps/site/src/lib/content.ts` — interface `SeoMeta`; `Post`/`Page` usam.
- `apps/site/src/layouts/Base.astro` — props `ogTitle`/`ogDescription`/`twitterCard`/`noindex`.
- `apps/site/src/pages/blog/[slug].astro`, `apps/site/src/pages/[slug].astro` — repassam SEO/OG.
- `packages/content/src/{types.ts,meta.ts}` — `buildMeta` aditivo (ogTitle/ogDescription/twitterCard/noindex).
- `.github/workflows/deploy-site.yml` — paths incluem `apps/site-admin/**`.
- Docs: `decisions.md`, `project-state.md`, `roadmap.md`, `sessoes/index.md`, `specs/010-ui-nav-logo/tasks.md`.

## Contratos relevantes
- Auth: `@artificio/auth` `requireAuth` + cookie `artificio_session`. Toda rota de escrita do admin passa por `requireAuth`+`requireAdmin`.
- Sanitização: corpo salvo passa por `sanitize` + `withToc` (allowlist negativa em `importer/sanitize.ts`).
- Slug: post publicado que muda de slug gera 301 em `redirects` (`/blog/<old>/`→`/blog/<new>/`; pages `/<old>/`→`/<new>/`).
- Ids nativos: sequence `site_content_id_seq` (≥1.000.000) p/ não colidir com ids do WP no import idempotente.
- SSG: público continua estático; admin é SPA isolada; publicar dispara `runJob("rebuild")` (atômico).

## Verificado localmente
- `tsc --noEmit` limpo (server/db do site; SPA admin).
- `pnpm --filter @artificio/site-admin build` (vite 8) verde.
- `pnpm --filter @artificio/content build` + testes 6/6.
- `pnpm --filter @artificio/site rebuild` verde (125 posts; OG no HTML buildado; swap atômico limpa temporários).
- Smoke do server: `/admin/` 200 (SPA), rotas client-side 200 (fallback), `/api/admin/v1/*` + `/admin/status` + `/admin/preview/*` = **401 sem sessão**.
- Smoke de repo via tsx: create/get/list/slug/taxonomia/cleanup.

## NÃO verificado (limitação local)
- Fluxo **autenticado** UI↔API (requer cookie SSO real) — só validável no deploy.
- Fidelidade do HTML do BlockNote em conteúdo real (posts importados do WP convertidos via `tryParseHTMLToBlocks`).
- Comportamento do swap atômico sob carga/concorrência real.

## Como rodar local
- `pnpm --filter @artificio/site migrate` (aplica 003 em pglite).
- Backend: em `apps/site`, `pnpm run serve` (porta 4322).
- SPA dev: em `apps/site-admin`, `pnpm dev` (porta 4330, proxy `/api` e `/admin/preview` → 4322).
- Build admin: `pnpm --filter @artificio/site-admin build`.

## Revisão Codex (2026-06-06) — 8 achados, todos corrigidos
1. **[alto] XSS — sanitizador regex insuficiente.** → `apps/site/server/lib/sanitize-html.ts` (sanitize-html, allowlist; sem script/handlers/`javascript:`/`data:` href; rel seguro em target=_blank). Usado no caminho de escrita (`admin-api` buildPost/buildPage). Verificado: tira onmouseover/js:/data-img/iframe/script.
2. **[alto] 301 não aplicados no público.** → middleware em `server.ts` lê a tabela `redirects` (cache em memória, refresh 30s) ANTES do estático. Verificado: `/blog/old/`→301→novo; rota normal 200.
3. **[alto] swap não atômico.** → `scripts/rebuild.mjs` reescrito: 2 dirs (`dist.a`/`dist.b`) + `dist` = symlink, retarget por rename (atômico POSIX); fallback rename-com-restore (Windows) que nunca deixa o site sem `dist`.
4. **[alto] publish em 2 requisições.** → servidor dispara `rebuild` (single-flight) quando o status afeta o público (`maybeRebuild` em `admin-api`); SPA não chama mais `rebuild` separado (resposta traz `rebuild`).
5. **[médio] id de rota sem validação.** → `parseId` (inteiro>0) → 400; rotas de status retornam 404 quando nenhuma linha muda (`setPostStatus`/`setPageStatus` agora `RETURNING id`).
6. **[médio] taxonomias não-transacional.** → `setPostTaxonomies` pré-filtra ids de termos existentes (sem FK inválido) + delete seguido de 1 insert (janela mínima; transação plena = follow-up, exige client dedicado no adapter).
7. **[médio] SPA salvava só draft/publish.** → botão "Salvar" usa o status selecionado; "Publicar" força publish. Posts e pages.
8. **[baixo] pages sem canonical editorial.** → coluna `pages.canonical` (migration 003) + repo/API/SPA/export/template `[slug].astro`.
- Sem achados (confirmados pela revisão): auth/authz das rotas de escrita, injeção SQL, idempotência da migration 003.
- **Follow-up anotado:** transação plena nas taxonomias (precisa de checkout de client no adapter dual pglite/pg).

## Revisão Codex — 2ª rodada (2026-06-06), 5 achados, todos corrigidos
1. **[alto] "Pré-visualizar" publicava** (preview persistia com status atual → se publish, rebuildava). → **preview STATELESS**: rota `POST /api/admin/v1/preview` renderiza o buffer atual (sanitizado) sem tocar no store; SPA abre via blob. Nada é persistido/publicado. Verificado.
2. **[alto] rebuild concorrente perdido** (`runJob` busy não enfileirava). → `jobs.ts` agora coalesce: pedido de rebuild durante job em curso marca trailing run (roda 1 rebuild ao final). Garante que a última publicação entra no SSG.
3. **[médio] redirect novo só valia após 30s.** → cache movido p/ `server/redirect-cache.ts`; `admin-api` chama `reloadRedirects()` na hora após gravar (slug change + redirect manual). Verificado (lookup imediato).
4. **[baixo] code de redirect não limitado.** → rota `/redirects` aceita só {301,302,307,308} (senão 301) + rejeita from==to.
5. **[baixo] GET preview/:id sem validação.** → valida inteiro>0 → 400.
- Sem achados remanescentes (confirmado): sanitização, SQL injection, authz das rotas.

## Observações
- `midias/Intel-Driver-and-Support-Assistant-Installer.exe` apareceu como untracked — **não faz parte desta entrega**, não commitar.
- `pnpm-lock.yaml` mudou (deps do admin + `sanitize-html`/`@types/sanitize-html`; deps SPA removidas do `apps/site`).
