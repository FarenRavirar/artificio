# 077 — Detecção de mesas duplicadas entre mesas ativas/publicadas

- **Módulo/Pacote:** apps/mesas (backend + frontend)
- **Gate relacionado:** D (mesas)

## Problema

Existe dedupe hoje (`discord_duplicate_candidates`, migration_137, spec 058
Fase 5), mas escopo é só **draft-contra-draft** dentro da importação
Discord: compara `discord_parse_cases` entre si (hash de texto, link de
inscrição, canal, autor), nunca toca a tabela `tables`. Fluxo de decisão
(`DuplicatesTab.tsx`) só aparece dentro do editor de 1 rascunho específico
(`DraftEditorTab`), aba própria — não existe na listagem
`/gestao/mesas/rascunhos` (`DiscordDraftReviewTable`).

Resultado: nenhuma ferramenta hoje detecta duplicata entre:
1. Mesa ativa × mesa ativa (ex.: duas publicações da mesma campanha por
   erro de operador, ou reimportação manual).
2. Draft novo × mesa **já publicada** (o candidato atual só olha outros
   `discord_parse_cases`, nunca a tabela `tables` final).

Sem isso, mesa duplicada só é achada por acaso (usuário reportando) — sem
apontamento automático, sem link direto entre as duas ocorrências, sem
gestão centralizada.

Achado consolidado a partir de investigação read-only nesta sessão
(2026-07-14) — ver `sessoes/` da data para o achado original.

## Requisitos

1. Detectar candidatos de duplicata entre mesas com `status = 'active'`
   (reaproveitando sinais já usados em `discord_duplicate_candidates`:
   hash de texto normalizado, mesmo link de inscrição/form, mesmo
   sistema+título aproximado — adaptado pra campos de `tables`, que não
   tem `normalized_text`/`signals_json` prontos).
2. Detectar candidato de duplicata entre draft novo (rascunho em revisão)
   e mesa **já ativa** — não só entre drafts.
3. Expor indicador visual (badge/contador) de duplicata na listagem
   `/gestao/mesas/rascunhos` (`DiscordDraftReviewTable`), sem exigir abrir
   cada draft pra descobrir.
4. Tela de gestão de duplicatas com link direto clicável pra cada lado do
   par (mesa ativa → `/mesas/:slug` público + rota de edição admin; draft
   → editor do rascunho).
5. Decisão manual do admin (mesmo padrão dos 3 estados existentes:
   confirma duplicata / rejeita / marca pra atualizar existente),
   reaproveitando `discord_parse_feedback` como trilha de aprendizado
   quando aplicável.

## Critérios de aceite

- Rodar detecção contra o conjunto de mesas ativas em produção (ou dump
  local) acha pelo menos os pares duplicados conhecidos manualmente
  reportados pelo mantenedor (caso existam no momento do smoke).
- Listagem `/gestao/mesas/rascunhos` mostra badge de "possível duplicata"
  quando o draft bate com mesa ativa existente.
- Tela de gestão de duplicatas (nova ou `DuplicatesTab` estendida) lista
  pares mesa×mesa e draft×mesa, cada um com link clicável pras duas
  pontas.
- `pnpm run lint` + `pnpm run build` verdes (backend + frontend mesas).
- Smoke manual: criar/simular 2 mesas ativas com título+sistema
  parecidos, confirmar que aparecem como candidato na tela de gestão.

## Fora de escopo

- Merge automático de mesas duplicadas (ação sempre manual, nunca delete
  automático — regra pétrea de dado do usuário).
- Alterar o dedupe draft-contra-draft existente (`discord_duplicate_candidates`
  fase 5) — esta spec **estende** a cobertura, não substitui.
- Detecção de duplicata em outros módulos (glossário, downloads) — só
  `apps/mesas`.

## Ampliação explícita — parser e aprendizado do draft (2026-07-14)

O mantenedor ampliou esta spec para também cobrir a melhora incremental do
parser dos anúncios Discord. Regra de execução: **antes de avançar cada etapa**,
registrar aqui e em `tasks.md` as descobertas, evidências e decisões, para que a
continuidade não dependa do contexto do chat.

O JSON de entrada não tem template estável: cada autor publica a vaga em texto
livre. Logo, o parser deve procurar sinais no conteúdo, combinar extractors por
cascata e preservar ambiguidade; não pode depender de uma forma única do JSON ou
inventar requisito a partir de mera menção de plataforma.

### Requisitos adicionados

6. Auditar o comportamento real do parser nos corpora `D:\teste.json` e
   `D:\teste [part 2].json` antes de ampliar regras.
7. Melhorar a extração de requisitos técnicos (`requires_pc`,
   `requires_camera`, `requires_microphone`) com tri-state conservador:
   obrigatório explícito = `true`; opcional/não obrigatório explícito = `false`;
   mera citação de Discord/VTT = `null`; sinais contraditórios = ambiguidade.
8. Fazer aliases aprendidos pela curadoria serem consumidos por todos os campos
   que já são elegíveis a `label_alias`, não apenas `title` e `system_name`.
9. Verificar e corrigir o caminho `curadoria -> discord_field_learning /
   discord_learning_rules -> novo draft`: regra humana ativa deve ser aplicada
   deterministicamente antes do DeepSeek, preservando revisão humana e sem
   auto-publicação.
10. Manter os dois modos DeepSeek separados: automação continua desligada em
    prod/beta; auditoria manual de completude permanece disponível e não deve ser
    ativada pelo parser automático.

### Critérios de aceite adicionados

- Fixtures reais positivas, negativas, opcionais e contraditórias de requisitos
  técnicos cobertas por regressão.
- Alias aprendido de vaga/descrição/contato/preço é efetivamente consumido no
  parse seguinte.
- Teste prova que aprendizado humano ativo funciona com DeepSeek automático
  desligado e que o valor aprendido chega ao campo do draft, não apenas a uma
  sugestão pendente.
- Testes focados do parser/backend, `pnpm run lint` e `pnpm run build` verdes.

### Checkpoint parser P0 — diagnóstico antes da implementação

- Arquivo central confirmado:
  `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts`; carga dos aliases
  ativos ocorre em `apps/mesas/backend/src/routes/discord/utils.ts`.
- Baseline executado nos 2 corpora reais: 200 mensagens, 169 drafts e 31
  descartes. Foram encontrados 63 anúncios com sinais textuais de requisito
  técnico; a extração atual capturou 0 desses sinais sem catálogos.
- O corpus contém sinais positivos (`necessário ter PC`, `computador é
  obrigatório`, `microfone com qualidade aceitável`, `MIC audível`) e negativos
  ou opcionais (`PC não obrigatório`, `recomendável`, `preferência por pessoas
  com PC`). Portanto regex positiva isolada produz falso positivo.
- `loadActiveLabelAliases` já lê aliases com escopo guild+canal+autor, mas o
  parser só consumia aliases de `title` e `system_name`; aliases gravados para
  dia, horário, vagas, preço, contato e descrição eram ignorados.
- `discord_field_learning` e regras `field_value` são consultados antes do gate
  DeepSeek, porém o caminho atual termina em `_ai_suggestions`: o teste existente
  valida a sugestão, não aplicação no campo. Isso não satisfaz o requisito de
  aprendizado efetivo descrito acima.
- Inferir `requires_pc=true` de qualquer VTT e `requires_microphone=true` de
  Discord é inseguro. Plataforma indica ferramenta, não obrigação; a correção
  local em andamento remove essa inferência.
- `ContextPack` e DeepSeek não serão usados para compensar falhas determinísticas
  desta etapa.

### Checkpoint parser P1 — delta implementado, antes da validação

- `labelAliases` agora alimenta os extractors de `price_type`/`price_value`,
  `slots_open`/`slots_total`, `day_of_week`, `start_time`, `contact_url` e
  `description`, além de título/sistema já existentes.
- Requisitos técnicos usam tri-state por sinal textual. Frases negativas e
  opcionais são mascaradas antes da busca positiva; conflito deixa `null`, cria
  `requires_*:ambiguous` e nota visível para curadoria.
- Removida a inferência insegura VTT => PC e Discord => microfone.
- Regressões escritas, ainda não executadas neste checkpoint:
  1. aliases exóticos de vagas/preço/descrição;
  2. alias de contato tornando URL desconhecida confiável;
  3. PC e microfone obrigatórios explícitos;
  4. PC/câmera opcionais => `false`;
  5. Foundry+Discord sem obrigação => requisitos `null`;
  6. sinais contraditórios => ambiguidade;
  7. `MIC audível` => microfone obrigatório.
- Próximo avanço permitido: P2. Antes de alterar o learning, suas guardas são
  registradas abaixo; testes P1/P2 serão executados juntos após o delta P2.

### Guardas parser P2 — aplicação do learning antes da edição

- Só hits já ativos retornados por `lookupLearningRules` ou
  `lookupFieldLearning` podem alterar campo; candidatos não entram no lookup.
- Correção humana tem precedência sobre DeepSeek e continua sem auto-publicação:
  altera apenas o draft em revisão.
- Campos corrigidos são aplicados antes da decisão de chamar IA; a IA não recebe
  como alvo campo já resolvido pelo store.
- `system_name` deve passar novamente pelo catálogo para recuperar `system_id`;
  se não casar, continua `needs_review`.
- Marcador antigo de `missing_fields` do campo aplicado deve ser removido, mas o
  gate canônico `normalizeDiscordTableDraft` precisa recalcular faltas reais e
  status. Não remover falta de campo que o valor aprendido não tornou válido.
- Proveniência do learning fica em `_learning_applied`, separada de eventual
  `_ai_suggestions` do DeepSeek; nenhuma mensagem chama learning humano de “IA”.

### Checkpoint parser P2 — learning aplicado, antes dos testes

- Hits ativos de `discord_learning_rules`/`discord_field_learning` agora são
  mesclados no campo real do draft antes do gate DeepSeek.
- O draft reaplicado passa por `normalizeDiscordTableDraft` com o catálogo de
  sistemas. Marcadores antigos do campo são removidos antes; o gate canônico
  recoloca qualquer falta que continuar materialmente inválida.
- Proveniência fica em `_learning_applied` com provider+fields e em nota legível.
  Não é mais apresentada como “Sugestão IA pendente”. DeepSeek, quando habilitado
  fora desta configuração, continua isolado em `_ai_suggestions` para confirmação.
- Telemetria `parseEval` foi adaptada para reconhecer learning já aplicado sem
  depender do provider de sugestão DeepSeek.
- Regressão backend foi alterada para exigir `system_name` corrigido no campo,
  `missing_fields` limpo e ausência de `_ai_suggestions` com automação DeepSeek
  desligada. Regressão adicional cobre a camada learning em `parseEval`.
- Nenhum teste foi executado ainda após esse delta. Próximo avanço permitido:
  P3.1, começando pelos testes focados do parser, utils e parseEval.

### Checkpoint parser P3.1 — testes focados

- Comando: `pnpm --filter @artificio/mesas-backend exec vitest run
  src/discord/__tests__/parseDiscordAnnouncement.test.ts
  src/routes/discord/utils.test.ts src/discord/__tests__/parseEval.test.ts`.
- Resultado: **3 arquivos, 155 testes, 155 verdes**.
- As novas regressões de aliases, requisitos conservadores, aplicação real do
  learning com DeepSeek desligado e telemetria passaram.
- Próximo avanço permitido: P3.2, reexecutar a auditoria nos dois corpora reais e
  comparar com o baseline P0 antes de qualquer gate global.

### Checkpoint parser P3.2/P3.3 — auditoria real antes dos gates globais

- Mesmo harness e mesmos 2 arquivos do P0 reexecutados: 200 mensagens, 169
  drafts, 31 descartes. Contagens de drafts permaneceram estáveis.
- Dos 63 drafts com alguma menção a PC/computador/notebook/mic/microfone/câmera,
  **47 agora recebem valor conservador** e 16 permanecem `null` por não haver
  obrigação/negação suficiente no sinal textual do harness. Baseline anterior:
  0 capturados e 63 não capturados. Redução do vazio: **74,6%**.
- Distribuição: `requires_pc=true` em 43 drafts; `requires_pc=false` em 3;
  `requires_microphone=true` em 1; câmera continuou `null` no corpus por ausência
  de formulação obrigatória coberta. Zero ambiguidades reais nestes dois arquivos.
