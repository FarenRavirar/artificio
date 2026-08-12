---
name: new-spec
description: Cria uma spec SDD do Artifício RPG em specs/NNN-modulo-slug/ com spec.md, plan.md e tasks.md. Use ao iniciar trabalho SDD Completo.
---

# Nova spec SDD

## Quando usar

Use em trabalho SDD Completo: `packages/*`, infra, tunnel/DNS, `accounts.`, SSO, CI/CD, migration, banco, dados pessoais, importador, contrato público/API, SEO estrutural, feature grande, refator grande, auditoria ou revisão que possa gerar tasks, reviews ou débitos.

## Regras

* Spec antes de código.
* Não implemente nesta skill.
* Jamais faça commit, push, merge ou PR sem autorização explícita do usuário.
* Não avance fase sem autorização.
* Se houver dúvida, pergunte em tom simples, com opções e impacto de cada opção.
* Não chute. Registre evidência.
* Sem solução técnica no `spec.md`; isso é `plan.md`.
* Tasks pequenas, verificáveis e rastreáveis.
* **Toda fase termina com gate de cruzamento (obrigatório).** Ver §Gate de fase abaixo.
* **Requisito recebe ID (`R1`, `R2`…) e é citado nominalmente** pela task que o implementa e pelo gate que o valida. Requisito sem ID não é rastreável; task que não cita requisito nenhum é suspeita de estar fora do escopo aprovado.
* **Correção de review de bot é documentada em comentário NO PRÓPRIO CÓDIGO, referenciando a origem** — não em sessão, não em arquivo de review. Ver §Review de bot abaixo.
* Nunca responder, comentar, resolver thread ou reagir no PR (`AGENTS.md`: o agente não escreve na conversa do PR; isso é do mantenedor).
* Débito acionável que sair desta spec vai pra `specs/backlog.md`.
* **Débito ou achado que toca frontend/backend do escopo da spec é resolvido NA PRÓPRIA SPEC**, não empurrado pra backlog "pra depois". O agente não decide adiar; na dúvida, pergunta ao mantenedor (regra do mantenedor, 2026-07-25). Backlog é pra o que o mantenedor mandou sair, ou pro que é genuinamente de outra frente.
* Atualize sessão em `sessoes/`.
* Atualize `project-state.md` só se mudar estado operacional.

## Gate de fase (obrigatório em toda spec)

**Por que existe.** `tasks.md` é resumo. Quem implementa — em especial agente que entra frio numa fase, sem o contexto da investigação — tende a tratar a checklist como a verdade completa e perder o que só está escrito no `spec.md`/`plan.md`: requisito, decisão do mantenedor, armadilha já investigada, achado com arquivo:linha. O resultado é implementação que "fecha todas as tasks" e ainda assim não atende a spec. O gate fecha esse buraco.

**Regra.** Toda fase de `tasks.md` termina com **duas** tasks, nesta ordem:

1. 🔁 **GATE DE FASE** — penúltima task, antes do PR.
2. Verde local (`rtk tsc`/lint/test, `pnpm verify:api` quando aplicável) + PR.

O gate **nomeia** o que reler — nunca "revisar a spec" genérico, que não é verificável:

```markdown
- [ ] TN.x — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md` antes de fechar.**
  Reler os requisitos **R3, R4 e R9** da `spec.md` e as seções §"<nome exato>" e
  §"<nome exato>" do `plan.md`, e confirmar item por item que a implementação bate.
  Verificar em especial: <2 a 5 pontos concretos e verificáveis desta fase —
  travas objetivas, decisões do mantenedor, armadilhas registradas na investigação>.
  Divergência achada aqui = corrigir antes do PR, ou perguntar ao mantenedor se a
  spec é que está errada — nunca seguir o `tasks.md` contra a `spec.md` calado.
