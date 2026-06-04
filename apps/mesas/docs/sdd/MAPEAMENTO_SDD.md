# Mapeamento SDD × MDs canônicos

| Artefato SDD | Fonte de verdade canônica |
|--------------|--------------------------|
| constitution.md — stack | AGENTS.md + `.specify/arquiteture.md` |
| constitution.md — operação | AGENTS.md + `.specify/memory/project-state.md` + `PRE_DEPLOY_CHECKLIST.md` |
| spec.md — contexto | `.specify/features/{id}/spec.md` (canônico) ou `docs/legacy/BACKLOG_OPERACIONAL.md` + `docs/legacy/FILA_IMPLEMENTACAO.md` (legado) |
| plan.md — API | MAPA_DE_API.md |
| plan.md — migration | migrations_guide.md |
| tasks.md — pré-deploy | PRE_DEPLOY_CHECKLIST.md |
| erros durante implement | `.specify/memory/errors.md` |

## Regra de sincronização
- Spec introduz novo endpoint → última task (Polish) ATUALIZA MAPA_DE_API.md.
- Nova migration → atualizar migrations_guide.md.
- Qualquer outra escrita em MD canônico exige autorização explícita (salvo as abertas no spec).
