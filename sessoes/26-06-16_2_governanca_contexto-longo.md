# Sessao 26-06-16_2 — Governanca contexto longo

- **Data:** 2026-06-16
- **Objetivo:** tornar petrea e auto-suficiente a regra de que Artificio e projeto longo multi-chat/multi-agente, nao "toque de contexto"; ajustar reload, infra e conclusao para evitar memoria solta e tarefa falsa.
- **Escopo:** governanca/T0/docs de retomada/sessao. Sem runtime.
- **Gate:** sem impacto em Gates; sem VM, sem deploy.
- **Restricoes:** sem commit/push.

## Plano
- [x] Registrar no `AGENTS.md` a alma operacional: projeto longo, muitos chats, continuidade obrigatoria.
- [x] Deixar claro quando ler `AGENTS.md`/infra/docs internas: tocar ou questionar governanca/infra/processo exige T1 relevante.
- [x] Atualizar T0 (`context-capsule`) para carregar essa regra em todo chat.
- [x] Corrigir registros da Spec 025 que ficaram contraditorios.
- [x] Validar por busca final.

## Motivo
Mantenedor apontou falha: tratar tarefa como contexto curto e atualizar so memoria nao basta. Se uma descoberta muda como agentes devem operar, a governanca/T0 deve ser atualizada para futuros chats.

## Alteracoes
- `AGENTS.md`: adicionada regra petrea "projeto longo multi-chat", escalada T1 obrigatoria, anti-retrabalho com Lighthouse/qualidade, e regra de conclusao: dry-run/plano/doc nao fecha tarefa executavel.
- `docs/agents/context-capsule.md`: T0 agora carrega a alma operacional e a escalada T1.
- `.specify/memory/decisions.md`: D070 registrada.
- `.specify/memory/project-state.md`: nota D070 registrada.
- `sessoes/index.md`: corrigido estado da sessao Spec 025 e registrada esta sessao.

## Validacao
- `rg -n "D070|Alma operacional|Escalada T1 obrigatoria|Escalada T1 obrigatória|Dry-run|dry-run|projeto longo, multi-chat|toque de contexto" AGENTS.md docs/agents/context-capsule.md .specify/memory/decisions.md .specify/memory/project-state.md sessoes/26-06-16_2_governanca_contexto-longo.md sessoes/index.md` confirmou registros.
- `git diff --check` OK; apenas avisos LF->CRLF do Git no Windows.
- Backlog: nada novo a criar; isto e correcao de governanca/T0.
