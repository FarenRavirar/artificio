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
| `26-06-12_2_debitos_ux-marca` | 2026-06-12 | accounts/glossario/mesas/site/ui | Backlog de débitos UX/marca: toggle tema, dedup+rodapé, rename "serviços", favicon | parcialmente executada (017/018 ✅; D-INFRA2/D-MARCA2 futuros) |
| `26-06-12_3_ui-marca_debitos-exec` | 2026-06-12 | accounts/glossario/mesas/site/ui | Execução do backlog UX/marca (D-INFRA1, D-UX3, D-UX2, D-UX1, D-MARCA1) | concluída (017/018 prod ✅; site beta-only) |
| `26-06-12_4_infra_fonte-unica-auditoria` | 2026-06-12 | infra/monorepo | Spec 019: auditoria D-INFRA2 de duplicações/candidatos a fonte única | concluída (spec organizada; sem implementação) |
| `26-06-12_5_ui-theme-artificio-padrao` | 2026-06-12 | ui/packages | Spec 020: Theme Artifício padrão (somente comum: tokens, dark/light, primitives, nav/actions) | concluída (spec montada; sem implementação) |
| `26-06-12_6_ui-theme-020-tokens` | 2026-06-12 | ui/packages + apps | Spec 020 Fase B: D064 laranja `#FF5722` + fonte única de tokens (consumidores puxam `var(--artificio-brand)`) | aberta (build 13/13; fonte única no ar; lua/sol e navy glossário pendentes) |