- Amostras auditadas confirmam positivos reais (`obrigatório ter computador`,
  `necessário PC`, `ter um Computador é obrigatório`) e negativos reais
  (`não sendo obrigatório ter PC`, `recomendável/recomendo ter PC`).
- Os 16 restantes incluem mera menção de plataforma/dispositivo e listas livres
  sem verbo de obrigação. Permanecer `null` é intencional nesta etapa; não foi
  promovida inferência solta para ganhar cobertura artificial.
- O harness não carregou catálogos do banco; métricas de `system_id`/plataformas
  não são usadas para avaliar esta mudança.
- Próximo avanço permitido: suíte completa do backend mesas; depois registrar o
  resultado antes de iniciar `pnpm run lint` e `pnpm run build`.

### Checkpoint parser P3.4 — suíte backend completa

- Comando: `pnpm --filter @artificio/mesas-backend test`.
- Resultado: **44 arquivos, 467 testes, 467 verdes**.
- Mensagens em stderr são cenários negativos já esperados pelas próprias suítes
  (DB error, segredo Meta ausente, learning best-effort, falha simulada de mídia);
  exit code 0, nenhuma regressão nova.
- Próximo avanço permitido: P4.1 `pnpm run lint`. Registrar o resultado antes de
  executar P4.2 `pnpm run build`.

### Checkpoint parser P4.1 — lint global

- Comando: `pnpm run lint`.
- Resultado: **21/21 pacotes verdes**, exit code 0.
- Aviso `MODULE_TYPELESS_PACKAGE_JSON` de downloads e scripts `lint TODO` de
  apps legados são preexistentes; não houve erro ou warning bloqueante no escopo.
- Próximo avanço permitido: P4.2 `pnpm run build`. Depois, registrar antes da
  revisão final do diff.

### Checkpoint parser P4.2 — build global

- Comando: `pnpm run build`.
- Resultado: **21/21 pacotes verdes**, exit code 0.
- Avisos de chunks Vite maiores que 500 kB são preexistentes e não relacionados
  ao parser/backend; TypeScript do mesas-backend passou.
- Próximo avanço permitido: revisão read-only do diff e do working tree. Depois
  registrar o recorte próprio antes de qualquer validação API complementar ou
  fechamento documental.

### Checkpoint parser P4.3a — achado da revisão antes do ajuste final

- Revisão confirmou que o delta próprio está limitado ao parser/learning/testes e
  documentação; mudanças em `metaScrapeClient.ts`, `DraftEditorTab.tsx` e
  `MesaPage.tsx` já estavam no working tree e não foram alteradas nesta frente.
- Achado: `_learning_applied` preserva proveniência no backend, mas
  `buildDraftFieldInsights` ainda classifica qualquer divergência entre parse e
  normalizado como `humano`. Assim, um valor autoaplicado pelo learning apareceria
  no editor com origem errada.
- Correção antes do fechamento: ensinar `draftFormUtils` a ler
  `_learning_applied`, marcar origem `learning-store` e **não** preencher
  `suggestion` (evita botão “Aplicar” para valor já aplicado). Adicionar regressão
  frontend e então repetir testes focados + lint/build afetados.

### Checkpoint parser P4.3b — proveniência visual implementada, antes do reteste

- `buildDraftFieldInsights` agora sobrepõe a classificação genérica `humano`
  quando `_learning_applied.fields` contém o campo: origem `learning-store`,
  provider preservado e evidência textual de regra humana ativa.
- Insight aplicado não carrega `suggestion`; `DraftEditorTab` não renderiza botão
  de reaplicação para ele.
- Regressão frontend escrita para diferença `D&D 5e -> D&D 5.2` aprendida.
- Próximo avanço permitido: teste focado frontend; se verde, repetir lint/build
  repo-wide porque o delta mudou depois dos gates anteriores.

### Checkpoint parser P4.3c — teste visual focado

- Comando: `pnpm --filter @artificio/mesas-frontend exec vitest run
  src/features/discord-sync/draftFormUtils.test.ts`.
- Resultado: **1 arquivo, 37 testes, 37 verdes**.
- Próximo avanço permitido: repetir lint repo-wide; registrar antes do build final.

### Checkpoint parser P4.3d — lint final pós-ajuste visual

- `pnpm run lint`: **21/21 pacotes verdes**, exit code 0.
- Próximo avanço permitido: build repo-wide final; depois registrar estado final.

### Checkpoint parser P4.3e — build final pós-ajuste visual

- `pnpm run build`: **21/21 pacotes verdes**, exit code 0.
- Backend+frontend compilam com `_learning_applied`; avisos de chunk Vite seguem
  preexistentes.
- Próximo avanço permitido: `git diff --check` + estado final read-only. Nenhuma
  validação API adicional é necessária: não houve mudança de método/path/schema
  OpenAPI, só payload JSONB interno do draft.

### Checkpoint parser P4.3f — estado final local

- `git diff --check`: verde, exit code 0.
- Frente parser concluída localmente: requisitos técnicos, aliases, aplicação do
  learning, proveniência visual, telemetria e regressões.
- Validação final consolidada: backend 467/467; frontend focado 37/37; lint
  21/21; build 21/21; corpora reais 47/63 sinais conservadores capturados.
- Mudanças concorrentes preservadas: `metaScrapeClient.ts`,
  `DraftEditorTab.tsx`, `MesaPage.tsx`, `.claude/settings.local.json` e handoff
  untracked não pertencem a esta frente e não foram revertidos/misturados.
- Sem commit, push, PR, deploy, VM write ou ativação do DeepSeek automático.
- Limite de conclusão: código validado localmente; funcionamento com regras já
  acumuladas no banco exige smoke em beta após fluxo Git/deploy autorizado.

### Checkpoint parser P5.1-P5.3 — auditoria de autonomia antes de novo código

Achados materiais do fluxo atual:

1. **Dois stores concorrentes.** Toda correção grava simultaneamente em
   `discord_field_learning` e `discord_learning_rules`. O store legado nasce com
   `active=true` já na primeira ocorrência; regras novas nascem `candidate` e só
   ativam após repetição. O lookup legado pode sobrescrever o novo por último.
2. **Unidade errada para fatos.** `field_value` memoriza `campo + valor antes ->
   valor depois`. Isso é aceitável para normalização de entidade estável
   (`system_name`), mas perigoso para fatos por anúncio: uma correção
   `slots_total 4 -> 5`, `sexta -> sábado`, preço, título, descrição ou contato
   não pode alterar outra mesa só porque o valor de entrada coincide.
3. **Rejeição não volta à regra aplicada.** `_learning_applied` ainda guarda só
   provider+fields, sem `rule_id`, valor original e confiança. Se o humano
   recorrege um campo autoaplicado, o diff enxerga apenas saída aprendida -> nova
   saída; a regra original não recebe rejeição direta.
4. **Feedback enviesado.** Só campos editados viram feedback. Campo aceito sem
   mudança não gera confirmação positiva; portanto métricas não distinguem
   “correto e aceito” de “não revisado”. O registro é best-effort e falha pode ser
   silenciosa, sem outbox/retry.
5. **Aliases ainda podem colidir.** O mesmo label pode ser aprendido para campos
   diferentes no mesmo escopo; `findMatchedLabelToken` escolhe a primeira linha
   com valor igual, mesmo se o valor aparecer em duas linhas.
6. **Cobertura de avaliação curta.** `PARSE_EVAL_FIELDS` mede só action, preço,
   sistema, vagas, agenda e contato. Não mede type/modality/frequency/description,
   plataformas/cenário, faixa, estilos, experiência, nível ou requisitos técnicos.
   Mede accuracy, mas não cobertura/abstenção/taxa de correção/falso autopreenchimento.
7. **Autonomia operacional ainda é impossível por configuração.** Os gates
   `autonomyGateEnabled` e `autoApprovalEnabled` são hardcoded `false`. Isso é uma
   trava correta hoje; liberar exige código + aprovação nominal + shadow medido,
   não apenas variável de ambiente.

### Guarda imediata P5.4 autorizada pelo objetivo desta frente

- Parar de gravar e consumir `discord_field_learning` no fluxo vivo; manter a
  tabela apenas como legado/migração até limpeza explícita.
- Permitir autoaplicação `field_value` somente para `system_name`; demais campos
  aprendem estrutura via `label_alias` e continuam alimentando feedback/eval, mas
  nunca generalizam valores concretos entre anúncios.
- Manter activation threshold repetido de `discord_learning_rules`; nenhuma
  correção isolada vira regra ativa.
- Adicionar regressões provando que slots/preço/dia não geram regra de valor e
  que o store legado não participa do novo draft.
- Depois dos testes, registrar o resultado antes de propor as ondas seguintes.

### Checkpoint parser P5.3a-P5.3c — hardening implementado, antes dos testes

- `registerDraftCorrection` deixou de gravar no store legado e o enrich deixou de
  consultá-lo. A tabela permanece intacta para histórico/migração; nenhuma
  exclusão ou migration foi feita.
- `recordLearningRulesFromCorrections` e `lookupLearningRules` aceitam
  `field_value` somente para `system_name`. Isso também neutraliza regras antigas
  de slots/preço/agenda já migradas para `discord_learning_rules`.
- `LEARNABLE_FIELDS` permanece amplo para `label_alias`: fatos não generalizam
  valores, mas continuam podendo aprender que “Cadeiras livres” significa
  `slots_open`, por exemplo.
- Regressões adicionadas: fatos não geram insert `field_value`; lookup de fatos
  nem consulta banco; normalização de sistema continua elegível.
- Próximo avanço permitido: testes focados `learningRules` + `utils`; registrar o
  resultado antes de continuar a arquitetura de autonomia.

### Checkpoint parser P5.3d — hardening validado

- Testes focados: `learningRules` 12/12 + `utils` 9/9 = **21/21 verdes**.
- Sistema continua elegível a regra de normalização; slots/preço/dia/título não
  geram nem consultam regra de valor.

### P5.4 — matriz do que o produto deve aprender

1. **Entidades canônicas (autoaplicável após confirmação):** nome/alias de
   sistema -> `system_id`; nome/alias de VTT/comunicação/cenário -> IDs de
   catálogo. Aprender entidade, nunca só texto solto.
2. **Estrutura do anúncio (autoaplicável):** labels, ordem de seções, perfil de
   template por autor/canal e separadores. Ex.: “Cadeiras livres” ->
   `slots_open`. A estrutura localiza o valor; não memoriza o valor encontrado.
3. **Sinais semânticos (primeiro shadow):** frases e polaridade para tipo,
   modalidade, frequência, faixa, experiência, nível, requisitos técnicos,
   sessão zero, pago/grátis e autoria/homebrew. Regra precisa guardar trecho de
   evidência, polaridade, contexto e contraexemplos; não pode ser regex promovida
   por uma única correção.
4. **Fatos da ocorrência (nunca generalizar):** título, descrição, número de
   vagas, preço numérico, dia/hora, contato e URL. Devem ser extraídos novamente
   de cada anúncio usando estrutura/sinais aprendidos.
5. **Decisões operacionais (modelos separados):** ignorar, descartar, duplicata,
   draft pronto e publicar. Não misturar decisão de ação com acerto de campo;
   cada ação tem threshold, shadow e rollback próprios.

### P5.4 — ondas recomendadas rumo à autonomia

**Onda A — feedback confiável (prioridade máxima)**

- Persistir `rule_id`, before/after, confiança e evidence span em
  `_learning_applied`; quando humano recorrege, rejeitar a regra exata aplicada.
- Registrar também aprovação explícita de campos não alterados (“confirmado”),
  não apenas correções.
- Trocar gravação best-effort silenciosa por outbox/retry observável; UI mostra se
  a curadoria realmente alimentou learning.

**Onda B — aliases de entidades e estrutura**

- Generalizar o mecanismo seguro de alias para sistemas, VTT, comunicação e
  cenário, resolvendo sempre ID canônico.
- Detectar colisão de label entre campos e exigir correspondência única; aplicar
  precedência de escopo composite > author/channel > guild > global em vez de
  simplesmente unir todos os aliases.
- Aprender perfil de template por autor/canal (labels + seções), com fallback ao
  parser geral quando o perfil divergir.

**Onda C — sinais semânticos em shadow**

- Novo tipo de regra (`signal_rule`/equivalente) com campo, polaridade, trecho,
  contexto e confiança. Começar por requisitos técnicos, type/modality/frequency
  e sessão zero.
