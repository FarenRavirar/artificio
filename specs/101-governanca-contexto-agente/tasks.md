# Tasks — 101

**O mantenedor conduz a execução (D5).** As fases estão na ordem do `plan.md` §Ordem de execução: da mais segura à mais arriscada, uma por sessão, com medição e conferência entre elas.

**Antes de agir em qualquer fase, ler `plan.md` §Objetivo** — as cinco travas, em especial **T2** (auditoria de preservação, que já pegou 17 e 53 perdas nesta base) e **T1** (regra sem gatilho não sai, por maior que seja).

---

## Fase 0 — já entregue (2026-09-03)

Registrada porque é o piloto que valida a abordagem, não trabalho pendente.

- [x] F0.1 — Consolidar os 22 incidentes de `errors.md` em **5 famílias de causa raiz**; `errors.md` ganha cabeçalho com a tabela de famílias apontando para a regra, e passa a ser explicitamente **histórico**, não procedimento.
- [x] F0.2 — `deploy-flow.md` vira contrato único organizado por ação (441 linhas), com índice "vou tocar em X → leia §N".
- [x] F0.3 — Absorver `apps/mesas/migrations_guide.md` no §3 (header, template, checklist, idempotência com `CHECK CONSTRAINT`, fluxo, guard `MAX_AUTO_PENDING`, emergência, drift). O guide vira ponteiro: 186 → 53 linhas.
- [x] F0.4 — Escrever `deploy-contract-gate.js` (`PreToolUse` em `Edit`/`Write`): 4 famílias de arquivo, cobra uma vez por família por sessão, motivo do bloqueio cita a seção. **11 testes**, positivos e negativos, estável em duas execuções. Registrado no `settings.json` com backup conferido por diff.
- [x] F0.5 — `AGENTS.md`: 667 → 608, com os blocos de migration/Dockerfile reduzidos a ponteiro e a trava por arquivo citando o hook.
- [x] F0.6 — Corrigir a citação de `rtk hook check`, que mudou de semântica na 0.47.0 (agora é dry-run com argumento; sem argumento devolve `No rewrite for:` vazio).
- [x] F0.7 — Achado lateral: `apps/mesas/PRE_DEPLOY_CHECKLIST.md` **foi deletado** do repositório e o `AGENTS.md` ainda mandava seguir seus gates. Referência morta removida; o registro do que aconteceu ficou no `deploy-flow.md`.

**Medição de saída:** migration deixou de exigir 5 arquivos e passou a exigir 1, autossuficiente. As 96 linhas do §3 não ocupam contexto e ainda assim são cobradas no `Edit` de um `migration_*.sql`.

---

## Fase 1 — apontar os destinos que já existem (risco baixo)

~56 linhas. Os destinos existem e funcionam; é a frente que ensina o mecanismo sem risco de perder regra.

- [ ] F1.1 — Ler `AGENTS.md` inteiro e `plan.md` §Objetivo. Medir e registrar o ponto de partida: `wc -l`, contagem de imperativos e de negritos.
- [ ] F1.2 — **§Review guidelines (9 linhas)** → apontar para a skill `ciclo-de-review`, que já existe. · feito quando: a skill cobre o conteúdo e o `AGENTS.md` tem só o ponteiro.
- [ ] F1.3 — **§Regras de Produto e SEO (11 linhas)** → verificar o que a skill `ui-fidelity-audit` já cobre e mover o resto para ela. **Atenção:** "Google OAuth é o único login" e "gratuidade, sem anúncios" são **regra de produto pétrea**, não checklist de UI — ficam (T1). · feito quando: só o que tem gatilho de UI saiu.
- [ ] F1.4 — **§VM/Banco/Infra (24) e §Deploy CI/CD (12)** → confirmar que o `deploy-contract-gate` cobre, e reduzir ao que governa **afirmação** (que o promote não deploya; que `deploy.yml` só roda se `deploy_paths` mudar). O resto vai para `deploy-flow.md`. · feito quando: as duas travas de afirmação continuam no `AGENTS.md` e o procedimento não.
- [ ] F1.5 — **Auditoria de preservação (T2).** Extrair todo fato removido e provar que existe no destino. · feito quando: zero ausentes, ou cada ausência justificada item a item.
- [ ] F1.6 — **Gate da fase:** remedir a tabela do `plan.md` §Objetivo e comparar. · feito quando: nenhum número subiu e a redução está citada.

---

## Fase 2 — densidade de ênfase (risco baixo, não move nada)

- [ ] F2.1 — Ler `plan.md` §Objetivo. Listar as **338 marcações em negrito** e classificar: quantas distinguem uma regra crítica das vizinhas, quantas são ênfase de hábito.
- [ ] F2.2 — Reduzir o negrito ao que de fato distingue. **Não apagar texto** — só a marcação. · feito quando: a contagem cai e nenhuma linha de conteúdo saiu (provado por `git diff --stat`: linhas alteradas, zero removidas).
- [ ] F2.3 — Mesma passagem para os **202 imperativos**: onde a mesma regra é reafirmada em dois lugares com palavras diferentes, manter a formulação mais forte e remover a repetição. **T5: não revisar a decisão, só a redundância.**
- [ ] F2.4 — **Gate da fase:** contagem antes/depois citada. · feito quando: densidade menor, conteúdo íntegro.

