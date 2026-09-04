# Roadmap — Artifício RPG (mapa completo até conclusão)

> Matriz viva das etapas do projeto. Marca onde estamos e o que falta até concluir.
> Atualizar status ao avançar. Detalhe operacional fica em `project-state.md`; aqui é o mapa macro.
> Atualizado: 2026-07-08.
> Legenda: ✅ concluído · 🔄 em andamento · ⬜ pendente · ⏸️ adiado (fora do escopo ~3 meses) · 🔒 ação do mantenedor.

## Fases

| Fase | Escopo | Gate | Status |
|---|---|---|---|
| **0 — Governança** | specs/skills/agentes/caveman, gates, decisions append-only, economia de contexto | — | ✅ |
| **1 — Infra/VM** | recriar VM Oracle limpa (`<DOCKER_NET>`, tunnel próprio, sem telegram), restaurar glossário+mesas, backup off-VM | **A** ✅ | ✅ |
| **2 — Monorepo + SSO** | pnpm+Turbo, `packages/{config,auth,ui}`, `apps/accounts` (SSO Google/JWT cookie raiz), CI/CD canônico, VM=clone git | **B** ✅ | ✅ |
| **3 — Módulos + conteúdo** | integrar/construir cada módulo (Gate D por módulo), importar WP→site, SEO, analytics, design consistente | **D** (por módulo) | ✅ (todos os 5 apps em prod, 2026-06-21) |
| **4 — Cutover (futuro)** | apontar raiz `artificiorpg.com` ao site novo + desligar WP | **C** ⏸️ | ⏸️ (fora ~3 meses, D016) |

## Gates
- **A** ✅ backups validados off-VM (D031) · **B** ✅ SSO no ar + cross-subdomínio (D037)
- **D** ✅ mesas (2026-06-08), glossario (2026-06-12), site (2026-06-18), links (2026-06-21). `downloads`/`esferas`/`srd` = futuro.
- **C** ⏸️ cutover DNS raiz + desligar WP — adiado (D016). Site já serve raiz `artificiorpg.com` via Cloudflare sem cutover cerimonial. WP desligado (D074), migração concluída, residual zero.

## Matriz de módulos (Fase 3 — Gate D cada um)

| Módulo | Subdomínio | Estado | Falta p/ Gate D |
|---|---|---|---|
| `accounts` (SSO) | `accounts.artificiorpg.com` | ✅ no ar (Gate B) + marca CDX-311 ✅ no ar + CDX-310 ✅ (retrofit deploy) | — |
| `mesas` | `mesas.artificiorpg.com` | ✅ Gate D fechado: técnico ✅ + deploy real ✅ (CDX-309E) + login real ✅ + allowlist prod ✅ + marca CDX-311 ✅ no ar | Pendência isolada fora do Gate D: hydrate beta precisa `PROD_DB_URL` + restart autorizado |
| `glossario` | `glossario.artificiorpg.com` (PROD) / `glossariobeta.` (BETA) | ✅ em prod (Gate D fechado 2026-06-12). Spec 012 fechada; SSO+compat mergeado; spec 015 fechada. | — |
| `site` (blog) | `artificiorpg.com` (PROD, raiz) / `beta.artificiorpg.com` (BETA) | ✅ em prod na raiz (Gate D fechado 2026-06-18). Astro SSG (spec 029/030/031). Migração WP→site concluída (D074), residual zero. | — |
| `downloads` | `downloads.artificiorpg.com` | 🔄 spec 061: investigação/definição, sem código | ⬜ produto/políticas/taxonomia/UX → arquitetura/segurança → infra → backend → moderação → frontend → beta → Gate D |
| `esferas` | `esferas.artificiorpg.com` | ⬜ a construir | ⬜ multi-sistema (sistema×edição, D&D 2014/2024, PF futuro, D028) + SSO/UI |
| `srd` | `srd.artificiorpg.com` | ⬜ a construir | ⬜ SRD DnD 5.2.1 + tooltips (depende de `crosslink`) |
| `links` | `links.artificiorpg.com` + `regras.artificiorpg.com` | ✅ em prod (Gate D fechado 2026-06-21). Spec 038 completa: logos 12/13 reidratados, report público, cron VM. Shell spec 041 em prod. | — |

## Pacotes compartilhados (`packages/*`)

