# Plano — 096

Base de fato: toda afirmação sobre estado atual abaixo foi verificada no código (arquivo
e linha citados), não em memória de chat. Rotas descobertas via `artificio-api-governance`
(bundle gerado, 208 operações do mesas). Levantamento Fase 0 concluído em 2026-08-23 por 4
subagentes read-only + conferência do orquestrador; testes existentes executados (sem
editar nada).

## Diretrizes do mantenedor (2026-08-23) — moldura deste plano

- O editor novo **não replica o wizard**: o fluxo atual (`CreateTableForm` + steps) é
  **material de referência** do inventário — o que existe —, não o molde da solução.
- O critério é **"tudo será usado"**: capacidade inventariada aqui termina consumida
  (editor, página pública, painel ou parser) — nada de capacidade paga e desligada. A
  tabela de paridade deixa de ser "não perder" e passa a ser "consumir integralmente".
- O inventário cobre também **a API via `artificio-api-governance`** (bundle: 498
  operações, mesas 208): rota existente sem consumidor é candidata a tela, não a
  descarte. Os achados da auditoria adversarial de 2026-08-23 estão inline neste arquivo e no `spec.md` (o `review.md` foi apagado pelo mantenedor em 2026-08-24).

## Estado atual verificado (ponto de partida)

### Correção de premissa (registrada antes de tudo)

**`OnboardingPage.tsx` NÃO é o onboarding de mesa.** É onboarding de **preferências do
usuário** (rota `/onboarding`, `App.tsx:58`): display_name, bio, sistemas favoritos,
temas, idiomas, plataformas, dias — salvo em `PUT /api/v1/me/preferences`
(`OnboardingPage.tsx:222-244`). **O wizard de criação de mesa é
`CreateTableForm.tsx` + `components/form-steps/` + `useStepNavigation.ts`.** O único
consumidor de `CreateTableForm` é `PainelMestrePage.tsx:693`. Registro corrigido no
`spec.md` §Problema Gap 1.

### Gap 1 — Wizard de criação e edição (R1, R2)

| Fato | Onde |
|---|---|
| 6 etapas: Básico → Sistema → Sessões → Configuração → Finalizar → Revisão | `StepHeader.tsx:1` (`STEP_LABELS`), render em `CreateTableForm.tsx:335-467` |
| Etapa 1 "Básico": título (obrig.), descrição (obrig. na validação, sem asterisco no label) | `StepBasic.tsx:20-44`; `validation.ts:45-70` |
| Etapa 2 "Sistema": SystemPicker (obrig.), cenário de catálogo (opcional) | `StepSystem.tsx:41-92` |
| Etapa 3 "Sessões": repeater de horários (≥1 sessão; dia+início obrigatórios), vagas totais (obrig. sem asterisco), vagas abertas (só no submit) | `SessionRepeater.tsx:94-246`; `StepSessions.tsx:35-67`; `validation.ts:77-107,174-184`; `useCreateTableForm.ts:236-252` |
| Etapa 4 "Configuração": gm/announcer, tipo, modalidade, VTT, comunicação, faixa etária, cobrança, valores, doação, experiência, complexidade, idioma | `StepConfig.tsx:150-452` (451 linhas) |
| Etapa 5 "Finalizar" (568 linhas — a maior): contatos (obrig.), banner, regras, **colapsável de avançados** (nome de exibição do mestre, duração, nível, billingText, sessão zero, sinopse, benefícios, bio, estilo, resumo, requisitos PC/mic/cam, cenário/estilos), DDAL, Covil | `StepFinal.tsx:147-556` |
| Etapa 6 "Revisão": read-only | `StepReview.tsx` (218) |
| Navegação: valida por etapa antes de avançar; nunca pula para frente; `step=1`/`maxStepUnlocked=1` **sempre**, mesmo com `initialData` de edição | `useStepNavigation.ts:19-45`; `validation.ts:226,233` |
| **Edição = 100% o mesmo form.** `/painel?edit=<id>` → `GET /api/v1/gm/tables/:id` → `mapTableApiToInitialData` → `CreateTableForm initialData=…`. Só difere: h1 "Editar Mesa", passo 0 pulado, `PUT` vs `POST`, msg de erro | `PainelMestrePage.tsx:394-408,690-697`; `useCreateTableForm.ts:253-264` |
| Editar só o título = 5× "Continuar" (validação por etapa idêntica; nenhum campo bloqueado; botão final "✓ Publicar Mesa" igual na edição) | `useStepNavigation.ts:19-20,37-45`; `StepActions.tsx:57` |
| Informação fora de ordem: modalidade (que controla VTT/comunicação) vem DEPOIS das sessões; identidade (tipo/modalidade/faixa) na etapa 4; **campos de preço espalhados por 2 etapas** (4 e 5) em 3 blocos distintos — cobrança/doação no StepConfig, billing/sessão zero no StepFinal, valores num terceiro ponto; requisitos PC/mic/cam escondidos no colapsável da etapa 5 | `StepConfig.tsx:150,233,284`; `StepFinal.tsx:194-202,338-393` |
| Redundâncias: styleText × settingStyles (confusão documentada no próprio código); `synopsisNarrative` existe no estado/mapper/validação mas **nenhum editor** (o campo "Sinopse Narrativa" liga a `props.synopsis`); 3 campos de mestre em 2 etapas; cenário em 2 etapas com 2 significados | `StepFinal.tsx:309-330,395-403,279-292`; `createTable.types.ts:105`; `mapper.ts:223`; `StepConfig.tsx:204`; `StepFinal.tsx:215,300` |

### Gap 2 — Requisitos PC/mic/câmera (R3)

| Fato | Onde |
|---|---|
| Colunas **já existem** por mesa: `requires_pc`, `requires_camera`, `requires_microphone` (boolean) + `technical_requirements` (texto) | `migration_11_advanced_fields.sql:32-35` |
| UI atual: 3 checkboxes **só no colapsável de avançados do StepFinal** — longe do select de VTT do StepConfig | `StepFinal.tsx:365,377,389`; VTT em `StepConfig.tsx:233-262` |
| **Não existe nenhuma estrutura de requisitos por VTT**: `VttPlatformsTable` tem só id/name/slug/logo/website/is_active/sort_order/timestamps | `db/types.ts:604-614`; grep `requires_*` × vtt = 0 |
| 10 VTTs canônicos (Alchemy, D&D Beyond Maps, Fantasy Grounds, Foundry, Owlbear, Quest Portal, Roll20, Tableplop, TTS, TaleSpire) | seed `migration_158:53-64` |
| 5 plataformas de comunicação (Discord, Google Meet, Teams, Telegram, Zoom) | `migration_105_communication_platforms.sql:22-29` |
| Aliases por VTT/comunicação em tabela (`vtt_platform_aliases`, 17 grafias; `communication_platform_aliases`, 2) | `migration_159:48-84` |
| Regra automática Discord→mic, VTT desktop→PC **não existe em lugar nenhum** (grep = 0). Onde morar a regra (coluna em `vtt_platforms` + migration, ou mapa em código) é decisão do grill | grep `requires_` × vtt = 0 |
| Parser do pipeline Discord já captura `requires_pc/camera/microphone`; página pública já exibe | `syncHelpers.ts:411-413`; `TableTechnical.tsx:18,73-78` |

### Gap 3 — Preço 55/40 → 39,96 (R4) — ENCERRADO por conferência do mantenedor

| Fato | Onde |
|---|---|
| **Não existe fórmula no código que gere 39,96 de 55/40.** A única conta derivada é percentual de economia: `Math.round((1 - monthly/price)*100)` = **27** com 55/40 (exibido "economize ~27%", correto) | `TableActionPanel.tsx:72-74,95-97` |
| Todas as exibições de valor são passagem crua, sem aritmética: inputs, revisão, página pública, card, WhatsApp | `StepConfig.tsx:348-377`; `StepReview.tsx:108-116`; `TableActionPanel.tsx:86,93`; `TableCard.tsx:201-213`; `whatsappAnnouncement.ts:276-288` |
| Mappers só fazem `parseFloat` + `isFinite`; backend só valida `z.number().min(0)` e coluna `NUMERIC(10,2)` | `mapper.ts:89-106`; `tableValidators.ts:146-148`; `migration_01:137`, `migration_161:26` |
| Testes executados (read-only): `TableActionPanel.test.tsx` **19/19** (inclui caso 55/40), `mapper.test.ts` **25/25**, `whatsappAnnouncement+mapTableApiToInitialData` **27/27** | comandos `rtk pnpm vitest run …` |
| **Conferência do mantenedor (2026-08-23):** conferiu 3×, campo de edição mostra **40** (correto). Sintoma não reproduz. Única mudança recente na exibição de preço: PR #283 (`b3993fc`/`f92acbe`/`7b4ee7a`) | `rtk git log -- apps/mesas/frontend/...` |
| **Candidato learning-store DESCARTADO por medição em produção:** `discord_field_learning` tem 2 regras ativas no campo `price_type` (ambas 'gratuita') e **nenhuma de `price_value`** — query citada abaixo | `ssh faren "docker exec mesas-db psql ... SELECT field, input_token, output_value, hits, active FROM discord_field_learning WHERE field LIKE '%price%'"` → só `price_type` |
| Candidatos restantes (se o sintoma reaparecer, reproduzir antes de corrigir): (1) parser lendo "R$ 39,96" de anúncio colado; (2) input `type=number` em locale pt-BR com vírgula; (3) "R$ 39,96" do grupo fechado do perfil (`min_price_cents=3996`) — tela diferente, não é preço de mesa | `parseDiscordAnnouncement.ts:856-861`; `MestreClosedGroupSection.tsx:15-21` |
| **Permanece nesta spec:** teste de regressão fixando 55/40 → "R$ 55" / "R$ 40 / sessão" + economia só como % (R4). Achado cosmético associado: página pública exibe sem centavos ("R$ 55") — normalização de formatação vai ao grill | `TableActionPanel.tsx:86,93` |

