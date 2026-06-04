# Retro Extension

**Versão:** 1.0.0  
**Repositório:** https://github.com/arunt14/spec-kit-retro  
**Licença:** MIT

---

## Visão Geral

A extensão **Retro** é uma ferramenta de **análise retrospectiva de sprint** projetada para avaliar ciclos de desenvolvimento completos com métricas objetivas e sugestões de melhoria acionáveis.

Esta extensão implementa um processo estruturado de retrospectiva que vai além de discussões subjetivas, fornecendo dados concretos sobre precisão de specs, efetividade de planejamento, qualidade de implementação e métricas git.

---

## Por Que Isso Importa

Após completar uma feature, é crucial refletir sobre o que funcionou e o que não funcionou. Sem retrospectivas estruturadas:
- Erros de estimativa se repetem
- Trabalho não planejado não é rastreado
- Padrões de qualidade não são identificados
- Aprendizados não são capturados
- Constitution não evolui com a experiência

**Retro elimina essa lacuna** fornecendo uma análise objetiva baseada em dados do ciclo de desenvolvimento, identificando tendências e sugerindo melhorias concretas que podem ser incorporadas à constitution do projeto.

---

## O Que Analisa

A extensão avalia **6 dimensões críticas**:

### 1. Spec Accuracy
Compara requisitos especificados vs. implementação real:
- Requisitos cumpridos completamente
- Requisitos parcialmente cumpridos
- Requisitos não implementados
- Funcionalidades não especificadas (scope creep)

### 2. Plan Effectiveness
Avalia qualidade do planejamento:
- Escopo de tasks (bem dimensionadas vs. muito grandes/pequenas)
- Trabalho não planejado (tasks adicionadas durante implementação)
- Estimativas vs. realidade
- Dependências não identificadas

### 3. Implementation Quality
Analisa qualidade da execução:
- Achados de code review
- Resultados de QA/testes
- Bugs encontrados pós-implementação
- Refactorings necessários

### 4. Git Metrics
Coleta métricas objetivas do repositório:
- Número de commits
- Arquivos alterados
- Linhas adicionadas/removidas
- Intervalo de datas (duração real)
- Padrão de commits (distribuição temporal)

### 5. Trends Across Retrospectives
Identifica padrões ao longo do tempo:
- Problemas recorrentes
- Melhorias consistentes
- Áreas de instabilidade
- Evolução de métricas

### 6. Actionable Improvements
Gera sugestões concretas:
- Ajustes de processo
- Melhorias de documentação
- Atualizações de constitution
- Treinamento necessário

---

## Instalação

A extensão foi instalada manualmente via download do repositório GitHub:

```powershell
# Download
Invoke-WebRequest -Uri "https://github.com/arunt14/spec-kit-retro/archive/refs/tags/v1.0.0.zip" -OutFile "retro-v1.0.0.zip"

# Extração
Expand-Archive -Path "retro-v1.0.0.zip" -DestinationPath "."

# Instalação
New-Item -ItemType Directory -Path ".specify\extensions\retro" -Force
Copy-Item -Path "spec-kit-retro-1.0.0\*" -Destination ".specify\extensions\retro\" -Recurse -Force

# Limpeza
Remove-Item -Path "spec-kit-retro-1.0.0" -Recurse -Force
Remove-Item -Path "retro-v1.0.0.zip" -Force
```

**Registro:**
- `.specify/extensions/.registry` atualizado com hash SHA256 do manifest
- `AGENTS.md` atualizado com entrada na tabela de extensões

---

## Uso

### Comando Principal

```bash
/speckit.retro.run
```

Executa retrospectiva completa do ciclo de desenvolvimento.

### Com Foco Específico

```bash
/speckit.retro.run spec-accuracy
/speckit.retro.run plan-effectiveness
/speckit.retro.run implementation-quality
```

Foca a análise em uma área específica.

---

## Workflow Position

A extensão Retro se encaixa no final do ciclo de desenvolvimento:

```
/speckit.specify → /speckit.plan → /speckit.tasks → /speckit.implement → 
/speckit.verify-tasks → /speckit.ship → /speckit.retro.run → (próximo ciclo)
```

**Quando executar:**
- Após mergear uma feature em `dev` ou `main`
- Após completar um sprint
- Após entregar uma release
- Periodicamente (ex: mensalmente) para análise agregada

---

## Output

### Retro Report

Relatórios são gerados em `FEATURE_DIR/retros/retro-{timestamp}.md` usando o template estruturado.

**Estrutura do relatório:**

```markdown
# Retrospective Report
**Feature:** {feature-name}
**Date:** {timestamp}
**Duration:** {start-date} to {end-date}

## 1. Spec Accuracy
- Requirements fulfilled: X/Y (Z%)
- Scope creep: N unspecified features
- Analysis: [detailed breakdown]

## 2. Plan Effectiveness
- Tasks completed as planned: X/Y (Z%)
- Unplanned work: N tasks added
- Analysis: [detailed breakdown]

## 3. Implementation Quality
- Code review findings: [summary]
- QA results: [summary]
- Post-implementation bugs: N
- Analysis: [detailed breakdown]

## 4. Git Metrics
- Commits: N
- Files changed: N
- Lines added: +N / removed: -N
- Duration: N days
- Commit pattern: [analysis]

## 5. Trends
- Recurring issues: [list]
- Improvements: [list]
- Stability: [assessment]

## 6. Actionable Improvements
1. [Specific improvement with rationale]
2. [Specific improvement with rationale]
3. [Specific improvement with rationale]

## 7. Constitution Updates (Optional)
Suggested additions to `.specify/memory/constitution.md`:
- [Rule/principle learned]
- [Rule/principle learned]
```

