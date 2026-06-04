# Verify-Tasks Extension

**Versão:** 1.0.0  
**Repositório:** https://github.com/datastone-inc/spec-kit-verify-tasks  
**Licença:** MIT

---

## Visão Geral

A extensão **Verify-Tasks** detecta **phantom completions** — tarefas marcadas como `[X]` em `tasks.md` que nunca foram realmente implementadas. O checkbox foi marcado, mas o código nunca foi escrito.

Este problema surge porque a predição autoregressiva de tokens não tem ancoragem no estado de execução. Quando o modelo marcou T001 a T024 como `[X]`, a continuação de maior probabilidade após a próxima descrição de tarefa é outro `[X]` — independentemente do que aconteceu no sistema de arquivos.

---

## Por Que Isso Importa

Uma parede de checkboxes marcados cria uma falsa sensação de conclusão. Quando um desenvolvedor confia nessa lista e avança — para code review, QA ou a próxima feature — está operando com um modelo mental que não corresponde à realidade. Essa dissonância entre progresso reportado e progresso real é custosa: bugs surgem mais tarde, trabalho de integração é construído sobre fundações ausentes, e a confiança em workflows assistidos por IA se deteriora.

**Verify-Tasks elimina essa lacuna** verificando independentemente cada tarefa `[X]` através de uma cascata de verificação de 5 camadas, produzindo um relatório estruturado em markdown com vereditos por tarefa, e então conduzindo você interativamente por cada item sinalizado.

---

## Como Funciona

Quando uma feature é marcada como "concluída" em `tasks.md`, não há verificação automática de que o código foi realmente escrito. O comando `/speckit.verify-tasks` fecha essa lacuna verificando independentemente cada tarefa `[X]` usando as seguintes camadas:

| Camada | Verificação | Método |
|---|---|---|
| 1 | Existência de arquivo | `test -f` / `find` |
| 2 | Presença no git diff | `git diff`, `git log` |
| 3 | Pattern matching de conteúdo | `grep -n` para símbolos declarados |
| 4 | Detecção de dead-code | `grep -rn` para referências de uso além do site de definição |
| 5 | Avaliação semântica | Agente lê código para stubs, placeholders e comportamento genuíno |

Cada tarefa recebe um de cinco vereditos:
- ✅ **VERIFIED** — Evidência mecânica forte + sem stubs detectados
- 🔍 **PARTIAL** — Arquivo existe mas evidência incompleta
- ⚠️ **WEAK** — Evidência mínima (apenas existência de arquivo)
- ❌ **NOT_FOUND** — Nenhuma evidência encontrada
- ⏭️ **SKIPPED** — Tarefa não verificável (documentação, comportamental)

---

## Instalação

A extensão foi instalada manualmente via download do repositório GitHub:

```powershell
# Download
Invoke-WebRequest -Uri "https://github.com/datastone-inc/spec-kit-verify-tasks/archive/refs/tags/v1.0.0.zip" -OutFile "verify-tasks-v1.0.0.zip"

# Extração
Expand-Archive -Path "verify-tasks-v1.0.0.zip" -DestinationPath "."

# Instalação
New-Item -ItemType Directory -Path ".specify\extensions\verify-tasks" -Force
Copy-Item -Path "spec-kit-verify-tasks-1.0.0\*" -Destination ".specify\extensions\verify-tasks\" -Recurse -Force

# Limpeza
Remove-Item -Path "spec-kit-verify-tasks-1.0.0" -Recurse -Force
Remove-Item -Path "verify-tasks-v1.0.0.zip" -Force
```

**Registro:**
- `.specify/extensions/.registry` atualizado com hash SHA256 do manifest
- `AGENTS.md` atualizado com entrada na tabela de extensões

---

## Uso

### Comando Principal

```bash
/speckit.verify-tasks
```

Verifica todas as tarefas `[X]` no `tasks.md` da feature atual.

### Filtros de Tarefas

```bash
/speckit.verify-tasks T003 T007
```

Restringe verificação a tarefas específicas.

### Escopo de Diff

```bash
/speckit.verify-tasks --scope branch
/speckit.verify-tasks --scope uncommitted
/speckit.verify-tasks --scope plan-anchored
/speckit.verify-tasks --scope all  # padrão
```

**Escopos de diff:**
- `branch` — arquivos modificados vs `origin/main` (ou `master`/`develop`)
- `uncommitted` — apenas mudanças staged e unstaged
- `plan-anchored` — todos os commits desde o campo `**Date**:` em `plan.md`
- `all` (padrão) — diff de branch + mudanças uncommitted

---

## Hook Automático

Após `/speckit.implement` finalizar, você será automaticamente solicitado:

> Run /speckit.verify-tasks in a fresh agent session to check for phantom completions.

O hook é **opcional** — abra uma nova sessão e execute `/speckit.verify-tasks` lá.

**💡 Recomendado:** Execute em uma sessão de agente fresca. O agente que executou `/speckit.implement` carrega contexto que o vicia a confirmar seu próprio trabalho. Executar `/speckit.verify-tasks` em uma sessão separada produz resultados mais confiáveis.

