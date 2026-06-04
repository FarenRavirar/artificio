# BRANCH_POLICY.md

**Política de Branches para Spec-Driven Development (SDD)**

Este documento define as regras de nomenclatura, fluxo de trabalho e políticas de merge para features desenvolvidas sob o protocolo SDD no repositório `mesas_rpg_artificio`.

---

## Nomenclatura de Branches SDD

### Padrão Obrigatório

```
NNN-slug-descricao
```

**Componentes:**
- `NNN`: Número sequencial de 3 dígitos (001, 002, 003...)
- `slug-descricao`: Descrição curta em kebab-case (minúsculas, hífens)

**Exemplos:**
- `001-gate-migrations-refactor`
- `002-cloudinary-integration`
- `003-admin-activity-logging`

**Justificativa:**
Este formato é gerado automaticamente pelo Specify CLI e garante rastreabilidade entre branch, spec, plano de implementação e tarefas.

**Proibido para branches SDD:**
- Prefixos (`feature/`, `bugfix/`, `hotfix/`)
- Nomes sem número (`gate-migrations-refactor`)
- CamelCase ou snake_case

**Nota:** Este documento cobre branches SDD e consolida o fluxo atual de merge via PR. Branches não-SDD (`chore/`, `docs/`, `feature/` sem número) seguem as regras gerais de Git em `AGENTS.md`.

---

## Regra: 1 Feature SDD = 1 Branch

Cada feature SDD deve ser desenvolvida em uma única branch dedicada do início ao fim.

**Proibido:**
- Criar múltiplas branches para fases da mesma feature (ex: `001-gate-migrations-part1`, `001-gate-migrations-part2`)
- Fragmentar implementação em branches paralelas
- Reutilizar número de feature para trabalhos distintos

**Motivo:**
O número da feature é o identificador canônico que vincula spec → plan → tasks → commits → PR. Fragmentação quebra a rastreabilidade.

**Numeração:**
Números de feature SDD são **monotonicamente crescentes e irreversíveis**. Feature abandonada antes do merge mantém seu número "queimado" no histórico — a próxima feature sempre pega o número seguinte (nunca reutiliza número abandonado). Isso preserva rastreabilidade de commits e logs de sessão antigos.

---

## Política de Rebase vs Merge

### Dentro da Branch de Feature

**Permitido:**
```bash
# Atualizar branch de feature com mudanças de dev
git checkout 001-minha-feature
git fetch origin
git rebase origin/dev
git push origin 001-minha-feature --force-with-lease
```

**Alternativa (se preferir merge):**
```bash
git merge origin/dev
git push origin 001-minha-feature
```

Ambos são aceitáveis. Rebase mantém histórico linear; merge preserva contexto temporal.

### No Merge Final (PR para dev/main)

A estratégia de merge é definida pela **branch protection** configurada no GitHub (ver seção "Branch Protection Pós-Merge" abaixo).

**Método obrigatório:**
- ✅ Merge via GitHub PR (`gh pr merge <número>`)
- ❌ **NUNCA** merge local (`git merge dev` ou `git checkout main && git merge dev`)

**Motivo:**
Merge local com `git checkout` entre branches causa deleção temporária de arquivos, gerando pânico e risco de perda de trabalho. Ver `.specify/memory/errors.md` E143.

---

## Critérios de Merge em dev/main

### Merge em `dev` (Beta)

- [ ] CI/CD green (todos os checks do GitHub Actions passando)
- [ ] Testes de integração validados (se aplicável)
- [ ] Código revisado por mantenedor (se branch protection exigir)
- [ ] Sessão de trabalho documentada em `/sessoes/` e referenciada no PR

### Merge em `main` (Produção)

