# Tasks — 101

**O mantenedor conduz a execução (D5).** As fases estão na ordem do `plan.md` §Ordem de execução: da mais segura à mais arriscada, uma por sessão, com medição e conferência entre elas.

**Revisada em 2026-09-10** (ver `spec.md` §Revisão 2026-09-10). O alvo deixou de ser "< 500 linhas" e passou a ser **< 32.768 bytes** — o cap do Codex, medido no binário. Entraram quatro fases **antes** de qualquer corte: **0.4** (medir o truncamento do Codex), **0.5** (skills confiáveis), **0.6** (conflito `CLAUDE.md` × `AGENTS.md`) e **0.7** (versionar os hooks — pré-requisito das Fases 3 e 4).

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

## Fase 0.4 — medir de que ponta o Codex trunca (risco baixo, D13)

Medido: o Codex lê no máximo **32.768 bytes** e o `AGENTS.md` tem **90.220** — cerca de dois terços não chegam. **Falta medir onde o corte cai**, e isso decide a ordem de tudo: se some o fim, perdem-se §Conclusão/§Ferramentas; se some o começo, perdem-se o T0 e as Regras Pétreas — que é o pior cenário e mudaria a prioridade dos cortes.

- [x] F0.4.1 — **Ponto de corte medido: o Codex corta o FIM.** Não por marcador nem inferência — pela fonte: `data.truncate(remaining as usize)` em `codex-rs/core/src/agents_md.rs` mantém o início e descarta o resto. Calculado sobre o arquivo real: corte na **linha 203 de 609**, perdendo **56.844 bytes (63%)**.
- [x] F0.4.2 — **A1 reescrito** com a medição, no lugar do "Não medido" (bloco substituído, não anexado).
- [x] F0.4.3 — **Não é o pior cenário, mas muda o diagnóstico.** O T0, os Gates, §Evidência, §Autorização e a lista de APROVAÇÃO NECESSÁRIA **sobrevivem** — a trava de ação perigosa chega ao Codex. O que nunca chegou: §PR/Commit/Push (210, com a proibição de `--amend`), §Erros que não podem se repetir (261), VM/Banco/Segredos/Migrations (292–311), §Conclusão de Tarefas (364), §Formato do relatório (382) e a §Ferramentas MCP inteira (432+). **Consequência que vale reportar:** as regras de `rtk` estão na linha 436 — o `AGENTS.md` exige `rtk` em todo comando e o Codex nunca leu isso. Violação dessas regras atribuída ao GPT provavelmente não foi desobediência; a regra não chegou. **E o requisito 1 precisa de ajuste:** concentrar imperativos "no topo e no fim" não serve aos três — para o Codex o fim não existe.

---

## Fase 0.5 — tornar as skills confiáveis antes de depender delas (risco baixo)

Pré-requisito de tudo que move regra para skill. **Medido em 2026-09-10: 7 de 19 skills têm gatilho explícito na descrição.** As outras 12 dizem o que a skill é, não quando usá-la — a causa nº 1 de skill não ativar, segundo a doc oficial (R10). Sem esta fase, a arquitetura (B) é aposta: regra em skill que não dispara **não existe**, e o sintoma é idêntico ao de esquecimento (D10).