---

## Fase 3 — ferramentas (risco ALTO — já falhou uma vez)

177 linhas, 29% do arquivo. **A tentativa de 2026-09-03 perdeu 53 fatos** e foi revertida. Não repetir sem os pré-requisitos.

- [ ] F3.0 — **Pré-requisito: transformar em hook o que é sintaxe.** Acrescentar ao `rtk-enforce.js` as duas regras medidas: `rtk grep <dir>` sem `-r` (cai no grep nativo e falha) e `rtk diff <arquivo>` solto (o certo é `rtk git diff`). Com teste positivo e negativo. · feito quando: as duas bloqueiam e devolvem o comando correto; suíte estável em duas execuções.
- [ ] F3.1 — Ler `plan.md` §Objetivo e §Camada 2. Medir o ponto de partida.
- [ ] F3.2 — **Definir o destino antes de cortar (T3).** Para cada bloco que sai, responder por escrito: *o que faz o agente abrir isto na hora certa?* Bloco sem resposta **não sai**. · feito quando: cada bloco tem gatilho nomeado.
- [ ] F3.3 — Criar a skill de ferramentas com a tabela de comandos, as pegadinhas e a mecânica dos MCPs. · feito quando: a descrição da skill casa com "vou usar rtk/LSP/MCP" e o corpo tem o conteúdo movido.
- [ ] F3.4 — **Mecânica do opencode/DeepSeek (46 linhas)** → skill própria, disparada pela autorização de delegar. **A trava fica no `AGENTS.md`** (acionar outro agente exige aprovação nominal — é autorização, T1). · feito quando: a trava está no `AGENTS.md` e a mecânica na skill.
- [ ] F3.5 — **§Ordem de uso fica** (LSP → `codebase-memory-mcp` → busca textual). É a única parte que nenhum hook decide, e o próprio texto atual admite isso. · feito quando: continua no `AGENTS.md`.
- [ ] F3.6 — **Pegadinhas de interpretação** (saída truncada por `head`; `--help` antes de tratar vazio como bug) — não são sintaxe, nenhum hook as pega. Decidir com o mantenedor: ficam no `AGENTS.md` ou vão para a skill? · feito quando: o mantenedor decidiu.
- [ ] F3.7 — **Auditoria de preservação (T2).** Na tentativa anterior, 53 fatos ficaram ausentes, entre eles `rtk grep <dir>` falha, `rtk pnpm run lint` vs `rtk lint` (`JSON parse failed` na raiz) e os 4 erros de smoke test de 2026-07-25. · feito quando: zero ausentes, ou cada ausência justificada.
- [ ] F3.8 — **Gate da fase.** · feito quando: números citados e nenhum subiu.

---

## Fase 4 — aprovação (risco ALTO — mexe em autorização)

~80 das 117 linhas. Última porque é a mais perigosa: erro aqui remove trava de ação destrutiva.

- [ ] F4.1 — Ler `plan.md` §Objetivo e a §APROVAÇÃO NECESSÁRIA inteira.
- [ ] F4.2 — Separar **lista** de **procedimento**. A lista do que exige aprovação é governança pura e **fica** (T1). Candidatos a sair: formato do bloco "APROVAÇÃO NECESSÁRIA", detalhe de worktree, mecânica de pacote `apt`/lib nova. · feito quando: a separação está escrita e conferida pelo mantenedor **antes** de qualquer corte.
- [ ] F4.3 — Mover só o procedimento, para destino com gatilho. · feito quando: a lista está intacta no `AGENTS.md`.
- [ ] F4.4 — **Auditoria de preservação (T2)**, com atenção redobrada: aqui um fato perdido é uma trava de ação destrutiva que deixa de existir. · feito quando: zero ausentes.
- [ ] F4.5 — **Gate final:** `wc -l AGENTS.md` < 500; imperativos e negritos com delta citado. · feito quando: o alvo foi atingido, ou o desvio está nomeado com o motivo.

---

## Fase 5 — validar que funciona

O único teste que importa, e o que a spec não pode provar sozinha.

- [ ] F5.1 — Rodar uma sessão real de trabalho de código (uma fase da spec 100 serve) observando: o agente sentiu falta de algo movido? Os gatilhos dispararam quando deveriam? Algum hook reprovou indevidamente?
- [ ] F5.2 — Registrar o resultado onde o mantenedor mandar. Se alguma regra movida deixou de ser cumprida, **devolvê-la ao `AGENTS.md`** — o alvo de 500 linhas perde para o requisito 2.

---

## Decisões pendentes do mantenedor

Não bloqueiam a Fase 1, mas decidem o alcance real da spec:

| # | questão | por que importa |
|---|---|---|
| P1 | Versionar os hooks no repositório? | Hoje vivem em `~/.claude/hooks/`, só nesta máquina. Se a regra sai do `AGENTS.md` e o hook não existe no ambiente, a regra some |
| P2 | `docs/agents/` continua gitignored? | `deploy-flow.md` é o contrato de deploy e está fora do repositório público — invisível para CI e revisores externos |
| P3 | Pegadinhas de interpretação: `AGENTS.md` ou skill? | Não são automatizáveis; é o caso em que T1 e o alvo de tamanho colidem de frente |
