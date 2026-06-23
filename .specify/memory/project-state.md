# Estado do Projeto — Artifício RPG

> Atualizar a cada mudança de estado operacional. Fonte de verdade do "onde estamos".
> Histórico detalhado em `sessoes/` e `specs/`. Este arquivo é **sumário operacional**, não diário.

## Fase atual

**Fase 3 — projetos + conteúdo.** Gates A/B ✅; mesas, glossario e site com Gate D fechado. Site em `artificiorpg.com` (Astro SSG, spec 029/030/031). `beta.artificiorpg.com` = staging. WP desligado da raiz; DNS raiz intocado (Gate C adiado). Migração WP→site concluída (D074, residual zero).

**Todos os 5 apps em prod** (2026-06-21). Último promote `dev→main`: PR #85 (`c269a46`). Containers healthy. `dev` ~11 commits à frente (`d2262a0`).

**PRs:** PR #73 (dependabot) **merged** em `dev` (`09773fc`, 2026-06-22). PR #80 **(spec 041 shell)** mergeada. Corrigido via **PR #82**. **PR #83 (spec 042)** mergeada. **PR #84 (spec 043)** mergeada em `dev` (`39d2c7c`). **PR #85 (spec 045)** mergeada + promovida a `main` (`c269a46`). **PR #86 (chore 044/045/ecosystem)** mergeada (`560131f`). **PR #87 (spec 047 fase 1)** mergeada (`d9c3192`). **PR #88 (spec 047 review+SC fixes)** mergeada (`d2262a0`). **Último promote a `main`: PR #85** — `dev` ~11 commits à frente (PR #73, #86, #87, #88). Deploy beta mesas/glossario/site pendente.

