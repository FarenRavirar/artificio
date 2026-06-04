# Matriz de Decisao de Skills

Ultima atualizacao: 2026-05-31

## Regra de escolha

Use skills para reduzir incerteza e custo cognitivo. Nao use uma skill para contornar `AGENTS.md`, SDD de alto risco ou aprovacoes obrigatorias.

## Matriz rapida

| Situacao | Skill primaria | Processo minimo | Observacao |
|---|---|---|---|
| Pedido ambiguo ou ideia inicial | `grill-me` | Sem SDD ou SDD Lite | Fechar intencao antes de escrever plano. |
| Plano precisa respeitar linguagem do projeto | `grill-with-docs` | SDD Lite | Usar docs de dominio como referencia. |
| Bug sem causa clara | `diagnose` | SDD Lite | Reproduzir, minimizar, hipotetizar, instrumentar, corrigir, testar. |
| Bug com alto risco de dados/auth/deploy | `diagnose` | SDD Completo | Seguir tambem `.specify/memory/errors.md`. |
| Implementacao com teste viavel | `tdd` | SDD Lite ou Completo | RED -> GREEN -> refactor quando aplicavel. |
| Refatoracao arquitetural | `improve-codebase-architecture` | SDD Completo | Somente com escopo autorizado. |
| Criar PRD ou issue a partir de conversa | `to-prd` / `to-issues` | SDD Lite | Usar rastreabilidade do issue tracker local/GitHub conforme contexto. |
| Triagem de backlog/bugs | `triage` | SDD Lite | Manter labels e estados do projeto. |
| Retomada, queda de contexto ou passagem para outro agente | `handoff` | Sem SDD | Atualizar tambem `context-capsule.md` se houver decisao duradoura. |
| Sessao longa ou economia de tokens solicitada | `caveman` | Mesmo modo de risco da tarefa | Reduz saida; nao reduz rigor. |
| Revisao de diff | `caveman-review` ou postura de review | Conforme risco | Findings primeiro, com arquivo/linha. |
| Commit message solicitado | `caveman-commit` | Nao altera autorizacao Git | Gerar mensagem; commit ainda exige regra local. |

## Referencias seletivas de Superpowers

`obra/superpowers` nao e stack ativo. Use apenas como inspiracao conceitual:

| Referencia | Como aproveitar |
|---|---|
| `verification-before-completion` | Exigir evidencia fresca antes de concluir. |
| `systematic-debugging` | Manter disciplina de causa raiz em bugs dificeis. |
| `receiving-code-review` | Converter feedback em fila objetiva de correcoes. |

Evitar adocao direta:

- `using-git-worktrees`
- `finishing-a-development-branch`
- fluxos automaticos de commit/PR
- subagentes que ignorem sessao, SDD local ou aprovacoes

## Quando nao usar skill

- Quando o pedido e uma pergunta direta respondida por leitura simples.
- Quando a skill adicionaria cerimonia sem reduzir risco.
- Quando a tarefa exige aprovacao humana antes da proxima acao.
- Quando o documento canônico do projeto ja define o procedimento com clareza.