---

## Quando Usar

Execute `/speckit.retro.run` quando:
- Uma feature foi completamente implementada e mergeada
- Um sprint foi concluído
- Uma release foi entregue
- Você quer avaliar múltiplas features agregadas
- Periodicamente como ritual de melhoria contínua

**Não execute** durante:
- Desenvolvimento ativo de uma feature
- Antes de completar implementação e testes
- Para features experimentais não finalizadas

---

## Exemplo de Uso

```bash
# Após mergear feature 001
cd specs/001-gate-migrations-refactor
/speckit.retro.run

# Com foco em precisão da spec
/speckit.retro.run spec-accuracy

# Retrospectiva agregada de múltiplas features
cd specs/
/speckit.retro.run
```

---

## Integração com Constitution

Uma das funcionalidades mais poderosas do Retro é a capacidade de **atualizar a constitution** com aprendizados.

Quando padrões são identificados (ex: "tasks de migration sempre levam 2x mais tempo que estimado"), o Retro pode sugerir:

```markdown
## Suggested Constitution Update

Add to `.specify/memory/constitution.md`:

### Migration Task Estimation
**MUST** multiply initial estimates for migration tasks by 2x.
**Rationale:** Historical data shows migrations consistently take longer due to:
- Schema validation requirements
- Rollback testing
- Production reconciliation
- Data integrity checks

**Source:** Retro analysis of features 001, 005, 012 (2026-04-22)
```

---

## Métricas Coletadas

### Automáticas (via Git)
- Número de commits
- Arquivos alterados
- Linhas adicionadas/removidas
- Datas de primeiro e último commit
- Distribuição temporal de commits

### Manuais (via análise de artefatos)
- Requisitos da spec vs. tasks implementadas
- Tasks planejadas vs. tasks reais
- Achados de code review (se documentados)
- Resultados de QA (se documentados)

### Derivadas (via análise)
- Taxa de precisão da spec
- Taxa de efetividade do plano
- Velocidade de desenvolvimento
- Padrões de qualidade

---

## Complementar a Outras Extensões

### Retro + Verify-Tasks
- **Verify-Tasks** confirma que tasks foram implementadas
- **Retro** analisa se as tasks certas foram planejadas
- **Ordem:** Verify-Tasks → Retro

### Retro + Archive
- **Archive** consolida conhecimento da feature na memória do projeto
- **Retro** analisa o processo de desenvolvimento
- **Ordem:** Retro → Archive (retro informa o que arquivar)

### Retro + Optimize
- **Retro** identifica problemas de processo
- **Optimize** identifica problemas de governança
- **Uso:** Execute ambos periodicamente para melhoria contínua

---

## Limitações

### 1. Requer Disciplina de Documentação
Retro depende de artefatos bem documentados. Se `spec.md`, `plan.md` e `tasks.md` estão incompletos, a análise será limitada.

### 2. Métricas Git São Proxy
Número de commits e linhas de código são indicadores, não medidas definitivas de qualidade ou esforço.

### 3. Análise Qualitativa Requer Contexto
Sugestões de melhoria são baseadas em padrões, mas podem não capturar nuances específicas do projeto.

**Sempre combine Retro com:**
- Discussões de equipe
- Contexto de negócio
- Feedback de stakeholders
- Análise de métricas de produção

---

## Requisitos

- Um projeto Spec-Kit com features completas
- Artefatos SDD: `spec.md`, `plan.md`, `tasks.md`
- Repositório Git com histórico de commits
- Spec-Kit >= 0.1.0
- Um agente AI que suporta comandos slash spec-kit (Claude Code, GitHub Copilot, Gemini CLI, Cursor, Windsurf, etc.)

---

## Troubleshooting

| Mensagem | Significado | Ação |
|---|---|---|
| `ERROR: No feature directory found` | Comando executado fora de um diretório de feature | Execute dentro de `specs/###-feature-name/` |
| `ERROR: Missing spec.md` | Feature não tem especificação | Execute `/speckit.specify` primeiro |
| `ERROR: No git history found` | Diretório não está em um repo Git | Inicialize Git ou execute em repo válido |
| `WARNING: No tasks.md found` | Feature não tem tasks documentadas | Análise de plan effectiveness será limitada |
| `WARNING: Insufficient git history` | Menos de 3 commits na feature | Métricas git serão limitadas |

---

## Referências

- **Repositório:** https://github.com/arunt14/spec-kit-retro
- **README upstream:** `.specify/extensions/retro/README.md`
- **Comando principal:** `.specify/extensions/retro/commands/run.md`
- **Template de relatório:** `.specify/extensions/retro/commands/retro-template.md`
- **Manifest:** `.specify/extensions/retro/extension.yml`
