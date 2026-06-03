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

## Caveman default
- Saída de **todos os agentes** em caveman (full) salvo código/commits/segurança. Já embutido nos prompts dos subagentes.
- Comunicação com mantenedor: PT, caveman. Sem preâmbulo, sem resumo redundante.
- Docs operacionais de reload (capsule, decisions, project-state) mantidos compactos; comprimir com a skill `caveman-compress` se incharem.

## Anti-retrabalho
- **Decisão tomada → `decisions.md` na hora.** Próximo agente lê em vez de re-perguntar.
- **Erro resolvido → `errors.md` (`E###`).** Ninguém apanha do mesmo bug duas vezes.
- **Estado mudou → `project-state.md`.** Fonte única do "onde estamos".
- **Sessão registra** o que vai fazer / falta / feito, antes de agir. Handoff entre chats sem reconstrução.

## Delegação para subagentes (economia de contexto do chat principal)
- Tarefa de localizar código / revisar diff / auditar → **subagente** (saída comprimida, ~60% menos token no chat principal). Ver `cavecrew` (investigator/builder/reviewer) e os agentes G1 em `.claude/agents/`.
- Fan-out só quando o ganho paga o custo de spawn. Tarefa pequena → inline.

## Divisão de modelo (custo)
- Claude Opus (principal): arquitetura, SSO, importador, engine SRD/crosslink, SEO, specs, gates.
- Codex (secundário/barato): UI, testes, migração mecânica, lint, boilerplate.
- Não usar o modelo caro para trabalho mecânico.
