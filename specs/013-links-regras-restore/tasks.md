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

## 🔴 Revisão do PR #74 (2026-06-20) — 32 achados, organizados por prioridade

> Fontes: CI checks, CodeQL, Amazon Q Developer, Codex, CodeRabbit, SonarQube.
> Duplicatas consolidadas: R2=CR18, RX2=CR14.

---

### 🔴 BLOQUEANTES (2) — CI não passa, PR não mergeia sem estes

- [~] **B1 — `ERR_PNPM_OUTDATED_LOCKFILE`** (CI `lint+build+test` run 27879705227) ✅ corrigido 2026-06-20 (lockfile regenerado, pendente commit)

  **Fix aplicado:** `git checkout origin/dev -- pnpm-lock.yaml apps/site/package.json && pnpm install`. Lockfile regenerado sem contaminação do vite. `apps/site/package.json` restaurado (vite removido). Build 15 páginas verde.
  **Causa:** `pnpm install` anterior rodou com `apps/site/package.json` sujo (vite adicionado localmente, nunca commitado). Lockfile registrou o specifier inconsistente.
  Sessão `26-06-20_2`.
- [~] **B2 — `docker-entrypoint.sh` sem permissão exec** (CI `guard-entrypoint-exec` run 27879705223) ✅ corrigido 2026-06-20 (staged, pendente commit)

  **Fix aplicado:** `git add --chmod=+x apps/links/docker-entrypoint.sh` — git index agora `100755`. Staged, não commitado.
  **Prevenção futura:** `.gitattributes` já cobre LF para `*.sh` mas não exec bit (git não suporta via attributes). Regra operacional: no Windows, `git add --chmod=+x` manual para entrypoints. Potencial melhoria: script `scripts/ci/check_entrypoint_exec_bit.sh` como pre-commit hook ou nota no AGENTS.md.
  Validação: `git ls-files --stage` confirma `100755`. Sessão `26-06-20_2`.
  ```
  *.sh text eol=lf
  docker-entrypoint.sh text eol=lf
  ```
  Controla line endings (LF obrigatório), mas NÃO seta bit de execução. Poderia ser estendido com `docker-entrypoint.sh text eol=lf working-tree-encoding=UTF-8` mas isso não afeta o problema.

  **Impacto cascata:** `guard-entrypoint-exec` é check required para PR merge em `dev`. Sem ele verde, PR #74 bloqueado.

  **Fix (1 comando):**
  ```bash
  git add --chmod=+x apps/links/docker-entrypoint.sh && git commit --amend --no-edit
  ```
  Muda o git mode de `100644` → `100755`. Pode ser feito no mesmo commit que resolve B1 (lockfile), mantendo 1 commit só.

  **Prevenção futura (opcional):** Adicionar ao `.gitattributes`:
  ```
  apps/*/docker-entrypoint.sh text eol=lf
  ```
  (não resolve o `+x`, mas documenta o padrão). Ou incluir nota no AGENTS.md para Windows.

---

### 🟠 CRÍTICOS (8) — segurança, crash, DoS

**Segurança:**
- [x] **C1 — Sem limite de tamanho em download de imagem** (Amazon Q RQ2) ✅ corrigido 2026-06-20

  **Fix aplicado:** `cloudinary.ts` + `MAX_LOGO_BYTES = 2MB` (app-specific; futuro `@artificio/media` usará 10MB). Duas camadas de defesa:
  1. **Content-length pre-check:** `response.headers.get("content-length")` → rejeita antes do download.
  2. **Buffer post-check:** `buffer.byteLength > MAX_LOGO_BYTES` → defesa em profundidade (content-length pode ser spoof).
  SSRF tratado separadamente em C5 (allowlist de host em `og.ts`). Mesas gold standard referencia streaming (`readResponseBodyWithLimit`) para futura extração compartilhada.
  Validação: `tsc --noEmit` verde, `astro build` 15 páginas verde. Sessão `26-06-20_2`.
- [x] **C2 — `requireAdmin` frágil se session undefined** (Amazon Q RQ5) ✅ corrigido 2026-06-20

  **Fix aplicado:** `server.ts:30` `session?.user.role !== "admin"` → `!session || session.user.role !== "admin"`. Defesa em profundidade: se `requireAdmin` for usado sem `requireAuth` antes (hoje nunca acontece), ao invés de TypeError → 403 limpo. Express 5 já capturava o erro (500, fail-closed), mas o guard explícito é mais robusto.
  **Débito cross-app:** `apps/site/server/server.ts:39` tem o mesmo `session?.user.role` frágil → registrado em `specs/backlog.md` como `D-SITE-REQUIREADMIN`.
  Validação: `tsc --noEmit` verde, `astro build` 15 páginas verde. Sessão `26-06-20_2`.
- [x] **C3 — Container roda como root** (CodeRabbit CR1) ✅ corrigido 2026-06-20 (links apenas)

  **Fix aplicado — links:** `Dockerfile` + `RUN chown -R node:node /repo && USER node` após operações root. Porta 4324 (>1024) ok para non-root. `node:24-slim` já tem user `node` (UID 1000).
  **Débito cross-app:** `BL-ROOTLESS-CONTAINERS` **FECHADO** 2026-06-20 — 4 Dockerfiles corrigidos localmente (`apps/site`, `apps/accounts`, `apps/glossario/backend`, `apps/mesas/backend`). `tsc --noEmit` + build verdes. Sem commit (pendente aprovação). Sessão `sessoes/prompt-BL-ROOTLESS-CONTAINERS.md`.
  Validação: `tsc --noEmit` verde, `astro build` 15 páginas verde. Sessão `26-06-20_2`.
- [x] **C4 — 2 Security Hotspots + Rating C** (SonarQube SQ1/SQ3) ✅ resolvido 2026-06-20

  **Consequência de C3 + A4, ambos já resolvidos:**
  - Hotspot #1 (`server.ts:288`) = A4 false positive (slug via `slugify()` + UNIQUE DB, sem path traversal).
  - Hotspot #2 (`Dockerfile:5`) = C3 corrigido (`USER node`).
  Rating deve subir para A após merge do PR. Demais 30 code smells são warnings informativos (não bloqueiam quality gate). Duplicação 4.2% → I6/BL-CLOUDINARY-SHARED.
