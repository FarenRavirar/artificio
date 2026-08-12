---
name: new-spec
description: Cria o esqueleto de uma spec SDD do Artifício RPG em specs/NNN-modulo-slug/ com spec.md, plan.md e tasks.md a partir dos templates. Use ao iniciar qualquer trabalho SDD Completo (compartilhado, infra, migration, auth, importador, SEO, feature grande).
---

# Nova spec SDD

## Quando
SDD Completo (ver `docs/agents/operating-model.md`): toca `packages/*`, infra (tunnel/DNS), `accounts.` (SSO), CI/CD, migration, banco, dados pessoais, importador, contrato público/API, SEO estrutural, ou feature/refator grande.

## Passos
1. Descobrir o próximo `NNN` (sequencial global em `specs/`).
2. **Levantar decisões de arquitetura/produto ANTES de escrever spec.md/plan.md/tasks.md** — não deixar como "pendente de decisão do mantenedor" dentro da spec pronta. Se a spec tem ponto que muda o raio da implementação (rota, pacote compartilhado, fórmula/cálculo, escopo de sort/filtro, etc.), perguntar via `AskUserQuestion` (lotes de até 4 perguntas) NA HORA, antes de redigir os três arquivos. **Spec só está pronta quando todas as decisões de produto/arquitetura já foram respondidas** — "decisão pendente" registrada dentro de spec.md/plan.md é sinal de spec incompleta, não de spec entregável. Exceção: achado técnico que só aparece DURANTE a investigação de código (ex. débito descoberto no meio da escrita) pode gerar pergunta nova a qualquer momento — mas some do "pendente" assim que respondida, spec final não carrega pergunta em aberto.
3. Criar `specs/NNN-<modulo>-<slug>/` com três arquivos, já refletindo as decisões da etapa 2 (nenhuma opção A/B sem escolha registrada).
4. Abrir/atualizar a sessão em `sessoes/` vinculando a spec.
5. Atualizar `project-state.md` se mudar o estado operacional.

## spec.md (o quê e por quê)
```markdown
# NNN — <título>
- **Módulo/Pacote:** apps/<modulo> | packages/<pkg> | infra
- **Gate relacionado:** A | B | C | D | nenhum
## Problema
## Requisitos (numerados, testáveis)
## Critérios de aceite
## Fora de escopo
## Riscos e impacto em outros módulos
```

## plan.md (como)
```markdown
# Plano — NNN
## Arquitetura da solução
## Arquivos afetados (por módulo/pacote)
## Contratos/interfaces tocados (auth/accounts? subdomínio/DNS? schema?)
## Impacto em consumidores (quem mais usa o que vou mexer)
## Rollback
## Validação (como provo que funciona)
```

## tasks.md (passos)

**Toda fase (Fase 0, Fase 1, Fase 2...) abre com estas 3 tasks fixas, nesta ordem, antes de qualquer task de conteúdo da fase** — não é boilerplate decorativo, é ordem de execução real:

```markdown
# Tasks — NNN

## Fase N — <nome da fase>
- [ ] TN.0a — Ler `AGENTS.md` inteiro (T0 pétreo — obrigatório toda sessão/toda fase nova, mesmo se já lido antes nesta mesma sessão) antes de agir nesta fase. · feito quando: leitura confirmada, gate/regra pétrea relevante à fase identificada.
- [ ] TN.0b — Usar `rtk` no lugar de comando cru equivalente durante toda a fase (`rtk git status/diff/log`, `rtk rg`, `rtk read`, `rtk pnpm`, `rtk tsc`, `rtk lint`, `rtk <test-runner>` — ver `AGENTS.md` §rtk pra lista completa). · feito quando: nenhum comando cru rodado onde `rtk` cobria o caso.
- [ ] TN.0c — Comunicação com o mantenedor nesta fase em português (`AGENTS.md` — regra de comunicação do projeto). · feito quando: mensagens da fase seguem o registro.
- [ ] TN.1 — <ação> · feito quando: <critério verificável>
- [ ] TN.2 — ...
```

Todas as decisões de arquitetura/produto que a fase depende já vieram fechadas do Passo 2 (levantadas antes da spec ficar pronta) — task de fase não deve conter "decisão pendente do mantenedor" a não ser achado técnico novo descoberto durante a própria implementação (aí sim, parar e perguntar, registrar a resposta, seguir).

## Regra
Spec antes de código. Sem solução técnica no `spec.md` (isso é `plan.md`). Tasks pequenas e verificáveis. Atualizar a sessão a cada etapa. Spec só é considerada pronta/entregável quando zero decisão de arquitetura/produto ficou em aberto — pendência vira pergunta ao mantenedor antes de fechar, nunca campo "a decidir" dentro do arquivo final.
