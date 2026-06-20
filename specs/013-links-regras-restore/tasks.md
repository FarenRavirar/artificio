# 013 — Tasks (`apps/links` diretório comunitário)

> Fonte = `spec.md`; estratégia = `plan.md`. Legenda: `[x]` feito · `[~]` feito mas será refeito/substituído · `[ ]` pendente · 🟦 decisão/aprovação mantenedor.
> Governança: nada commita/deploya sem autorização nominal por ação ([[no-auto-commit]], [[pr-obrigatorio]]). `packages/ui` é shared → smoke de todos consumidores.
> **Supera o tasks anterior** (linktree estático). Escopo virou app completo.

---

## ⚠️ RETOMADA 2026-06-20 (agente opencode, continuação F0–F3 → TC5 + limpezas)

**TC5 (fallback SSR + rebuild) CODADO LOCAL, VALIDAÇÃO EM CURSO:**
- [x] TC5a — `server/lib/render.ts` novo: `renderGroupPage(g: Group): string` — HTML inline mínimo (SEO completo: title/desc/canonical/OG/JSON-LD + estilo). Espelha estrutura do `pages/grupo/[slug].astro`.
- [x] TC5b — `server/jobs.ts` novo: single-flight job runner (`runJob`/`jobState`/`jobBusy`), espelhando `apps/site/server/jobs.ts`. Rebuild coalescing (trailing run).
- [x] TC5c — `server/server.ts`: rota `GET /grupo/:slug` (SSR fallback **antes** do `express.static`, verifica `existsSync` no dist; se existe → `next()` p/ static; senão → renderGroupPage). Endpoint admin `POST /api/admin/v1/rebuild` + `GET /api/admin/v1/rebuild/status`. Dispara `runJob("rebuild","rebuild")` após accept (fire-and-forget).
- [x] TC5d — `package.json`: script `"rebuild": "astro build"`. `docker-entrypoint.sh` novo: migrate → seed (idempotente) → astro build → serve. Resiliência: se `dist/index.html` existe, serve direto (restart sem rebuild).
- [ ] TC5 — **validação E2E pendente** (servidor sobe, rota SSR é atingida; DB do container não acessível via `npx tsx` direto no contexto de `cmd.exe` — não é bug de código, é ambiente). Testar com `docker run` + `pnpm serve` normal.

**F5 deploy CODADO LOCAL:**
- [x] T5a — `Dockerfile` substituído: modelo Express+DB (espelha `apps/site`). Build do Astro no entrypoint (depende de DB). `docker-compose.prod.yml` substituído: `links-app`+`links-db` + volume `pgdata_links_prod`. `nginx.conf` removido (obsoleto).
- [x] T5b — 5ª entrada `links` em `deploy-manifest.json` (PROD-only, dispatch-only, `critical_routes` definidas). JSON validado.
- [x] T5c — `"links"` adicionado ao enum `inputs.module.options` do `workflow_dispatch` em `deploy.yml`.
- [x] F5 — `MIGRATIONS_DIR` confirmado: `_deploy-module.yml` chama `apply_required_migrations.sh` com `"database"` relativo ao dir do app → `apps/links/database/` ✓.

**Limpezas executadas:**
- [x] T1c — 13 JPGs em `src/assets/groups/` + `scripts/fetch-logos.mjs` + script `"logos"` do package.json removidos.
- [x] T2g.1 — `public/robots.txt` criado (Allow /, Disallow /admin/, Sitemap).
- [x] T2g.2 — `public/og-default.png` criado (cópia de `midias/cropped-Artificio-RPG-Borda-e1738186337569.png`).

**Decisões de implementação:**
- SSR fallback posicionado **antes** do `express.static` (não depois) porque `express.static` com `extensions:["html"]` em Express 5 não estava chamando `next()` de forma confiável para rotas de slug deletadas do dist.
- Rebuild = `astro build` simples (sem swap atômico de dist; o Express continua servindo dist antigo durante o build). Swap atômico pode ser adicionado depois se necessário.
- `docker-entrypoint.sh` espelha `apps/site/docker-entrypoint.sh`: migrate → seed (best-effort idempotente) → astro build → serve. LINKS_FORCE_REBUILD=true p/ forçar rebuild.