- Treinar/promover somente com confirmações independentes e contraexemplos;
  conflito força abstenção (`null`), nunca maioria silenciosa.

**Onda D — avaliação e autonomia gradual**

- Dataset dourado versionado derivado dos JSONs reais + decisões humanas.
- Métricas por campo: precisão, cobertura, abstenção, taxa de correção pós-fill e
  regressão por guild/autor; expandir `PARSE_EVAL_FIELDS` para todo o draft.
- Sequência operacional: auto-parse -> auto-fill seguro -> auto-marcar ready ->
  auto-discard forte -> auto-publicar. Cada degrau só libera após shadow/canário;
  publicação permanece o último e exige aprovação nominal da governança.

### Gates mínimos pro produto “andar sozinho” sem andar errado

- Campo crítico nunca é liberado por confidence global; precisa precisão e
  volume do próprio campo, mais ausência de conflito.
- `null`/abstenção conta como comportamento saudável, não falha a ser escondida.
- Drift monitorado por autor/canal: queda de precisão suprime regra e volta ao
  parser geral automaticamente.
- Auto-ready só após lote shadow sem falso “pronto”; auto-publicação só depois de
  período canário, rollback testado e autorização explícita.
- Meta realista de poucos dias: ingestão + draft + auto-fill seguro quase sem
  toque. Publicação completamente autônoma não deve ser prometida sem dados
  rotulados suficientes.

Decisão do mantenedor em 2026-07-14: implementar primeiro **Onda A — feedback
confiável**. Onda B permanece posterior; aliases e templates não avançam antes
de rastreabilidade, recorreção e persistência observável do feedback humano.

#### Checkpoint P5.5 — Onda A aprovada

- Escopo aprovado: persistir `rule_id`, before/after, confiança e evidence span
  em `_learning_applied`; rejeitar/suprimir a regra exata quando humano
  recorrege; registrar confirmação explícita de campos mantidos; substituir
  gravação best-effort silenciosa por retry/outbox observável na UI.
- Guardas mantidas: learning só altera draft; sem auto-ready, auto-descarte,
  auto-publicação ou DeepSeek automático.
- Próximo avanço registrado: localizar contratos, schema e caminhos de gravação
  existentes; voltar à spec com mapa material antes de implementar.

#### Checkpoint P5.6/P5.7 — mapa material e contrato da Onda A

- Aplicação atual: `lookupLearningRules` retorna `ruleId`, valor, confiança e
  escopo, mas `_learning_applied` persiste apenas provider+fields. O texto cru já
  está disponível em `enrichDraftWithLlm`, portanto o span do hint pode ser
  calculado sem nova chamada externa.
- Recorreção atual: `registerDraftCorrection` não lê a regra aplicada. Depois do
  commit dispara quatro writers independentes; todos engolem erro. A UI também
  engole falha do endpoint de correção. Resultado: curadoria pode parecer salva
  sem alimentar learning.
- Confirmação atual: somente campos alterados viram feedback. O clique explícito
  em “salvar campos” não registra os valores mantidos.
- Contrato escolhido:
  1. expandir `_learning_applied` com aplicações contendo `rule_id`, campo lógico,
     campos afetados, before/after, confiança, escopo e evidence span;
  2. usar a própria linha imutável de `import_corrections` como outbox, com
     `pending/completed/failed`, tentativas, erro e timestamp; correção e evento
     nascem atomicamente;
  3. processar todos os efeitos de uma correção em uma única transação separada;
     falha reverte o lote e mantém evento recuperável, sem reforço duplicado;
  4. recorreção de campo afetado suprime/incrementa rejeição do `rule_id` exato;
  5. “salvar campos” envia `confirmed_fields` para valores presentes e mantidos;
     backend valida contra payload real e grava feedback `field_confirmation`;
  6. resposta expõe status/tentativas/erro; frontend avisa sucesso, pendência ou
     falha. Retry explícito por draft reprocessa eventos pendentes/falhos.
- Migration prevista: 146, alterando corpus/outbox, constraint de feedback e
  outcome de aplicação para `rejected_by_human`. Sem auto-ready/publicação.
- Próximo avanço registrado: implementar migration, tipos e serviço de outbox;
  depois voltar à spec antes de integrar API/UI.

#### Checkpoint P5.8a — fundação implementada, ainda não integrada

- Migration 146 transforma `import_corrections` em outbox, adiciona vínculo
  idempotente do feedback e outcomes `field_confirmation`/
  `rejected_by_human`.
- `_learning_applied.applications` agora carrega regra, campo lógico, campos
  afetados, before/after, confiança, escopo e span do texto cru.
- Novo processador executa reforço, alias, entidade, feedback, confirmação e
  rejeição da regra exata em uma transação; falha marca evento recuperável.
- Estado honesto: endpoint ainda dispara writers antigos e UI ainda engole erro;
  a Onda A não funciona ponta a ponta neste checkpoint.
- Próximo avanço registrado: substituir writers antigos pelo outbox no endpoint,
  remover aplicação rejeitada do payload, expor retry/status; depois integrar UI.

#### Checkpoint P5.8b/P5.8c — integração concluída, validação pendente

- `registerDraftCorrection` agora cria corpus/outbox na mesma transação do draft,
  processa pelo serviço único e devolve status/tentativas/erro; writers
  best-effort paralelos foram removidos desse caminho.
- Metadado de regra aplicada é retirado do payload quando campo afetado é
  recorreto; outbox registra `rejected_by_human` e suprime somente aquele ID.
- API aceita `confirmed_fields` e oferece retry por draft. Frontend envia campos
  presentes mantidos no clique de salvar, tenta retry uma vez e mostra se a
  curadoria foi registrada ou ficou pendente. Falha de learning não desfaz draft.
- Estado honesto: código ainda não compilado/testado neste checkpoint.
- Próximo avanço registrado: adicionar regressões unitárias do metadata, outbox,
  recorreção, confirmação e UI; então executar somente testes focados.

#### Checkpoint P5.9a — primeira regressão focada

- Frontend: 10/11 verdes. Falha não é do contrato Onda A: `buildUpdatedPayload`
  normaliza campos ausentes do fixture para `null/false`, portanto `corrections`
  não fica vazio. A chamada contém `confirmed_fields` corretos e retry ocorreu.
- Expectativa será ajustada para aceitar correções normalizadas e exigir o que a
  Onda A promete: campos mantidos confirmados + retry do mesmo `correction_id`.
- Resultado backend não foi entregue pelo runner paralelo após a falha frontend;
  será executado novamente, isolado, depois do ajuste.
- Próximo avanço registrado: corrigir somente a expectativa obsoleta e repetir
  os focados backend/frontend.

#### Checkpoint P5.9b — focados verdes; migration histórica corrigida

- Backend: **3 arquivos, 26/26 verdes**. Frontend: **1 arquivo, 11/11 verdes**.
- Revisão pré-gate encontrou risco na migration 146: adicionar status com default
  `pending` colocaria todas as correções históricas na fila e poderia reforçá-las
  novamente. Contrato correto: linhas existentes recebem `completed`; depois o
  default da coluna muda para `pending` apenas para eventos futuros.
- Próximo avanço registrado: corrigir migration, então executar testes completos
  backend/frontend. Lint/build continuam bloqueados até novo checkpoint.

#### Checkpoint P5.9c — suite backend expôs harness legado

- Backend completo: 4 falhas, todas em `adminImportInbox.test.ts`; mock
  transacional termina em `.values().execute()` e não implementa
  `.returning().executeTakeFirstOrThrow()` usado para obter o ID durável.
- Não é falha de runtime/Kysely. Harness será atualizado para devolver
  `correction-1` e mockar o processador de outbox; lógica interna do processador
  permanece coberta pelos testes próprios.
- Frontend do lote não possui resultado confiável após rejeição do paralelo.
- Próximo avanço registrado: corrigir harness; rodar arquivo backend isolado e
  frontend completo isolado antes de repetir backend completo.

#### Checkpoint P5.9d — harness e frontend verdes

- `adminImportInbox.test.ts`: **44/44 verdes** após o mock refletir contrato
  Kysely real e isolar o processador já testado separadamente.
- Frontend completo: **18 arquivos, 177/177 verdes**.
- Próximo avanço registrado: repetir backend completo; documentar resultado
  antes de qualquer lint/build.

#### Checkpoint P5.9e — suites completas verdes

- Backend: **45 arquivos, 487/487 testes verdes**.
- Frontend: **18 arquivos, 177/177 testes verdes**.
- Onda A está implementada localmente; isso não prova migration real, retry
  contra Postgres ou UI em beta.
- Próximo avanço registrado: lint repo-wide; registrar antes de API governance,
  build e reauditoria dos corpora.

#### Checkpoint P5.9f — lint verde

- Lint repo-wide via RTK: **21/21 pacotes verdes**.
- Aviso preexistente de `downloads` e scripts `lint TODO` legados permanecem sem
  erro bloqueante, já documentados nesta spec.
- Próximo avanço registrado: `pnpm verify:api`, obrigatório pela rota nova;
  registrar resultado/artefatos antes do build.

#### Checkpoint P5.9g — API governance verde

- `pnpm verify:api` via RTK: verde; 445 rotas inventariadas, 358 operações no
  bundle, 0 breaking changes. Mesas ganhou 3 deltas não-breaking.
- Três avisos de paths ambíguos são preexistentes; nenhum nasce na rota Onda A.
- Artefatos gerados foram atualizados pelo comando canônico.
- Próximo avanço registrado: build repo-wide; registrar antes da reauditoria dos
  corpora e diff-check final.

#### Checkpoint P5.9h — build revelou adapter Inbox desatualizado

- Build falhou somente no frontend mesas: `ModeracaoSection` adapta `inboxApi`
  para `DraftApiOperations`, mas `InboxCorrectionResult` ainda descreve resposta
  antiga sem `learning`. Backend compartilhado já devolve o novo contrato.
- Correção definida: alinhar schema/tipo do Inbox, encaminhar
  `confirmed_fields`, expor retry e ligá-lo no adapter. Sem cast para esconder o
  erro.
- Próximo avanço registrado: alinhar adapter/API e repetir build repo-wide.

#### Checkpoint P5.9i — segundo build revelou fixture tipado

- Adapter Inbox compilou e frontend mesas buildou. Backend parou em um único
  fixture de `llmContextPack.test.ts`: `LearningRuleHit` ganhou `inputToken`, mas
  o objeto literal antigo não foi atualizado.
- Próximo avanço registrado: adicionar o token coerente ao fixture e repetir
  build completo. Nenhuma mudança de runtime neste passo.

#### Checkpoint P5.9j — build verde

- Build repo-wide via RTK: **21/21 pacotes verdes**.
- Avisos de chunk grande são preexistentes e não bloqueantes.
- Próximo avanço registrado: reauditar os dois corpora com harnesses de vagas e
  sistemas; depois registrar antes de `git diff --check`/inspeção final.

#### Checkpoint P5.9k/P6.4b/P7.4b — corpora reauditados; P7 segue aberta

- 200 mensagens, 169 drafts.
- Vagas: 28 pares; 19 genéricos ambíguos, 7 explicitamente disponíveis e 2
  explicitamente ocupados. Resultado preservado; P6.4 pode fechar localmente.
- Sistemas: 155 hints, 98 vinculados, 57 abstidos, 61 com alternativas. D&D 5e
  segue selecionado corretamente; Gamma não reapareceu.
- Novo bug material: alternativas dentro da árvore D&D incluem combinações
  semanticamente impossíveis como `D&D 1e 2024` e `D&D 1e 3.5`. Restringir à
  mesma raiz evitou Gamma, mas não protege contra árvore achatada/poluída pelo
  produto cartesiano de edições.
- P7.4 permanece aberta. Pela governança, próximo avanço depende do mantenedor:
  corrigir agora o gerador/filtro de alternativas hierárquicas (recomendado) ou
  registrar débito acionável. Diff-check final fica bloqueado até a decisão.

#### Correção do mantenedor — semântica de edição e variante

- `2014` e `2024` não são edições de D&D; são variantes de uma edição.
- Hierarquia canônica: sistema `D&D` → edição `5e` → variantes `2014`/`2024`.
  Edições `1e`, `2e`, `3e`, `4e`, `5e` são irmãs; variante só pode combinar com
  sua cadeia ancestral. Portanto `1e 2024` e `1e 3.5` denunciam flatten que
  perdeu parentesco, não simples problema de nomenclatura.
