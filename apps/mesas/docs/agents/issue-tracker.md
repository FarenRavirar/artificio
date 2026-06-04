# Issue Tracker dos Agentes

Este projeto usa GitHub como tracker externo principal e SDD local como fonte canônica de requisitos.

## Fonte canônica

- Requisitos de produto: `specs/{id}/spec.md`
- Plano técnico: `specs/{id}/plan.md`
- Execução: `specs/{id}/tasks.md`
- Sessão operacional: `sessoes/*.md`
- Estado consolidado: `.specify/memory/project-state.md`

## GitHub

GitHub Issues e PRs podem ser usados para coordenação externa, revisão e publicação, mas não substituem os artefatos SDD.

Skills como `to-issues`, `to-prd` e `triage` devem:

1. Ler `AGENTS.md` antes de propor qualquer issue.
2. Preservar a hierarquia SDD.
3. Não criar issue que contradiga `spec.md`, `plan.md` ou `tasks.md`.
4. Não abrir PR, fazer push ou commit sem respeitar as regras pétreas de autorização.

## Local markdown

Quando a tarefa ainda não deve ir para GitHub, registrar em:

- `sessoes/*.md` para trabalho em andamento
- `specs/{id}/` para features SDD aprovadas
- `docs/agents/` para diretrizes de agente

Não usar `.scratch/` como tracker padrão neste projeto.
