# Doctor Extension

**Versão:** 1.0.0  
**Repositório:** https://github.com/KhawarHabibKhan/spec-kit-doctor  
**Licença:** MIT

---

## Visão Geral

A extensão **Doctor** é uma ferramenta de **diagnóstico de saúde** projetada para escanear projetos Spec-Kit e reportar problemas em 6 áreas críticas.

Esta extensão atua como um **health check** abrangente, identificando problemas estruturais, de configuração e de integridade antes que causem falhas no workflow SDD.

---

## Por Que Isso Importa

Projetos Spec-Kit dependem de uma estrutura específica, configuração de agentes, artefatos de features e scripts funcionais. Quando algo está faltando ou mal configurado:
- Comandos SDD falham silenciosamente
- Features ficam incompletas sem detecção
- Scripts não executam por falta de permissões
- Extensões não carregam por registry corrompido
- Git workflow fica inconsistente

**Doctor elimina essa incerteza** escaneando o projeto e reportando problemas com sugestões de correção, permitindo que você corrija antes de começar o trabalho.

---

## O Que Verifica

A extensão escaneia **6 áreas críticas**:

### 1. Project Structure
Verifica se os diretórios essenciais estão presentes:
- `.specify/` — configuração do projeto
- `specs/` — especificações de features
- `scripts/` — scripts de automação
- `templates/` — templates SDD
- `memory/` — memória canônica do projeto

### 2. AI Agent Configuration
Verifica qual agente AI está configurado e se seus comandos existem:
- Detecta agente ativo (agy, codex, etc.)
- Verifica se comandos do agente estão disponíveis
- Reporta comandos faltantes

### 3. Feature Specifications
Para cada feature em `specs/###-feature-name/`, verifica:
- `spec.md` presente
- `plan.md` presente
- `tasks.md` presente
- Reporta features incompletas

### 4. Scripts Health
Verifica scripts bash e PowerShell:
- Scripts presentes em `.specify/scripts/`
- Permissões de execução (bash)
- Sintaxe válida (quando possível)

### 5. Extensions Health
Verifica integridade do sistema de extensões:
- `extensions.yml` válido
- `.registry` intacto
- Extensões registradas correspondem a diretórios existentes
- Manifests válidos

### 6. Git Status
Verifica estado do repositório Git:
- Projeto está em um repo Git
- Branch atual
- Status de working directory (clean/dirty)
- Commits não pushados

---

## Instalação

A extensão foi instalada manualmente via download do repositório GitHub:

```powershell
# Download
Invoke-WebRequest -Uri "https://github.com/KhawarHabibKhan/spec-kit-doctor/archive/refs/tags/v1.0.0.zip" -OutFile "doctor-v1.0.0.zip"

# Extração
Expand-Archive -Path "doctor-v1.0.0.zip" -DestinationPath "."

# Instalação
New-Item -ItemType Directory -Path ".specify\extensions\doctor" -Force
Copy-Item -Path "spec-kit-doctor-1.0.0\*" -Destination ".specify\extensions\doctor\" -Recurse -Force

# Limpeza
Remove-Item -Path "spec-kit-doctor-1.0.0" -Recurse -Force
Remove-Item -Path "doctor-v1.0.0.zip" -Force
```

**Registro:**
- `.specify/extensions/.registry` atualizado com hash SHA256 do manifest
- `AGENTS.md` atualizado com entrada na tabela de extensões

---

## Uso

### Comando Principal

```bash
/speckit.doctor.check
```

Executa diagnóstico completo do projeto.

### Alias

```bash
/speckit.doctor
```

Atalho para `/speckit.doctor.check`.

---

## Output

O comando gera um **Health Report** estruturado contendo:

### 1. Summary
Resumo executivo com contagem de:
- ✅ **Passed** — verificações bem-sucedidas
- ⚠️ **Warnings** — problemas não-críticos
- ❌ **Errors** — problemas críticos que bloqueiam workflow

### 2. Detailed Findings
Para cada área verificada:
- **Status** — PASS, WARN ou ERROR
- **Message** — descrição do problema
- **Suggestion** — como corrigir

### 3. Recommendations
Lista priorizada de ações recomendadas baseadas nos problemas encontrados.

---

## Exemplo de Output