---

## Estado atual (atualizado 2026-06-20)

**App completo F0–F5+TC5+UX+limpezas codado e validado localmente. Build 15 páginas verde. NADA COMMITADO** (regras [[no-auto-commit]]/[[pr-obrigatorio]]). 🟦 Pendente só ação do mantenedor: deploy (tunnel `links.` + `.env` VM + dispatch).

### Resumo do que existe em `apps/links/` (verificado no disco)
- **Backend (✅ validado E2E com Postgres real):** `db/{types,index,migrate,seed}.ts`, `database/migration_001_init_groups.sql`, `server/server.ts`, `server/repo/groups.ts`, `server/lib/{cloudinary,og,validate,slug,render}.ts`, `server/jobs.ts`.
- **Frontend (✅ build 15 páginas verde):** `src/layouts/Base.astro`, `src/components/{PortalHeader,GroupCard}.astro`, `src/components/{CommunityGroups,SuggestForm}.tsx`, `src/components/admin/AdminPanel.tsx`, `src/pages/{index.astro,grupo/[slug].astro,admin/index.astro}`, `src/lib/groups-source.ts`, `src/styles/global.css`, `public/{placeholder.svg,robots.txt,og-default.png}`.
- **Dados (seed):** `src/data/{groups,regras}.ts` (permanecem).
- **Deploy:** `Dockerfile` (Express+DB multi-stage), `docker-compose.prod.yml` (links-app+links-db), `docker-entrypoint.sh`.
- **Infra:** `.github/deploy-manifest.json` + entrada `links`, `.github/workflows/deploy.yml` + enum `"links"`.
- **Limpo:** `nginx.conf`, `scripts/fetch-logos.mjs`, 13 JPGs removidos.
- **Shared:** `packages/ui/src/modules.ts` += "WhatsApps" (T4a ✅).

### Como rodar local (validação)
1. `docker run -d --name links-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=links -p 55432:5432 postgres:16`
2. `export DATABASE_URL=postgresql://postgres:dev@localhost:55432/links`
3. `pnpm --filter @artificio/links migrate && pnpm --filter @artificio/links seed`
4. `JWT_SECRET=x PORT=4324 pnpm --filter @artificio/links serve` (API) — front: `pnpm --filter @artificio/links build`.
> Docker bin no PATH do usuário (Windows): `C:\Program Files\Docker\Docker\resources\bin`. Cloudinary off local → logos nulas (placeholder).

### Decisões registradas
`spec.md#decisões` (D-LNK-1..14), `plan.md` (decisões SEO-render/prod-only/painel-in-app fechadas), `decisions.md` (D085), `review-ux-design.md`.

---

## ⚠️ DECISÃO DE STACK (2026-06-20, sessão 2 retomada) — espelhar MESAS, não SITE
O mantenedor decidiu espelhar **`apps/mesas`** (atualizado na spec 033), não `apps/site`. Stack do backend:
**Kysely ^0.29.2 + pg ^8.20 + cloudinary ^2.9 + express ^5.2.1 + express-rate-limit ^8.5.2 + zod ^4.4.3 + sanitize-html ^2.17 + @artificio/auth.**
- DB: Kysely `db/index.ts` (singleton lazy via Proxy, padrão mesas) + `db/types.ts` (interface `Database`). **Pg-only** (sem pglite/raw-SQL do site) → migrate/seed local exigem `DATABASE_URL`.
- Migrations: framework de deploy D039 (`database/migration_*.sql` com header `@class/@requires-backup/@author/@created/@description`; `schema_migrations(migration_name)`; online-safe = sem DROP/DELETE). `MIGRATIONS_DIR=./apps/links/database` no deploy. Runner local `db/migrate.ts` (paridade).

