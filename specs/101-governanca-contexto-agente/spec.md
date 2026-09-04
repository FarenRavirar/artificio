# 101 — Governança em tamanho que o agente obedece

- **Módulo/Pacote:** `AGENTS.md`, `docs/agents/*`, `.agents/skills/*`, `~/.claude/hooks/*`
- **Gate relacionado:** nenhum
- **Origem:** 2026-09-03, durante a spec 100. O agente violou três regras que estavam escritas e carregadas no próprio contexto. O mantenedor perguntou: *"você ao menos lembra quando tá no `AGENTS.md`? se fica grande demais, você não lembra; se espalha, não lê."*
- **Depende de:** nada. Consolidação do `deploy-flow.md` e o hook `deploy-contract-gate` já entregues em 2026-09-03 são o piloto que valida a abordagem.

## Problema

**A governança não falha por estar mal escrita. Falha por não caber.**

Medido em 2026-09-03:

| medida | `AGENTS.md` hoje | referência |
|---|---|---|
| linhas | **608** | **<150** [R2] · <500 em guias mais permissivos |
| tokens estimados | **~18.000** | — |
| imperativos (`nunca`/`sempre`/`pétreo`/`obrigatório`/`exige`) | **202** | obediência já cai a partir de ~10 instruções |
| marcações em negrito | **338** | — |
| bullets | 167 | — |

### 1. As três violações desta sessão são o sintoma, não o acidente

Todas as regras violadas estavam no contexto do agente, carregadas, no mesmo turno:

| o que o agente fez | a regra que estava escrita | onde ela mora |
|---|---|---|
| afirmou "a PR não toca `apps/site`" sem medir o lockfile | §Regras Pétreas → Evidência: "afirmação exige medição citada" | meio do arquivo |
| escreveu `text-white` literal em vez de token compartilhado | §Regras Gerais de Código: "compartilhado por padrão; exceção por app é o defeito" | meio do arquivo |
| rodou `git checkout AGENTS.md` e apagou trabalho bom | §PR, Commit e Push: nenhuma ação Git destrutiva por inferência | meio do arquivo |

O padrão é o mesmo dos incidentes já registrados em `errors.md`: [[E019]] (diagnóstico fechado no primeiro achado, sem consultar o que estava escrito) e [[E022]] (validação medida com o comando errado). **Três recorrências da família de deploy — [[E016]]→[[E017]]→[[E021]] — aconteceram com o procedimento já documentado.**

### 2. O que a pesquisa mede

- **Obediência cai com o número de instruções**, e o fator dominante é a *tensão e conflito* que emerge quando elas se acumulam — não só o volume [R3].
- **No limite de 500 instruções, modelos frontier acertam 68%** [R4]. Não 99%.
- **Lost in the middle: até 30% de queda** quando a informação relevante está no meio do contexto em vez do início ou fim, replicado em seis famílias de modelo [R5].
- **Acima de ~150 linhas há retorno decrescente e custo:** medição sobre **2.500+ repositórios** encontrou **+20–23% de custo de inferência** sem ganho de desempenho [R2].
- **Viés posicional:** em prompt com muitas instruções, o modelo privilegia as **iniciais** — as do fim são as mais puladas [R4]. Isso e o *lost in the middle* [R5] têm a mesma consequência prática: o meio do arquivo é a pior posição possível para uma regra crítica.
- **Progressive disclosure** é o padrão adotado pela indústria: o arquivo raiz *orienta*, não documenta; o corpo entra quando a tarefa exige. O princípio, na formulação da fonte: *"mostrar só o necessário para a tarefa imediata e adiar todo o resto"* [R1].
- **A economia é de 25× na mediana:** descoberta de skill custa **~80 tokens** (nome + descrição); o corpo ativado, **~2.000** [R1]. As 17 skills oficiais juntas custam ~1.700 tokens de descoberta — menos que **uma** ativada.

Com 202 imperativos, o `AGENTS.md` está na faixa em que a pesquisa mede falha estrutural. E as três violações desta sessão são de regras que ficam **no meio** do arquivo.

### 3. Metade do peso já tem gatilho e não precisa estar carregada

Classificação das 14 seções por natureza de uso:

| natureza | seções | linhas | % |
|---|---|---|---|
| **vale sempre** (governa o que o agente afirma, autoriza e declara pronto) | T0, Gates, Regras Pétreas, lista de Aprovação, Código, Conclusão, Canônica, Erros, "O que é" | ~350 | 57% |
| **só quando toca o assunto** (tem gatilho natural ou mecânico) | Ferramentas MCP (177), VM/Infra (24), Deploy CI/CD (12), Produto/SEO (11), Review (9) | ~233 | 38% |
| **detalhe de aprovação** (a lista fica; o procedimento sai) | parte de APROVAÇÃO NECESSÁRIA | ~80 | 13% |

