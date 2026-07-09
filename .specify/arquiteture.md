# Arquitetura & Contratos — Artifício RPG

> **T1. Ler por seção, nunca o arquivo inteiro.** Fonte canônica de arquitetura/contratos técnicos (vence AGENTS.md em conflito técnico). Decisões macro em `.specify/memory/decisions.md`.
> **Última verificação:** 2026-07-08

## Índice
1. Layout do monorepo
2. Contrato de módulo
3. SSO / Auth
4. Gateway / Roteamento
5. Banco de dados
6. Conteúdo / SEO / SSG
7. CI/CD / Deploy
8. Engine de crosslink (SRD ↔ Wiki)
9. Convenções de código

---

## 1. Layout do monorepo
```
artificio/
  apps/        accounts/ glossario/ links/ mesas/ site/ site-admin/
  packages/    analytics/ auth/ changelog/ config/ content/ feedback/ media/ ui/
  specs/  sessoes/  docs/  .specify/  .claude/  .github/workflows/
  pnpm-workspace.yaml  turbo.json  package.json  tsconfig.base.json
```
Nomes de pacote: `@artificio/<nome>`. Workspace via pnpm. Build via Turbo (affected graph). Docker Compose por app em `apps/<app>/docker-compose.*.yml`; não há diretório `infra/` centralizado.

Nav cross-app e metadata de projetos centralizados em `packages/ui/src/modules.ts` (`defaultNavItems`) — fonte única, não per-app. `module.manifest.ts` em `mesas` é código morto (zero consumidores runtime). `CONTEXT.md` existe em `mesas` como documentação; demais apps não têm. Módulo legado com frontend/backend separados (`glossario`) expõe subpacotes `apps/<modulo>/frontend` e `apps/<modulo>/backend` no workspace; orquestrador `apps/<modulo>/package.json` pendente.

## 2. Contrato de módulo
Cada `apps/*` roda no **próprio subdomínio**, root `/` próprio (sem basename). Metadados cross-app centralizados em `packages/ui/src/modules.ts` (`defaultNavItems`, barrel static-safe em `static.ts` para consumidores sem React):
```ts
// packages/ui/src/modules.ts
export const defaultNavItems: NavItem[] = [
  { label: 'Blog', href: 'https://artificiorpg.com' },
  { label: 'Glossário', href: 'https://glossario.artificiorpg.com' },
  // ...todos os apps registrados aqui
]
```
Módulo é independente (subdomínio/deploy isolado) mas consome `packages/*` para auth/ui/analytics/SEO. Não implementa login próprio, não diverge do design system, não inventa stack. Nav entre módulos = URLs absolutas. Adicionar novo app → registrar em `modules.ts`. Playbook: skill `add-module`.

## 3. SSO / Auth (`packages/auth` + serviço `accounts.artificiorpg.com`, D018)

### Serviço `accounts.artificiorpg.com`

- **1 OAuth client Google** (web). Callback: `accounts.artificiorpg.com/api/auth/google/callback` (única redirect URI no Google Console).
- Fluxo cross-subdomínio: módulo precisa de login → redirect a `accounts.artificiorpg.com/login?return=<url>` → Google → callback → set cookies → redirect de volta ao `return`.
- `return` sanitizado com allowlist: **somente `*.artificiorpg.com` HTTPS** (`isAllowedReturnUrl`).
- **2 cookies** (ambos `Domain=.artificiorpg.com; Path=/; HttpOnly; Secure; SameSite=Lax`):
  - `artificio_session` — JWT de acesso, **HS256** (simétrico, `JWT_SECRET`), expira em **15 min**.
  - `artificio_refresh` — JWT de refresh, **HS256** (`JWT_REFRESH_SECRET`, segredo separado), expira em **7 dias**.
- **Refresh:** `GET /api/auth/refresh` lê o cookie `artificio_refresh`, verifica com `JWT_REFRESH_SECRET`, emite novo par access+refresh.
- **Logout:** `POST /api/auth/logout` limpa ambos os cookies → 204.
- **Me:** `GET /api/auth/me` retorna `{ user }` da sessão (requer `requireAuth`).
- **CSRF:** cookie `xsrf_token` (não-httpOnly) + header `x-xsrf-token` em métodos mutantes; origin allowlist: mesas, glossario, links, accounts, raiz.
- **CORS:** `credentials: true`, origin `/^https:\/\/(?:[^.]+\.)?artificiorpg\.com$/`.
- **DB `users`:** `id, google_sub, email, name, avatar, role (user|admin), created_at`. Upsert por `google_sub`.

### `packages/auth` — contratos

