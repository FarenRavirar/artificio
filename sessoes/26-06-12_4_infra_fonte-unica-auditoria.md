# Sessao 26-06-12_4 — D-INFRA2: auditoria de fonte unica compartilhada

- **Data:** 2026-06-12
- **Tipo:** investigacao/spec SDD Completo (sem implementacao)
- **Modulo/Pacote:** monorepo inteiro (`apps/*`, `packages/*`, `.github`, scripts, docs tecnicos relevantes)
- **Gate relacionado:** nenhum. Gate C/WP raiz/DNS/VM/deploy/producao fora de escopo.
- **Spec vinculada:** `specs/019-infra-fonte-unica-auditoria/`
- **Estado:** concluida (investigacao/spec; sem implementacao)

## Objetivo
Investigar o debito **D-INFRA2** registrado em `sessoes/26-06-12_2_debitos_ux-marca.md`: duplicacoes e candidatos a fonte unica importavel em `packages/*`, seguindo D062. Organizar inventario detalhado em spec SDD, sem alterar codigo funcional.

## Escopo
- Auditoria read-only no monorepo.
- Criar/organizar spec 019 com achados, classificacao, riscos, prioridades e backlog.
- Registrar evidencias de busca nesta sessao.
- Nao implementar refatoracao, nao mover arquivos, nao alterar contratos.

## Fora de escopo / proibido nesta sessao
- Gate C, WordPress raiz, DNS, Cloudflare Tunnel, VM Oracle, deploy ou producao.
- `git commit`, `git push`, merge, workflow dispatch.
- Migracoes, banco, secrets, alteracao de auth/SSO.
- Mudanca funcional em `apps/*` ou `packages/*`.

## Arquivos a consultar
- T0: `.specify/memory/project-state.md`, `docs/agents/context-capsule.md`, `.specify/memory/decisions.md`.
- Backlog: `sessoes/index.md`, `sessoes/26-06-12_2_debitos_ux-marca.md`.
- Padrao recente: `specs/017-ui-shared-marca-ux/`, `specs/018-ui-terminologia-projetos/`.
- Codigo alvo: `apps/*`, `packages/*`, `.github/workflows`, `scripts`, `docker-compose*`, configs/env examples.

## Plano
- [x] Retomada minima T0 + backlog + specs 017/018.
- [x] Criar sessao e spec 019.
- [x] Fazer auditoria read-only por categoria.
- [x] Preencher inventario detalhado na spec 019.
- [x] Separar candidatos fortes, decisoes pendentes, duplicacoes legitimas e riscos.
- [x] Atualizar sessao com evidencias e status final.
- [x] Informar `git status` final.

## Criterios de conclusao
- Spec 019 criada com `spec.md`, `plan.md`, `tasks.md`.
- Inventario detalhado com IDs, arquivos/linhas, tipo, duplicacao, fonte unica candidata, consumidores, risco, beneficio, SDD, prioridade e encaminhamento.
- Evidencias de busca registradas.
- Nenhuma alteracao de codigo funcional.
- Nenhum commit/push.
- Proximo passo recomendado claro.