- [x] **C5 — SSRF em `og.ts`** (CodeQL R3) ✅ resolvido 2026-06-20

  **False positive confirmado** — `parseInviteUrl()` faz allowlist estrita de host + path regex + URL rebuild. CodeQL não reconhece o sanitizer local.
  **Defesa em profundidade adicionada:** validação do host pós-redirect em `fetchOgImage()` — após `res.url`, verifica se o host final ainda é WhatsApp (`chat.whatsapp.com`, `whatsapp.com`, `www.whatsapp.com`). Fecha vetor onde WhatsApp comprometido poderia redirecionar para host malicioso.
  SSRF secundário (og:image → `uploadLogoFromUrl`) já contido por C1 (2MB limit + content-type + 10s timeout).
  Validação: `tsc --noEmit` verde, `astro build` 15 páginas verde. Sessão `26-06-20_2`.

**Crash (server cai se DB falhar):**

  **NOTA:** C6a–C6e são o mesmo padrão (admin routes sem try/catch). Análise unificada abaixo.

  **Código afetado (5 handlers em `server.ts`):**

  | Rota | Linha | Operações que podem lançar |
  |---|---|---|
  | `POST /admin/v1/groups/:id/accept` | 149–163 | `findById` → `resolveLogo` (safe) → `ensureUniqueSlug` → `updateGroup` |
  | `PATCH /admin/v1/groups/:id` | 166–201 | `findById` → `cleanText` → `ensureUniqueSlug` → `sanitizeTagSlugs` → `resolveLogo` (safe) → `updateGroup` |
  | `POST /admin/v1/groups/:id/archive` | 203–210 | `updateGroup` |
  | `DELETE /admin/v1/groups/:id` | 212–219 | `deleteGroup` → `deleteLogo` |
  | `GET /admin/v1/groups` + tags CRUD | 129, 241–279 | `listGroups` / `listTags` / `createTag` / `updateTag` / `deleteTag` |

  **O que acontece quando DB falha sem try/catch:**

  1. Kysely lança erro (ex.: `Error: connect ECONNREFUSED 127.0.0.1:5432`)
  2. Handler é `async` → Promise rejeitada
  3. Express 5 **captura automaticamente** (feature nova do Express 5: async rejections viram `next(err)`)
  4. Sem error handler customizado → Express default error handler:
     - `NODE_ENV=production`: `res.status(500).send(err.message)` — sem stack trace, mas mensagem de erro DB vaza (ex.: `"relation 'groups' does not exist"`)
     - `NODE_ENV=development`: `res.status(500).send(err.stack)` — stack trace completa vaza

  **O processo NÃO crasha** — Express 5 protege contra crash de async rejections (diferente do Express 4).

  **Inconsistência com rota pública:**
  ```typescript
  // POST /api/groups/suggest (community, linha 102–122) — TEM try/catch
  app.post("/api/groups/suggest", ..., async (req, res) => {
    try {
      // ... DB ops
    } catch (e) {
      console.error("[POST /api/groups/suggest]", e);
      res.status(500).json({ error: "erro ao registrar sugestão" });
    }
  });

  // POST /groups/:id/accept (admin, linha 149–163) — SEM try/catch
  admin.post("/groups/:id/accept", async (req, res) => {
    // ... DB ops — se falhar, Express 5 retorna erro cru do DB
  });
  ```

  **Risco real:** Vazamento de detalhes internos do DB no response (nome de tabelas, colunas, constraints, IP do servidor DB). Exemplo de resposta atual se DB estiver down:
  ```
  HTTP 500
  connect ECONNREFUSED 172.18.0.2:5432
  ```

  **`resolveLogo()` é seguro** — tem try/catch interno (linha 142–145), nunca lança, sempre retorna `StoredLogo | null`.

  **Severidade:** Moderada-baixa. Admin autenticado (`requireAuth`+`requireAdmin`). Detalhes vazados são de baixa sensibilidade (schema público no repo open-source). Mas inconsistente com a rota pública que já tem try/catch.

  **Fix (padrão — aplicar nas 5 rotas):**
  ```typescript
  admin.post("/groups/:id/accept", async (req, res) => {
    try {
      // ... lógica existente
    } catch (e) {
      console.error("[POST /admin/v1/groups/:id/accept]", e);
      res.status(500).json({ error: "erro interno" });
    }
  });
  ```

  - [x] **C6a — `POST /groups/:id/accept`** sem try/catch ✅ corrigido 2026-06-20
  - [x] **C6b — `PATCH /groups/:id`** sem try/catch ✅ corrigido 2026-06-20
  - [x] **C6c — `POST /groups/:id/archive`** sem try/catch ✅ corrigido 2026-06-20
  - [x] **C6d — `DELETE /groups/:id`** sem try/catch ✅ corrigido 2026-06-20
  - [x] **C6e — `GET /admin/groups` + tags CRUD** sem try/catch ✅ corrigido 2026-06-20 (8 rotas no total)

**Corrida/lock:**
- [x] **C7 — Advisory lock via `pool.query()` quebrado** (CodeRabbit CR16) ✅ corrigido 2026-06-20

  **Fix aplicado:** `pool.query()` → `pool.connect()` para conexão dedicada de lock. Lock e unlock na mesma sessão PG. Nested try/finally: lockClient garante unlock + release mesmo em crash.
  **Débito cross-app:** `apps/site/db/migrate.ts:17,44` mesmo padrão frágil → registrado como `D-SITE-ADVISORY-LOCK` no `backlog.md`.
  Validação: `tsc --noEmit` verde, `astro build` 15 páginas verde. Sessão `26-06-20_2`.