## ⚠️ NOVOS REQUISITOS (2026-06-20) — TODOS registrados no schema (migration_001)
- **Tags múltiplas:** grupo tem **até 3 tags** (`groups.tags TEXT[]`, CHECK ≤3). Tags = slugs referenciando vocabulário.
- **Vocabulário de tags gerido pelo admin:** tabela `group_tags(slug UNIQUE imutável, label, sort_order)` + CRUD admin (`/api/admin/v1/tags/*`). Ex.: "Mestres", "Jogadores", "DnD", "Cenários". Remover tag → `array_remove` em todos os grupos.
- **Flag +18:** `groups.is_adult BOOLEAN DEFAULT false`, editável pelo admin.
- **SEO + Google Search Console:** cada grupo ativo é publicado em **`/grupo/<slug>`** (col. `groups.slug`, UNIQUE). Sitemap + meta/canonical/OG/JSON-LD + verificação GSC (`PUBLIC_GSC_VERIFICATION`) + robots.txt. Ref. do mantenedor: `gruposwhats.app/group/<id>`. Ver plan §SEO.
- **Regras do grupo:** `groups.rules TEXT` (sanitizado) — regras próprias exibidas na página do card, **além** da descrição.
- **Datas no card:** exibir **enviado** (`created_at`) e **aprovado** (`groups.approved_at`, set no accept).

## F0 — Scaffolding app completo ✅ (código local; falta migrate/seed rodar c/ DB)
- [x] T0a — `package.json`: deps backend (mesas stack acima) + scripts `build/serve/migrate/seed`.
- [x] T0b — `db/types.ts` (Kysely Database: `groups` + `group_tags`), `db/index.ts` (singleton Proxy), `db/migrate.ts` (runner local), `database/migration_001_init_groups.sql` (groups + group_tags + tags[]≤3 + is_adult).
- [x] T0c — `server/lib/cloudinary.ts` — `uploadLogoFromUrl` (fetch→upload_stream, public_id=sha256) + `deleteLogo`. **Cópia do padrão mesas → débito `BL-CLOUDINARY-SHARED` aberto.**
- [x] T0d — `server/lib/og.ts` — `parseInviteUrl` (host allowlist chat.whatsapp.com/whatsapp.com/channel) + `fetchOgImage`.
- [x] T0e — `server/repo/groups.ts` — Kysely: list/findById/**findBySlug**/**ensureUniqueSlug**/insertSuggestion(ON CONFLICT)/updateGroup/deleteGroup + listTags/sanitizeTagSlugs/createTag/updateTag/deleteTag.
- [x] T0f — `server/server.ts` — Express: `/healthz`, `GET /api/groups`, **`GET /api/groups/:slug`** (card publicado), `POST /api/groups/suggest` (requireAuth+rate-limit+sanitize), `/api/admin/v1/groups/*` (accept gera **slug**+**approved_at**+logo; patch: tags/rules/is_adult/slug/categoria) + `/api/admin/v1/tags/*` (requireAuth+requireAdmin), serve Astro `dist`. + `server/lib/validate.ts` (zod+sanitize-html).
- [x] T0g — Schema completo em `migration_001`: `groups`(+ slug, tags[]≤3, rules, is_adult, approved_at) + `group_tags`. typecheck `tsc --noEmit` **verde**.

## F1 — Seed curado + Cloudinary (código ✅; falta rodar c/ DB)
- [x] T1a — `db/seed.ts`: vocabulário de tags (deriva dos `tag` dos curados) → `group_tags`; `data/groups.ts` → `groups` (`source=curated status=active`, `tags=[slug]`); og→Cloudinary best-effort; idempotente por `invite_url`.
- [x] T1b — **migrate+seed validados** (2026-06-20, postgres:16 via Docker efêmero). `migrate` aplicou `migration_001` limpa; `seed` → **13 grupos active/curated + 10 tags**. Smoke API: `/healthz` 200 `{groups:13}`, `GET /api/groups` 200, `GET /api/groups/<slug>` 200, slug inexistente 404, `/api/admin/v1/{groups,tags}` **401**. Logos=off (Cloudinary não configurado local).
- [ ] T1c — D-LNK-4: remover os 13 JPGs em `src/assets/groups/` (untracked, do scaffold estático; não usados) + aposentar `scripts/fetch-logos.mjs` (og→Cloudinary cobre). **Nunca foram commitados.**