- Decisão técnica: candidatos e seleção devem respeitar cadeia ancestral inteira,
  não apenas compartilhar raiz. Próximo avanço registrado: localizar onde o
  produto cartesiano nasce e voltar com mapa material antes de editar.
- Trava explícita do mantenedor: variante não é irmã de edição. A relação é
  estritamente `system.parent_id = null`, `edition.parent_id = system.id` e
  `variant.parent_id = edition.id`; matching e sugestões percorrem somente
  filhos diretos em cada passo, nunca todos os descendentes da raiz de uma vez.
- Causa material localizada: `findSystemMatch` achata todos os descendentes da
  raiz; `findExistingChildMatch` busca pelo `parent_id` do candidato, portanto
  entre seus irmãos, em vez de sob o próprio candidato. A dupla quebra permite
  produto cartesiano edição×variante.
- Checkpoint de regressão focada: 23/26 verdes; três falhas úteis revelaram duas
  causas restantes. `matchSystem` encontra a variante `2024`, mas o fallback de
  sufixo remove o ano e regride para `5e`; `scoreOne` ainda pontua edição com
  tokens incompatíveis só pela base comum. Correção exigida: descendente direto
  encontrado vence stripping; edição candidata com tokens presentes e
  incompatíveis não recebe `base_plus_edition`. A expectativa antiga de
  `D&D 5e 2014` apontar para a raiz também deve passar a apontar para o pai `5e`.
- Checkpoint após correções: 25/26. Falha restante: travessia parcial `D&D → 5e`
  é promovida indevidamente a `existing_child_match` mesmo restando o token
  `2014`. Só há match existente completo quando todos os tokens hierárquicos
  foram consumidos; caso parcial mantém `5e` como pai e recomenda criar variante.
- Terceiro ciclo continuou 25/26: exigir consumo integral removeu o falso match,
  porém a função binária descartou junto o pai parcial `5e`. Contrato necessário:
  retorno hierárquico distingue `partial parent` de `complete descendant`; o
  primeiro ancora criação da variante, o segundo permite merge existente.
- Checkpoint hierarquia verde: testes focados do scorer + parser **26/26**.
  Cobertura prova `D&D → 5e → 2024`, bloqueia `1e → 2024`, bloqueia Gamma
  World por alias colidente e oferece `2014`/`2024` como filhos quando `5e` é a
  edição selecionada. Próximo avanço: reauditoria dos dois corpora reais.
- Reauditoria corpus: 200 mensagens, 169 drafts, 155 hints, 98 matches, 57 sem
  match, 80 com alternativas. Produto entre ramos foi bloqueado pelo matcher,
  mas o snapshot ainda entrega sob `5e` nós nomeados `3rd Edition`, `4th
  Edition`, `3.0` e `3.5`. Antes de nova edição, distinguir parentesco errado no
  catálogo de erro no flatten do harness; suíte ampla permanece bloqueada.
- Diagnóstico contra API pública prod read-only: a árvore real de D&D tem filhos
  raiz `2024`, `Advanced Dungeons & Dragons`, `3.5e`, `4e`, `5e`, `1e`; sob
  `5e` há somente `2024`, `Next`, `2014`. Portanto o produto cartesiano era
  criado pelo harness a partir do legado `sistemas.json`, repetindo o loop do
  importador antigo; não representa a árvore atual entregue ao parser.
- Defeito real residual: existe também `D&D → 2024` como `edition`, duplicando a
  variante correta `D&D → 5e → 2024` e violando a decisão do mantenedor.
  Reauditoria deve consumir API tree real. Limpeza do duplicado exige auditoria
  de referências + migration segura; não fazer DELETE/reparent no escuro.
- Reauditoria com API tree real: 200 mensagens, 169 drafts, 155 hints, **122
  matches**, 33 sem match, 88 com alternativas. Nova regressão material: casos
  `D&D 5e` param na raiz D&D. O teste focado mascarou a forma real do catálogo ao
  usar `name="5th Edition"`/`slug="5e"`; prod usa nome próprio curto `name="5e"`
  e slug técnico composto. Próximo avanço: reproduzir exatamente o payload real
  e corrigir o reconhecimento do nó curto antes de qualquer suíte ampla.
- Fixture espelhada do payload prod: `D&D 5e` simples passa; `D&D 5e 2024`
  falha porque os filhos raiz inválido `2024` e correto `5e` empatam. Contrato de
  desempate: tokens hierárquicos são consumidos em ordem textual; no nível raiz
  vence `5e` (primeiro token), depois sob `5e` vence `2024` (segundo token).

#### Ampliação do mantenedor — contrato universal de hierarquia

- A correção não é especial para D&D/5e. Contrato universal em todas as
  superfícies: `system(depth=0,parent=null) → edition(depth=1,parent=system) →
  variant(depth=2,parent=edition)`.
- Antes de concluir P7, auditar parser/scorer, loaders, rotas e validações de
  criação/edição/moderação, sugestões em lote, migrations/importadores, tipos e
  componentes frontend. Nenhuma superfície pode tratar variante como irmã da
  edição, permitir pai de tipo errado ou fabricar produto cartesiano.
- Estado honesto neste checkpoint: parser focado corrigido parcialmente; revisão
  transversal ainda não concluída. Resíduos já confirmados: importador JSON
  legado cartesiano, fonte JSON sem parentesco e duplicado `2024` no catálogo.
- Mapa transversal material:
  - `apps/mesas/backend/routes/systems.ts` e `systemSuggestionsAdmin.ts` permitem
    `variant` sob `subsystem`;
  - `systemSuggestions.ts` aceita tipo/pai de sugestão sem validar cadeia;
  - `SystemSuggestionModal.tsx` oferece todos os nós como pai, marca pai como
    opcional e usa copy “Variante de Sistema”;
  - `SystemSuggestionResolutionDrawer.tsx` oferece edição **ou subsistema** como
    pai de variante;
  - `apps/site/db/repo/catalog.ts`, fonte central, valida enum/status/nome, mas
    não valida relação entre `node_type` e tipo do pai em create/update;
  - constraints atuais não garantem tipo do pai; importador JSON legado segue
    cartesiano.
- Correção final do mantenedor: **`subsystem` não existe no modelo do produto**.
  Contrato único e fechado: `system → edition → variant`. Toda ocorrência de
  `subsystem` em enum, API, banco, sugestão, moderação ou frontend é legado a
  remover; dados existentes precisam ser contados/reclassificados antes de
  estreitar constraint, nunca apagados no escuro.
- Auditoria pública read-only do catálogo atual: `system=691`, `edition=395`,
  `variant=187`, **`subsystem=0`**. Não há dado ativo para reclassificar; remoção
  é de enum/validação/UI/schema. Migration deve abortar se algum ambiente tiver
  `subsystem`, em vez de converter automaticamente.
- Resíduo genérico adicional: matcher de descendentes reconhece apenas tokens
  com forma de edição/versão/ano. Variantes textuais (`Pulp`, `Next`,
  `Remastered`) não são selecionadas. A travessia pai→filho deve aceitar também
  sequência canônica do nome próprio do filho, mantendo desempate e nível
  direto. Prova obrigatória fora de D&D: `Call of Cthulhu → 7e → Pulp`.
- Auditoria transversal após a correção do mantenedor encontrou resíduos
  operacionais fora de `apps/mesas`: `packages/catalog-ui`, `apps/site-admin`,
  clientes de catálogo de `apps/downloads` e `apps/glossario`, além de textos do
  drawer de resolução. A revisão não pode ser declarada completa enquanto esses
  consumidores ainda aceitarem/exibirem `subsystem`.
- Decisão fechada e genérica, não específica de D&D: todo catálogo usa somente
  três tipos e três níveis: `system` raiz; `edition` filha direta de `system`;
  `variant` filha direta de `edition`. Não existe quarto tipo, nível alternativo
  nem variante diretamente sob sistema. Documentos/migrations históricos podem
  mencionar `subsystem` apenas como registro imutável ou guarda fail-closed para
  rejeitar legado, nunca como contrato vigente.
- Próximo avanço registrado: eliminar os consumidores operacionais transversais,
  ajustar constraints/migrations finais e repetir busca global antes dos testes.
- Checkpoint transversal: ocorrências operacionais foram removidas de
  `catalog-ui`, `site-admin`, `downloads`, `glossario` e UI de `mesas`. A busca
  restrita ao código ativo agora encontra apenas migrations históricas e a
  migration nova que rejeita explicitamente legado.
- Exceção ainda acionável: `apps/mesas/database/apply_migrations_06_07.sql` é um
  script manual antigo, mas executável, e ainda cria o quarto tipo. Ele não pode
  permanecer como caminho válido. Próxima etapa: banco — neutralizar esse script,
  adicionar migration final de Mesas e validar constraints/parentesco exatos.
- Checkpoint de banco: `migration_147_system_hierarchy_contract.sql` aborta se
  encontrar tipo ou parentesco legado; depois restringe tipo, profundidade e pai
  e instala trigger de escrita. `apply_migrations_06_07.sql` agora aborta no
  início e também não contém o quarto tipo na definição legada. A migration
  central 008 aplica o mesmo contrato à fonte canônica.
- Nenhum dado foi reclassificado por heurística. Próximo avanço registrado:
  remover produto cartesiano residual do importador JSON e cobrir UI/serviços
  com testes genéricos de pai permitido.
- Checkpoint de implementação: o loop edição×variante e o fallback que promovia
  variante sem edição foram removidos de `importSistemas.ts`; o formato legado
  continua rejeitado quando contém variantes sem pai explícito. Sugestões em lote
  passam por função pura que valida a cadeia inteira contra catálogo ou item pai.
- `CatalogNodeForm` filtra pai por tipo (`system` para edição, `edition` para
  variante), exige pai fora da raiz e não oferece quarto nível. Modal de Mesas
  recebeu regressão equivalente. Próximo avanço: testes focados de parser,
  backend hierarchy, `catalog-ui` e modal; corrigir falhas antes de suíte ampla.
- Checkpoint focado verde: backend hierarchy/scorer/parser **39/39**;
  `packages/catalog-ui` **14/14**; modal de sugestão de Mesas **3/3**. A prova
  externa a D&D (`Call of Cthulhu → 7e → Pulp`) está verde.
- Próximo avanço não é suíte ampla ainda: auditar dados existentes que podem ser
  estruturalmente válidos, mas semanticamente classificados no nível errado
  (ex.: ano cadastrado como edição direta apesar de também existir como variante
  de uma edição). Produzir evidência e correção rastreável; não inferir todos os
  anos como variantes, pois o significado depende do sistema/edição.
- Auditoria pública real (691 sistemas, 395 edições, 187 variantes) encontrou
  duas violações estruturais em D&D: `1e` está tipada como variante diretamente
  sob sistema; `Basic Set (Mentzer)` está como variante sob essa variante. A
  decisão já dada pelo mantenedor resolve sem heurística: `1e` é edição, logo o
  filho permanece variante e a cadeia volta a ser válida.
- Duplicação semântica detectada por mesmo nome em níveis diferentes: D&D/2024,
  Mage/Anniversary, Mothership/2024, Old-School Essentials/Essentials e
  Shadowrun/Anniversary. Somente D&D está decidido e tem uso: o nó errado
  `D&D → 2024` (id `ac74d486-e3d3-4635-b7a0-7847f04050f5`) possui 1 mesa; o nó
  correto `D&D → 5e → 2024` (id `c3d31503-b4af-4663-af10-c1ef062102c3`) possui
  0. Correção deve remapear referências antes de mesclar/remover o duplicado.
- Os quatro outros grupos são apenas candidatos de curadoria; mesma grafia não
  prova qual edição é o pai correto. É proibido corrigi-los automaticamente.
- Próximo avanço registrado: mapear todas as FKs/mapeamentos dos dois nós D&D e
  preparar migrations ordenadas, sem executar escrita em ambiente real.
- Mapa de persistência: `tables.system_id` usa UUID central sem FK local;
  `discord_import_table_drafts` pode guardar o UUID em payloads; e
  `discord_field_learning`/`discord_learning_rules` podem perpetuá-lo como
  `system_entity`. Migration Mesas 148 remapeia todos esses caminhos e verifica
  ausência do UUID antigo. Ela deve rodar antes da migration central 009.
