# Plano de Ação - Migração de Governança e Skills de Agentes

**Data:** 2026-05-31  
**Status:** pronto para execução em nova sessão  
**Escopo:** ambiente de agentes, documentação operacional e redução de dependência do SDD pesado  
**Não escopo:** código de produto, migrations, deploy, banco de dados, runtime frontend/backend  

---

## 1. Tese Executiva

O projeto deve migrar de um modelo de governança pesado, centrado em SDD/Spec-Kit local e múltiplas skills antigas, para um modelo operacional mais enxuto:

1. **SDD Lite como governança seletiva**, usado quando rastreabilidade realmente reduz risco.
2. **`mattpocock/skills` como fluxo padrão de trabalho diário**, com skills pequenas, composáveis e menos cerimoniais.
3. **`JuliusBrussee/caveman` para compressão de saída e economia de contexto**, sem reduzir rigor técnico.
4. **`obra/superpowers` como biblioteca de referência metodológica**, não como pacote ativo obrigatório.
5. **Context Capsule como proteção contra compactações**, garantindo que o próximo agente leia o que importa sem reconstruir o projeto inteiro.

O objetivo não é remover disciplina. É trocar burocracia por alavancagem.

**Linha vermelha:** a migração não pode reduzir proteção de produto, segurança, dados, deploy, autenticação, privacidade, gratuidade ou rastreabilidade de mudanças críticas. Qualquer simplificação que enfraqueça essas proteções deve ser rejeitada.

---

## 2. Diagnóstico Atual

### 2.1 Problema

O ambiente acumulou:

- Skills antigas duplicadas em `.agent/skills`, `.agents/skills` e `.gemini/skills`.
- Comandos `/speckit.*` tratados como se fossem runtime ativo, quando hoje devem ser procedimentos documentais.
- `AGENTS.md` longo demais, misturando regras invioláveis, manual operacional, histórico e comandos obsoletos.
- Custo alto de sessão antes de qualquer execução.
- Alto risco de compactação perder o que realmente importa.

### 2.2 Sintoma Estratégico

O agente passa muito tempo cumprindo ritual e pouco tempo criando valor verificável.

O SDD local protegeu o projeto em fases críticas, mas virou gargalo quando aplicado a tarefas pequenas ou quando os artefatos ficaram maiores que a decisão real.

### 2.3 Estado Já Aplicado

As skills antigas foram desativadas localmente:

- `.agent/skills`
- `.agents/skills`
- `.gemini/skills`

Skills ativas em `C:\Users\paulo\.codex\skills`:

- `mattpocock/skills`
- `JuliusBrussee/caveman`
- `.system` do Codex

Checkouts de referência:

- `C:\Users\paulo\.codex\vendor_imports\mattpocock-skills`
- `C:\Users\paulo\.codex\vendor_imports\caveman`
- `C:\Users\paulo\.codex\vendor_imports\superpowers`

Backup:

- `C:\Users\paulo\.codex\backups\skills-reform-20260531-174406`

### 2.4 Invariantes que Não Podem Ser Perdidos

A migração é sobre o modo de trabalho dos agentes. Ela não muda a intenção do projeto nem seus contratos de produto.

Preservar explicitamente:

- Gratuidade, ausência de anúncios e coleta mínima de dados.
- Google OAuth como único login autorizado.
- Upload/processamento de imagens via backend, sem hardcode de Cloudinary.
- `cover_deletehash`, `avatar_deletehash` e `banner_deletehash` nunca em rotas públicas.
- Elevação `player -> gm` exclusiva do backend.
- Banco canônico `mesas_rpg`.
- Fluxo de ambientes `feat/* -> dev/Beta -> main/Produção`.
- Proibição de deploy, push para `dev/main`, writes em banco, restart de serviços e comandos destrutivos sem aprovação explícita.
- Validação funcional em Beta para mudanças de UI/fluxos reais.
- Normalização tipada de dados de fronteira antes de entrar em estado React/renderização.
- `.specify/arquiteture.md` continua prevalecendo sobre arquitetura e contratos técnicos quando houver conflito.

Nenhum documento novo em `docs/agents/` pode sobrescrever essas regras. Se houver conflito, prevalece `AGENTS.md`; para arquitetura/contratos técnicos, prevalece `.specify/arquiteture.md`.

