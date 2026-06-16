# Sessao 26-06-16_7 — Governanca registro obrigatorio de bugs

- **Data:** 2026-06-16
- **Objetivo:** tornar obrigatorio registrar bugs achados e abrir debito para auditar backlog/index desatualizados.
- **Escopo:** `AGENTS.md`, `specs/backlog.md`, `sessoes/index.md`.
- **Gate:** governanca/documentacao; sem commit/push/deploy.

## Achado
- Mantenedor apontou que `specs/backlog.md` e `sessoes/index.md` parecem absurdamente desatualizados.
- Risco operacional: agentes encontram bug, workflow quebrado, harness falho ou status divergente e deixam só no chat; o proximo chat nao carrega isso.

## Mudanca de governanca
- `AGENTS.md` reforcado: bug descoberto nunca fica só no chat/cabeca/nota solta.
- Bug, regressao, falha de validacao, workflow recorrente, bug de harness, index/backlog desatualizado ou contrato quebrado deve ser registrado no mesmo turno em sessao + backlog/tasks/project-state conforme impacto.
- Se nao houver backlog novo, a sessao deve registrar motivo objetivo.

## Debito aberto
- `BL-DOCS-BACKLOG-INDEX-DRIFT`: auditar backlog + index contra sessoes/specs recentes e corrigir status/proximos passos.
