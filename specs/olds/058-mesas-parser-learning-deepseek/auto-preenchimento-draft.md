# Auto-preenchimento máximo do draft — visão ampliada (058)

## COMO USAR ESTE DOCUMENTO (leia antes de implementar)

Este arquivo tem 2 partes:
1. **"PLANO DE EXECUÇÃO" (esta seção e a seguinte)** — o que fazer, em que ordem, com critério de pronto.
   Comece aqui. Se seguir só esta parte, dá pra implementar sem precisar reler o histórico abaixo.
2. **Tudo depois de "## Objetivo do mantenedor"** — histórico de investigação/revisão que PRODUZIU o plano
   de execução. Serve como evidência/justificativa ("por que esse campo e não aquele"), não como lista de
   tarefas. Não é preciso ler linearmente pra implementar — consulte só se precisar entender o "porquê" de
   uma decisão específica.

Visão de produto de fundo (motivação, não repetir aqui): `apps/mesas/CONTEXT.md` §"Visão estratégica de
produto".

## PLANO DE EXECUÇÃO — ordem, arquivos, critério de pronto

**Pré-requisito descoberto nesta revisão, MUDA o entendimento de "migration" das fases abaixo:** o draft NÃO
tem colunas soltas por campo no banco. A tabela real é `discord_import_table_drafts`
(`DiscordImportTableDraftsTable`, `apps/mesas/backend/src/db/types.ts:640`) e guarda o draft inteiro
serializado dentro de `parsed_payload: unknown` / `normalized_payload: unknown | null` (JSONB genérico).
`DiscordTableDraftTable` (`apps/mesas/backend/src/discord/types.ts:49`) é o TIPO TypeScript desse payload, não
um schema de colunas. **Consequência: adicionar campo novo ao draft = adicionar propriedade nova ao tipo
`DiscordTableDraftTable`, NÃO uma migration de coluna de banco.** Isso corrige a Fase B original (que supunha
migration SQL) — não há migration de schema pra campo novo do draft. Migration só entraria se algum dia o
draft precisar de coluna indexável/consultável separadamente (não é o caso aqui). **Portanto a trava de SDD
Completo por migration/banco (`AGENTS.md`) NÃO se aplica às Fases B/C/D/F/G/I** — são mudança de tipo
TypeScript + lógica de parser + UI, escopo `apps/mesas` isolado, SDD Lite é suficiente. Confirmar com
mantenedor antes de iniciar, mas registrar que a suposição de migration do doc original estava errada.

### Ordem de implementação (cada fase é um passo fechado — implementa, valida, só então avança)

**1. Fase H — robustez de import truncado** (`apps/mesas/backend/src/discord/chatExporterImportService.ts`,
função `parseUploadedJsonBuffer`; ver rota de import correspondente em `apps/mesas/backend/src/routes/
discord/import.ts`)
- O quê: antes de rejeitar buffer que falha `JSON.parse`, tentar reconstrução tolerante — cortar pro último
  objeto de mensagem completo dentro do array `messages`, fechar array + objeto raiz, tentar parse de novo.
- Contrato de saída: se reconstrução funcionar, importar as N mensagens recuperadas normalmente E retornar
  aviso visível (`warning`/`partial: true` no corpo de resposta da rota) informando quantas mensagens foram
  recuperadas vs. quantas foram descartadas por corte incompleto. Nunca falhar silenciosamente, nunca fingir
  que o arquivo veio completo.
- Se reconstrução falhar mesmo assim (arquivo corrompido de verdade, não só truncado): manter comportamento
  atual (erro 400).
- Critério de pronto: subir um JSON truncado de verdade (pode reusar a técnica usada nesta sessão pra gerar
  um a partir de `D:/teste_hoje2.json` original, ou truncar deliberadamente qualquer export válido) pela rota
  real e confirmar que as mensagens válidas anteriores ao corte aparecem importadas, com aviso de truncamento
  visível na resposta.

**2. Fase G — fallback de contato via autor Discord** (`apps/mesas/backend/src/discord/syncHelpers.ts`,
função `extractContacts`)
- O quê: ao final de `extractContacts`, se `contacts.length === 0`, adicionar 1 contato
  `{ channel: 'discord', value: <host_discord_id ou autor da mensagem>, label: null,
  discord_server_url: null }`.
- Critério de pronto: draft sem `contact_url` nem `contact_discord` extraído, mas com autor Discord conhecido,
  produz pelo menos 1 contato ao sincronizar como mesa — teste automatizado cobrindo esse caso.

**3. Fase F — categorização real de canal de contato** (mesmo arquivo, `extractContacts`)
- O quê: antes de cair no fallback genérico `'form'`, detectar host/padrão de WhatsApp (`wa.me`,
  `api.whatsapp.com`, `chat.whatsapp.com`) → `channel: 'whatsapp'`; detectar padrão de e-mail
  (`/[^\s@]+@[^\s@]+\.[^\s@]+/`) → `channel: 'email'`; detectar padrão de telefone BR
  (`/\(?\d{2}\)?\s?9?\d{4}-?\d{4}/`) → `channel: 'phone'`. Enum alvo confirmado:
  `whatsapp | discord | phone | email | facebook | instagram | form` (mesmo do form manual, `StepFinal.tsx`
  campo 22.1). Instagram/Facebook: implementar detecção de host só se aparecerem em amostra real — não
  adicionar sem evidência.
- Critério de pronto: link de WhatsApp real (de algum dos JSONs de teste) produz `channel: 'whatsapp'`, não
  `'form'`.

**4. Fase A — motor de matching full-text (sistema + cenário + VTT + comunicação)**
(`apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts`, ao lado de `findSystemMatch`/`matchSystem`)
- O quê: função genérica `findBestMatch(text: string, candidates: MatchCandidate[], opts): MatchResult[]`
  que varre TÍTULO + CORPO + DESCRIÇÃO concatenados (com marcação de origem por trecho: label explícito >
  título > corpo solto), retorna candidatos rankeados por origem+especificidade+exatidão — reusa a lógica já
  existente de `findSystemMatch` (não reescrever do zero, generalizar).
