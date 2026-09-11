# 101 — Governança em tamanho que o agente obedece

- **Módulo/Pacote:** `AGENTS.md`, `docs/agents/*`, `.agents/skills/*`, `~/.claude/hooks/*`
- **Gate relacionado:** nenhum
- **Origem:** 2026-09-03, durante a spec 100. O agente violou três regras que estavam escritas e carregadas no próprio contexto. O mantenedor perguntou: *"você ao menos lembra quando tá no `AGENTS.md`? se fica grande demais, você não lembra; se espalha, não lê."*
- **Depende de:** nada. Consolidação do `deploy-flow.md` e o hook `deploy-contract-gate` já entregues em 2026-09-03 são o piloto que valida a abordagem.
- **Revisada em 2026-09-10** com medição do ambiente real e pesquisa posterior à redação. Três premissas caíram: o alvo era em linhas e o limite real é em **bytes**; o leitor não é um só, são **três harnesses**; e as skills-destino **não disparam** no estado atual. Detalhe em §Revisão 2026-09-10.

## Problema

**A governança não falha por estar mal escrita. Falha por não caber.**

Medido em 2026-09-03:

| medida | `AGENTS.md` hoje | referência |
|---|---|---|
| linhas | **608** | **<150** [R2] · <500 em guias mais permissivos |
| **bytes** | **90.220** | **32.768** — cap do Codex, medido no binário [R8] |
| tokens estimados | **~18.000** | — |
| imperativos — **regex canônica** `nunca\|sempre\|proibido\|obrigatóri\|exige\|pétre` | **100 linhas / 200 ocorrências** (remedido 2026-09-10) | obediência já cai a partir de ~10 instruções |
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
- **A economia é de 25× na mediana:** descoberta de skill custa **~80 tokens** (nome + descrição); o corpo ativado, **~2.000** [R1]. As 17 skills oficiais **da Anthropic** (não confundir com as 19 deste repo) custam ~1.700 tokens de descoberta juntas — menos que **uma** ativada.

Com 202 imperativos, o `AGENTS.md` está na faixa em que a pesquisa mede falha estrutural. E as três violações desta sessão são de regras que ficam **no meio** do arquivo.

### 3. Metade do peso já tem gatilho e não precisa estar carregada

Classificação das 14 seções por natureza de uso:

| natureza | seções | linhas | % |
|---|---|---|---|
| **vale sempre** (governa o que o agente afirma, autoriza e declara pronto) | T0, Gates, Regras Pétreas, lista de Aprovação, Código, Conclusão, Canônica, Erros, "O que é" | ~350 | 57% |
| **só quando toca o assunto** (tem gatilho natural ou mecânico) | Ferramentas MCP (177), VM/Infra (24), Deploy CI/CD (12), Produto/SEO (11), Review (9) | ~233 | 38% |
| **detalhe de aprovação** (a lista fica; o procedimento sai) | parte de APROVAÇÃO NECESSÁRIA | ~80 | 13% |

**As categorias não são partição:** somam 663 linhas e 108% num arquivo de 608, porque o "detalhe de aprovação" (~80) está **dentro** do "vale sempre" (~350). Estimar economia somando as três superestima o ganho.

### 4. A infraestrutura já existe e está subusada

- **28 skills** em `.agents/skills/` (pasta única desde 2026-09-10, D15), carregadas por descrição sob demanda — inclusive `ciclo-de-review` e `ui-fidelity-audit`, que cobrem duas das seções acima. **Medido: só 7 têm gatilho explícito na descrição** (A3), e 8 vêm do `cavekit`, que será removido (D12).
- **4 hooks** em `~/.claude/hooks/`: `rtk-enforce` (6 regras), `rtk-read-gate`, `git-commit-msg-gate` e `deploy-contract-gate` (escrito nesta sessão, 11 testes). **Medido em 2026-09-10: só 3 têm suíte de teste** — `rtk-read-gate.js` não tem. E os quatro existem **apenas para o Claude Code** (A2).

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

## Revisão 2026-09-10 — o que a medição do ambiente derrubou

A spec foi escrita medindo **um** harness (Claude Code) e mirando **linhas**. As duas premissas caíram na primeira medição do ambiente real. Nada aqui revisa decisão de governança (T5); o que muda é o **alvo**, o **destino** e a **ordem**.

### A1 — O Codex trunca o `AGENTS.md` em silêncio, hoje

Medido no binário desta máquina (`codex-cli 0.153.3`):

