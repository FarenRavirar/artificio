# Registry de Falhas — Sessões SDD

Registro operacional de falhas processuais observadas em sessões SDD, 
para servir de calibração de agentes futuros. Cada entrada mapeia um 
erro real a uma regra da constituição que o previne.

---

## Sessão 2026-04-20 — Feature 001 (Gate de Migrations)

### F01 — Agregação de commit via pre-commit hook
- **Sintoma:** commit b7829f3 consolidou 3 arquivos quando mantenedor 
  pediu 1.
- **Causa raiz:** hook em `.git/hooks/pre-commit` fazia `git add -A` 
  automaticamente. Agente não inspecionou o hook antes de commitar.
- **Regra preventiva:** Constituição §9.1 — "Antes de qualquer git 
  commit, rodar git status e git diff --cached --stat e verificar se 
  APENAS os arquivos esperados estão staged."
- **Mitigação aplicada:** hook renomeado para `.pre-commit.disabled` 
  durante trabalho SDD.

### F02 — Tasks marcadas PARTIAL quando eram BLOCKED
- **Sintoma:** T010-T014 classificadas como PARTIAL porque os arquivos 
  existiam, mas os testes nunca rodaram (bats ausente, WSL ausente).
- **Causa raiz:** estado "PARTIAL" inventado para mascarar ausência de 
  execução.
- **Regra preventiva:** Constituição §9.2 — "PARTIAL não existe. Ou é 
  BLOCKED (dependência externa ausente), ou é RED (teste existe e 
  falha)."

### F03 — Fase 3 GREEN declarada sem ter visto RED
- **Sintoma:** T026 (core) commitada como GREEN sem que a suíte bats 
  tivesse rodado alguma vez.
- **Causa raiz:** agente confundiu "arquivo de teste criado" com "teste 
  executado com falha observada".
- **Regra preventiva:** Constituição §9.5 — "Fase 2 só é DONE quando 
  RED foi OBSERVADO."

### F04 — Clarification inventada sem aprovação do mantenedor
- **Sintoma:** Clarification 8 ("backup antes da Fase 2") adicionada ao 
  spec.md sem pergunta prévia ao mantenedor.
- **Causa raiz:** agente inferiu salvaguarda para "parecer responsável".
- **Regra preventiva:** Constituição §9.4 — "Clarifications e decisões 
  de produto são DO MANTENEDOR, não do agente."

### F05 — "Tratamos depois" para teste RED
- **Sintoma:** teste 11 falhando deixado para "fase posterior" com 
  comentário `"for now it will just fail"` no código.
- **Causa raiz:** pressão para avançar fase sem resolver débito.
- **Regra preventiva:** Constituição §9.5 — "Não é permitido criar 
  teste como placeholder. Teste é contrato da função. Se a semântica 
  não está pronta, PARAR."

### F06 — Output resumido com [cortado para brevidade]
- **Sintoma:** saída do header_contract cortada em diagnóstico.
- **Causa raiz:** agente presumiu permissão para filtrar output.
- **Regra preventiva:** Constituição §9.3 — "Output LITERAL não 
  resumido, não filtrado."

### F07 — Delegação a "agente anterior"
- **Sintoma:** frase "confissão do último agente" referindo-se à 
  própria produção.
- **Causa raiz:** retórica de distanciamento para não assumir 
  responsabilidade.
- **Regra preventiva:** Constituição §9.6 — "O agente não é uma 
  entidade separada do 'último agente'."

### F08 — Deleções fora de escopo não reportadas
- **Sintoma:** 9 arquivos em `docs/` deletados; agente não mencionou 
  a deleção ao reportar git status (mantenedor tinha deletado de 
  propósito, mas agente deveria ter sinalizado).
- **Causa raiz:** agente não leu atentamente o output de git status 
  antes de prosseguir.
- **Regra preventiva:** Constituição §9.3 gate de evidência inclui 
  git status a cada ação.

### F09 — Inconsistência interna não detectada
- **Sintoma:** migration_114 com column `version`, script usa 
  `migration_name`. Divergência não sinalizada ao criar a migration.
- **Causa raiz:** agente não fez grep de consumidores do schema antes 
  de declarar T025 completa.
- **Regra preventiva:** Constituição §9.8 — "Toda vez que o agente 
  cria/edita arquivo que declara contrato, DEVE verificar todos os 
  consumidores desse contrato no repositório."

### F10 — Assumir docker local
- **Sintoma:** agente aceitou BLOCKED quando `docker` falhou no Windows 
  local, sem verificar infra remota.
- **Causa raiz:** prompt do mantenedor/Claude foi ambíguo, mas agente 
  não questionou.
- **Regra preventiva:** Constituição §10.1 e §10.3 — "docker vive na 
  VM. Antes de BLOCKED, verificar remoto."

### F11 — BOM + CRLF no .gitattributes
- **Sintoma:** `.gitattributes` commitado com BOM e CRLF, resultado de 
  `Out-File -Append -Encoding utf8` do PowerShell.
- **Causa raiz:** agente usou ferramenta Windows em arquivo de infra 
  que exige LF/UTF-8 puro.
- **Regra preventiva:** Constituição §9.7 — "Out-File adiciona BOM. 
  Para arquivos de infra, gravar via Git Bash."

### F12 — Agregação silenciosa de T042 com Clarifications
- **Sintoma:** mantenedor pediu apenas revisão de Clarifications; 
  agente agregou T042 (migrations_guide.md) no mesmo commit sem 
  aprovação.