**Server-side** (`@artificio/auth`, CJS+ESM):
- `verifyToken(token): Session | null` — verifica JWT com `JWT_SECRET` (HS256), retorna sessão tipada ou null.
- `requireAuth` — middleware Express: lê `Authorization: Bearer` ou cookie `artificio_session`, chama `verifyToken`, anexa `req.session`.
- `csrfProtection` — middleware Express: valida `xsrf_token` ou Bearer token em métodos mutantes.

**Client-side** (`@artificio/auth/client`, ESM-only):
- `useSession()` — hook React: `GET /api/auth/me` com refresh em 401.
- `refreshSession()` — single-flight: `GET /api/auth/refresh`.
- `authFetch(url, init)` — `fetch` com `credentials: include` e refresh em 401.
- `redirectToLogin(returnUrl)`, `logout(redirectTo)`.
- `getAccountsOrigin()` — lê `VITE_ACCOUNTS_URL` (default `https://accounts.artificiorpg.com`).

### Consumidores (todos verificados em prod)

| App | Backend | Frontend |
|---|---|---|
| `mesas` | `requireAuth` + `optionalAuth` (resolve usuário local) | `useSession`, `redirectToLogin`, `authenticatedFetch` |
| `glossario` | `authMiddleware` (resolve usuário local + account-linking) | `useSession`, `redirectToLogin`, `logout`, axios 401→refresh |
| `links` | `requireAuth` em admin + `verifyToken` manual em report | `useSession`, `authFetch`, `redirectToLogin` |
| `site` | `requireAuth` + `verifyToken` manual em feedback | `useSession`, `getAccountsOrigin`, `logout` (SiteHeaderIsland) |
| `site-admin` | — (same-origin, cookie SSO vai automático) | `refreshSession`/`authFetch` próprios (não importa `@artificio/auth/client`) |

### Segredos

- **2 secrets obrigatórios no `accounts`:** `JWT_SECRET` + `JWT_REFRESH_SECRET` (mín 32 chars cada).
- **Consumidores só precisam de `JWT_SECRET`** (mesmo valor do `accounts` no mesmo ambiente) — validado pelo deploy via `read_env_value`.
- **Sem JWKS / RS256** — HS256 simétrico com segredo compartilhado. JWKS/RS256 é futuro (spec 003).
- **Sagrado:** mudança aqui = SDD Completo + smoke de todos os consumidores. Nunca quebrar sessão compartilhada.

## 4. Roteamento — subdomínio-por-módulo (D017)
**Sem gateway de path.** Cada módulo é um host:
| Subdomínio | Módulo | Auth |
|---|---|---|
| `artificiorpg.com` (raiz) | `site` (blog/portal, Astro SSG — spec 029, `53e5870`) | público |
| `beta.artificiorpg.com` | `site` (staging/testes — noindex via X-Robots-Tag, spec 030) | público |
| `glossario.artificiorpg.com` | `glossario` (prod canônico; `glossariorpg.` foi alias histórico desativado) | opcional |
| `mesas.artificiorpg.com` | `mesas` (refeito) | sim |
| `links.artificiorpg.com` | `links` (em prod, spec 038) | público |
| `accounts.artificiorpg.com` | SSO central | SSO |
| `downloads.artificiorpg.com` | `downloads` (futuro) | — |
| `esferas.artificiorpg.com` | `esferas` (futuro) | — |
| `srd.artificiorpg.com` | `srd` (futuro) | — |

- **`artificiorpg.com` (raiz):** serve o site novo (Astro SSG) desde a spec 029. O WordPress da Hostinger está desligado da raiz (D075); o flip foi por redirect interno Cloudflare, não o cutover DNS cerimonial do Gate C (adiado). **Estado atual (2026-06-22):** containers prod e beta separados (`site-prod-app`+`site-prod-db` e `site-beta-app`+`site-beta-db`), specs 030/031 executadas em prod, D075 superado por D076/D077.
- **`beta.artificiorpg.com`:** staging do site. Container isolado (`site-beta-app`+`site-beta-db`) com `noindex` (X-Robots-Tag) e `PUBLIC_SITE_URL=beta.artificiorpg.com` (canonical/OG/sitemap próprios, sem duplicar SEO da raiz). Sync prod→beta por dump manual a cada deploy (D077).
- **Betas:** mesas, glossário e site têm beta próprio (`mesasbeta.`, `glossariobeta.`, `beta.artificiorpg.com`). Links e accounts são PROD-only (`env_override=prod`, D042).
- **Cloudflare Tunnel**: um `cloudflared`, várias regras de ingress `hostname → container:port`. Nada de porta exposta. Cert wildcard `*.artificiorpg.com`.
- **Contrato Real IP (D069/spec 023):** o unico caminho publico confiavel e `Cloudflare Tunnel -> cloudflared -> artificio_net -> app`. `artificio_net` verificada em 2026-06-15 como `172.18.0.0/16`.
  - Apps com nginx (`mesas`, `glossario`): `set_real_ip_from ${TRUSTED_REAL_IP_FROM}` (default `172.18.0.0/16`) + `real_ip_header CF-Connecting-IP`; repassar `X-Real-IP` e `X-Forwarded-For` como `$remote_addr`, nunca `$http_cf_connecting_ip` cru nem `$proxy_add_x_forwarded_for`.
  - Apps Express, diretos ou atras de nginx (`accounts`, `site`, backends de `mesas`/`glossario`): `app.set("trust proxy", TRUSTED_PROXY_CIDR)` com default `172.18.0.0/16`, nunca `trust proxy = 1` como regra duravel.
  - Motivo: rate-limit/logs devem usar o IP do visitante validado; header de visitante so e aceito quando o hop anterior e o proxy interno confiavel.