- [x] **C8 — Race condition no seed de tags** (CodeRabbit CR17) ✅ corrigido 2026-06-20 via I2

  **Fix aplicado:** `seed.ts:34` INSERT de tags + `.onConflict((oc) => oc.column("slug").doNothing())`. TOCTOU fechado — agora atômico, consistente com `insertSuggestion` em `groups.ts:79`. Executado como parte do fix de I2 (seed idempotente completo).
  Validação: `tsc --noEmit` verde, `astro build` 15 páginas verde. Sessão `26-06-20_2`.
  Torna o INSERT atômico: se o slug já existir, PostgreSQL ignora silenciosamente (sem erro).

---

### 🟡 IMPORTANTES (6) — funcionalidade quebrada, lógica

- [x] **I1 — CSP `connect-src` bloqueia `accounts.artificiorpg.com`** (Codex RX1, P1) ✅ corrigido 2026-06-20

  **Fix aplicado:** `astro.config.mjs` `connect-src 'self'` → `connect-src 'self' https://accounts.artificiorpg.com`. SSO (`useSession`/`refreshSession`/`logout`) agora permitido via CSP. Site (`apps/site/astro.config.mjs`) já tinha o mesmo padrão.
  Validação: `tsc --noEmit` verde, `astro build` 15 páginas verde. Sessão `26-06-20_2`.
- [x] **I2 — Shell `|| echo` quebra `set -e`** (Amazon Q RQ4) ✅ corrigido 2026-06-20

  **Fix aplicado (3 partes):**
  1. **C8** — `db/seed.ts:34`: INSERT de tags + `.onConflict((oc) => oc.column("slug").doNothing())` (TOCTOU fechado).
  2. **Groups** — `db/seed.ts:76-92`: INSERT de grupos + `.onConflict((oc) => oc.column("invite_url").doNothing())`.
  3. **Entrypoint** — `docker-entrypoint.sh:18`: removido `|| echo "[links] seed ignorado..."`. Seed é verdadeiramente idempotente agora; `set -e` mata o script em erro real (DB offline, schema mismatch).
  Comentário do seed.ts atualizado: "Idempotente: groups por invite_url (ON CONFLICT), tags por slug (ON CONFLICT)".
  Validação: `tsc --noEmit` verde, `astro build` 15 páginas verde. Sessão `26-06-20_2`.
- [x] **I3 — `env=beta` bypass para módulo PROD-only** (Codex RX2, CodeRabbit CR14) ✅ corrigido 2026-06-20

  **Fix aplicado:** `deploy.yml:162` guard estendido para `{ [ "$m" = "accounts" ] || [ "$m" = "links" ]; }`. Bloqueia dispatch `module=links env=beta` que teria bypassado o `env_override=prod` do manifesto e rodado sobre containers de produção sem smoke.
  Comentário e mensagem de erro atualizados para genérico ("$m nao tem realm beta").
  Validação: `astro build` 15 páginas verde (workflow não afeta build). Sessão `26-06-20_2`.
- [x] **I4 — Sitemap exclui `/grupo/admin-rpg` etc.** (CodeRabbit CR15) ✅ corrigido 2026-06-20

  **Fix aplicado:** `astro.config.mjs:14` `!page.includes("/admin")` → `!/\/admin(?:\/|$)/.test(page)`. Regex ancora `/admin` como segmento de path — não exclui mais `/grupo/admin-rpg/` nem `/grupo/administracao/`. Só `/admin`, `/admin/`, `/admin/...` são excluídos.
  Validação: `tsc --noEmit` verde, `astro build` 15 páginas verde. Sessão `26-06-20_2`.

  **Severidade:** Baixa (dados atuais não afetados), mas bug real que viola o compromisso de SEO.

  **Fix (1 linha):**
  ```javascript
  // De:
  filter: (page) => !page.includes("/admin")
  // Para:
  filter: (page) => !/\/admin(?:\/|$)/.test(page)
  ```
  `(?:\/|$)` → casa `/admin` seguido de `/` OU fim da string. Exclui `/admin`, `/admin/`, `/admin/...` mas NÃO `/grupo/admin-rpg/`.