## ⚠️ CORREÇÕES PRÉ-DEPLOY (achados da 2ª revisão — `review-ux-design.md` §5)
- [x] TC1 — **[BUG] CSP** corrigido: `img-src 'self' data: https://res.cloudinary.com` em `astro.config.mjs`.
- [x] TC2 — **[BUG] slugify** corrigido: util único `server/lib/slug.ts` (RegExp de escapes `̀-ͯ`); server+seed importam, duplicatas removidas.
- [x] TC3 — **[BUG] corrida** corrigido: `insertSuggestion` usa `onConflict('invite_url').doNothing()` + fallback select.
- [x] TC4 — **[BUG] pgcrypto** validado: `CREATE EXTENSION pgcrypto` + `gen_random_uuid()` aplicaram limpo em postgres:16 (T1b). Garantir extensão também no `links-db` de prod (compose).
- [ ] TC5 — **[RISCO]** fallback SSR `/api/groups/:slug` p/ grupo aprovado antes do rebuild (senão 404). Implementar no F2.
- [x] TC6 — **[RISCO]** og:image OK: probe 3/3 convites retornaram `og:image` ao GET simples (UA bot; ordem `property`→`content`). Risco baixo; manter placeholder + "rebuscar logo" no painel como rede de segurança.

## F2 — Frontend (backbone ✅ — build 14 páginas verde, sem DB usa curados)
> Tema: links usa o **toggle canônico dark/light** (igual aos outros módulos) — `<html data-theme>` + cookie cross-subdomínio `artificio_theme` + `ThemeToggle` no Header (`showThemeToggle`). Boot script `is:inline` anti-flash no `<head>` (CSP auto-hasheia). Default light; vars dark sob `[data-theme="dark"]`. CSP cobre script/style/img (Cloudinary).
- [x] T2a — Sidebar (Grupos/Regras/Projetos) com `<details>` + âncoras por categoria (lê `getCategories`).
- [x] T2b — **Header SSO** como **ilha React** (`@astrojs/react` add; `PortalHeader.astro` client:load; login + userMenu "Painel admin" adminOnly). 1º app Astro do monorepo com island React.
- [x] T2c — `GroupCard.astro`: chips de tag (≤3) + badge **+18** + lazy/alt (UX-7); linka p/ `/grupo/<slug>`.
- [x] T2f — `pages/grupo/[slug].astro` (SSG via `getStaticPaths`): logo + descrição + **regras** + datas enviado/aprovado + CTA convite + **breadcrumb** (UX-5).
- [x] T2g — **SEO (parcial)**: `Base.astro` com canonical/OG/Twitter + meta `robots`(noindex só onde pedido) + **GSC** (`PUBLIC_GSC_VERIFICATION`) + **JSON-LD** (ItemList home, Organization página); `@astrojs/sitemap` cobre `/grupo/<slug>` (exclui `/admin`).
  - [ ] T2g.1 — **FALTA `public/robots.txt`** (com `Sitemap:` apontando o sitemap). Não existe ainda.
  - [ ] T2g.2 — **FALTA `public/og-default.png`** — `Base.astro` referencia `/og-default.png` como og:image default; hoje 404 nas páginas sem logo.
