# Plano — 101

## Objetivo — leia isto antes de qualquer corte

**Esta spec existe porque o agente violou três regras que estavam escritas e carregadas no próprio contexto.** O objetivo não é um arquivo bonito: é um arquivo que o agente **obedece**.

O critério de sucesso tem duas metades, e a segunda é a que importa:

> `AGENTS.md` abaixo de 500 linhas, com os imperativos no topo e no fim.
> **E nenhuma regra perdida** — toda regra que sai tem gatilho que a traz de volta na hora certa.

Cortar sem a segunda metade não é progresso: é trocar um agente que esquece por um agente que nunca soube.

### Alvo numérico

| medida | hoje | alvo |
|---|---|---|
| linhas do `AGENTS.md` | **608** | **< 500** |
| imperativos (`nunca`/`sempre`/`pétreo`/`obrigatório`/`exige`) | **202** | queda medida e citada |
| marcações em negrito | **338** | queda medida e citada |
| fatos perdidos por frente | — | **0** (ou ausência justificada item a item) |
| hooks com suíte positiva **e** negativa | 4 de 4 | mantém 100% |

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
- `deploy-contract-gate.js` → 4 famílias de arquivo, 11 testes, cobra uma vez por família por sessão;
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
| 1 | Camada 4 — apontar skills que já existem | ~56 | baixo | os destinos já existem e funcionam |
| 2 | Camada 5 — densidade de ênfase | 0 movidas | baixo | não move nada de lugar |
| 3 | Camada 2 — ferramentas | 177 | **alto** | já falhou uma vez; T2 é obrigatório |
| 4 | Camada 3 — aprovação | ~80 de 117 | **alto** | mexe em autorização |

Frente 3 depende de as duas regras de `rtk` virarem hook antes — senão o corte perde regra sem substituto.

---

## Validação

**Por frente, antes de fechar:**

```bash
# 1. tamanho e densidade
wc -l AGENTS.md
rtk rg -c "nunca|sempre|proibido|obrigatóri|exige|pétre" AGENTS.md

# 2. auditoria de preservação (T2) — o que saiu existe no destino?
git diff AGENTS.md | grep "^-" | grep -v "^---" > /tmp/saiu.txt
# extrair cada trecho em crase e testar contra TODOS os destinos

# 3. hook novo, se houver
node ~/.claude/hooks/<nome>.test.js   # 2x, para provar que não é flaky
```

**No fim de tudo:** uma sessão real de trabalho de código, observando se o agente sente falta do que foi movido e se os gatilhos disparam quando deveriam.

### Procedência das medições

**Medido em 2026-09-03**, nesta sessão: as 608 linhas / 202 imperativos / 338 negritos; a classificação das 14 seções; os 3% de linhas que citam app; as 19 skills e 4 hooks; os 17 e 53 fatos perdidos nas duas auditorias; e todos os números do piloto de deploy.

**Da literatura, não do repositório** (fontes em `spec.md` §Referências, R1–R7): o
limite de linhas (**<150** em R2, medido sobre 2.500+ repositórios, com +20–23%
de custo acima disso; <500 em guias mais permissivos), a queda de obediência
conforme as instruções se acumulam (R3), os **68%** do IFScale na densidade
máxima e o viés posicional a favor das instruções iniciais (R4), os **30%** do
*lost in the middle* (R5), e a economia de **25×** entre descoberta (~80 tokens)
e corpo ativado (~2.000) de uma skill (R1).

**Não medido, e por isso é risco declarado e não premissa:** se o agente de fato obedece mais com o arquivo menor. Só a validação final responde — e ela é observacional, não um número que se extrai de um comando.

## Rollback

Documentação em git: reverter é `git revert` do commit da frente. Hooks vivem em `~/.claude/hooks/` (fora do repositório) — remover do `settings.json` desliga sem apagar.

O risco real não é técnico: é regra que sai e cujo gatilho não dispara. É o que T2 e a validação final existem para pegar.