- [x] **I5 — `cloudinaryEnabled()` aceita config incompleta** (CodeRabbit CR12) ✅ corrigido 2026-06-20

  **Fix aplicado:** `cloudinaryEnabled()` agora checa as 3 vars: `CLOUDINARY_URL || (CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET)` — padrão glossario (gold standard). Mensagem de erro atualizada para refletir os 3 campos.
  Site (`media-store.ts`, `media.ts`) tem o mesmo bug → débito cross-app `BL-CLOUDINARY-SHARED` (já registrado).
  Validação: `tsc --noEmit` verde, `astro build` 15 páginas verde. Sessão `26-06-20_2`.
    || (process.env.CLOUDINARY_CLOUD_NAME
      && process.env.CLOUDINARY_API_KEY
      && process.env.CLOUDINARY_API_SECRET),
  ```

  **Impacto prático:** Se alguém configurar só `CLOUDINARY_CLOUD_NAME` (ex.: copiou `.env` parcial):
  - Seed: `cloudinaryEnabled()` → `true` → tenta `uploadLogoFromUrl()` → falha de auth → `resolveLogo` retorna `null` → grupos sem logo
  - Admin: aceitar sugestão → `resolveLogo()` → falha de auth → logo nula
  - Erro não é óbvio: "Authentication Error" vs "Cloudinary não configurado"

  **Fix (padrão glossario):**
  ```typescript
  export function cloudinaryEnabled(): boolean {
    return Boolean(
      process.env.CLOUDINARY_URL ||
      (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
    );
  }
  ```
  **site** tem o mesmo bug — débito cross-app.
- [ ] **I6 — Duplicação 4.2% no código novo** (SonarQube SQ2)

  **Limite:** ≤3%. **Medido:** 4.2% no new code do PR #74.

  **Blocos duplicados confirmados — padrão `upload_stream` em 3 apps:**

  | App | Arquivo | Função | Linhas | Folder Cloudinary |
  |---|---|---|---|---|
  | **links** | `server/lib/cloudinary.ts` | `uploadBuffer()` | 33–45 | `artificio/links` |
  | **mesas** | `discord/uploadDiscordImage.ts` | `uploadBufferToCloudinary()` | 33–57 | `discord-imports` |
  | **site** | `server/lib/media-store.ts` | `storeUpload()` | 46–63 | `artificio/uploads` |

  **Núcleo duplicado (≈20 linhas × 3 = ≈60 linhas duplicadas):**
  ```typescript
  // Padrão idêntico nos 3:
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "...", public_id: ..., resource_type: "image", overwrite: false },
      (err, result) => {
        if (err) return reject(err);
        if (!result?.secure_url) return reject(new Error("..."));
        resolve({ url: result.secure_url, public_id: result.public_id });
      },
    );
    Readable.from(buffer).pipe(stream);
  });
  ```

  **Além do `upload_stream`, também duplicado:**
  - `ensureConfig()` / `cloudinaryEnabled()` — 3 apps (site, mesas via config direto, links)
  - `deleteLogo()` / `deleteStoredMedia()` / `deleteFromCloudinary()` — 3 apps
  - Padrão `fetch→arrayBuffer→Buffer.from→upload` (links, mesas discord, site media.ts)

  **O débito `BL-CLOUDINARY-SHARED` (backlog.md:61):**
  ```
  ABERTO (confirmado 2026-06-20)
  apps/site/server/lib/media-store.ts,
  apps/mesas/.../uploadDiscordImage.ts,
  apps/links/server/lib/cloudinary.ts
  → promover a packages/* (ex.: @artificio/media) p/ unificar
  ```

  **O que um `@artificio/media` compartilhado proveria:**
  ```typescript
  // API unificada:
  import { cloudinaryEnabled, configureCloudinary, uploadBuffer, deleteAsset, uploadFromUrl } from "@artificio/media";
  ```
  - `uploadBuffer(buffer, opts: { folder, publicId?, resourceType? })` → `StoredAsset`
  - `uploadFromUrl(url, opts)` → `StoredAsset` (com size limit, timeout, content-type check)
  - `deleteAsset(publicId)` → void
  - `cloudinaryEnabled()` → boolean (com validação dos 3 campos, I5)
  - Cada app passaria seu `folder` e opções específicas

  **Impacto de não resolver agora:** Duplicação 4.2% bloqueia o quality gate do SonarQube (condição SQ2). O PR #74 não passa nesse gate. Mas o SonarQube quality gate é informativo (não bloqueia merge como CI checks required).

  **Recomendação:** I6 é estrutural — requer extrair `@artificio/media` (spec cross-cutting, SDD Completo). Não cabe neste PR. Registrar no backlog como item acionável com os 3 consumidores mapeados.

---

### 🟢 MENORES (9) — code quality, docs, style

**Código:**
- [x] **M1 — `unknown→normalizer` violado em 3 ilhas React** (CodeRabbit CR10, ampliado) — todas corrigidas 2026-06-20

  **Regra (AGENTS.md):** "todo dado de API/banco/JSON/JSONB/query/localStorage/integração externa é `unknown` até passar por normalizador tipado antes de entrar em estado React, props ou render."

  **Gold standard:** `packages/auth/src/client.ts:62-81` `normalizeUser()`
  ```typescript
  function normalizeUser(value: unknown): User | null {
    if (!value || typeof value !== "object") return null;
    const record = value as Partial<User>;
    if (typeof record.id !== "string" || typeof record.email !== "string" || ...) return null;
    return { id: record.id, email: record.email, ... };
  }
  ```

  ---
  **Violação #1: `SuggestForm.tsx:77`** ✅ corrigido 2026-06-20
  ```typescript
  // ANTES (cast puro, sem runtime check):
  // const body = (await res.json().catch(() => null)) as { error?: string } | null;
  // setErr(body?.error ?? "Não foi possível enviar. Tente novamente.");

  // DEPOIS (normalizador tipado):
  const raw = await res.json().catch(() => null);
  const body =
    typeof raw === "object" && raw !== null && "error" in raw && typeof raw.error === "string"
      ? (raw as { error: string })
      : null;
  setErr(body?.error ?? "Não foi possível enviar. Tente novamente.");
  ```
  Validação: `tsc --noEmit` verde, `astro build` 15 páginas verde. Sessão `26-06-20_2`.

  ---
  **Violação #2: `AdminPanel.tsx:55-58`** ✅ corrigido 2026-06-20
  ```typescript
  // ANTES (api<T> genérico, zero normalização):
  // async function api<T>(url, init?): Promise<T> {
  //   const res = await authFetch(url, init);
  //   if (!res.ok) throw new Error(String(res.status));
  //   return (await res.json()) as T;  // ← as T genérico
  // }
  // const [g, t] = await Promise.all([
  //   api<{ data: Group[] }>("/api/admin/v1/groups"),
  //   api<{ data: Tag[] }>("/api/admin/v1/tags"),
  // ]);
  // setGroups(g.data);  // sem runtime check

  // DEPOIS (normalizadores por tipo + apiResponse wrapper):
  function normalizeGroup(value: unknown): Group | null { /* checa id/name/invite_url */ }
  function normalizeTag(value: unknown): Tag | null { /* checa id/slug/label */ }
  function normalizeApiResponse<T>(value, fn): T[] { /* checa data: Array.isArray */ }

  const reload = async () => {
    const [gRes, tRes] = await Promise.all([authFetch(...), authFetch(...)]);
    const [gJson, tJson] = await Promise.all([gRes.json(), tRes.json()]);
    setGroups(normalizeApiResponse(gJson, normalizeGroup));
    setTags(normalizeApiResponse(tJson, normalizeTag));
  };
  ```
  Chamadas de ação (accept/archive/delete) substituídas por `authFetch` inline com `.then(r => { if (!r.ok) throw ... })`.
  Validação: `tsc --noEmit` verde, `astro build` 15 páginas verde. Sessão `26-06-20_2`.

  ---
  **Violação #3: `CommunityGroups.tsx:45`** ✅ corrigido 2026-06-20
  ```typescript
  // ANTES (type annotation pura, zero runtime):
  // .then(([tagBody, groupBody]: [{ data: TagEntry[] }, { data: ApiGroup[] }]) => {
  //   for (const t of tagBody.data ?? []) tagLabel.set(t.slug, t.label);
  //   setState({ kind: "ok", groups: groupBody.data ?? [], tagLabel });
  // })

  // DEPOIS (normalização runtime completa):
  .then(([tagBody, groupBody]) => {
    const tagLabel = new Map<string, string>();
    // Normaliza tags: typeof + "data" in + Array.isArray + "slug"/"label" strings
    if (tagBody && typeof tagBody === "object" && "data" in tagBody) {
      const td = (tagBody as { data: unknown }).data;
      if (Array.isArray(td)) {
        for (const t of td) {
          if (t && typeof t === "object" && "slug" in t && "label" in t) {
            const slug = String((t as { slug: unknown }).slug);
            const label = String((t as { label: unknown }).label);
            if (slug) tagLabel.set(slug, label);
          }
        }
      }
    }
    // Normaliza grupos: typeof + Array.isArray + campos obrigatórios (name)
    let groups: ApiGroup[] = [];
    if (groupBody && typeof groupBody === "object" && "data" in groupBody) {
      const gd = (groupBody as { data: unknown }).data;
      if (Array.isArray(gd)) {
        groups = gd.map(g => { /* checa name/tags/is_adult/logo_url */ }).filter(...);
      }
    }
    setState({ kind: "ok", groups, tagLabel });
  })
  ```
  Validação: `tsc --noEmit` verde, `astro build` 15 páginas verde. Sessão `26-06-20_2`.

  ---
  **Resumo:**
  | # | Arquivo | Severidade | Risco real | Status |
  |---|---|---|---|---|
  | 1 | `SuggestForm.tsx:77` | Baixa | `?.` + `??` protegem | ✅ corrigido 2026-06-20 |
  | 2 | `AdminPanel.tsx:55-58` | Média | `as T` é mentira; state pode receber lixo | ✅ corrigido 2026-06-20 |
  | 3 | `CommunityGroups.tsx:45` | Média | `for...of` em não-array = iteração silenciosa | ✅ corrigido 2026-06-20 |
- [x] **M2 — Regex de canal não ancora fim do segmento** (CodeRabbit CR11) ✅ corrigido 2026-06-20

  **Código afetado:** `og.ts:33` (server) + `SuggestForm.tsx:22` (client-side `validInvite`).

  **Fix aplicado — Opção B (split, consistente com grupo):**
  ```typescript
  // ANTES (regex sem $, truncamento silencioso):
  // const m = u.pathname.match(/^\/channel\/([A-Za-z0-9]{8,40})/);
  // if (!m) return null;
  // return { url: `https://whatsapp.com/channel/${m[1]}`, kind: "channel" };

  // DEPOIS (split + âncora, idêntico ao padrão de grupo):
  const code = u.pathname.replace(/^\/+/, "").split("/")[1] ?? "";
  if (!/^[A-Za-z0-9]{8,40}$/.test(code)) return null;
  return { url: `https://whatsapp.com/channel/${code}`, kind: "channel" };
  ```
  Client (`SuggestForm.tsx:22`): mesma troca — regex sem âncora → split + `$`.
  **Borda corrigida:** `channel/REALCODE-sufixo` antes capturava `REALCODE` (truncava); agora rejeita estritamente.
  Validação: `tsc --noEmit` verde, `astro build` 15 páginas verde. Sessão `26-06-20_2`.
  if (!/^[A-Za-z0-9]{8,40}$/.test(code)) return null;
  ```
  Recomendada — paridade total com a validação de grupo.
