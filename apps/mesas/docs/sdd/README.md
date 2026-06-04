# SDD neste projeto

Usa Spec Kit oficial (github/spec-kit) adaptado. Convive com MDs canônicos da raiz — não os substitui.

## Quando usar
- Features médias/grandes que tocam backend + frontend.
- Mudanças de schema.
- Novos endpoints públicos.

## Quando NÃO usar
- Fix de typo, CSS, bump de dependência trivial — fluxo nativo do Antigravity.

## Como usar os Comandos SDD (Fluxo Recomendado)

Pense no SDD como um "assistente de projeto rigoroso". Em vez de pedir para o bot "fazer o código" e correr o risco dele apagar partes erradas, você dita os comandos em sequência. A cada passo, ele gera um documento para você aprovar antes de mexer no projeto real. 

### A Sequência Ideal (A Fase D)
Sempre que for iniciar uma nova feature siga cronologicamente este roteiro pedindo para a IA rodar o comando:

1. **/speckit.specify** (O Início de Tudo) 
   - *O que faz:* Abre instantaneamente uma nova branch segura no repositório isolando o desenvolvimento. Em seguida, escreve um rascunho oficial (a Spec) de como será sua feature baseada na sua ideia.
   - *Quando usar:* No exato momento em que quiser inventar, expandir ou construir uma tela/endpoint complexo pela primeira vez.

> *(Opcional)* **/speckit.clarify** (O Tira-Dúvidas)
> - *O que faz:* Se o requisito (Spec) da feature estiver vago, a inteligência faz 5 perguntas estratégicas para definir detalhes cruciais que faltaram (ex: "Qual a cor do botão?", "Quem tem permissão de ver a aba X?").

2. **/speckit.plan** (O Arquiteto)
   - *O que faz:* O agente para de escrever rascunho de ideia e escreve EXATAMENTE quais arquivos, pastas, linhas e migrations precisará modificar/criar.
   - *Quando usar:* Imediatamente após o `specify` ou `clarify` estarem com a Spec madura. É o seu projeto estrutural antes de gastar cimento.

> *(Opcional)* **/speckit.checklist** (Validação contra Bugs Futuros)
> - *O que faz:* Gera uma lista de verificações pro-ativas baseada no plano montado acima (ex: "Verificar tela em modo Mobile", "Verificar se o JWT tá ok").

3. **/speckit.tasks** (A Fila de Tarefas Atômicas)
   - *O que faz:* Pega o Plano do Arquiteto (`plan`) e vira Trello. Quebra o trabalho em tasks milimétricas (Setup, Testes, Core, Integração, Polish) para o agente não se perder na memória.
   - *Quando usar:* Quando o `plan` estiver 100% aprovado pela sua visão técnica.

> *(Opcional)* **/speckit.analyze** (O Auditor Interno)
> - *O que faz:* Cruza a Spec, o Plan e as Tasks pra checar se ele "esqueceu" alguma instrução ou se inventou arquivo que não deveria ao criar a lista. 

