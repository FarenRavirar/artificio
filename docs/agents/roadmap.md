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
- **D** 🔄 por módulo: deploy técnico → E2E real (login/logout/allowlist) → Opus valida
- **C** ⏸️ cutover DNS raiz + desligar WP — adiado (D016). WP intocável todo o projeto.

## Matriz de módulos (Fase 3 — Gate D cada um)

| Módulo | Subdomínio | Estado | Falta p/ Gate D |
|---|---|---|---|
| `accounts` (SSO) | `accounts.artificiorpg.com` | ✅ no ar (Gate B) | 🔄 redeploy com marca nova (CDX-311); retrofit deploy (CDX-310) |
| `mesas` | `mesas.artificiorpg.com` | 🔄 técnico ✅ + deploy real ✅ (CDX-309E) + login real ✅ | ⬜ E2E **logout** + **allowlist prod**; ⬜ redeploy marca; ⬜ beta `mesasbeta` `deleted_client` (rebuild do main ou aposentar) |
| `glossario` | `glossariorpg.artificiorpg.com` | ⬜ roda em prod fora do monorepo | ⬜ importar código→monorepo, integrar SSO/UI, deploy canônico, smoke |
| `site` (blog) | `beta.artificiorpg.com` (→ raiz futuro) | ⬜ a construir | ⬜ SSG + importador WP one-shot + SEO; maior risco (300+ posts) |
| `downloads` | `downloads.artificiorpg.com` | ⬜ a construir | ⬜ construir + SSO/UI + deploy |
| `esferas` | `esferas.artificiorpg.com` | ⬜ a construir | ⬜ multi-sistema (sistema×edição, D&D 2014/2024, PF futuro, D028) + SSO/UI |
| `srd` | `srd.artificiorpg.com` | ⬜ a construir | ⬜ SRD DnD 5.2.1 + tooltips (depende de `crosslink`) |
| `links` | `links.artificiorpg.com` | ⬜ a integrar | ⬜ localizar host (D027), backup, →monorepo |

## Pacotes compartilhados (`packages/*`)

| Pacote | Função | Status |
|---|---|---|
| `config` | tsconfig/eslint/env | ✅ |
| `auth` | SSO Google + JWT cookie raiz (verifyToken/requireAuth/useSession) | ✅ |
| `ui` | design system (Header/Nav/Footer hub, tokens marca real) | ✅ (marca corrigida CDX-311) |
| `analytics` | GA4 cross-subdomínio (D020) | ⬜ |
| `content` | SEO: meta, sitemap, JSON-LD | ⬜ |
| `crosslink` | tooltips/interreferência SRD↔Esferas | ⬜ |

## Infra / CI-CD

| Item | Status |
|---|---|
| Backup off-VM validado | ✅ (Gate A) |
| VM `/opt/artificio` = clone git, deploy key read-only | ✅ (CDX-309D) |
| `_deploy-module.yml` reusável (build/test→snapshot→migrations→health→smoke→rollback) | ✅ |
| `deploy-mesas.yml` (dispatch mode=deploy) | ✅ (CDX-309E) |
| `deploy-accounts.yml` → reconciliar ao `_deploy-module.yml` + compose versionado | ⬜ **CDX-310** |
| Rotacionar segredos vazados (tunnel token, PAT, WP creds, senha do 7z) | ⬜ 🔒 |

## Cross-cutting / qualidade

| Item | Status |
|---|---|
| Design system marca real (cores/logo/footer/login) | ✅ CDX-311 / D040 |
| Spec **auditoria visual cross-módulo** (dedicada, token-eficiente; gate antes de promover páginas) | ⬜ criar c/ `/new-spec`; base = `seo-usability-auditor` |
| SEO técnico (Search Console Domain property + GA4 cross, D019/D020) | ⬜ |
| Dívida D037: open-redirect `return` → allowlist `.artificiorpg.com` | ⬜ confirmar em prod |
| Acessibilidade AA (contraste) por módulo | 🔄 (mesas botões OK; auditar resto) |

## Histórico de CDX
301–306 Fase 2 (monorepo+SSO) ✅ · 307 design system (D038) ✅ · 308A/B/C mesas (import/integra/deploy técnico) ✅ · 309B/C/D/E CI-CD + 1º deploy real ✅ · 310 retrofit accounts ⬜ · **311 marca real + footer hub + nome ✅ (local, aguarda deploy)**

## Ordem sugerida (Fase 3)
1. **Fechar Gate D mesas** (E2E logout/allowlist) + redeploy marca + resolver beta.
2. **CDX-310** (retrofit accounts) — durabiliza deploy do SSO.
3. **Spec auditoria visual** — gate de consistência antes de escalar módulos.
4. **glossario** → monorepo (já existe, menor risco; valida o playbook `add-module`).
5. **site/blog** + importador WP (maior risco/valor; puxa `content`+`analytics`).
6. **downloads** · **esferas** · **srd** (+`crosslink`) · **links**.
7. (futuro/⏸️) Gate C — cutover raiz + desligar WP.