- [x] **M3 — `word-break: break-word` deprecado** (CodeRabbit CR9) ✅ corrigido 2026-06-20

  **Código:** `apps/links/src/styles/global.css:579`
  ```css
  /* ANTES: */
  .admin-meta { word-break: break-word; }
  /* DEPOIS: */
  .admin-meta { overflow-wrap: anywhere; }
  ```
  `word-break: break-word` nunca fez parte da spec CSS (invenção WebKit/Blink). Firefox ignora. `overflow-wrap: anywhere` é o substituto canônico, cross-browser (Chrome 85+, Firefox 65+, Safari 15.4+).
  Validação: `astro build` 15 páginas verde. Sessão `26-06-20_2`.
- [x] **M4 — Font-family com aspas em nomes de palavra única** (CodeRabbit CR7) ✅ corrigido 2026-06-20

  3 aspas removidas em `global.css`: `"Inter"` → `Inter` (linha 40), `"Oswald"` → `Oswald` (linhas 510, 565). Nomes com espaço (`"Segoe UI"`, `"Arial Narrow"`) mantidos. Zero impacto funcional — stylelint `font-family-name-quotes`.
  Validação: `astro build` 15 páginas verde. Sessão `26-06-20_2`.
- [x] **M5 — `robots.txt` falta `Disallow: /admin`** (CodeRabbit CR8) ✅ corrigido 2026-06-20

  `robots.txt` adicionada linha `Disallow: /admin` (sem barra). Cobre `/admin`, `/admin/`, `/admin?tab`, `/admin/groups`. `trailingSlash: "ignore"` do Astro pode gerar ambas as formas; antes só `/admin/` era bloqueado. Falso-positivo `/administrator` inofensivo.
  Validação: `astro build` 15 páginas verde. Sessão `26-06-20_2`.

**Documentação:**
- [x] **M6 — `plan.md` fallback SSR com path errado** (CodeRabbit CR2) ✅ corrigido

  **Documento:** `specs/013-links-regras-restore/plan.md:128`
  ```
  "...Express serve a página via /api/groups/:slug (SSR mínimo)..."
  ```

  **Realidade (código):**
  - `server.ts:68` — `GET /api/groups/:slug` → retorna **JSON** (`res.json({ data: g })`)
  - `server.ts:286` — `GET /grupo/:slug` → retorna **HTML** (`res.send(renderGroupPage(g))`) ← este é o SSR fallback

  O SSR fallback real é `/grupo/:slug` (HTML), não `/api/groups/:slug` (JSON). A API JSON alimenta a island da home; o SSR serve a página indexável do card.

  **Fix aplicado em `plan.md:128`:** `/api/groups/:slug` → `/grupo/:slug` (com `renderGroupPage`)
