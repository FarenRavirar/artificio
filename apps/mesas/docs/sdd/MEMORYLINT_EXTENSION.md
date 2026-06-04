# MemoryLint Extension — Governança de Memória AI

**Data de instalação:** 22/04/2026  
**Versão:** 1.3.0  
**Fonte:** https://github.com/RbBtSn0w/spec-kit-extensions/releases/tag/memorylint-v1.3.0

---

## Objetivo

MemoryLint é uma extensão do Spec-Kit que garante a separação correta entre:
- **`AGENTS.md`**: Regras de infraestrutura, workflows operacionais, protocolos de sessão
- **`.specify/memory/constitution.md`**: Regras arquiteturais, convenções de código, guardrails técnicos

A extensão atua como "guardião de boundaries", prevenindo vazamento de regras arquiteturais para o arquivo de governança operacional.

---

## Comandos Disponíveis

### `/speckit.memorylint.run`

**Tipo:** Hookable (opcional)  
**Hook:** `before_constitution`  
**Função:** Audita `AGENTS.md` e identifica regras arquiteturais que deveriam estar em `constitution.md`

**Ações executadas:**
1. **Prune (Limpeza)**: Extrai regras arquiteturais de `AGENTS.md`
2. **Enrich (Enriquecimento)**: Suplementa `AGENTS.md` com workflows de infraestrutura faltantes
3. **Context Handoff**: Passa regras extraídas para o contexto do agente (para merge em `constitution.md`)

**Quando usar:**
- Antes de atualizar `constitution.md`
- Quando suspeitar de vazamento de regras arquiteturais em `AGENTS.md`
- Durante auditorias de governança

### `/speckit.memorylint.load-agents`

**Tipo:** Hookable (obrigatório)  
**Hook:** `before_plan`  
**Função:** Carrega `AGENTS.md` no contexto do agente antes da fase de planejamento

**Ações executadas:**
1. Lê `AGENTS.md` do workspace root
2. Valida que o arquivo existe e é legível
3. Injeta regras no contexto para garantir aderência durante planejamento

**Quando usar:**
- Automaticamente executado antes de `/speckit plan`
- Gate obrigatório: se `AGENTS.md` não puder ser carregado, planejamento é bloqueado

---

## Regras de Boundary

### Pertence a `AGENTS.md` (Infraestrutura)

✅ **MANTER ou ADICIONAR:**
- Comandos de build, test, lint
- Git workflows, branch strategies, commit conventions
- Variáveis de ambiente e configurações de package manager
- Instruções de CLI e toolchain
- Comportamentos gerais de agente, protocolos de segurança
- Protocolos de sessão e documentação
- Roteamento de contexto entre documentos

### Pertence a `constitution.md` (Arquitetura)

✅ **EXTRAIR e REMOVER de AGENTS.md:**
- Lógica de camadas arquiteturais (MVC, Clean Architecture)
- Escolhas de state management (Redux, Zustand)
- Paradigmas de código (OOP vs FP)
- Princípios de error handling e design de API
- Restrições de lógica de negócio específicas do domínio
- Convenções de código (TypeScript strict, proibição de `any`)
- Guardrails técnicos (HTTP status codes, validação, timeouts)

---

## Auditoria Inicial (22/04/2026)

### Resultado

**Status:** ✅ **AGENTS.md está limpo**

- Nenhuma regra arquitetural encontrada em `AGENTS.md`
- Nenhum workflow de infraestrutura faltante
- Separação de boundaries está correta e bem mantida

### Análise Detalhada

**`AGENTS.md` contém (correto):**
- Protocolos de sessão (`/sessoes/`, formato de arquivo, checklist)
- Git workflows (branch policy, aprovações, proibições)
- Infraestrutura remota (SSH, Docker, PostgreSQL via VM Oracle)
- Gestão de contexto (hierarquia de leitura, roteamento de documentos)
- Protocolos de aprovação (comandos bloqueantes vs read-only)
- Formato de resposta e idioma

**`constitution.md` contém (correto):**
- Stack tecnológica (Node.js 22, TypeScript, React, PostgreSQL 16)
- Branch policy técnica (feature branches, PR para dev)
- Convenções de código (TypeScript estrito, proibição de `any`)
- Ciclo TDAD (estados de task: NOT STARTED, BLOCKED, RED, GREEN, DONE)
- Guardrails técnicos (status codes, validação, logs estruturados)
- Regras de commits atômicos e gate de evidência
- Protocolo de divergência e ADRs