4. **/speckit.implement** (O Operário)
   - *O que faz:* Finalmente coloca a mão no código. Ele varre as tarefas atômicas uma a uma (escrevendo, compilando e testando).
   - *Quando usar:* Somente na última fase! Quando a branch, a spec, o plano e as tasks estiverem 100% aprovadas. Ao final ele mandará PR pro \`dev\`.

---

### Comando Isolado Especial
- **/speckit.constitution**
   - *O que faz:* Regera e molda a Constituição Base (as regras que toda as Specs vão seguir no futuro).
   - *Quando usar:* Raramente. Só quando o norte principal do projeto mudar (como migrar de PostgreSQL pra MongoDB, ou Node.js para Go).

- **/speckit.fixit.run <descrição do bug>**
   - *O que faz:* Corrige bugs com consciência da spec. Mapeia o bug para user story/requirement, localiza arquivos afetados, propõe plano de correção e aplica mudança mínima após aprovação.
   - *Quando usar:* Após `/speckit.implement`, quando testes manuais revelarem bugs. Comando reativo, não faz parte do fluxo principal.
   - *Exemplo:* `/speckit.fixit.run o formulário aceita email vazio`

### Comandos Brownfield (Adoção Incremental de SDD)

Estes comandos ajudam a integrar o projeto existente ao workflow SDD:

- **/speckit.brownfield.scan**
   - *O que faz:* Analisa o projeto existente para descobrir tech stack, arquitetura, convenções de código e estrutura de módulos. Gera um perfil completo do projeto.
   - *Quando usar:* Primeira vez configurando SDD em projeto existente, ou quando precisar atualizar o perfil após mudanças significativas na arquitetura.
   - *Saída:* `.specify/brownfield-project-profile.md`

- **/speckit.brownfield.bootstrap**
   - *O que faz:* Gera configuração customizada do Spec Kit baseada no perfil do projeto. Atualiza templates (spec, plan, tasks) para refletir a estrutura real do projeto (paths, comandos, frameworks).
   - *Quando usar:* Após o scan, para customizar templates genéricos com a arquitetura real do projeto.
   - *Saída:* Templates atualizados em `.specify/templates/`, relatório em `.specify/brownfield-bootstrap-report.md`

- **/speckit.brownfield.validate**
   - *O que faz:* Verifica se a configuração gerada pelo bootstrap corresponde à estrutura real do projeto. Detecta drift (mudanças não documentadas) e valida paths, frameworks e convenções.
   - *Quando usar:* Após o bootstrap, ou periodicamente para detectar divergências entre documentação e código.
   - *Saída:* `.specify/brownfield-validation-report.md`

- **/speckit.brownfield.migrate**
   - *O que faz:* Traz features existentes para o workflow SDD. Faz engenharia reversa de specs a partir do código, reconstrói plan.md e gera tasks.md com todas as tarefas marcadas como completas. Identifica gaps (testes faltando, documentação ausente).
   - *Quando usar:* Para formalizar features já implementadas que não possuem specs, ou para criar documentação retroativa de funcionalidades críticas.
   - *Saída:* `specs/NNN-feature-name/{spec.md,plan.md,tasks.md}` com status `migrated`

**Fluxo Brownfield Completo:**
1. `/speckit.brownfield.scan` → gera perfil do projeto
2. `/speckit.brownfield.bootstrap` → customiza templates
3. `/speckit.brownfield.validate` → verifica alinhamento
4. `/speckit.brownfield.migrate` → formaliza features existentes
5. Novas features seguem fluxo normal (specify → plan → tasks → implement)

---

### Comandos MemoryLint (Governança de Memória AI)

Extensão que garante separação correta entre regras de infraestrutura (`AGENTS.md`) e regras arquiteturais (`.specify/memory/constitution.md`).

- **/speckit.memorylint.run**
   - *O que faz:* Audita `AGENTS.md` e identifica regras arquiteturais que deveriam estar em `constitution.md`. Executa duas ações: **Prune** (extrai regras arquiteturais de `AGENTS.md`) e **Enrich** (suplementa `AGENTS.md` com workflows de infraestrutura faltantes).
   - *Quando usar:* Antes de atualizar `constitution.md`, quando suspeitar de vazamento de regras arquiteturais em `AGENTS.md`, ou durante auditorias de governança.
   - *Hook:* `before_constitution` (opcional)
   - *Saída:* Lista de regras extraídas para merge em `constitution.md`

- **/speckit.memorylint.load-agents**
   - *O que faz:* Carrega `AGENTS.md` no contexto do agente antes da fase de planejamento. Gate obrigatório que garante aderência às regras operacionais durante geração de `plan.md` e `tasks.md`.
   - *Quando usar:* Automaticamente executado antes de `/speckit plan` (hook obrigatório)
   - *Hook:* `before_plan` (obrigatório)
   - *Falha:* Se `AGENTS.md` não puder ser carregado, planejamento é bloqueado

**Regras de Boundary:**
- **`AGENTS.md` (Infraestrutura):** Comandos de build/test/lint, Git workflows, variáveis de ambiente, protocolos de sessão, roteamento de contexto
- **`constitution.md` (Arquitetura):** Camadas arquiteturais, state management, paradigmas de código, error handling, convenções TypeScript, guardrails técnicos

**Documentação completa:** `docs/sdd/MEMORYLINT_EXTENSION.md`

---

### Comandos Optimize (Otimização de Governança)

Extensão que audita e otimiza documentos de governança AI para eficiência de contexto.

- **/speckit.optimize.run**
   - *O que faz:* Audita a constituição em 6 categorias (Token Budget, Rule Health, AI Interpretability, Semantic Compression, Coherence, Governance Echo). Detecta token bloat, regras obsoletas, ambiguidades e duplicação entre arquivos.
   - *Quando usar:* Trimestralmente para manutenção preventiva, antes de grandes atualizações em `constitution.md`, ou quando governança exceder threshold de tokens.
   - *Saída:* Relatório de auditoria com sugestões de otimização (suggest-only, nada aplicado sem aprovação)

- **/speckit.optimize.tokens**
   - *O que faz:* Mede o footprint de tokens de todos os arquivos de governança e comandos de extensão. Rastreia tendências ao longo do tempo comparando com relatórios anteriores.
   - *Quando usar:* Após instalação de novas extensões, mensalmente para rastreamento de tendências, ou quando suspeitar de crescimento de governança.
   - *Saída:* `.specify/optimize/token-report.md` (histórico para trend analysis)

- **/speckit.optimize.learn**
   - *O que faz:* Análise de fim de sessão que detecta padrões de erro AI, correções repetitivas e gaps de governança. Sugere regras de constituição ou entradas de memória para prevenir recorrência.
   - *Quando usar:* Após sessões longas com múltiplas correções, quando AI repetir o mesmo erro 2+ vezes, ou para capturar aprendizados antes de encerrar feature.
   - *Saída:* `.specify/optimize/learning-report-<date>.md`

**Filosofia:** Suggest-only by default. Nada é modificado sem aprovação explícita. Otimização remove redundância de expressão, não de intenção.

**Documentação completa:** `docs/sdd/OPTIMIZE_EXTENSION.md`

---

### Comandos Reconcile (Reconciliação de Drift)

Extensão que reconcilia drift entre artefatos SDD e implementação real durante a fase de PR.

- **/speckit.reconcile.run "<gap report>"**
   - *O que faz:* Reconcilia drift de implementação a partir de gap report em linguagem natural. Analisa o gap, atualiza cirurgicamente `spec.md` e `plan.md`, e adiciona tarefas de remediação em `tasks.md` com IDs incrementais. Inclui automaticamente tarefas de integração para gaps de Wiring & Navigation.
   - *Quando usar:* Durante implementação quando descobrir algo esquecido/mudado, durante code review ao identificar drift, ou pós-merge para sincronizar artefatos.
   - *Flags opcionais:* `--spec-only`, `--plan-only`, `--tasks-only`
   - *Exemplo:* `/speckit.reconcile.run "Backend exists, but React screen is unreachable; need sidebar link and route"`
   - *Saída:* Sync Impact Report com arquivos alterados, novas tarefas (T###) e próximo passo recomendado

**Workflow em 5 Steps:**
1. **Discovery:** Resolve paths da feature ativa via `check-prerequisites.sh`
2. **Gap Normalization:** Categoriza gap em Wiring & Navigation, Contracts, Acceptance Criteria, Test Coverage, Logic/UX
3. **Clarify:** Máximo 5 perguntas se gap for ambíguo
4. **Reconciliation:** Edits cirúrgicos em spec/plan/tasks com IDs incrementais e paths exatos
5. **Sync Impact Report:** Lista mudanças e recomenda próximo passo

**Filosofia:** Atualização cirúrgica (não reescreve arquivos inteiros). Tarefas de integração obrigatórias para gaps de wiring. Tag `[Sync: Gap Report]` para rastreabilidade.

**Documentação completa:** `docs/sdd/RECONCILE_EXTENSION.md`

---

### Comandos Bugfix (Correção Estruturada de Bugs)

Extensão que adiciona workflow estruturado para correção de bugs com rastreabilidade completa entre implementação e artefatos SDD.

- **/speckit.bugfix.report "<descrição do bug>"**
   - *O que faz:* Captura bug descoberto durante implementação e rastreia até artefatos relevantes. Classifica em 5 tipos (spec gap, spec conflict, implementation drift, untested flow, dependency issue), mapeia para user stories/requirements/tasks afetados, identifica causa raiz e salva relatório estruturado em `specs/{feature}/bugs/BUG-{NNN}.md`.
   - *Quando usar:* Quando descobrir bug durante `/speckit.implement`, quando testes revelarem comportamento incorreto, ou quando identificar gap/conflito na spec.
   - *Exemplo:* `/speckit.bugfix.report "Auth flow não trata token expirado. Usuário fica preso em loop de redirect."`
   - *Saída:* `specs/{feature}/bugs/BUG-{NNN}.md` com classificação, traceability e root cause analysis

- **/speckit.bugfix.patch BUG-{NNN}**
   - *O que faz:* Atualiza cirurgicamente `spec.md`, `plan.md` e `tasks.md` para corrigir bug reportado. Adiciona requirements faltantes, marca conflitos com strikethrough (nunca apaga), reabre tasks indevidamente concluídas com anotação `(reopened — BUG-NNN)`, adiciona novas tasks com IDs sequenciais e dependências corretas.
   - *Quando usar:* Após `/speckit.bugfix.report`, quando bug report estiver completo e aprovado.
   - *Exemplo:* `/speckit.bugfix.patch BUG-001`
   - *Saída:* Edits cirúrgicos em spec/plan/tasks + bug report marcado como `Patched`

- **/speckit.bugfix.verify [BUG-{NNN}|all]**
   - *O que faz:* Valida consistência cross-artifact após patches (read-only). Verifica se todos os bugs estão patched, se novos requirements têm tasks correspondentes, se tasks reabertas têm anotação correta, se IDs são sequenciais e se dependências formam DAG válido.
   - *Quando usar:* Após `/speckit.bugfix.patch`, antes de retomar `/speckit.implement`, ou como consistency check pós-implementação (hook `after_implement`).
   - *Exemplo:* `/speckit.bugfix.verify` ou `/speckit.bugfix.verify BUG-001`
   - *Saída:* Relatório de verificação com status de cada check

**Workflow Completo:**
1. Bug descoberto → `/speckit.bugfix.report` (captura + classificação)
2. `/speckit.bugfix.patch` (atualização cirúrgica de artefatos)
3. `/speckit.bugfix.verify` (validação de consistência)
4. `/speckit.implement` (retomar implementação com specs corrigidos)

**Tipos de Bug:**
- **Spec gap:** Requirement faltando (ex: auth não trata token expirado)
- **Spec conflict:** Requirements contraditórios (ex: "stateless" vs "track sessions")
- **Implementation drift:** Código diverge da spec (ex: spec diz REST, código usa GraphQL)
- **Untested flow:** Edge case não coberto (ex: atualizações concorrentes)
- **Dependency issue:** Dependência externa mudou (ex: formato de API mudou)

**Filosofia:** Report before patch. Surgical updates only (nunca regenera do zero). Never delete content (strikethrough para texto superado). Reopen tasks, don't delete (anotação obrigatória).

**Documentação completa:** `docs/sdd/BUGFIX_EXTENSION.md`

---

### Comandos Status (Dashboard de Estado SDD)

Extensão que fornece dashboard consolidado do estado atual do projeto SDD.

- **/speckit.status.show**
   - *O que faz:* Exibe visão unificada do estado do projeto: project info (nome, agente AI, tipo de script), current feature (branch Git ou `SPECIFY_FEATURE`), SDD artifacts (quais arquivos existem), task progress (completas/total com percentual), workflow phase (qual fase do SDD você está), extensions (contagem de instaladas).
   - *Quando usar:* No início de cada sessão para recuperar contexto, após cada comando SDD para confirmar mudanças de fase, antes de abrir PR para confirmar fase "Complete".
   - *Alias:* `/speckit.status`
   - *Exemplo:* `/speckit.status`
   - *Saída:* Dashboard formatado com 6 seções de informação

**Detecção de Fase do Workflow:**
- **Not Started** (sem spec.md) → executar `/speckit.specify`
- **Plan** (só spec.md) → executar `/speckit.plan`
- **Tasks** (spec + plan) → executar `/speckit.tasks`
- **Implement** (spec + plan + tasks incompleto) → executar `/speckit.implement`
- **Complete** (todos artefatos + tasks 100%) → abrir PR

**Filosofia:** Read-only, visão rápida. Não valida conteúdo (use Reconcile/Bugfix para isso). Prioriza informações de workflow SDD sobre detalhes de extensões.

**Documentação completa:** `docs/sdd/STATUS_EXTENSION.md`

---

## Fonte de verdade
Conflito → AGENTS.md e MDs canônicos vencem sempre.
Detalhes em docs/sdd/MAPEAMENTO_SDD.md.

## Gestão de branches
Ver docs/sdd/BRANCH_POLICY.md.