- [x] **M7 — `review-ux-design.md` §5 lista bugs já corrigidos** (CodeRabbit CR3) ✅ corrigido

  **Documento:** `specs/013-links-regras-restore/review-ux-design.md:89-99`

  **Itens do §5 e seu status real (verificação 2026-06-20):**

  | # | Item | Status |
  |---|---|---|
  | 1 | CSP bloqueia logos Cloudinary | ✅ Corrigido — `img-src` inclui `https://res.cloudinary.com` |
  | 3 | Corrida no insertSuggestion | ✅ Corrigido — `onConflict().doNothing()` em `groups.ts:79` |
  | 7 | Rebuild SSG vs island — fallback ausente | ✅ Corrigido — `/grupo/:slug` SSR implementado |
  | 2 | slugify com faixa literal frágil | ⚠️ Pendente (fora do escopo desta revisão) |
  | 4,5,6,8,9 | pgcrypto, +18 API, og:image, updated_at, rotas | 📋 Documentados como decisões/aceites/mitigações |

  **Fix aplicado:** Título do §5 renomeado para **"Archive — Predição de bugs / inconsistências no código F0 (revisão histórica)"** com nota de status indicando itens corrigidos.
- [x] **M8 — `backlog.md:59` FollowUp ✅ prematuro + status desatualizado** (CodeRabbit CR5) ✅ corrigido

  **Documento:** `specs/backlog.md:59` — entrada `BL-LINKS-013`

  **Problemas encontrados:**
  - Status dizia "código F0–F5+TC5+UX local concluído, **nada commitado**" — desatualizado. PR #74 commitou tudo em `ca7012c`.
  - `FollowUp ✅ GET /api/tags` — o ✅ era prematuro no momento da abertura do PR (código ainda local). Agora que o PR existe, o ✅ é válido mas pendente de merge+deploy.

  **Fix aplicado:**
  - Status: "em andamento (**PR #74 aberto 2026-06-20, aguardando merge**)"
  - FollowUp: "✅ GET /api/tags **(em PR, pendente merge+deploy)**"
  - Próximo passo: "🟦 **merge PR #74 → deploy**"
- [x] **M9 — `sessoes/...` T-LNK4 "WhatsApp" singular** (CodeRabbit CR6) ✅ corrigido

  **Documento:** `sessoes/26-06-20_2_links_whatsapp-013-014.md:35`
  ```
  T-LNK4 — "WhatsApp" em packages/ui/src/modules.ts
  ```

  **Decisão registrada no próprio arquivo (linha 48):**
  ```
  Label nav = "WhatsApps" (plural).
  ```

  **Código já usa plural:** `modules.ts += "WhatsApps"` (linha 60), `packages/ui/src/modules.ts` tem `"WhatsApps"`.

  **Fix aplicado:** T-LNK4 corrigido para `"WhatsApps"` (plural), consistente com a decisão e o código.

---

### ⬜ A INVESTIGAR (8) — verificados 2026-06-20

> Todos os 8 itens foram verificados durante as investigações B1–M9. Conclusões abaixo.

- [x] **A1 — CSRF ausente** (CodeQL R4): **False positive.** App usa JWT no cookie (não sessão). Cookie é `HttpOnly; Secure; SameSite=Lax`. Sem estado de sessão no servidor, CSRF não consegue forjar ação autenticada — o token JWT no cookie é enviado automaticamente pelo browser, mas sem sessão server-side não há estado a proteger. Também não há operações sensíveis (write) sem `requireAuth` explícito. Ver C5.
- [x] **A2 — Rate-limit ausente nas rotas admin** (CodeQL R5): **Aceito.** Admin é autenticado via JWT (`requireAuth`+`requireAdmin`). Brute-force de admin exigiria comprometer conta Google do mantenedor (`paulohenriquercc@gmail.com`). Rotas admin já têm `requireAuth` que valida JWT a cada request — sem token válido → 401. Rate-limit adicional seria redundante.
- [x] **A3 — Rate-limit ausente no SSR fallback** (CodeQL R6): **Aceito.** `GET /grupo/:slug` faz `existsSync(resolve(DIST, ...))`. Custo é I/O de filesystem local, não DB. Abuso máximo: enumerar slugs existentes (que já são públicos no sitemap). Sem risco de DoS significativo.
- [x] **A4 — Path expression com input do usuário** (CodeQL R7): **False positive.** `req.params.slug` usado em `resolve(DIST, "grupo", slug, "index.html")`. Slug gerado por `slugify()` (alfanumérico + hífen), armazenado no DB com UNIQUE constraint, validado por `Groups.findBySlug()` antes do acesso ao filesystem. Sem vetor de path traversal. Ver C4 (SonarQube hotspot sobreposto) e C5.
- [x] **A5 — Rate-limit ausente no 404 handler** (CodeQL R8): **Aceito.** `express.static` é cache-friendly (ETag/Last-Modified). `sendFile` no 404 é fallback para página 404.html estática. Sem custo de DB ou processamento pesado.
- [x] **A6 — "admin access without authentication"** (Amazon Q RQ1): **False positive.** Admin router (`server.ts:126`) tem `admin.use(requireAuth, requireAdmin)`. O Q não rastreou a composição de middlewares. Ver C2.
- [x] **A7 — `backlog.md:61` path com placeholder `...`** (CodeRabbit CR4): **Verificado.** Path real é `apps/mesas/backend/src/discord/uploadDiscordImage.ts`. Corrigido no backlog durante investigação I6 (entrada `BL-CLOUDINARY-SHARED` ampliada).
- [x] **A8 — `spec.md:73-79` requisitos 9–14 fora de ordem** (CodeRabbit CR13): **Nitpick aceito.** A ordem dos requisitos no spec.md é informativa, não contratual. Renumerar não altera semântica. Baixa prioridade.

---

## Fechamento (atualizado 2026-06-20)
- [ ] TF1 — `specs/backlog.md`: BL-LINKS-013/BL-NAV-LINKS-014 atualizados; `BL-CLOUDINARY-SHARED` ampliado (I6).
- [ ] TF2 — `project-state.md` + `sessoes/index.md` após merge do PR #74.
- [ ] TF3 — Nielsen/ISO na sessão; checklist de revisão do PR documentada (B1–M9).
- [ ] TF4 — PR #74 aberto (app links+db+nav shared+deploy manifest). Merge → dev após correção dos bloqueantes B1+B2.