- Correção de decisão em aberto da revisão anterior (item 3): motor cobre sistema+cenário+VTT+comunicação com
  a MESMA função (nome+aliases simples, sem lógica de "edição" — isso fica só na camada de sistema, que já
  tem `stripVersionSuffix` separado).
- Correção técnica obrigatória (achado da simulação real): `stripVersionSuffix` deve rodar ANTES de
  `stripDecorativeMarkup` remover pontuação de versão, OU a regex de versão em `stripVersionSuffix`
  (`/\s(\d+(?:\.\d+)?e?)$/i`) precisa aceitar espaço como separador decimal também (`\d+(?:[.\s]\d+)?e?`).
  Decidir qual abordagem na implementação, mas o teste de regressão (ex.: "Pathfinder 1.3" vira "1 3" após
  limpeza) TEM que passar.
- Correção de design (achado da simulação real): valor de label com múltiplos candidatos na MESMA linha (ex.
  "D&D 3.5, D20 System") deve ser separado por `,`/`e`/`ou` ANTES de rankear cada pedaço individualmente —
  não tratar a linha inteira como 1 candidato só.
- Se 1 candidato forte → aplica direto. Se 2+ candidatos conflitantes de força equivalente → não decide,
  marca `needs_review`, anota candidatos em `_raw_evidence` pro revisor decidir.
- **Hint sem match nenhum NUNCA desaparece** (confirma comportamento já existente pra sistema via
  `rawSystemHint` — estender pra cenário/VTT/comunicação da mesma forma: preservar o texto bruto não-casado
  em campo equivalente, pra pipeline de sugestão pegar).
- Critério de pronto: rodar contra os 3 JSONs reais desta sessão e confirmar que "Pathfinder 2e" (caso
  original que disparou a investigação) é detectado corretamente mesmo no formato sem `:` (label numa linha,
  valor na seguinte).

**5. Fase B/C — campos novos no tipo do draft + extração**
(`apps/mesas/backend/src/discord/types.ts` para o tipo; `parseDiscordAnnouncement.ts` para extração)
- Adicionar ao `DiscordTableDraftTable`: `scenario_id`, `raw_scenario_hint`, `vtt_platform_id`,
  `communication_platform_id`, `age_rating`, `setting_name`, `setting_styles`, `experience_level`,
  `table_level`, `requires_pc`, `requires_camera`, `requires_microphone`, `session_zero_free`.
- **RESOLVIDO (era ambiguidade pendente, fechada nesta revisão):** `style_tags` (`TablesTable`,
  `db/types.ts:300`) **NÃO TEM UI EM NENHUM LUGAR do form manual** — confirmado por grep, não aparece em
  nenhum step nem componente. Sai de escopo, junto com `content_warnings`/`safety_tools`/`city`/`state`.
  `setting_styles` (`db/types.ts:299`) TEM UI real: componente `SettingStylesField.tsx`, usado em
  `StepFinal.tsx:346-352`, sempre em par com `setting_name` (props `settingName`+`settingStyles`, mesma
  seção "Cenário e Estilos"). Origem textual pro parser: `setting_name` = nome do cenário citado no texto
  (ex. "Ambientação:"/nome de cenário citado livremente); `setting_styles` = lista de estilos citados junto
  (ex. campo "Estilo:"/"Indicado:" do exemplo original — "Fantasia/Investigação/Mistério"). Os dois sempre
  extraídos e setados JUNTOS, nunca um sem o outro (mesmo padrão do componente de UI).
