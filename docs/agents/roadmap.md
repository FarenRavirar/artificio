# Roadmap — Artifício RPG (mapa completo até conclusão)

> Matriz viva das etapas do projeto. Marca onde estamos e o que falta até concluir.
> Atualizar status ao avançar. Detalhe operacional fica em `project-state.md`; aqui é o mapa macro.
> Legenda: ✅ concluído · 🔄 em andamento · ⬜ pendente · ⏸️ adiado (fora do escopo ~3 meses) · 🔒 ação do mantenedor.

## Fases

| Fase | Escopo | Gate | Status |
|---|---|---|---|
| **0 — Governança** | specs/skills/agentes/caveman, gates, decisions append-only, economia de contexto | — | ✅ |
| **1 — Infra/VM** | recriar VM Oracle limpa (`artificio_net`, tunnel próprio, sem telegram), restaurar glossário+mesas, backup off-VM | **A** ✅ | ✅ |
| **2 — Monorepo + SSO** | pnpm+Turbo, `packages/{config,auth,ui}`, `apps/accounts` (SSO Google/JWT cookie raiz), CI/CD canônico, VM=clone git | **B** ✅ | ✅ |
| **3 — Módulos + conteúdo** | integrar/construir cada módulo (Gate D por módulo), importar WP→site, SEO, analytics, design consistente | **D** (por módulo) | 🔄 |
| **4 — Cutover (futuro)** | apontar raiz `artificiorpg.com` ao site novo + desligar WP | **C** ⏸️ | ⏸️ (fora ~3 meses, D016) |

## Gates
- **A** ✅ backups validados off-VM (D031) · **B** ✅ SSO no ar + cross-subdomínio (D037)
- **D** 🔄 por módulo: deploy técnico → E2E real (login/logout/allowlist) → Opus valida. `mesas` ✅.
- **C** ⏸️ cutover DNS raiz + desligar WP — adiado (D016). WP intocável todo o projeto.

## Matriz de módulos (Fase 3 — Gate D cada um)

| Módulo | Subdomínio | Estado | Falta p/ Gate D |
|---|---|---|---|
| `accounts` (SSO) | `accounts.artificiorpg.com` | ✅ no ar (Gate B) + marca CDX-311 ✅ no ar | ⬜ retrofit deploy (CDX-310) |
| `mesas` | `mesas.artificiorpg.com` | ✅ Gate D fechado: técnico ✅ + deploy real ✅ (CDX-309E) + login real ✅ + allowlist prod ✅ + marca CDX-311 ✅ no ar | Pendência isolada fora do Gate D: hydrate beta precisa `PROD_DB_URL` + restart autorizado |
| `glossario` | `glossario.artificiorpg.com` (PROD, no ar) / `glossariobeta.` (BETA) | 🔄 **spec 015 T7 beta** — spec 012 fechada; SSO+compat mergeado em `dev` por PR #16/#17; deploy beta bloqueado por runtime Docker workspace deps; fix local pronto (`NODE_PATH` + review security/UX), validação local 14/14 + builds OK | ⬜ Publicar fix → PR `dev` → rerun `deploy-glossario` beta → smoke T7; depois T8 sessão cross-módulo e T9 prod/Gate D. Isolado: desativar workflows do repo legado |
| `site` (blog) | **`beta.artificiorpg.com` NO AR** (→ raiz futuro) | 🔄 **spec 008** F1–F7 ✅ + **spec 010** ✅ (nav cross-módulo unificado + fix logo) no ar nos betas | ⬜ **spec 011 — CMS/authoring (paridade WordPress):** editor de posts/categorias, slug+sugestão, OG, mídia (img/áudio/vídeo), snippets, drafts/arquivar, resumos, usuários editores/roles. ⬜ Gate D final; auto-deploy push-dev; opc Cloudinary/GA reais. WP intocável (cutover=Gate C) |
| `downloads` | `downloads.artificiorpg.com` | ⬜ a construir | ⬜ construir + SSO/UI + deploy |
| `esferas` | `esferas.artificiorpg.com` | ⬜ a construir | ⬜ multi-sistema (sistema×edição, D&D 2014/2024, PF futuro, D028) + SSO/UI |
| `srd` | `srd.artificiorpg.com` | ⬜ a construir | ⬜ SRD DnD 5.2.1 + tooltips (depende de `crosslink`) |
| `links` | `links.artificiorpg.com` + `regras.artificiorpg.com` | ⬜ fora do ar desde a migração | ⬜ **spec 013** (localizar artefato D027 → `apps/links` → tunnel) + **spec 014** (nav "WhatsApp" em `packages/ui`+site) |