- Migration central 008 reclassifica explicitamente D&D 1e, depois aborta diante
  de qualquer outra cadeia estrutural inválida antes de instalar a trava.
  Migration central 009 valida IDs/tipos/pais, move mappings/sugestões/aliases,
  cria redirect e marca o D&D 2024 direto como `merged`, com evento/versionamento.
  O UUID do pai 5e foi confirmado via API: `c324b0de-7dda-4a9c-9109-d8b47c04ffd8`.
- Nenhuma migration foi executada. Próximo avanço: auditoria estática global de
  tipos/pais e testes do catálogo central antes das suítes amplas.
- Checkpoint estático: nenhuma ocorrência operacional do quarto tipo; somente
  testes de ausência, migrations históricas e guardas fail-closed. Validação:
  catálogo central **8/8**, `catalog-client` **3/3**, TypeScript de Glossário e
  Downloads verde.
- Próximo avanço registrado: reprocessar os dois JSONs reais (200 anúncios)
  contra a árvore pública atual, antes de API verify/lint/build amplos.
- Reauditoria real: 200 mensagens, 169 drafts, 155 hints, 122 vinculados, 33 sem
  vínculo e 87 com alternativas. P7 permanece aberta: D&D real com `5e`,
  `5ª Edição`, `2014` ou `2024` seleciona apenas a raiz e ainda oferece Gamma
  World. O teste verde usava nomes curtos (`5e`), mas o catálogo real nomeia o
  filho `Dungeons & Dragons 5e`; a repetição da raiz impede casar o sufixo.
- Política corrigida antes de editar: ao avaliar filho direto, remover do nome do
  filho apenas o prefixo que corresponde à cadeia ancestral já confirmada e casar
  o restante (`Dungeons & Dragons 5e` → `5e`). Depois de raiz forte confirmada,
  alternativas de outras raízes não entram; alternativas são apenas ancestrais,
  irmãos ou filhos diretos da cadeia selecionada.
- Outro falso positivo material (`OPRPG ... versão 2.0 do livro` → sistema `Do`)
  confirma que alias/nome raiz genérico de uma palavra não pode vencer só por
  aparecer dentro de frase longa. Próximo avanço: reproduzir fixtures com nomes
  reais, corrigir travessia/poda e repetir focados antes de novo corpus.
- Diagnóstico controlado confirmou a hipótese do mantenedor: é cruzamento de
  aliases. O nó incorreto `D&D → 2024` tem alias `D&D 5.5`; o descendente recebia
  pontos pela base `D&D` mesmo com edição incompatível (`5e` ≠ `5.5`). Gamma
  World, Drakar och Demoner e Starstone também entram por aliases `D&D` que não
  correspondem à base canônica desses sistemas.
- Correção definida: uma representação com tokens de edição incompatíveis é
  descartada antes de pontuar sua base; alias cuja base não compartilha chave com
  o nome canônico do próprio sistema não gera `base_plus_edition`/qualificador.
  Nome canônico continua podendo casar normalmente.
- Primeira validação: parser hierárquico **6/6**, scorer **22/24**. A trava por
  semelhança canônica foi ampla demais e bloqueou alias traduzido único (`O Um
  Anel` → `The One Ring`) e o alias de edição `D&D 5e`, degradando o nome de filho.
- Refinamento correto: alias único entre sistemas pode estender; alias colidente
  só pode estender no dono cuja base/acrônimo canônico confirma o alias. Nos
  demais donos, igualdade exata pode ser exibida como ambígua, mas não
  `base_plus_edition`/qualificador. Próximo avanço: calcular proprietários do
  alias no catálogo inteiro, ajustar scorer e repetir os mesmos focados.
- Refinamento implementado e verde: parser **6/6**, scorer **24/24**. Alias único
  traduzido funciona; alias colidente `D&D` é estendido apenas por Dungeons &
  Dragons; `D&D 5e`, `5ª Edição` e `5ed` chegam à edição 5e apesar do alias
  incompatível `D&D 5.5` no nó errado.
- Próximo avanço registrado: segunda rodada do corpus real, com resumo e casos
  controlados; não avançar para gates amplos se Gamma ou raiz D&D persistirem.
- Rodada 2 manteve 122/155 e removeu Gamma/Starstone, mas casos controlados sem
  thread ainda selecionam raiz/nó errado e Drakar och Demoner permanece como
  alternativa. Diferença material da fixture: mensagem sem thread começa com
  `Título: Teste`; `splitThreadName` pode interpretar o primeiro `:` como
  `sistema: título` antes da linha rotulada `Sistema:`. Matcher unitário verde
  não prova o fluxo de extração do hint.
- Próximo avanço: isolar mensagem sem thread com e sem linha `Título:` e imprimir
  `_system_source_hint`; depois corrigir precedência de sinal. Auditar aliases
  reais de Drakar antes de criar nova regra.
- Isolamento inocentou extração/thread: `_system_source_hint` é exatamente
  `D&D 5e` com/sem `Título:` e com/sem thread. Drakar não possui alias D&D;
  seus aliases são Dragonbane/Dragons and Demons/Drakar & Demoner. A colisão
  vem da chave derivada: `Drakar och Demoner` e `Dungeons and Dragons` produzem
  acrônimo equivalente `DnD`.
- Próximo ajuste: chave/acrônimo derivado serve como fallback, nunca empata com
  nome ou alias explícito da raiz. Reproduzir todos aliases reais da raiz D&D
  (`D&D`, `DD`, `DnD`, `Dungeons and Dragons`, `Dungeons n dragons`) na fixture
  antes de alterar ranking.
- Causa exata após imprimir sinais dos filhos: slug `...--3-5e` de D&D 3.5e é
  tokenizado como base `3` + edição `5e`, empatando indevidamente com o filho 5e.
  Ao empatar, traversal para na raiz; o fallback remove `5e` e o alias versionado
  `D&D 5.5` pontua só pela base contra hint agora sem versão, escolhendo 2024.
- Correção definida: normalizar versão decimal hifenizada de slug (`3-5e` →
  `3.5e`); representação com edição nunca pontua base contra hint sem edição;
  base exata/alias explícito supera match apenas por chave acrônima derivada.
  Próximo passo: implementar e repetir unitários + controle público.
- Correção implementada; fixtures agora incluem aliases reais, slug 3.5e e
  Drakar. Parser/scorer **30/30**. Próximo avanço: quatro controles contra API
  pública; corpus completo só roda se `D&D 5e/5ª/5ed` chegarem a 5e,
  `D&D 5e 2024` chegar à variante e Gamma/Drakar não aparecerem.
- Controle público: `D&D 5e 2024` já chega à variante correta sem Gamma/Drakar;
  porém `D&D 5e` desce além da edição até a variante textual `Next`. Causa: o
  slug da variante contém o ancestral `...--5e--next` e foi tratado como sinal
  local do filho.
- Regra final de travessia: próximo nível usa somente `name`, `name_pt` e aliases
  próprios do filho. `slug/path_slug` identificam caminho, mas nunca provam o
  próximo nível porque carregam ancestrais. Próximo passo: remover esses dois
  sinais do descendente, repetir 30 focados e quatro controles.
- Sinais ancestrais removidos do matching/exatidão de descendente; focados
  permanecem **30/30**. Próximo avanço registrado: repetir controles públicos;
  corpus só depois dos quatro resultados corretos.
- Controles públicos verdes: `D&D 5e` chega à edição 5e; `D&D 5e 2024` chega à
  variante 2024; Gamma/Drakar não aparecem; alternativas restantes pertencem à
  cadeia (ancestral e filhos). Próximo avanço: corpus completo com relatório de
  todos os hints D&D.
- Hint que informa só variante (`Dungeons & Dragons 2014`) não pula edição por
  heurística enquanto catálogo público ainda diverge. Após migrations/backup,
  inferência por variante única pode ser avaliada genericamente; não criar
  exceção hardcoded D&D no parser.
- Corpus após correções: 122/155 vinculados (33 nomes ausentes do catálogo), 84
  com alternativas. Casos D&D comuns agora chegam a 5e; `5e 2014` chega à
  variante; controle `5e 2024` chega à variante; Gamma sumiu. Métrica total não
  sobe porque a maioria dos 33 é sistema não cadastrado, não falha hierárquica.
- Resíduo de sugestões: filtro ainda permite irmãos após seleção forte, exibindo
  `Advanced D&D` para `D&D 5e` e Drakar quando só a raiz foi selecionada. Regra
  correta: com seleção, candidatos ficam em ancestrais + filhos diretos; irmãos
  e raízes concorrentes só entram quando não houve seleção conclusiva.
- Próxima melhoria registrada: inferir variante omitindo edição apenas quando o
  sinal local identifica um único descendente/uma única cadeia; incluir formas
  abreviadas `14`/`24` e `5e'24` somente sob essa trava de unicidade.
- Algoritmo fechado antes de editar: (1) sem filho direto compatível, aceitar um
  único descendente compatível e preservar sua cadeia real; (2) mesmo nome/sinal
  compatível em níveis diferentes torna o resultado ambíguo e mantém o pai;
  (3) ano curto casa apenas com sufixo de ano de quatro dígitos já existente no
  catálogo; a mesma regra de unicidade decide. Isso resolve `2014` omitindo 5e e
  `5e'24`, mas não escolhe entre os dois nós 2024 atuais antes da migration.
- Inferência implementada e focados **33/33**. Regressões provam: `D&D 2014` →
  variante única sob 5e; `D&D 2024` mantém raiz enquanto duplicado existe em dois
  níveis; `D&D 5e'24` → variante 2024. Próximo avanço: controle público + corpus
  final, depois somente gates amplos.
- Corpus final: seleção/alternativas hierárquicas esperadas; `2014` omitindo 5e
  e `5e'24` funcionam; `2024` sem edição permanece ambíguo enquanto o catálogo
  contém dois níveis; irmãos/Drakar/Gamma saíram após seleção.
- Último erro material: `d&d 3 5` escolhe variante textual `version 3.5` sob 4e
  porque tokens `3.5` e `3.5e` divergem. Decisão genérica: versão decimal com ou
  sem sufixo `e` converge ao mesmo token (`3.5`). Próximo passo: canonicalizar,
  adicionar regressão e validar focados/controle 3.5 antes dos gates amplos.
- Decimal com/sem `e` canonicalizado; focados **35/35**, incluindo catálogo
  adversarial com edição 3.5e e variante homônima sob 4e. Próximo avanço:
  controle público `d&d 3 5`; se verde, registrar e iniciar verify/lint/build.
- Controle público verde: `d&d 3 5` seleciona o nó edição 3.5e real, não a
  variante sob 4e. Frente hierárquica liberada para gates amplos. Próximo avanço:
  `pnpm verify:api`; registrar resultado antes das suítes completas.
- Gate `pnpm verify:api` falhou em `api:check`: consumidor novo high-confidence
  `POST /api/v1/admin/import/drafts/:param/correction/retry-learning` não possui
  rota inventariada correspondente. Três warnings de paths ambíguos são
  preexistentes; o bloqueante novo pertence à Wave A desta spec.
- Conforme governança de bug descoberto, nenhuma correção/debt será escolhida sem
  mantenedor. Próximo passo read-only: localizar rota e padrão de inventário;
  depois mantenedor decide corrigir agora (recomendado) ou registrar débito.
- Mantenedor decidiu corrigir agora. Diagnóstico confirmou que
  `createCorrectionHandler` monta `retry-learning` nos dois prefixos, Discord e
  Inbox. A edição direta de `mesas.openapi.yaml` foi corretamente descartada pelo
  gerador: a fonte canônica dessas rotas factory é
  `docs/api/openapi/.overlays/mesas.overlay.yaml`. Próximo avanço: declarar ambos
  os caminhos no overlay e repetir `pnpm verify:api`.
- Gate corrigido na fonte canônica: ambos os mounts foram adicionados ao overlay;
  `pnpm verify:api` ficou verde com 360 operações, 0 breaking e 5 deltas
  não-breaking em Mesas. Permanecem somente os 3 warnings ambíguos preexistentes.
- Próximo avanço registrado: auditoria integral da spec 077 (tarefas abertas,
  critérios de aceite versus código, validações e bloqueios externos).