- Cada app roda no próprio root `/` (Vite `base: '/'`, sem React Router basename). API do módulo sob `/api/...` do próprio host.
- Nav entre módulos = URLs absolutas (de `packages/ui`), com destaque do módulo atual.
- Hostnames com default hardcoded em ~25 pontos (com fallback env) — débito mapeado como `BL-CONFIG-AUTH` (spec 035). Centralizar em `@artificio/config`.

## 5. Banco de dados
- Postgres 16.14. **Isolamento por container Docker** (cada app tem próprio `db` container + volume), não só schema/banco. O único cross-cutting é `users`/sessão (de `auth`).
- Migrations por módulo, versionadas; nunca `DROP/TRUNCATE/ALTER` em prod sem dump + checklist (ver AGENTS).
- Acesso DB da VM por linha de comando local/PowerShell via `ssh faren` = read-only padrão.
- Tabelas do `site`: `posts, pages, taxonomies, comments, dev_feedback, media, media_map, post_taxonomies, redirects, schema_migrations`.

## 6. Conteúdo / SEO / SSG (`packages/content` + `apps/site`)
- **SSG**: conteúdo do Postgres → HTML estático no build/deploy. Rebuild incremental disparado pelo admin via `spawn("pnpm", ["run", "rebuild"])` (Astro build completo). Sem servidor de render runtime para o blog.
- Por página: `<title>`, meta description, canonical, OG, Twitter, JSON-LD (Article/Breadcrumb/Org), heading hierárquico, alt, lang.
- **Subdomínio (D017/D019):** blog (aposta de SEO) na **raiz** `artificiorpg.com`; módulos-ferramenta em subdomínio rankeiam por mérito próprio. Glossário, mesas e links servem `/sitemap.xml` e `robots.txt` (links via `@astrojs/sitemap`, configurado em `astro.config.mjs`). RSS no blog.
- **Search Console:** 1 **Domain property** (`artificiorpg.com`) cobre todos os subdomínios (D020).
- **GA4:** 1 property, `cookie_domain: 'artificiorpg.com'` + lista de exclusão de referral interno (mede sessão cross-subdomínio como uma só). Stream/dimension por módulo (`analyticsNamespace`).
- **301**: `redirects` (permalink WP → novo). Nenhuma rota legada vira 404. Slugs preservados.
- Validar com `seo-usability-auditor` antes de promover.

## 7. CI/CD / Deploy
- GitHub Actions: `ci.yml` (lint+build+test via Turbo). Deploy via `deploy.yml` (matrix a partir de `.github/deploy-manifest.json`) → `_deploy-module.yml` (reusável por módulo).
- **`.github/deploy-manifest.json`** = fonte única declarativa: `module`, `env_override`, `compose_file`/`_beta`, `compose_project`/`_beta`, `db_service`/`_beta`, `db_name`/`_beta`, `db_user`/`_beta`, `health_containers`, `critical_routes`/`_beta`, `auto_deploy_on_push`, `push_branches`, `deploy_paths`, `reconcile_same_project_orphans`, `_comment`.
- **Env deriva do ref:** `dev`→beta, `main`→prod (exceto `accounts` e `links`: `env_override=prod` fixo). Deploy prod usa `--ref main` (default branch = `dev`, D073).
- **VM:** clone git em `/opt/artificio` (prod) e `/opt/artificio-beta` (beta). `.env` por módulo no disco (`apps/<modulo>/.env` ou `.env.beta`), gitignored, lido pelo deploy via `--env-file`. Secrets GitHub Environment (`production`/`beta`) usados para SSH e CI; vars de runtime do container vêm do `.env` no disco.
- **`.env` no disco da VM (estado verificado 2026-06-18):**

