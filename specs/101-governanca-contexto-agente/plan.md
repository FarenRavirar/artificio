# Plano — 101

## Objetivo — leia isto antes de qualquer corte

**Esta spec existe porque o agente violou três regras que estavam escritas e carregadas no próprio contexto.** O objetivo não é um arquivo bonito: é um arquivo que o agente **obedece**.

O critério de sucesso tem duas metades, e a segunda é a que importa:

> `AGENTS.md` abaixo de **32.768 bytes** (cap do Codex), com os imperativos no topo e no fim.
> **E nenhuma regra perdida** — toda regra que sai tem gatilho que a traz de volta na hora certa.

Cortar sem a segunda metade não é progresso: é trocar um agente que esquece por um agente que nunca soube.

### Alvo numérico

| medida | hoje | alvo |
|---|---|---|
| **bytes do `AGENTS.md`** | **90.220** | **< 32.768** — cap do Codex, medido no binário (R8) |
| linhas do `AGENTS.md` | **608** | consequência, não critério |
| imperativos — regex canônica (abaixo) | **100 linhas / 200 ocorrências** | queda medida e citada |
| marcações em negrito | **338** | queda medida e citada |
| fatos perdidos por frente | — | **0** (ou ausência justificada item a item) |
| hooks com suíte positiva **e** negativa | **3 de 4** (`rtk-read-gate.js` não tem) | 4 de 4 |
| skills com gatilho explícito na descrição | ~~7 de 19~~ → **20 de 20** ✓ (2026-09-10) | atingido: universo foi 19 → 28 (consolidação) → 20 (remoção do `cavekit`) |
| harnesses em que a regra movida continua existindo | **1 de 3** (hook só no Claude Code) | 3 de 3 antes de mover regra crítica |

### Revisão 2026-09-10 — três premissas caíram

Medição do ambiente real, posterior à redação. Detalhe em `spec.md` §Revisão 2026-09-10.

1. **O alvo era em linhas; o limite real é em bytes.** O Codex lê no máximo **32.768 bytes** de `AGENTS.md` (`project_doc_max_bytes`, medido no binário `codex-cli 0.153.3`) e **trunca em silêncio** — a mensagem é *"project doc exceeds remaining budget; truncating"*, não erro. Com 90.220 bytes, cerca de dois terços da governança **não chegam ao Codex hoje**. O mantenedor recusou elevar o cap ("sem analgésico", D6): o alvo passa a ser < 32.768 bytes por reorganização real.
2. **O leitor não é um só.** `AGENTS.md` é lido por Claude Code, Codex/GPT e OpenCode/DeepSeek. Os 4 hooks existem **só para o Claude Code** — mover regra crítica para hook, hoje, **apaga a regra** para os outros dois. P1 vira pré-requisito.
3. **As skills-destino não disparam.** 7 de 19 têm gatilho explícito na descrição. A segunda metade do problema — **não havia fonte de verdade**, com skills espalhadas por três pastas e 5 delas invisíveis para dois harnesses — foi **resolvida em 2026-09-10** (D15/A7): `.agents/skills/` é canônica, com 28 skills; as outras 12 dizem o que a skill é, não quando usá-la. Regra em skill que não dispara **não existe**, e o sintoma é idêntico ao de esquecimento. Nasce a **Fase 0.5**, antes de qualquer corte.

**T6 — destino tem que existir nos três harnesses.** Extensão natural de T3: não basta ter gatilho; o gatilho precisa existir onde o arquivo é lido. **Medido em 2026-09-10:** `.agents/skills/` é lido pelos três (o OpenCode também o carrega), então **skill é destino válido**; **hook, hoje, só no Claude Code** — o que a **Fase 0.7** (D14) existe para resolver antes de qualquer corte que dependa de hook. T6 morde em hook, não em skill.

### Cinco travas

**T1 — Regra sem gatilho não sai, por maior que seja.** Governança de afirmação (§Evidência), de autorização e de conclusão vale em toda tarefa e não tem arquivo que a dispare. Se a única justificativa para cortar é "o arquivo está grande", a regra fica.

**T2 — Auditoria de preservação antes de fechar a frente, sempre.** Extrair todo fato removido (trecho em crase, comando, número, nome de arquivo) e provar que existe no destino. O método já pegou **17 perdas** na consolidação de deploy e **53** na tentativa de cortar ferramentas — nas duas vezes, o agente achava que não tinha perdido nada.

**T3 — Destino sem gatilho é fragmentação, não organização (D2).** "Ninguém lê o README." Antes de mover qualquer coisa, responder: *o que faz o agente abrir isto na hora certa?* Se a resposta for "ele lembra", o destino está errado.

**T4 — O executor é a parte interessada.** O agente que corta se beneficia do arquivo menor, e já errou duas vezes nesta sessão mexendo nisto. Cada frente termina com número medido e conferência do mantenedor antes da seguinte.

