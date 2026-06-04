# Spec-Kit Optimize Extension

**Versão:** 1.0.0  
**Instalado em:** 22/04/2026  
**Repositório:** https://github.com/sakitA/spec-kit-optimize

---

## Objetivo

Auditar e otimizar documentos de governança AI para eficiência de contexto. Projetado para desenvolvimento AI de longo prazo onde constituições crescem organicamente e acumulam dívida de tokens.

---

## Problema que Resolve

Em projetos AI-driven de longo prazo, a constituição é carregada em toda sessão AI. Com o tempo:

- **Token bloat:** Regras, exemplos e histórico acumulam custos de token
- **Rule decay:** Regras específicas de incidentes persistem para sempre
- **Non-deterministic governance:** Regras ambíguas causam comportamentos diferentes entre sessões
- **Governance echoes:** Mesma regra reescrita em múltiplos arquivos
- **No learning loop:** AI repete os mesmos erros sem mecanismo de captura de aprendizados

---

## Comandos Disponíveis

### `/speckit.optimize.run` — Constitution Audit

Analisa a constituição em 6 categorias:

1. **Token Budget Analysis** — custo por seção e densidade de governança
2. **Rule Health Analysis** — detecta regras obsoletas, específicas de incidentes, supersedidas
3. **AI Interpretability Analysis** — encontra ambiguidade, contradições, regras não aplicáveis
4. **Semantic Compression** — identifica clusters de regras colapsáveis, exemplos redundantes
5. **Constitution Coherence** — avalia balanceamento de princípios, dispersão de regras, cross-references
6. **Governance Echo Detection** — encontra duplicação entre arquivos e budget total de governança

**Uso:**
```bash
# Auditoria completa
/speckit.optimize.run

# Categoria única
/speckit.optimize.run --category token_budget

# Somente relatório (sem aplicar mudanças)
/speckit.optimize.run --report-only
```

**Quando usar:**
- Antes de grandes atualizações em `constitution.md`
- Quando governança exceder threshold de tokens
- Trimestralmente para manutenção preventiva

---

### `/speckit.optimize.tokens` — Token Usage Tracker

Mede o footprint de tokens de todos os arquivos de governança e comandos de extensão. Rastreia tendências ao longo do tempo.

**Uso:**
```bash
# Relatório completo
/speckit.optimize.tokens

# Comparar com relatório anterior
/speckit.optimize.tokens --diff

# Somente extensões (pular arquivos de governança)
/speckit.optimize.tokens --extensions-only
```

**Quando usar:**
- Após instalação de novas extensões
- Mensalmente para rastreamento de tendências
- Quando suspeitar de crescimento de governança

**Saída:** `.specify/optimize/token-report.md`

---

### `/speckit.optimize.learn` — Session Learning

Análise de fim de sessão: detecta padrões de erro AI, correções repetitivas e gaps de governança. Sugere regras de constituição ou entradas de memória para prevenir recorrência.

**Uso:**
```bash
# Análise completa de sessão
/speckit.optimize.learn

# Somente regras (sem sugestões de memória)
/speckit.optimize.learn --rules-only

# Analisar desde commit específico
/speckit.optimize.learn --since abc1234
```

**Quando usar:**
- Após sessões longas com múltiplas correções
- Quando AI repetir o mesmo erro 2+ vezes
- Para capturar aprendizados antes de encerrar feature

**Saída:** `.specify/optimize/learning-report-<date>.md`

---

## Resultado da Auditoria Inicial

**Data:** 22/04/2026 11:25 BRT  
**Comando:** `/speckit.optimize.tokens`

### Token Budget

| Métrica | Valor | Status |
|---|---|---|
| Governança base | 7,659 tokens | ✅ Saudável |
| % de 200K context | 3.8% | ✅ Abaixo de 20% |
| AGENTS.md | 5,086 tokens (66.4%) | ✅ Apropriado |
| constitution.md | 2,573 tokens (33.6%) | ✅ Apropriado |
| Total extensões | 19,836 tokens | ℹ️ Carregado por invocação |

### Extensões (por token cost)

1. **Optimize:** 10,345 tokens (maior extensão — esperado para auditoria)
2. **Brownfield:** 5,278 tokens
3. **Git:** 2,452 tokens
4. **MemoryLint:** 1,387 tokens
5. **Fixit:** 374 tokens

### Achados

