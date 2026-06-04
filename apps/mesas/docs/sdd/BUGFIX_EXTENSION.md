# Spec-Kit Bugfix Extension

**Versão:** 1.0.0  
**Instalado em:** 22/04/2026  
**Repositório:** https://github.com/Quratulain-bilal/spec-kit-bugfix

---

## Objetivo

A extensão Bugfix adiciona um workflow estruturado para correção de bugs com rastreabilidade completa entre implementação e artefatos SDD (`spec.md`, `plan.md`, `tasks.md`).

**Problema resolvido:**
- Bugs descobertos durante implementação não eram capturados estruturadamente
- Gaps e conflitos de spec não eram registrados
- Desenvolvedores corrigiam código sem atualizar spec/plan/tasks (artifact drift)
- Tasks marcadas como completas eram incorretas, sem mecanismo de reabertura
- Sem verificação de consistência cross-artifact após bugfixes

---

## Comandos

### `/speckit.bugfix.report`

**Propósito:** Capturar bug e rastreá-lo até artefatos relevantes.

**Comportamento:**
1. Executa lookup obrigatório em `.specify/memory/errors.md` por ID/sintoma antes de qualquer diagnóstico
2. Classifica resultado como erro conhecido (match E###) ou erro novo (sem match)
3. Classifica o bug em 5 tipos (spec gap, spec conflict, implementation drift, untested flow, dependency issue)
4. Mapeia para user stories, requirements e tasks afetados por ID
5. Se não houver match no catálogo, exige protocolo mínimo de causa raiz
6. Salva relatório estruturado em `specs/{feature}/bugs/BUG-{NNN}.md` com seção de catalog lookup

**Modifica arquivos:** Sim — cria arquivo de bug report.

**Exemplo de uso:**
```
/speckit.bugfix.report "Auth flow não trata token expirado. Usuário fica preso em loop de redirect."
```

---

### `/speckit.bugfix.patch`

**Propósito:** Atualizar cirurgicamente spec/plan/tasks para corrigir o bug reportado.

**Comportamento:**
1. Executa lookup obrigatório em `.specify/memory/errors.md` antes de definir patch
2. Carrega bug report e todos os artefatos SDD
3. Determina patches mínimos necessários por tipo de bug
4. Atualiza `spec.md`:
   - Adiciona requirements faltantes
   - Marca conflitos com `~~strikethrough~~` + motivo
   - Adiciona success criteria para fluxos não testados
   - Adiciona nota de bugfix com data e ID
5. Atualiza `plan.md` (se existir):
   - Adiciona contexto para novos requirements
   - Preserva todo conteúdo existente
   - Adiciona nota de bugfix
6. Atualiza `tasks.md` (se existir):
   - Adiciona novas tasks com IDs sequenciais e dependências corretas
   - Reabre tasks indevidamente concluídas: `[ ]` + `(reopened — BUG-NNN)`
   - Adiciona prefixo `⚠️ Reopened` na descrição
   - Regenera Wave DAG se presente
   - Adiciona nota de bugfix
7. Marca bug report como `Patched` com data e status de catálogo (`Known error match: E###` ou `NEW_ERROR_PENDING_SYNC`)
8. Se for erro novo validado (`NEW_ERROR_PENDING_SYNC`), exige sincronização em `.specify/memory/errors.md` (canônico SDD)

**Modifica arquivos:** Sim — `spec.md`, `plan.md`, `tasks.md`, `BUG-{NNN}.md`.

**Regras críticas:**
- **Nunca regenera artefatos do zero** — apenas mudanças cirúrgicas
- **Nunca apaga conteúdo** — usa strikethrough para texto superado
- **Nunca deleta tasks** — reabre com anotação
- **Mudanças mínimas** — só o necessário para corrigir o bug específico

**Exemplo de uso:**
```
/speckit.bugfix.patch BUG-001
```

---

### `/speckit.bugfix.verify`

**Propósito:** Validar consistência cross-artifact após patches (read-only).

**Comportamento:**
1. Carrega todos os artefatos e bug reports
2. Verifica status de cada bug report (patched vs open)
3. Valida presença de `Catalog Lookup` e rastreabilidade de IDs E### para erros conhecidos
4. Valida consistência de `spec.md`:
   - Novos requirements têm acceptance criteria
   - Strikethrough items têm motivo documentado
   - Sem requirements duplicados
   - Bug IDs em notas correspondem a arquivos existentes
5. Valida consistência de `plan.md`:
   - Cada novo requirement tem seção correspondente
   - Sem referências a requirements removidos
   - Bugfix notes consistentes com spec.md
6. Valida consistência de `tasks.md`:
   - Cada novo requirement rastreável a pelo menos uma task
   - Nenhuma task marcada `[x]` que deveria estar reaberta
   - Tasks reabertas têm anotação `(reopened — BUG-NNN)`
   - IDs de tasks sequenciais sem duplicação
   - Dependências formam DAG válido (sem ciclos)
   - Wave DAG inclui todas as novas tasks
7. Falha verificação quando houver `NEW_ERROR_PENDING_SYNC` sem evidência de sync em `.specify/memory/errors.md`
8. Gera relatório de verificação com status de cada check

**Modifica arquivos:** Não — comando read-only.

**Exemplo de uso:**
```
/speckit.bugfix.verify
/speckit.bugfix.verify BUG-001
/speckit.bugfix.verify all
```

---

## Tipos de Bug

| Tipo | Descrição | Exemplo |
|------|-----------|---------|
| **Spec gap** | Requirement faltando na spec | Auth flow não trata token expirado |
| **Spec conflict** | Dois requirements se contradizem | "Deve ser stateless" vs "Deve rastrear sessões" |
| **Implementation drift** | Código diverge da spec | Spec diz REST, código usa GraphQL |
| **Untested flow** | Edge case não coberto | Atualizações concorrentes não tratadas |
| **Dependency issue** | Dependência externa mudou | Formato de resposta da API mudou |

---

## Workflow Completo

```
Bug descoberto durante /speckit.implement
       │
       ▼
/speckit.bugfix.report     ← Capturar bug, classificar, mapear para artefatos
       │
       ▼
/speckit.bugfix.patch      ← Atualizar cirurgicamente spec/plan/tasks
       │
       ▼
/speckit.bugfix.verify     ← Confirmar consistência cross-artifact
       │
       ▼
/speckit.implement         ← Retomar implementação com specs corrigidos
```

---

## Hooks

### `after_implement` (opcional)

**Gatilho:** Após conclusão de `/speckit.implement`  
**Comando:** `speckit.bugfix.verify`  
**Prompt:** "Run bugfix consistency check after implementation?"  
**Descrição:** Verifica consistência de artefatos spec após implementação completa

---

## Decisões de Design

1. **Report before patch** — sempre capturar e classificar o bug antes de modificar artefatos
2. **Surgical updates** — só mudar o necessário, nunca regenerar do zero
3. **Never delete content** — texto superado recebe strikethrough, preservando histórico
4. **Reopen, don't delete tasks** — tasks indevidamente concluídas são reabertas com anotação
5. **Bug report files** — cada bug tem arquivo próprio para rastreabilidade e histórico
6. **Consistent with Spec Kit patterns** — usa mesmo formato de refinement notes e staleness tracking

---

## Integração com Outras Extensões

### Fixit
- **Fixit:** correção de bugs em features **sem** artefatos SDD (brownfield)
- **Bugfix:** correção de bugs em features **com** artefatos SDD completos
- **Uso combinado:** Fixit para descobrir bug → Bugfix para corrigir specs se feature tiver SDD

### Reconcile
- **Reconcile:** reconcilia drift entre implementação e specs (gap report genérico)
- **Bugfix:** corrige bugs específicos com rastreabilidade completa
- **Diferença:** Reconcile para drift amplo, Bugfix para bugs pontuais com classificação

### MemoryLint
- **MemoryLint:** audita governança AI (AGENTS.md, constitution.md)
- **Bugfix:** corrige specs de features
- **Sem sobreposição:** domínios completamente distintos

### Optimize
- **Optimize:** otimiza governança AI (token usage, drift detection)
- **Bugfix:** corrige specs de features
- **Sem sobreposição:** domínios completamente distintos

---

## Troubleshooting

### Erro: "No bug report found"
**Causa:** Tentou executar `/speckit.bugfix.patch` sem bug report existente.  
**Solução:** Executar `/speckit.bugfix.report` primeiro para criar o bug report.

### Erro: "Feature directory not found"
**Causa:** Não está em branch de feature ou estrutura SDD não existe.  
**Solução:** Verificar branch atual e estrutura `specs/{feature}/`.

### Aviso: "Task ID collision"
**Causa:** Patch tentou criar task com ID já existente.  
**Solução:** Verificar último ID em `tasks.md` e ajustar sequência.

### Aviso: "Circular dependency detected"
**Causa:** Novas tasks criaram ciclo no DAG de dependências.  
**Solução:** Revisar dependências das tasks adicionadas e corrigir manualmente.

---

## Requisitos

- Spec Kit >= 0.4.0

---

## Referências

- Issue [#619](https://github.com/github/spec-kit/issues/619) — New `/bugfix` Slash Command (25+ upvotes, maintainer-approved as extension)
- Repositório: https://github.com/Quratulain-bilal/spec-kit-bugfix
- Licença: MIT
