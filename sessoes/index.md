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
| `26-06-11_2_glossario_monorepo-exec` | 2026-06-11 | glossario | Spec 012: glossário no monorepo + bootstrap beta | aberta (BETA pronto p/ dispatch; PROD bloqueado até `main` conter módulo) |
