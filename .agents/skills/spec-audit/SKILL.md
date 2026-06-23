---

name: spec-audit
description: Audita specs SDD e documentação operacional do Artifício RPG, cruzando spec.md, plan.md, tasks.md, reviews.md, debitos.md, backlog, sessões e project-state com código real usando Serena, LSP, codebase-memory-mcp e ferramentas locais. Use antes de implementar, antes de merge ou para revisar consistência documental.
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Auditoria de spec SDD

## Quando usar

Use para auditar uma spec SDD do Artifício RPG quando o pedido for:

* revisar spec antes de implementar;
* revisar spec antes de merge;
* auditar tasks;
* auditar débitos;
* auditar documentação operacional;
* conferir se uma spec está coerente com código, backlog, sessão e project-state;
* investigar se faltou registrar algo em `tasks.md`, `debitos.md` ou `specs/backlog.md`.

## Regras

* Não implemente código.
* Pode editar documentação da spec quando encontrar divergência: `spec.md`, `plan.md`, `tasks.md`, `reviews.md`, `debitos.md`.
* Não altere código-fonte.
* Jamais faça commit, push, merge ou PR sem autorização explícita do usuário.
* Não avance fase sem autorização.
* Trabalhe um item por vez.
* Se houver dúvida, pergunte em tom simples, com opções e impacto de cada opção.
* Não chute. Toda conclusão precisa de evidência.
* Use arquivo e linha sempre que possível.
* Não apague histórico sem justificativa.
* Não trate caminho feliz como prova suficiente.
* Se encontrar algo fora do escopo, registre como débito em `debitos.md`.
* Se o débito for acionável fora da spec, também registre em `specs/backlog.md`.
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
* `reviews.md`
* `debitos.md`

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
* aponta para `reviews.md` e `debitos.md`.

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
* tasks com débito apontam para `debitos.md`;
* tasks relacionadas a review apontam para `reviews.md`;
* não há task ampla demais, vaga ou sem evidência.

### reviews.md

Verifique apenas estrutura e consistência.

`reviews.md` é somente para reviews enviados pelo usuário depois da abertura de PR, vindos de bots, checks ou revisores automatizados do PR.

Não registre em `reviews.md` achados descobertos durante investigação, build, teste, lint, compilação ou revisão manual feita nesta auditoria. Esses achados devem ir para `tasks.md` ou `debitos.md`.

### debitos.md

Verifique se:

* todo débito tem ID;
* todo débito tem origem;
* todo débito tem task vinculada, quando possível;
* todo débito tem evidência;
* todo débito tem impacto, severidade, prioridade, status e critério de resolução;
* débitos acionáveis também aparecem em `specs/backlog.md`;
* débitos fora do escopo estão marcados como tal.

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