## Pacotes compartilhados (`packages/*`)

| Pacote | Função | Status |
|---|---|---|
| `config` | tsconfig/eslint/env | ✅ |
| `auth` | SSO Google + JWT cookie raiz (verifyToken/requireAuth/useSession) | ✅ |
| `ui` | design system (Header/Nav/Footer hub, tokens marca real) | ✅ (marca corrigida CDX-311) |
| `analytics` | GA4 cross-subdomínio (D020) | ✅ (spec 008 F6; gated PUBLIC_GA_ID; 3/3 testes; no site) |
| `content` | SEO: meta, sitemap, JSON-LD, robots | ✅ (spec 008 F5; usado no site; 6/6 testes) |
| `crosslink` | tooltips/interreferência SRD↔Esferas | ⬜ |

## Infra / CI-CD

| Item | Status |
|---|---|
| Backup off-VM validado | ✅ (Gate A) |
| VM `/opt/artificio` = clone git, deploy key read-only | ✅ (CDX-309D) |
| `_deploy-module.yml` reusável (build/test→snapshot→migrations→health→smoke→rollback) | ✅ |
| `deploy-mesas.yml` (dispatch mode=deploy) | ✅ (CDX-309E) |
| `deploy-accounts.yml` → reconciliar ao `_deploy-module.yml` + compose versionado | ⬜ **CDX-310** |
| Esteira beta genérica (`dev`→beta, `main`→prod, invariante `main ⊆ dev`, `env=beta\|prod`) | ✅ **spec 005 / D041** em uso — T2 branch protection bloqueada por GitHub privado sem Pro; compensação ativa = gate `main ⊆ dev` + alarme. Única pendência isolada: hydrate precisa `PROD_DB_URL` no beta (segredo/restart do mantenedor). |
| Docker cleanup semanal + lock RW VM-wide | ✅ **D055/D056** — cron no monorepo em `main`, 1º run verde (`27097763454`), deploys pegam lock shared, cleanup pega exclusive; workflow legado do mesas desativado em `dev`. |
| Rotacionar segredos vazados (tunnel token, PAT, WP creds, senha do 7z) | ⬜ 🔒 |

## Cross-cutting / qualidade

| Item | Status |
|---|---|
| Design system marca real (cores/logo/footer/login) | ✅ CDX-311 / D040 |
| Spec **auditoria visual cross-módulo** (dedicada, token-eficiente; gate antes de promover páginas) | ⬜ criar c/ `/new-spec`; base = `seo-usability-auditor` |
| SEO técnico (Search Console Domain property + GA4 cross, D019/D020) | ⬜ |
| Dívida D037: open-redirect `return` → allowlist `.artificiorpg.com` | ✅ confirmada em prod (`evil.com` sanitizado; `mesas.` preservado) |
| Acessibilidade AA (contraste) por módulo | 🔄 (mesas botões OK; auditar resto) |

## Histórico de CDX
301–306 Fase 2 (monorepo+SSO) ✅ · 307 design system (D038) ✅ · 308A/B/C mesas (import/integra/deploy técnico) ✅ · 309B/C/D/E CI-CD + 1º deploy real ✅ · 310 retrofit accounts ⬜ · **311 marca real + footer hub + nome ✅ (local, aguarda deploy)**

## Ordem sugerida (Fase 3)
1. **Spec 011 / site CMS** — T16/T17 fechados; refino UX (editor light + SEO Yoast) + fix de sessão SSO live. **Fase 2 mídia (T18 backend + T19 UI) deployada no beta** (`e5ee84e`): biblioteca + upload Cloudinary + picker no editor (bulk WP→Cloudinary = opt-in). **Próximo: T20 (CRUD taxonomias)** fecha Fase 2 → Fase 3 (dashboard/curadoria/nav/redirects). E2E de mídia no beta = mantenedor.
2. **CDX-310** (retrofit accounts) — durabiliza deploy do SSO.
3. **Spec auditoria visual** — gate de consistência antes de escalar módulos.
4. **glossario** → monorepo ✅ fechado (spec 012, no ar PROD+BETA); spec 015 em T7 beta (SSO+compat já em `dev`; falta fix runtime/review + redeploy beta, T8, T9) p/ Gate D.
5. **site/blog** continua por fases de CMS/autoria (mídia, curadoria, roles) antes do Gate D final.
6. **downloads** · **esferas** · **srd** (+`crosslink`) · **links**.
7. (futuro/⏸️) Gate C — cutover raiz + desligar WP.
