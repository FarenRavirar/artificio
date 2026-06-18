# Arquitetura & Contratos — Artifício RPG

> **T1. Ler por seção, nunca o arquivo inteiro.** Fonte canônica de arquitetura/contratos técnicos (vence AGENTS.md em conflito técnico). Decisões macro em `.specify/memory/decisions.md`.

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
  apps/        site/ glossario/ mesas/ downloads/ esferas/ srd/ links/
  packages/    auth/ ui/ analytics/ config/ content/ crosslink/
  infra/       docker/(compose.beta.yml) cloudflare/(tunnel ingress hostname→container)
  specs/  sessoes/  docs/  .specify/  .claude/  .github/workflows/
  pnpm-workspace.yaml  turbo.json  package.json  tsconfig.base.json
```
Nomes de pacote: `@artificio/<nome>`. Workspace via pnpm. Build via Turbo (affected graph). Cada `apps/*` tem `CONTEXT.md` (T2: contexto local do módulo) e `module.manifest.ts`. Módulo legado importado com frontend/backend separados pode expor subpacotes `apps/*/frontend` e `apps/*/backend`, com `apps/<modulo>/package.json` como orquestrador.

## 2. Contrato de módulo
Cada `apps/*` roda no **próprio subdomínio**, root `/` próprio (sem basename). Exporta `module.manifest.ts`:
```ts
export const manifest = {
  host: '<sub>.artificiorpg.com',  // subdomínio do módulo
  navLabel, navIcon,               // entrada na nav unificada (URL absoluta)
  requiresAuth: boolean,           // consome sessão SSO
  analyticsNamespace,              // stream/dimension GA4
  sitemapProvider: boolean,        // serve /sitemap.xml próprio
}
```
Módulo é independente (subdomínio/deploy isolado) mas consome `packages/*` para auth/ui/analytics/SEO. Não implementa login próprio, não diverge do design system, não inventa stack. Nav entre módulos = URLs absolutas. Playbook: skill `add-module`.

## 3. SSO / Auth (`packages/auth` + serviço `accounts.artificiorpg.com`, D018)
- **1 OAuth client Google** (web). Host de auth dedicado: **`accounts.artificiorpg.com`**. Callback: `accounts.artificiorpg.com/api/auth/google/callback` (única redirect URI no Google Console).
- Fluxo cross-subdomínio: módulo precisa de login → redirect a `accounts.artificiorpg.com/login?return=<url>` → Google → callback → set cookie → redirect de volta ao `return`.
- Login → emite **JWT** → cookie `httpOnly; Secure; SameSite=Lax; Domain=.artificiorpg.com`. Cookie de domínio raiz ⇒ enviado a **todos** os subdomínios ⇒ sessão única.
- Validação: cada backend verifica o mesmo JWT (segredo compartilhado via env / JWKS de `accounts`). `accounts` provê sessão/refresh/logout.
- `requiresAuth: false` → módulo público + reage a sessão se presente. `true` → exige sessão.
- **Cuidado:** o cookie raiz também chega ao host do WP (`artificiorpg.com`) — inofensivo (WP ignora), mas escopar/`SameSite` com cuidado; nunca expor segredo no front.
- **Sagrado:** mudança aqui = SDD Completo + smoke de todos os consumidores. Nunca quebrar sessão compartilhada. Mesas (refeito) e glossário consomem este serviço central.

## 4. Roteamento — subdomínio-por-módulo (D017)
**Sem gateway de path.** Cada módulo é um host:
| Subdomínio | Módulo | Auth |
|---|---|---|
| `artificiorpg.com` (raiz) | `site` (blog/portal, Astro SSG — spec 029, `53e5870`) | público |
| `beta.artificiorpg.com` | `site` (staging/testes — noindex via X-Robots-Tag, spec 030) | público |
| `glossario.artificiorpg.com` | `glossario` (prod canônico; `glossariorpg.` foi alias histórico desativado) | opcional |
| `mesas.artificiorpg.com` | `mesas` (refeito) | sim |
| `downloads.artificiorpg.com` | `downloads` | opcional |
| `esferas.artificiorpg.com` | `esferas` (Spheres of Power, multi-sistema) | público |
| `srd.artificiorpg.com` | `srd` | público |
| `links.artificiorpg.com` | `links` | público |
| `accounts.artificiorpg.com` | SSO central | — |

- **`artificiorpg.com` (raiz):** serve o site novo (Astro SSG) desde a spec 029. O WordPress da Hostinger está desligado da raiz (D075); o flip foi por redirect interno Cloudflare, não o cutover DNS cerimonial do Gate C (adiado).
- **`beta.artificiorpg.com`:** staging isolado do site (spec 030), com `noindex` (X-Robots-Tag) e `PUBLIC_SITE_URL=beta.artificiorpg.com` (canonical/OG/sitemap próprios, sem duplicar SEO da raiz).
- **Todo app tem beta próprio:** `mesasbeta.artificiorpg.com`, `glossariobeta.artificiorpg.com` etc. Site beta usa `beta.artificiorpg.com` (nome curto herdado da era pré-cutover).
- **Cloudflare Tunnel**: um `cloudflared`, várias regras de ingress `hostname → container:port`. Nada de porta exposta. Cert wildcard `*.artificiorpg.com`.
- **Contrato Real IP (D069/spec 023):** o unico caminho publico confiavel e `Cloudflare Tunnel -> cloudflared -> artificio_net -> app`. `artificio_net` verificada em 2026-06-15 como `172.18.0.0/16`.
  - Apps com nginx (`mesas`, `glossario`): `set_real_ip_from ${TRUSTED_REAL_IP_FROM}` (default `172.18.0.0/16`) + `real_ip_header CF-Connecting-IP`; repassar `X-Real-IP` e `X-Forwarded-For` como `$remote_addr`, nunca `$http_cf_connecting_ip` cru nem `$proxy_add_x_forwarded_for`.
  - Apps Express, diretos ou atras de nginx (`accounts`, `site`, backends de `mesas`/`glossario`): `app.set("trust proxy", TRUSTED_PROXY_CIDR)` com default `172.18.0.0/16`, nunca `trust proxy = 1` como regra duravel.
  - Motivo: rate-limit/logs devem usar o IP do visitante validado; header de visitante so e aceito quando o hop anterior e o proxy interno confiavel.
- Cada app roda no próprio root `/` (Vite `base: '/'`, sem React Router basename). API do módulo sob `/api/...` do próprio host.
- Nav entre módulos = URLs absolutas (de `packages/ui`), com destaque do módulo atual.
- Nenhum host hardcoded fora de env/config (permite trocar domínio/host sem refactor).

## 5. Banco de dados
- Postgres 16. **Isolamento lógico por módulo**: schema/banco próprio por módulo. O único cross-cutting é `users`/sessão (de `auth`).
- Migrations por módulo, versionadas; nunca `DROP/TRUNCATE/ALTER` em prod sem dump + checklist (ver AGENTS).
- Acesso DB da VM por linha de comando local/PowerShell via `ssh faren` = read-only padrão.
- Tabelas do `site`: `posts, pages, categories, tags, media, redirects`.

## 6. Conteúdo / SEO / SSG (`packages/content` + `apps/site`)
- **SSG**: conteúdo do Postgres → HTML estático no build/deploy. Rebuild incremental disparado pelo admin ao salvar (Turbo rebuilda só o afetado). Sem servidor de render runtime para o blog.
- Por página: `<title>`, meta description, canonical, OG, Twitter, JSON-LD (Article/Breadcrumb/Org), heading hierárquico, alt, lang.
- **Subdomínio (D017/D019):** blog (aposta de SEO) na **raiz** `artificiorpg.com`; módulos-ferramenta em subdomínio rankeiam por mérito próprio. Cada módulo serve seu `/sitemap.xml` e `robots.txt`; RSS no blog.
- **Search Console:** 1 **Domain property** (`artificiorpg.com`) cobre todos os subdomínios (D020).
- **GA4:** 1 property, `cookie_domain: 'artificiorpg.com'` + lista de exclusão de referral interno (mede sessão cross-subdomínio como uma só). Stream/dimension por módulo (`analyticsNamespace`).
- **301**: `redirects` (permalink WP → novo). Nenhuma rota legada vira 404. Slugs preservados.
- Validar com `seo-usability-auditor` antes de promover.

## 7. CI/CD / Deploy
- GitHub Actions: `ci.yml` (lint+build+test via Turbo). Deploy via `deploy.yml` (matrix a partir de `deploy-manifest.json`) → `_deploy-module.yml` (reusável por módulo).
- **`deploy-manifest.json`** = fonte única declarativa: `module`, `env_override`, `compose_file`/`_beta`, `compose_project`/`_beta`, `db_service`/`_beta`, `db_name`/`_beta`, `health_containers`, `critical_routes`/`_beta`, `auto_deploy_on_push`, `push_branches`, `deploy_paths`, `reconcile_same_project_orphans`.
- **Env deriva do ref:** `dev`→beta, `main`→prod (exceto `accounts`: `env_override=prod` fixo). Deploy prod usa `--ref main` (default branch = `dev`, D073).
- **VM:** clone git em `/opt/artificio` (prod) e `/opt/artificio-beta` (beta). `.env` por módulo no disco (`apps/<modulo>/.env` ou `.env.beta`), gitignored, lido pelo deploy via `--env-file`. Secrets GitHub Environment (`production`/`beta`) usados para SSH e CI; vars de runtime do container vêm do `.env` no disco.
- Imagem buildada NA VM (não GHCR). `docker compose --env-file .env up -d --force-recreate`. Build cache prune pós-deploy (`docker builder prune -f`).
- Fluxo: branch `feat/*`/`fix/*` → PR → `dev` (merge) → promote `dev→main` ff (`promote-prod-fast-forward.yml`) → dispatch deploy prod. Push a `dev`/`main` e qualquer ação write na VM = aprovação (AGENTS).
- **Module-level locks:** `flock` shared (deploys concorrentes) + exclusive (manutenção `docker-cleanup.yml`). Snapshot DB pré-deploy + health check + smoke `critical_routes`.

## 8. Engine de crosslink (`packages/crosslink`)
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
- HTML do WP sanitizado (DOMPurify) antes de persistir/renderizar.
- Segredos só em `.env` (gitignored) e secrets do Actions/Cloudflare.
