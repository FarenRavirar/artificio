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
- **A skill está instalada** (medido 2026-09-21): `~/.claude/skills/caveman/`, do repo `github.com/JuliusBrussee/caveman`, seis níveis. `caveman-activate.js` injeta 5249 chars com `level: ultra` no `SessionStart` (4 matchers); `caveman-mode-tracker.js` injeta 360 chars por prompt em `UserPromptSubmit`; `.claude/hooks/caveman-resposta-final.js` cobre o evento `Stop`, que era o buraco entre o prompt e a resposta final.

## Custo de reinjeção por turno (medido 2026-09-21)

Contado no transcript da sessão `7b82e0fe` (17,7 MB):

| fonte | ocorrências | evento |
|---|---|---|
| `codebase-memory-mcp` | **249** | `PreToolUse(Grep\|Glob\|Bash)` + `PostToolUse(Read)` |
| `caveman-mode-tracker` | 93 | `UserPromptSubmit` |
| `registro-anti-compactacao` | 65 | `Stop` |
| `caveman-resposta-final` | 8 | `Stop` |

**O peso não está nos hooks do repo.** O `codebase-memory-mcp` injeta o bloco
"untrusted repository metadata" com 5 símbolos do grafo em TODA chamada de Bash,
e os matches costumam ser irrelevantes ao comando (medido: buscas por "caveman",
"function" e "gatilho" devolveram seções de specs velhas e docs do `mesas`).
São ~3,9x as injeções de todos os hooks `Stop` somados.

Duas saídas levantadas, **nenhuma decidida** — pendente de resposta do
mantenedor: tirar o `codebase-memory-mcp` do `PreToolUse(Grep|Glob|Bash)`
mantendo o MCP por chamada explícita (é hook global, `~/.claude/settings.json`),
ou instalar o proxy do repo do caveman, que comprime o que o agente LÊ (logs,
JSON, diffs, saída de teste). O proxy é pacote novo: exige pergunta antes.

### Teto de mensagem nos hooks `Stop`

Mensagem de hook `Stop` reinjeta a cada parada cobrada, então tem teto no teste:
`registro-anti-compactacao` 700 chars (estava em ~1100 de prosa, cortado para
515 com 4 comandos de amostra), `caveman-resposta-final` 400 (estava em 977).
Sem teto o texto volta a crescer — cada regressão futura acrescenta uma linha de
explicação, e nenhuma parece caber sozinha.

⚠️ **Frase que o guard casa não pode ser partida entre dois itens do array** do
`motivo`: o `join("\n")` mete newline no meio dela e o teste fica vermelho sem
motivo aparente. Medido ao cortar "falha em silêncio" em 2026-09-21.

⚠️ **`stop_hook_active` NÃO corta o segundo hook `Stop` da mesma parada.** Medido
2026-09-21: `registro-anti-compactacao` e `caveman-resposta-final` cobraram
juntos na mesma parada, cada um com `exit 2`. O comentário de
`registro-anti-compactacao.js` supunha a flag por parada inteira; ela não impede
que dois hooks distintos bloqueiem o mesmo `Stop`. Consequência prática: dois
hooks `Stop` que bloqueiam custam duas cobranças no mesmo turno, e o teto de
chars de cada um é o que limita o custo.

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