- [ ] **Todos os critérios de merge em dev** (acima)
- [ ] **Preflight GO:** Workflow `preflight-prod.yml` executado com status `GO` (sem drift I2/I3/I5)
- [ ] **Checklist executado:** `PRE_DEPLOY_CHECKLIST.md` completo (4 fases: validação, migrations, backup, deploy)
- [ ] **Playbook seguido:** promoção `dev` → `main` via GitHub PR, conforme `PRE_DEPLOY_CHECKLIST.md` e regra de nunca fazer checkout local entre `dev` e `main`
- [ ] **Validação beta:** Feature validada em `mesasbeta.artificiorpg.com` antes da promoção

**Referências:**
- `PRE_DEPLOY_CHECKLIST.md` — Checklist obrigatório antes de merge em main
- `AGENTS.md` — Aprovações, comandos bloqueantes e regra anti-checkout em deploy
- `.specify/memory/project-state.md` — Estado atual, branch ativa e próxima ação

---

## Branch Protection Pós-Merge

Após o merge da Feature 001 (`001-gate-migrations-refactor`) em `main`, o mantenedor deve ativar manualmente as seguintes proteções no GitHub:

### Proteções para `main`

- [ ] **Require pull request reviews before merging** (1 aprovação mínima)
- [ ] **Require status checks to pass before merging:**
  - [ ] `preflight-prod` (workflow `preflight-prod.yml`)
  - [ ] `ci` (workflow `ci.yml`)
  - [ ] `deploy-prod` (workflow `deploy-prod.yml`)
- [ ] **Require branches to be up to date before merging**
- [ ] **Do not allow bypassing the above settings** (sem bypass para admins)
- [ ] **Restrict who can push to matching branches** (apenas mantenedores)

### Proteções para `dev`

- [ ] **Require pull request reviews before merging** (opcional, pode ser 0 para agilidade)
- [ ] **Require status checks to pass before merging:**
  - [ ] `deploy-beta` (workflow `deploy-beta.yml`)
- [ ] **Allow force pushes** (desabilitado)

**Nota sobre workflows desabilitados:**
- `_enforce-migration-dir.yml` (prefixo `_` = desabilitado) pode ser ativado removendo o underscore se necessário
- `_lint-shell.yml` (prefixo `_` = desabilitado) pode ser ativado removendo o underscore se necessário

**Como ativar:**
1. Acessar `https://github.com/FarenRavirar/mesas_rpg_artificio/settings/branches`
2. Editar regras para `main` e `dev`
3. Marcar checkboxes conforme lista acima
4. Salvar alterações

### Reconciliação Inicial Obrigatória

**Ao subir a feature 001 em ambiente que já possui schema aplicado historicamente (beta concluído em 22/04/2026, prod pendente):**

1. **Aplicar manualmente `migration_114_add_applied_by.sql`** via `cat | docker exec -i` (bootstrap da coluna usada pelo próprio script de reconciliação). Ver E156 em `.specify/memory/errors.md`.

2. **Executar loop de `reconcile_migrations.sh --mark-applied`** para todas as migrations `[DISK_ONLY]` restantes.

3. **Validar com `--list`** que `[DISK_ONLY]` e `[DB_ONLY]` estão em 0.

4. **Só então disparar o deploy normal.**

**Motivo:** Schema histórico foi aplicado antes da tabela `schema_migrations` existir. Primeira aplicação da feature 001 detecta todas as migrations históricas como "pendentes" e bloqueia deploy com erro "Muitas migrations pendentes (N > 5)". Ver E154 em `.specify/memory/errors.md`.


---

## Referências Cruzadas

Para evitar duplicação, este documento **não** cobre:

- **Fluxo detalhado de promoção dev → main:** Ver `PRE_DEPLOY_CHECKLIST.md`
- **Problema com `git checkout` entre branches:** Ver `.specify/memory/errors.md` E143
- **Comandos Git e GitHub CLI:** Ver `AGENTS.md` e comandos de referência no `PRE_DEPLOY_CHECKLIST.md`
- **Regras de commit e sessões:** Ver `AGENTS.md` e `.specify/memory/constitution.md` §9
- **Migrations e drift detection:** Ver `migrations_guide.md` e `PRE_DEPLOY_CHECKLIST.md`
