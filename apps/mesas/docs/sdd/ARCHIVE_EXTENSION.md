# Archive Extension

**Versão:** 1.0.0  
**Repositório:** https://github.com/stn1slv/spec-kit-archive  
**Licença:** MIT

---

## Visão Geral

A extensão **Archive** é uma ferramenta de **arquivamento pós-merge** projetada para consolidar especificações, planos e débito técnico finalizados na memória canônica do projeto (`.specify/memory/`).

Esta extensão implementa o **"Outer Loop"** do framework **Double-Loop Parity**: garante que após um PR ser mergeado, o projeto se lembre dele corretamente.

---

## Por Que Isso Importa

Após uma feature ser mergeada, o conhecimento dela precisa ser consolidado na memória do projeto. Sem arquivamento estruturado:
- Especificações ficam dispersas em `specs/###-feature-name/`
- Decisões arquiteturais não são propagadas para `.specify/memory/`
- Débito técnico não é rastreado centralmente
- Próximos agentes não têm contexto das features anteriores

**Archive elimina essa lacuna** consolidando o conhecimento de features finalizadas na memória canônica do projeto, preservando rastreabilidade com tags `[Source: specs/###-feature-name]`.

---

## Funcionalidades

### 1. Separação de Ciclo de Vida
Opera puramente na fusão de conhecimento de nível de feature para nível de projeto. Não modifica código — apenas consolida documentação.

### 2. Consistência de Ecossistema
Usa o script core `check-prerequisites.sh` do Spec-Kit para resolução confiável de caminhos (lida com monorepos e estruturas aninhadas).

### 3. Rastreabilidade
Preserva tags `[Source: specs/###-feature-name]` e notas de revisão nos artefatos de memória principal.

### 4. Relatório
Exige caminhos absolutos no Relatório de Arquivamento final, garantindo que logs sejam sempre úteis independentemente do CWD.

---

## Instalação

A extensão foi instalada manualmente via download do repositório GitHub:

```powershell
# Download
Invoke-WebRequest -Uri "https://github.com/stn1slv/spec-kit-archive/archive/refs/tags/v1.0.0.zip" -OutFile "archive-v1.0.0.zip"

# Extração
Expand-Archive -Path "archive-v1.0.0.zip" -DestinationPath "."

# Instalação
New-Item -ItemType Directory -Path ".specify\extensions\archive" -Force
Copy-Item -Path "spec-kit-archive-1.0.0\*" -Destination ".specify\extensions\archive\" -Recurse -Force

# Limpeza
Remove-Item -Path "spec-kit-archive-1.0.0" -Recurse -Force
Remove-Item -Path "archive-v1.0.0.zip" -Force
```

**Registro:**
- `.specify/extensions/.registry` atualizado com hash SHA256 do manifest
- `AGENTS.md` atualizado com entrada na tabela de extensões

---

## Uso

### Comando Principal

```bash
/speckit.archive.run specs/###-feature-name
```

Arquiva a feature especificada na memória canônica do projeto.

### Opções de Escopo

Você pode restringir opcionalmente o escopo das atualizações:

```bash
/speckit.archive.run specs/001-gate-migrations-refactor --spec-only
/speckit.archive.run specs/001-gate-migrations-refactor --plan-only
/speckit.archive.run specs/001-gate-migrations-refactor --changelog-only
/speckit.archive.run specs/001-gate-migrations-refactor --agent-only
```

**Opções:**
- `--spec-only` — atualizar apenas `.specify/memory/spec.md`
- `--plan-only` — atualizar apenas `.specify/memory/plan.md`
- `--changelog-only` — atualizar apenas `.specify/memory/changelog.md`
- `--agent-only` — atualizar apenas o arquivo de conhecimento do agente

---

## Workflow

O comando executa as seguintes etapas:

### 1. Executar check-prerequisites.sh
Encontra os artefatos da feature ativa (`spec.md`, `plan.md`, `tasks.md`).

### 2. Verificar Conformidade com Constitution
Verifica que as implementações da feature não violam os "MUSTs" do projeto definidos em `.specify/memory/constitution.md`.

### 3. Realizar Impact Map
Faz até 5 perguntas de clarificação antes de prosseguir para garantir que o arquivamento seja preciso e completo.

### 4. Arquivar Dados
Anexa entidades, requisitos, dependências e notas de arquitetura na memória principal:
- `.specify/memory/spec.md` — requisitos e entidades
- `.specify/memory/plan.md` — decisões arquiteturais e padrões
- `.specify/memory/changelog.md` — histórico de mudanças
- Arquivo de conhecimento do agente (se aplicável)

Todas as entradas preservam tags `[Source: specs/###-feature-name]` para rastreabilidade.

### 5. Gerar Relatório
Fornece um relatório de status abrangente indicando:
- Arquivos alterados (com caminhos absolutos)
- Seções atualizadas
- O que você deve fazer a seguir

---

## Output

O comando gera um **Archival Report** estruturado contendo:

1. **Summary** — resumo executivo do arquivamento
2. **Files Modified** — lista de arquivos alterados com caminhos absolutos
3. **Sections Updated** — seções específicas atualizadas em cada arquivo
4. **Traceability** — tags `[Source: specs/###-feature-name]` adicionadas
5. **Next Steps** — ações recomendadas pós-arquivamento

---

## Quando Usar

Execute `/speckit.archive.run` após:
- Um PR de feature ser mergeado em `dev` ou `main`
- Uma feature SDD ser concluída e validada
- Você quiser consolidar conhecimento de uma feature na memória do projeto

**Não execute** durante:
- Desenvolvimento ativo de uma feature (antes do merge)
- Quando a feature ainda está em revisão
- Para features experimentais que podem ser revertidas

---

## Exemplo de Uso

```bash
# Após mergear PR #123 da feature 001
/speckit.archive.run specs/001-gate-migrations-refactor

# Arquivar apenas a spec (sem plan ou changelog)
/speckit.archive.run specs/001-gate-migrations-refactor --spec-only

# Arquivar apenas o changelog
/speckit.archive.run specs/001-gate-migrations-refactor --changelog-only
```

---

## Estrutura de Arquivamento

### Antes do Arquivamento

```
specs/001-gate-migrations-refactor/
  spec.md
  plan.md
  tasks.md
  
.specify/memory/
  spec.md          # Sem conhecimento da feature 001
  plan.md          # Sem decisões arquiteturais da feature 001
  changelog.md     # Sem histórico da feature 001
```

### Após o Arquivamento

```
specs/001-gate-migrations-refactor/
  spec.md
  plan.md
  tasks.md
  
.specify/memory/
  spec.md          # + Entidades e requisitos da feature 001 [Source: specs/001-gate-migrations-refactor]
  plan.md          # + Decisões arquiteturais da feature 001 [Source: specs/001-gate-migrations-refactor]
  changelog.md     # + Histórico de mudanças da feature 001 [Source: specs/001-gate-migrations-refactor]
```

---

## Princípios de Design

### 1. Lifecycle Separation
Arquivamento é uma operação pós-merge. Não interfere com desenvolvimento ativo.

### 2. Traceability First
Toda entrada arquivada preserva sua origem via tags `[Source: specs/###-feature-name]`.

### 3. Constitution Compliance
Verifica conformidade com regras do projeto antes de arquivar.

### 4. Impact Map
Faz perguntas de clarificação para garantir arquivamento preciso.

### 5. Absolute Paths
Relatórios usam caminhos absolutos para garantir utilidade independente do CWD.

---

## Requisitos

- Um projeto spec-kit com features em `specs/###-feature-name/`
- Artefatos de feature: `spec.md`, `plan.md`, `tasks.md`
- Memória canônica do projeto em `.specify/memory/`
- Script `check-prerequisites.sh` em `.specify/scripts/bash/`
- Um agente AI que suporta comandos slash spec-kit (Claude Code, GitHub Copilot, Gemini CLI, Cursor, Windsurf, etc.)

---

## Troubleshooting

| Mensagem | Significado | Ação |
|---|---|---|
| `ERROR: Feature directory not found: specs/###-feature-name` | O diretório da feature especificado não existe | Verifique o caminho da feature; use o formato `specs/###-feature-name` |
| `ERROR: Missing prerequisite: {file} not found in feature directory` | Um de `spec.md`, `plan.md` ou `tasks.md` está faltando | Complete os artefatos da feature antes de arquivar |
| `ERROR: Constitution violation detected: {rule}` | A implementação da feature viola uma regra "MUST" do projeto | Corrija a violação antes de arquivar |
| `WARNING: Memory file not found: {path}` | Um arquivo de memória esperado não existe | O arquivo será criado durante o arquivamento |
| `WARNING: Duplicate source tag detected: [Source: specs/###-feature-name]` | A feature já foi arquivada anteriormente | Verifique se o arquivamento é necessário; pode ser uma rearquivação |

---

## Complementar a Outras Extensões

### Archive + Verify-Tasks
- **Verify-Tasks** confirma que todas as tarefas foram implementadas
- **Archive** consolida o conhecimento da feature completa na memória do projeto
- **Ordem recomendada:** Verify-Tasks → Archive

### Archive + Reconcile
- **Reconcile** atualiza artefatos da feature para refletir drift de implementação
- **Archive** consolida os artefatos reconciliados na memória do projeto
- **Ordem recomendada:** Reconcile → Archive

### Archive + Status
- **Status** mostra o estado atual do workflow SDD
- **Archive** é executado após a fase "merged" do workflow
- **Uso:** Verifique status antes de arquivar para confirmar que a feature está pronta

---

## Referências

- **Repositório:** https://github.com/stn1slv/spec-kit-archive
- **README upstream:** `.specify/extensions/archive/README.md`
- **Comando principal:** `.specify/extensions/archive/commands/archive.md`
- **Manifest:** `.specify/extensions/archive/extension.yml`