- [x] F0.5.0 — **Fonte de verdade das skills — FEITO em 2026-09-10 (D15).** `.agents/skills/` é canônica, com **28 skills** como arquivos reais; `.claude/skills/` e `.opencode/skills/` removidas após absorção. Symlink descartado por medição (`core.symlinks=false`, zero symlinks versionados, CI Linux × Windows local — viraria arquivo de texto no clone). Resgatadas 9 exclusivas por `git mv`, entre elas **5 de UX/WCAG/Nielsen que estavam invisíveis** para Claude Code e Codex. Fundidos os 2 pares divergentes (`add-module`, `new-spec`) com auditoria de preservação e zero perdas; no `add-module`, corrigidos 3 erros de fato sobre deploy que **as duas** versões carregavam. Backup em `C:\projetos\artificiobackup\skills-2026-09-10\`.
- [x] F0.5.1 — **Descrições com gatilho — FEITO em 2026-09-10.** Reescritas **11 descrições** no formato da doc oficial (o que faz + "Use quando…" com as frases reais do mantenedor). Só o frontmatter mudou: `git diff --stat` mostra **1 linha por skill**, corpo intacto. Acrescentado desambiguador onde duas skills competiam (`ui-design-review` × `ui-fidelity-audit`; `review-changes` × `ciclo-de-review`; `jscpd` → `dry-refactoring`), porque descrição sobreposta é causa de a skill errada disparar.
- [x] F0.5.2 — **`cavekit` removido — FEITO em 2026-09-10 (D12).** Saíram `spec`, `check`, `backprop`, `grill`, `research`, `review`, `deepen` (7 versionadas) e `build` (pasta vazia, nunca versionada — era o alvo do symlink solto achado em `.claude/skills/`). **Achado lateral corrigido no mesmo trabalho:** `skills-lock.json` (versionado, gerado pela CLI `skills`) tinha **17 entradas, 7 delas fantasmas** — `caveman`, `cavecrew`, `caveman-commit/-compress/-help/-review/-stats`, removidas do disco em 2026-08-12 (commit `1f65fee`) e nunca tiradas do lock. Lock reconciliado: **17 → 2** (`jscpd` e `dry-refactoring`, as únicas de terceiros que restam). Verificado antes de remover: nenhuma referência às 8 fora do próprio lock e da spec 101.
- [x] F0.5.3 — **Utilitárias de duplicação — FEITO em 2026-09-10. Não eram redundantes.** A investigação desmentiu a premissa da spec: as três formam **encadeamento**, não sobreposição — `jscpd` é referência da ferramenta, `duplicate-code-detector` é o workflow de análise (cita jscpd 21×), `dry-refactoring` é a correção (cita 10×). Nenhuma foi removida; o que se corrigiu foi a **descrição**, que não dizia isso e fazia as três competirem pelo mesmo gatilho. **Achado lateral corrigido:** `jscpd` mandava instalar `dry-refactoring` via `npx skills add` — instrução obsoleta, a skill já está no repo.
- [x] F0.5.4 — **`ast-grep` enxugado — FEITO em 2026-09-10: 782 → 456 linhas (−42%).** Removido o bloco `## Java-Specific Patterns` (linhas 230–555, 326 linhas: anotações, Stream API, Optional, generics, nós AST de Java). Medido antes de cortar: o repo **não tem nenhum `.java`**, e o bloco não continha uma linha sequer de TS/TSX. Também trocados os exemplos Java dos Core Commands por equivalentes da stack real (TSX/TS) e reescrita a descrição, que prometia "Java-specific patterns". Backup do original em `artificiobackup/skills-2026-09-10/ast-grep-SKILL-antes-corte-java.md`.
- [ ] F0.5.5 — **Verificar que dispara.** Para cada skill reescrita, observar ativação numa tarefa real que deveria acioná-la. Gatilho de skill é **probabilístico** — descrição boa aumenta a chance, não garante. Skill que não dispara não recebe regra crítica. · feito quando: o disparo foi observado, ou a skill está marcada como não confiável.
- [x] F0.5.6 — **Gate da fase — FEITO em 2026-09-10.** Universo mudou dentro da própria fase, como previsto (H8): **19 → 28** (consolidação, D15) **→ 20** (remoção do `cavekit`). Gatilho explícito: **7/19 antes → 20/20 depois**. Nenhuma linha de corpo saiu por acidente (`git diff --stat`: 1 linha por skill nas 11 reescritas).

---

## Fase 0.6 — corrigir o conflito `CLAUDE.md` × `AGENTS.md` (risco baixo, autorizado em 2026-09-10)

O `CLAUDE.md` importa `@AGENTS.md` e contradiz o que importou. É o mecanismo que a Anthropic descreve como custo real (R9): duas instruções em conflito, e o modelo gasta raciocínio decidindo qual vence antes de tocar no arquivo. Agrava-se por ser o arquivo mais próximo, o que tende a ganhar.