- `frequency`: extrair cadência explícita do texto (regex livre: "semanal"/"quinzenal"/"mensal"/"a cada X
  dias") ANTES do fallback `deriveFrequency`. **Correção da simulação real:** quando cadência é encontrada no
  texto mas `type` está `null`, a extração de frequência também deve setar `type: 'campanha'` (regra: só
  campanha tem cadência recorrente; one-shot/aberta não tem frequência por definição) — resolve os 41% de
  `type` ausente identificados na simulação.
- NÃO incluir nesta fase (fora de escopo confirmado, sem UI em lugar nenhum do form manual): `style_tags`,
  `content_warnings`, `safety_tools`, `city`, `state`, bloco DDAL, `isCovilMesa`,
  `publisherRole`/`actualGmName` (administrativo).
- Campos de baixa prioridade (`campaign_length`, `level_range`, `style_text`, `listing_excerpt`, `synopsis`)
  ficam FORA desta rodada — não implementar ainda, evitar redundância não resolvida com `description`.
  **`setting_name` SAI desta lista de baixa prioridade** — corrigido acima, entra na Fase B/C junto com
  `setting_styles` (mesmo componente de UI, sempre extraídos juntos).
- Critério de pronto: rodar contra os 3 JSONs reais e confirmar que os campos citados no exemplo original
  (classificação indicativa +18, plataformas Foundry VTT/Discord, estilo Fantasia/Investigação/Mistério) são
  extraídos corretamente pro draft de "Ruins of Gauntlight".

**6. Fase E — sincronização draft → mesa publicada** (`apps/mesas/backend/src/discord/syncHelpers.ts`,
branch de update `~451-471` DENTRO da função de sync — checar também se existe branch de CRIAÇÃO/insert
separado que precisa do mesmo tratamento)
- O quê: adicionar cada campo novo da Fase B ao `.set({...})`/`.insertInto()` — sem isso, todo campo novo
  desaparece silenciosamente ao confirmar draft como mesa.
- Critério de pronto: draft com os campos novos preenchidos, ao clicar "Sincronizar como mesa", produz linha
  em `tables` com os MESMOS valores presentes no draft — teste automatizado ponta a ponta comparando
  draft.table.* com o registro final de `tables`.

**7. Fase D — UI do editor de draft** (`apps/mesas/frontend/src/features/discord-sync/components/
DraftEditorTab.tsx`)
- Adicionar inputs pros campos novos da Fase B (só depois de B/C/E prontos e testados).
- Trocar `<select>` nativo de sistema (linha ~137-142 hoje) por componente de busca — reusar
  `SystemTreeSelector.tsx` se o contrato de dados bater, senão adaptar componente equivalente.
- Quando motor da Fase A marcar `needs_review` com candidatos conflitantes, mostrar os candidatos de forma
  visível (não só "campo pendente" genérico) pro revisor escolher rápido.
- Critério de pronto: abrir um draft real (dos JSONs de teste) no editor e confirmar visualmente que todos os
  campos novos aparecem preenchidos ou editáveis, e sistema em conflito mostra as opções pro revisor.

**8. Fase I — preview lado a lado no editor** (mesmo `DraftEditorTab.tsx`)
- O quê: buscar/receber `content_raw` (já existe em `discord_import_messages`/`import_messages`,
  `db/types.ts:622,668` — confirmar na implementação se já chega no payload que alimenta o editor; se não
  chegar, adicionar ao endpoint que serve o draft) e renderizar formatado ao lado do form, reusando
  `stripSeparatorLines`/`stripDecorativeMarkup` (já existem em `parseDiscordAnnouncement.ts`) pra limpar
  decoração sem esconder informação nem reformatar estrutura.
- Critério de pronto: abrir o draft do exemplo "Ruins of Gauntlight" no editor e ver o texto original
  (decoração limpa, labels e quebras de linha preservados) ao lado dos campos preenchidos/vazios.

### Validação final obrigatória (todas as fases)
- `pnpm --filter @artificio/mesas-backend build` + `test`
- `pnpm --filter @artificio/mesas-frontend build` + `test`
- `pnpm run lint` + `pnpm run build` + `pnpm run test` (repo-wide, conforme AGENTS.md)
- `pnpm verify:api` se algum contrato de rota mudar (Fase H pode mudar corpo de resposta — checar)
- Rodar parser contra os 3 JSONs reais (`D:/teste_hoje.json`, `D:/teste_hoje3.json`,
  `D:/teste_hoje2.recovered.json`) e confirmar visualmente que os drafts resultantes preenchem
  significativamente mais campos que a baseline registrada nesta sessão (41% `type` ausente, 70%
  `contact_url` ausente, sistema não detectado no caso "Ruins of Gauntlight" — comparar antes/depois).

### O que "pronto" significa nesta spec (critério de aceite geral)
Não é 100% de automação — isso nunca é o critério (ver `apps/mesas/CONTEXT.md`, automação é assíntota). É:
(1) todo campo do form manual listado nas Fases B/C tem extração implementada e testada; (2) nenhum dado
extraído se perde entre draft e mesa publicada (Fase E fechada); (3) import não falha mais 100% em arquivo
truncado (Fase H); (4) revisor humano consegue comparar texto original vs. campos preenchidos sem sair da
tela do editor (Fase I); (5) build/lint/test verdes; (6) nenhuma auto-publicação sem revisão humana foi
introduzida (mantém-se o princípio "nunca decide sozinho em caso de conflito").

---

Status: RASCUNHO PRÉ-IMPLEMENTAÇÃO, revisado 3x:
1. Agente adversarial (`g1-governance-reviewer`, 2026-07-02, veredito CORRIGIR) — 7 achados incorporados
   (ver seção "Revisão adversarial — achados incorporados").
2. Simulação real independente (2 agentes, um interno + um `general-purpose` sem viés do plano, 2026-07-02)
   rodando o parser ATUAL sem alteração contra 2 arquivos reais recém-extraídos (`D:/teste_hoje.json`,
   `D:/teste_hoje3.json`, 91 mensagens úteis de anúncios reais de mesa) — achados em "Simulação real —
   achados incorporados".
3. 3ª revisão independente (`general-purpose`, sem viés do plano, 2026-07-02) atacando 3 ângulos corrigidos
   pelo mantenedor: robustez de import truncado, hint de sistema sempre virar sugestão, preview lado a lado
   com `content_raw` real (não JSON bruto). Achados em "Robustez de import + preview — achados incorporados
   (3ª revisão)". Inclui recuperação real de `D:/teste_hoje2.json` (truncado no fim) → 8 mensagens válidas em
   `D:/teste_hoje2.recovered.json`.

Nenhum código alterado. Ainda aguarda fechamento de escopo final com o mantenedor antes de qualquer
autorização de código.

## Objetivo do mantenedor (citação literal, guia tudo abaixo)

> "o sitema de draft tem que funcionar o máixmo perfeito possível de auto preenchimento a partir dos jsons"

> "se em algum momento do texto citar algum dos sistemas conhecidos ou alias, tem que fazer cruzamentos até
> encontrar o sistema mais correto"

> "candidatos não só de sistema, mas das abas que temos que preencher. o ser humano coloca lá as informações
> pois sabe que outros humanos vão identificar, o sistema tem que saber coletar... temos os bancos de dados,
> os locais para preencher."

> "plataforma, sistema, horarios, dias, titulo, descrição, valor, recrutamento (link, whats, formularios) ou
> o usuario do discord se tiver nada. ou links. tem que ser completo. voce sabe os campos que tem que
> preencher. estão no front ende. e se tem que preencher, tem que preencher com as informações que existem.
> se existem as informações, tem que ser preenchidas."

Princípio geral extraído: **toda informação que existe no texto bruto (JSON importado) e tem um campo
correspondente no formulário de draft/mesa deve ser extraída e preenchida — não só sistema.** Quando existe
banco de referência (sistema, plataforma VTT, plataforma de comunicação, tags), a extração deve CRUZAR contra
esse banco, não só capturar texto livre.

## Caso real que disparou a investigação

Draft `5c1c8755-9328-4adf-a941-39a2a3bc244e` ("Ruins of Gauntlight"). Texto de origem (campo `description`
do JSON importado, formato WordPress/site colado — label numa linha, valor na linha seguinte, SEM `:`):

```text
Abomination Vaults: Ruins of Gauntlight
Sistema
Pathfinder 2e
Dias e horários da mesa
Aos sábados, horarios a combinar
Vagas disponíveis
4 Vagas.
Classificação Indicativa
+18
Plataformas
Foundry VTT, Discord
Local do Jogo
Servidor Proprio
Estilo: Fantasia / Investigação / Mistério
Indicado
Bom Mic, Horários maleáveis, Imersão, Senso de humor
História
[texto longo de sinopse...]
```

Resultado da importação real: só `título` e `descrição` (bruta, sem parse) vieram certos. `Sistema` ficou
pendente apesar do texto trazer "Pathfinder 2e" de forma clara e isolada.

## Levantamento do gap real (schema vs. draft vs. parser) — feito nesta sessão

### Campos que JÁ existem no draft (`DiscordTableDraftTable`, `apps/mesas/backend/src/discord/types.ts:49`)
E cuja extração JÁ varre texto livre no corpo inteiro (não travam em label estruturado):

`title`, `type`, `modality`, `price_type`, `price_value`, `slots_total`, `slots_open`, `day_of_week`,
`start_time`, `contact_url`, `contact_discord`, `host_discord_id`, `description`.

Confirmado lendo `parseDiscordAnnouncement.ts` função a função: `extractModality`, `extractType`,
`extractPrice`, `extractSlots` (+ 6 variantes de padrão), `extractDayOfWeek`, `extractStartTime`,
`extractDiscordTimestamp`, `extractContactUrl`, `extractContactDiscord`, `extractHostDiscordId` — todas
recebem `text`/`body`/`fullText` (corpo inteiro), não uma linha de label isolada. **Esses não são o
problema.**

### Campos que existem no draft mas a extração é fraca ou ausente

1. **`system_id`/`system_name`** — banco de referência existe (`systems` + `system_aliases`, com
   `name`/`name_pt`/`aliases`/edição — `findSystemMatch`/`matchSystem` em `parseDiscordAnnouncement.ts:202`).
   Mas só roda sobre `systemHint` (valor do label "Sistema:") OU, em fallback, sobre `fullText` só QUANDO
   `!systemHint` (linha 853). No caso real, `systemHint` nunca é extraído porque `splitLabelLine` (linha 546)
   exige `:` na mesma linha — layout "Sistema\nPathfinder 2e" (sem `:`) não bate. Resultado: nem o label nem
   o fallback rodam sobre o valor certo.

2. **`frequency`** (enum já existe: `TableDraftFrequency = 'semanal' | 'quinzenal' | 'mensal' | 'avulsa'`,
   `types.ts:23`) — nunca é extraído do texto. Só é INFERIDO por `deriveFrequency()` (linha 506): `campanha +
   tem dia da semana → 'semanal'`, sempre, ignorando se o texto diz "quinzenal"/"mensal"/"a cada 15 dias"
   explicitamente.

### Campos que existem na mesa PUBLICADA (`TablesTable`, `apps/mesas/backend/src/db/types.ts:225`) mas
### NÃO EXISTEM NO DRAFT (`DiscordTableDraftTable`) — gap estrutural, não só de extração:

| Campo em `TablesTable` | Tem banco de referência? | Aparece no exemplo do mantenedor? |
|---|---|---|
| `vtt_platform_id` (→ `vtt_platforms`) | Sim | Sim — "Plataformas: Foundry VTT, Discord" |
| `communication_platform_id` (→ `communication_platforms`) | Sim | Sim — mesmo campo, "Discord" é plataforma de comunicação |
| `age_rating` (`'livre'\|'10+'\|...\|'18+'`) | Não (enum fixo) | Sim — "Classificação Indicativa: +18" |
| `content_warnings: string[]` | Provável (checar tabela de referência) | Não direto no exemplo, mas comum em outros anúncios |
| `safety_tools: string[]` | Provável (checar tabela de referência) | Não |
| `style_tags: string[]` / `setting_styles: string[]` | Provável (checar `tags`) | Sim — "Estilo: Fantasia / Investigação / Mistério" e "Indicado: Bom Mic, Horários maleáveis, Imersão, Senso de humor" |
| `city` / `state` (presencial) | Não | Não no exemplo (é online), mas campo existe |
| `table_level` (`'iniciante'\|'intermediario'\|'avancado'`) | Não (enum fixo) | Não no exemplo |
| `technical_requirements` / `requires_pc` / `requires_camera` / `requires_microphone` | Não | Não no exemplo, mas comum |

**Isso é achado NOVO desta rodada, ainda não estava no `debitos.md` (DEB-058-04) nem nas perguntas
anteriores** — as perguntas feitas ao mantenedor cobriram só sistema+plataforma+tags+frequência, tratando
plataforma/tags como "cruzamento que falta" sem confirmar se o CAMPO em si existe no draft. Na verdade
`platforms`/`tags`/`age_rating`/etc. não existem no schema do draft — sequer chegaram a ser mapeados como
"campo do form" porque o form atual (`DraftEditorTab.tsx`) também não os expõe (are não implementados no
front, não é só filtro de exibição).

### Frontend — campos hoje expostos no editor de draft (`DraftEditorTab.tsx`)

Confirmado por grep: `title`, `system_id`, `type`, `modality`, `price_type`, `slots_total`, `slots_open`,
`day_of_week`, `start_time`, `frequency`, `contact_url`, `contact_discord`, `description`, `cover_quality`.

Ou seja: mesmo que o parser aprenda a extrair `age_rating`/`platforms`/`tags`/`style_tags` do texto, HOJE NÃO
HÁ ONDE MOSTRAR/EDITAR isso no draft — precisa de: (a) colunas novas em `discord_table_drafts` (migration),
(b) campos novos em `DiscordTableDraftTable` (tipo), (c) extração no parser, (d) UI nova em
`DraftEditorTab.tsx`, (e) mapeamento na sincronização draft→mesa publicada (`normalizeDiscordTableDraft.ts`
ou equivalente — precisa localizar o código que grava a mesa final a partir do draft confirmado).

## Levantamento SISTEMÁTICO e definitivo — todos os 49 campos do form manual (2026-07-02)

Mantenedor corrigiu o princípio: não é "sistema + campos que fomos achando por acaso" — é regra universal:
**TODO campo que existe no formulário humano de criação de mesa é candidato a auto-preenchimento. Se a
informação está no texto, vai pro campo certo. Só cai em descrição solta o que não tem campo estruturado
correspondente.** Exemplo do mantenedor: "se descrição cita que tem que ter microfone, já temos campo pra
isso" (`requires_microphone`) — não pode ficar só implícito na descrição.

Levantamento sistemático (agente `Explore`, leu os 5 steps do form manual: `StepBasic.tsx`, `StepSystem.tsx`,
`StepConfig.tsx`, `StepSessions.tsx`, `StepFinal.tsx`) encontrou **49 campos reais preenchidos por humano**,
substituindo o mapeamento parcial anterior (que via só 14 campos, os que já existiam no draft).

### Campos SEM UI em nenhum lugar (nem humano preenche) — CONFIRMADO fora de escopo
`content_warnings`, `safety_tools`, `city`, `state` existem em `TablesTable` mas não têm campo no form
manual — ninguém preenche isso hoje, nem humano nem máquina. Fora de escopo até virarem campo de produto real
(não faz sentido parser preencher o que nem o form manual expõe). Corrige a suposição anterior deste doc de
que esses eram candidatos a Fase B.

### Campos administrativos — CONFIRMADO fora de escopo (não é informação do ANÚNCIO)
Bloco DDAL inteiro (9 campos: `is_ddal`, `ddal_code`, `ddal_name`, `ddal_tier`, `ddal_season`,
`ddal_duration`, `ddal_format`, `ddal_org_code`, `ddal_rules_notes`) — específico de D&D Adventurers League,
não é campo de anúncio humano genérico. `isCovilMesa` — admin only. `publisherRole`/`actualGmName` — é
decisão de QUEM FAZ A IMPORTAÇÃO (papel de quem publica), não informação extraível do texto do anúncio.

### Campos NOVOS confirmados como candidatos reais a auto-preenchimento (não estavam no plano anterior)

| Campo | Fonte de dados | Por que é gap novo |
|---|---|---|
| `scenario_id` (Cenário) | Banco `scenarios`, mesmo padrão de `system_id` | **Gap total, nunca cogitado nas rodadas anteriores** — mesma estrutura de matching que sistema (nome+busca), mas nenhuma revisão anterior tocou nisso |
| `experience_level` (nível de experiência do jogador) | Enum fixo: todos/iniciante/intermediario/veterano | Gap novo — não confundir com `table_level` |
| `table_level` (complexidade da mesa) | Enum fixo: todos/iniciante/intermediario/avancado | Já citado antes como "não aparece no exemplo", agora confirmado como campo real do form |
| `requiresPc`/`requiresCamera`/`requiresMicrophone` | Checkbox booleano | Exemplo literal do mantenedor ("cita que precisa de microfone") — meta-exemplo de como a regra deve funcionar |
| `sessionZeroFree` | Checkbox booleano | Gap novo |
| `campaignLength`/`levelRange` | Texto livre | Gap novo, baixa prioridade (texto livre sem estrutura clara pra extrair) |
| `styleText`/`listingExcerpt`/`synopsis` | Texto livre com limite de caracteres | Podem sobrepor com `description` — decidir se extração separada faz sentido ou se é redundante |
| `settingName`/`settingStyles` | Texto livre + multi-select | "Cenário"/"Ambientação" no exemplo real do mantenedor batem aqui, não só em `scenario_id` |
| Canal de contato completo | Enum real: `whatsapp\|discord\|phone\|email\|facebook\|instagram\|form` | Confirma e substitui a Fase F anterior (que supunha as opções) — agora com a lista EXATA do enum real usado no form manual |

### Confirmação do que já estava certo
`vtt_platform_id`, `communication_platform_id`, `age_rating`, `style_tags`/`setting_styles` (Fases A/B/C já
descritas abaixo) continuam válidos — o levantamento sistemático CONFIRMA que são campos reais do form
(`StepConfig.tsx`/`StepFinal.tsx`), não suposição. `content_warnings`/`safety_tools` SAEM do escopo (não têm
UI, ver acima) — corrige a Fase B original que ainda os listava.

## Escopo ampliado proposto (substitui a lista de 4 itens da rodada anterior)

### Fase A — Motor de detecção full-text com banco de referência (sistema, VTT platform, communication
platform, tags/estilo)
- Função única reaproveitável: dado um texto (título+corpo+descrição concatenados, com origem marcada por
  trecho — label explícito / título / corpo) e uma lista de entradas candidatas (nome + aliases + prioridade),
  varre o texto INTEIRO, coleta TODOS os matches, rankeia por: origem (label explícito > título > corpo),
  especificidade (edição > sistema pai; match exato > tolerante), tamanho do candidato (mais específico
  vence).
