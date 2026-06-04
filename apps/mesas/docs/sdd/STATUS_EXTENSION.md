# Extensão Spec-Kit Status

**Versão:** 1.0.0  
**Autor:** KhawarHabibKhan  
**Repositório:** https://github.com/KhawarHabibKhan/spec-kit-status

---

## Objetivo

A extensão **Status** fornece um dashboard consolidado do estado atual do projeto SDD, exibindo informações sobre a feature ativa, artefatos disponíveis, progresso de tasks e fase do workflow.

## Problema Resolvido

Durante o desenvolvimento com Spec-Driven Development (SDD), é comum perder contexto sobre:
- Qual feature está ativa
- Quais artefatos já foram criados
- Quantas tasks foram concluídas
- Em qual fase do workflow o projeto está

A extensão Status resolve isso fornecendo uma visão unificada e instantânea do estado do projeto.

---

## Comandos

### `/speckit.status.show`

Exibe dashboard completo do estado SDD do projeto.

**Alias:** `/speckit.status`

**Comportamento:**
1. Executa script de coleta de dados (bash ou PowerShell conforme ambiente)
2. Parseia saída JSON com informações do projeto
3. Apresenta dashboard formatado com:
   - **Project info** — nome do projeto, agente AI detectado, tipo de script
   - **Current feature** — branch Git, variável `SPECIFY_FEATURE`, ou scan de `specs/`
   - **SDD artifacts** — status de `spec.md`, `plan.md`, `tasks.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/`, `checklists/`
   - **Task progress** — total de tasks, completas, pendentes, percentual
   - **Workflow phase** — fase atual (Not Started, Plan, Tasks, Implement, Complete)
   - **Extensions** — contagem de extensões instaladas

**Exemplo de uso:**
```
/speckit.status.show
```

**Saída esperada:**
```
# Project Status

## Project Info
- Name: mesas_rpg_artificio
- AI Agent: Antigravity (agy)
- Script Type: PowerShell + Bash
- Git Branch: dev

## Current Feature
- Feature: 001-migration-governance-pipeline
- Directory: specs/001-migration-governance-pipeline/

## SDD Artifacts
✓ spec.md
✓ plan.md
✓ tasks.md
✓ pr-description.md
✗ research.md
✗ data-model.md

## Task Progress
47/47 completed (100%)

## Workflow Phase
✓ Complete

## Extensions
7 extensions installed
```

---

## Workflow de Uso

### 1. Verificar Estado Inicial
```
/speckit.status
```

### 2. Identificar Próxima Ação
Com base na fase do workflow exibida:
- **Not Started** → executar `/speckit.specify`
- **Plan** → executar `/speckit.plan`
- **Tasks** → executar `/speckit.tasks`
- **Implement** → executar `/speckit.implement`
- **Complete** → feature pronta para PR

### 3. Monitorar Progresso
Executar `/speckit.status` periodicamente para acompanhar:
- Progresso de tasks
- Artefatos criados
- Fase do workflow

---

## Detecção de Feature Ativa

A extensão usa a seguinte ordem de prioridade para detectar a feature ativa:

1. **Branch Git** — extrai número/nome da branch (ex: `feature/001-migration-governance`)
2. **Variável de ambiente** — `SPECIFY_FEATURE` (ex: `001-migration-governance-pipeline`)
3. **Scan de `specs/`** — busca diretório mais recente em `specs/NNN-*/`

Se nenhuma feature for detectada, exibe mensagem informativa.

---

## Detecção de Fase do Workflow

| Artefatos Existentes | Fase | Próxima Ação |
|---|---|---|
| Nenhum | Not Started | `/speckit.specify` |
| `spec.md` apenas | Plan | `/speckit.plan` |
| `spec.md` + `plan.md` | Tasks | `/speckit.tasks` |
| `spec.md` + `plan.md` + `tasks.md` (incompleto) | Implement | `/speckit.implement` |
| Todos os artefatos + tasks 100% | Complete | Abrir PR |

---

## Contagem de Tasks