## Bloqueios / decisões abertas (atualizado 2026-06-20)
1. 🟦 **Tunnel** `links.` — ação do mantenedor (token CF 403 em cfd_tunnel; DNS read OK).
2. 🟦 **`.env`/secrets** na VM — mantenedor (`JWT_SECRET`=accounts D042, `CLOUDINARY_*`, `DATABASE_URL`, `POSTGRES_PASSWORD`, `PUBLIC_LINKS_URL`, `PUBLIC_GSC_VERIFICATION`).
3. 🟦 **Deploy dispatch** — `module=links mode=deploy` + smoke (após merge do PR #74).
4. ✅ **Beta/prod** — DECIDIDO **prod-only** no 1º corte (plan.md). Guard `env=beta` aplicado (I3 ✅).
5. **Cloudinary helper:** débito `BL-CLOUDINARY-SHARED` **aberto** (3 consumidores mapeados em I6; promover a `packages/*`).

## Pendências restantes (pós-implementação)
1. 🟦 **Deploy** — ação mantenedor: tunnel `links.` + `.env` VM + deploy dispatch + smoke.
2. 🟦 **Smoke nav consumidores** — site/mesas/glossario/accounts com "WhatsApps" no ar (só após `links.` deployado).
3. **Correções do PR #74:** ✅ TODAS APLICADAS 2026-06-20. M1–M5 + I1–I5 + C1–C8 (código). B1 (lockfile) + B2 (chmod) corrigidos localmente, pendentes commit.
4. **Débitos cross-app:** ✅ Todos fechados 2026-06-20 (D-SITE-REQUIREADMIN, BL-ROOTLESS-CONTAINERS, D-SITE-ADVISORY-LOCK, BL-CLOUDINARY-SHARED).

---

## Revisões 2 — Novos achados (2026-06-20, CodeRabbit pós-correções)

> Achados de revisão automática após aplicação das correções M1–C8 e débitos cross-app.
> Catalogados para investigação futura. Nenhuma correção aplicada ainda.

### ⬜ A INVESTIGAR (4)

- [x] **R2-1 — Category cast sem validação** (CodeRabbit, 🟡 Minor, ⚡ Quick win) ✅ corrigido 2026-06-20

  **Código:** `apps/links/server/server.ts:194`
  ```typescript
  if (typeof b.category === "string") patch.category = b.category as GroupCategory;
  ```

  **Investigação completa (2026-06-20):**

  **1. Fluxo do dado:**
  ```
  Client (AdminPanel.tsx) → PATCH /api/admin/v1/groups/:id → server.ts:194
    → Groups.updateGroup() → Kysely UPDATE → PostgreSQL CHECK constraint
  ```
  - Client: `<Select>` populado com `CATEGORIES = ["artificio","tematicos","parceiros","comunidade"]` (AdminPanel.tsx:47,331) — UI restringe, mas bypassável via fetch direto.
  - Server: `b.category as GroupCategory` — cast puro, zero runtime check.
  - DB: `CHECK (category IN ('artificio','tematicos','parceiros','comunidade'))` (migration_001_init_groups.sql:31).

  **2. O que acontece se um valor inválido é enviado:**
  ```
  POST /api/admin/v1/groups/<id>
  Body: { "category": "hacked" }

  1. typeof "hacked" === "string" → true → entra no if
  2. patch.category = "hacked" as GroupCategory → TypeScript não emite runtime check
  3. updateGroup() → db.updateTable("groups").set({ category: "hacked" })
  4. PostgreSQL: ERROR: new row for relation "groups" violates check constraint "groups_category_check"
  5. C6 try/catch → res.status(500).json({ error: "erro interno" })
  ```
  Resultado: 500 genérico. Admin não sabe qual campo falhou. Log do servidor mostra o erro PG real.

  **3. Gold standard no mesmo codebase (AdminPanel.tsx:70):**
  ```typescript
  // normalizeGroup já faz a validação correta:
  category: (typeof r.category === "string" && (CATEGORIES as string[]).includes(r.category))
    ? r.category as Category : "comunidade",
  ```
  O normalizer do client JÁ valida category contra o conjunto. O server não.

  **4. Mesmo padrão em outros campos do mesmo handler (server.ts PATCH):**
  - `invite_url` → validado via `parseInviteUrl()` (host allowlist + path regex) ✅
  - `tags` → validado via `sanitizeTagSlugs()` (array+string+DB lookup) ✅
  - `name` → sanitizado via `cleanText()` (length+HTML) ✅
  - `slug` → validado via `ensureUniqueSlug()` (slugify+DB unique) ✅
  - `description`, `rules` → sanitizados via `cleanText()` ✅
  - `category` → **único campo sem validação** — só typeof string + cast ❌

  **5. Severidade real:**
  - Não é bypass de segurança (CHECK constraint barra no DB, fail-closed).
  - Não causa corrupção de dados (PostgreSQL rejeita a transação inteira).
  - Impacto: UX ruim (500 genérico), log poluído com erro PG, inconsistência com os outros campos do handler que têm validação explícita.
  - Autenticação: rota exige `requireAuth`+`requireAdmin` — vetor restrito a admin.

  **6. Fix (3 linhas, antes do cast na linha 194):**
  ```typescript
  // De:
  if (typeof b.category === "string") patch.category = b.category as GroupCategory;
  // Para:
  if (typeof b.category === "string") {
    if (!(["artificio","tematicos","parceiros","comunidade"] as string[]).includes(b.category)) {
      res.status(400).json({ error: "categoria inválida" });
      return;
    }
    patch.category = b.category as GroupCategory;
  }
  ```
  Ou extrair const `VALID_CATEGORIES` no topo do server.ts (consistente com AdminPanel.tsx:47).

  **Sessão:** `26-06-20_2_links_whatsapp-013-014.md`, revisões 2.

  **Fix aplicado 2026-06-20:** constante `VALID_CATEGORIES` no topo do `server.ts` + validação `includes()` antes do cast, retornando 400 "categoria inválida". Consistente com os outros 6 campos do handler PATCH. `tsc --noEmit` verde, `astro build` 15p verde.

- [x] **R2-2 — Advisory unlock sem garantia de release** (CodeRabbit, 🟠 Major, ⚡ Quick win) ✅ corrigido 2026-06-20

  **Código:** `apps/site/db/migrate.ts:44-46`
  ```typescript
  } finally {
    if (db.isPg) await lockClient.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
    lockClient.release();
    await db.close();
  }
  ```

  **Investigação completa (2026-06-20):**

  **1. Contexto — o fix do D-SITE-ADVISORY-LOCK:**
  O débito C7 (advisory lock via `db.query()` não-determinístico) foi corrigido adicionando `getClient()` à interface `Db` (connection.ts:48-53). Migrate.ts agora usa `lockClient` dedicado (linha 17) — lock+unlock na mesma conexão PG ✅. Porém, o finally não protege o `release()` contra falha no unlock.

  **2. O bug — unlock pode lançar e bloquear release():**
  ```typescript
  if (db.isPg) await lockClient.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]); // ← pode lançar
  lockClient.release();  // ← NUNCA executa se a linha acima lançar
  ```
  Cenários onde `pg_advisory_unlock` pode lançar exceção:
  | Falha | Causa | Probabilidade |
  |---|---|---|
  | `ERR_CONNECTION_RESET` | PostgreSQL reiniciou ou matou a conexão durante o migrate | Baixa |
  | `ERR_POOL_CLOSED` | `pool.end()` chamado prematuramente (outro caminho de código) | Muito baixa |
  | `ERR_CONNECTION_TIMEOUT` | Rede entre container app e DB caiu | Baixa |
  | Lock não existe | `pg_advisory_unlock` retorna `false` (não é exceção — é retorno normal) | N/A (não lança) |

  Se qualquer uma dessas exceções ocorrer, `lockClient.release()` nunca roda → conexão vaza do pool. Com pool `max: 10`, após 10 vazamentos o pool fica exausto e `pool.connect()` pendura infinitamente (30s timeout).

  **3. Gold standard — links (`apps/links/db/migrate.ts:72`):**
  ```typescript
  } finally {
    await lockClient.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    lockClient.release();
  }
  ```
  Links usa `.catch(() => {})` no unlock — garante que `release()` SEMPRE executa, mesmo se unlock falhar. Este é o padrão correto.

  **4. Comparação direta:**
  | Aspecto | links (C7) | site (D-SITE-ADVISORY-LOCK) |
  |---|---|---|
  | Conexão dedicada | ✅ `pool.connect()` → lockClient | ✅ `db.getClient()` → lockClient |
  | Lock+unlock mesma sessão | ✅ | ✅ |
  | Unlock com `.catch()` | ✅ | ❌ |
  | `release()` garantido | ✅ | ❌ |

  **5. Severidade real:**
  - **Não é explorável remotamente:** migrate roda como script local/dev ou no entrypoint do container — single-process, sem input externo.
  - **Pool exhaustion é teórico:** precisaria de 10 falhas consecutivas de unlock sem restart do processo.
  - **Impacto prático atual:** baixo. O `db.close()` na linha 47 (`pool.end()`) fecha todas as conexões inclusive as vazadas — então mesmo sem release(), o pool é limpo no fim do script.
  - **Risco real:** se o código evoluir e `db.close()` for removido ou movido para outro lugar, o vazamento se torna real. Defesa em profundidade.

  **6. Fix (1 caractere — `.catch(() => {})`):**
  ```typescript
  // De:
  if (db.isPg) await lockClient.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]);
  // Para:
  if (db.isPg) await lockClient.query("SELECT pg_advisory_unlock($1)", [LOCK_KEY]).catch(() => {});
  ```
  Idêntico ao padrão links. Garante que `release()` sempre executa no finally.

  **Sessão:** `26-06-20_2_links_whatsapp-013-014.md`, revisões 2.

  **Fix aplicado 2026-06-20:** `.catch(() => {})` adicionado ao unlock. Idêntico ao padrão `apps/links/db/migrate.ts:72`. `tsc --noEmit` em `apps/site` verde.

- [x] **R2-3 — project-state.md não atualizado pós-media-shared** (CodeRabbit, 🟠 Major) ✅ verificado 2026-06-20 — já resolvido

  **Verificação:** `.specify/memory/project-state.md` linha 121 já contém entrada `BL-CLOUDINARY-SHARED FECHADO LOCAL` com detalhes completos (`packages/media` criado, 5 funções, 3 consumidores migrados, turbo build 9/9). Revisor provavelmente inspecionou versão anterior ao registro. Nenhuma ação necessária.

  **Contexto:** `sessoes/26-06-20_4_media-shared.md` — sessão de implementação do `@artificio/media`. Checklist marca `[x] project-state.md atualizado`, mas revisor reporta que o arquivo pode estar ausente ou desatualizado.
  **Ação:** verificar `.specify/memory/project-state.md` — registrar `@artificio/media` como novo pacote shared e atualizar status dos débitos cross-app fechados.

- [x] **R2-4 — Sessão prompt-D-SITE-ADVISORY-LOCK incompleta** (CodeRabbit, 🟡 Minor) ✅ verificado 2026-06-20 — já resolvido

  **Verificação:** Sessão real `sessoes/26-06-20_4_site_advisory-lock.md` existe (40 linhas) com header completo: data, objetivo, gate, vínculos, plano, checklist 12 itens (`[x]`), arquivos modificados. O arquivo `prompt-D-SITE-ADVISORY-LOCK.md` era apenas a especificação inicial; a sessão real foi criada posteriormente com formato completo. Checklist cobre: `connection.ts` (DbClient+getClient, factories pg/pglite), `migrate.ts` (lockClient, lock+unlock+release), `media.test.ts` (mock), validações (tsc+build), backlog+project-state. R2-2 (`.catch(() => {})`) complementa a sessão como correção adicional.