### Desabilitar Hook

Para desabilitar o hook, edite `.specify/extensions/verify-tasks/extension.yml`:

```yaml
hooks:
  after_implement:
    enabled: false   # set to true to re-enable
```

---

## Output

O comando escreve `verify-tasks-report.md` no diretório da feature (`$FEATURE_DIR/`) e imprime uma confirmação. O relatório contém:

1. **Summary scorecard** — contagens por nível de veredito
2. **Flagged items** — tarefas NOT_FOUND, PARTIAL, WEAK com detalhe por camada
3. **Verified items** — tarefas VERIFIED e SKIPPED

---

## Walkthrough Interativo

Após o relatório ser escrito, o comando entra em um **walkthrough sequencial** para cada item sinalizado em ordem de severidade (NOT_FOUND primeiro, depois PARTIAL, depois WEAK).

Para cada item, mostra a lacuna de evidência e oferece três opções:

| Opção | O que faz |
|---|---|
| **I** (Investigate) | Lê arquivos referenciados, executa buscas adicionais, e produz análise detalhada da lacuna |
| **F** (Fix) | Propõe um fix mínimo específico; não aplica até você confirmar com `y` |
| **S** (Skip) | Move para o próximo item sinalizado |

Responda `done` a qualquer momento para encerrar o walkthrough cedo. O agente apresenta exatamente um item por turno e nunca revela itens futuros antecipadamente.

Após o walkthrough completar, uma seção `## Walkthrough Log` é anexada ao relatório com a disposição de cada item sinalizado (investigated, fix proposed, skipped). A tabela de vereditos original não é modificada — serve como registro de auditoria.

Se fixes foram aplicados, re-execute `/speckit.verify-tasks` para uma reavaliação limpa.

---

## Precisão de Verificação por Tipo de Artefato

A cascata de 5 camadas é mais forte em **código de aplicação** (Python, JavaScript, TypeScript, Java, Go, etc.), onde nomes de função, definições de classe e grafos de import dão sinais claros às camadas mecânicas.

Para outros tipos de artefato, a cascata adapta suas estratégias de busca mas com precisão decrescente:

| Tipo de Artefato | Camadas 1–2 (arquivo + diff) | Camada 3 (content match) | Camada 4 (dead-code) | Confiança Geral |
|---|---|---|---|---|
| Código de aplicação | Forte | Forte | Forte | Alta |
| Migrations SQL, schemas | Forte | Moderada — busca por CREATE, ALTER, nomes de tabela | Skipped (consumido por migration runner) | Moderada |
| Arquivos de config (YAML, TOML, JSON, .env) | Forte | Moderada — matching de chave em texto plano | Skipped (consumido por runtime) | Moderada |
| Shell scripts | Forte | Moderada — busca por defs de função, atribuições de variável | Skipped (consumido por shell) | Moderada |
| Markdown, arquivos de prompt | Forte | Fraca — busca por cabeçalhos de seção, frases-chave | Skipped (consumido por agente) | Baixa–Moderada |
| Assets binários/gerados (imagens, PDFs, output compilado) | Forte (arquivo existe) | Não aplicável | Não aplicável | Baixa — apenas existência de arquivo |

Isso é **by design**. O modelo de erro assimétrico significa que a cascata sinalizará resultados incertos como PARTIAL ou WEAK em vez de silenciosamente passá-los. Um veredito WEAK em uma tarefa de migration SQL não significa que a migration está errada — significa que a ferramenta não conseguiu confirmar mecanicamente e quer que um humano dê uma olhada. Quando você vê WEAK ou PARTIAL em artefatos não-código, verifique-os brevemente durante o walkthrough interativo e pule se parecerem bem.

---

## Princípios de Design

A extensão é governada por oito princípios constitucionais. Os mais críticos:

1. **Modelo de Erro Assimétrico:** Um phantom completion perdido é catastrófico; um falso alarme é aceitável. Evidência ambígua sempre resulta em PARTIAL/WEAK, nunca VERIFIED.

2. **Independência do Agente:** Verificação produz resultados mais confiáveis em uma sessão separada do agente implementador, evitando viés de confirmação.

3. **Arquitetura Pure Prompt:** 100% dirigido por prompt. Sem scripts Python ou binários externos; apenas ferramentas shell (`grep`, `find`, `git`). Funciona em Claude Code, GitHub Copilot, Gemini CLI, Cursor, Windsurf e outros agentes spec-kit.

4. **Cascata de Verificação:** Camadas mecânicas (1-4) estabelecem evidência baseline. Avaliação semântica (camada 5) executa quando nenhuma camada mecânica retornou negativo, e pode rebaixar VERIFIED para PARTIAL quando detecta stubs ou placeholders.

Veja `.specify/extensions/verify-tasks/.specify/memory/constitution.md` para o conjunto completo de princípios.

---

## Complementar ao spec-kit-verify

