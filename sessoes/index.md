# Índice de Sessões

Formato: `AA-MM-DD_N_<modulo>_<escopo>.md`. `N` = sequencial do dia. Sessões encerradas vão para `sessoes/encerradas/`.

| Sessão | Data | Módulo | Escopo | Estado |
|---|---|---|---|---|
| `26-06-03_1_infra_backup-runbook` | 2026-06-03 | infra | Backup total (Fase 0, Gate A) | concluída (Gate A ✅) |
| `26-06-04_2_infra_fase1-recriar` | 2026-06-04 | infra | Fase 1: recriar VM limpa (sem telegram) | concluída (Fase 1 ✅) |
| `26-06-04_3_monorepo_fase2-sso` | 2026-06-04 | monorepo | Fase 2: monorepo + SSO (accounts) | concluída (Gate B/SSO ✅; residuais em backlog) |
| `26-06-04_4_mesas_sso-gate-d` | 2026-06-04 | mesas | CDX-308: integrar mesas ao SSO (Gate D) | concluída (Gate D mesas ✅) |
| `26-06-04_5_cicd-deploy-modulos` | 2026-06-04 | CI/CD | CDX-309: deploy canônico por GitHub Actions + VM clone | entregue/em uso (residuais BL-CDX-310/BL-DEP-MESAS-LEGACY-SCRIPTS) |
| `26-06-05_1_infra_beta-staging` | 2026-06-05 | infra/CI-CD | Spec 005: esteira beta genérica (dev→beta, main→prod) + D041 | entregue/em uso (residuais BL-BETA-HYDRATE/proteção GitHub) |
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
| `26-06-12_7_ui-theme-020-dark-readiness` | 2026-06-12 | ui/packages + glossário/mesas | Spec 020 R4/R8: lua/sol (D-UX2) — checklist T4 + escolha de piloto (variante faltante) | fechada/absorvida (B6/B7 validados; residuais no backlog) |
| `26-06-13_1_ui-theme-020-b6b7-e2e-prod` | 2026-06-13 | glossário/mesas/ui | Spec 020 B6/B7 E2E prod + fixes locais + B10b/B11 tokens | concluída histórica (B6/B7 fechados; residuais B13/primitives no backlog) |
| `26-06-14_1_release-prod-feedback-dmesas1-nginx` | 2026-06-14 | glossário/mesas/docs | Release prod: Spec 021 feedback + D-MESAS1 + shell/nginx glossário (D-NGINX1 v2/D-SHELL1b) | concluída (promote+deploy prod verde; D-NGINX1/D-SHELL1b fechados; D-NGINX2 depois fechado pela spec 023) |
| `26-06-15_1_mesas_nginx-realip` | 2026-06-15 | infra/mesas/glossário/accounts/site | Spec 023: contrato Real IP para Cloudflare Tunnel → artificio_net → apps | concluída (prod verde; residual BL-ACCOUNTS-PORT) |
| `26-06-15_2_docs-specs-backlog-audit` | 2026-06-15 | docs/specs | Spec 024: auditoria documental de specs, tasks e backlog | concluída |
| `26-06-15_3_ui-020-b6-b2` | 2026-06-15 | ui/site/glossário | Spec 020: fechar B6 por evidência + B2 static shell | concluída (dev/beta verde; validação manual mantenedor OK) |
| `26-06-15_4_ui-020-b12-fonts` | 2026-06-15 | ui/site | Spec 020 B12: remover Google Fonts do CSS compartilhado/shell público | concluída (builds verdes; warning removido; backlog atualizado) |
| `26-06-15_5_ui-020-b3-b4-primitives` | 2026-06-15 | ui/packages | Spec 020 B3/B4: HeaderAction + primitives compartilhadas | concluída (B3/B4 fechados; tests 8/8; rollout consumidor futuro) |
| `26-06-15_6_ui-primitives-consumers-spec` | 2026-06-15 | ui/site-admin | Spec piloto para consumidores de primitives compartilhadas | concluída (spec criada; baseline site-admin verde) |
| `26-06-15_7_lighthouse-quality-specs` | 2026-06-15 | qualidade/site/apps | Programa de specs Lighthouse/Core Web Vitals/acessibilidade | concluída (Spec 025 + backlog QA criados) |
| `26-06-16_1_quality_lighthouse-harness` | 2026-06-16 | qualidade/site/apps | Spec 025 T1/T2: harness Lighthouse limpo + baseline dos betas | concluída (lighthouse instalado; smoke real + baseline completo) |
| `26-06-16_2_governanca_contexto-longo` | 2026-06-16 | governança | Tornar pétrea a alma operacional multi-chat e escalada T1 obrigatória | concluída (D070 + AGENTS/T0 atualizados) |
| `26-06-16_3_quality_glossario-cls` | 2026-06-16 | qualidade/glossário | Spec 025 BL-QA-SHELL-CLS: reduzir CLS do glossário | shared-local (workaround beta + fonte compartilhada local; falta beta da fonte shared) |
| `26-06-16_4_mesas_auto-archive-ci` | 2026-06-16 | mesas/infra-ci | Registrar debito: workflow `Mesas Auto-Archive` falha com Cloudflare 403/challenge | aberto (`BL-MESAS-AUTO-ARCHIVE-CF`) |
| `26-06-16_5_ui-footer-logo-cls` | 2026-06-16 | ui/qualidade | Spec 025: promover reserva do footer/logo para `packages/ui` e shell Astro | shared-local (builds + Lighthouse local verde; falta beta) |
| `26-06-16_6_quality_perf-images-robots` | 2026-06-16 | qualidade/glossario/site/seo | Spec 025: BL-QA-GLOSSARIO-PERF + BL-QA-SITE-IMAGES + BL-QA-ROBOTS-SEO | local (builds + Lighthouse local verde; falta beta/Cloudinary real) |
| `26-06-16_7_governanca_bug-registry` | 2026-06-16 | governança/docs | Tornar obrigatório registrar bugs achados e abrir auditoria backlog/index | concluída (AGENTS reforçado; BL-DOCS-BACKLOG-INDEX-DRIFT aberto) |
| `26-06-16_8_docs-backlog-harness-audit` | 2026-06-16 | docs/qualidade | Auditar backlog/index e corrigir harness Lighthouse multi-url | concluída (BL-DOCS-BACKLOG-INDEX-DRIFT + BL-QA-LH-MULTIURL fechados localmente) |
| `26-06-16_9_quality-beta-deploy` | 2026-06-16 | qualidade/CI-CD | Commit/push/deploy beta do pacote QA | parcial (glossário/site beta verdes; mesas beta bloqueado por drift; incidente dispatch-prod registrado) |