## Destaque: Spec 041 — Shell unificado (merge 2026-06-21)
- `packages/ui`: Header com busca/changelog/tema/menu cross-app + `useTheme()`/`useChangelogBadge()` hooks + `<ChangelogModal>` centralizado
- 5 apps consumindo shell único (site Astro híbrido, mesas/glossario/links React, accounts tema)
- `/busca` uniformizada em 4 apps; `/conta` no accounts; `/perfil` renomeado no glossario
- Changelogs padronizados em JSON nos 4 apps (glossario migrado de DB)
- Débitos fechados: `BL-SHELL-B13`, `D-SHELL1`, `BL-UI-THEME-REACT-HEADER-VARIANT`, `BL-UI-THEME-TOGGLE-SITE-REGRESSION`, `BL-GLOSSARIO-CHANGELOG-JSON`
- 19 revisões de bots + 15 Sonar aplicados (17 itens, 2 agrupados); auditoria changelog 53 ✅
- **Pós-merge (PR #82):** deploy beta quebrou — contrato de changelog vivia em `@artificio/ui` (ESM-only), backends CJS (glossário/mesas) não conseguiam `require`. Extraído p/ pacote leaf **`@artificio/changelog`** (build dual ESM+CJS, `exports {import,require}`); `@artificio/ui` re-exporta; backends deixam de depender de UI/React. + fix `turbo.json` (`dist-cjs/**` nos outputs). Detalhe em `tasks-2.md` D-041-22/23, `task-revisões.md` §Pós-#80.
- **PROD (2026-06-21):** glossário, mesas, accounts, links com 041 em prod ✅. Site em beta (raiz `artificiorpg.com` = Gate C, adiado).
- **Spec 041 ENCERRADA.**

## Gates

| Gate | Status | Notas |
|------|--------|-------|
| **A** | ✅ | Backups completos/verificados/off-VM |
| **B** | ✅ | SSO `accounts.` no ar, cross-subdomínio provado |
| **C** | ⏸️ | Cutover DNS raiz — adiado (D016). Site já serve em `artificiorpg.com` por redirect Cloudflare, não pelo cutover cerimonial |
| **D** | ✅ | `mesas` (2026-06-08), `glossario` (2026-06-12), `site` (2026-06-18 via spec 029/030/031) |
| **D-link** | 🟡 | `links.artificiorpg.com` **no ar** (2026-06-21, smoke 200/200/200/401). Spec 038 (mídia/reportar/cron) mergeada em `dev` e promovida a `main`. Rebuild forçado na VM resolveu código ausente no container. Falta: T4 reidratar logos em prod, T13 smoke E2E. `BL-UI-THEME-REACT-HEADER-VARIANT` **fechado** (em prod via spec 041, PR #80/#82). |

## Decisões fechadas (resumo)

- Monorepo único `artificio` (pnpm + Turborepo)
- **Topologia subdomínio-por-projeto** (D017/D057): `glossario.`, `mesas.`, `links.`, `accounts.` (SSO). `artificiorpg.com` = site/blog raiz; `beta.artificiorpg.com` = staging. Futuros: `downloads.`, `esferas.`, `srd.`.
- **SSO central `accounts.artificiorpg.com`** (D018): OAuth Google, 2 cookies JWT `Domain=.artificiorpg.com` (`artificio_session` 15min + `artificio_refresh` 7d), HS256 simétrico
- **Blog na raiz** = aposta SEO (D019). Search Console Domain property + GA4 cross-subdomínio (D020). GA4 canônico = `G-8XN5BGPJP3`
- **Stack canônica:** React19/Vite/Tailwind + Express5/Kysely/PG16/Cloudinary + Astro 6 (site)
- **Infra:** Oracle 24GB/200GB, Docker, Cloudflare Tunnel, Watchtower(beta). Imagem buildada na VM (não GHCR).
- **Backup:** `C:\projetos\artificiobackup` (local, 300GB)
- **Acesso VM:** `ssh faren`, read-only sempre permitido, write exige aprovação nominal
- **Tema lua/sol** compartilhado cross-subdomínio (D067): cookie `artificio_theme`, opt-in explícito
- **Laranja canônico** `#FF5722` (D064), navy `#020740` (D040)
- **Linguagem pública:** "projetos" (D063); "módulo" = termo técnico interno
- **Comunicação agentes:** caveman ultra (D068)
- **Branch protection** `dev` (D073): tudo via PR, check `lint + build + test` obrigatório
- **WP EOL resolvido** (D074): migração concluída, residual zero de conteúdo servido com URL WP

## Construído neste monorepo

**Pacotes compartilhados:** `config`, `auth`, `ui`, `content`, `analytics`, `media`, `changelog`, `feedback`

**Apps:** `accounts` (SSO), `mesas` (anúncios de mesa), `glossario` (termos RPG), `site` + `site-admin` (blog/portal), `links` (WhatsApp, em prod)

**Infra/CI:** `deploy.yml` (manifesto declarativo, 5 módulos), `_deploy-module.yml`, `ci.yml` (lint+build+test gate), `deploy-manifest.json`, `docker-cleanup.yml`, `mesas-auto-archive.yml`, CodeQL, Scorecard, lock RW VM-wide

**Governança:** `AGENTS.md`, `.specify/memory/`, `.specify/arquiteture.md`, `docs/agents/`, `sessoes/`, `specs/`

## Próximo passo (ordem)

1. **Spec 041 — Shell único cross-projeto ✅ EM PROD.** Residual: `SiteFooter.astro` fork (D-041-08).
2. **T4 (spec 038/045)** — Logos links: ✅ **12/13 reidratados em prod** (reconciliado spec 045, 2026-06-22). Resta só decidir "Canal de Notícias" null (spec 045 T3). Nav cross-app ✅ prod (site/glossário/mesas).
4. **T13 (spec 038/045)** — Smoke E2E residual: report ponta-a-ponta + cron VM (`crontab -l`). Logos/nav já ✅. (spec 045 T4)
5. **PR #73 merged ✅** (dependabot, `09773fc`).
6. **`BL-SEC-AUDIT-DEPS` (spec 039)** — branch `fix/039-sec-audit-deps` **pushada** ao origin, **PR não aberto** (aprovação nominal pendente). `xlsx` 2×HIGH residual → spec 034.
7. **Spec 032** (analytics shared adoption)
8. **Spec 025** (Lighthouse residual)
9. **Spec 028** (biblioteca de mídia VM)
10. **Spec 042** — **✅ EM PROD.** cpd: 5.57% → 4.60%.
11. **Spec 043** (auditoria visual links + shared `packages/ui`) — **PR #84 mergeada em `dev` (`39d2c7c`, 2026-06-22).** Fase 1 T5 (logo base64 → PNG estático) completa. `brand.ts` com `import .png?url`, `ambient.d.ts`, build script. `assetsInlineLimit: 0` nos 5 consumidores. 46 arquivos, +6644/-256. CI verde. Próximo: T6 (auditoria Header shared).
12. **Spec 044** (otimizacao ecossistema OpenCode + Claude Code) — ✅ **FECHADA (2026-06-22).**
13. **Spec 045** (débitos pendentes em limbo) — **Investigação concluída + T1 ✅ (2026-06-22, PR #85).**
14. **Spec 047** (mesas inbox importação) — **PR #88 merged (`d2262a0`, 2026-06-23).** **PR #89 merged em `dev` (`b70367c`, 2026-06-23).** Retomada Codex pós-#89 fechou hardenings locais finais: enum Zod no PATCH Inbox/Discord (DEB-047-21) + `DiscordDraftPreview.api` obrigatório sem fallback cruzado (DEB-047-23). Validação local: lint 15/15 ✅, build 17/17 ✅, test 24/24 ✅, backend 21 arquivos/180 testes ✅, frontend 4 arquivos/19 testes ✅. Beta read-only: `/opt/artificio-beta` em `b70367c`, containers mesas beta healthy, migrations 128/129 aplicadas, constraint `single_origin` presente, `/gestao` 200, rotas admin Inbox sem sessão 401. Smoke autenticado T1.13-T1.16 ✅ em 2026-06-23: import único, import múltiplo, edição+sync para `tables.status='draft'`, rejeição de draft. **Não promovido a `main`.**

## Log

- 2026-06-23 — **REV-025 + REV-026 implementados (spec 047).** Helper `toNumberOrNull` + `z.coerce.number()` corrigem confidence string→number. Textarea/banners migrados para tokens semânticos de tema (`--surface`/`--fg`/`--state-*`). Lint 15/15, build 17/17, backend 178 tests ✅.
- 2026-06-23 — **PR #89 (chore/047-debitos-finais).** 9 CodeRabbit reviews (REV-027 a REV-035) investigados e implementados: refatoração useReducer, dirty tracking, normalizador SystemTreeNode, API_BASE compartilhada, acessibilidade radios, guarda synced, reviewNotes fix. Documentação da spec atualizada com contagens e status corretos. Lint 15/15, build 17/17, backend 178 tests ✅, PR checks 33/33 ✅. Pendente merge + redeploy beta + smoke.
- 2026-06-23 — **Spec 047 retomada antes da 048.** DEB-047-21/23 fechados localmente: PATCH Inbox/Discord valida enums de `normalized_payload.table`; `DiscordDraftPreview` exige API injetada e não tem fallback `discordSyncApi`. Gates finais: lint 15/15, build 17/17, test 24/24, backend 21/180, frontend 4/19 ✅. Beta `b70367c` healthy; migrations 128/129 e constraint `single_origin` confirmadas. Smoke autenticado T1.13-T1.16 ✅ via Chrome autorizado: draft único criado; múltiplos anúncios segmentados; draft T1.13 editado e sincronizado para mesa `f4c56c7e-0283-4ed5-a9ae-2ce43255392d` com `status='draft'`; draft T1.14-A rejeitado. Sem auto-publicação.
- 2026-06-21 — **Promote `dev→main` ✅** (run `27894586895`). ~30 commits acumulados promovidos: Node 24 LTS, Vite 8, Tailwind 4, ESLint 10 (spec 033); bump deps (spec 039); PRs #77/#78. Redeploy 5 apps (`27894598616`..`27894601319`) 5/5 ✅. Deploy links `27894598616` — rebuild forçado na VM: código da spec 038 (rehydrate-logos.ts etc.) confirmado no container.
- 2026-06-21 — **Regressão de tema pós-promote.** Site `artificiorpg.com`: toggle dark/light quebrado (só light), nav sem "WhatsApps". Causa: Cloudflare cache servia HTML pré-promote com `Cf-Cache-Status: HIT` + `max-age=7200`. CSP ausente na resposta live vs presente no container confirmou cache antigo. Cache purgado via API (`purge_everything`). **2° bug encontrado:** React `ThemeToggle` (`packages/ui/theme.tsx`) não atualiza `data-variant` no header/footer → nav links/glossario/mesas nunca escurece ao trocar tema. Fix local aplicado (`applyHeaderVariant` integrada em `setTheme`/`applyTheme`). 3 débitos registrados: `BL-UI-THEME-TOGGLE-SITE-REGRESSION`, `BL-UI-THEME-REACT-HEADER-VARIANT`, `D-PROMOTE-033-UPGRADES-REGRESSION`. Sessão: `26-06-21_3_theme-regression.md`.
- 2026-06-21 — **Spec 039 sec-audit-deps executada LOCAL.** `pnpm audit` 16→2. Branch `fix/039-sec-audit-deps` pushada, PR não aberto (aprovação pendente).
- 2026-06-21 — **PR #78 mergeada** (spec 038: mídia Cloudinary + reidratação + reportar + cron). T1-T11 implementados, 20 fixes de review bots, `html-entities` lib. `lint+build+test` ✅. Rebuild manual na VM necessário (deploy `27894335659` usou cache Docker antigo; `27894598616` rebuild forçado resolveu).
- 2026-06-21 — **links.artificiorpg.com NO AR ✅** (smoke VM 200/200/200/401). Resolvido após 3 falhas: (1/2) `.env` corrompido (`\n` literal do PowerShell em `ssh "...$(grep)..."`); (3) senha presa em volume Postgres (`pg_authid` só grava na 1ª init → `28P01`), diagnóstico enganado por `pg_hba` localhost=`trust` → **E009**. Fix: drop volume `links_pgdata_links_prod` (DB vazio) + redeploy (`27891323485`). Roteamento: mantenedor criou public hostname Tunnel (`links-app:4324`) + CNAME proxied. Prevenção E009 em 4 camadas (errors/runbook/capsule/backlog).
- 2026-06-21 — **Deploy prod ✅** (mesas/glossario/site/accounts).
- 2026-06-21 — **Spec 042 mergeada em `dev`** (PR #83, `fa9b787`). 154 arquivos, +7663/-3040. CI verde. 13 revisões de PR resolvidas. Deploy beta mesas/glossario/site disparado. cpd: 5.57% → 4.60% (-411 linhas, -18 clones).
- 2026-06-22 — **Spec 047 (mesas inbox importação) criada.** Auditoria Fase 0 concluída: 17 arquivos lidos, pipeline Discord mapeado (parse→normalize→sync), adaptador mínimo viável (~15 linhas), 3 opções de arquitetura comparadas (recomendada: Opção B+C — rota separada + tabela paralela). `spec.md`, `plan.md`, `tasks.md`, `reviews.md`, `debitos.md` escritos. 7 fases planejadas (MVP: Fase 1). 3 débitos registrados (DEB-047-01/02/03). Backlog README e project-state atualizados. 3 falsos positivos nas auditorias originais (ReportButton, LinksSearch estados erro, CTA target=\_blank) — auditorias atualizadas com seção "Correções pós-investigação". T5: base64 é arquitetural (tsc puro sem bundler), 5 consumidores de brand.ts. T6/T7: 3 consumidores do `<Header>` (links/glossario/mesas). T10 downgrade Major→Minor (M→L esforço). Branch `feat/043-links-visual-audit` criada, todos arquivos staged sem commit. Sessão: `26-06-21_6_links_visual-audit`.
