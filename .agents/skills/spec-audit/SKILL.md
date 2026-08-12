---
name: spec-audit
description: Audita specs SDD e documentação operacional do Artifício RPG, cruzando spec.md, plan.md, tasks.md, backlog, sessões e project-state com código real usando Serena, LSP, codebase-memory-mcp e ferramentas locais. Use antes de implementar, antes de merge ou para revisar consistência documental.
---

# Auditoria de spec SDD

## Quando usar

Use para auditar uma spec SDD do Artifício RPG quando o pedido for:

* revisar spec antes de implementar;
* revisar spec antes de merge;
* auditar tasks;
* auditar débitos;
* auditar documentação operacional;
* conferir se uma spec está coerente com código, backlog, sessão e project-state;
* investigar se faltou registrar algo em `tasks.md`, na sessão ou em `specs/backlog.md`.

## Regras

* Não implemente código.
* Pode editar documentação da spec quando encontrar divergência: `spec.md`, `plan.md`, `tasks.md`.
* Não altere código-fonte.
* Jamais faça commit, push, merge ou PR sem autorização explícita do usuário.
* Não avance fase sem autorização.
* Trabalhe um item por vez.
* Se houver dúvida, pergunte em tom simples, com opções e impacto de cada opção.
* Não chute. Toda conclusão precisa de evidência.
* Use arquivo e linha sempre que possível.
* Não apague histórico sem justificativa.
* Não trate caminho feliz como prova suficiente.
* Achado fora do escopo da spec: **parar e perguntar** ao mantenedor se corrige agora ou registra débito (`AGENTS.md` §Bug achado — o agente nunca decide sozinho). Depois da resposta, registrar na sessão + `tasks.md` quando muda status/critério, e em `specs/backlog.md` quando for acionável fora desta spec.
* Achado que toque o frontend/backend do escopo da spec **é resolvido na própria spec**, não empurrado pra backlog.
* Se parecer falso positivo, registre a justificativa antes de descartar.

## Ferramentas

Use as ferramentas disponíveis em ordem de precisão.

1. `codebase-memory-mcp`

   * Use para recuperar contexto histórico, ADRs, decisões, specs relacionadas e estado anterior.
   * Não escreva novas memórias sem necessidade explícita.

2. Serena + LSP

   * Use para navegar símbolos, referências, dependências, diagnósticos e impacto entre módulos.
   * Prefira Serena/LSP quando a dúvida depender de relação real entre código e uso.

3. Busca estrutural e textual

   * Use `ast-grep` para padrões estruturais.
   * Use `rg` para localizar specs, tasks, débitos, reviews, decisões, sessões e usos diretos.

4. Git

   * Use `git status` e `git diff` para entender alterações locais.
   * Não faça commit.

5. Ferramentas de documentação e validação

   * `markdownlint-cli2`
   * `cspell`
   * `lychee`
   * `vale`
   * `pnpm run lint`
   * `pnpm run build`
   * `pnpm run test`

Não instale dependências sem autorização.

## O que auditar

Na spec indicada, verifique:

* `spec.md`
* `plan.md`
* `tasks.md`

Cruze com:

* `specs/backlog.md`
* `.specify/memory/project-state.md`
* `.specify/memory/decisions.md`
* `.specify/memory/errors.md`
* `sessoes/index.md`
* sessão vinculada em `sessoes/`
* specs relacionadas em `specs/`
* código real afetado pela spec

## Critérios

### spec.md

Verifique se:

* descreve o problema;
* tem requisitos numerados e testáveis;
* tem critérios de aceite;
* declara fora de escopo;
* registra riscos e impacto em outros módulos;
* não contém solução técnica detalhada que deveria estar no `plan.md`;
* aponta para a sessão vinculada em `sessoes/`.

### plan.md

Verifique se:

* descreve arquitetura da solução;
* lista arquivos afetados;
* identifica contratos/interfaces tocados;
* registra impacto em consumidores;
* define rollback;
* define validação verificável;
* considera impacto real encontrado via Serena/LSP.

### tasks.md

Verifique se:

* tasks são pequenas e verificáveis;
* cada task tem critério de conclusão;
* existe task final para atualizar `specs/backlog.md`, sessão e `project-state.md`;
* não há task ampla demais, vaga ou sem evidência.

### Débitos e reviews (não têm arquivo próprio)

`reviews.md` e `debitos.md` foram **deprecados**. Onde cada coisa vive agora:

* **Achado de review de bot** (CodeRabbit/Codex/Sonar/Amazon Q, depois do PR aberto) que **vira código**: o fix é commit normal **com comentário no próprio código**, citando origem (PR + bot + severidade), o que estava errado e por que a correção é essa — padrão `Achado real (review PR #NNN, <bot>, <P1|P2|nitpick>): …`, consolidado nesta base. Não é registro de documento: o comentário fica onde o próximo agente vai ler. Achado que **não** vira código (descartado, ou virou débito) vai pra `tasks.md` + `specs/backlog.md`, com o porquê. O agente **nunca** responde, comenta, resolve thread ou reage no PR (`AGENTS.md`) — isso é do mantenedor.
* **Achado desta auditoria** (investigação, build, teste, lint, revisão manual): vai pra `tasks.md` quando muda status/critério/próxima ação, e pra sessão sempre, com evidência concreta (comando, arquivo:linha, run, métrica ou URL).
* **Débito acionável fora desta spec**: linha em `specs/backlog.md`, com origem rastreável, evidência e próximo passo. IDs no padrão do arquivo (`BL-*` para fatia planejada, `D-*` para débito nomeado).
* **Débito que toca o frontend/backend do escopo da spec**: resolvido na própria spec, não empurrado pro backlog.

Auditando, verifique se:

* **correção de review de bot tem comentário no código** explicando origem/erro/razão — código corrigido sem comentário, ou com comentário genérico (`// fix review`), é achado da auditoria;
* comentário de decisão preexistente não foi **apagado** por edição posterior (`AGENTS.md`): se a razão mudou, devia ter sido reescrito, não removido;
* todo débito registrado em `specs/backlog.md` tem origem rastreável, evidência e próximo passo;
* nenhum achado ficou só no chat, sem registro em sessão/`tasks.md`/backlog;
* nenhum achado foi transformado em débito **sem o mantenedor ter respondido** — spec dizendo "decisão do mantenedor" sem a resposta de fato é o mesmo erro que mascarar bug (`AGENTS.md`).

### specs/backlog.md

Verifique se:

* pendências acionáveis da spec aparecem no backlog;
* débitos fechados estão marcados corretamente;
* status não contradiz spec, sessão ou project-state;
* não há pendência órfã sem spec, débito ou task relacionada.

### project-state.md e sessões

Verifique se:

* `project-state.md` só muda quando há estado operacional real;
* sessão vinculada existe;
* sessão registra evidências relevantes;
* sessão, tasks, backlog e project-state não se contradizem.

## Saída

Ao final, atualize a documentação da spec quando necessário e responda com:

```markdown
# Auditoria da spec

## Spec auditada

- Caminho:

## Resultado geral

- Status: aprovada / aprovada com ressalvas / bloqueada / precisa investigação

## Arquivos atualizados

-

## Achados

| ID | Severidade | Arquivo/Linha | Tipo | Resumo | Ação tomada |
|---|---|---|---|---|---|

## Débitos registrados

-

## Backlog/project-state/sessão

-

## Falsos positivos documentados

-

## Pendências

-
```

Depois da auditoria, pare. Não implemente código. Não faça commit.