- Se só 1 candidato forte → aplica direto (alta confiança).
- Se 2+ candidatos CONFLITANTES de mesma força → não decide sozinho, marca `needs_review` com todos os
  candidatos anotados em `_raw_evidence` pro revisor escolher.
- Reusa esse motor pra: `system_id` (já tem banco), `vtt_platform_id` (banco `vtt_platforms` já existe),
  `communication_platform_id` (banco `communication_platforms` já existe).
- **CORRIGIDO pós-revisão:** `content_warnings`, `safety_tools`, `style_tags`, `setting_styles` são
  `string[]`/`Generated<string[]>` SEM FK, SEM tabela de referência — confirmado em `db/types.ts`, nenhuma
  `ContentWarningsTable`/tabela equivalente existe. `TagsTable`/`PlatformsTable` (id 1011-1012 do schema) são
  de OUTRO domínio (perfil de usuário/preferências), não de mesa. Esses 4 campos NÃO entram no motor de
  matching-contra-banco da Fase A — são extração de texto livre + normalização (lista separada por `/` ou
  vírgula, sem candidato "certo/errado" contra banco), tratamento mais parecido com tags livre do que com
  sistema/plataforma.

### Fase B — Campos novos no schema do draft (migration online-safe aditiva) — CORRIGIDA pelo levantamento
sistemático
- Adicionar ao `discord_table_drafts` e ao tipo `DiscordTableDraftTable`: `scenario_id`, `vtt_platform_id`,
  `communication_platform_id`, `age_rating`, `style_tags`/`setting_styles`, `experience_level`,
  `table_level`, `requires_pc`/`requires_camera`/`requires_microphone`, `session_zero_free`.