---

## 3. Fontes e Decisão de Mercado

### 3.1 Spec Kit / SDD

Spec Kit continua ativo e relevante como metodologia de especificação estruturada. Seu fluxo central permanece `Spec -> Plan -> Tasks -> Implement`, com múltiplas integrações e extensões.

Uso estratégico: manter para trabalho de alto risco, não como fluxo obrigatório universal.

### 3.2 Matt Pocock Skills

Matt Pocock propõe skills pequenas, adaptáveis e composáveis, com crítica explícita a frameworks grandes que tomam controle do processo.

Uso estratégico: virar o fluxo padrão diário.

### 3.3 Superpowers

Superpowers é uma metodologia completa: brainstorming, worktrees, planos, TDD, subagentes, review e fechamento.

Uso estratégico: aproveitar ideias específicas, não instalar como segundo sistema operacional.

Skills úteis como referência:

- `verification-before-completion`
- `systematic-debugging`
- `receiving-code-review`

Skills arriscadas para adoção direta:

- `using-git-worktrees`
- `finishing-a-development-branch`
- `subagent-driven-development`
- fluxos automáticos de commit/PR

Motivo: podem conflitar com regras pétreas locais de branch, sessão, commit, push, deploy e autorização.

### 3.4 Caveman

Caveman reduz saída e melhora legibilidade/custo sem reduzir rigor técnico.

Uso estratégico: ativar em sessões longas, retomadas, auditorias extensas e quando o mantenedor pedir economia de tokens.

---

## 4. Modelo Operacional Alvo

### 4.1 Princípio

Toda tarefa deve escolher o menor processo que ainda controla o risco.

### 4.2 Três Modos

| Modo | Quando usar | Artefatos mínimos |
|---|---|---|
| Sem SDD | correção pontual, doc delta, ajuste visual pequeno, pergunta técnica | sessão + evidência |
| SDD Lite | bug moderado, feature pequena, ajuste com impacto de produto | mini-spec + checklist + evidência |
| SDD Completo | migration, auth, dados, deploy, contrato público, feature grande, segurança | spec + plan + tasks + validação + sessão |

### 4.3 Regra de Escolha

Usar SDD completo somente quando uma falha custaria mais do que o custo da cerimônia.

### 4.4 Gates de Risco

| Tipo de mudança | Modo mínimo |
|---|---|
| Texto/documentação sem contrato | Sem SDD |
| Ajuste visual pequeno sem fluxo crítico | Sem SDD ou SDD Lite |
| Bug com causa incerta | SDD Lite + `diagnose` |
| Feature de produto | SDD Lite, ou SDD Completo se cruzar contrato/dados |
| Migration/schema/banco | SDD Completo |
| Auth, permissões, dados pessoais, upload, Cloudinary | SDD Completo |
| Deploy, CI/CD, produção, Beta, infraestrutura | SDD Completo |
| Contrato público/API | SDD Completo |
| Refatoração ampla | SDD Completo ou explícita aprovação do mantenedor |

### 4.5 Regra de Preservação

Ao enxugar qualquer documento, mover antes de remover:

1. Identificar regra.
2. Classificar como inviolável, operacional, histórica ou obsoleta.
3. Se inviolável: manter em `AGENTS.md`.
4. Se operacional: mover para `docs/agents/`.
5. Se histórica: apontar para `docs/legacy/` ou sessão.
6. Se obsoleta: remover apenas quando houver substituto explícito.

Proibido apagar regra sem registrar para onde ela foi ou por que virou obsoleta.

---

## 5. Matriz de Decisão de Skills

| Situação | Ferramenta primária | Observação |
|---|---|---|
| Ideia ambígua | `grill-me` | Alinhar intenção antes de criar docs |
| Feature com domínio importante | `grill-with-docs` | Pode alimentar mini-spec |
| Bug sem causa clara | `diagnose` | Causa raiz antes de patch |
| Implementação com teste viável | `tdd` | RED -> GREEN -> refactor |
| Refatoração arquitetural | `improve-codebase-architecture` | Só no escopo autorizado |
| Sessão longa | `caveman` | Menos saída, mesmo rigor |
| Retomada ou compactação | `handoff` + Context Capsule | Preservar memória operacional |
| Antes de declarar concluído | checklist de `verification-before-completion` | Evidência antes de afirmação |
| Review recebido | inspiração em `receiving-code-review` | Itens acionáveis primeiro |

