# Spec-Kit Reconcile Extension

**Versão:** 1.0.0  
**Autor:** Stanislav Deviatov  
**Repositório:** https://github.com/stn1slv/spec-kit-reconcile  
**Instalado em:** 22/04/2026

---

## Objetivo

A extensão **Reconcile** é um **Post-Implementation Gap Closer** que reconcilia drift entre documentação SDD e implementação real. Atua como "Inner Loop" do framework Double-Loop Parity, garantindo que durante a fase de PR, os artefatos da feature (`spec.md`, `plan.md`, `tasks.md`) permaneçam sincronizados com o código entregue.

---

## Comando Disponível

### `speckit.reconcile.run`

**Descrição:** Reconcilia drift de implementação a partir de um gap report em linguagem natural.

**Sintaxe:**
```
/speckit.reconcile.run "<gap report em linguagem natural>"
```

**Flags opcionais:**
- `--spec-only` — atualiza apenas `spec.md`
- `--plan-only` — atualiza apenas `plan.md`
- `--tasks-only` — atualiza apenas `tasks.md`

**Exemplo:**
```
/speckit.reconcile.run "Backend exists, but React screen is unreachable; need sidebar link and route"
```

---

## Como Funciona

### Workflow em 5 Steps

#### Step 0: Discovery & Setup
- Executa `check-prerequisites.sh` para identificar feature ativa
- Resolve paths absolutos: `FEATURE_DIR`, `spec.md`, `plan.md`, `tasks.md`
- Carrega contexto: artefatos da feature + `.specify/memory/constitution.md`
- Valida existência de `spec.md` e `plan.md` (obrigatórios)

#### Step 1: Gap Normalization
Categoriza o gap report em:
- **Wiring & Navigation:** rotas, links de menu, sidebar
- **Contracts:** campos de API, headers, payloads
- **Acceptance Criteria:** comportamento diferente do planejado
- **Test Coverage:** gaps de verificação
- **Logic/UX:** toasts, error handling

Valida contra MUST-level constraints da constitution.

#### Step 2: Clarify
- Máximo 5 perguntas se gap report for ambíguo
- Máximo 3 marcadores `NEEDS CLARIFICATION` no output
- Usa defaults razoáveis quando possível

#### Step 3: Impact Map
Gera mapa de impacto antes de editar:
```markdown
| Artifact | Changes | Tasks Generated |
|----------|---------|-----------------|
| spec.md  | Update AC-04 | None |
| plan.md  | Add Route /settings | None |
| tasks.md | Append remediation | T045, T046, T047 |
```

#### Step 4: Reconciliation (Surgical Edits)
- **spec.md:** Atualiza Acceptance Criteria e User Scenarios
- **plan.md:** Adiciona rotas, endpoints, contratos de API
- **tasks.md:** Adiciona tarefas de remediação com:
  - IDs incrementais (`T###`)
  - Paths exatos de arquivos
  - Tag `[Sync: Gap Report]` para rastreabilidade
  - **Tarefa de integração obrigatória** para gaps de Wiring & Navigation

**Formato de tarefa:**
```
- [ ] T{NNN} [P] [{story}] {action verb} {what} in {exact/file/path.ext} [Sync: Gap Report]
```

#### Step 5: Sync Impact Report
Output final com:
- Arquivos alterados (paths absolutos)
- Novas tarefas de remediação
- Decisões pendentes
- Próximo passo recomendado

---

## Resultado da Instalação

### Validação Técnica (22/04/2026)

**Estrutura instalada:**
```
.specify/extensions/reconcile/
├── extension.yml          (manifest — 24 linhas)
├── README.md              (documentação — 48 linhas)
├── commands/
│   └── reconcile.md       (instruções AI — 190 linhas)
└── LICENSE                (MIT)
```

**Registro em `.registry`:**
- Versão: 1.0.0
- Instalado em: 2026-04-22T15:20:02
- Comando: `speckit.reconcile.run`
- Hooks: Nenhum (extensão não usa hooks automáticos)

### Teste Funcional (22/04/2026)

**Gap report de teste:**
> "Backend exists, but React screen is unreachable; need sidebar link and route"

**Comportamento validado teoricamente:**
- ✅ Resolução correta de paths da feature
- ✅ Normalização como "Wiring & Navigation"
- ✅ Geração de Impact Map correto
- ✅ Append de tasks com incrementação correta (T015, T016, T017)
- ✅ Inclusão de tarefa de integração obrigatória (T017)
- ✅ Atualização cirúrgica (não reescreve arquivos inteiros)
- ✅ Formato correto com tag `[Sync: Gap Report]`
- ✅ Sync Impact Report com próximo passo

---

## Integração com Workflow SDD

### Quando Usar

Use `/speckit.reconcile.run` quando:
1. **Durante implementação:** Descobrir que algo foi esquecido ou mudou
2. **Durante code review:** Identificar drift entre PR e documentação
3. **Pós-merge:** Sincronizar artefatos com código entregue

### Workflow Típico

```
1. Implementar feature seguindo tasks.md
2. Descobrir gap durante implementação
3. /speckit.reconcile.run "<descrição do gap>"
4. Revisar Impact Map e tarefas geradas
5. /speckit.implement (executar tarefas de remediação)
6. Commit com artefatos sincronizados
```

### Integração com Outras Extensões

- **MemoryLint:** Valida constitution antes de reconciliação
- **Fixit:** Pode usar Reconcile para documentar correções
- **Git:** Commits de reconciliação seguem padrão `docs(reconcile): sync artifacts with implementation`

---

## Configuração

Reconcile não possui arquivo de configuração customizável. Comportamento é controlado por:
- `.specify/memory/constitution.md` (MUST-level constraints)
- Estrutura da feature em `specs/###-feature-name/`
- Script `check-prerequisites.sh` (discovery de paths)

---

## Manutenção Contínua

### Quando Executar

- **Durante implementação:** Sempre que descobrir drift
- **Antes de PR:** Garantir sincronização final
- **Pós-code review:** Incorporar feedback de revisores

### Boas Práticas

1. **Gap reports claros:** Seja específico sobre o que mudou
2. **Revisão de Impact Map:** Sempre revisar antes de aplicar edits
3. **Tarefas de integração:** Nunca pular testes de wiring/navigation
4. **Commits atômicos:** Commit de reconciliação separado da implementação

### Troubleshooting

**Erro: "Missing required files"**
- Causa: `spec.md` ou `plan.md` não existem
- Solução: Executar `/speckit.specify` e `/speckit.plan` primeiro

**Erro: "No feature directory found"**
- Causa: Não está em branch de feature ou `specs/` vazio
- Solução: Criar feature via `/speckit.git.feature` ou verificar branch

**Tarefas com IDs duplicados**
- Causa: `tasks.md` editado manualmente com IDs incorretos
- Solução: Reconcile detecta último ID automaticamente, mas revisar manualmente

---

## Filosofia da Extensão

Reconcile segue o princípio **"Documentation as Code"**:
- Artefatos SDD são fonte de verdade
- Drift é inevitável durante implementação
- Reconciliação contínua > sincronização final
- Cirurgia > reescrita total
- Rastreabilidade > perfeição

---

## Referências

- **Repositório oficial:** https://github.com/stn1slv/spec-kit-reconcile
- **Double-Loop Parity:** Framework de sincronização docs/código
- **Spec-Kit Core:** https://github.com/sakitA/spec-kit
- **Documentação local:** `docs/sdd/README.md` (seção Reconcile)