### 4. A infraestrutura já existe e está subusada

- **19 skills** em `.agents/skills/`, carregadas por descrição sob demanda — inclusive `ciclo-de-review` e `ui-fidelity-audit`, que cobrem duas das seções acima.
- **4 hooks** em `~/.claude/hooks/`: `rtk-enforce` (6 regras), `rtk-read-gate`, `git-commit-msg-gate` e `deploy-contract-gate` (escrito nesta sessão, 11 testes).

### 5. O piloto de 2026-09-03 provou o mecanismo

A consolidação de deploy da mesma sessão é a prova de conceito:

- 22 incidentes de `errors.md` reduzidos a **5 famílias de causa raiz**;
- `deploy-flow.md` virou contrato único, organizado por ação (**441 linhas**);
- migration deixou de exigir **5 arquivos** e passou a exigir **1**, autossuficiente;
- `migrations_guide.md`: 186 → 53 linhas (ponteiro + histórico);
- `AGENTS.md`: 667 → 608;
- **`deploy-contract-gate`**: as 96 linhas de migration não ocupam contexto e ainda assim são cobradas no `Edit`/`Write` de um `migration_*.sql`, com a seção citada no motivo do bloqueio.

## Decisões do mantenedor (2026-09-03)

| # | Decisão | Escolha |
|---|---|---|
| D1 | `AGENTS.md` por app (`apps/<projeto>/AGENTS.md`) | **Descartado.** "Todos os apps compartilham basicamente as mesmas regras; é um monorepo." Medido e confirmado: só **3% das linhas** citam algum app, e nenhuma é regra exclusiva — são topologia (subdomínios, SSO) e travas que valem *porque* é monorepo. Fragmentar por app criaria 5 cópias da mesma regra |
| D2 | Mover conteúdo para README de pacote | **Descartado.** "Ninguém lê o README." Documento sem gatilho é fragmentação, não organização |
| D3 | Critério de corte | **Tem gatilho mecânico → hook. Tem gatilho natural → skill. Vale sempre, sem gatilho → `AGENTS.md`** |
| D4 | Ordem de execução | Do mais seguro ao mais arriscado, uma frente por vez, com medição antes e depois |
| D5 | Escopo desta spec | Escrever a spec agora; **o mantenedor conduz a execução** |

## Requisitos

1. `AGENTS.md` fica **abaixo de 500 linhas**, com os imperativos concentrados no topo e no fim — as posições em que a atenção de fato funciona.
2. Nenhuma regra é perdida: toda regra removida do `AGENTS.md` tem **destino com gatilho** (hook que dispara, ou skill com descrição que a tarefa aciona).
3. **Auditoria de preservação obrigatória por frente**: extrair todo fato removido e provar que existe no destino. Método já usado nesta sessão — pegou **17 perdas** na consolidação de deploy e **53** na tentativa de cortar ferramentas.
4. Regra que tem gatilho mecânico vira hook, com suíte de teste que prova o bloqueio **e** a passagem (gate que nunca reprova é decoração; gate que reprova demais é desligado).
5. Regra sem gatilho **permanece** no `AGENTS.md`, independentemente do tamanho. Governança de afirmação (§Evidência) e de autorização não sai.
6. O número de imperativos cai — o alvo é a densidade, não só a contagem de linhas. Negrito que não distingue nada é ruído que compete com o que importa.
7. Nenhuma frente é fechada sem medir `AGENTS.md` antes e depois, e sem rodar a auditoria do requisito 3.

## Critérios de aceite

- `wc -l AGENTS.md` < 500.
- Contagem de imperativos medida antes e depois, com o delta citado.
- Para cada frente: zero fatos ausentes na auditoria de preservação, ou a ausência justificada item a item.
- Todo hook novo tem suíte com casos positivos **e** negativos, rodando estável em duas execuções seguidas.
- Uma sessão real de trabalho de código roda sem que o agente precise do conteúdo movido — e os gatilhos disparam quando deveriam.

## Referências

Consultadas em 2026-09-03. Os números desta spec vêm daqui; o que foi medido no
repositório está marcado como tal no `plan.md` §Procedência.