### Gap 4 — Parser "colar anúncio" (R5)

Cadeia: `POST /api/v1/gm/parse-preview` (`gmPanel.ts:611-700`) → `parseTextForPreview`
(`parseTextForPreview.ts:37-81`) → `segmentAnnouncements` → `normalizeLooseText` →
`parseDiscordAnnouncement` → `buildTableDraftFields`/`extractContacts`/`extractSchedules`.

| Fato | Onde |
|---|---|
| **Capta hoje** (medido com anúncio sintético via `tsx`): título, sistema (se casa com catálogo), tipo, modalidade, preço avulso, vagas, dia/horário, cadência, descrição, regras, contatos (menção/URL), nome do mestre, faixa etária, experiência, complexidade, ambientação, estilos, requires_pc/camera/mic, sessão zero gratuita | tabela completa no relatório do subagente C |
| **Falha 1 — catálogos nunca passados ao preview:** rota chama `parseDiscordAnnouncement(rawMessage, systems)` **sem `platforms`**; VTT, comunicação e cenário são **sempre null** mesmo com texto explícito ("Plataformas: Roll20" → `vtt_platform_id: null`, `_vtt_source_hint: "Roll20"` — a informação é lida e descartada). O fluxo admin já carrega os 3 catálogos + aliases aprendidos; o preview não | `parseTextForPreview.ts:49`; `gmPanel.ts:680-681`; vs `routes/discord/utils.ts:567-601` |
| **Falha 2 — chave errada no mapper:** backend devolve `schedules`, front lê `data.sessions` (que não existe) → cai sempre em `defaultSession` com `frequency: 'semanal'` fixa; cadência quinzenal/mensal/avulsa (extraída) morre | `gmPanel.ts:694` vs `mapTableApiToInitialData.ts:86,57-73` |
| **Falha 3 — corte de parêntese:** "Vagas: 4 (2 abertas)" → `slots_open: 4` (errado; deveria ser 2) | `parseDiscordAnnouncement.ts:1929-1931` |
| **Falha 4 — contato por @username não extraído** (só menção `<@id>`); "Contato: Discord @ricardo" → vazio | `extractContactDiscord`; `textToRawMessage.ts:11` |
| **Falha 5 — regex de mic falha com coordenação:** "necessário ter PC e microfone" → pc=true, mic=null | `parseDiscordAnnouncement.ts:1497-1506` |
| **Falha 6 — ambiguidades ignoradas em silêncio (corrigido pela auditoria 2026-08-23):** `_schedule_ambiguity`/`_price_ambiguity`/`_slots_ambiguity`/`missing_fields` **chegam no payload** (`parseDiscordAnnouncement.ts:2827-2829,2862` → `parseTextForPreview.ts:80-84` → `gmPanel.ts:694`) mas o frontend **não os lê** (`ParsePreviewTextArea`/`mapTableApiToInitialData` não mapeiam nenhum) — o mestre não é avisado de que o parser escolheu por ele | `parseDiscordAnnouncement.ts:2827-2829,2862`; `gmPanel.ts:694`; `parseTextForPreview.ts:41-45` pega só o 1º segmento multi-anúncio |
| **Falha 7 — mensal/doações não extraídos** (`extractPrice` capta 1 número); `price_value_monthly`, doações, language, starts_at, city/state, content_warnings, safety_tools, level_range, campaign_length sem extração | `parseDiscordAnnouncement.ts:856-865` |
| **Falha 8 — raw_system_hint não aplicado quando não casa** — mestre redigita o sistema à mão | `parseDiscordAnnouncement.ts:2541`; `mapTableApiToInitialData.ts` |
| Capacidades existentes **não ligadas** no preview: `loadVttPlatformsForParser`, `loadCommunicationPlatformsForParser`, `loadScenariosForParser`, `loadActiveLabelAliases` (correções humanas aprendidas), `ENTITY_HINT_FIELDS`/`LEARNABLE_FIELDS` | `shared.ts:57-138`; `utils.ts:597-601,703`; `learningRules.ts:52,85`; `fieldLearning.ts:23-35` |
| Testes: `gmPanel.parsePreview.test.ts` **8/8**, `parseTextForPreview.test.ts` **5/5** verdes | `rtk pnpm vitest run …` |

### Gap 5 — Obrigatório × opcional (R6, R8)

| Fato | Onde |
|---|---|
| Marcador único: asterisco no label, em ~9 lugares; opcionais usam "(opcional)" em muitos, mas não todos ("Nível de Experiência", "Nível de Complexidade", "Cobrança" sem marcador nenhum) | `StepBasic.tsx:20`; `StepSystem.tsx:41`; `SessionRepeater.tsx:94`; `StepConfig.tsx:343,415,428` |
| Mismatch: **Descrição** e **Vagas Totais** são obrigatórias na validação mas **sem asterisco**; **Tipo/Modalidade/Faixa Etária** têm asterisco mas **sem validação frontend** (select com default nunca falha) | `validation.ts:53-70,180-184` × `StepBasic.tsx:33`, `StepSessions.tsx:36`; `StepConfig.tsx:217,224,334` × `validateStep` |
| Só a **primeira** mensagem de erro do step aparece (bloco ⚠️), sem indicação por campo | `StepActions.tsx:18-22` (`getStepError`) |
| Não existe nível intermediário ("importante") nem explicação sistemática por campo | medido nos 6 steps |

### Gap 6 — Backend sem uso / mal usado (R7) — aprofundado com banco de produção

| Fato | Onde |
|---|---|
| **Perda silenciosa com dado ERRADO no público (age_rating/table_level):** a UI coleta (`StepConfig.tsx:334-341,427-438`) mas payload/mapper não enviam e `baseTableSchema` não aceita; as colunas têm default `'livre'`/`'todos'` no banco (`information_schema` medido). Produção: 41 manuais = 100% com defaults; o mestre que escolheu "+18" tem mesa exibida "livre". Pipeline Discord grava valor real (57/66 imported com faixa; 1/66 com nível) | `createTable.types.ts:119-205`; `tableValidators.ts:137-228`; `information_schema.columns` (defaults) + `SELECT origin, age_rating, count(*) FROM tables GROUP BY 1,2` → manual=41×'livre'; imported: +14(2)/+16(13)/+18(42)/NULL(9) |
| **BUG 1 de edição — mesa Covil desmarcada a cada edição:** backend devolve `is_covil` (coluna `tables.is_covil`), mapper lê `is_covil_mesa` (nunca existe) → `mapper.ts:134` envia `is_covil: false` no PUT. Produção: **2 mesas is_covil=true** — vítimas em espera | `mapTableApiToInitialData.ts:143`; `mapper.ts:134`; `SELECT count(*) FILTER (WHERE is_covil) FROM tables` → 2 |
| **BUG 2 de edição — múltiplos horários colapsam para 1:** backend devolve `schedules` (`gmPanel.ts:577`), mapper lê `data.sessions` (nunca existe) → `defaultSession`. Produção hoje: `table_schedules` 90 linhas/90 mesas, **0 mesas com 2+** — bug real no código, dano zero ainda; **correção 2026-08-24:** o R20 remove o repeater, então o editor terá **um horário só** e a gravidade do bug **diminui** — segue corrigido por T3.1. `extractSchedules` (`syncHelpers.ts:292-330`) retorna 0 ou 1: o parser nunca cria múltiplos | `mapTableApiToInitialData.ts:86,57-73`; `SELECT count(*) FROM (SELECT table_id FROM table_schedules GROUP BY 1 HAVING count(*)>1) x` → 0 |
| **Notificações órfãs:** backend escreve em 12 pontos (6 arquivos; `syncHelpers.ts:463` etc.), 3 rotas de leitura sem consumidor (`grep -rln notification apps/mesas/frontend/src` → exit 1). Produção: 66 notificações, **62 não lidas** | `notifications.ts:10,33,55`; `SELECT count(*), count(*) FILTER (WHERE read=false) FROM notifications` → 66\|62 |
| Rotas sem consumidor reclassificadas (aprofundamento): **(a) valiosas sem UI** — `vtt-platforms/suggest` (endpoint sem botão; 0 sugestões em produção), `scenario-suggestions/mine`, `system-suggestions/mine`; **(c) duplicadas/legadas** — telemetria `/gm/tables/*` (a pública `/tables/*` e `/gm/perfis/*` É consumida — `TableCard.tsx:74,99,260`, `MestrePage.tsx:82`), `profile/me/gm\|player`, `profile/me/discord` ×3 (OAuth superou), auth legado (shim 410); **(b) diagnóstico/admin** — projection-sync, eval/shadow, auto-archive (consumido por workflow `mesas-auto-archive.yml`); **(d) mortas** — `verify-covil` (zero referências fora da definição), `tableSchedules.ts` inteiro (não montado em `server.ts`, 2 citações só em comentários), join tables `table_tags`/`table_platforms`, `table_history` (sem escritor). Correção: `tags`/`platforms` **têm** query (`me.ts:91-101` `/me/options`) — o que é morto são as join tables | aprofundamento subagente E (grep citado) |
| Payload descartado em rotas consumidas: `custom_scenario` (zero consumidor no repo), `style_tags` (zero), `features`, `price_frequency` (produção: 1 mesa — imported/paga/'sessao'), `starts_at` (0), `city/state` (0), `content_warnings`/`safety_tools` com dado real (0 — 100% mortos), `system_name/slug/path/logo` (mapper lê só `system_id`) | subagente E §E2 |
| **Correção da auditoria adversarial (2026-08-23):** `contacts[].label` **não** é descartado — schema aceita (`tableValidators.ts:33`), mapper envia (`mapper.ts:29`), repository grava (`tableRepository.ts:110`), GET devolve (`gmPanel.ts:1190`); produção **94/121** com label. `schedules[].end_time`/`notes` **não** são ignorados pelo guard (`tableValidators.ts:100,104` aceita) — a perda real na edição é o Bug 2 (sessions×schedules) |
| Capacidades prontas para o novo editor: sugestão de sistema/cenário com modais já no form (preservar); aliases VTT/comunicação em tabela (só fluxo admin usa; ligar no preview = 2 queries); aprendizado do parser com loop fechado via `parse_case_id` (preservar plumbing); **herança do perfil GM** (`preferred_vtt_platforms` + `languages` + `contact_methods`) para pré-preencher o editor; catálogo `setting_styles` já vivo | subagente E §E3 |
| Redundância de dados: `communication_platforms` com 6 linhas — "Meet" ao lado de "Google Meet" (mesma data de seed, 2026-04-16) | `SELECT id, name, slug, created_at FROM communication_platforms` |
| Produção (contexto): 107 mesas — 66 imported, 41 manual; 79 gratuita, 28 paga; 5 com `price_value_monthly`; 0 doações; 10 `vtt_platforms`; 0 `vtt_platform_suggestions` | queries `ssh faren docker exec mesas-db psql -U admin -d mesas_rpg` (read-only) |
| **Achados novos da auditoria adversarial (fora do inventário anterior):** (1) `rules_notes` sem exibição pública — 53/107 não-nulos, **35 com conteúdo não-branco** (o número que vale: conteúdo não-branco, contra 53 não-nulos); (2) par `synopsis`×`synopsis_narrative` invertido — editor grava `synopsis`, "História" lê `synopsis_narrative` (0/107); (3) `gm_avatar_url` validado e descartado; (4) `slots_filled` lido em 3 lugares e escrito só pelo parser (painel/WhatsApp contam vagas erradas no manual); (5) `featured` sem escritor; (6) `gm_profiles` 20 colunas 0/39 × `preferred_vtt_platforms`/`contact_methods` 39/39 ignoradas; (7) `notifications.link` morta (0/66); (8) `imported_expires_at` fantasma no contrato do hydration; (9) família `system-suggestions` duplicada mesas×downloads (medido: mesma família de rotas nos dois apps); (10) learning store (37 regras vivas) fora do parse-preview |