```markdown
# Project Health Report

## Summary
- ✅ Passed: 12
- ⚠️ Warnings: 3
- ❌ Errors: 1

## Detailed Findings

### 1. Project Structure
✅ PASS — All required directories present

### 2. AI Agent Configuration
⚠️ WARN — Agent 'agy' configured but command 'speckit.agy.custom' not found
**Suggestion:** Check if extension providing this command is installed

### 3. Feature Specifications
❌ ERROR — Feature 'specs/001-gate-migrations' missing tasks.md
**Suggestion:** Run /speckit.tasks to generate tasks.md

### 4. Scripts Health
✅ PASS — All scripts present and executable

### 5. Extensions Health
⚠️ WARN — Extension 'custom-ext' in registry but directory not found
**Suggestion:** Remove entry from .registry or reinstall extension

### 6. Git Status
✅ PASS — On branch 'dev', working directory clean

## Recommendations
1. [CRITICAL] Generate tasks.md for feature 001-gate-migrations
2. [MEDIUM] Verify 'speckit.agy.custom' command availability
3. [LOW] Clean up registry entry for 'custom-ext'
```

---

## Quando Usar

Execute `/speckit.doctor` quando:
- Iniciar trabalho em um projeto Spec-Kit existente
- Após clonar um repositório
- Antes de executar comandos SDD críticos
- Após instalar/remover extensões
- Quando comandos SDD falham inesperadamente
- Periodicamente como manutenção preventiva

**Não execute** durante:
- Execução de outros comandos SDD (pode causar conflito)
- Em projetos não-Spec-Kit (reportará muitos erros esperados)

---

## Níveis de Severidade

### ✅ PASS
Verificação bem-sucedida. Nenhuma ação necessária.

### ⚠️ WARN
Problema não-crítico detectado. Workflow pode continuar mas com funcionalidade reduzida.

**Exemplos:**
- Comando de agente faltando (pode ser intencional)
- Extensão órfã no registry (não bloqueia)
- Working directory dirty (normal durante desenvolvimento)

### ❌ ERROR
Problema crítico que bloqueia workflow SDD.

**Exemplos:**
- Diretório `.specify/` faltando
- Feature sem `spec.md`
- Script crítico sem permissão de execução
- Registry corrompido

---

## Troubleshooting

| Mensagem | Significado | Ação |
|---|---|---|
| `ERROR: .specify/ directory not found` | Projeto não é um projeto Spec-Kit | Inicialize com `/speckit.init` ou verifique se está no diretório correto |
| `ERROR: Feature {name} missing spec.md` | Feature incompleta | Execute `/speckit.specify` para a feature |
| `WARN: Extension {name} in registry but directory not found` | Extensão foi removida mas registry não atualizado | Remova entrada do `.registry` ou reinstale extensão |
| `ERROR: Script {name} not executable` | Script bash sem permissão de execução | Execute `chmod +x {script}` |
| `WARN: Working directory dirty` | Há mudanças não commitadas | Normal durante desenvolvimento; commit quando apropriado |
| `ERROR: Not a git repository` | Projeto não está em controle de versão | Execute `git init` |

---

## Complementar a Outras Extensões

### Doctor + Status
- **Status** mostra estado atual do workflow SDD
- **Doctor** verifica integridade estrutural do projeto
- **Uso:** Execute Doctor primeiro para garantir que Status terá dados válidos

### Doctor + Verify-Tasks
- **Doctor** verifica se artefatos de feature existem
- **Verify-Tasks** verifica se tarefas foram realmente implementadas
- **Ordem recomendada:** Doctor → Verify-Tasks

### Doctor + Optimize
- **Doctor** verifica integridade estrutural
- **Optimize** otimiza governança e uso de tokens
- **Uso:** Execute Doctor antes de Optimize para garantir que não há problemas estruturais

---

## Limitações

### 1. Verificação Superficial
Doctor verifica **existência** de arquivos e estruturas, não **qualidade** do conteúdo. Um `spec.md` vazio passará na verificação.

### 2. Sem Validação de Sintaxe Profunda
Scripts são verificados para existência e permissões, mas não são executados ou validados sintaticamente em profundidade.

### 3. Sem Verificação de Lógica
Doctor não verifica se a lógica de features está correta, apenas se os artefatos necessários existem.

**Sempre combine Doctor com:**
- Code review manual
- Testes automatizados
- Verify-Tasks para verificação de implementação
- Optimize para verificação de governança

---

## Requisitos

- Um projeto Spec-Kit (ou diretório que deveria ser um)
- Spec-Kit >= 0.1.0
- Um agente AI que suporta comandos slash spec-kit (Claude Code, GitHub Copilot, Gemini CLI, Cursor, Windsurf, etc.)

---

## Referências

- **Repositório:** https://github.com/KhawarHabibKhan/spec-kit-doctor
- **README upstream:** `.specify/extensions/doctor/README.md`
- **Comando principal:** `.specify/extensions/doctor/commands/check.md`
- **Manifest:** `.specify/extensions/doctor/extension.yml`
