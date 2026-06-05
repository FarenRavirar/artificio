# Índice de Sessões

Formato: `AA-MM-DD_N_<modulo>_<escopo>.md`. `N` = sequencial do dia. Sessões encerradas vão para `sessoes/encerradas/`.

| Sessão | Data | Módulo | Escopo | Estado |
|---|---|---|---|---|
| `26-06-03_1_infra_backup-runbook` | 2026-06-03 | infra | Backup total (Fase 0, Gate A) | concluída (Gate A ✅) |
| `26-06-04_2_infra_fase1-recriar` | 2026-06-04 | infra | Fase 1: recriar VM limpa (sem telegram) | concluída (Fase 1 ✅) |
| `26-06-04_3_monorepo_fase2-sso` | 2026-06-04 | monorepo | Fase 2: monorepo + SSO (accounts) | aberta |
| `26-06-04_4_mesas_sso-gate-d` | 2026-06-04 | mesas | CDX-308: integrar mesas ao SSO (Gate D) | aberta (CDX-308A ✅) |
| `26-06-04_5_cicd-deploy-modulos` | 2026-06-04 | CI/CD | CDX-309: deploy canônico por GitHub Actions + VM clone | aberta (CDX-309E ✅; aguardando Opus/Gate D) |
| `26-06-05_1_infra_beta-staging` | 2026-06-05 | infra/CI-CD | Spec 005: esteira beta genérica (dev→beta, main→prod) + D041 | aberta (spec ✅; aguardando Codex T2+) |