---

## 6. Arquitetura Documental Alvo

### 6.1 Arquivos Novos ou Revisados

| Arquivo | Papel |
|---|---|
| `AGENTS.md` | Regras invioláveis e ponteiros, não manual gigante |
| `docs/agents/operating-model.md` | Como o agente trabalha no dia a dia |
| `docs/agents/context-capsule.md` | Contexto mínimo para sobreviver a compactação |
| `docs/agents/skill-decision-matrix.md` | Qual skill usar por situação |
| `docs/agents/skill-stack.md` | Stack ativo e fontes |
| `docs/agents/issue-tracker.md` | Como issues/PRs convivem com SDD |
| `docs/agents/triage-labels.md` | Vocabulário de triagem |
| `docs/agents/domain.md` | Mapa de domínio para skills |
| `.specify/memory/project-state.md` | Estado operacional consolidado |
| `sessoes/*.md` | Log da sessão ativa |

### 6.2 Regra de Ouro

Em uma nova sessão, o agente deve conseguir se orientar lendo no máximo:

1. `.specify/memory/project-state.md`
2. `AGENTS.md`
3. `docs/agents/context-capsule.md`

Se precisar de mais, o capsule falhou.

---

## 7. Fases de Implementação

## Fase 0 - Pré-flight de Preservação

**Objetivo:** impedir que a migração quebre o projeto ao apagar contexto crítico.

Entregáveis:

- Checklist de preservação dentro da sessão.
- Mapa curto de seções de `AGENTS.md`:
  - manter em `AGENTS.md`
  - mover para `docs/agents/`
  - manter como histórico
  - remover por obsolescência

Leituras/buscas obrigatórias:

```powershell
rg -n "Regras Específicas|Regras pétreas|Ações que exigem aprovação|Git|Migrations|Cloudinary|Google OAuth|Discord|deletehash|gratuidade|Normalização|Validação funcional" AGENTS.md
rg -n "^##|^###" AGENTS.md
```

Critério de conclusão:

- Nenhuma regra de produto/segurança/deploy/dados fica sem destino.
- O plano de enxugamento do `AGENTS.md` está claro antes de editar o arquivo.

## Fase 1 - Manual Operacional

**Objetivo:** criar a camada clara entre regras invioláveis e operação diária.

Entregáveis:

- `docs/agents/operating-model.md`
- `docs/agents/skill-decision-matrix.md`
- atualização de `docs/agents/skill-stack.md`

Conteúdo obrigatório:

- Modos: Sem SDD, SDD Lite, SDD Completo.
- Matriz de decisão por risco.
- Como usar Matt, Caveman e Superpowers.
- O que nunca fazer.
- Evidência mínima por tipo de tarefa.

Critério de conclusão:

- Um agente novo entende como trabalhar sem ler docs legados.

## Fase 2 - Context Capsule

**Objetivo:** proteger o projeto contra perda de contexto em compactações.

Entregável:

- `docs/agents/context-capsule.md`

Conteúdo obrigatório:

- Identidade do produto.
- Ambientes.
- Stack.
- Branch/deploy policy.
- Regras pétreas.
- Fontes canônicas.
- Estado atual.
- Decisões fixas.
- Riscos atuais.
- Como retomar sessão.

Critério de conclusão:

- O capsule tem até 250 linhas.
- Não duplica todo o `AGENTS.md`.
- Aponta para documentos maiores só quando necessário.

## Fase 3 - Enxugar AGENTS.md

**Objetivo:** transformar `AGENTS.md` em constituição operacional curta.

Ações:

- Manter regras pétreas.
- Manter regras específicas do projeto listadas em 2.4.
- Manter início obrigatório de sessão, mas reduzir ruído.
- Remover dependência viva de `.agent/skills` e `.agents/skills`.
- Trocar referências a skills antigas por docs em `docs/agents/`.
- Classificar SDD completo como seletivo.
- Apontar para `context-capsule.md`.
- Antes de apagar qualquer bloco, confirmar se ele foi movido, resumido ou marcado como histórico.