- [x] T2h — `src/lib/groups-source.ts`: SSG lê **DB se `DATABASE_URL`**, senão fallback curados (`data/groups.ts`). Slug via util único.
- [x] T2d — `CommunityGroups.tsx` (island `client:visible`): `GET /api/groups?source=community&status=active`; reusa `LoadingState`/`EmptyState`/`ErrorState` do `@artificio/ui` (UX-3 ✓).
- [x] T2e — `SuggestForm.tsx` (island, só logado): `useSession`/`authFetch`/`redirectToLogin` (`@artificio/auth`) + `Field`/`TextInput`/`Textarea`/`Button`/`Panel`/`SuccessState` (`@artificio/ui`); validação client-side do convite (UX-4) + tratamento 429. → `POST /api/groups/suggest`.
- [x] T2-E2E — **fluxo validado end-to-end** (Docker pg + server + JWT HS256 mintado): sugerir 201 → pending → admin vê email/nome → aceita 200 (slug+approved_at) → lista comunidade mostra. Seção "Grupos de RPG" + sidebar.
- [x] FollowUp — endpoint público `GET /api/tags` (labels). **Feito 2026-06-20:** `server.ts` += `GET /api/tags` público (retorna `{slug, label}[]` do `listTags()`). `CommunityGroups.tsx` fetch paralelo `/api/tags` + `/api/groups`, `Map<slug,label>` na renderização dos chips. Typecheck + build verdes.
- [x] T2-UX — **Feito 2026-06-20.** UX-1 gate +18: CSS blur/overlay + script `is:inline` no `Base.astro` (localStorage `artificio_adult_gate`) + `Modal` do `@artificio/ui` no `CommunityGroups.tsx`. UX-2 filtro por tag: chips viram `<button>` clicáveis, estado `selectedTag`, filtro client-side, barra "limpar filtro". UX-8 foco visível: `:focus-visible` com `var(--brand-deep)` em cards/chips/buttons/details (padrão `packages/ui/styles.css:837`). Typecheck + build 15 páginas verdes.
- [ ] TC5 — fallback SSR `/api/groups/:slug` p/ grupo aprovado pré-rebuild (Express serve shell que hidrata). **pendente** (senão grupo recém-aprovado dá 404 até o próximo build).

## F3 — Painel CRUD admin (D-LNK-14) — `/admin` gated em `apps/links` ✅
- [x] T3a — Endpoints admin (F0): listar (`?status=`) / aceitar (→active, slug+approved_at+og) / editar (nome/desc/regras/tags/+18/categoria/link/slug) / arquivar / excluir; tags CRUD. **Todos validados via curl c/ JWT admin.**
- [x] T3b — **Painel admin** (`pages/admin/index.astro` noindex + `AdminPanel.tsx` `client:only="react"`). Gate: ilha checa `useSession` (não-admin → ErrorState; gate real é server-side). Fila pendentes + lista; aceitar/editar(nome/desc/regras/tags≤3/+18/categoria/link/slug)/arquivar/excluir. Cada linha: **email+nome do remetente** + datas. Reusa `Panel/Badge/Button/Field/TextInput/Textarea/Select/Toolbar/State*`.
- [x] T3d — **Gerenciador de tags** (`TagManager`): criar / remover (sai dos grupos via array_remove). Slug imutável.
- [x] T3c — Rate-limit/validação/sanitize (F0) + `/admin` fora do sitemap. **E2E validado:** criar tag, PATCH (tags/+18/rules/slug), arquivar, remover tag→`tags:[]`, excluir — todos 200.

## F4 — Nav (✅ parcial)
- [x] T4a — `defaultNavItems` += "WhatsApps".
- [ ] T4b — Confirmar espelho `MODULES` (`apps/site/src/lib/content.ts` herda `defaultNavItems`) no build do site.
- [ ] T4c — Smoke nav consumidores (após deploy; sem link morto até `links.` no ar — spec 014 R5).