- **REMOVIDO** desta fase (sem UI no form manual, ver levantamento sistemático acima): `content_warnings`,
  `safety_tools`, `city`, `state`.
- Campos de texto livre de baixa prioridade (`campaign_length`, `level_range`, `style_text`,
  `listing_excerpt`, `synopsis`, `setting_name`) — avaliar na implementação se compensam extração própria ou
  se ficam cobertos por `description` (podem ser redundantes; decidir com exemplos reais antes de migration).
- Migration só ADITIVA (colunas nullable, `@class: online-safe`), sem quebrar draft existente. SDD Completo
  obrigatório (regra pétrea de `AGENTS.md` pra qualquer migration/banco).

### Fase C — Extração dos campos novos (CORRIGIDA)
- `scenario_id`: mesmo motor de matching da Fase A (banco `scenarios`, mesmo padrão de sistema).
- `age_rating`: enum fixo, regex livre no corpo (ex.: "+18", "livre", "12 anos", "classificação indicativa").
- `style_tags`/`setting_styles`: campo "Estilo:"/"Ambientação:"/"Indicado:" no exemplo — lista separada por
  `/` ou vírgula, texto livre normalizado (sem banco, ver Fase A corrigida).
- `experience_level`/`table_level`: regex livre buscando termos como "iniciante"/"veterano"/"avançado" — dois
  campos distintos, não confundir (nível do JOGADOR vs. complexidade da MESA).
