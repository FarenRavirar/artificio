# Vocabulário de Triagem

Mapeamento recomendado para skills de triagem.

| Papel canônico | Label sugerida | Uso |
|---|---|---|
| `needs-triage` | `needs-triage` | Precisa avaliação do mantenedor |
| `needs-info` | `needs-info` | Falta informação externa |
| `ready-for-agent` | `ready-for-agent` | Especificado o bastante para agente executar |
| `ready-for-human` | `ready-for-human` | Exige decisão ou implementação humana |
| `wontfix` | `wontfix` | Não será executado |

## Regra local

Antes de aplicar label ou criar issue, verificar se já existe feature ou bug em `specs/` ou `.specify/features/`.

Se existir conflito entre label/issue e SDD local, prevalece SDD local.