- [x] F0.6.1 — **T0 divergente — RESOLVIDO.** O `CLAUDE.md` mandava ler `project-state.md` + `context-capsule.md` + `decisions.md` (506 linhas, os três existem); o `AGENTS.md:29-30` define o T0 como **ele mesmo, uma vez por sessão**, e o §T1 (linha 47) diz que esses três **não entram automaticamente**. Removido: agora existe uma definição só de T0, a do `AGENTS.md`.
- [x] F0.6.2 — **Comandos crus — RESOLVIDO.** O `CLAUDE.md` mandava `rg` e `pnpm run lint`; o `AGENTS.md:43` exige `rtk rg` e a tabela da linha 478 marca `pnpm run lint` como proibido. Medido: `rtk hook check "rg termo apps"` → reescreve para `rtk rg`, ou seja, o hook já bloqueava o que o `CLAUDE.md` mandava fazer. Removidos. **Exceção medida e mantida:** `ast-grep` roda cru (`rtk hook check` → `No rewrite for`), e o próprio `AGENTS.md:65` o usa assim — não era contradição.
- [x] F0.6.3 — **"caveman ultra" removido** (D11). Apontava para ferramenta não instalada; o `~/.claude.json` registra as skills `caveman`/`caveman-learn` em `loggedAuthoredArtifactPaths`, criadas por sessão anterior e já apagadas do disco.
- [x] F0.6.4 — **Varredura de duplicação — FEITA.** As 7 regras restantes do `CLAUDE.md` (não ler repo inteiro, não abrir arquivo grande, procurar símbolo antes de editar, lint/build antes de concluir, test/build pesados, jamais commitar sem autorização, dúvida → parar, português) **já estavam todas no `AGENTS.md`** — auditoria de preservação (T2) com zero perdas, cada uma com a linha de origem citada. O arquivo passou a conter **só o que é específico do Claude Code**: pasta de skills, os 4 hooks locais, a exceção do `ast-grep` e o ponteiro para §Ordem de uso.
- [x] F0.6.5 — **Gate da fase:** zero contradições entre os dois arquivos (T0, comandos crus e caveman remedidos, todos em 0). `CLAUDE.md`: 26 → 24 linhas, 1.436 bytes, sem nenhuma regra duplicada do `AGENTS.md`.

---
## Fase 0.7 — versionar os hooks no repositório (risco médio, D14)

Resolve P1. Hoje os 4 hooks vivem em `~/.claude/hooks/`, **só nesta máquina e só para o Claude Code**. Enquanto isso valer, toda regra que virar hook **some** para o Codex e o OpenCode — o corte deixa de ser mudança de destino e vira apagamento (A2). É pré-requisito das Fases 3 e 4.

- [x] F0.7.1 — **Caminho definido — FEITO em 2026-09-10.** Os hooks vivem em **`.claude/hooks/`** (versionado), uma implementação só, alcançada pelos três harnesses por mecanismos diferentes. Medido, não suposto: Claude Code carrega via `.claude/settings.json` do projeto com `${CLAUDE_PROJECT_DIR}` (hooks de user/project/local **somam**, não se sobrescrevem); Codex via `<repo>/.codex/hooks.json`; OpenCode via plugin em `.opencode/plugins/` (auto-carregado, sem registro no `opencode.json`). `docs/agents/` era candidato (P2 obsoleta), mas `.claude/hooks/` já é o caminho que o Claude Code resolve nativamente.
- [x] F0.7.2 — **4 hooks movidos e provados.** `rtk-enforce`, `rtk-read-gate`, `git-commit-msg-gate`, `deploy-contract-gate` + suítes. Os 3 `cbm-*` do codebase-memory **não** entraram (ferramenta de terceiro), como previsto. **Achado corrigido:** `git-commit-msg-gate.test.js` tinha o caminho do hook hardcoded em `C:/Users/paulo/.claude/hooks/` — a suíte testaria a cópia antiga, não a versionada; trocado por `path.join(__dirname, …)`, como as outras duas já faziam.
- [x] F0.7.3 — **Suíte do `rtk-read-gate` escrita — 13 casos, 13/13 em duas execuções.** Cobre os dois lados (bloqueia acima do limite, lockfile e >5MB; passa arquivo pequeno, `offset`/`limit`, extensão isenta, arquivo inexistente, entrada malformada) e verifica que o motivo do deny traz o comando pronto. **Bug real encontrado pela própria suíte e corrigido:** `split('
').length` contava um elemento vazio a mais em arquivo terminado em newline — 600 linhas de conteúdo contavam 601, e o limite efetivo era **599**, não o `MAX_LINES` anunciado. Um gate sem teste não erra em silêncio só na teoria.
- [x] F0.7.4 — **Ligado nos três, com prova de execução.** O payload do `PreToolUse` do Codex é **idêntico** ao do Claude Code (`tool_name`, `tool_input.command`, e o mesmo `hookSpecificOutput`/`permissionDecision: deny`) — confirmado na doc oficial da OpenAI e testado: os 4 hooks devolveram `deny` recebendo payload no formato Codex. O OpenCode usa outro mecanismo (plugin JS, bloqueio por `throw`, não JSON), então `.opencode/plugins/governanca.js` converte um formato no outro e **reaproveita os mesmos arquivos** — uma implementação por regra, não três cópias divergindo. Testado: 6/6 (bloqueia `pnpm run lint`, `git commit --amend` e Read integral de arquivo grande; passa `git status`, Read com `offset` e tool sem hook). **Achado que evitou hook quebrado:** eu ia usar `${CODEX_PROJECT_DIR}`; a variável **não existe** (medido no binário 0.153.3) — trocado por caminho relativo à raiz.
- [x] F0.7.5 — **Gate da fase — paridade medida, sem célula suposta:**