**T5 — Esta spec move e comprime; não revisa decisão de governança.** Achar que uma regra é excessiva, redundante ou errada não autoriza alterá-la. Isso é conversa com o mantenedor, em separado.

### O que esta spec deliberadamente não faz

- **`AGENTS.md` por app** — descartado (D1). Medido: 3% das linhas citam app, nenhuma é regra exclusiva.
- **Mover para README de pacote** — descartado (D2).
- **Reescrever `deploy-runbook.md`** — manual sob demanda, já tem gatilho.
- **Mudar o conteúdo das regras** — T5.

---

## Arquitetura da solução

O trabalho é de **classificação**, não de redação. Cada bloco do `AGENTS.md` responde a uma pergunta, e a resposta decide o destino:

```
O que faz o agente precisar desta regra?

├─ um arquivo que ele edita, ou um comando que ele roda
│  └─ HOOK — bloqueia no ato, com a correção no motivo
│     (deploy-contract-gate, rtk-enforce, git-commit-msg-gate)
│
├─ um tipo de tarefa que ele reconhece ("vou revisar PR", "vou usar rtk")
│  └─ SKILL — carrega por descrição, ~80 tokens de descoberta
│     (.agents/skills/, 19 já existem)
│
└─ nada específico: vale em toda tarefa
   └─ AGENTS.md — e fica, por maior que seja (T1)
```

### Camada 1 — o que já está feito (2026-09-03, piloto)

Não é planejamento: é o que existe e prova o mecanismo.

- 22 incidentes de `errors.md` → **5 famílias de causa raiz**;
- `deploy-flow.md` → contrato único por ação (441 linhas), com `migrations_guide.md` absorvido (186 → 53);
- `deploy-contract-gate.js` → 4 famílias de arquivo, 11 testes, cobra uma vez por família por sessão — **e só no Claude Code**, até a Fase 0.7;
- `AGENTS.md` → 667 → 608.

**A medição que importa:** as 96 linhas de migration **não estão** no contexto do agente, e mesmo assim são cobradas quando ele edita um `migration_*.sql`.

### Camada 2 — ferramentas (177 linhas, 29% do arquivo)

O maior bloco, e o de gatilho mais claro. Já tentado e revertido nesta sessão — a tentativa perdeu 53 fatos, e é por isso que T2 existe.

**O que sai:** tabela de comandos por categoria, tabela Fazer/Nunca, mecânica do opencode/DeepSeek (46 linhas), detalhe de cada MCP.

**O que fica no `AGENTS.md`:**
- a regra de usar `rtk` no lugar do comando cru (uma linha);
- **§Ordem de uso** — LSP → `codebase-memory-mcp` → busca textual. É a única parte que **nenhum hook decide**, e o texto atual já admite isso;
- a trava de não acionar outro agente sem aprovação nominal (é autorização, T1).

**Duas regras candidatas a virar hook**, medidas na tentativa de hoje: `rtk grep <dir>` sem `-r` cai no grep nativo e falha; `rtk diff <arquivo>` solto não é o uso certo (é `rtk git diff`). São sintaxe — o `rtk-enforce.js` já tem 6 regras do mesmo formato.

**O que não é automatizável** e precisa de destino com gatilho (T3): as pegadinhas de *interpretação* — "não concluir que o comando falhou a partir de saída truncada por `head`", "ler `--help` antes de tratar resultado vazio como bug". Não são sintaxe; são leitura de resultado.

### Camada 3 — aprovação (117 linhas, 19%)

A mais delicada. A **lista** do que exige aprovação é governança pura e fica (T1). O que pode sair é o procedimento: formato do bloco "APROVAÇÃO NECESSÁRIA", detalhe de worktree, mecânica de pacote `apt`.

Gatilho natural: o agente sabe quando vai pedir aprovação.

### Camada 4 — o resto (56 linhas)

`VM/Banco/Infra` (24) e `Deploy CI/CD` (12) já têm o `deploy-contract-gate` ativo. `Review guidelines` (9) e `Produto/SEO` (11) têm skills que já existem (`ciclo-de-review`, `ui-fidelity-audit`) — falta apontar.

### Camada 5 — densidade

Independente de mover: **338 negritos e 202 imperativos competem entre si.** A pesquisa mede que o fator dominante da queda é *tensão entre instruções*, não volume bruto. Reduzir ênfase onde ela não distingue nada é ganho sem mover uma linha de lugar.

---

## Ordem de execução

Do mais seguro ao mais arriscado (D4). Uma frente por sessão, com medição e conferência entre elas.