**Referência cruzada existente:**
- Linhas 3-4 de `AGENTS.md` declaram subordinação a `.specify/arquiteture.md` para contratos técnicos
- Linha 39 de `AGENTS.md` referencia `.specify/memory/constitution.md` como fonte de regras SDD

---

## Integração com Workflow SDD

### Hook `before_constitution` (Opcional)

Quando executar `/speckit constitution`, o sistema pergunta:

```
Run MemoryLint to prune out-of-bounds architecture rules and enrich missing 
infrastructure guidelines in AGENTS.md? (y/n)
```

- **`y`**: Auditoria executa, governa `AGENTS.md`, extrai regras para contexto
- **`n`**: Hook é ignorado, geração de constitution prossegue normalmente

### Hook `before_plan` (Obrigatório)

Quando executar `/speckit plan`, o sistema automaticamente:

1. Executa `/speckit.memorylint.load-agents`
2. Carrega `AGENTS.md` no contexto
3. Valida que regras operacionais serão seguidas durante planejamento
4. **Se falhar**: Bloqueia planejamento com erro claro

---

## Manutenção Contínua

### Quando Re-auditar

- Após grandes mudanças em `AGENTS.md` (> 50 linhas)
- Antes de atualizar `constitution.md` com novas regras
- Quando novos agentes reportarem confusão sobre onde documentar regras
- Trimestralmente como parte de auditoria de governança

### Sinais de Vazamento de Boundaries

🚨 **Indicadores de que `AGENTS.md` pode ter regras arquiteturais:**
- Menções a padrões de design (MVC, Repository, Factory)
- Regras sobre estrutura de pastas de código
- Convenções de nomenclatura de funções/classes
- Regras sobre imports/exports
- Decisões sobre bibliotecas específicas (não toolchain)

✅ **Indicadores corretos (infraestrutura):**
- Comandos de terminal (`npm run`, `docker exec`, `ssh`)
- Protocolos de aprovação e segurança
- Estrutura de documentação (`/sessoes/`, `/specs/`)
- Workflows de Git (branch, PR, merge)
- Configurações de ambiente (variáveis, paths)

---

## Troubleshooting

### Erro: "Extension 'memorylint' is already installed"

**Causa:** Tentativa de reinstalar extensão já presente.

**Solução:**
```bash
# Remover extensão
specify extension remove memorylint

# Reinstalar
specify extension add memorylint --from https://github.com/RbBtSn0w/spec-kit-extensions/releases/download/memorylint-v1.3.0/memorylint.zip
```

### Erro: UnicodeEncodeError durante instalação

**Causa:** Console Windows com encoding cp1252 não suporta caracteres Unicode (✓).

**Impacto:** Apenas visual. Instalação completa com sucesso apesar do erro de renderização.

**Solução:** Ignorar erro. Verificar instalação com:
```bash
# Verificar registro
cat .specify/extensions/.registry | grep memorylint

# Verificar estrutura
ls .specify/extensions/memorylint/
```

### Hook `before_plan` falha: "could not load AGENTS.md"

**Causa:** `AGENTS.md` ausente, ilegível ou workspace root incorreto.

**Solução:**
1. Verificar que `AGENTS.md` existe na raiz do workspace
2. Verificar permissões de leitura
3. Verificar que workspace root está correto no Spec-Kit

---

## Referências

- **Repositório oficial:** https://github.com/RbBtSn0w/spec-kit-extensions
- **Release v1.3.0:** https://github.com/RbBtSn0w/spec-kit-extensions/releases/tag/memorylint-v1.3.0
- **Documentação local:** `.specify/extensions/memorylint/README.md`
- **Sessão de instalação:** `sessoes/26-04-22_7_instalacao-memorylint.md`

---

## Próximos Passos

1. **Governança contínua:** Executar `/speckit.memorylint.run` antes de grandes atualizações em `constitution.md`
2. **Treinamento:** Documentar no onboarding de novos agentes a separação de boundaries
3. **Auditoria trimestral:** Agendar revisão de boundaries a cada 3 meses
4. **Monitoramento:** Observar se novos agentes respeitam a separação durante sessões SDD