- `requiresPc`/`requiresCamera`/`requiresMicrophone`: regex livre buscando menção explícita ("precisa de
  microfone", "câmera obrigatória", "só via PC") — exemplo literal citado pelo mantenedor como meta-caso.
- `frequency`: extração explícita (regex livre, enum fixo já existe) ANTES do fallback `deriveFrequency`
  atual — e **CORRIGIDO conforme achado da simulação real**: extração de cadência deve também poder inferir
  `type: 'campanha'` quando citada, não só alimentar `frequency` isoladamente (ver seção "Simulação real"
  abaixo, achado 41% de `type` ausente).

### Fase D — UI do editor de draft
- Adicionar campos novos ao `DraftEditorTab.tsx` (só depois que existirem no schema/tipo).
- Trocar `<select>` nativo de sistema por componente de busca (candidato: `SystemTreeSelector.tsx` ou
  adaptação equivalente) — evita lista plana gigante, conforme pedido original do mantenedor.
- Mostrar candidatos conflitantes (quando motor não decide sozinho) de forma visível pro revisor escolher
  rápido — não só "campo pendente" genérico.

### Fase E — Sincronização draft → mesa publicada (CORRIGIDA pós-revisão)
- Código já localizado: `apps/mesas/backend/src/discord/syncHelpers.ts`. Função de update
  (linha ~451-471, dentro do branch `if (existingTable)`) faz `trx.updateTable('tables').set({...})` com uma
  lista FIXA e CURTA de campos: `title, description, type, modality, price_type, price_value,
  price_frequency, slots_total, slots_filled, slots_open, system_id, cover_url, banner_url, actual_gm_name,
  is_covil, status, updated_at`.
- **Isso não é "propagação a garantir" — é reescrita obrigatória.** Qualquer campo novo adicionado ao draft
  na Fase B (`vtt_platform_id`, `communication_platform_id`, `age_rating`, `content_warnings`,
  `safety_tools`, `style_tags`, `setting_styles`) fica preenchido no draft e É DESCARTADO SILENCIOSAMENTE na
  hora de "Sincronizar como mesa" se esse `.set({...})` não for editado para incluir cada campo novo. Sem
  essa edição, todo trabalho das Fases B/C/D produz dado que nunca chega na mesa publicada — bug silencioso
  de perda de dado, não feature incompleta.
- Fase E portanto = editar `syncHelpers.ts` (branch de update E branch de criação, se houver dois pontos de
  `.set()`/`.insertInto()` separados — checar antes de implementar) adicionando cada campo novo da Fase B ao
  mapeamento.

## Revisão adversarial — achados incorporados (agente `g1-governance-reviewer`, 2026-07-02)

As 6 perguntas em aberto originais foram atacadas e respondidas (ou incorporadas como Fase F/G abaixo):

1. **RESPONDIDO:** não existe tabela de referência para `content_warnings`/`safety_tools`/`style_tags`/
   `setting_styles` — são `string[]` livres, sem FK. Fase A não cobre esses 4 campos (ver correção acima).
2. **RESPONDIDO:** código de sync é `apps/mesas/backend/src/discord/syncHelpers.ts`, branch de update em
   `~451-471`. Fase E reescrita acima com o achado crítico (perda silenciosa de dado sem essa edição).
3. **Em aberto, decidir na implementação:** motor de matching único é viável pra sistema/VTT/comunicação
   (todos têm nome+aliases simples); "edição"/versão de sistema é extensão específica só de sistema, resto
   do motor (varredura+ranking por origem) é genérico. Não bloqueia início da Fase A.
4. **RESPONDIDO por `AGENTS.md`:** migration/banco SEMPRE exige SDD Completo — a trava é por TIPO de mudança
   (migration), não por escopo de app. `apps/mesas` isolado não dispensa SDD Completo aqui. Já é regra
   pétrea, não precisava ficar em aberto.
5. **RESPONDIDO por leitura de schema:** `ddal_*`/`is_covil`/`banner_crop_data` são campos administrativos de
   importação de organizador específico (D&D Adventurers League) — corretamente fora de escopo, confirmado.
6. **RESPONDIDO pelo próprio código:** `_homebrew_suspect` (`types.ts:78-84`) só é setado no caso AMBÍGUO;
   descarte nítido retorna `null` antes de chegar no draft. Sem conflito de precedência com o motor novo.

### Fase F (NOVA — gap do pedido original não coberto na 1ª versão do doc) — categorização real de contato

Mantenedor pediu explicitamente: "recrutamento (link, whats, formulários) ou o usuario do discord se tiver
nada". Código real (`syncHelpers.ts:extractContacts`, linha ~148-177) hoje só distingue 2 canais:
`'discord'` (se `contact_discord` setado, ou URL de host discord.com/discord.gg) vs. `'form'` (QUALQUER outra
URL, incluindo link de WhatsApp `wa.me/...`). O enum `TableContactChannel` já tem `'whatsapp'`, `'facebook'`,
`'instagram'`, `'phone'`, `'email'` disponíveis mas nunca usados pela extração.

- Adicionar detecção de host/padrão de WhatsApp (`wa.me`, `api.whatsapp.com`, `chat.whatsapp.com`) →
  `channel: 'whatsapp'` em vez de cair em `'form'` genérico.
- Considerar mesma lógica pra `instagram.com`/`facebook.com` se aparecerem nos anúncios reais (checar
  amostra antes de implementar — não adicionar detecção sem evidência de uso real).
- **CONFIRMADO pelo levantamento sistemático:** o enum `TableContactChannel` usado no form manual
  (`StepFinal.tsx`, campo 22.1) é exatamente `whatsapp | discord | phone | email | facebook | instagram |
  form` — mesma lista do banco, sem surpresa. Detecção de `phone`/`email` (regex de telefone BR / regex de
  e-mail) também cabe nesta fase, mesmo nível de esforço que WhatsApp.

### Fase G (NOVA — gap do pedido original não coberto na 1ª versão do doc) — fallback de contato via autor Discord

Citação literal do mantenedor: **"o usuario do discord se tiver nada"**. Quando não há `contact_url` nem
`contact_discord` explícito extraído do texto, o draft já tem `host_discord_id` (autor da mensagem original,
`types.ts:73`) — mas `extractContacts` não usa esse campo como fallback de contato nenhuma vez. Adicionar:
se `contacts.length === 0` ao fim de `extractContacts`, usar `draft.table.host_discord_id` (ou o autor da
mensagem, se acessível nesse ponto) como contato `channel: 'discord'` de fallback.

## Simulação real — achados incorporados (2 agentes independentes, 2026-07-02)

Rodado o parser ATUAL (sem nenhuma alteração de código) contra 91 mensagens reais de 2 arquivos recém-
extraídos do canal de anúncios de mesa. Volumes e achados confirmados/novos:

- **[nota]** `content_warnings`/`safety_tools`/`style_tags`/VTT/comunicação NÃO são caso isolado: 44/91
  mensagens citam classificação indicativa, 65/91 citam VTT, 78/91 citam estilo/tags, 10/91 citam
  comunicação. Reforça prioridade real da Fase B/C — não é edge case, é maioria dos posts.
- **[crítico — NOVO]** `type` (campanha/one-shot/aberta) falha em 37/91 (41%) das mensagens — e é
  DEPENDÊNCIA de `frequency`: `deriveFrequency()` só infere frequência quando `type === 'campanha'`. Posts
  que descrevem cadência sem a palavra "campanha" (ex.: "Constância: Quinzenalmente", "Quinzenal, Sextas,
  20h") ficam com `type: null` E `frequency: null`, mesmo tendo "Quinzenal" escrito no texto. **Correção da
  Fase C:** a extração de cadência (semanal/quinzenal/mensal) precisa também poder inferir/confirmar
  `type: 'campanha'` quando citada, não só alimentar `frequency` isoladamente — a raiz do bloqueio é `type`,
  não só ausência de extração de frequência.
- **[importante — volume confirmado]** `contact_url` ausente em 64/91 (70%), `contact_discord` ausente em
  27/91 (30%) — volume real bem maior que o suposto na 1ª versão do doc. Confirma que a Fase G (fallback via
  `host_discord_id`) resolve boa parte de um buraco real, não teórico — priorizar Fase G alto na
  implementação.
- **[nota — caso de design]** Sistema citado 2x na mesma linha do mesmo label (ex.: "D&D 3.5, D20 System")
  é sinal MAIS FORTE de multi-candidato do que conflito espalhado pelo texto (mesma linha/mesmo label vs.
  menções soltas em lugares diferentes) — e "D20 System" é meta-sistema genérico (regra base de várias
  edições D&D-like), não sistema jogável cadastrável isoladamente. O motor de ranking da Fase A cobre isso
  implicitamente (candidato mais específico vence), mas vale regra explícita: separar por `,`/`e`/`ou` dentro
  do valor do label "Sistema" antes de rankear cada pedaço como candidato individual.
- **[nota — técnico, ordem de operações na Fase A]** Achado de implementação: `stripDecorativeMarkup` roda
  ANTES do matching de versão e remove pontuação útil (ex.: "1.3" vira "1 3" após a limpeza), quebrando a
  regex de `stripVersionSuffix` que espera separador consistente (`\s(\d+(?:\.\d+)?e?)$`). A normalização de
  versão precisa rodar sobre o texto ANTES da limpeza decorativa remover o separador, OU a regex de versão
  precisa aceitar espaço no lugar de ponto como separador de versão minor.

## Robustez de import + preview — achados incorporados (3ª revisão, 2026-07-02)

Mantenedor corrigiu foco: JSON truncado normalmente só corta o FIM do arquivo (download/export
interrompido), resto é válido — não é motivo pra descartar tudo. E preview de revisão não é "bruto"/JSON
cru, é o `content` real da mensagem (texto do anúncio, decoração `▬▬▬` limpa mas informação preservada)
mostrado formatado ao lado do form, pra humano comparar rápido "texto diz X, campo vazio → bug ou precisa
ensinar sistema". Validado recuperando `D:/teste_hoje2.json` na prática (39836 bytes, cortou no fim de uma
mensagem — reconstrução simples: cortar pro último objeto de mensagem completo + fechar array/objeto,
resultou em 8 mensagens 100% válidas recuperadas de um arquivo que hoje é rejeitado inteiro).

### Fase H (NOVA — categoria própria, robustez de ingestão, não é qualidade de extração de campo)

**Achado crítico confirmado em código real:** `apps/mesas/backend/src/discord/chatExporterImportService.ts:28`
(`parseUploadedJsonBuffer`) e a rota de import fazem `JSON.parse(rawJson)` bruto dentro de um try/catch que,
ao falhar, devolve erro 400 ("JSON inválido") pro ARQUIVO INTEIRO. Confirmado também que o schema Zod
(`chatExporterAdapter.ts:14`, `discordChatExporterExportSchema.safeParse`) derruba o arquivo inteiro do mesmo
jeito. Resultado real: um export de 50 mensagens que corta no meio da mensagem 51 perde as 50 válidas
inteiras — zero tolerância a truncamento parcial, apesar de ser um padrão de falha comum (export
interrompido, download incompleto, cópia parcial).

- Proposta: antes de rejeitar por erro de parse, tentar reconstrução tolerante — cortar o buffer bruto pro
  último objeto de mensagem completo e fechar array/objeto raiz corretamente (mesma técnica usada
  manualmente pra recuperar `teste_hoje2.json` nesta sessão), reprocessar como JSON válido, e importar as
  mensagens recuperadas normalmente. Registrar de forma visível pro usuário ("N mensagens importadas, arquivo
  veio truncado, M mensagens no fim foram descartadas por corte incompleto") — nunca falhar silenciosamente
  nem fingir que o arquivo estava completo.
- Escopo: mudança em `chatExporterImportService.ts`/rota de import (`apps/mesas`), sem migration, sem
  contrato de rota novo (mesmo endpoint, só mais tolerante). Não é SDD Completo por padrão — confirmar com
  mantenedor se o volume da mudança justifica SDD Lite ou Completo antes de implementar.

### Fase I (NOVA — preview lado a lado no editor do draft)

**Achado confirmado:** dado já existe, sem necessidade de migration. `content_raw` já é coluna real
(`db/types.ts:622` em `discord_import_messages`, `db/types.ts:668` em `import_messages`) — texto original da
mensagem NUNCA é perdido durante o parse, mesmo quando campos estruturados falham. Frontend já busca
`content_raw` em outros componentes (`MessagesView.tsx`, `discordSyncApi.ts`, `useDiscordSync.ts`), mas
`DraftEditorTab.tsx` (o editor onde o revisor confirma/corrige o draft) NUNCA referencia `content_raw` —
hoje só mostra os campos estruturados já parseados, sem o texto original ao lado pra comparação.

- Proposta: `DraftEditorTab.tsx` ganha painel lado a lado (ou toggle) mostrando `content_raw` formatado —
  reusar `stripSeparatorLines`/`stripDecorativeMarkup` (já existem em `parseDiscordAnnouncement.ts`, já fazem
  exatamente a limpeza "legível, sem esconder informação, remove só decoração `▬▬▬`/markdown de ênfase")
  para renderizar o texto de forma limpa sem transformar em novo formato — o usuário vê a mensagem quase como
  foi escrita, só sem ruído visual.
- Preservar quebras de linha e labels originais (`» Sistema: X`, `» Plataformas: Y`) — não reformatar em
  estrutura nova, só limpar decoração, exatamente como pedido ("essa parte, eu já sei o que nosso código
  identificou ou não" — o valor está em ver o texto original ao lado do campo preenchido/vazio, não em uma
  reinterpretação).
- Escopo: mudança só de frontend (`DraftEditorTab.tsx` + prop/fetch de `content_raw` se ainda não estiver
  disponível no payload do draft que chega no editor — confirmar isso na implementação) + reuso de funções
  já existentes do parser. Sem migration.

## O que NÃO muda nesta proposta

- Não altera os campos já bem cobertos (modalidade/tipo/preço/vagas/dia/horário/contato/descrição) — só
  amplia sistema, adiciona VTT/comunicação/age_rating/tags conforme confirmado necessário, e frequência.
- Não implica em auto-publicação — tudo que hoje vira `needs_review` continua exigindo revisão humana; motor
  novo só melhora a qualidade do PRÉ-preenchimento, não decide sozinho quando há conflito.
- Não toca no MVP de parser-learning (`discord_parse_cases`/`discord_parse_feedback`) já implementado na Fase
  1 desta spec — é ortogonal (aprendizado de casos vs. cobertura de campos).