```
project_doc_max_bytes = 32768
"project doc exceeds remaining budget; truncating"
```

`AGENTS.md` tem **90.220 bytes** — 2,75× o cap. `project_doc_max_bytes` não está no `config.toml`, então roda no default.

**Consequência:** cerca de dois terços da governança **não chegam ao Codex**. Não é queda de atenção — é conteúdo ausente, e a palavra é *truncating*, não erro, por isso nunca houve sintoma. Muda o estatuto da spec: para o Claude Code é otimização de obediência; para o Codex é **restauração de conteúdo que não existe**.

**Medido em 2026-09-10 (Fase 0.4): corta o FIM.** A linha é `data.truncate(remaining as usize)` em `codex-rs/core/src/agents_md.rs` (fonte oficial) — mantém o início, descarta o resto. Ponto de corte: **linha 203 de 609**, perdendo **56.844 bytes (63%)**.

**O Codex vê:** T0, Gates, e as Regras Pétreas até §Bug achado/débito — incluindo §Evidência, §Autorização e a lista de APROVAÇÃO NECESSÁRIA. **Nunca viu:** §PR/Commit/Push (210, onde mora a proibição de `--amend`), §Erros que não podem se repetir (261), VM/Banco/Segredos/Migrations (292–311), §O mantenedor não é programador (331), §Compartilhado por padrão (339), §Conclusão de Tarefas (364), §Formato do relatório (382) e a §Ferramentas MCP inteira (432+).

**Cenário intermediário, não o pior:** as travas de autorização sobrevivem; o que se perde é a mecânica de execução. **A consequência que reordena o diagnóstico do projeto:** as regras de `rtk` estão na linha 436, na parte cortada. O `AGENTS.md` exige `rtk` em todo comando e o Codex **nunca leu essa exigência** — nem a §Conclusão, nem a proibição de `--amend`. Violação dessas regras atribuída ao GPT provavelmente não foi desobediência: a regra não chegou. O hook que cobra `rtk` só passou a existir para o Codex na Fase 0.7.

**Corolário para o requisito 1:** concentrar imperativos "no topo e no fim" não serve aos três harnesses — para o Codex **o fim não existe**. Só o topo conta.

**Decisão do mantenedor (2026-09-10):** sem analgésico. Não elevar `project_doc_max_bytes`; o alvo passa a ser **< 32.768 bytes**, atingido por reorganização real.

### A2 — São três harnesses, não um

`AGENTS.md` é lido por **Claude Code**, **Codex/GPT** e **OpenCode/DeepSeek**. Medido nesta máquina:

| | Claude Code | Codex/GPT | OpenCode/DeepSeek |
|---|---|---|---|
| lê `AGENTS.md` | inteiro | **só 32 KB** | lê |
| skills | **28 em `.agents/skills/`** — pasta única desde 2026-09-10 (D15) | varre `.agents/skills/` da cwd à raiz | também lê `.agents/skills/` (medido 2026-09-10) |
| os 4 hooks de governança | sim (`~/.claude/hooks/`) | tem `PreToolUse`, mas **nenhum dos 4** | não |
| `AGENTS.md` aninhado por diretório | não | **sim, nativo** | não |

Três consequências que a spec original não podia ver:

1. **Hook hoje é destino só para o Claude Code.** Mover regra crítica para hook sem paridade **apaga a regra** para dois dos três. P1 deixa de ser pendência e vira **pré-requisito** das Fases 3 e 4.
2. **`.agents/skills/` é lido pelos três** — medido em 2026-09-10: o OpenCode carrega skills de `.agents/skills`, `.opencode/skills`, `.claude/skills` e dos equivalentes em `~/`, e o `opencode.json` não restringe. **Skill é destino válido para os três; hook não.** É a diferença que separa T6 (vale para hook) do que a revisão anterior supôs (vale para skill — falso).
3. **D1 (nada por app) foi decidido medindo um harness.** O Codex tem hierarquia nativa por diretório — o mecanismo que resolveria o cap sem apagar regra. Não reaberto aqui; registrado como decisão tomada com medição parcial.

**Diferença de comportamento que inverte o requisito 6 — hipótese, não medição local:** a literatura descreve o Codex como *gênio literal* (segue cada caractere do `AGENTS.md`) e o Claude como disposto a reescrever o que julga pouco claro. **Não medido neste repositório**; entra como hipótese a testar na Fase 5, não como premissa fechada. A recomendação da Anthropic [R9] de trocar imperativo por julgamento é calibrada para o segundo; aplicada a um arquivo que os três leem, retira do Codex exatamente aquilo que ele obedece bem.