| Pacote | Função | Status |
|---|---|---|
| `config` | tsconfig/eslint/env | ✅ |
| `auth` | SSO Google + JWT cookie raiz (verifyToken/requireAuth/useSession) | ✅ |
| `ui` | design system (Header/Nav/Footer hub, tokens marca real) | ✅ (marca corrigida CDX-311) |
| `analytics` | GA4 cross-subdomínio (D020) | ✅ (spec 008 F6; gated PUBLIC_GA_ID; 3/3 testes; no site) |
| `content` | SEO: meta, sitemap, JSON-LD, robots | ✅ (spec 008 F5; usado no site; 6/6 testes) |
| `media` | Upload Cloudinary + biblioteca de mídia | ✅ (spec 038; usado em links+site) |
| `changelog` | Changelog cross-app em JSON + modal | ✅ (spec 041; build dual ESM+CJS; 5 consumidores) |
| `feedback` | Feedback/reportar cross-app | ✅ (integrado ao shell spec 041) |
| `crosslink` | tooltips/interreferência SRD↔Esferas | ⬜ |

## Infra / CI-CD

| Item | Status |
|---|---|
| Backup off-VM validado | ✅ (Gate A) |
| VM `<CLONE_PROD>` = clone git, deploy key read-only | ✅ (CDX-309D) |
| `_deploy-module.yml` reusável (build/test→snapshot→migrations→health→smoke→rollback) | ✅ |
| `deploy-mesas.yml` (dispatch mode=deploy) | ✅ (CDX-309E) |
| `deploy-accounts.yml` → reconciliado ao `_deploy-module.yml` + compose versionado | ✅ **CDX-310** |
| Esteira beta genérica (`dev`→beta, `main`→prod, invariante `main ⊆ dev`, `env=beta\|prod`) | ✅ **spec 005 / D041** em uso — T2 branch protection bloqueada por GitHub privado sem Pro; compensação ativa = gate `main ⊆ dev` + alarme. Única pendência isolada: hydrate precisa `PROD_DB_URL` no beta (segredo/restart do mantenedor). |
| Docker cleanup semanal + lock RW VM-wide | ✅ **D055/D056** — cron no monorepo em `main`, 1º run verde (`27097763454`), deploys pegam lock shared, cleanup pega exclusive; workflow legado do mesas desativado em `dev`. |
| Rotacionar segredos vazados (tunnel token, PAT, WP creds, senha do 7z) | ⬜ 🔒 |

## Cross-cutting / qualidade

| Item | Status |
|---|---|
| Spec **041 — Shell unificado cross-app** (Header/Footer/Nav, busca/changelog/tema) | ✅ **EM PROD** (2026-06-21); 5 apps consumindo |
| Spec **054 — Sidebar IA + roteamento aninhado /gestao** (mesas) | ✅ **ENCERRADA e em PROD** (2026-06-30) |
| Spec **055 — API governance** (inventory/consumers/lint/check/diff/bundle/MCP) | ✅ **ENCERRADA** (2026-06-28); CI required check ativo |
| Spec **056 — Moderação batch + logs** (mesas) | ✅ **ENCERRADA e em PROD** (2026-06-29) |
| Design system marca real (cores/logo/footer/login) | ✅ CDX-311 / D040 |
| Spec **auditoria visual cross-módulo** (dedicada, token-eficiente; gate antes de promover páginas) | ⬜ criar c/ `/new-spec`; base = `seo-usability-auditor` |
| SEO técnico (Search Console Domain property + GA4 cross, D019/D020) | ⬜ |
| Dívida D037: open-redirect `return` → allowlist `.artificiorpg.com` | ✅ confirmada em prod (`evil.com` sanitizado; `mesas.` preservado) |
| Acessibilidade AA (contraste) por módulo | 🔄 (mesas botões OK; auditar resto) |

## Histórico de CDX
301–306 Fase 2 (monorepo+SSO) ✅ · 307 design system (D038) ✅ · 308A/B/C mesas (import/integra/deploy técnico) ✅ · 309B/C/D/E CI-CD + 1º deploy real ✅ · 310 retrofit accounts ✅ · **311 marca real + footer hub + nome ✅ (D040/D064, em prod)**

## Próximos passos (pós-Fase 3)

1. **Spec auditoria visual cross-módulo** — gate de consistência antes de escalar.
2. **downloads** — spec 061 em investigação/definição; depois specs filhas ordenadas (produto → dados/UX → arquitetura → infra → implementação → beta/Gate D).
3. **esferas** · **srd** (+`crosslink`).
4. ⏸️ **Gate C** — cutover raiz + desligar WP (adiado, D016).