## Evidencias de busca
- T0 lido: `.specify/memory/project-state.md`, `docs/agents/context-capsule.md`, `.specify/memory/decisions.md`.
- Backlog lido: `sessoes/index.md`, `sessoes/26-06-12_2_debitos_ux-marca.md`.
- Padrao recente lido: `specs/017-ui-shared-marca-ux/{spec,plan,tasks}.md`, `specs/018-ui-terminologia-projetos/{spec,plan,tasks}.md`.
- Arquivos listados via `rg --files apps packages .github scripts --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/.turbo/**'`.
- Assets/brand: `rg -n -S "favicon|brandLogo|data:image|Logo|logo" apps packages ...`; trechos lidos em `packages/ui/src/brand.ts`, `apps/site/src/data/brand.json`, `apps/site/scripts/prep-fixtures.mjs`.
- Tema/shell: `rg -n -S "artificio_theme|data-theme|ThemeToggle|ThemeIcon|applyTheme|setTheme|theme-toggle|Tema claro|Tema escuro|dark|light" ...`; trechos lidos em `packages/ui/src/theme.tsx`, `apps/accounts/frontend/src/main.tsx`, `SiteHeader.astro`, `SiteFooter.astro`, `GlossarioHeader.tsx`, `AppShell.tsx`.
- Auth/fetch/session: trechos lidos em `packages/auth/src/client.ts`, `apps/site-admin/src/api.ts`, `apps/glossario/frontend/src/services/api.ts`, `apps/mesas/frontend/src/utils/authenticatedFetch.ts`, `apps/mesas/frontend/src/utils/auth.ts`, `apps/accounts/src/app.ts`, `apps/mesas/backend/src/routes/auth.ts`.
- Config/domains/SEO: `rg -n -S "https://[a-zA-Z0-9.-]*artificiorpg\\.com|artificiorpg\\.com|VITE_ACCOUNTS_URL|ACCOUNTS_ORIGIN|PORTAL_URL|FRONTEND_URL|PUBLIC_SITE_URL|SITE_URL" apps packages .github scripts ...`; trechos lidos em `packages/ui/src/modules.ts`, `apps/site/src/lib/content.ts`, `packages/content/src/site.ts`, `packages/config/src/*`, `apps/mesas/module.manifest.ts`.
- Analytics: `rg -n -S "gtag\\(|trackEvent|trackPageview|GA4|PUBLIC_GA_ID|VITE_GA|Google Analytics|analytics" apps packages ...`; trechos lidos em `packages/analytics/src/*`, `apps/glossario/frontend/index.html`, `apps/glossario/frontend/src/utils/analytics.ts`, `apps/mesas/frontend/src/services/analytics.ts`.
- Normalizers/guards: `rg -n -S "Array\\.isArray|JSON\\.parse|safeParse|normalize[A-Z]|sanitize|unknown|localStorage|getItem|as .*\\[\\]|\\.map\\(" apps packages ...`; trechos lidos em `apps/site/db/export.ts`, `apps/site/src/lib/content.ts`, `apps/site-admin/src/api.ts`, `SystemSuggestionResolutionDrawer.tsx`.
- Deploy/scripts: trechos lidos em `.github/workflows/_deploy-module.yml`, `deploy-accounts.yml`, `deploy-mesas.yml`, `scripts/deploy/apply_required_migrations.sh`, `apps/mesas/scripts/deploy/apply_required_migrations.sh`.
- CSS/copy: `rg -n -S "#[0-9A-Fa-f]{6}|--artificio|#ff9457|#E8521A|#020740|#1B2A4A" ...` e `rg -n -S "Gratuito|sem anúncios|sem coleta|presente da Artifício|Hub de projetos|Login único|Entrar com Google|Projetos do Artifício|Artifício RPG" ...`.
- Complemento do mantenedor: incluir na mesma spec a unificacao visual. Evidencias lidas: `apps/glossario/frontend/src/index.css:21-31` (base de cores do glossario), `apps/glossario/frontend/src/components/GlossarioHeader.tsx:10-122` (nav/base de composicao), `apps/mesas/frontend/src/components/HeaderActions.tsx:9-58`, `NotificationBell.tsx:21-200`, `ChangelogModal.tsx:145-230` (estilo mesas para notificacao/changelog).
- Complemento adicional: auditar cores e estrutura de paginas. Evidencias lidas: `apps/glossario/frontend/src/App.tsx:113-149`, `AdminActivityPage.tsx:130-153`, `NotificationsPage.tsx:226-340`, `ProfilePage.tsx:30-78`; `apps/mesas/frontend/src/components/AppShell.tsx:31-44`, `HomePage.tsx:53-208`, `CatalogoPage.tsx:271-379` e `430-522`, `ProfileEditPage.css:1-176`; `apps/site/src/styles/global.css:47-190`; `apps/accounts/frontend/src/styles.css:46-93`; `apps/site-admin/src/App.tsx:10-33`, `styles.css:14-63`; `packages/ui/src/tokens.ts:11-24`; `packages/ui/tailwind-preset.js:7-18`.

## Resultado
- Spec 019 criada em `specs/019-infra-fonte-unica-auditoria/`.
- Inventario com 21 achados em `specs/019-infra-fonte-unica-auditoria/plan.md`.
- Backlog recomendado em ordem no `plan.md` e resumido em `tasks.md`.
- Nenhuma mudanca funcional em codigo.
- Nenhum commit/push/deploy/VM/DNS/WP.
- Proximo passo recomendado: **Spec 020 — UI visual unificado**: usar cores do glossario como base, mapear estrutura de paginas/templates, nav base do glossario, estilo mesas para notificacao/changelog, e lua/sol canonico via `@artificio/ui/theme`. Antes de implementar, registrar decisao formal de cor/marca se ela superar D040.

## Git status final
```text
M .specify/memory/project-state.md
M docs/agents/context-capsule.md
M sessoes/26-06-12_2_debitos_ux-marca.md
M sessoes/26-06-12_3_ui-marca_debitos-exec.md
M sessoes/index.md
M specs/017-ui-shared-marca-ux/plan.md
M specs/017-ui-shared-marca-ux/spec.md
M specs/017-ui-shared-marca-ux/tasks.md
M specs/018-ui-terminologia-projetos/plan.md
M specs/018-ui-terminologia-projetos/tasks.md
?? sessoes/26-06-12_4_infra_fonte-unica-auditoria.md
?? specs/019-infra-fonte-unica-auditoria/
```

Observacao: varios arquivos ja estavam modificados antes desta investigacao (estado herdado das specs 017/018). Nesta sessao foram criados/alterados apenas docs de sessao/spec 019, `sessoes/index.md` e a nota minima em `.specify/memory/project-state.md`.

## Fechamento
Concluido. Investigacao read-only feita, spec 019 organizada, sem implementacao.