| hook | Claude Code | Codex | OpenCode |
|---|---|---|---|
| `rtk-enforce` | ✓ settings do projeto | ✓ `.codex/hooks.json` | ✓ plugin (testado) |
| `git-commit-msg-gate` | ✓ | ✓ | ✓ (testado) |
| `rtk-read-gate` | ✓ | ✓ | ✓ (testado) |
| `deploy-contract-gate` | ✓ | ✓ (deny provado) | ✓ |
| suíte de teste | 4/4 (era 3/4) | mesma | mesma |

  **Limite honesto:** a execução ponta a ponta foi provada no Claude Code e por injeção de payload/plugin nos outros dois. Confirmação em sessão real do Codex e do OpenCode fica com a F0.5.5/F5.1 — mas o mecanismo está medido, não suposto.

---

## Fase 1 — apontar os destinos que já existem (risco baixo)

~56 linhas. Os destinos existem e funcionam; é a frente que ensina o mecanismo sem risco de perder regra.

- [x] F1.1 — Ponto de partida medido: **90.220 bytes / 608 linhas / 200 imperativos / 338 negritos**.
- [x] F1.2 — **§Review guidelines FICA — a task estava errada, e mover teria quebrado.** Investigado antes: a seção **não é instrução para o agente**, é o único lugar onde o bot Codex code-review (`chatgpt-codex-connector`) lê o escopo de revisão. Não existe `.codexignore`, e **bot não carrega skill** — apontar para `ciclo-de-review` desligaria a configuração em silêncio. Comprimida de 7 para 4 linhas, com o motivo de ficar escrito no próprio bloco para o próximo agente não repetir a tentativa. O `.coderabbit.yaml` já expressa o mesmo escopo de forma executável (`path_filters`).
- [x] F1.3 — **§Regras de Produto e SEO — resolvida por critério, não devolvida como pergunta.** Critério da prática atual: *o `AGENTS.md` explica restrição estável; a skill explica procedimento; regra que uma ferramenta já garante não se restata*. Aplicado linha a linha: **ficam** gratuidade/sem anúncios, Google OAuth único login, SEO inegociável e design system (restrição de produto que nenhuma ferramenta infere); **vira ponteiro** o checklist de Nielsen/ISO 9241-11 — procedimento, e as 5 skills de UX/WCAG/design existem em `.agents/skills/` e disparam pela tarefa desde a Fase 0.5; **deixa de ser imperativo** o "nunca hardcodar credencial Cloudinary", porque o TruffleHog (`secret-scan.yml`, medido) já barra — a ferramenta é a trava. P7 fechada.
- [x] F1.4 — **VM/Deploy reduzido ao que o `deploy-flow.md` NÃO cobre.** Medido antes de mover: ele cobre `cloudflared` paralelo (linha 314), segredo em histórico (308) e SQL destrutivo (164), mas **não cobre `worktree`** (zero ocorrências). Então worktree e acesso à VM **ficam**; tunnel paralelo e segredo viram ponteiro. As duas travas de **afirmação** de §Deploy (deploy só com `deploy_paths`; promote não deploya) permanecem, como a task exigia.
- [x] F1.5 — **Auditoria de preservação (T2): zero ausentes.** Cada fato removido conferido no destino — `cloudflared` e segredo no `deploy-flow.md`, TruffleHog no `secret-scan.yml` (4 ocorrências), Nielsen na skill (9).
- [x] F1.6 — **Gate da fase — nenhum número subiu:** bytes 90.220 → **90.030**; linhas 608 → **605**; imperativos 200 → **196**; negritos 338 → 338. **Achado lateral corrigido no mesmo trabalho:** o `AGENTS.md` afirmava em **três** lugares (300, 430, 576) que `docs/agents/` é gitignored — falso desde 2026-09-03 (`.gitignore:54`, `git ls-files docs/agents` = 14 arquivos). Uma delas dizia que o `deploy-flow.md`, que é o contrato de deploy, seria "invisível para CI e revisores".

