---
name: new-spec
description: Cria o esqueleto de uma spec SDD do Artifício RPG em specs/NNN-<modulo>-<slug>/ com spec.md, plan.md e tasks.md a partir dos templates. Use ao iniciar qualquer trabalho SDD Completo (compartilhado, infra, migration, auth, importador, SEO, feature grande).
---

# Nova spec SDD

## Quando
SDD Completo (ver `docs/agents/operating-model.md`): toca `packages/*`, infra (tunnel/DNS), `accounts.` (SSO), CI/CD, migration, banco, dados pessoais, importador, contrato público/API, SEO estrutural, ou feature/refator grande.

## Passos
1. Descobrir o próximo `NNN` (sequencial global em `specs/`).
2. Criar `specs/NNN-<modulo>-<slug>/` com três arquivos.
3. Abrir/atualizar a sessão em `sessoes/` vinculando a spec.
4. Atualizar `project-state.md` se mudar o estado operacional.

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
```markdown
# Tasks — NNN
- [ ] T1 — <ação> · feito quando: <critério verificável>
- [ ] T2 — ...
```

## Regra
Spec antes de código. Sem solução técnica no `spec.md` (isso é `plan.md`). Tasks pequenas e verificáveis. Atualizar a sessão a cada etapa.