```

**O que o gate exige, sem exceção:**

* Achou divergência → **corrigir antes do PR**. Se a dúvida for se a spec está errada, **perguntar ao mantenedor**.
* **Nunca** seguir o `tasks.md` contra `spec.md`/`plan.md` em silêncio.
* **Nunca** fechar fase com requisito não atendido, nem "atendido em parte" (`AGENTS.md` §Conclusão de Tarefas proíbe conclusão parcial).
* Preferir ponto **objetivamente verificável** a julgamento: `git diff` sem caminho proibido, `package.json` sem dependência proibida, ordem de rota no router, ausência de N+1 por contagem de chamadas, campo sem HTML. Ponto que só se checa "no olho" vira smoke visual explícito.

**Gate final da última fase** (validação/fechamento) é mais amplo: percorrer **todos** os requisitos e critérios de aceite um por um, mais os gaps do §Problema, e reconferir as travas objetivas — não assumir que os gates de fase já cobriram. Requisito não atendido = spec não está pronta, mesmo com todas as tasks marcadas.

**Cobertura de teste.** A última fase também audita, por tabela, que cada arquivo novo/alterado tem `.test` correspondente, separando **novos** de **estendidos** e nomeando o caminho de cada um. Arquivo tocado sem teste = task reaberta.

## Review de bot: comentário no código, não em documento

Correção vinda de revisor automático (CodeRabbit, Codex, Sonar, Amazon Q, Snyk, GitHub Advanced Security) é documentada **no próprio código, no ponto corrigido**, referenciando a origem. Não vira registro em sessão nem em arquivo de review.

**Motivo:** o comentário fica onde o próximo agente vai ler — junto do código que ele pode desfazer sem saber por quê. Registro em documento separado se perde; comentário inline sobrevive ao refactor e explica a decisão no lugar em que ela importa. É a mesma razão da regra de `AGENTS.md` que proíbe apagar comentário explicativo em edição posterior.

**Formato já usado nesta base** (padrão consolidado, seguir):

```ts
// Achado real (review PR #201, Codex, P1): /ingest validava source_platform
// contra IMPLEMENTED_SOURCE_PLATFORMS (só as 5 fontes com scraper automático)
// — vestígio da Fase 5. Depois da Fase 6 (registry em banco), qualquer site
// cadastrado só via /gestao/plataformas nunca teria adapter em ADAPTERS, então
// /parse-html funcionava mas /ingest sempre devolvia 400.
```

Variações válidas, todas em uso: `Achado real (review PR #NNN, <bot>, <severidade>)`, `Achado de review PR #NNN (<bot>)`, `Achado de review PR #NNN (<bot>, nitpick)`.

**O comentário precisa conter:**

* **origem**: número do PR + qual bot (+ severidade quando o bot dá: `P1`/`P2`/`nitpick`);
* **o que estava errado de fato** — não "corrigido conforme review", que não ensina nada;
* **por que a correção é essa** — o raciocínio que o próximo agente precisaria reconstruir sozinho.

Vale igual em teste, migration (dentro do `@description` do header ou como comentário SQL), `Dockerfile` e config — não só em `.ts`.

**O que NÃO fazer:**

* comentário genérico (`// fix review`, `// ajuste do CodeRabbit`) — não documenta decisão nenhuma;
* apagar o comentário num refactor posterior; se a razão mudou, **reescrever** pra refletir a decisão atual, citando a origem nova (`AGENTS.md`);
* registrar a correção só em `tasks.md`/sessão e deixar o código sem explicação;
* escrever qualquer coisa na conversa do PR.

**O que continua em documento:** achado de review que **não** vira código agora — descartado (com o porquê) ou virou débito — vai pra `tasks.md` + `specs/backlog.md`, porque não há código onde comentar. Achado que vira commit é comentado no código.

## Antes de criar

Leia, se existirem:

* `docs/agents/operating-model.md`
* `.specify/memory/project-state.md`
* `.specify/memory/decisions.md`
* `.specify/memory/errors.md`
* `specs/backlog.md`
* `sessoes/index.md`
* specs relacionadas em `specs/`

Se já houver spec relacionada, avise e pergunte antes de duplicar.

## Passos

1. Descobrir o próximo `NNN` sequencial global em `specs/`.
2. Criar `specs/NNN-<modulo>-<slug>/`.
3. Criar:

   * `spec.md`
   * `plan.md`
   * `tasks.md`
4. Abrir ou atualizar sessão em `sessoes/` vinculando a spec.
5. Atualizar `specs/backlog.md` se houver débito ou pendência acionável.
6. Atualizar `project-state.md` se houver mudança operacional.
7. Parar e relatar. Não implementar.

## Conteúdo mínimo

### spec.md

```markdown
# NNN — <título>

- **Módulo/Pacote:** apps/<modulo> | packages/<pkg> | infra
- **Gate relacionado:** A | B | C | D | nenhum
- **Status:** aberto
- **Sessão:** sessoes/<arquivo>.md
- **Decisões de escopo:** o que estiver marcado como decidido **foi de fato decidido pelo
  mantenedor** (com data). Nada aqui é inferência do agente. Achado sem resposta ainda fica
  como pergunta aberta, nunca como decisão fechada.
- **Regra de débito desta spec:** débito/achado descoberto durante a implementação que
  toque o frontend/backend do escopo **é resolvido aqui**, não empurrado pra backlog. O
  agente não decide adiar; na dúvida, pergunta ao mantenedor.
- **Gate de fase:** cada fase de `tasks.md` termina com uma task 🔁 que obriga reler os
  requisitos e seções nomeados deste arquivo e do `plan.md` antes do PR. Divergência:
  corrigir, ou perguntar se a spec é que está errada — nunca seguir o `tasks.md` calado.

## Problema

<Um gap por subseção numerada, cada um com evidência de arquivo:linha ou comando/saída.
Se a versão anterior desta spec (ou outra doc) afirmava algo que o código desmente,
registrar a correção explicitamente — código é a verdade material (`AGENTS.md`).>

## Decisões de escopo tomadas pelo mantenedor (<data>)

### Entra

| Item | Decisão |
|---|---|

### Fica fora (decidido, não esquecido)

| Item | Motivo |
|---|---|

## Requisitos

- **R1:** <requisito testável, com ID citável pela task e pelo gate>

## Critérios de aceite

<Preferir critério objetivamente verificável a julgamento: valor exato em vez de
"não é null"; `git diff` sem caminho proibido; `package.json` sem dependência proibida;
contagem de chamadas em vez de "sem N+1". O que só se checa no olho vira smoke visual
explícito, com quem valida.>

## Fora de escopo

## Riscos e impacto em outros módulos
```

### plan.md

```markdown
# Plano — NNN

Base de fato: toda afirmação sobre estado atual abaixo foi verificada no código (arquivo
e linha citados), não em memória de chat. Rotas descobertas via `artificio-api-governance`
(`AGENTS.md` proíbe usar memória de chat como fonte primária de rota).

## Estado atual verificado (ponto de partida)

| Fato | Onde | Consequência pro plano |
|---|---|---|

<Uma linha por fato que muda a implementação — inclusive os que REDUZEM escopo
("isso já existe, o gap é outro") e as armadilhas ("esse schema descarta campo em
silêncio"). É o que o gate de fase relê.>

## Arquitetura da solução

<Seções com nome estável, para o gate poder citá-las: §"Backend — extração",
§"Frontend", etc. Nome de seção que muda quebra a referência do gate.>

## Arquivos afetados

## Contratos/interfaces tocados

## Impacto em consumidores

## Rollback

<Marcar explicitamente o que NÃO é reversível automaticamente e a mitigação.>

## Validação (como provo que funciona)

<Separar verificação objetiva (comando + resultado esperado) de smoke visual
(quem valida). Smoke visual real é obrigatório antes de fechar task de UI —
`AGENTS.md` proíbe declarar UI pronta sem ver rodando.>
```

### tasks.md

Spec pequena (uma entrega só) usa a forma linear abaixo. Spec com mais de uma frente usa fases, **uma por PR**, cada fase com seu 🔁 gate.

```markdown
# Tasks — NNN

**Modelo de entrega:** <linear | uma fase por PR>. Cada fase fecha sozinha:
código + teste + verde local, PR contra `dev`, bots revisam, achados analisados
na documentação, então a fase seguinte começa.

## 🔁 Gate de fase (obrigatório, penúltima task de TODA fase)

Cada fase termina com uma task **🔁 GATE DE FASE** antes do PR: reler os
requisitos e as seções **nomeados** da `spec.md`/`plan.md` e conferir a
implementação contra eles, item por item. Existe porque `tasks.md` é resumo e
quem implementa tende a ficar preso na checklist.

- Divergência → corrigir antes do PR; se a dúvida é se a spec está errada,
  **perguntar ao mantenedor**.
- **Nunca** seguir o `tasks.md` contra a `spec.md`/`plan.md` em silêncio.
- **Nunca** fechar fase com requisito não atendido nem "atendido em parte".
- Débito descoberto que toca o frontend/backend do escopo **é resolvido nesta
  spec**; o agente não decide adiar — na dúvida, pergunta.

## Pendências técnicas nomeadas (não bloqueiam começar, bloqueiam fechar)

| Onde | O que falta perguntar/decidir |
|---|---|
| T… | <dependência nova a aprovar, forma a escolher, verificação a fazer> |

**Ordem das fases importa:** <dependência real entre fases, se houver>.

---

## Fase 0 — Decisões de escopo (bloqueante, sem código)

- [ ] T0.1 — <decisão que o mantenedor precisa tomar antes de qualquer código>

## Fase 1 — <nome> · PR próprio

- [ ] T1.1 — <ação concreta> · atende **R<n>** · feito quando <evidência verificável>.
- [ ] T1.2 — Testes: **arquivo novo** `<caminho/Arquivo.test.ts>` | **estendido**
      `<caminho/Existente.test.ts>` — cobrindo <casos, incluindo o de regressão>.
- [ ] T1.3 — 🔁 **GATE DE FASE — cruzar com `spec.md` e `plan.md`.** Reler **R<n>, R<m>**
      e §"<seção>" do `plan.md`; confirmar <2-5 pontos objetivamente verificáveis>.
      Divergência = corrigir ou perguntar, nunca seguir calado.
- [ ] T1.4 — Verde local (`rtk tsc`/lint/test, `pnpm verify:api` se tocar rota) + PR.

## Fase N — Validação final e fechamento

- [ ] TN.0 — 🔁 **GATE FINAL — varredura completa.** Percorrer **todos** os requisitos
      e critérios de aceite um por um, mais os gaps do §Problema, e reconferir as
      travas objetivas — não assumir que os gates de fase cobriram. Requisito não
      atendido = spec não está pronta, mesmo com todas as tasks marcadas.
- [ ] TN.1 — `rtk tsc`/lint/build/test verdes.
- [ ] TN.2 — `pnpm verify:api` final (se tocou `apps/**`, `packages/**`, `scripts/api/**`, `docs/api/openapi/**`).
- [ ] TN.3 — **Auditoria de cobertura de teste**, por tabela: cada arquivo novo/alterado
      com seu `.test` correspondente, separando novos de estendidos, com o caminho de
      cada um. Arquivo tocado sem teste = task reaberta, não fechada.
- [ ] TN.4 — Achados de review de bot resolvidos: o fix que procede vira commit normal
      **com comentário no próprio código** citando origem (PR + bot + severidade), o que
      estava errado e por que a correção é essa — padrão `Achado real (review PR #NNN,
      <bot>, <P1|P2|nitpick>): …` já usado nesta base. O que **não** virou código
      (descartado, ou virou débito) vai pra `tasks.md` + `specs/backlog.md`, com o porquê.
      **Nunca** responder, comentar, resolver thread ou reagir no PR (`AGENTS.md`).
- [ ] TN.5 — Atualizar `specs/backlog.md`, sessão e `project-state.md`. Conferir que
      **nenhuma** pendência da tabela do topo ficou só no chat.
- [ ] TN.6 — Smoke real pós-deploy quando o aceite exigir execução (dry-run/plano/doc
      não fecham task executável — `AGENTS.md` §Erros que não podem se repetir).
```

## Se houver dúvida

Pergunte assim:

```text
Encontrei uma dúvida antes de continuar.

O ponto é: <explicação simples>.

Opções:
1. <opção A>
   Impacto: <impacto>
2. <opção B>
   Impacto: <impacto>

Qual caminho você prefere?
```

## Relatório final

```markdown
# Spec criada

- Caminho: `specs/NNN-<modulo>-<slug>/`
- Arquivos: `spec.md`, `plan.md`, `tasks.md`
- Sessão atualizada: sim/não
- Backlog atualizado: sim/não
- Project-state atualizado: sim/não
- Specs relacionadas encontradas:
- Requisitos com ID (`R1`…`Rn`): <quantos>
- Gate 🔁 em toda fase: sim/não — se não, qual fase ficou sem e por quê
- Gate final (varredura de todos os requisitos) presente: sim/não
- Tabela de cobertura de teste na última fase: sim/não
- Débitos iniciais (linha em `specs/backlog.md`, se houver):
- Pendências técnicas nomeadas (o que ainda falta perguntar ao mantenedor):
``