- Auditoria encontrou contradição de segurança: a migration Mesas 148, que
  remapeia referências reais, estava marcada `online-safe` e
  `requires-backup: false`. Isso viola a trava do mantenedor. Correção definida:
  classificá-la `manual-risk`/`requires-backup: true`, reforçar a pré-condição no
  próprio arquivo e auditar descoberta/ordem das migrations 146–148.
- Metadata Mesas corrigida. Novo bloqueante: o runner `apps/site/db/migrate.ts`
  aplica todo SQL pendente e não interpreta risco/backup; portanto 008/009 hoje
  poderiam rodar automaticamente num deploy comum. Antes de avançar, o runner
  central deve falhar fechado para migrations novas `manual-risk`, exigindo
  autorização explícita e evidência de backup, sem invalidar migrations históricas.
- Gate do site implementado: migrations históricas sem header continuam
  compatíveis; migrations `manual-risk` exigem autorização, arquivo de backup,
  verificação e confirmação off-VM. 008/009 foram marcadas manual-risk. Testes do
  site: 26/26 verdes. Próximo: auditoria funcional de hierarquia, parser e outbox.
- Auditoria funcional verde: backend focado 275/275, frontend 55/55,
  `catalog-ui` 14/14, `catalog-client` 3/3 e site 26/26. Código ativo, APIs,
  clientes, criação/moderação, imports e UI usam somente a cadeia exata; menções
  restantes ao quarto tipo são histórico, guardas fail-closed ou testes negativos.
- Itens funcionais P7.4b.2c–g.7 podem ser fechados localmente. P7.4/P5.9 seguem
  abertas até suites/lint/build finais e aplicação real segura; quatro candidatos
  semânticos continuam dependendo de curadoria do mantenedor.
- Suites completas pós-auditoria: backend 47 arquivos/511 testes e frontend 18
  arquivos/178 testes, tudo verde. Próximo gate registrado: lint repo-wide;
  build somente após novo checkpoint.
- Lint repo-wide verde, 21/21. Próximo gate registrado: build repo-wide; depois
  diff-check e inventário final das pendências reais.
- Primeira execução do build foi interrompida pelo timeout do harness em 120 s,
  sem erro material observado, mas não vale como verde. Próximo avanço: repetir
  com janela maior/cache; só então executar diff-check.
- Segunda execução concluiu verde: build repo-wide 21/21. Próximo e último check
  local registrado: `git diff --check`; depois consolidar pendências externas e
  decisões, sem fechar smoke/migrations.
- `git diff --check` verde. P5.9 e P7.4b fecham localmente. Auditoria de definição
  de feito encontrou smoke ausente do checklist: Onda A ainda precisa ser provada
  em Postgres/UI beta (outbox, retry, confirmação e reaplicação com DeepSeek auto
  off). A tarefa P5.10 foi criada; P7.4 segue aberta até dados/migrations/smoke.
- Pendências reais consolidadas: smoke original de dedupe; backup bloqueante;
  migrations Mesas 146–148 e site 008–009 na ordem segura; smokes Onda A e
  hierarquia D&D; decisões de quatro grupos semânticos; só então fechamento de
  backlog/project-state. Não há implementação local conhecida faltando fora
  dessas etapas e decisões neste checkpoint.
- Auditoria operacional adicional: compose/deploy do site não encaminha as
  variáveis do gate nem monta o backup; logo bloqueia corretamente, mas ainda não
  oferece caminho executável para 008/009. Criada tarefa explícita de wiring
  manual. A validação do arquivo também foi endurecida para exigir arquivo regular
  não vazio, não mera existência.
- Testes do gate endurecido: site 26/26 verde. Próximo: repetir lint e build
  repo-wide após o último delta; depois diff-check final.
- Lint pós-delta verde 21/21. Próximo: build repo-wide; diff-check somente após.
- Build pós-delta verde 21/21. Próximo: diff-check final e leitura das tasks abertas.
- Diff-check final verde. Auditoria encerrada sem fechar a spec: permanecem apenas
  execução/wiring de deploy, backup/migrations/smokes reais, quatro decisões de
  curadoria e fechamento documental posterior.
- **Trava de dados pedida pelo mantenedor:** antes de executar qualquer migration
  de remapeamento/merge em banco da VM, fazer backup completo do banco, verificar
  restauração/integridade e copiar o backup off-VM para
  `C:\projetos\artificiobackup`. Sem evidência desse backup, migrations Mesas 148
  e site 009, merge, deploy e qualquer escrita relacionada ficam bloqueados.

### Checkpoint parser P5.4a — suíte backend

- `pnpm --filter @artificio/mesas-backend test`: **44 arquivos, 469/469 testes
  verdes**. Stderr observado pertence a cenários negativos simulados existentes.
- Próximo avanço permitido: lint repo-wide; registrar antes do build.

### Checkpoint parser P5.4b — lint

- `pnpm run lint`: **21/21 pacotes verdes**.
- Próximo avanço permitido: build repo-wide e diff-check final.

### Checkpoint parser P5.4c — build

- `pnpm run build`: **21/21 pacotes verdes**.

### Frente parser P6 — regra canônica de vagas (pedido do mantenedor)

- Regra informada: em par numérico de vagas/jogadores, o maior número é
  `slots_total` e o menor é `slots_open`. Ex.: `2/5` = total 5, abertas 2.
- O mantenedor informou que essa lógica já foi implementada em algum caminho.
  Antes de editar: localizar todas as implementações X/Y, confirmar qual é a
  correta e eliminar divergência sem duplicar helper.
- Achado preliminar já visível no parser atual: `slotsViaLabel` ainda documenta
  e testa `Lugares: 2/5` como “2 preenchidas / 5 total” => `slots_open=3`, em
  conflito com a regra canônica. Nenhuma alteração feita antes da busca completa.

#### Checkpoint P6.1 — mapa material antes da correção

- A implementação correta já existe na curadoria do draft
  (`useDraftForm.handleConfirmSlots`): normaliza a ordem com `Math.max`/
  `Math.min`. Porém ainda exige que a pessoa escolha se o menor representa
  preenchidas ou disponíveis; pela regra canônica confirmada agora, em um par
  simples de vagas o menor já é `slots_open` e essa pergunta não deve nascer.
- O backend possui três interpretações concorrentes do mesmo sinal:
  - `slotsAmbiguousSlash`: maior = total, abertas = `null`, cria
    `_slots_ambiguity`;
  - `slotsSlashVagas`: primeiro = preenchidas, segundo = total, abertas =
    `total - primeiro`;
  - `slotsViaLabel`: rótulo “disponíveis” usa primeiro = abertas, mas rótulo
    genérico usa primeiro = preenchidas e calcula a diferença.
- Portanto a falha não é ausência de regex: é ausência de uma semântica única
  depois do matching. Correção planejada: um helper central para par simples
  (`total=max`, `open=min`, sem ambiguidade) consumido pelos três extractors.
- Exceções com semântica textual explícita permanecem fora dessa regra geral:
  `3 de 5 vagas preenchidas` continua total 5 / abertas 2; `1 vaga / grupo de
  5` continua abertas 1 / total 5. Sinal explícito vence o fallback numérico.
- Casos de igualdade são inerentemente sem informação sobre abertas versus
  total (`5/5`). Pela regra “maior/menor” ambos são 5; o parser seguirá total 5
  / abertas 5, sem inventar “lotada”. `0/6` vira abertas 0 / total 6.

#### Checkpoint P6.2 — semântica central implementada

- Criado `slotsFromNumericPair(first, second)` como única tradução de par
  simples: `slots_total=Math.max(...)`, `slots_open=Math.min(...)`, sem
  `_slots_ambiguity`.
- `slotsNumericPair`, `slotsSlashVagas` e `slotsViaLabel` agora convergem nesse
  helper. A ordem `2/5` ou `5/2` produz o mesmo draft.
- A resolução manual no frontend não foi removida: permanece compatibilidade
  para drafts antigos já persistidos com `_slots_ambiguity`; drafts novos com
  par simples não entram mais nesse fluxo.
- Regressão focada: **142/142 testes verdes**, incluindo `0/6`, `5/5`, rótulos
  compostos, `Lugares: 2/5`, ordem invertida e normalização sem missing falso.
- Próximo avanço: medir os dois corpora reais e depois executar suíte backend,
  lint e build; ainda sem afirmar conclusão.

#### Checkpoint P6.3a — auditoria real encontrou lacuna de matching

- Nos dois JSONs há **33 mensagens** com linha textual de vagas/jogadores e par
  `X/Y`. A nova semântica está correta quando o matcher chega nela, mas **10/33**
  ainda retornaram vagas nulas ou caíram no fallback errado de número único.
- Formas reais não cobertas: decoração fechando depois do separador
  (`__**VAGAS:**__ 2/5`, `*Vagas:* 0/5`), prefixo `Nº/N° de Vagas`, emoji/
  moldura antes do rótulo, falta de `:` (`Vagas 1/5:`), texto curto entre o
  rótulo e o par (`Quantas vagas: Sexta-Feira 5/6`) e sufixo qualificado após
  par invertido (`4/1 Vagas Abertas`).
- Falha mais perigosa: algumas linhas `Nº de Vagas: 2/5`, `4/5`, `5/7` não
  ficaram nulas; um extractor mais fraco capturou só o primeiro número e a
  cascata parou, produzindo total/abertas `2`, `4`, `5`. Regra de cascata:
  extractor de valor único deve recusar a linha quando ainda existe `/N`.
- Próximo avanço autorizado pela própria evidência: criar matcher estrutural
  tolerante para linha rotulada com par, executá-lo antes dos fallbacks de valor
  único e adicionar regressões com os formatos reais acima.

#### Checkpoint P6.3b — corpus corrigido por elegibilidade

- O matcher estrutural cobriu decoração Markdown, `Nº/N°`, par sem separador,
  texto intermediário e par antes do sufixo. Regressão focada subiu para
  **149/149 testes verdes**.
- Reauditoria: 33 mensagens contêm linha de vagas com `X/Y`; **5 são descartadas
  antes da extração** pela regra de sistema autoral (`Sistema: Próprio`). Das 28
  que efetivamente geram draft, **28/28** agora têm total/abertas preenchidos
  pela regra maior/menor e nenhuma cria `_slots_ambiguity`.
- Correção da interpretação do checkpoint anterior: o primeiro relatório
  contabilizou `draft=null` como vagas nulas. Isso misturava elegibilidade com
  cobertura do extractor. Antes do matcher havia 5 falhas reais entre os 28
  drafts, não 10; as outras 5 eram descartes esperados.
- Aprendizado de avaliação para a Onda D: toda métrica deve ter denominadores
  separados — mensagens ingeridas, descartes por política, drafts elegíveis e
  campos avaliáveis. Sem isso, um descarte correto parece falso negativo do
  parser e empurra o aprendizado na direção errada.
- Próximo avanço: suíte backend completa, depois lint e build, registrando cada
  gate antes do seguinte.

#### Checkpoint P6.3c — backend completo

- `pnpm --filter @artificio/mesas-backend test`: **44 arquivos, 477/477 testes
  verdes**. Stderr observado pertence a cenários negativos simulados existentes.
- Próximo avanço: `pnpm run lint`; build somente depois de registrar o lint.

#### Checkpoint P6.3d — lint

- `pnpm run lint`: **21/21 pacotes verdes**.
- Próximo avanço: `pnpm run build`; depois, diff-check e fechamento honesto da
  frente P6 (sem commit/push/deploy).

#### Checkpoint P6.3e — build e fechamento da frente

- `pnpm run build`: **21/21 pacotes verdes**.
- `git diff --check`: verde; busca pelas interpretações antigas não encontrou
  cálculo `total - first` nem testes que ainda exijam ambiguidade para par
  simples. Comentário residual foi atualizado para o helper atual.
- P6 concluída localmente: regra maior/menor centralizada, 28/28 drafts reais
  elegíveis cobertos, 149 regressões focadas, 477 testes backend, lint e build
  verdes. Nenhum commit, push ou deploy executado.
- A compatibilidade `_slots_ambiguity` continua existente para drafts antigos e
  para outras ambiguidades reais; ela apenas deixou de ser fabricada por `X/Y`.

### Frente parser P7 — sistema incorreto e sugestões desaparecidas

- Relato do mantenedor (2026-07-14): recentemente o parser raramente preenche o
  sistema correto e as sugestões alternativas de sistema deixaram de aparecer
  abaixo do campo quando existem possibilidades.