| Módulo | Prod `/opt/artificio/apps/<mod>/.env` | Beta `/opt/artificio-beta/apps/<mod>/.env.beta` |
|---|---|---|
| `accounts` | 9 keys (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL, PUBLIC_URL, COOKIE_DOMAIN, JWT_SECRET, JWT_REFRESH_SECRET, POSTGRES_PASSWORD, DATABASE_URL) | 1 key (JWT_SECRET — D042: beta reusa SSO prod) |
| `mesas` | 30 keys (POSTGRES_*, JWT_*, DATABASE_URL, GOOGLE_*, CLOUDINARY_*, DISCORD_*, AGGREGATOR_*, FRONTEND_URL, VITE_*, ACCOUNTS_URL, etc.) | 32 keys (espelha prod + VITE_ENABLE_DEVTOOLS) |
| `glossario` | 9 keys (POSTGRES_USER, POSTGRES_PASSWORD, JWT_SECRET, …) | 10 keys |
| `site` | 7 keys (POSTGRES_USER, POSTGRES_PASSWORD, DATABASE_URL→site-prod-db, JWT_SECRET, CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET) | 10 keys (POSTGRES_PASSWORD, DATABASE_URL, JWT_SECRET, SITE_IMPORT_ON_START, CLOUDINARY_*×2 duplicados) |

- **`JWT_SECRET`** deve ser idêntico entre `accounts` e cada módulo no mesmo ambiente (validado pelo deploy no `read_env_value`). Contas beta reusam JWT prod (D042).
- **`.env` ausente no 1º deploy de módulo novo** → deploy aborta com erro (spec 009 R3). Bootstrap: criar o arquivo no disco da VM ANTES do 1º dispatch. **Nunca fazer `cat` do .env** — validar existência com `grep -c '^CHAVE='` (redacted).
- Imagem buildada NA VM (não GHCR). `docker compose --env-file .env up -d --force-recreate`. Build cache prune pós-deploy (`docker builder prune -f`).
- Fluxo: branch `feat/*`/`fix/*` → PR → `dev` (merge) → promote `dev→main` ff (`promote-prod-fast-forward.yml`) → dispatch deploy prod. Push a `dev`/`main` e qualquer ação write na VM = aprovação (AGENTS).
- **Module-level locks:** `flock` shared (deploys concorrentes) + exclusive (manutenção `docker-cleanup.yml`). Snapshot DB pré-deploy + health check + smoke `critical_routes`.

## 8. Engine de crosslink (`packages/crosslink`) — futuro
> **Status (2026-06-22):** `packages/crosslink`, `apps/srd` e `apps/esferas` não existem. Esta seção descreve arquitetura planejada, não implementada. Zero referências em decisions.md ou specs/.

- Padrão compartilhado entre `srd` e `esferas`: detectar termos referenciados e gerar **tooltip com resumo estruturado estático** + link profundo para a página do termo.
- Resolução **no import/build**, não em runtime: dado bruto → índice de termos → varredura do texto → injeção de `<a>`+tooltip. Resumos pré-gerados e persistidos (não consulta cara em runtime).
- SRD DnD 5.2.1: termos = magias/condições/regras (2024). `esferas`: termos = talents/spheres, interreferência entre talents.

### `esferas` — modelo multi-sistema (D028)
- Eixo **`sistema × edição`**. `sistema`: `dnd` (principal), `pathfinder` (futuro), …; `edição` por sistema: `dnd`→{`2014`,`2024`}, `pathfinder`→{`1e`,`2e`,…}.
- Cada sphere/talent é marcado por `sistema`+`edição`. **Interreferência só dentro do mesmo `sistema`+`edição`** (índice de crosslink particionado por par).
- UI: seletor de sistema/edição persistente; conteúdo e tooltips filtram pelo par ativo. Default = `dnd`/`2024` (com toggle p/ 2014).
- Importador da tradução SoP popula por par; novos sistemas/edições entram sem reescrever o engine.

## 9. Convenções de código
- Stack canônica única (§1, D007). TS estrito. Mudança mínima e reversível.
- Dado externo é `unknown` até normalizador tipado (sem `.map/.filter` sobre payload não validado; `Array.isArray`/schema/fallback). Ver AGENTS → Regras Gerais de Código.
- Segredos só em `.env` (gitignored) e secrets do Actions/Cloudflare.