| # | fonte | o que sustenta nesta spec |
|---|---|---|
| **R1** | [Agent Skills: Progressive Disclosure as a System Design Pattern](https://www.newsletter.swirlai.com/p/agent-skills-progressive-disclosure) — SwirlAI | O padrão que a spec adota, e a economia: descoberta **~80 tokens** por skill contra **~2.000** do corpo ativado — **25× na mediana**. As 17 skills oficiais custam ~1.700 tokens juntas, menos que **uma** ativada. Princípio, na formulação da fonte: *"mostrar só o necessário para a tarefa imediata e adiar todo o resto"* |
| **R2** | [AGENTS.md Best Practices: Template and Guide (2026)](https://www.betterclaw.io/blog/agents-md-best-practices) | O limite mais duro que encontramos: **<150 linhas**, medido sobre **2.500+ repositórios** — acima disso, retorno decrescente e **+20–23% de custo de inferência** sem ganho. Também a regra de manutenção: *acrescentar seção quando o agente erra algo repetidamente; remover quando a convenção muda* |
| **R3** | [Boosting Instruction Following at Scale](https://arxiv.org/abs/2510.14842) — arXiv 2510.14842 | A obediência cai conforme as instruções se acumulam, e o fator dominante é a **tensão e conflito entre elas** — não o volume bruto. É o que fundamenta o requisito 6 (densidade, não só contagem de linhas) |
| **R4** | [How Many Instructions Can LLMs Follow at Once?](https://arxiv.org/abs/2507.11538) — arXiv 2507.11538 | Benchmark **IFScale** (500 instruções, 20 modelos, 7 provedores): os melhores frontier acertam **68%** na densidade máxima. Também documenta o **viés posicional** — instruções iniciais são privilegiadas |
| **R5** | [Never Lost in the Middle](https://arxiv.org/html/2311.09198v2) — arXiv 2311.09198 | Curva em U: até **30% de queda** quando a informação relevante está no meio do contexto. Replicado em seis famílias de modelo. Sustenta o requisito 1 (imperativos no topo e no fim) |
| **R6** | [Standardize project context with AGENTS.md and Agent Skills](https://developers.redhat.com/articles/2026/07/27/standardize-project-context-agentsmd-and-agent-skills) — Red Hat Developer | Confirma a divisão que a spec usa: o arquivo raiz **orienta**, a skill **executa**. Contexto de por que o formato virou padrão multi-ferramenta |
| **R7** | [skills-best-practices](https://github.com/mgechev/skills-best-practices) — Minko Gechev | Prática de escrever skill e validá-la mantendo a janela de contexto enxuta. Relevante para as Fases 3 e 4, que criam skills |

**O que as fontes NÃO dizem, e a spec não afirma:** nenhuma delas mede se *este*
agente, neste repositório, passa a obedecer mais com o arquivo menor. Isso é o
risco declarado no `plan.md` §Procedência e o que a Fase 5 existe para observar.

**Divergência entre fontes, registrada em vez de escondida:** R2 recomenda **<150
linhas**; guias mais permissivos falam em <500. A spec adota **<500 como alvo
desta rodada** por ser alcançável sem violar a trava T1 (regra sem gatilho não
sai) — com 608 linhas hoje e ~350 de governança que **não tem gatilho**, os 150
exigiriam cortar regra que precisa estar carregada. O alvo mais agressivo fica
para depois, se a Fase 5 mostrar que o mecanismo funciona.


## Fora de escopo

- **`AGENTS.md` por app** (D1) — descartado por medição.
- **Mover conteúdo para README** (D2) — descartado.
- Reescrever `deploy-runbook.md` (604 linhas): é manual operacional consultado sob demanda, e já tem gatilho pelo `deploy-flow.md`.
- Reescrever `project-state.md`, `decisions.md`, `errors.md` como documentos: `errors.md` já recebeu o cabeçalho de famílias em 2026-09-03; os outros dois não são carregados por padrão.
- Mudar o conteúdo das regras. **Esta spec move e comprime; não revisa decisão de governança.**

## Riscos e impacto

**Alto — é a fonte canônica de governança.** Erro aqui não quebra build: faz o agente agir sem trava. O requisito 3 (auditoria por frente) existe por isso, e já provou valor duas vezes nesta sessão.

**Alto — o executor é a parte interessada.** O agente que corta é o mesmo que se beneficia de um arquivo menor, e ele já errou duas vezes hoje mexendo nisto. Mitigação: medição citada por frente e conferência do mantenedor antes de cada avanço (D4/D5).

**Médio — hook vive em `~/.claude/`, fora do repositório.** `deploy-contract-gate` só existe nesta máquina; outro ambiente não o tem. Se a regra sair do `AGENTS.md` e o hook não estiver lá, a regra some. Decisão pendente do mantenedor: versionar os hooks no repo ou manter a duplicação mínima no `AGENTS.md`.

**Médio — `docs/agents/` é gitignored.** O `deploy-flow.md` está fora do repositório público: invisível para CI e revisores externos. Decisão pendente.

**Baixo — skill não dispara.** Skill depende de a descrição casar com a tarefa; hook dispara por arquivo, é determinístico. Onde a regra for crítica, preferir hook.