A extensão comunitária **spec-kit-verify** pergunta: "A implementação satisfaz a spec?" É um gate de qualidade amplo que verifica cobertura de requisitos, cobertura de testes, alinhamento de intenção da spec e conformidade com constitution.

**verify-tasks** pergunta: "O agente realmente fez o que alegou ter feito?" Pega cada tarefa individual marcada `[X]`, rastreia até arquivos e símbolos específicos, e verifica evidência mecânica de implementação através de uma cascata de 5 camadas antes de recorrer à avaliação semântica.

| | spec-kit-verify | verify-tasks |
|---|---|---|
| **Unidade de análise** | Requisitos da spec, cenários, constitution | Tarefas individuais `[X]` em tasks.md |
| **Método de verificação** | Avaliação semântica do agente em 7 categorias | Cascata mecânica (grep, find, git diff) + detecção semântica de stub |
| **Modelo de erro** | Relatório de severidade balanceado | Assimétrico: phantoms perdidos são catastróficos, falsos positivos são aceitáveis |
| **O que detecta** | Desalinhamento spec-implementação | Tarefas marcadas como concluídas que nunca foram implementadas |
| **Recomendação de sessão fresca** | Não | Sim, para melhores resultados |

As duas extensões são **complementares**. Execute `verify` para verificar se a implementação está correta. Execute `verify-tasks` para verificar se está completa. Um phantom completion provavelmente passará em `verify` (o código que existe está bom) mas será detectado por `verify-tasks` (o arquivo específico da tarefa nunca foi criado ou modificado).

---

## Code Review e Testing

O comando `verify-tasks` confirma que o código existe e está conectado, não que está correto, eficiente, seguro ou bem testado. Uma função que existe, é importada e aparece no diff passará nas camadas mecânicas mesmo se tiver bugs. Camada 5 detecta stubs e placeholders, mas não erros de lógica.

**Sempre combine verificação com code review e uma suite de testes completa.**

---

## Requisitos

- Um projeto spec-kit com `tasks.md` dentro de um diretório de feature
- Um agente AI que suporta comandos slash spec-kit (Claude Code, GitHub Copilot, Gemini CLI, Cursor, Windsurf, etc.)
- `git` (opcional; camadas 2 e 4 são puladas graciosamente se indisponível)
- O script de pré-requisitos spec-kit em `.specify/scripts/bash/check-prerequisites.sh`
- Os seguintes comandos spec-kit core devem ter sido executados primeiro: `speckit.specify`, `speckit.plan`, `speckit.tasks`, `speckit.implement`. Estes produzem os artefatos (`tasks.md`, `plan.md`, `spec.md`) que `/speckit.verify-tasks` lê.

---

## Troubleshooting

| Mensagem | Significado | Ação |
|---|---|---|
| `ERROR: Missing prerequisite: {file} not found in feature directory: {path}` | Um de spec.md, plan.md ou tasks.md está faltando no diretório da feature | Execute `/speckit.specify`, `/speckit.plan` e `/speckit.tasks` primeiro para criar os artefatos necessários |
| `No completed tasks found to verify.` | Nenhuma tarefa `[X]` existe em tasks.md | Marque pelo menos uma tarefa como completa antes de executar verificação |
| `WARNING: Malformed task on line {n}: "{line}" -- skipping` | Uma linha tem sintaxe de checkbox quebrada ou nenhum ID de tarefa | Corrija a linha malformada em tasks.md; tarefas restantes ainda são verificadas |
| `WARNING: Git unavailable -- Layer 2 (Git Diff) skipped for all tasks.` | Nenhum diretório .git encontrado, ou git não está no PATH | Camadas 1, 3, 4 e 5 ainda executam; inicialize um repo git para cobertura completa |
| `WARNING: Shallow clone detected -- Layer 2 diff coverage may be incomplete.` | O repo foi clonado com --depth | Execute `git fetch --unshallow` para histórico completo |
| `WARNING: No date found in plan.md -- falling back to scope=all` | `--scope plan-anchored` foi solicitado mas plan.md não tem campo `**Date**: YYYY-MM-DD` | Adicione um campo de data ao plan.md, ou use um escopo diferente |
| `WARNING: Task ID not found: {id} -- skipping.` | Um ID de tarefa passado como argumento não existe em tasks.md | Verifique a ortografia do ID; use `/speckit.verify-tasks` sem argumentos para verificar todas as tarefas |
| `ERROR: Cannot write report to {path}: {reason}` | Problema de permissão do sistema de arquivos ou caminho | O relatório é impresso para stdout em vez disso; verifique permissões de diretório |

---

## Referências

- **Repositório:** https://github.com/datastone-inc/spec-kit-verify-tasks
- **README upstream:** `.specify/extensions/verify-tasks/README.md`
- **Comando principal:** `.specify/extensions/verify-tasks/commands/speckit.verify-tasks.md`
- **Constitution:** `.specify/extensions/verify-tasks/.specify/memory/constitution.md`
- **Fixtures de teste:** `.specify/extensions/verify-tasks/tests/fixtures/`
- **Vereditos esperados:** `.specify/extensions/verify-tasks/tests/expected-verdicts.md`