## F5 — Deploy (🟦 aprovação nominal)
- [ ] T5a — Substituir Dockerfile/nginx/compose estáticos pelo modelo Express+DB (**espelhar `apps/mesas`/`apps/site`**): `links-app`+`links-db`, volume `pgdata_links_prod`, entrypoint = migrate (+ seed 1ª vez) + serve. Dockerfile builda Astro `dist` + roda `server/server.ts`. Garantir `CREATE EXTENSION pgcrypto` no `links-db` (TC4).
- [ ] T5b — **Deploy é UNIFICADO (spec 026 F4): NÃO criar workflow novo.** Adicionar `links` como 5ª entrada em `.github/deploy-manifest.json` (a matrix do `deploy.yml` chama `_deploy-module.yml` por módulo) **E** adicionar `"links"` ao enum `inputs.module.options` do `workflow_dispatch` em `.github/workflows/deploy.yml` (senão não dá p/ dispatchar). PROD-only/dispatch-only (espelhar `accounts`/`site`). Modelo da entrada (ajustar nomes de container/rota):
  ```json
  {
    "module": "links",
    "_comment": "PROD-only 1o corte (D-LNK). dispatch-only ate estabilizar. MIGRATIONS_DIR=apps/links/database (framework D039).",
    "env_override": "prod",
    "compose_file": "docker-compose.prod.yml",
    "compose_file_beta": "docker-compose.prod.yml",
    "compose_project": "links", "compose_project_beta": "links",
    "db_service": "links-db", "db_service_beta": "links-db",
    "db_name": "links", "db_name_beta": "links", "db_user": "admin",
    "reconcile_same_project_orphans": false,
    "auto_deploy_on_push": false,
    "push_branches": ["main"],
    "deploy_paths": ["apps/links"],
    "health_containers": ["links-app"], "health_containers_beta": ["links-app"],
    "critical_routes": [
      {"name": "healthz", "url": "https://links.artificiorpg.com/healthz", "expected": "200"},
      {"name": "home", "url": "https://links.artificiorpg.com/", "expected": "200"},
      {"name": "api_groups", "url": "https://links.artificiorpg.com/api/groups", "expected": "200"},
      {"name": "admin_protected", "url": "https://links.artificiorpg.com/api/admin/v1/groups", "expected": "401"}
    ],
    "critical_routes_beta": []
  }
  ```
  Confere `_enforce-migration-dir.yml` (links tem `database/` com `migration_*.sql` → ok). Validar JSON.
- [ ] T5c — 🟦 (mantenedor) `.env` do links na VM (`JWT_SECRET`=accounts D042, `CLOUDINARY_*`, `DATABASE_URL`, `POSTGRES_PASSWORD`).
- [ ] T5d — 🟦 (mantenedor) rota Cloudflare Tunnel `links.`→`links-app` (token CF sem escopo tunnel).
- [ ] T5e — 🟦 Deploy `module=links mode=deploy`. Smoke: home 200, `/api/groups` 200, `/api/admin/v1/groups` 401, login SSO.
- [ ] T5f — Fechar D027; atualizar roadmap/backlog/project-state.

---

## Fechamento
- [ ] TF1 — `specs/backlog.md`: BL-LINKS-013/BL-NAV-LINKS-014 + eventual `BL-CLOUDINARY-SHARED`.
- [ ] TF2 — `project-state.md` + `sessoes/index.md`.
- [ ] TF3 — Nielsen/ISO na sessão; nenhum arquivo parcial entre PRs.
- [ ] TF4 — PRs por blast radius: (1) app links+db; (2) nav `packages/ui` (shared, smoke); (3) deploy manifest/compose.

---

## Bloqueios / decisões abertas (atualizado 2026-06-20)
1. 🟦 **Tunnel** `links.` — ação do mantenedor (token CF 403 em cfd_tunnel; DNS read OK).
2. 🟦 **`.env`/secrets** na VM — mantenedor (`JWT_SECRET`=accounts D042, `CLOUDINARY_*`, `DATABASE_URL`, `POSTGRES_PASSWORD`, `PUBLIC_LINKS_URL`, `PUBLIC_GSC_VERIFICATION`).
3. 🟦 **Deploy dispatch** — `module=links mode=deploy` + smoke.
4. ✅ **Beta/prod** — DECIDIDO **prod-only** no 1º corte (plan.md).
5. **Cloudinary helper:** já copiado → débito `BL-CLOUDINARY-SHARED` **aberto** (3 consumidores; promover a `packages/*`).

## Pendências restantes (pós-implementação)
1. 🟦 **Deploy** — ação mantenedor: tunnel `links.` + `.env` VM + deploy dispatch + smoke.
2. 🟦 **Smoke nav consumidores** — site/mesas/glossario/accounts com "WhatsApps" no ar (só após `links.` deployado).
3. **Fechamento:** TF1–TF4 (backlog/project-state/sessão; PRs por blast radius — app+db / nav shared / deploy).

> **Aviso:** nada commitado. `packages/ui/src/modules.ts` é **shared** — qualquer PR que o toque exige smoke de site/mesas/glossario/accounts. `packages/auth` é sagrado (não tocar).