✅ **Governança saudável:**
- 3.8% de overhead (bem abaixo do threshold de 20%)
- Sem drift de CLAUDE.md (centralização correta)
- Sem arquivos órfãos em `.specify/memory/`
- Distribuição apropriada entre operacional (AGENTS.md) e arquitetural (constitution.md)

✅ **Nenhuma otimização necessária no momento.**

**Relatório completo:** `.specify/optimize/token-report.md`

---

## Integração com Workflow SDD

### Comandos Relacionados

- **`/speckit.constitution`** — ferramenta de autoria. Optimize delega para ele ao aplicar mudanças aprovadas.
- **`/speckit.analyze`** — verificador de consistência. Executar após otimização para validar alinhamento entre artefatos.
- **`/speckit.optimize.tokens` → `/speckit.optimize.run`** — se tracker revelar overhead alto, executar auditoria completa.
- **`/speckit.optimize.learn` → `/speckit.constitution`** — regras aprovadas de session learning são aplicadas via constitution skill.

### Fluxo Recomendado

1. **Instalação:** `/speckit.optimize.tokens` (baseline)
2. **Manutenção mensal:** `/speckit.optimize.tokens --diff` (tendências)
3. **Após sessões longas:** `/speckit.optimize.learn` (capturar aprendizados)
4. **Trimestralmente:** `/speckit.optimize.run` (auditoria profunda)

---

## Configuração

**Arquivo:** `.specify/extensions/optimize/optimize-config.yml`

### Configurações do Projeto

```yaml
# Thresholds customizados para Mesas RPG Artifício
thresholds:
  max_constitution_tokens: 5000  # Projeto tem constitution.md + AGENTS.md
  governance_budget_percent: 20  # Governança distribuída
  principle_balance_ratio: 3.0
  file_growth_percent: 20

# Target context window
target_context_window: 200000

# Categorias (todas habilitadas)
categories:
  token_budget: true
  rule_health: true
  ai_interpretability: true
  semantic_compression: true
  coherence: true
  governance_echo: true

# Session learning
learn:
  min_corrections_to_flag: 2
  include_memory_suggestions: true
  include_rule_suggestions: true
```

---

## Filosofia de Design

### Suggest-Only by Default

Nada é modificado sem aprovação explícita. Fluxo: Analyze → Report → Propose → User Consent → Apply.

### Spec-Kit Standard Paths

Usa `.specify/memory/constitution.md` como caminho primário e segue redirects para layouts específicos do projeto.

### Semantic Preservation

Otimização remove redundância de expressão, não de intenção. Toda regra de governança sobrevive à compressão — apenas o custo de token muda.

---

## Manutenção Contínua

### Monitoramento Recomendado

1. **Track AGENTS.md growth:** Atualmente 5,086 tokens — monitorar acumulação de regras
2. **Watch for CLAUDE.md creation:** Duplicaria governança (atualmente limpo)
3. **Periodic audits:** Executar `/speckit.optimize.tokens --diff` mensalmente para detectar drift

### Gatilhos de Auditoria

Execute `/speckit.optimize.run` quando:
- Token budget exceder 15% de context window
- AGENTS.md crescer > 20% entre auditorias
- Após adicionar 3+ novas extensões
- Antes de grandes refactors de governança

---

## Troubleshooting

### "Extension not found"

Verificar registro:
```bash
cat .specify/extensions/.registry | grep optimize
```

Se ausente, reinstalar:
```bash
specify extension add optimize --from https://github.com/sakitA/spec-kit-optimize/archive/refs/tags/v1.0.0.zip
```

### "Config file not found"

Copiar template:
```bash
cp .specify/extensions/optimize/config-template.yml \
   .specify/extensions/optimize/optimize-config.yml
```

### Relatórios não salvos

Verificar permissões de escrita em `.specify/optimize/`

---

## Próximos Passos

1. **Baseline estabelecido:** Token report inicial salvo em `.specify/optimize/token-report.md`
2. **Próxima auditoria:** Agendar para 22/05/2026 (30 dias)
3. **Session learning:** Executar `/speckit.optimize.learn` após próxima feature SDD longa
4. **Constitution audit:** Executar `/speckit.optimize.run` se governança crescer > 10%

---

## Referências

- **Documentação oficial:** https://github.com/sakitA/spec-kit-optimize
- **Spec-Kit core:** `docs/sdd/README.md`
- **Extensão MemoryLint:** `docs/sdd/MEMORYLINT_EXTENSION.md` (complementar)
- **Governança do projeto:** `AGENTS.md` (seção "COMANDOS SPEC-KIT E EXTENSÕES")
