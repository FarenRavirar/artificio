# Economia de Tokens & Anti-Retrabalho

Projeto ~3 meses, N chats, N agentes. Cada token de reload paga × centenas de sessões. Esta disciplina é **obrigatória**. Ela mesma é curta de propósito.

## Contrato de Reload em Tiers

**T0 — todo chat, todo agente (minúsculo, sempre).** Só estes 3:
1. `.specify/memory/project-state.md` — onde estamos.
2. `docs/agents/context-capsule.md` — regras críticas + stack.
3. `.specify/memory/decisions.md` — decisões fechadas (não re-decidir).

**T1 — sob demanda (quando a tarefa exigir).**
- `AGENTS.md` — consulta de regra específica (não ler inteiro por hábito).
- `docs/agents/operating-model.md` — escolher nível SDD.
- `.specify/arquiteture.md` — **só a seção relevante** (tem índice; nunca o arquivo inteiro).

**T2 — trabalho de módulo.**
- `apps/<modulo>/CONTEXT.md` — contexto local do módulo (criado com o módulo).

Não ler além do tier necessário. Não reabrir o que já está no contexto.

## Regras de leitura
- **Buscar antes de abrir.** `grep`/`glob` para localizar; abrir só o trecho. Nunca abrir arquivo grande inteiro às cegas.
- **Ler por seção.** `arquiteture.md` e specs longas: por seção/anchor.
- **Não re-explorar.** Antes de mapear código, checar se já há mapa/índice. Resultado de exploração relevante vira nota curta na sessão para o próximo agente reusar.

## Caveman ultra default
- Saída de **todos os agentes** em caveman ultra salvo código/commits/segurança. Já embutido nos prompts dos subagentes.
- Comunicação com mantenedor: PT, caveman ultra. Sem preâmbulo, sem resumo redundante.
- Docs operacionais de reload (capsule, decisions, project-state) mantidos compactos; comprimir com a skill `caveman-compress` se incharem.

## Anti-retrabalho
- **Decisão tomada → `decisions.md` na hora.** Próximo agente lê em vez de re-perguntar.
- **Erro resolvido → `errors.md` (`E###`).** Ninguém apanha do mesmo bug duas vezes.
- **Estado mudou → `project-state.md`.** Fonte única do "onde estamos".
- **Sessão registra** o que vai fazer / falta / feito, antes de agir. Handoff entre chats sem reconstrução.

## Delegação para subagentes (economia de contexto do chat principal)
- Tarefa de localizar código / revisar diff / auditar → **subagente** (saída comprimida, ~60% menos token no chat principal). Ver `cavecrew` (investigator/builder/reviewer) e os agentes G1 em `.claude/agents/`.
- Fan-out só quando o ganho paga o custo de spawn. Tarefa pequena → inline.

## Arquitetura de agentes (Artifício Supervisor Flow)

Este projeto usa um fluxo de subagentes com **um único agente primário (`artificio-orquestrador`)**. O usuário conversa apenas com o orquestrador. Subagentes trabalham em tarefas fechadas e devolvem relatório ao orquestrador.

- **Orquestrador:** recebe o pedido do mantenedor, divide em fases (fix/feature → registro → investigação → implementação → revisão de documentação → commit), delega cada fase a subagentes especializados e valida a saída antes de avançar. Não executa código de produto.
- **Subagentes:** cada um especializado num papel (investigador, implementador, revisor, documentador, etc.). Recebem escopo fechado, trabalham, devolvem `## Relatório do Subagente` com evidências, decisões e pendências.
- **Modelo:** agentes usam o modelo disponível no ambiente (DeepSeek, etc.) — não há divisão rígida por provedor de modelo. A economia de contexto vem da delegação a subagentes de saída comprimida (~60% menos token no chat principal; ver `cavecrew`).

### Handoff de execução (subagentes)

O orquestrador define o escopo e o subagente executa. O contrato de handoff é o `## Relatório do Subagente` (formato em `AGENTS.md` §Artifício Supervisor Flow).

- Subagentes são invocados por fase, não por task-ID rígido. Não há sistema de IDs `CDX-NNN` no modelo atual.
- Cada delegação inclui: fase, escopo autorizado, arquivos relevantes, critério de aceite.
- O subagente retorna: evidências, decisões, riscos, pendências, débitos novos e status (concluído/bloqueado/precisa de autorização).
- O orquestrador valida o relatório e decide se avança ou reabre.