---

## Fase 2 — densidade de ênfase (risco baixo, não move nada)

- [ ] F2.1 — Ler `plan.md` §Objetivo. Listar as **338 marcações em negrito** e classificar: quantas distinguem uma regra crítica das vizinhas, quantas são ênfase de hábito.
- [ ] F2.2 — Reduzir o negrito ao que de fato distingue. **Não apagar texto** — só a marcação. · feito quando: a contagem cai e nenhuma linha de conteúdo saiu (provado por `git diff --stat`: linhas alteradas, zero removidas).
- [ ] F2.3 — Mesma passagem para os **202 imperativos**: onde a mesma regra é reafirmada em dois lugares com palavras diferentes, manter a formulação mais forte e remover a repetição. **T5: não revisar a decisão, só a redundância.**
- [ ] F2.4 — **Gate da fase:** contagem antes/depois citada. · feito quando: densidade menor, conteúdo íntegro.

---

## Fase 3 — ferramentas (risco ALTO — já falhou uma vez)

177 linhas, 29% do arquivo. **A tentativa de 2026-09-03 perdeu 53 fatos** e foi revertida. Não repetir sem os pré-requisitos.

- [ ] F3.0a — **Bloqueio: a Fase 0.7 tem de estar fechada.** Sem paridade de hooks entre os três harnesses, transformar regra em hook não move a regra — apaga para o Codex e o OpenCode. · feito quando: F0.7.5 fechou.
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
- [ ] F4.5 — **Gate final:** `wc -c AGENTS.md` < **32.768** (cap do Codex, A1); `wc -l`, imperativos e negritos com delta citado. · feito quando: o alvo foi atingido, ou o desvio está nomeado com o motivo.

---

## Fase 5 — validar que funciona

O único teste que importa, e o que a spec não pode provar sozinha.

- [ ] F5.1 — Rodar uma sessão real de trabalho de código **em cada um dos três harnesses** (Claude Code, Codex, OpenCode) — validar em um só não valida o mecanismo (H10). Testar também a hipótese do *gênio literal* (H11): o Codex reage diferente do Claude à redução de imperativos? Observando: o agente sentiu falta de algo movido? Os gatilhos dispararam quando deveriam? Algum hook reprovou indevidamente?
- [ ] F5.2 — Registrar o resultado onde o mantenedor mandar. Se alguma regra movida deixou de ser cumprida, **devolvê-la ao `AGENTS.md`** — o alvo de tamanho perde para o requisito 2.

---

## Decisões pendentes do mantenedor

**Três das cinco foram decididas em 2026-09-10** e viraram task: P1 → Fase 0.7 (D14, versionar), P4 → F0.5.2 (D12, remover o `cavekit`), P5 → Fase 0.4 (D13, medir o truncamento). Restam:

| # | questão | por que importa |
|---|---|---|
| ~~P1~~ | ~~Versionar os hooks?~~ | **Decidido (D14): versionar.** Virou a Fase 0.7 |
| ~~P4~~ | ~~Destino das 8 skills do `cavekit`?~~ | **Decidido (D12): remover.** Virou F0.5.2 |
| ~~P5~~ | ~~Medir de que ponta o Codex trunca?~~ | **Decidido (D13): medir.** Virou a Fase 0.4 |
| ~~P2~~ | ~~`docs/agents/` continua gitignored?~~ | **Obsoleta (medido 2026-09-10):** deixou de ser gitignored em 2026-09-03; 14 arquivos versionados. Vira destino candidato dos hooks (F0.7.1) |
| ~~P6~~ | ~~Fonte de verdade das skills?~~ | **Resolvida (D15, 2026-09-10):** `.agents/skills/` canônica, 28 skills, pastas duplicadas removidas. Ver A7 |
| **P7** | **Destino de §Regras de Produto e SEO** | `ui-fidelity-audit` não cobre SEO/auth/analytics. Sem destino pronto, a Frente 1 não é "destinos já existem" para esse bloco (H9, F1.3) |
| P3 | Pegadinhas de interpretação: `AGENTS.md` ou skill? | Não são automatizáveis; é o caso em que T1 e o alvo de tamanho colidem de frente |