### Estado de entrega (2026-08-25)

- **Fase 4 merged em `dev`** (PR #286, `38f58f4`): 95 arquivos, +13.472 −5.792. O wizard
  saiu, o editor unificado entrou. Falta o gate T4.9, o smoke visual do mantenedor e o
  **deploy** — o editor ainda não está em produção.
- A colisão de working tree de 24/08 (diff com dois donos: frente OG × spec 096) está
  **resolvida** — a frente OG e o `imageKinds` foram commitados como decidido na época.
- Mergeados antes desta fase: PR #283 (cobrança avulso/mensal/doação, `182d063`), spec
  094 (`006e721`), PR #285 (perda de dado nas vagas).
- Fases 5-7 não iniciadas. Qualquer branch nova parte de `origin/dev` atualizado.

## Pesquisa de mercado (Fase 2 — 2026-08-23)

Consultada com navegação web e captura de tela do produto real, não por memória. O que
mudou o desenho:

| Fonte | O que estabelece | Consequência aqui |
|---|---|---|
| Captura do **Airbnb Listing Editor** (comunidade oficial, `community.withairbnb.com`, imagens `7896i1C74849D2273CFC8` e `112530i579DF70298896DDF`) | Todos os campos já são campos, sempre editáveis; lateral salta entre partes (Basics, Description, Location, Amenities, Photos); edição **no lugar**, sem modal; sem botão de salvar por campo; status do anúncio fixo no canto | É o modelo adotado (R1/R2) |
| Estudo de usabilidade do fluxo de anúncio Airbnb | **3 de 5** hosts não perceberam que a página rolava e pularam campos; **3 de 5** não acharam qual campo tinha erro | Sustenta zero rolagem (R1) e o A4 (publicar revela o que falta, com foco no campo) |
| **Baymard — Form Field Usability** | Largura do campo deve corresponder ao tamanho da resposta esperada; descasamento causa hesitação medida (usuário relê o rótulo, digita e apaga) | Larguras por conteúdo: hora 98px, número 86px, curto 152px, médio 206px — proibido esticar por `1fr` |
| **Baymard — Required & Optional Fields** | Marcar só um dos lados leva **32%** a deixar obrigatório em branco; asterisco sozinho falha com parte do público | Três níveis, todos marcados, com palavra e não só símbolo (R6) |
| **NN/g — Proximity** e **Form Design White Space** | Espaço agrupa, não régua; proximidade é o agrupador primário | Partes separadas por espaço com rótulo discreto, não por linha divisória |
| **NN/g — Wizards** | Wizard serve a processo infrequente com usuário novato, e é **errado** para edição e usuário experiente | Confirma que o problema real era a edição presa no wizard, não a existência de etapas |
| **PatternFly — Inline edit** | Não usar inline-edit-por-clique quando **editar é a função primária** do fluxo | Mata o desenho de cartão-que-abre-gaveta: aqui editar é 100% da tarefa, então o campo já nasce aberto |
| Validação: **on blur, nunca a cada tecla** (consenso Baymard/NN/g) | Validar enquanto digita é acusatório e causa salto de layout | R6 valida no blur e ao publicar |

Rejeitado com evidência: "multi-step converte mais" (Formstack 13,9% × 4,5%) **não se
aplica** — a medição é de formulário de captação, e o mantenedor decidiu por anúncio.
Registrado porque foi levantado e descartado, não esquecido.

## Arquitetura da solução

### §Frontend — editor de anúncio

Substitui `CreateTableForm` + `useStepNavigation` + `components/form-steps/*`.

- **Casca de altura fixa.** `height:100dvh` com `overflow:hidden` no `body`; grade de 3
  faixas (barra de estado, corpo, rodapé de pendências). Nada rola.
- **Lateral** (~212px): lista de partes com contagem de pendências por parte, barra de
  progresso e prévia do card como o jogador vê. Os botões são criados **uma vez** —
  recriar a lista a cada tecla mata o clique junto com o nó (bug medido no protótipo).
- **Documento**: uma parte visível por vez, campos abertos. Coluna de trabalho limitada
  (≤900px); largura de cada campo pelo conteúdo esperado.
- **Alinhamento**: rótulo com altura fixa de duas linhas e texto encostado embaixo — sem
  isso, o badge que quebra de linha empurra só aquele controle (medido: até 26px de
  desalinho em 4 das 7 partes).
- **Partes (7)**: Identidade · Quando joga · Onde joga · Valores · Para quem é ·
  Mestre e contato · Regras e extras. *(Agrupamento **aprovado** pelo mantenedor em 2026-08-24.)*
- **Autosave** a cada alteração, com indicador de estado no cabeçalho.

### §Frontend — paridade de features (não perder o que já existe)

**Origem desta tabela:** montada por grep na primeira vez, **rasa e errada em pontos
graves**; o mantenedor cobrou duas vezes ("você deixou VÁRIAS coisas passar" e, depois de
uma primeira correção, "ainda tem coisa que você deixou para trás, a parte mesmo de upload
de imagem"). Refeita em 2026-08-23 lendo **~6.250 linhas**: os 4.566 do fluxo mais os
1.684 dos componentes ricos (`SystemSuggestionModal` 511, `ImageUploader` 280,
`SettingStylesField` 224, `ScenarioSelector` 197, `ContactsFormBlock` 162,
`ScenarioSuggestionModal` 151, `useImageUpload` 98, `SystemPicker` 61). Arquivos do fluxo
(`CreateTableForm` 469, `useCreateTableForm` 469, `StepConfig` 451, `StepFinal` 568,
`SessionRepeater` 266, `validation` 236, `mapper` 231, `StepReview` 218,
`createTable.types` 207, `ParsePreviewTextArea` 187, `mapTableApiToInitialData` 180,
`draftStorage` 119, `StepSystem` 117, `StepHeader` 76, `StepSessions` 72, `useAutosave` 66,
`StepActions` 63, `StepBasic` 48, `MarkdownEditor` 44, `useStepNavigation` 58).

**Nenhuma linha desta tabela pode sumir no editor novo.** Feature ausente = task reaberta.
A forma (etapas, ordem, agrupamento) **não** é preservada — só a capacidade. Diretriz do
mantenedor (2026-08-23): o wizard é referência, não molde.

#### Já existia e a spec dizia ser novo — correções do registro

| Feature | Realidade medida | Impacto na spec |
|---|---|---|
| **Autosave + rascunho** | `useAutosave.ts` (debounce 1s, estados `saving`/`saved`/`idle`) + `draftStorage.ts` (versionado, expira em 7 dias, tolera `localStorage` cheio, limpa draft corrompido) — **já funcionam hoje** | R10 deixa de ser "feature nova": é **migrar** o que existe (localStorage) e decidir se sobe para `status='draft'` no backend |
| **Modal de restaurar rascunho** | `CreateTableForm.tsx:272-298` — "Rascunho encontrado · Continuar/Descartar", com `autoFocus` | Não estava em lugar nenhum da spec |
| **Aviso ao fechar a aba** | `beforeunload` em `useCreateTableForm.ts:176` | Não estava na spec |
| **Selo Covil é ADMIN-ONLY** | `StepFinal.tsx:533` (`userRole === 'admin'`) | **Eu havia registrado como checkbox livre para qualquer mestre** — erro que teria vazado um selo de curadoria |
| **DDAL em D&D 5e 2014 ou 2024** (corrigido 2026-08-24 — era só 2024) | `CreateTableForm.tsx:26,221-223` (`DDAL_ELIGIBLE_PATHS` — plural, corrigido em 2026-08-24) e desmarca sozinho ao trocar de sistema (`:257-261`) | Registrado como checkbox solto; faltava a elegibilidade e o efeito |
| **DDAL tem 9 campos** | código, nome, tier, season, duração, formato, código de organização, ambientação, notas de regras | A spec citava 4 |

#### Componentes ricos (não são `<input>`/`<select>`)

| Componente | O que faz | Onde |
|---|---|---|
| `SystemPicker` | Árvore **hierárquica** de sistemas (`/api/v1/systems?view=tree`), com breadcrumb "Pai > Filho", modo single, recarregável | `StepSystem.tsx`, `CreateTableForm.tsx:56-72,106-124` |
| `SystemSuggestionModal` | Sugerir sistema novo com **hierarquia de 3 níveis** (sistema → edição → variante): rótulo do campo pai muda conforme o tipo, cadeia encadeada quando se cria mais de um nível de uma vez (`parent_suggestion_index`), ancoragem a pai já existente, e caminho distinto para **admin** (cria direto) × usuário (sugere). Ao criar, **auto-seleciona** e recarrega a árvore | `components/SystemSuggestionModal.tsx` (511) |
| `ScenarioSelector` + `ScenarioSuggestionModal` | Cenário independente do sistema, com sugestão e refresh por `key` | `StepSystem.tsx:87-93,109-116` |
| `ContactsFormBlock` | **Repeater multi-canal**: 7 canais (WhatsApp, Discord, Telefone→WhatsApp, E-mail, Facebook, Instagram, Formulário), **placeholder por canal**, rótulo opcional, remover, erro próprio, **campo extra "link do servidor" só quando o canal é Discord** (com a explicação de que @usuário não vira link), e ajuda contextual nos canais que exigem URL completa | `components/ContactsFormBlock.tsx` (162) |
| `ScenarioSelector` | Busca com **normalização de acento**, estados de carregando/vazio com mensagem distinta ("nenhum encontrado com esse termo" × "nenhum disponível"), dica quando nada está selecionado | `components/ScenarioSelector.tsx` (197) |
| `ImageUploader` | **Sistema inteiro de imagem** — detalhado abaixo, é o item mais subestimado do registro anterior | `components/ImageUploader.tsx` (280) + `useImageUpload` (98) + `useImageUrlImport` |
| `SettingStylesField` | Ambientação + pills de estilo, **com sugestão automática de estilos a partir do nome do cenário digitado**; `maxLength`; `aria-label` por chip removível; estado "buscando sugestões"; remove a sugestão da lista ao adicionar | `components/SettingStylesField.tsx` (224) |
| `MarkdownEditor` | Editor com contador próprio, em **9 campos** (contagem corrigida em 2026-08-23 — o registro dizia 7): `StepBasic.tsx:34` (descrição) + `StepFinal.tsx:179,250,280,290,299,310,343,518`. Cada um com altura e limite próprios (descrição 5.000/h300, regras h200, sinopse h250, benefícios h180, bio h180, estilo h180, requisitos h180, billing h112, notas DDAL h128). **Dois deles têm o rótulo idêntico** ("Sinopse narrativa", `:280` e `:290`). Uso real em produção e proposta de consolidação: `spec.md` §Gap 8 | `StepBasic`, `StepFinal` |
| `StepReview` | Revisão read-only com "Nenhuma sessão configurada"/"Nenhum contato configurado" | `StepReview.tsx` |

#### Sistema de imagem do banner (subestimado como "banner com crop" no registro anterior)

`ImageUploader` (280) + `useImageUpload` (98) + `useImageUrlImport` + `CroppedImage` +
`@artificio/image-editor` (**pacote compartilhado**) + `@artificio/media/image-kinds`.

| Capacidade | Detalhe |
|---|---|
| Dois caminhos de entrada | arquivo local **e** URL manual |
| **Importação de link externo** | URL de fora é importada para a hospedagem do Artifício ao sair do campo (`POST /api/v1/upload/url`); checkbox **"Manter link direto"** (desligado por padrão) para não importar, com tooltip explicando |
| **Editor de recorte** (`@artificio/image-editor`) | modal de enquadramento com proporção vinda do `kind` |
| **Crop não destrutivo** | o recorte é **dado** (`banner_crop_data` + dimensões), aplicado na exibição via `object-position` — o arquivo não é alterado, e dá para reenquadrar quantas vezes quiser |
| **"Ajustar enquadramento"** | reabre o editor sobre a imagem já hospedada, **sem reenviar** |
| Ordem deliberada | o arquivo sobe **primeiro**, o crop vem depois — o servidor pode reduzir a imagem (`crop:'limit'`), então medir o retângulo no arquivo local daria coordenadas erradas |
| Invalidação de crop | imagem nova (upload ou link) zera crop **e** dimensões juntos — manter as antigas aplicaria coordenadas de outra imagem |
| Validação por `kind` | tipo aceito (JPG/PNG/WEBP) e limite de tamanho vêm de `imageKindSpec`, a **mesma definição que o backend usa**; a mensagem de erro cita o tamanho do arquivo e o limite |
| Prévia | `CroppedImage` com o recorte aplicado, placeholder padrão (`banner_placeholder.webp`) e rótulo "personalizado × padrão em uso" |
| Remover imagem | limpa URL, crop e dimensões |
| Estados | "Enviando imagem...", "Importando link...", botões desabilitados durante as duas operações |
| Acessibilidade | `aria-live="polite"` na seção, `role="alert"` no erro, alvo de toque mínimo de **44px** nos botões |

### §Auditoria dos 15 pacotes compartilhados (2026-08-23)

Feita depois da cobrança do mantenedor: *"veja os pacotes compartilhados antes de sair
improvisando — isso é um sistema maduro"*. O protótipo estava recriando à mão componentes
que já existem prontos e testados. **Reimplementar qualquer um destes é a "exceção por
app" que o AGENTS.md trata como dívida.**

| Pacote | O que o editor DEVE consumir |
|---|---|
| **`catalog-ui`** (9) | **`CatalogTree`** (553 linhas): níveis sistema › edição › variante — **empilhados verticalmente** (`flex flex-col gap-3`, `:425`, com rótulo "Edições de X"), **não** em colunas lado a lado; o registro anterior dizia "colunas em cascata", medição de 2026-08-24 corrigiu. Busca **única** no topo (`:414`), filtrando só sistemas. O R18 pede três colunas com busca por nível — é a mudança de pacote desta spec. busca com `normalizeText`, `presentation: 'selection' \| 'full'`, "+ Adicionar" por nível com rótulo correto (`Adicionar sistema`/`edição`/`variante`), vazio com gênero certo por profundidade, `aria-pressed`, modo single/multi, papel user/admin. Também `CatalogNodeForm`, `sanitizeCatalogForm`, `CatalogExplorer` |
| **`ui/primitives`** (51) | `Button`, `Field` (label+hint+error+required), `TextInput`, `Textarea`, `Select`, `Panel`, `Toolbar`, `Modal`, `Drawer`, `Badge`, `Banner`, `LoadingState`/`EmptyState`/`ErrorState`/`SuccessState`, `HeaderAction` — **eu estava escrevendo todos à mão** |
| **`ui`** | `FileDropzone` (upload por arrastar), `ConfirmDialog`/`useConfirm`/`ConfirmProvider`, `tokens` (paleta canônica), `NotificationBell` |
| **`catalog-matching`** (4) | `scoreSystemCandidates`, `levenshtein`, `similarity`, `matchSystemNameExact`, `buildExactMatchIndex`, `normalizeSystemName` — casamento aproximado de nome de sistema, útil ao parser e à sugestão |
| **`catalog-client`** (2) | `catalogFetch` (timeout de 8s), `flattenTree`, `checkCatalogHealth`, `archiveCatalogNode` |
| `content-editor` | `ContentEditor`, `contentCountLabel`, `contentOverflow`, `renderMarkdown`, `MarkdownContent` |
| `image-editor` / `media` | `ImageEditor`; `imageKindSpec`, `normalizeImageFrame` |
| **`analytics`** (6) | `trackEvent`, `trackSearch`, `trackSelectMesa`, `trackFilterSistema` — **ver achado abaixo** |
| `comments` (41) | `CommentsConversation`, `resolveViewerPermissions` — já usado em mesa publicada (`TableConversation`) |
| `feedback`, `changelog`, `config`, `auth`, `content`, `email` | fora do editor, mapeados para não serem redescobertos |

#### Achados da auditoria (bugs e capacidade desligada)

| Achado | Medição |
|---|---|
| **O fluxo de criação importa ZERO de `@artificio/ui`** (medido 2026-08-23, diretriz do mantenedor) | `grep -rn "@artificio/ui" apps/mesas/frontend/src/features/create-table apps/mesas/frontend/src/components/form-steps` → **nenhuma ocorrência**. As 4.117 linhas do fluxo importam só `@artificio/media` (5), `content-editor` (1) e `catalog-matching` (1). O pacote exporta **16 primitives** (`primitives.tsx:44-510`: Button, Banner, Badge, Field, TextInput, Textarea, Select, Panel, Toolbar, Loading/Empty/Error/SuccessState, Modal, Drawer, HeaderAction) — todos ociosos aqui. **É a maior dívida de design system da spec** e a origem de A16/R16 |
| **O `mesas` é o app que menos consome o design system** | `@artificio/ui` importado em: downloads **13** arquivos, mesas **9**, glossario **3**, site **0**, links **0**. `<select>` cru: mesas **23** arquivos × `Select` do pacote em 5; downloads usa o pacote em **10**. O contraste mesas×downloads é o mesmo achado 34 do `review.md`, agora quantificado por app |
| **Correção do registro: `SystemPicker` JÁ é wrapper do pacote** | `SystemPicker.tsx` envolve `@artificio/catalog-ui` — o próprio teste declara: *"wrapper mesas sobre @artificio/catalog-ui"* (`SystemPicker.test.tsx:24`). Consumidores: `StepSystem.tsx:57`, `UserSystemsSelector.tsx:66`, `DraftEditorTab.tsx:372` e mais. **O componente não precisa ser criado — precisa receber `presentation="selection"`**, que é o achado logo abaixo. O editor novo reusa o wrapper existente, não monta outro seletor |
| **O fluxo de criação não tem NENHUMA instrumentação** | `rtk rg "analytics\|trackEvent\|gtag" features/create-table components/form-steps` → **zero**. Catálogo (`trackFilterSistema`) e página da mesa (`trackSelectMesa`) instrumentam; criar mesa, não. O AGENTS.md exige instrumentar rota pública nova — o editor precisa nascer com evento de início, **publicação**, abandono **e uso do parser** (os 4 do R15) |
| **Busca server-side do catálogo está desligada** | `GET /systems` aceita `search`/`q`, `limit` e `cursor` (`systems.ts:27-60`), mas `CreateTableForm.tsx:111` chama `?view=tree` puro e filtra **tudo no cliente**. Com catálogo grande isso é payload inteiro em cada abertura |
| **`presentation` não é passado no formulário** | `StepSystem` não passa `presentation`, então o seletor cai no modo `full` — com parágrafo técnico, "nome PT" e badge de aliases. O modo `'selection'` existe exatamente para escolha pelo usuário final (R18) e é o que o `CatalogSystemPopover` do catálogo usa |
| **`CatalogSystemPopover` já existe e o form ignora** | `components/CatalogSystemPopover.tsx` (+ teste), criado na spec 094 para o catálogo, com `presentation="selection"` e conversão via `systemTreeNodeToUiNode` — o editor deveria reusar em vez de montar outro seletor |
| **Busca por alias funciona — CONFERIDO em 2026-08-24** | `nodeMatchesQuery` casa nome, `name_pt`, slug, `path_slug` **e alias em qualquer nível** (`CatalogTree.tsx:36-42`, com `subtreeMatchesQuery:48`). A pendência era "conferir se a rota devolve `aliases` populados — se vier vazio, a busca morre em silêncio": **devolve populado**, medido na resposta real de `/api/v1/systems?view=tree` → `"aliases":["The Masquerade","Vampiro","VtM"]`; 199 sistemas têm alias cadastrado (`psql`). A busca por apelido **não** morre |
| **Catálogo é grande e vem inteiro — medido 2026-08-24** | **1.269 nós** (690 sistemas raiz, 393 edições, 186 variantes). `?view=tree` devolve **503.907 bytes** por abertura do form; `?search=vampiro&limit=5` devolve **423**. A busca server-side existe e está desligada — ver `spec.md` §Gap 9 e R18 |
| **`confirm()` nativo no painel** | `PainelMestrePage` usa `confirm()` do navegador em arquivar/desarquivar/ativar/desativar/deletar, enquanto `packages/ui` exporta `useConfirm`/`ConfirmDialog`. Inconsistência de design system |
| **Perfil GM é pré-requisito e tem campos próprios** | `CreateGmProfileForm` (`PainelMestrePage.tsx:170`) cria o perfil via `POST /api/v1/gm/profile` com `slug`, `nickname`, `bio_long` — **distintos** de `display_name`/`bio` do usuário. O R12 precisa dizer **qual** dos dois pares o editor lê e grava |
| **Ciclo de vida da mesa vive fora do editor** | ativar/desativar, arquivar/desarquivar (tira do catálogo, reversível), deletar — todos no painel. Definir se o editor de anúncio expõe algum deles |
| **`services/systemSuggestionCandidates.ts` (560 linhas) duplica `@artificio/catalog-matching`** | assinatura idêntica a `scoreSystemCandidates` (catalog-matching `index.ts:516`); consumir o pacote, não manter o local |

#### Pacotes compartilhados que o fluxo consome (o editor herda todos)

| Pacote | Uso | Onde |
|---|---|---|
| `@artificio/content-editor` | `ContentEditor` é a implementação real por trás do `MarkdownEditor` (adaptador de 44 linhas). Exporta também `contentCountLabel`/`contentOverflow`, usados pelo parser para o contador — **uma fonte só** para a frase de contagem | `MarkdownEditor.tsx`, `SessionRepeater.tsx:3`, `ParsePreviewTextArea.tsx:6` |
| `@artificio/image-editor` | Modal de enquadramento | `ImageUploader.tsx:2` |
| `@artificio/media/image-kinds` | `imageKindSpec` — proporção, limite de arquivo e pasta, **a mesma definição do backend**; `normalizeImageFrame` normaliza o frame vindo do rascunho | `ImageUploader.tsx:4`, `CreateTableForm.tsx:1` |
| `@artificio/catalog-matching` | `normalizeSettingStyles` no mapper | `mapper.ts:2` |
| `utils/safeExternalUrl` (**util local do mesas, não pacote** — correção da auditoria) | `validateContactValue` — **fonte única com o editor de perfil e espelho do backend** (`canonicalizeContactValue`) | `validation.ts:4` |
| `utils/authenticatedFetch` (**util local do mesas, não pacote** — correção da auditoria) | `authPost` no parse-preview e na importação de URL | `ParsePreviewTextArea.tsx:3` |
| `contexts/useAuth` | papel do usuário (é o que gate o Covil) | `CreateTableForm.tsx:11` |

#### Regras de validação que precisam sobreviver

| Regra | Detalhe |
|---|---|
| **Um passo só valida o campo que ele renderiza** | Documentado no código como regra geral (`validation.ts:158-166`): validar campo de outro passo produz "erro sem alvo, indistinguível de formulário quebrado". Já causou incidente — apagar as vagas fazia o passo "Básico" travar com "Mínimo 1 vaga". **No editor, o equivalente é: erro sempre leva à parte que contém o campo** |
| **Sessão flexível é exclusiva** | dia "a definir" **ou** sem horário → só pode haver **uma** sessão (`validation.ts:80-82`) |
| Fim de sessão é opcional | mesas reais não têm hora fixa de encerramento ("sessão até acabar") |
| Título **3–200** (era 3–100; decisão de 2026-08-24 alinha o front ao backend — T4.0e); descrição 10–5.000; vagas 1–20 | `validators` |
| Limites de texto batem com o backend | `FINAL_TEXT_LIMITS` do fluxo atual: regras 2000, sinopse 2000, sinopse narrativa 3000, benefícios 2000, bio 2000, estilo 1000, requisitos 1000 — o front já foi mais restritivo que o servidor e barrava texto que o backend aceitava. **Atenção: sinopse, sinopse narrativa, benefícios e estilo saem no corte de 2026-08-23** (§Gap 8/T4.0m); os limites que sobrevivem são regras, bio e requisitos, mais `title` (que sobe para 200) |
| Erro de excesso diz **quantos caracteres passaram** | "X caracteres acima do limite de Y" |
| Contato por canal | canal de URL exige link alcançável (senão `uwill` vira `https://uwill/` e dá erro de DNS); Facebook/Instagram exigem host da própria rede (senão a página pública não renderiza o link e o contato **some sem erro nenhum**) |
| Nome do mestre obrigatório se anunciante; plataforma personalizada obrigatória se "custom" | `validateStep(4)` |

#### Regras do mapper (payload) que precisam sobreviver

| Regra | Detalhe |
|---|---|
| **"A definir" é contrato, não ausência** | `schedule_day_status`/`schedule_time_status` (`'defined'`\|`'to_define'`) mais `schedule_day_hint`/`schedule_time_hint` — o parser pode ler uma *pista* de dia/horário sem que ela vire valor confirmado. Tratar "a definir" como campo vazio perde a pista |
| Campo `audience` existe no tipo do form | `createTable.types.ts:25` — conferir se tem UI ou entra na lista de campos sem consumidor (§Gap 6) |
| **`''` zera, `undefined` preserva** | valor esvaziado de propósito manda `null` (backend zera); campo ausente manda `undefined` (backend preserva o salvo). Sem isso, limpar um preço na edição não tem efeito |
| Guard `Number.isFinite` em preço | `parseFloat` de texto não numérico vira `NaN`, que `JSON.stringify` serializa como `null` e **limparia o campo silenciosamente** |
| Contatos vazios são filtrados | `.filter(c => c.value.trim())` |
| `discord_server_url` só entra se preenchido | `mapper.ts:30` |
| Primeiro dia/horário conhecido é derivado | `firstKnownDay`/`firstKnownTime` para as colunas de topo da mesa |
| `notes` por sessão | omitido quando vazio. **`slots_per_session` NÃO entra**: é removido por R20/A23/T4.0u |

#### Regras condicionais e efeitos

| Regra | Onde |
|---|---|
| VTT/comunicação só em online/híbrida | `StepConfig.tsx` (`isOnline`) |
| Valores só em paga; doação só em gratuita; **trocar limpa o campo invisível** (evita 400 sobre campo que o mestre não vê) | `handlePriceTypeChange`, `handleAcceptsDonationsChange` |
| Desmarcar doação limpa o valor sugerido | `handleAcceptsDonationsChange` |
| Cobrança detalhada aparece se `paga` **ou** já houver `billingText` | `StepFinal.tsx:243` |
| "✏️ Personalizado" em VTT e comunicação, com campo livre e aviso de obrigatório | `StepConfig.tsx` |
| Catálogos por API com carregando/erro e **fallback para "Personalizado"**; reseta seleção se a carga falhar | `useVttPlatforms`, `useCommunicationPlatforms`, `StepConfig.tsx:76-82` |
| Compatibilidade **UUID↔slug** de VTT na edição | `StepConfig.tsx:86-98` |
| DDAL desmarca ao trocar para sistema não elegível | `CreateTableForm.tsx:257-261` |
| `parseCaseId` é limpo ao restaurar rascunho (senão contamina `discord_parse_cases`) | `CreateTableForm.tsx:149` |
| Nome do cenário buscado para exibição na revisão | `CreateTableForm.tsx:230-254` |

#### Campos e validações

| Item | Onde |
|---|---|
| Cards de rádio do publicador (mestre × anunciante, com selo e nome do mestre real) | `StepConfig.tsx` |
| Faixa etária com **6 níveis e semáforo** (livre, +10, +12, +14, +16, +18) | `StepConfig.tsx` |
| Tipo de mesa: campanha, one-shot, one-shot em série, mesa aberta | `StepConfig.tsx` |
| `SessionRepeater`: **8 opções de dia incluindo "Dia da semana a definir"**, 4 frequências, fim opcional, "horário a combinar" (desliga horas), **`ContentEditor` de observações por sessão**, vagas por sessão, **remover com confirmação em 2 cliques** ("Remover" → "Confirmar?"), primeiro travado com `title` explicando | `SessionRepeater.tsx` (266) |
| `slots_open ≤ slots_total`, máximo 20 | `StepSessions.tsx`, `validation.ts` |
| Limites por campo | `FINAL_TEXT_LIMITS`, `DESCRIPTION_MAX_LENGTH` (5.000) |
| Aviso anti-confusão styleText × settingStyles ("isto é só texto; para virar filtro use Estilos/Temáticas") | `StepFinal.tsx:324-326` |
| Resumo curto, nome de exibição do mestre, duração da campanha, faixa de nível, sessão zero gratuita | `StepFinal.tsx` |
| ~~**Avatar do mestre** (`gmAvatarUrl` + `avatarError`)~~ — **DESCARTADO por decisão (T3.2c, 2026-08-23, opção C)**: campo sem UI no fluxo atual; o payload sai do contrato e a resposta da API (alias computado) continua. **Não recriar ao cruzar a paridade** | `useCreateTableForm.ts:113,116` |
| `isDirty` alimentando o `beforeunload` — só avisa se houve alteração real | `useCreateTableForm.ts:165-177` |
| ~40 pedaços de estado, **todos aceitando `initialData`** (é o que faz a edição funcionar) | `useCreateTableForm.ts:26-166` |
| `parseCaseId` enviado no submit para fechar o loop de aprendizado do parser — não editável pelo mestre | `useCreateTableForm.ts:79-85` |
| Erro de submit distingue criação de edição, e usa `json.error`/`json.message` do backend | `useCreateTableForm.ts:264` |
| `synopsisNarrative` existe no estado e no submit, **mas nenhum editor liga nele** (campo órfão — decidir destino) | `useCreateTableForm.ts:155`; §Gap 6 |

#### Parser (`ParsePreviewTextArea`)

| Item | Onde |
|---|---|
| Habilita só com ≥10 caracteres e sem estouro de limite | `:65` |
| Estados: `idle`/`sending`/`empty-result`/`error`, com spinner e mensagem própria | `:143-181` |
| **Nome do mestre sugerido** a partir do texto | `:166-170` |
| `aria-live="polite"` no contador e nos avisos | `:160,165` |

#### Acessibilidade e feedback já presentes

- `aria-live` no parser; `autoFocus` no modal de restauração; `title` nos passos
  navegáveis do `StepHeader`; `disabled` com `cursor-not-allowed` nas ações;
  `aria-hidden` nos ícones decorativos.
- Toasts (`react-hot-toast`) em restaurar rascunho e resultado do submit.
- Barra de progresso proporcional no `StepHeader` — **o editor precisa de equivalente**,
  já previsto na lateral.

### §Herança da identidade do mestre (R12 — mecânica de 2026-08-23)

Pré-carregar do perfil, **sem escrever nele**. Medido: a exibição pública já resolve o
fallback; o que falta é o editor.

| Campo | Herda de | Preenchido em produção | Sobrescrita | Estado |
|---|---|---|---|---|
| Bio | `gm_profiles.bio_long` | **29/39 mestres** | `tables.table_gm_bio` (0/107) | fallback **pronto** — `tableViewMapper.ts:278` |
| Nickname | `gm_profiles.nickname` | **34/39** | `tables.master_display_name` (6/107) | fallback **pronto** — `tables.ts:158,637` |
| Contatos | `gm_profiles.contact_methods` | **15/39** | `table_contacts` (121 linhas) | **elo quebrado** |

**Contatos — as duas cadeias paralelas.** O perfil grava JSONB
(`PainelMestrePage.tsx:780-782` → `PUT /gm/profile`); a mesa grava a tabela `table_contacts`
(`ContactsFormBlock`); a página pública exibe **só** os da mesa
(`tableViewMapper.ts:338`). `grep contact_methods` no fluxo de criação → **zero**. Nada liga
uma ponta à outra, e o mestre redigita os contatos a cada mesa.

**Medições de 2026-08-23 que dimensionam a herança:**

- **O sobrescritor de nome quase nunca é usado de propósito.** Dos 6
  `master_display_name` preenchidos, **5 são idênticos** ao
  `COALESCE(gm.nickname, p.display_name)` do perfil — foram redigitados iguais. Só **1**
  difere de fato ("Thay" contra "Faren Ravirar"). Ou seja: com a herança ligada, 5 dos 6
  casos deixam de existir sozinhos, e o campo por mesa serve exatamente ao 1 caso restante.
- **A redigitação de contatos é quase total.** Apenas **20 dos 121** contatos de mesa batem
  (canal + valor) com o `contact_methods` do perfil do mesmo mestre — **83% são digitados de
  novo**, mesmo quando o perfil já tem o dado. E só **22 das 107** mesas pertencem a um
  mestre que tem contato no perfil, o que mede o alcance imediato da herança.
- **Canais em uso divergem entre as duas pontas.** Mesa: `form` 62, `whatsapp` 32,
  `discord` 27. Perfil: `whatsapp` 11, `discord` 8, `form` 2, `email` 1. O canal mais usado
  na mesa (`form`, 62) é quase inexistente no perfil (2) — herdar contato **não** cobre o
  caso dominante, que é o formulário próprio de cada mesa.
- **Escala:** 19 mestres têm 1 mesa; 2 têm 2; 2 têm 3; 1 tem 5; 1 tem 7; e **1 tem 66**
  (o pipeline Discord). A herança poupa pouco para quem tem 1 mesa e muito para os poucos
  com várias.

Conversão viável sem migration: os formatos são compatíveis
(`{channel, value, label, discord_server_url}`), e o perfil cobre **4 canais**
(`whatsapp`/`email`/`discord`/`form`) contra **7** da mesa (mais `phone`, `facebook`,
`instagram`) — **hoje** o perfil é subconjunto e a herança é direta; **T4.0r amplia o perfil
para os mesmos 7**, e a partir daí as listas são idênticas. O caminho inverso (mesa → perfil)
**não** existe nesta mecânica: editar no editor nunca escreve no perfil.

### §Catálogo central — a direção universal (medida em 2026-08-24)

Diretriz do mantenedor: *"ele lê o central, e também edita, caso o admin insira, para o
central, podendo ter uma direção universal: onde é inserido em um, os outros consomem."*
**A arquitetura existe e funciona** — medida ponta a ponta:

| Direção | Mecanismo | Onde |
|---|---|---|
| Leitura | produção resolve fonte `'central'`; beta/dev usam **projeção local** | `systemCatalogProvider.ts:49-51` |
| Escrita (admin) | `POST /systems/admin` → `provider.createNode` → `catalogFetch('/api/admin/v1/catalog/nodes', POST)` | `routes/systems.ts`, `services/catalogClient.ts:167` |
| Dono do central | `apps/site-admin` serve `/api/admin/v1/catalog/nodes` | `site-admin/src/api.ts` |
| Consumidores | `mesas` e `downloads`, ambos via `@artificio/catalog-client` | `catalogFetch` com `CATALOG_API_URL` |

**Duas travas que esta spec não pode quebrar:**

1. **O `parent_id` novo (T4.0h-ter) tem de valer nas DUAS fontes.** `centralProvider` e
   `localProvider` implementam a mesma interface; se o parâmetro só funcionar em uma, o
   editor funciona em produção e falha em beta (ou o contrário) — e o bug só aparece no
   ambiente que ninguém testou.
2. **Sugestão aprovada escreve no CENTRAL, não na projeção local.** É o que faz "inserido em
   um, os outros consomem" ser verdade: o sistema que o mestre sugeriu no `mesas` passa a
   existir no `downloads` também.

**Débito medido de passagem:** `createCatalogNode` está **duplicado em dois apps** —
`apps/mesas/backend/src/services/catalogClient.ts:167` e
`apps/downloads/backend/src/services/catalogClient.ts:308` — enquanto
`@artificio/catalog-client` exporta só `catalogFetch`, `checkCatalogHealth`,
`archiveCatalogNode` e `flattenTree`. **A escrita do catálogo nunca subiu para o pacote.** É
a mesma classe do dup de 560 linhas do `catalog-matching` (T7.1b): o pacote existe e o app
reimplementa.

### §Backend — `GET /systems` com `parent_id` e `id` (R18, Gap 9)

Mudanças de servidor exigidas pelo redesenho do seletor de sistema. Medido em
2026-08-24 (o `id` entrou em 2026-08-25 — ver adiante):

| Fato | Evidência |
|---|---|
| A rota aceita só 4 parâmetros | `systems.ts:28-35` — `view`, `search`/`q`, `limit`, `cursor`. Sem `parent_id` |
| A busca anuncia filhos mas não os entrega | `?search=vampire&limit=3` → `"Buffy the Vampire Slayer"` com `has_children: true`, `children_count: 1`, **`children: []`** |
| Não há rota de detalhe por id | `GET /api/v1/systems/:id` → **404**; as rotas do arquivo são `/health`, `/` e três `/admin/*` |

O fluxo progressivo (busca sistema → abre edições → abre variantes) precisa pedir os filhos
de um nó. As alternativas sem o parâmetro são rebaixar a árvore inteira (**503.907 bytes**,
exatamente o que o gap quer eliminar) ou não abrir os níveis. Então: **`GET /systems` passa a
aceitar `parent_id`**, devolvendo os filhos diretos daquele nó com o mesmo formato de nó já
usado (incluindo `aliases`, que a resposta já traz populados).

Aditivo — não muda contrato existente, não exige migration. Toca `docs/api/openapi/**`,
então `pnpm verify:api` é obrigatório antes do commit.

**`?id=` (acrescentado em 2026-08-25, PR #286).** O `parent_id` resolve a DESCIDA
(escolher nível a nível), mas não a SUBIDA: ao abrir uma mesa já publicada, o editor
precisa do nó que já está selecionado — `path_slug` para a elegibilidade DDAL, nome/logo
para o selo do card, e a linhagem para o caminho visível que o R18 exige ("o caminho
escolhido sempre visível"). `search` casa nome, slug, `path_slug` e alias, **nunca id**
(`catalogClient.ts:filterCatalogTree`), e `GET /systems/:id` continua 404. Sem o filtro
por id o editor caía no `?view=tree` — os 503.907 bytes que o A21 proíbe textualmente.

Aceita um id ou vários (`?id=a,b` ou `?id=a&id=b`); id desconhecido sai da resposta em
vez de virar erro. Implementado sobre o MESMO `loadFlat()` da interface compartilhada,
então vale no `centralProvider` (produção) e no `localProvider` (beta/dev), como o
`parent_id`. **Isto diverge da frase "única mudança de backend deste gap" no R18** — o
texto do requisito precisa acompanhar, e alterá-lo é call do mantenedor.

### §Backend — payload e parser

- `tableValidators.ts`: aceitar `age_rating` e `table_level` (R5 do Gap 6).
- `mapTableApiToInitialData.ts`: `is_covil` (não `is_covil_mesa`) e `schedules` (não
  `sessions`) — os dois bugs de perda de dado na edição.
- `parseTextForPreview.ts`/`gmPanel.ts`: passar os catálogos (VTT, comunicação, cenário) e
  os aliases aprendidos ao parse-preview; devolver e **consumir** os sinais de ambiguidade
  que já são calculados e hoje o front ignora.
- Extrações faltantes do parser: mensal, doações, `@username`, "PC e microfone",
  "4 vagas (2 abertas)".

### §Regras VTT → requisitos

Colunas novas em `vtt_platforms` e `communication_platforms` (`implies_pc`,
`implies_microphone`, `implies_camera`), por migration `online-safe` — não mapa em código.
Motivo: os catálogos já vivem em tabela com seed e aliases, e o admin já os edita;
hardcodar um mapa paralelo é a "exceção por app" que o AGENTS.md trata como dívida.
Semente inicial: Foundry/Roll20/Fantasy Grounds → PC; Discord/Teams → microfone;
Meet/Zoom → microfone + câmera.

### §Rascunho e autosave

`table_status` **já** tem `'draft'` e é o default da coluna (`migration_01_base_schema.sql`);
o catálogo público filtra `status='active'` em **6 pontos** (`tables.ts:176,393,777,832,883,915` — medido pela auditoria adversarial; o inventário anterior dizia 5); produção tem
107 mesas, **todas `active`, zero rascunho** — a infra existe e nunca foi usada. Sem
migration. Falta: o painel do mestre distinguir rascunho de mesa no ar.

### §packages/ui — `color-scheme` — NADA A FAZER (corrigido em 2026-08-23)

**O registro anterior desta seção estava errado.** Dizia que a propriedade "não existe hoje
no repositório" e planejava escrevê-la. Medição contra o código:

```
packages/ui/src/styles.css:1008-1058  → bloco "<select> — CONTRATO ÚNICO DO REPO"
  :1027-1030  select, .artificio-control { color-scheme: light }
  :1032-1035  :root[data-theme="dark"] ... { color-scheme: dark }
  :1037-1043  option/optgroup com background/color por token
  :1050-1058  hover/focus/checked (evita realce que some no escuro)
rtk git log -- packages/ui/src/styles.css → 3ae4f6b, 2026-08-17
apps/mesas/frontend/src/main.tsx:8 → import '@artificio/ui/styles.css'
apps/mesas/frontend/src/index.css:111-113,241 → documenta a REMOÇÃO da versão local
```

O comentário do pacote (`:1011-1015`) já narra o mesmo histórico que a Fase 2 redescobriu:
os apps repetiam variações do hack e cada `<select>` novo renascia ilegível.

**Consequência:** T3.4 não tem código a escrever; R9 vira "não regredir" (não redefinir
`color-scheme` nem cor de `<option>` no editor) e A10 vira conferência visual do menu aberto,
que só o mantenedor faz. **A aprovação nominal para tocar `packages/ui` deixa de ser
pré-requisito da Fase 3.**

O que **pode** exigir o pacote na Fase 4 é outra coisa: altura fixa de rótulo no `Field`
para o A2/A18 — a **autorização de escopo de 2026-08-24 já cobre a edição** do arquivo no pacote; o que
continua exigindo aprovação por ação é commit/push/PR/deploy.

**Achado lateral:** `.artificio-field` está declarado duas vezes no mesmo arquivo — `:728`
(`font-family` só) e `:945` (`color`/`display:grid`/`gap`). A segunda vence; a primeira é
regra morta dentro do pacote compartilhado.

## Perguntas abertas (não decididas — não inferir)

- ~~**Destino do par sinopse**~~ — **SUPERADO no mesmo dia (2026-08-23):** a opção A (rebindar para `synopsis_narrative`) foi substituída pela decisão de **remover as duas sinopses do editor** (`spec.md` §Gap 8). T3.2e cancelada por perda de objeto; o corte entra por T4.0m e o destino das colunas por T7.3b. Registro corrigido em 2026-08-24 após auditoria (achado alto 2) — a versão anterior descrevia o rebind como decisão vigente.
- **`gm_avatar_url`** — **DECIDIDO (2026-08-23): remover do contrato do form** (opção C; campo sem UI; a resposta da API é alias computado e continua existindo).
- **Exibição de `rules_notes`** — **DECIDIDO (2026-08-23): nova seção "Regras da Mesa" na MesaPage** (opção A; 35/107 com conteúdo real).
- **`featured` sem escritor** — **DECIDIDO (2026-08-23): toggle admin** (opção A; clone do toggle Covil; D0.2 intacto).
- **Duplicação da família `system-suggestions`** — **DECIDIDO (2026-08-23): (c) agora + (a) alvo** — agora: o mesas consome `@artificio/catalog-matching` e mata a duplicação local de 560 linhas; o contrato de resolução (tipos/zod) sobe para pacote quando convier. Arquitetura alvo: fila única central no `site` — extensão da spec 062 (decisão 5), fora da 096. Medido em produção: o catálogo JÁ é UM e central (edição reflete, provado 1:1 por timestamps); só a fila de sugestões é por app; a tabela central `catalog_suggestions` já existe (0 linhas, 0 rotas).
- ~~**Quais campos de texto grande sobrevivem**~~ — **DECIDIDO (2026-08-23):** ficam **5 de
  10**. Saem as **duas** "Sinopse narrativa" (`synopsis` 1/107, `synopsis_narrative` 0/107),
  "Descrição do estilo de jogo" (`style_text` 9/107), "Resumo alternativo para listagens"
  (`listing_excerpt` 1/107) e "Benefícios e diferenciais" (`benefits_text` 0/107); "Regras e
  observações da mesa" **sobe para logo abaixo da Descrição**. Tabela campo a campo em
  `spec.md` §Gap 8 → T4.0m, T4.0o. **T3.2e (rebind de sinopse) cancelada por perda de
  objeto.**
- ~~**Destino das colunas órfãs do corte**~~ — **DECIDIDO (2026-08-23): as colunas ficam no
  banco.** Só a UI sai; **nenhuma migration nesta spec**, nenhum `manual-risk`. Motivo do
  mantenedor: deixar o dado esfriar antes de apagar. A remoção das 5 colunas
  (`synopsis`, `synopsis_narrative`, `style_text`, `listing_excerpt`, `benefits_text`) vira
  **débito**, registrado só no destino que ele nomear. A seção **"🎭 História"**
  (`TableContent.tsx:25-30`) continua no código lendo `synopsis_narrative` — **0/107**, já
  vazia em todas as mesas, então segue invisível sem regressão. → T7.3b
- ~~**Cenário com 2 significados**~~ — **RESOLVIDO POR MEDIÇÃO (2026-08-24): não é duplicação, são dois conceitos.** `scenario_id` é **nó do catálogo central** (Forgotten Realms, Ravenloft — reutilizável entre sistemas, com sugestão e aprovação); `setting_name` é **texto livre** da ambientação própria da mesa. Produção: **19** mesas com `scenario_id`, **15** com `setting_name`, e apenas **3** com os dois — se fossem o mesmo conceito, a sobreposição seria alta. O que confunde é o rótulo: "Cenário" no StepSystem (`:73`) e "Ambientação" no StepFinal (`:506`), em etapas distantes. **Correção no editor: os dois ficam na MESMA parte**, com o de catálogo primeiro e o livre logo abaixo, rotulado de forma a deixar claro que é para quando o cenário não está no catálogo. Sem remoção de campo.
- ~~**Agrupamento das 7 partes**~~ — **APROVADO pelo mantenedor em 2026-08-24**, com o
  artefato de validação à vista: *"'Para quem é' tem 6 campos; 'Regras e extras' tem 12,
  está ok"*. Registro corrigido após auditoria (achado médio): este arquivo ainda o dava
  como pendente enquanto o `tasks.md` já o registrava aprovado. O texto anterior dizia: Falta
  o mantenedor confirmar, em especial: "Para quem é" reunindo tipo + faixa + experiência +
  complexidade, e "Regras e extras" reunindo regras + marcações + DDAL.
- ~~**Prévia do card na lateral**~~ — **DECIDIDO 2026-08-24: é informação útil**, junto com
  "Ver como jogador" → R22, T4.2b.
- ~~**Par "Meet" × "Google Meet"**~~ — **investigado 2026-08-24:** `communication_platform_aliases`
  já registra "Meet" como alias de "Google Meet"; a linha própria (`slug=meet`, 1 mesa) é a
  duplicata. Caminho medido → T7.1 (exige `UPDATE`+`DELETE` em produção: aprovação por ação).
- ~~**Destino nominal dos campos sem consumidor**~~ — **DECIDIDO 2026-08-24** (R23, §Gap 11):
  segurança de mesa e local entram (local condicionado a modalidade não-online);
  `custom_scenario`/`style_tags`/`features` descartados → T4.0w.

## Arquivos afetados

- **Frontend — substituídos:** `features/create-table/components/CreateTableForm.tsx`,
  `features/create-table/hooks/useStepNavigation.ts`, `components/form-steps/*` (6 steps +
  `StepHeader` + `StepActions`) — 1.474 linhas nos steps. `OnboardingPage.tsx` **fora**
  (é preferências do usuário, não mesa).
- **Frontend — alterados:** `pages/PainelMestrePage.tsx` (consumidor único; passa a
  distinguir rascunho), `features/create-table/utils/mapper.ts`,
  `features/create-table/utils/mapTableApiToInitialData.ts` (2 bugs de edição),
  `features/create-table/utils/validation.ts`, `ParsePreviewTextArea.tsx`,
  `components/SessionRepeater.tsx`, `components/MarkdownEditor.tsx` (se o editor exigir),
  `features/table/components/TableActionPanel.tsx` (formatação de preço).
- **Backend:** `routes/gmPanel.ts` (parse-preview), `discord/parseTextForPreview.ts`,
  `discord/parseDiscordAnnouncement.ts` (extrações faltantes),
  `validators/tableValidators.ts` (aceitar `age_rating`/`table_level`),
  `routes/vttPlatforms.ts` e `routes/communicationPlatforms.ts` (expor as colunas novas).
- **Pacote compartilhado — estado real (2ª auditoria):** `packages/media/src/imageKinds.ts`
  (+teste) **já tocado por esta spec** (R19: `minWidth`/`recommendedWidth`/
  `acceptedMimeTypes`/`imageKindHint`), no diff local, **a commitar no próximo commit junto
  com o diff OG** (decisão de 2026-08-24).
  `packages/catalog-ui` **será tocado** (R18): variante de apresentação com três colunas e
  busca por nível, mais os aliases nas opções — **sem substituir** o empilhamento dos demais
  consumidores.
  `packages/ui` só se o `Field` não zerar A2 (A18). Edição autorizada por escopo desde
  2026-08-24; commit/push/PR seguem por ação.
- **Backend, além do já listado:** `routes/systems.ts` (`parent_id`, T4.0h-ter),
  `utils/contactUrls.ts` (`PROFILE_CONTACT_CHANNELS` — ampliar o perfil aos 7 canais; R12, decidido em 2026-08-24 — T4.0r),
  `routes/adminTables.ts` (toggle `featured`, T7.2c), `routes/tables.ts` (select de
  `rules_notes` e faixa etária — T7.2b/T3.2f).
- **Frontend, além do já listado:** `components/TableCard.tsx` (horário personalizado, faixa
  etária), `features/table/components/TableContent.tsx` (seção de regras),
  `features/table/mappers/tableViewMapper.ts` e `types/tableView.types.ts`.
- **~~Nenhum arquivo por causa do R9~~** — o `color-scheme` já está em
  `packages/ui/src/styles.css:1008-1058` desde `3ae4f6b`. O pacote só é tocado se a Fase 4
  medir lacuna real no `Field` (altura fixa de rótulo para A2/A18) ou precisar de primitive
  novo; nesse caso, aprovação nominal + verificação de impacto **na hora**, não antecipada.
- **Database:** migration `online-safe` das colunas `implies_pc`/`implies_microphone`/
  `implies_camera` em `vtt_platforms` e `communication_platforms`, com seed. **Uma
  migration só** para as duas tabelas (AGENTS.md §Migrations item 2.1 — não fatiar schema
  da mesma feature). Rascunho **não** precisa de migration (`'draft'` já existe).

## Contratos/interfaces tocados

- `POST /api/v1/gm/parse-preview` (resposta: expor schedules corretamente, ambiguidades,
  catálogos aplicados).
- `POST/PUT /api/v1/gm/tables` (payload: aceitar/remover campos hoje descartados —
  age_rating, table_level, city/state, content_warnings, safety_tools). **`price_frequency`
  sai desta lista: decidido MANTER** — a página pública já o exibe (`TableActionPanel.tsx:87-88`)
  e ele ganha entrada no editor (T7.2b2).
- Exibição pública de preço (formatação consistente) — toca contrato visual do card/página.

## Impacto em consumidores

- **`packages/ui` (R9): impacto já absorvido, fora desta spec.** O `color-scheme` que atinge
  todos os apps entrou em `3ae4f6b` (2026-08-17) e já está em produção — esta spec não
  reintroduz a mudança nem responde por ela. O que **esta** spec não pode fazer é regredir:
  o editor não redefine `color-scheme` nem cor de `<option>` localmente (A10).
- Página pública da mesa (`MesaPage`) e WhatsApp share exibem preço/requisitos — mudanças
  de formatação/derivação afetam esses leitores; manter paridade nos testes existentes.
- **O CATÁLOGO PÚBLICO muda de aparência** (achado A6 da 3ª auditoria): a reversão da D0.5
  (aliases voltam a aparecer nas opções em `presentation="selection"`, R18) atinge o
  **`CatalogSystemPopover` do catálogo** — hoje o único consumidor desse modo, e a tela para
  a qual a D0.5 foi criada na spec 094. Os badges que ela suprimiu por poluição visual voltam
  a renderizar ali. **DECIDIDO em 2026-08-24: a reversão vale nos DOIS** — editor e catálogo,
  uma regra só para toda seleção de sistema. Não é efeito colateral: é o alcance escolhido.
  Quem revisar o catálogo verá os aliases nas opções do filtro.
- Rotas de app tocadas: `/gm/*` (internas) **e `GET /api/v1/systems`**, que é **pública** e
  tem consumidor fora do editor (catálogo, `CatalogSystemPopover`) — o `parent_id` novo é
  aditivo, mas a rota não é interna. Correção de 2026-08-24: a frase anterior dizia "sem
  consumidor cross-app", falso para o plano atual.
- **Mesas em rascunho passam a existir** — qualquer consulta que assuma "toda mesa do
  mestre está no ar" precisa filtrar por `status`. O catálogo público já filtra
  (`status='active'` em **6** pontos — medido; a contagem de 5 do inventário inicial estava
  errada); o painel do mestre é o que muda.

## Rollback

- Mudanças de UI/form: reversíveis por redeploy (sem estado novo), salvo campos de payload
  que passarem a ser aceitos (adição é compatível; remoção de campo enviado hoje exige
  corte coordenado frontend+backend no mesmo PR).
- Migration de regras VTT→requisitos: só adiciona coluna, header `online-safe`;
  reversível por migration de rollback.
- Correção do parser: puramente server-side + mapper; reversível por redeploy.
- **`color-scheme` em `packages/ui`:** sem rollback a planejar — a mudança já está em
  produção desde 2026-08-17 e não é reintroduzida por esta spec.
- **Rascunho:** mesas `draft` criadas ficam no banco se a feature for revertida. Não é
  perda (o catálogo já as ignora), mas o painel do mestre volta a listá-las sem distinção
  — reverter a UI exige decidir o que fazer com as `draft` existentes.

## Validação (como provo que funciona)

Cada critério de aceite do `spec.md` tem um comando ou medição.
**A tabela abaixo lista apenas os automatizáveis por teste/grep** — 13 dos 27. Os demais
(A12 paridade, A13 Covil, A14 DDAL, A15 rascunho, A19-A20 identidade, A22 imagem, A23
horário, A24 requisitos/valores, A25 prévia, A26 segurança/local, A27 faixa etária) são
conferidos **item a item nos gates de fase**, contra a spec, e não por comando — é o critério
de corte desta tabela, registrado em 2026-08-24 após a 4ª auditoria apontar que 14 critérios
apareciam sem explicação de ausência.

| Aceite | Verificação |
|---|---|
| A1 zero rolagem | teste que percorre as 7 partes medindo `scrollHeight` × `clientHeight` |
| A2 alinhamento 0px | teste que agrupa campos por linha e compara `top` dos controles |
| A3 edição em 2 interações | teste do caminho de edição; grep provando que não há "continuar" no editor |
| A4 publicar revela pendências | teste: publicar vazio marca N obrigatórios, foca o primeiro, lista as partes |
| A5 `age_rating`/`table_level` | teste de contrato do payload + verificação no banco após smoke |
| A6/A7 bugs de edição | teste de `mapTableApiToInitialData` com resposta real (`is_covil`, `schedules`) |
| A8 preço 55/40 | regressão em `TableActionPanel.test.tsx` |
| A9 parser | 8 fixtures, uma por falha do §Gap 4 |
| A10 `color-scheme` (não regredir) | grep provando zero `color-scheme`/`select option` no CSS do editor + `getComputedStyle` nos dois temas + **conferência visual do menu aberto pelo mantenedor** (a lista nativa não aparece em captura) |
| A16 zero controle cru | grep de `<input`/`<select`/`<textarea`/`<button` no diretório do editor → só ocorrências com comentário inline justificando |
| A17 texto consolidado | o editor novo tem **5** editores de texto rico (tabela do `spec.md` §Gap 8 — fonte única), e nenhum par repete rótulo |
| A18 alinhamento pelo pacote | grep provando que o alinhamento vem de `Field`/`artificio-control`, sem regra de layout própria do editor para o mesmo fim |
| A11 marca × validação | teste que cruza os campos marcados obrigatórios com as regras de `validation.ts` |

Comandos: `rtk pnpm vitest run <arquivo>` e `rtk tsc -p tsconfig.json --noEmit` no pacote
afetado durante as rodadas; repo-wide (`lint`/`build`/`test`) só no fim, um de cada vez.
`pnpm verify:api` obrigatório (toca `apps/**`, `packages/**`).

Smoke visual obrigatório (quem valida: **mantenedor**): criar mesa do zero, editar mesa no
ar mudando um campo só, auto-marcação de requisitos ao escolher VTT/Discord, parser
pré-preenchendo com aviso de ambiguidades, caso 55/40, e os `<select>` abertos no escuro.
