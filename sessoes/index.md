# Índice de Sessões

Formato: `AA-MM-DD_N_<modulo>_<escopo>.md`. `N` = sequencial do dia. Sessões encerradas vão para `sessoes/encerradas/`.

| Sessão | Data | Módulo | Escopo | Estado |
|---|---|---|---|---|
| `26-06-03_1_infra_backup-runbook` | 2026-06-03 | infra | Backup total (Fase 0, Gate A) | concluída (Gate A ✅) |
| `26-06-04_2_infra_fase1-recriar` | 2026-06-04 | infra | Fase 1: recriar VM limpa (sem telegram) | concluída (Fase 1 ✅) |
| `26-06-04_3_monorepo_fase2-sso` | 2026-06-04 | monorepo | Fase 2: monorepo + SSO (accounts) | aberta |
| `26-06-04_4_mesas_sso-gate-d` | 2026-06-04 | mesas | CDX-308: integrar mesas ao SSO (Gate D) | concluída (Gate D mesas ✅) |
| `26-06-04_5_cicd-deploy-modulos` | 2026-06-04 | CI/CD | CDX-309: deploy canônico por GitHub Actions + VM clone | aberta (CDX-309E ✅; aguardando Opus/Gate D) |
| `26-06-05_1_infra_beta-staging` | 2026-06-05 | infra/CI-CD | Spec 005: esteira beta genérica (dev→beta, main→prod) + D041 | aberta (spec ✅; aguardando Codex T2+) |
| `26-06-05_2_site_foundation` | 2026-06-05 | site | Spec 008: módulo site (portal+blog), fundação + importador WP | aberta (F1 ✅ levantamento/decisão/doc; aguarda exec F2) |
| `26-06-06_1_site_cms-authoring` | 2026-06-06 | site | Spec 011: CMS/autoria nativa (paridade WordPress) | aberta (Fase 0 ✅ D051-D054; backend+SPA admin funcional local; falta OG público/mídia/deploy) |
| `26-06-07_1_infra_docker-cleanup` | 2026-06-07 | infra/CI-CD | Docker cleanup semanal (migra do legado mesas) + lock RW VM-wide | concluída (D055/D056 ✅; main + cleanup + stub legado verdes) |
| `26-06-11_1_glossario-links_specs` | 2026-06-11 | glossario/links/ui | Specs 012–015: glossário→monorepo+`glossario.`, links/regras, nav WhatsApp, SSO compat | concluída (specs criadas; execução em sessões próprias) |
| `26-06-11_2_glossario_monorepo-exec` | 2026-06-11 | glossario | Spec 012: glossário no monorepo + bootstrap beta/prod | concluída (012 ✅ no ar PROD+BETA; E005 DNS/redirect; SSO = spec 015) |
| `26-06-12_1_accounts_login-redesign` | 2026-06-12 | accounts | Correção visual da tela central de login SSO, sem mudar contrato/auth | aberta |
| `26-06-11_3_glossario_sso-compat` | 2026-06-11 | glossario | Spec 015: SSO accounts + compat legado (migração) | concluída (Gate D glossário ✅ prod 2026-06-12; D061) |
| `26-06-12_2_debitos_ux-marca` | 2026-06-12 | accounts/glossario/mesas/site/ui | Backlog de débitos UX/marca/produto: tema, marca, changelogs, arquivar mesas, feedback | parcialmente executada (017/018/019 ✅; D-CONT1 urgente + D-MESAS1/D-FEEDBACK1 futuros) |
| `26-06-12_3_ui-marca_debitos-exec` | 2026-06-12 | accounts/glossario/mesas/site/ui | Execução do backlog UX/marca (D-INFRA1, D-UX3, D-UX2, D-UX1, D-MARCA1) | concluída (017/018 prod ✅; site beta-only) |
| `26-06-12_4_infra_fonte-unica-auditoria` | 2026-06-12 | infra/monorepo | Spec 019: auditoria D-INFRA2 de duplicações/candidatos a fonte única | concluída (spec organizada; sem implementação) |
| `26-06-12_5_ui-theme-artificio-padrao` | 2026-06-12 | ui/packages | Spec 020: Theme Artifício padrão (somente comum: tokens, dark/light, primitives, nav/actions) | concluída (spec montada; sem implementação) |
| `26-06-12_6_ui-theme-020-tokens` | 2026-06-12 | ui/packages + apps | Spec 020 Fase B: D064 laranja `#FF5722` + fonte única de tokens (consumidores puxam `var(--artificio-brand)`) | concluída (commits a48a518+d9c6d8a; betas site/mesas/glossário com #FF5722 verificado; prod intocado) |
| `26-06-12_7_ui-theme-020-dark-readiness` | 2026-06-12 | ui/packages + glossário/mesas | Spec 020 R4/R8: lua/sol (D-UX2) — checklist T4 + escolha de piloto (variante faltante) | aberta (T4 ✅ checklist; diagnóstico de escopo dos 2 pilotos; aguarda decisão piloto+navy antes de codar) |
| `26-06-13_1_ui-theme-020-b6b7-e2e-prod` | 2026-06-13 | glossário/mesas/ui | Spec 020 B6/B7 E2E prod + fixes locais + B10b/B11 tokens | aberta (B6 ✅; B7 publicado em prod via PR #27/#28; falta E2E autenticado do mantenedor) |
| `26-06-14_1_release-prod-feedback-dmesas1-nginx` | 2026-06-14 | glossário/mesas/docs | Release prod: Spec 021 feedback + D-MESAS1 + shell/nginx glossário (D-NGINX1 v2/D-SHELL1b) | concluída (promote+deploy prod verde; D-NGINX1/D-SHELL1b fechados; D-NGINX2 depois fechado pela spec 023) |
| `26-06-15_1_mesas_nginx-realip` | 2026-06-15 | infra/mesas/glossário/accounts/site | Spec 023: contrato Real IP para Cloudflare Tunnel → artificio_net → apps | concluída (prod verde; residual BL-ACCOUNTS-PORT) |
| `26-06-15_2_docs-specs-backlog-audit` | 2026-06-15 | docs/specs | Spec 024: auditoria documental de specs, tasks e backlog | concluída |