A extensão parseia `tasks.md` e conta:
- **Completas:** linhas com `- [x]` ou `- [X]`
- **Pendentes:** linhas com `- [ ]`

**Formato esperado em `tasks.md`:**
```markdown
- [x] T001: Criar spec.md
- [x] T002: Criar plan.md
- [ ] T003: Implementar feature
```

---

## Troubleshooting

### Erro: "No .specify/ directory found"

**Causa:** Projeto não inicializado com Spec-Kit.

**Solução:**
```bash
specify init
```

### Erro: "No features created yet"

**Causa:** Nenhuma feature foi criada em `specs/`.

**Solução:**
```
/speckit.specify
```

### Erro de encoding no Windows

**Causa:** PowerShell com encoding incompatível.

**Solução:** Usar PowerShell 7+ ou Git Bash.

### Feature não detectada corretamente

**Causa:** Branch não segue convenção ou variável `SPECIFY_FEATURE` não definida.

**Solução:**
```bash
# Definir manualmente
export SPECIFY_FEATURE="001-migration-governance-pipeline"
```

---

## Limitações

1. **Não valida conteúdo dos artefatos** — apenas verifica existência de arquivos
2. **Não detecta tasks fora do formato padrão** — requer `- [x]` ou `- [ ]`
3. **Não exibe detalhes de extensões** — apenas contagem (usar `specify extension list` para detalhes)
4. **Não valida consistência entre artefatos** — usar `/speckit.reconcile.run` para isso

---

## Boas Práticas

1. **Executar no início de cada sessão** — para recuperar contexto rapidamente
2. **Executar após cada comando SDD** — para confirmar mudanças de fase
3. **Usar como checkpoint** — antes de abrir PR, confirmar fase "Complete"
4. **Combinar com outras extensões:**
   - `/speckit.status` → visão geral
   - `/speckit.reconcile.run` → validação de consistência
   - `/speckit.bugfix.verify` → validação de rastreabilidade

---

## Integração com Outras Extensões

| Extensão | Integração |
|---|---|
| **Reconcile** | Status mostra artefatos; Reconcile valida consistência entre eles |
| **Bugfix** | Status mostra progresso; Bugfix atualiza tasks e artefatos |
| **Optimize** | Status conta extensões; Optimize audita governança |
| **MemoryLint** | Status detecta fase; MemoryLint valida regras arquiteturais |

---

## Decisões de Design

### Por que não validar conteúdo dos artefatos?

**Decisão:** Status é read-only e focado em visão rápida.

**Motivo:** Validação de conteúdo é responsabilidade de outras extensões (Reconcile, Bugfix).

### Por que não exibir detalhes de extensões?

**Decisão:** Apenas contagem de extensões instaladas.

**Motivo:** Detalhes disponíveis via `specify extension list`. Status prioriza informações de workflow SDD.

### Por que priorizar branch Git sobre `SPECIFY_FEATURE`?

**Decisão:** Branch Git é fonte mais confiável em projetos versionados.

**Motivo:** Branch reflete estado real do repositório; variável de ambiente pode estar desatualizada.

---

## Instalação

### Via CLI (se catálogo permitir)
```bash
specify extension add status
```

### Via URL (manual)
```bash
specify extension add --from https://github.com/KhawarHabibKhan/spec-kit-status/archive/refs/tags/v1.0.0.zip
```

### Manual (Windows com erro de encoding)
1. Baixar ZIP: https://github.com/KhawarHabibKhan/spec-kit-status/archive/refs/tags/v1.0.0.zip
2. Extrair para `.specify/extensions/status/`
3. Registrar manualmente em `.specify/extensions/.registry` (se necessário)

---

## Requisitos

- Spec Kit >= 0.1.0
- Git (opcional, mas recomendado)
- PowerShell 7+ ou Bash (para scripts de coleta)

---

## Changelog

### v1.0.0 (2026-04-22)
- Release inicial
- Dashboard consolidado de estado SDD
- Detecção automática de feature ativa
- Contagem de progresso de tasks
- Detecção de fase do workflow
- Suporte a múltiplos artefatos SDD