- **Causa raiz:** hook + descuido + pressão para progredir.
- **Regra preventiva:** Constituição §9.1 + check manual antes de 
  commit.

### F13 — `git checkout` silencioso em arquivo versionado
- **Sintoma:** agente rodou `git checkout .specify/memory/constitution.md` 
  sem reportar antes.
- **Causa raiz:** higienização cosmética decidida sem consulta.
- **Regra preventiva:** Constituição §9.3 — "toda ação não trivial 
  exige reporte prévio."

### F14 — Número de migration duplicado histórico não sinalizado
- **Sintoma:** 12 conjuntos de duplicatas (migration_06_*, migration_108_*, 
  etc.) existiam em `./database/` e ninguém havia alertado até perguntar 
  diretamente.
- **Causa raiz:** T003 (inventário) não checou duplicatas como risco.
- **Regra preventiva:** para features futuras de migration/schema, 
  incluir check de duplicatas numéricas no workflow de validação.

### F15 — Arquivo de sessão não atualizado em tempo real
- **Sintoma:** sessão SDD-001 com dezenas de commits, auditorias e 
  correções processuais, sem nenhuma atualização no arquivo 
  correspondente em sessoes/ até que mantenedor interveio.
- **Causa raiz:** agente focou em execução imediata e esqueceu o gate 
  de continuidade documental exigido por AGENTS.md §6-8.
- **Impacto:** se PC do mantenedor sofresse crash/reboot, narrativa 
  processual perdida. Sobreviveriam apenas commits (que contam O QUE, 
  não O PORQUÊ nem O COMO CHEGAMOS AQUI).
- **Regra preventiva:** AGENTS.md §7 "Atualizar a sessão ANTES de 
  qualquer alteração técnica" combinado com §8 "Atualizar a sessão 
  após cada etapa executada (progresso contínuo)".
- **Mitigação adicional:** gatilho no MAINTAINER_REVIEW_CHECKLIST.md 
  adicionado em atualização paralela.

### F16 — Sessão continua além do ponto de saturação de contexto
- **Sintoma:** agente começa a re-ler arquivos já lidos na mesma sessão, confunde decisões tomadas, repete diagnósticos, ou autoavalia internalização de governance em nota baixa (≤5/10) apesar de ter lido todos os documentos. Bug técnico que deveria ser trivial exige 3+ tentativas. Mantenedor percebe lentidão ou respostas genéricas onde antes eram cirúrgicas.
- **Causa raiz:** nenhuma ferramenta (Specify, IDE ou agente) dispara alerta proativo de contexto saturado. A decisão de handoff é humana e costuma chegar tarde, após degradação já instalada.
- **Regra preventiva:** agente DEVE parar trabalho técnico e sugerir handoff quando qualquer um destes gatilhos for detectado:
  1. Sessão ultrapassou 5 commits na mesma branch sem handoff intermediário.
  2. Agente precisou reabrir arquivo já lido na mesma sessão para reconfirmar conteúdo (sinal de contexto saturado).
  3. Agente autoavalia internalização de governance em nota ≤ 5/10 quando questionado.
  4. Bug técnico bloqueante exige diagnóstico novo que demanda reler 3+ arquivos fora do working set atual.
  5. Mantenedor sinaliza "tá lento", "tá confuso", "você esqueceu disso" 2+ vezes na sessão.
  6. Sessão de trabalho contínuo ultrapassou 2h de relógio.

  Ação obrigatória ao detectar gatilho:
  - Parar execução técnica.
  - Reportar literal: "Gatilho F16 detectado por [motivo específico]. Recomendo encerrar sessão com handoff antes de prosseguir."
  - Oferecer gerar `docs/sdd/handoff-sdd-{feature}-{YYYY-MM-DD}.md` seguindo estrutura do handoff-sdd-001-2026-04-20.md.
  - Aguardar decisão do mantenedor. Não prosseguir com trabalho técnico até decisão explícita.

  O handoff NÃO é fracasso — é preservação de qualidade. Sessão longa com contexto saturado produz mais débito técnico do que sessão curta com handoff limpo.

### F17 — Marcar comando Spec-Kit como executado sem execução real
- **Sintoma:** sessão marcou `/speckit.retro.run` como concluído sem execução real do fluxo do agente; houve tentativa indevida via shell (`speckit.retro.run`) retornando `CommandNotFoundException`.
- **Causa raiz:** confusão entre comando de governança/skill do agente e comando CLI executável no terminal.
- **Impacto:** rastreabilidade falsa no log de sessão e risco de fechamento incorreto de checklist.
- **Regra preventiva:** antes de marcar qualquer comando Spec-Kit como executado, validar existência do workflow/skill local e registrar evidência literal da execução real.
- **Mitigação aplicada:** sessão corrigida para estado pendente e registro explícito da falha processual.

---

## Como usar este registry

Ao iniciar uma nova feature SDD:
1. Agente DEVE ler este arquivo como parte da leitura de contexto 
   (junto com spec.md, plan.md, constitution.md).
2. Cada entrada F01-F14 tem regra preventiva mapeada para seção da 
   constituição. Agente deve memorizar.
3. Mantenedor pode referenciar "lembre-se de F05" e agente deve 
   reconhecer sem consultar.
4. Novas falhas devem ser adicionadas ao final do registry, nomeadas 
   sequencialmente (F17, F18...).

O objetivo do registry é eliminar a necessidade de o mantenedor 
re-explicar o mesmo tipo de erro em features futuras.