- Tratar como dois contratos independentes até a evidência provar causa comum:
  1. **ranking/seleção** do sistema principal (`system_id`, `system_name`, hint);
  2. **transporte/exibição** de candidatos alternativos no draft e na UI.
- Antes de editar: rastrear código real do matching até `parsed_payload`/
  `normalized_payload`, learning aplicado, geração de sugestões e consumidor
  frontend; reproduzir com corpus/testes. Não atribuir automaticamente ao
  DeepSeek: modo automático segue desligado e sugestão determinística deve
  funcionar sem ele.

#### Checkpoint P7.1 — causas materiais no código

- **Ranking:** `matchSystem` remove versão/edição antes de tentar o texto
  completo. Assim `D&D 5e` pode casar primeiro no sistema pai `D&D` e jamais
  dar chance à edição/variante exata. Ordem correta: match completo primeiro;
  só retirar versão como fallback.
- **Learning perigoso:** a correção do picker envia `system_id` e
  `system_name`, mas o learning atual grava apenas `system_name antigo -> nome
  novo`. O valor de entrada é frequentemente o nome canônico do sistema que o
  parser escolheu errado, não o texto do anúncio. Generalizar isso pode ensinar
  “Dungeons & Dragons -> Tormenta” para novos drafts do mesmo escopo.
- A aplicação automática recém-conectada agrava o efeito: a regra ativa
  sobrescreve o draft e `_learning_applied` substitui a antiga sugestão visual.
  Isso explica em conjunto “sistema errado” + “alternativas sumiram”.
- **Contrato ausente:** o parser só transporta um `system_id`; não existe lista
  determinística de candidatos no payload. A UI só consegue mostrar uma
  sugestão única de `_ai_suggestions` (DeepSeek/learning legado), portanto as
  possibilidades do catálogo desaparecem quando IA automática está desligada.
- Correção definida:
  1. desativar a generalização legada `system_name -> system_name`;
  2. tentar match completo antes do fallback sem versão;
  3. usar o scorer de catálogo já existente para transportar alternativas
     explicáveis no draft e exibi-las sob o picker;
  4. aprendizado novo será `texto bruto exato -> {system_id, system_name}`,
     promovido só por repetição e aplicável apenas ao mesmo token/escopo.
- Limite da evidência: banco local não possui `DATABASE_URL`; não foi possível
  inspecionar regras reais sem acessar ambiente externo. A causa acima é
  comprovada pelo fluxo de código e será coberta por regressões sintéticas; a
  auditoria real de regras permanece read-only quando houver conexão disponível.

#### Checkpoint P7.2a — seleção e aprendizado corrigidos no backend

- `matchSystem` agora tenta o hint completo primeiro e só remove versão/edição
  como fallback. Um match exato de edição/variante vence o sistema pai; match
  aproximado não encerra a busca prematuramente.
- O payload do draft passou a carregar `_system_source_hint` e até cinco
  `_system_candidates` explicáveis, produzidos pelo scorer determinístico do
  catálogo e sem depender de DeepSeek.
- A generalização legada de `system_name` foi desativada tanto na gravação
  quanto na consulta. Ela não volta a sobrescrever drafts novos.
- O learning seguro novo usa `system_entity`: chave = token bruto exato do
  anúncio; saída = `{system_id, system_name}` estável. A promoção continua
  exigindo repetição/confiança e respeita escopo/conflito.
- Regressões focadas provam edição exata acima do pai, transporte de
  alternativas, bloqueio da regra legada e gravação/aplicação da entidade.
  Resultado: **3 arquivos, 174/174 testes backend verdes**.
- Próximo avanço, já registrado antes da edição: consumir candidatos no hook e
  mostrá-los abaixo do picker; depois validar frontend antes da auditoria dos
  dois corpora reais.

#### Checkpoint P7.2b — alternativas restauradas no frontend

- `useDraftForm` valida `_system_candidates` do payload e expõe somente
  candidatos com ID, nome e score válidos.
- `DraftEditorTab` mostra as possibilidades logo abaixo do `SystemPicker`.
  Cada ação envia `system_id` e `system_name` juntos; não reutiliza o caminho
  genérico que antes alterava apenas o texto.
- Validação focada frontend: **2 arquivos, 16/16 testes verdes**, incluindo a
  regressão de exibição e aplicação da alternativa.
- P7.2 concluída localmente. Próximo avanço: auditoria read-only dos dois
  corpora reais com snapshot local do catálogo; depois gates completos.

#### Checkpoint P7.3a — auditoria real revelou colisão de aliases

- Auditoria read-only em `D:\teste.json` + `D:\teste [part 2].json`: 200
  mensagens, 169 drafts, 155 hints de sistema. Com o snapshot local
  `sistemas.json` (682 raízes/1.151 entradas achatadas), 91 tiveram vínculo, 64
  ficaram sem vínculo e 74 carregaram alternativas (316 no total).
- O snapshot não equivale ao catálogo canônico de produção, portanto esses
  números medem comportamento estrutural, não acurácia final do banco real.
- Falha material nova: hints `D&D 5e`/`D&D 5e 2014` escolheram em casos
  `Gamma World 5e`. O catálogo legado contém aliases amplos/colidentes; o
  matcher ainda aceita o primeiro alias exato sem desempatar por nome/caminho
  canônico e contexto da raiz.
- P7.3 permanece aberta. Antes dos gates completos: corrigir ranking de colisão,
  adicionar regressão D&D×Gamma World e repetir a auditoria.

#### Checkpoint P7.3b — colisão corrigida antes da reauditoria

- A primeira versão do harness achatava o JSON incorretamente e inventava
  aliases de raiz nas edições. Foi corrigida para espelhar `importSistemas.ts`:
  aliases só na raiz e variantes em produto cartesiano quando há edições.
- Mesmo com o harness correto, a falha persistiu: o fallback removia `5e`,
  encontrava o alias `D&D` em `Gamma World` e o aceitava antes da raiz canônica.
- Correção: comparação canônica por base/acrônimo considera nome/name_pt antes
  de alias e usa afinidade de edição; tokens `5ª`, `5ed` e `5e` convergem em
  `5e`. Scorer dá prioridade 0,99 a base canônica + edição exata.
- Regressão explícita D&D×Gamma World e suite do scorer/parser:
  **2 arquivos, 175/175 testes verdes**.
- Próximo avanço: repetir corpus com o harness fiel; só depois decidir se ainda
  há lacuna material de ranking antes dos gates completos.

#### Checkpoint P7.3b.1 — gate exato unificado

- Diagnóstico adicional: o match canônico encontrava a edição, mas
  `isExactSystemMatch` ainda usava o normalizador antigo. Por isso `D&D 5e`
  caía de novo no fallback e virava raiz, enquanto `D&D 5ª Edição` ficava na
  edição correta.
- O gate agora compara base/acrônimo e conjunto canônico de edições. A mesma
  regressão cobre `5ª Edição`, `5e` e `5ed`; parser+scorer seguem **175/175**.
- Próximo avanço: reauditoria final do corpus; gates globais continuam depois.

#### Checkpoint P7.3b.2 — reauditoria final dos corpora

- Harness fiel: 200 mensagens, 169 drafts, 155 hints; **100 vinculados**, 55
  sem vínculo; **69 drafts com 283 alternativas**.
- A contagem de vínculos permaneceu 100, mas a qualidade mudou: casos `D&D 5e`
  antes contabilizados incorretamente na raiz agora apontam para a edição; não
  restou seleção Gamma World nos exemplos auditados.
- Sem vínculo concentrou nomes ausentes do snapshot local (`Tormenta 20`,
  `Ordem Paranormal`, `Fear Warriors`, etc.). Isso não permite concluir falha
  contra produção: o snapshot possui 682 raízes/1.383 nós, enquanto o catálogo
  canônico real é outra fonte e não estava acessível sem `DATABASE_URL`.
- P7.3b concluída. Próximo avanço registrado: suites backend/frontend completas,
  depois lint, build e diff-check; cada resultado será documentado antes do
  próximo gate.

#### Checkpoint P7.3c.1 — suites completas

- Mesas backend: **44 arquivos, 483/483 testes verdes**. Stderr observado é de
  cenários negativos simulados já existentes.
- Mesas frontend: **18 arquivos, 176/176 testes verdes**.
- Próximo avanço registrado: `pnpm run lint`; build só após registrar o lint.

#### Checkpoint P7.3c.2 — lint

- `pnpm run lint`: **21/21 pacotes verdes**.
- Warning `MODULE_TYPELESS_PACKAGE_JSON` de Downloads é preexistente e não
  falhou o gate.
- Próximo avanço registrado: `pnpm run build`; depois diff-check e revisão do
  escopo, sem commit/push/deploy.

#### Checkpoint P7.3c.3 — build

- `pnpm run build`: **21/21 pacotes verdes**.
- Warning de chunk frontend acima de 500 kB é informativo/preexistente e não
  falhou o gate.
- Próximo avanço registrado: `git diff --check`, revisão de escopo/status e
  fechamento local honesto da P7; nenhum commit/push/deploy autorizado.

#### Checkpoint P7.3c.4 — fechamento local da frente

- `git diff --check`: verde.
- P7 concluída localmente: seleção prioriza nome/acrônimo+edição; aliases
  colidentes não vencem evidência canônica; alternativas determinísticas
  voltaram abaixo do picker; clique aplica ID+nome; learning seguro grava token
  bruto exato para entidade estável e ignora generalização legada perigosa.
- Evidência consolidada: 200 mensagens reais; 175 regressões focadas de
  parser/scorer; backend 483/483; frontend 176/176; lint/build 21/21.
- Limites: sem `DATABASE_URL`, não houve auditoria das regras/catalogo reais;
  sem deploy, não houve smoke visual em beta/prod. Nenhum commit, push ou deploy
  foi executado. A Spec 077 inteira permanece aberta pelo smoke real já
  pendente fora desta frente.

### Correção do mantenedor — reabertura P6/P7 (2026-07-14)

- **Vagas:** a hipótese “maior = total; menor = disponíveis” não é universal.
  `0/6` pode significar tanto `0 disponíveis de 6` quanto `0 preenchidas de 6`.
  A semântica deve vir do sinal textual/rótulo:
  - `disponíveis/abertas: X/Y` → total `Y`, disponíveis `X`;
  - `preenchidas/ocupadas: X/Y` → total `Y`, disponíveis `Y-X`;
  - `vagas: X/Y` sem qualificador suficiente → ambíguo; não decidir no chute.
- Portanto P6 deixa de estar concluída. A centralização max/min deve ser
  substituída por cascata semântica e `_slots_ambiguity` real no caso genérico.
- **Sistema:** o modelo correto é hierárquico/sequencial: reconhecer primeiro a
  base (`D&D`), depois restringir a edição/filho (`5e`) dentro daquela base.
  Tokens de edição não podem competir globalmente nem permitir que alias de
  outro sistema roube a raiz. O fix anterior reduziu o sintoma, mas P7 reabre
  até o matching base→filho usar `parent_id`/caminho explicitamente.
- RTK voltou a ser obrigatório em todo comando shell desta retomada, conforme
  `C:\Users\paulo\.codex\RTK.md`.
- Próximo avanço registrado: localizar todas as interpretações de `X/Y` e o
  matcher de árvore; só depois editar código e regressões.

#### Checkpoint de localização — P6.4/P7.4

- A regra max/min está centralizada em `slotsFromNumericPair`, chamada por três
  caminhos: par na linha rotulada, `X/Y vagas` e fallback por label. Todos
  apagam ambiguidade hoje; testes de `Vagas: 0/6`, `Lugares: 2/5` e formas
  decoradas cristalizaram essa hipótese e precisam mudar junto.
- A UI já possui desambiguação humana `filled_total` versus `open_total`; o
  parser só precisa voltar a produzir `_slots_ambiguity` no par genérico.
- `loadSystemsForParser` já entrega `parent_id`, `path_slug` e `node_type`.
  Porém `findSystemMatch` pontua a lista achatada inteira; árvore disponível não
  é usada para restringir edição/variante à raiz.
- Implementação definida antes de editar:
  1. classificar o rótulo do par como `open`, `filled` ou `generic`;
  2. `open`: X/Y = abertas/total; `filled`: X/Y = preenchidas/total;
     `generic`: total conhecido pelo maior, abertas nulas + ambiguidade;
  3. resolver sistema em duas passagens: escolher raiz por nome/acrônimo
     canônico (antes de alias); depois procurar edição/variante somente entre
     descendentes dessa raiz usando tokens de edição sequenciais.
