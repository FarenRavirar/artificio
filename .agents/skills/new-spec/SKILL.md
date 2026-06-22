---

name: new-spec
description: Cria uma spec SDD do Artifício RPG em specs/NNN-<modulo>-<slug>/ com spec.md, plan.md, tasks.md, reviews.md e debitos.md. Use ao iniciar trabalho SDD Completo.
----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

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
* Reviews entram primeiro em `reviews.md`.
* Débitos entram em `debitos.md`.
* Débito acionável também precisa de linha em `specs/backlog.md`.
* Atualize sessão em `sessoes/`.
* Atualize `project-state.md` só se mudar estado operacional.

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
   * `reviews.md`
   * `debitos.md`
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
- **Reviews:** reviews.md
- **Débitos:** debitos.md

## Problema

## Requisitos

- **R1:** <requisito testável>

## Critérios de aceite

## Fora de escopo

## Riscos e impacto em outros módulos
```

### plan.md

```markdown
# Plano — NNN

## Arquitetura da solução

## Arquivos afetados

## Contratos/interfaces tocados

## Impacto em consumidores

## Rollback

## Validação
```

### tasks.md

```markdown
# Tasks — NNN

- [ ] T1 — Investigar escopo e specs relacionadas · feito quando houver evidência registrada.
- [ ] T2 — Planejar solução em `plan.md` · feito quando arquivos, contratos, impacto, rollback e validação estiverem definidos.
- [ ] T3 — Implementar escopo aprovado · feito quando a mudança estiver validada e documentada.
- [ ] T4 — Registrar reviews em `reviews.md` · feito quando bots, checks e revisões estiverem catalogados.
- [ ] T5 — Registrar débitos em `debitos.md` e `specs/backlog.md` · feito quando débitos acionáveis estiverem rastreados.
- [ ] T-final — Atualizar `specs/backlog.md`, sessão e `project-state.md` · feito quando pendências novas/fechadas estiverem refletidas no mapa geral.
```

### reviews.md

```markdown
# Reviews — NNN

| ID | Origem | Tipo | Referência | Severidade | Status | Task | Débito |
|---|---|---|---|---|---|---|---|

## REV-001 — <título>

- **Origem:** 
- **Tipo:** 
- **Referência:** 
- **Resumo:** 
- **Status:** aguardando investigação
- **Task vinculada:** 
- **Débito vinculado:** 
```

### debitos.md

```markdown
# Débitos — NNN

Débitos acionáveis também devem aparecer em `specs/backlog.md`.

| ID | Título | Origem | Task | Review | Severidade | Prioridade | Status | Backlog |
|---|---|---|---|---|---|---|---|---|

## DEB-001 — <título>

- **Origem:** 
- **Task vinculada:** 
- **Review vinculado:** 
- **Evidência:** 
- **Impacto:** 
- **Severidade:** 
- **Prioridade:** 
- **Status:** aberto
- **Backlog geral:** sim/não
- **Critério de resolução:** 
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
- Arquivos: `spec.md`, `plan.md`, `tasks.md`, `reviews.md`, `debitos.md`
- Sessão atualizada: sim/não
- Backlog atualizado: sim/não
- Project-state atualizado: sim/não
- Specs relacionadas encontradas:
- Débitos iniciais:
- Reviews iniciais:
- Pendências:
``