### A3 — As skills-destino não disparam no estado atual

Premissa da arquitetura (B): regra vira skill e a skill é acionada na hora certa. **Medido: 7 de 19 skills** têm gatilho explícito na descrição (`use when`/`use ao`/`triggers on`/`use quando`). As outras 12 dizem **o que a skill é**, não **quando usá-la** — que a doc oficial do Claude Code aponta como a causa nº 1 de skill não ativar [R10].

**Por que isso é pior que deixar a regra no `AGENTS.md`:** regra no arquivo está no contexto e pode ser ignorada; regra em skill que não dispara **não existe**, e o sintoma é idêntico ao de esquecimento — indistinguível para o mantenedor, que volta a lembrar na mão. É exatamente o custo que a spec existe para eliminar.

**Consequência:** nasce a **Fase 0.5**, antes de qualquer corte.

### A4 — Procedência das skills: 8 de 19 vêm de uma suíte que não é a deste projeto

Levantamento por menção a `Artifício`/`monorepo`/`mantenedor`:

- **7 autorais:** `add-module`, `artificio-spec-reconcile`, `ciclo-de-review`, `new-spec`, `spec-audit`, `split-refactor`, `ui-fidelity-audit`.
- **8 do `cavekit`** (4 com a marca `ck:` no corpo — `deepen`, `grill`, `research`, `review`; as outras 4 pelo formato `SPEC.md`/`§G-§T`, que todas as 8 referenciam): `spec`, `build`, `check`, `backprop`, `grill`, `research`, `review`, `deepen`. Repositório **congelado em ago/2026** [R11]. Rodam sobre um `SPEC.md` na raiz com seções `§G/§C/§I/§V/§T/§B` — **formato que este projeto não usa** (`specs/NNN-*/{spec,plan,tasks}.md`). ~680 linhas descrevendo um fluxo alheio. **Decisão do mantenedor (2026-09-10): remover** (D12).
- **4 utilitárias:** `ast-grep` (781 linhas, com seções Java irrelevantes), `jscpd`, `duplicate-code-detector`, `dry-refactoring` — as três últimas se sobrepõem.

**A7 — Fonte de verdade das skills: RESOLVIDO em 2026-09-10 (D15).** O diagnóstico era pior que a duplicata pontual antes registrada, e a execução revelou mais: as skills estavam espalhadas por **três pastas do repo**, nenhuma completa. Medido antes: `.agents/skills/` (19), `.claude/skills/` (19, versionada), `.opencode/skills/` (8) — **27 únicas**, com 15 duplicatas entre as duas primeiras (13 idênticas, 2 divergentes de verdade; outras 2 "divergências" eram só CRLF) e **5 skills exclusivas de `.opencode/`**.

**O achado que importava não era a duplicação, era o isolamento:** 105 KB de skills de UX, acessibilidade WCAG e heurísticas de Nielsen presas em `.opencode/`, invisíveis para Claude Code e Codex — enquanto o `AGENTS.md` exige Nielsen e ISO 9241-11 em toda mudança de interface. A regra existia sem que a skill que a operacionaliza chegasse ao harness principal.

**Symlink foi descartado por medição, não por preferência:** `core.symlinks=false` nesta máquina, **zero symlinks versionados** no repo e CI em `ubuntu-latest` contra Windows local. Symlink commitado viraria arquivo de texto no clone Windows — skill quebrada em silêncio, sem o CI acusar. (Havia um `build -> .agents/skills/build` solto em `.claude/skills/`, de agosto: indício de consolidação já tentada pela metade.)