- Próximo avanço: implementar funções puras e ajustar regressões; validar só os
  testes focados antes de nova auditoria.

#### Checkpoint de implementação inicial — falhas esperadas e novos formatos

- Primeira execução revelou 15 falhas no arquivo do parser. Doze são contratos
  max/min agora obsoletos: o código já devolve `open=null` + ambiguidade para
  pares genéricos; `Vagas ocupadas: 0/6` devolve corretamente 6 abertas.
- Não se deve restaurar as expectativas antigas. Testes serão reescritos para
  provar três classes: `open`, `filled` e `generic`.
- A resolução raiz→filho expôs tokenização anterior ao matcher:
  `5.5e` pode chegar como `5 5e`, e `Tormenta20` cola raiz+versão. A etapa de
  raiz precisa normalizar essas duas formas sem voltar ao ranking achatado.
- Próximo avanço registrado: endurecer tokenizer de hint/base, ajustar somente
  regressões semanticamente obsoletas e executar Vitest diretamente nos dois
  arquivos focados (o wrapper `pnpm test --` rodou a suite backend inteira).

#### Checkpoint P6.4/P7.4 — regressões focadas verdes

- Vagas agora seguem sinal:
  - `Vagas: 0/6` → total 6, abertas nulas, `_slots_ambiguity`;
  - `Vagas disponíveis: 0/6` → total 6, abertas 0;
  - `Vagas ocupadas: 0/6` → total 6, preenchidas 0, abertas 6.
- Formas genéricas decoradas e ordem invertida não são mais resolvidas por
  max/min; sinais conflitantes também geram ambiguidade.
- Sistema agora escolhe raiz por nome/acrônimo canônico e só pontua
  edição/variante entre descendentes daquela raiz. Alias-acrônimo que não tem
  relação com o nome canônico da própria raiz é rejeitado (caso Gamma/D&D).
- Tokenizer cobre `5ª`/`5e`/`5ed`, decimal `5.5e`, forma danificada `5 5e` e
  base+versão colada como `Tormenta20`.
- Validação focada direta: **2 arquivos, 175/175 verdes**.
- Próximo avanço registrado: reauditar sistemas e vagas nos dois corpora reais;
  depois registrar resultado antes das suites completas.

#### Checkpoint de reauditoria — vagas corretas, sistema conservador demais

- Vagas nos 200 anúncios: 28 pares; 19 genéricos viraram ambiguidade; 7 com
  sinal de abertas/disponíveis foram resolvidos; 2 com sinal de ocupadas foram
  convertidos de preenchidas para abertas. Resultado coerente em 28/28, sem
  aplicação da regra max/min.
- Sistema caiu de 100 para 72 vínculos no snapshot. A queda não é aceitável
  como resultado final: `Cyberpunk Red`, `Fabula Ultima + complemento` e frases
  explícitas contendo o nome perderam a raiz porque a primeira passagem exige
  base igual/acrônimo, em vez de reconhecer a raiz como subsequência ordenada.
- Ajuste definido antes de editar: raiz/nome/alias pode aparecer como sequência
  contígua dentro do hint explícito; nome canônico continua acima de alias;
  dois sistemas raiz distintos explicitamente presentes no mesmo hint não são
  autoescolhidos e ficam como possibilidades.
- Próximo avanço: ampliar somente a descoberta da raiz, repetir 175 focados e
  reauditar sistemas antes de qualquer suite completa.

#### Checkpoint P7.4a.1 — raiz como subsequência

- Descoberta de raiz agora aceita nome/alias como sequência contígua dentro do
  hint explícito (`Cyberpunk` em `Cyberpunk Red`, `Fabula Ultima` antes de
  complementos), sem achatar a busca de edição.
- Aliases genéricos (`rpg`, `system`, `jogo` etc.) são ignorados; alias-acrônimo
  sem relação com o nome canônico da própria raiz continua rejeitado.
- Regressões focadas permanecem **175/175 verdes**.
- Próximo avanço registrado: segunda auditoria de sistemas; comparar cobertura,
  ausência de Gamma e alternativas restritas à raiz antes dos gates completos.

#### Checkpoint de segunda auditoria — desempate posicional da raiz

- Cobertura subiu 72→90/155; D&D permaneceu na edição correta, Gamma não
  reapareceu e alternativas de D&D ficaram restritas à mesma árvore.
- Empates de raiz ainda zeram hints válidos quando o complemento contém nome de
  outro sistema/palavra de catálogo: `Fabula Ultima ... natural ...` e
  `Pathfinder 2e Legacy` são exemplos.
- Ajuste definido: sequência canônica mais longa e mais cedo no hint vence;
  igualdade exata continua acima; alias continua abaixo. Empate real de filhos
  mantém a raiz e oferece filhos como alternativas.
- Próximo avanço: implementar posição/comprimento, rodar focados e terceira
  auditoria; suites completas seguem bloqueadas até isso estabilizar.

#### Checkpoint P7.4a.2 — desempate posicional implementado

- Ranking de sequência agora combina comprimento e posição: raiz canônica mais
  longa e mais cedo no hint supera termos incidentais do complemento.
- Igualdade/base canônica e acrônimo permanecem acima; aliases abaixo.
- Focados seguem **175/175 verdes**.
- Próximo avanço registrado: terceira auditoria. Objetivo é qualidade segura,
  não recuperar contagem antiga por alias global.

#### Checkpoint de terceira auditoria — sistema estabilizado

- 98/155 hints vinculados no snapshot: dois abaixo dos 100 do matcher achatado,
  porém sem seleção por alias global. D&D/5e permaneceu correto, Gamma não
  reapareceu e alternativas ficaram dentro da árvore D&D.
- Vazios dominantes (`Tormenta 20`, `Ordem Paranormal`, etc.) não existem no
  snapshot local; sem banco real não podem ser usados para medir produção.
- Próximo avanço registrado: adicionar regressão explícita com raiz `D&D` e
  filho cujo nome é apenas `5ª Edição`/slug `5e`; depois suites completas.

#### Checkpoint P7.4a.3 — regressão de folha revelou gate incorreto

- Regressão explícita com raiz `D&D`, filho `5ª Edição`/slug `5e` e Gamma
  portando alias conflitante falhou: 175/176 verdes; parser devolveu raiz
  `dnd` em vez do filho `dnd-5e`.
- A busca hierárquica encontra a árvore correta. Falha posterior está no gate
  `isExactSystemMatch`: ele ainda exige base canônica no próprio nome da folha.
  Uma folha nomeada somente pela edição perde o match e cai no fallback da raiz.
- Teste não será enfraquecido. Próximo avanço registrado: permitir que edição
  exata valide o descendente já escolhido dentro da raiz; repetir focados antes
  de qualquer suite completa.

#### Checkpoint P7.4a.4 — folha por token sequencial validada

- Gate exato agora aceita folha nomeada apenas pela edição quando ela já foi
  escolhida dentro da raiz reconhecida. Não há busca global por `5e`.
- Regressão `D&D` + `5e` seleciona `dnd-5e`; Gamma com alias `D&D` não aparece
  como seleção nem alternativa.
- Vitest focado via RTK: **2 arquivos, 176/176 verdes**.
- Próximo avanço registrado: suites completas backend/frontend; registrar
  resultado antes de lint/build.

#### Checkpoint P6.4/P7.4 — suites completas verdes

- Backend: **44 arquivos, 484/484 testes verdes**.
- Frontend: **18 arquivos, 176/176 testes verdes**.
- Execuções feitas via RTK. Logs de erro vistos no backend pertencem a casos
  negativos esperados; processo encerrou com código 0.
- Próximo avanço registrado: executar lint repo-wide; registrar resultado antes
  do build repo-wide.

#### Checkpoint P6.4/P7.4 — lint verde

- `pnpm run lint` via RTK: **21/21 pacotes verdes**.
- Próximo avanço registrado: executar build repo-wide; depois registrar antes
  de `git diff --check` e inspeção final do diff.

## Riscos e impacto em outros módulos

- Query de comparação mesa×mesa pode ficar cara se rodar full-scan a cada
  publish — decidir em `plan.md` se roda sob demanda (botão manual) ou
  trigger assíncrono, evitando o mesmo custo do scrape de OG síncrono já
  identificado como risco em specs anteriores.
- Reaproveitar tabela `discord_duplicate_candidates` pode exigir migration
  (FK hoje só aponta pra `discord_parse_cases`, não pra `tables`) — avaliar
  se cria tabela nova (`table_duplicate_candidates`) em vez de forçar
  reuso, pra não acoplar dois domínios diferentes na mesma FK.
- Rota nova de listagem ampla de duplicatas — restringir a `role === 'admin'`,
  mesmo padrão de `requireAdmin` já usado nas rotas de duplicatas atuais.
### Checkpoint PR #160 — auditoria de bots antes das correções

- Checks: 32 verdes; SonarCloud, CodeQL, Semgrep e OSV aprovados.
- Achados funcionais confirmados: remapeamento incompleto de `user_systems`;
  seleção de pai inválida para variantes; aplicação de learning sem mudança real;
  validação frágil do JSON de sistemas; respostas novas sem validação runtime;
  limiar de promoção divergente; teste novo fora do script do site.
- Hardening seguro confirmado: filtrar chaves proibidas em `confirmedFields` e
  limitar leitura de metadata de migration às primeiras 20 linhas.
- Achados não aplicados neste avanço: refatorações cosméticas/complexidade do
  Sonar, constantes artificiais em SQL, remoção genérica de `EXISTS`, troca de
  CHECK por `NOT VALID` em migration ainda não executada, centralização ampla de
  helpers e mudança arquitetural do retry síncrono. Esses itens ampliam risco ou
  escopo sem corrigir defeito material comprovado nesta PR.
- Próximo avanço: correções mínimas + regressões; depois novo checkpoint antes
  dos testes. Nenhuma resposta, resolução de thread, commit ou push autorizados.

### Checkpoint PR #160 — correções aplicadas antes dos testes

- Migration 148 agora remapeia `user_systems`, elimina somente duplicata que
  colidiria com `UNIQUE(user_id, system_id, type)` e verifica referência órfã.
- Drawer escolhe sistema como pai de edição e edição como pai de variante, tanto
  na sugestão automática quanto na seleção manual.
- Learning só registra aplicação/campo afetado quando mudou valor real; evidência
  não string não cai mais em `[object Object]`.
- JSON legado falha com mensagens controladas; respostas correction/retry passam
  por Zod; promoção usa `ACTIVE_CONFIDENCE`; chaves proibidas foram filtradas.
- Script do site inclui teste do catálogo; policy lê somente 20 linhas, com
  regressão dedicada. `git diff --check` verde.
- Próximo avanço: testes focados. Depois registrar resultado antes de API/lint/build.

### Checkpoint PR #160 — testes verdes antes dos gates globais

- Backend Mesas: 47 arquivos, 511 testes verdes.
- Frontend Mesas: 18 arquivos, 178 testes verdes.
- Site: 3 arquivos, 35 testes verdes, incluindo catálogo e policy.
- Próximo avanço: `pnpm verify:api`; registrar resultado antes de lint/build.

### Checkpoint PR #160 — API verde antes do lint

- `pnpm verify:api` verde: 0 breaking; 5 mudanças não-breaking já pertencentes
  à PR; 3 warnings históricos de paths ambíguos, sem falha.
- Próximo avanço: `pnpm run lint`; registrar antes do build.

### Checkpoint PR #160 — lint verde antes do build

- `pnpm run lint`: 21/21 pacotes verdes.
- Próximo avanço: `pnpm run build`; depois revisão final local.

### Checkpoint PR #160 — gates finais

- `pnpm run build`: 21/21 pacotes verdes.
- Correções de review validadas por 724 testes nas suites afetadas, API, lint e
  build. Falta somente revisão mecânica final do diff; sem commit/push.

### Checkpoint PR #160 — revisão local concluída

- `git diff --check` verde; diff revisado. Artefato de consumidores foi
  regenerado pelo gate de API e permanece no conjunto.
- Estado: mudanças somente locais; nenhum bot respondido/thread resolvida;
  nenhum commit ou push realizado nesta rodada.