| # | frente | linhas | risco | por quê |
|---|---|---|---|---|
| **0.4** | **medir de que ponta o Codex trunca** (D13) | 0 movidas | baixo | decide a ordem: se o corte é no início, o T0 já está invisível hoje |
| **0.5** | **skills confiáveis** — ~~consolidar em pasta única~~ **(feito, D15)**; reescrever as descrições sem gatilho; **remover as 8 do `cavekit`** (D12) | 0 movidas · −680 de skill | baixo | **pré-requisito de (B)**: skill que não dispara é regra que some |
| **0.6** | **conflito `CLAUDE.md` × `AGENTS.md`** | 26 (arquivo inteiro) | baixo | instrução contraditória já ativa, custo medido por R9 |
| **0.7** | **versionar os hooks** (D14) | 0 movidas | médio | **pré-requisito das frentes 3 e 4**: sem paridade, hook apaga a regra em vez de movê-la |
| 1 | Camada 4 — apontar skills que já existem | ~56 | baixo | os destinos já existem e funcionam |
| 2 | Camada 5 — densidade de ênfase | 0 movidas | baixo | não move nada de lugar |
| 3 | Camada 2 — ferramentas | 177 | **alto** | já falhou uma vez; T2 é obrigatório |
| 4 | Camada 3 — aprovação | ~80 de 117 | **alto** | mexe em autorização |

Frente 3 depende de as duas regras de `rtk` virarem hook antes — senão o corte perde regra sem substituto. **E depende de P1 (paridade de hooks entre harnesses):** sem ela, transformar regra em hook não move a regra, apaga-a para Codex e OpenCode.

**Risco declarado que a revisão não resolve:** caber em 32.768 bytes com T1 intacta provavelmente não fecha — são 90.220 hoje, e as ~350 linhas de governança sem gatilho são justamente as que T1 protege. Ou a paridade de hooks converte regra sem gatilho em regra com gatilho, ou o mantenedor terá de escolher entre o teto e uma regra. Registrado agora, não na Fase 4.

---

## Validação

**Por frente, antes de fechar:**

```bash
# 1. tamanho (bytes = critério primário) e densidade
wc -c AGENTS.md   # alvo < 32768 (criterio primario)
wc -l AGENTS.md   # acompanhamento

# imperativos — REGEX CANONICA, nao alterar entre medicoes (H4).
# Linha de base remedida em 2026-09-10: 100 linhas / 200 ocorrencias.
# O "202" da redacao original nao e reproduzivel por nenhuma das duas regexes
# que a spec citava; usar sempre as duas formas abaixo, e citar as duas.
rtk rg -c "nunca|sempre|proibido|obrigatóri|exige|pétre" AGENTS.md          # linhas
grep -ioE "nunca|sempre|proibido|obrigatóri|exige|pétre" AGENTS.md | wc -l  # ocorrencias

# 2. auditoria de preservação (T2) — o que saiu existe no destino?
git diff AGENTS.md | grep "^-" | grep -v "^---" > /tmp/saiu.txt
# extrair cada trecho em crase e testar contra TODOS os destinos

# 3. hook novo, se houver
node ~/.claude/hooks/<nome>.test.js   # 2x, para provar que não é flaky
```

**No fim de tudo:** uma sessão real de trabalho de código, observando se o agente sente falta do que foi movido e se os gatilhos disparam quando deveriam.

### Procedência das medições

**Medido em 2026-09-03**, nesta sessão: as 608 linhas / 202 imperativos / 338 negritos; a classificação das 14 seções; os 3% de linhas que citam app; as 19 skills e 4 hooks (a suíte de teste de 3 deles — o quarto foi medido em 2026-09-10); os 17 e 53 fatos perdidos nas duas auditorias; e todos os números do piloto de deploy.

**Da literatura, não do repositório** (fontes em `spec.md` §Referências, R1–R7): o
limite de linhas (**<150** em R2, medido sobre 2.500+ repositórios, com +20–23%
de custo acima disso; <500 em guias mais permissivos), a queda de obediência
conforme as instruções se acumulam (R3), os **68%** do IFScale na densidade
máxima e o viés posicional a favor das instruções iniciais (R4), os **30%** do
*lost in the middle* (R5), e a economia de **25×** entre descoberta (~80 tokens)
e corpo ativado (~2.000) de uma skill (R1).

**Não medido, e por isso é risco declarado e não premissa:** se o agente de fato obedece mais com o arquivo menor. Só a validação final responde — e ela é observacional, não um número que se extrai de um comando.

## Rollback

Rollback é **por fase**, porque o mecanismo muda no meio da spec:

- **Documentação** (Fases 0.6, 1–4): `git revert` do commit da frente.
- **Skills** (Fase 0.5): idem — `.agents/skills/` e `.claude/skills/` estão versionados.
- **Hooks, antes da Fase 0.7:** vivem em `~/.claude/hooks/`, fora do repositório — remover do `settings.json` desliga sem apagar.
- **Hooks, depois da Fase 0.7:** passam a ser versionados; o rollback vira `git revert` mais desligar em cada harness onde foram ligados. A instrução anterior deixa de valer.

O risco real não é técnico: é regra que sai e cujo gatilho não dispara. É o que T2 e a validação final existem para pegar.