**Executado:** `.agents/skills/` recebeu as **28 skills** como arquivos reais; `.claude/skills/` e `.opencode/skills/` foram removidas depois de absorvidas. As 9 exclusivas entraram por `git mv` (histórico preservado). Backup das três pastas originais em `C:\projetos\artificiobackup\skills-2026-09-10\` antes de qualquer alteração.

**As 2 fusões, decididas por medição contra o repo — nenhuma versão estava inteira certa:**

- **`add-module`** — cada pasta tinha uma parte correta que a outra não tinha, e **ambas carregavam erro de fato sobre deploy**: `docker-compose.beta.yml` na raiz e `deploy-beta.yml` **não existem** (o compose é `apps/<modulo>/docker-compose.<env>.yml`; o deploy é declarativo via `.github/deploy-manifest.json` + `_deploy-module.yml`), e a versão de `.agents/` dizia "imagem GHCR" quando o build é **na VM**. É a skill que ensina a plugar módulo novo: quem a seguisse montaria o deploy errado. A fusão corrige os três pontos e acrescenta o ponteiro para `deploy-flow.md` e a trava de aprovação nominal de DNS/tunnel.
- **`new-spec`** — não era versão velha contra nova, eram **escopos diferentes**: `.agents/` (328 linhas) tem o processo por fases (Gate de fase, Review de bot, Relatório final); `.claude/` (59) tinha o que a outra não tinha — a regra de levantar decisões **antes** de escrever a spec (`AskUserQuestion`), as 3 tasks fixas de abertura de fase (T0a/T0b/T0c) e as seções de `plan.md` (Arquivos afetados, Contratos tocados, Impacto em consumidores). União das duas, auditoria de preservação com **zero perdas**.

**Efeito na Fase 0.5:** o bloqueio deixou de existir — reescrever descrição em `.agents/skills/` agora atinge a skill que de fato dispara, nos três harnesses.

### A5 — `caveman` não entra, e sai do `CLAUDE.md`

O `CLAUDE.md` manda "caveman ultra". Medido: **não está instalado** — `claude plugin list` não devolve nada com esse nome, e não há skill nem hook. **Achado colateral:** `~/.claude.json` registra `.claude/skills/caveman/SKILL.md` e `caveman-learn/SKILL.md` em `loggedAuthoredArtifactPaths` — histórico de arquivos criados por sessões anteriores, que **não existem mais no disco**. Ou seja, chegaram a ser escritos e foram removidos; a instrução no `CLAUDE.md` é resíduo disso. O repo `caveman` está **ativo** (push 2026-09-10, 104k estrelas), mas suas issues abertas documentam por que foi descartado aqui [R12]:

- **compressão `full`/`ultra` conflita com o system prompt dos modelos Claude 5**, que instrui a encurtar *sendo seletivo*, e não comprimindo em fragmentos, abreviações e cadeias de seta — duas instruções permanentes em contradição a cada turno;
- **ganho anunciado 65%, medido 8,5%**;
- **language drift:** exemplos few-shot em português no `SKILL.md` vazam para a saída, atrapalhando justamente quem fixa idioma no `CLAUDE.md`.

**`caveman` é hoje um caso exemplar do problema que esta spec ataca:** instrução permanente em conflito, com custo real bem abaixo do prometido. Decisão: **não instalar**; a menção sai do `CLAUDE.md` na Decisão 3.

### A6 — Correções de fato na spec original

- **"4 de 4 hooks com suíte positiva e negativa"** é falso. Medido: **3 de 4** — `rtk-read-gate.js` não tem `.test.js`. O gate da Fase 1 comparava contra esse número.
- **Hook não é infalível:** há relato de Opus 5 contornando bloqueio de `git checkout` por regex fazendo `cd` para outra pasta e voltando [R9-HN]. Hook segue sendo o destino mais forte disponível; não é garantia absoluta.
- **`CLAUDE.md` contradiz o `AGENTS.md` que ele importa** (`@AGENTS.md`): manda ler um T0 de três arquivos que o `AGENTS.md` diz **não** entrarem automaticamente, e manda usar `rg`/`pnpm run lint` crus, que o `AGENTS.md` proíbe em favor de `rtk`. Nenhuma fase cobria isso. Vira **Decisão 3**, autorizada pelo mantenedor em 2026-09-10.

### Decisões do mantenedor (2026-09-10)

| # | Decisão | Escolha |
|---|---|---|
| D6 | Elevar `project_doc_max_bytes` como paliativo | **Descartado.** "Sem analgésico." O alvo é reorganização real |
| D7 | Alvo de tamanho | **< 32.768 bytes** (cap do Codex), no lugar de "< 500 linhas" |
| D8 | Arquitetura | **(B) núcleo + camadas com gatilho.** Núcleo do que vale sempre no `AGENTS.md`; procedimento em `.agents/skills/`; consequência grave em hook |
| D9 | Conflito `CLAUDE.md` × `AGENTS.md` | **Corrigir** (Decisão 3) |
| D10 | Skills como destino | Só depois de **funcionarem e dispararem sozinhas**. "Não posso ficar lembrando coisas óbvias" |
| D11 | `caveman` | **Não instalar.** Menção sai do `CLAUDE.md` |
| D12 | 8 skills do `cavekit` | **Remover.** Rodam sobre um `SPEC.md` de formato que o projeto não usa; ~680 linhas de fluxo alheio. Origem congelada em ago/2026 |
| D13 | Truncamento do Codex | **Testar de que ponta corta** antes dos cortes — determina o que já está invisível hoje |
| D15 | Fonte de verdade das skills | **`.agents/skills/` canônica, arquivo real, sem symlink.** As outras pastas do repo removidas após absorção. Executado em 2026-09-10 (A7) |
| D14 | Hooks | **Versionar no repositório.** Deixam de existir só nesta máquina e passam a valer para os três harnesses. Resolve P1 |

### Regra de alocação (deriva de D8/D10)

| natureza da regra | destino | por quê |
|---|---|---|
| consequência **grave e irreversível** (deploy, VM, DNS, SQL, push, worktree) | **hook** — e só sai do `AGENTS.md` depois da paridade entre harnesses | determinístico; não depende de o agente reconhecer a situação |
| governa **o que o agente afirma e autoriza** (Evidência, Autorização, Conclusão) | **fica no `AGENTS.md`** (T1) | não tem arquivo nem comando que a dispare; vale em todo turno |
| **procedimento** de tarefa reconhecível (review de PR, auditoria de UI, usar rtk, delegar) | **skill** em `.agents/skills/`, com gatilho explícito | o agente reconhece a tarefa; descoberta custa ~80 tokens |
| **detalhe/referência** sob demanda (runbook, mecânica de MCP) | **doc apontado pela skill** | não precisa estar carregado |

### Risco declarado que a revisão não resolve

**Caber em 32.768 bytes com T1 intacta provavelmente não fecha.** São 90.220 hoje, e as ~350 linhas de governança sem gatilho são justamente as que T1 protege. Ou a paridade de hooks converte regra sem gatilho em regra com gatilho, ou em algum ponto o mantenedor terá de escolher entre o teto e uma regra. Registrado agora, não na Fase 4.


## Requisitos

1. `AGENTS.md` fica **abaixo de 32.768 bytes** (cap do Codex, A1), com os imperativos concentrados no topo e no fim — as posições em que a atenção de fato funciona.
2. Nenhuma regra é perdida: toda regra removida do `AGENTS.md` tem **destino com gatilho** (hook que dispara, ou skill com descrição que a tarefa aciona).
3. **Auditoria de preservação obrigatória por frente**: extrair todo fato removido e provar que existe no destino. Método já usado nesta sessão — pegou **17 perdas** na consolidação de deploy e **53** na tentativa de cortar ferramentas.
4. Regra que tem gatilho mecânico vira hook, com suíte de teste que prova o bloqueio **e** a passagem (gate que nunca reprova é decoração; gate que reprova demais é desligado).
5. Regra sem gatilho **permanece** no `AGENTS.md`, independentemente do tamanho. Governança de afirmação (§Evidência) e de autorização não sai.
6. O número de imperativos cai — o alvo é a densidade, não só a contagem de linhas. Negrito que não distingue nada é ruído que compete com o que importa.
7. Nenhuma frente é fechada sem medir `AGENTS.md` antes e depois, e sem rodar a auditoria do requisito 3.

## Critérios de aceite

- `wc -c AGENTS.md` < 32.768 (critério primário, A1). `wc -l` registrado como acompanhamento.
- Toda regra movida para skill tem gatilho explícito na descrição, e o disparo foi observado (A3/D10).
- Nenhuma regra crítica sai do `AGENTS.md` sem destino que exista nos **três** harnesses (A2).
- Contagem de imperativos medida antes e depois, com o delta citado.
- Para cada frente: zero fatos ausentes na auditoria de preservação, ou a ausência justificada item a item.
- Todo hook novo tem suíte com casos positivos **e** negativos, rodando estável em duas execuções seguidas.
- Uma sessão real de trabalho de código **em cada um dos três harnesses** (Claude Code, Codex, OpenCode) roda sem que o agente precise do conteúdo movido — e os gatilhos disparam quando deveriam. Validar em um só não valida o mecanismo, já que a spec existe porque os três se comportam diferente (A2).

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
| **R8** | `codex-cli 0.153.3` — constante `project_doc_max_bytes = 32768` e string `"project doc exceeds remaining budget; truncating"`, extraídas do binário desta máquina em 2026-09-10 | O cap real que governa o alvo desta spec (A1). **Medição do ambiente, não literatura** |
| **R9** | [The new rules of context engineering for Claude 5 generation models](https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models) — Anthropic, 24/07/2026 | Fonte primária, posterior à redação da spec: a Anthropic deletou **mais de 80%** do system prompt do próprio Claude Code sem perda mensurável, diagnosticando **superconstrangimento**. Ressalva que ancora T1: não superconstranger *"exceto em áreas altamente importantes"*. **[R9-HN]** = [análise da discussão](https://www.developersdigest.tech/blog/claude-5-context-engineering-rules-hn-analysis), onde consta o relato de Opus 5 contornando hook de regex por `cd` |
| **R10** | [Claude Code — Skills](https://code.claude.com/docs/en/skills) — documentação oficial | Descrição sem cenário de acionamento é a **causa nº 1** de skill não ativar. Sustenta A3 e a Fase 0.5 |
| **R11** | [JuliusBrussee/cavekit](https://github.com/juliusbrussee/cavekit) | Origem das 8 skills `ck:`. **Congelado em ago/2026** (README: *"cavekit is no longer in active development"*). Sustenta A4 |
| **R12** | [JuliusBrussee/caveman — issues abertas](https://github.com/JuliusBrussee/caveman/issues) | Ativo (push 2026-09-10, 104k estrelas) e ainda assim descartado aqui: conflito `full`/`ultra` × system prompt do Claude 5, ganho medido **8,5%** contra 65% anunciados, e language drift em português. Sustenta A5/D11 |

**O que as fontes NÃO dizem, e a spec não afirma:** nenhuma delas mede se *este*
agente, neste repositório, passa a obedecer mais com o arquivo menor. Isso é o
risco declarado no `plan.md` §Procedência e o que a Fase 5 existe para observar.

**Divergência entre fontes, registrada em vez de escondida:** R2 recomenda **<150
linhas**; guias mais permissivos falam em <500. **Revogado em 2026-09-10 (D7):**
o alvo desta spec não é mais em linhas. O limite que morde é **32.768 bytes** —
o cap do Codex, medido no binário (R8, A1) — e nenhum guia de linhas o substitui,
porque 500 linhas deste arquivo continuariam acima do cap. Linhas passam a ser
acompanhamento; bytes são o critério. A tensão com T1 permanece e está declarada
em §Risco declarado.


## Fora de escopo

- **`AGENTS.md` por app** (D1) — descartado por medição.
- **Mover conteúdo para README** (D2) — descartado.
- Reescrever `deploy-runbook.md` (604 linhas): é manual operacional consultado sob demanda, e já tem gatilho pelo `deploy-flow.md`.
- Reescrever `project-state.md`, `decisions.md`, `errors.md` como documentos: `errors.md` já recebeu o cabeçalho de famílias em 2026-09-03; os outros dois não são carregados por padrão.
- Mudar o conteúdo das regras. **Esta spec move e comprime; não revisa decisão de governança.**

## Riscos e impacto

**Alto — é a fonte canônica de governança.** Erro aqui não quebra build: faz o agente agir sem trava. O requisito 3 (auditoria por frente) existe por isso, e já provou valor duas vezes nesta sessão.

**Alto — o executor é a parte interessada.** O agente que corta é o mesmo que se beneficia de um arquivo menor, e ele já errou duas vezes hoje mexendo nisto. Mitigação: medição citada por frente e conferência do mantenedor antes de cada avanço (D4/D5).

**~~Médio~~ — RESOLVIDO (D14, 2026-09-10): hook vive em `~/.claude/`, fora do repositório.** Os 4 hooks só existem nesta máquina e só para o Claude Code; com Codex e OpenCode lendo o mesmo `AGENTS.md`, regra que virasse hook **sumiria** para dois dos três (A2). O mantenedor decidiu **versionar os hooks no repositório**. Enquanto a paridade não estiver feita, regra crítica não sai do `AGENTS.md`.

**~~Médio~~ — OBSOLETO (medido 2026-09-10): `docs/agents/` NÃO é mais gitignored.** `.gitignore:54` registra que passou a ser versionado em 2026-09-03, e `git ls-files docs/agents` devolve **14 arquivos**. O `deploy-flow.md` está no repositório e visível para CI e revisores. Consequência para a Fase 0.7: `docs/agents/` é destino candidato dos hooks versionados, não um lugar proibido.

**Baixo — skill não dispara.** Skill depende de a descrição casar com a tarefa; hook dispara por arquivo, é determinístico. Onde a regra for crítica, preferir hook.
