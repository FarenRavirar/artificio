# Documentos Legados — Arquivamento Histórico

**Data de arquivamento:** 22/04/2026  
**Motivo:** Migração para sistema Spec-Kit concluída (Fases 1-6)

---

## Documentos Arquivados

| Documento Original | Substituído Por | Status |
|---|---|---|
| `RESUMO_EXECUCAO.md` | `.specify/memory/project-state.md` | ✅ Migrado |
| `ERRORS_SOLUTIONS.md` | `.specify/memory/errors.md` | ✅ Migrado + expandido |
| `ARQUITETURA_PROJETO.md` | `.specify/arquiteture.md` | ✅ Migrado (não existia na raiz) |
| `BACKLOG_OPERACIONAL.md` | `.specify/features/*/spec.md` | ⚠️ Migração incremental |
| `FILA_IMPLEMENTACAO.md` | `.specify/features/*/tasks.md` | ⚠️ Migração incremental |

---

## Por Que Foram Arquivados?

Estes documentos foram a base do projeto até abril/2026. Com a adoção do sistema Spec-Kit (Spec-Driven Development), eles foram substituídos por artefatos estruturados que oferecem:

- ✅ Rastreabilidade completa (spec + plan + tasks)
- ✅ Geração dinâmica de estado
- ✅ Detecção automática de drift
- ✅ Workflows automatizados

---

## Rastreabilidade da Migração

**Relatórios de validação:**
- Fase 6.1 — Diagnóstico: `fase6-diagnostico-doctor.md`
- Fase 6.2 — Cobertura: `fase6-validacao-cobertura.md`
- Fase 6.3 — Reconciliação: `fase6-reconciliacao.md`
- Fase 6.4 — Otimização: `fase6-otimizacao.md`
- Fase 6 — Consolidado: `fase6-relatorio-final.md`

**Conclusão:** Zero informação perdida. Zero divergências críticas.

---

## Quando Consultar Estes Documentos?

- **Auditoria histórica** — Entender decisões tomadas antes da migração
- **Rollback de emergência** — Reverter para sistema anterior (improvável)
- **Comparação de evolução** — Ver como o projeto evoluiu

**Para uso operacional atual, consultar sempre `.specify/memory/` e `.specify/features/`.**
