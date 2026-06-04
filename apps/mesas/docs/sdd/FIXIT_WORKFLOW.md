# Workflow: Spec-Kit Fixit

## Quando Usar

Após completar `/speckit.implement` e realizar testes manuais, quando você encontrar um bug.

## Pré-requisitos

- Feature implementada via `/speckit.implement`
- `spec.md` e `tasks.md` presentes no feature directory
- Pelo menos 1 task `[x]` em `tasks.md`

## Fluxo de Uso

1. **Testar manualmente** a feature implementada
2. **Identificar bug** específico
3. **Executar:** `/speckit.fixit.run <descrição clara do bug>`
4. **Revisar plano** proposto (root cause, changes, warnings)
5. **Aprovar ou rejeitar** o plano
6. **Validar correção** após aplicação

## Exemplo Completo

### Cenário
Feature 002 implementada: formulário de registro de mesa. Ao testar, você descobre que o botão "Publicar" permanece desabilitado mesmo após preencher todos os campos obrigatórios.

### Comando
```
/speckit.fixit.run o botão publicar permanece desabilitado após validação do formulário passar
```

### Output Esperado
```
🔍 Checking prerequisites...
✅ Feature directory: /path/to/specs/002-table-registration

📚 Loading context...
✅ spec.md found
✅ tasks.md found (23/23 completed)
✅ plan.md found
✅ constitution.md found
✅ SESSION_FAILURES_REGISTRY.md found
✅ Historical sessions: 45 files available

Context loaded: 6 sources

📍 Mapping bug to spec...
→ Searching spec for related sections...
→ Related spec sections found:
  42:User Story 2: Como mestre, quero publicar minha mesa
  67:Acceptance Criterion: Botão habilitado quando campos válidos

🔎 Locating affected files...
→ Candidate files from tasks.md:
  CreateTableForm.tsx
  useCreateTableForm.ts

📖 Searching historical sessions...
→ Related sessions found:
  - 26-04-13_4_correcao-race-condition-edicao.md

💡 Proposing fix...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 Fix Proposal
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Bug Description:
  o botão publicar permanece desabilitado após validação do formulário passar

Root Cause:
  [Analysis required - this is a proof-of-concept]
  Based on the bug description and context, manual investigation
  is needed to determine the exact root cause.

Planned Changes:
  [To be determined after root cause analysis]

Approach:
  1. Investigate affected files
  2. Identify root cause
  3. Apply minimal fix
  4. Test manually
  5. Commit changes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Approve fix? (yes/no):
```

## Iteração

Fixit é iterativo. Corrija um bug, teste, corrija o próximo:

```
/speckit.fixit.run o botão publicar permanece desabilitado
# [testar]
/speckit.fixit.run a mensagem de erro mostra "undefined" ao invés do nome do campo
# [testar]
/speckit.fixit.run o formulário não limpa após publicação bem-sucedida
```

Cada invocação é independente — sem estado entre runs.

## Escalation Warnings

### ⚠️ Scope Warning (4+ arquivos)
Fixit avisa quando correção toca 4 ou mais arquivos. Você pode:
- **Aprovar:** prosseguir com correção ampla
- **Rejeitar:** investigar manualmente se bug é mais complexo

### ⚠️ Spec Conflict
Fixit detecta quando correção contradiz requirement da spec. Exemplo:
- Spec diz: "Botão deve estar sempre visível"
- Correção proposta: "Ocultar botão quando formulário inválido"

Você pode:
- **Aprovar:** override (correção será aplicada com caveat no summary)
- **Rejeitar:** revisar spec primeiro, depois corrigir

### 🛑 Constitution Violation (Hard Block)
Fixit **não permite** correções que violem princípios MUST da constitution. Exemplo:
- Constitution: "TypeScript estrito. Proibido `any` implícito."
- Correção proposta: adicionar `@ts-ignore` ou `any`

Ação: **bloqueio automático**. Você deve encontrar solução alternativa.

## Integração com SESSION_FAILURES_REGISTRY.md

Fixit consulta automaticamente o registry de falhas (F01-F16) ao propor correções. Exemplo:

Se você reportar:
```
/speckit.fixit.run o commit agregou 3 arquivos quando deveria commitar apenas 1
```

Fixit reconhece **F01** (Agregação de commit via pre-commit hook) e propõe:
```
💡 Proposta de Correção:

Root Cause:
Hook em `.git/hooks/pre-commit` está fazendo `git add -A` automaticamente.
Relacionado a: SESSION_FAILURES_REGISTRY.md F01

Planned Changes:
1. Renomear `.git/hooks/pre-commit` para `.git/hooks/pre-commit.disabled`

Approach:
Desabilitar hook durante trabalho SDD conforme mitigação documentada em F01.
```

## Integração com Sessões Históricas

Fixit busca automaticamente em `/sessoes/` e `/sessoes/encerradas/` por bugs similares e padrões de correção aplicados anteriormente.

Exemplo de output:
```
📖 Searching historical sessions...
→ Related sessions found:
  - sessoes/encerradas/26-04-13_4_correcao-race-condition-edicao.md
  - sessoes/26-04-22_4_investigacao-selos-ddal-covil.md
```

Isso ajuda a identificar padrões de correção que já funcionaram no passado.

## Troubleshooting

### "No completed tasks" error
**Causa:** `tasks.md` não tem nenhuma task `[x]`  
**Solução:** Executar `/speckit.implement` primeiro

### "Missing spec.md" error
**Causa:** Feature directory não tem `spec.md`  
**Solução:** Executar `/speckit.specify` primeiro

### "Cannot locate feature directory"
**Causa:** Comando executado fora de contexto de feature SDD  
**Solução:** Navegar para branch de feature ou especificar feature explicitamente

## Limitações da Versão Atual

Esta é uma **versão proof-of-concept** da extensão Fixit. Funcionalidades implementadas:

✅ Validação de pré-requisitos  
✅ Carregamento de contexto (spec, tasks, plan, constitution, failures registry, sessions)  
✅ Mapeamento de bug para spec  
✅ Localização de arquivos afetados  
✅ Busca em sessões históricas  
✅ Proposta de correção com escalation warnings  

⏳ Funcionalidades futuras:
- Aplicação automática de correções
- Análise de root cause via IA
- Geração de testes para validar correção
- Integração com linters e type checkers