Critério de conclusão:

- `AGENTS.md` fica menor, mais claro e sem contradições com o stack novo.
- Busca por invariantes de 2.4 confirma que continuam presentes em `AGENTS.md` ou no `context-capsule.md` com ponteiro claro para a fonte canônica.

## Fase 4 - Reclassificar SDD

**Objetivo:** preservar rastreabilidade sem travar execução.

Ações:

- Atualizar linguagem de gate obrigatório.
- Criar tabela de classificação:
  - Sem SDD
  - SDD Lite
  - SDD Completo
- Definir exemplos reais do projeto.
- Registrar que `/speckit.*` é procedimento documental, não comando CLI nem skill ativa.

Critério de conclusão:

- Tarefa simples não dispara spec obrigatória.
- Tarefa complexa ainda preserva spec/plan/tasks.

## Fase 5 - Revisão de Conflitos

**Objetivo:** garantir que o novo modelo não tem referências velhas conflitantes.

Buscas obrigatórias:

```powershell
rg -n "\.agent/skills|\.agents/skills|\.gemini/skills" AGENTS.md docs .specify
rg -n "obrigatório.*10 linhas|/speckit\.|Spec-Kit|Superpowers|caveman|mattpocock" AGENTS.md docs/agents .specify/memory/project-state.md
rg -n "Cloudinary|Google OAuth|deletehash|gratuidade|sem anúncios|Normalização|git push origin dev|git push origin main|docker restart|psql com INSERT|TRUNCATE|DROP|ALTER|Beta" AGENTS.md docs/agents/context-capsule.md
```

Critério de conclusão:

- Referências antigas existem apenas como histórico ou decisão explícita de desativação.
- Não há instrução mandando executar comando inexistente.
- Regras de produto/segurança/deploy continuam encontráveis.

## Fase 6 - Validação Operacional

**Objetivo:** testar se o modelo funciona para retomada real.

Teste:

1. Simular nova sessão lendo só:
   - `.specify/memory/project-state.md`
   - `AGENTS.md`
   - `docs/agents/context-capsule.md`
2. Responder:
   - qual é o estado atual?
   - qual é o stack ativo?
   - quando usar SDD?
   - qual é a próxima ação segura?
3. Verificar se a resposta bate com a realidade.

Critério de conclusão:

- O agente consegue retomar sem abrir docs legados nem skills antigas.

---

## 8. Riscos e Mitigações

| Risco | Impacto | Mitigação |
|---|---|---|
| Cortar SDD demais | Perda de rastreabilidade | Manter SDD completo para alto risco |
| Manter SDD demais | Continua travando execução | Criar classificação objetiva de modos |
| Superpowers virar segundo framework | Conflito de gates | Usar só como referência seletiva |
| AGENTS.md continuar gigante | Compactação perde contexto | Criar Context Capsule |
| Docs duplicarem regra | Contradição futura | `AGENTS.md` contém regra, docs/agents contém operação |
| Skills antigas voltarem | Ruído operacional | Proibir recriação sem autorização |
| Apagar regra pétrea ao enxugar `AGENTS.md` | Quebra de segurança/processo | Executar Fase 0 e busca de invariantes |
| Rollback acidental apagar trabalho novo | Perda de mudanças legítimas | Rollback só com aprovação explícita e `git status` revisado |
| Context Capsule ficar grande demais | Perde valor em compactação | Limite de 250 linhas e ponteiros para detalhes |

---

## 9. Métricas de Sucesso

O plano é bem-sucedido quando:

- Nova sessão retoma lendo no máximo 3 arquivos.
- `AGENTS.md` deixa claro o que é inviolável.
- Tarefas simples não exigem spec.
- Tarefas complexas continuam com rastreabilidade.
- Skills antigas não aparecem como fonte ativa.
- Matt + Caveman viram o fluxo padrão.
- Superpowers está documentado como referência, não como pacote ativo.
- A conclusão de tarefas exige evidência fresca.
- O mantenedor sente menos fricção e mais avanço.

---

## 10. Rollback

Rollback é plano de contingência, não autorização automática. Antes de qualquer rollback:

1. Mostrar `git status --short`.
2. Listar arquivos que serão revertidos/restaurados.
3. Confirmar que não há trabalho do mantenedor misturado.
4. Pedir aprovação explícita.

Se a migração piorar a operação e o mantenedor aprovar:

1. Restaurar skills antigas do backup:

```powershell
C:\Users\paulo\.codex\backups\skills-reform-20260531-174406
```

2. Reverter alterações de documentação:

```powershell
git restore AGENTS.md docs/agents .specify/memory/project-state.md sessoes/26-05-09_2_discord-pipeline-fase-1-em-diante.md
```

3. Reiniciar Codex.

Rollback parcial recomendado:

- Não restaurar skills antigas imediatamente.
- Primeiro ajustar `docs/agents/context-capsule.md` e `operating-model.md`.

---

## 11. Ordem Recomendada Para Nova Sessão

1. Abrir nova sessão operacional dedicada a esta migração.
2. Executar a Fase 0 antes de qualquer edição estrutural.
3. Ler:
   - `.specify/memory/project-state.md`
   - `AGENTS.md`
   - `docs/agents/migration-action-plan.md`
   - `docs/agents/skill-stack.md`
4. Criar/atualizar:
   - `docs/agents/operating-model.md`
   - `docs/agents/context-capsule.md`
   - `docs/agents/skill-decision-matrix.md`
5. Enxugar `AGENTS.md` somente após mapear destino das regras preservadas.
6. Atualizar `project-state.md`.
7. Validar buscas finais.
8. Entregar resumo e prompt de próxima sessão se sobrar trabalho.

---

## 12. Prompt Para Iniciar Nova Sessão

```text
Sou o mantenedor do projeto Mesas RPG Artifício. Quero iniciar uma sessão dedicada para implementar a migração de governança/skills dos agentes.

Antes de qualquer alteração, leia nesta ordem:

1. `.specify/memory/project-state.md`
2. `AGENTS.md`
3. `docs/agents/migration-action-plan.md`
4. `docs/agents/skill-stack.md`
5. `sessoes/26-05-09_2_discord-pipeline-fase-1-em-diante.md` apenas na seção de atualização operacional de 2026-05-31

Objetivo da sessão:

Implementar o plano de ação em `docs/agents/migration-action-plan.md`, sem mexer em código de produto, migrations, banco, deploy ou runtime. O foco é atualizar a governança documental para:

- reduzir SDD pesado para SDD Lite seletivo;
- manter SDD completo apenas para alto risco;
- usar `mattpocock/skills` como fluxo padrão diário;
- usar `JuliusBrussee/caveman` para economia de contexto quando solicitado;
- manter `obra/superpowers` apenas como referência seletiva;
- criar `docs/agents/operating-model.md`;
- criar `docs/agents/context-capsule.md`;
- criar `docs/agents/skill-decision-matrix.md`;
- enxugar `AGENTS.md` sem perder regras pétreas;
- preservar regras de produto, segurança, dados, auth, Cloudinary, deploy, Git e validação Beta;
- atualizar `.specify/memory/project-state.md` e a sessão;
- validar que referências antigas a `.agent/skills`, `.agents/skills` e `.gemini/skills` não aparecem como fonte ativa.

Regras:

- Não fazer commit.
- Não fazer push.
- Não fazer deploy.
- Não alterar código de frontend/backend.
- Não recriar skills antigas.
- Registrar a sessão antes de editar.
- Executar a Fase 0 do plano antes de enxugar `AGENTS.md`.
- Não apagar regra de `AGENTS.md` sem registrar se ela foi mantida, movida, marcada como histórica ou removida por obsolescência.
- Usar `apply_patch` para alterações manuais.
- Fazer busca final por referências conflitantes.
- Fazer busca final pelos invariantes de produto/segurança/deploy listados no plano.

Critério de conclusão:

Uma nova sessão deve conseguir entender o projeto e operar lendo no máximo:

1. `.specify/memory/project-state.md`
2. `AGENTS.md`
3. `docs/agents/context-capsule.md`

Comece criando/retomando a sessão conforme `AGENTS.md`, depois execute a Fase 0 do plano e só então avance para a Fase 1.
```
