# Auditoria de consistência — Spec 096 (4ª rodada, do zero)

**Data:** 2026-08-24 · **Pedido:** refazer a auditoria do zero — procurar inconsistências e
contradições **dentro e entre** `spec.md`, `plan.md` e `tasks.md`; informação incompleta ou
indutora de erro; e informação duplicada/espalhada que possa ser esquecida.

**Método:** releitura integral dos 3 arquivos no estado atual (spec.md ~1.148 linhas,
plan.md 671, tasks.md 763) com passes cruzados por par (spec↔plan, plan↔tasks,
tasks↔spec) + conferência pontual no código onde a afirmação era factual e barata de medir
(`imageKinds.ts`, `styles.css`, `git status` real) e greps de fixação de linha. Cada achado
cita arquivo:linha e diz qual versão vence. Nada foi editado em `spec.md`/`plan.md`/
`tasks.md` — este artefato é o único produto da rodada.

**Nenhum achado CRÍTICO nesta rodada.** Os três críticos da 3ª rodada (C1-C3: R18,
§Gap 9, R12) foram reescritos e re-verificados como corrigidos (seção 4). O teto desta
rodada é ALTO.

---

## 1. ALTOS

### A1. Destino do commit do diff de `packages/media`: plan.md ainda diz "1º PR da spec" em dois pontos, contra a decisão "PRÓXIMO commit, junto com o diff OG"

- `plan.md:129` — "`packages/media/src/imageKinds.ts` (+teste) — R19/§Gap 10, autorizado, e
  **entra no primeiro PR desta spec**".
- `plan.md:576` — "no diff local, a commitar no 1º PR".
- Contradiz `spec.md:392-394` — "entra no **PRÓXIMO commit, junto com o diff OG** (decisão
  do mantenedor, 2026-08-24 — **não** espera o 1º PR da spec)" — e `tasks.md:45`
  (pendência: "DECIDIDO 2026-08-24: entra no PRÓXIMO commit, junto com o diff OG").
- **Vence:** spec §Gap 10 + pendência do tasks (decisão datada). Consequência de seguir o
  plan: montar o commit no momento errado ou separar o diff do combinado — e a Fase 4
  depende de o helper existir no `origin/dev` (spec:394-396).
- **Correção:** reescrever as duas frases do plan (linhas 129 e 576) com a decisão nova.

### A2. Gate da Fase 4 (T4.9) não lista R13 nem R15 — a fase pode fechar sem conferir dois requisitos que ela própria implementa

- `tasks.md:624-626` — T4.9 manda reler "R1, R2, R6, R6.1, R10, R11, R12, R16, R17, R18,
  R19, R20, R21, R22, R23 e A1-A4, A11-A15, A16-A26". Fora da lista: **R13** (editor
  consome os pacotes compartilhados — `spec.md:777`; implementado por T4.0g/T4.0l/T4.0n) e
  **R15** (instrumentação com 4 eventos — `spec.md:794`; implementado por T4.0i).
- O parêntese do próprio gate diz que a lista já foi ampliada uma vez porque "faltavam
  justamente R12 e R18-R21" — a mesma classe de falha segue viva. A instrumentação é o item
  exato que se perde com facilidade (hoje o fluxo emite **zero** eventos) e o consumo dos
  pacotes é a "maior dívida de design system da spec" (plan:265).
- **Vence:** a lista precisa conter os requisitos da fase. **Correção:** acrescentar R13 e
  R15 ao T4.9. (R24/A27 são da Fase 3 e já entraram no T3.5 — ok.)

### A3. "O novo editor com múltiplos horários" em dois pontos desatualizados + A7 sem comportamento definido para mesa legada com 2+ horários

- `spec.md:202` — "o novo editor com múltiplos horários torna o bug crítico" e
  `plan.md:110` — "o novo editor com múltiplos horários torna-o crítico". O editor novo
  **não** tem múltiplos horários: R20 (`spec.md:984-985`, "O repeater de N horários sai"),
  A23 (`spec.md:1085`, "não existe botão de adicionar horário") e T4.0u (`tasks.md:266-279`).
  A frase ficou invertida: com o repeater removido, o bug da edição perde gravidade — e
  segue corrigido por T3.1 de qualquer forma (A6/A7).
- `spec.md:1069` (A7) — "mesa com 2+ `table_schedules`, editar outro campo → contagem
  preservada": o critério cobre o **mapper** (T3.1), mas nenhum documento diz o que o
  editor de horário **único** exibe ao abrir uma mesa legada com 2+ horários (só o primeiro?
  todos read-only? aviso?). Produção hoje tem **0 casos** (medido em `plan.md:110`), mas o
  parser pode criar vários.
- **Vence:** R20/A23/T4.0u (editor de horário único). **Correção:** reescrever as duas
  frases (spec:202, plan:110) para "o bug continua valendo e é corrigido por T3.1" e
  definir o comportamento do editor único diante de 2+ horários (levado à seção 6).

### A4. T4.0k avisa que notificações executam na Fase 7, mas o corpo ainda manda "notificações ganham tela" na Fase 4

- `tasks.md:553-554` (cabeçalho) — "atenção ao escopo: a parte de notificações **EXECUTA NA
  FASE 7 (T7.4b)**; aqui só a tela 'minhas sugestões' e o botão de sugerir VTT" ×
  `tasks.md:558` (corpo) — "`POST /api/v1/vtt-platforms/suggest` ganha botão;
  **notificações ganham tela (66/62 não lidas)**".
- O resquício é exatamente a linha que a correção da 3ª rodada (M9) pretendia neutralizar:
  quem lê o corpo da task monta a tela de notificações na Fase 4.
- **Vence:** cabeçalho + T7.4b (`tasks.md:664-669`). **Correção:** remover/riscar a
  meia-frase do corpo.

### A5. "Perfil tem 4 canais, é subconjunto da mesa" segue em três pontos sem apontar para a decisão dos 7 canais (T4.0r)

- `spec.md:832-834` — "o perfil aceita **4 canais** …, a mesa aceita **7** … O perfil é
  **subconjunto** da mesa, então herdar perfil → mesa é direto"; `plan.md:405-409` — "o
  perfil cobre **4 canais** … contra **7** da mesa … perfil é subconjunto, herança é
  direta"; `tasks.md:471-472` (T4.0p) — "o perfil cobre **4** canais e a mesa **7** — o
  perfil é subconjunto, então a conversão é direta".
- Nenhum dos três aponta para a decisão de 2026-08-24 (`spec.md:911` — "Os 7 canais valem
  nos dois lados"; T4.0r, `tasks.md:500-509` — validação + serialização + exibição). Depois
  de T4.0r, "subconjunto" e "4 canais" ficam falsos; hoje descrevem um estado que a própria
  Fase 4 desfaz, e a T4.0p (herança) pode ser implementada sobre a premissa velha.
- **Vence:** T4.0r/R12. **Correção:** nos três pontos, acrescentar "(hoje 4; T4.0r amplia
  para 7)" ou reescrever com o estado final.

### A6. Agrupamento das 7 partes aprovado, mas fora do índice de decisões do spec — e o spec ainda diz que "continuam abertas"

- `plan.md:173-174` e `tasks.md:35` registram a aprovação (2026-08-24, com artefato de
  validação: *"'Para quem é' tem 6 campos; 'Regras e extras' tem 12, está ok"*). O `spec.md`
  **não lista as 7 partes em lugar nenhum** (R1/R2 falam de "partes" sem nomeá-las) e a
  tabela "Entra — decisões de 2026-08-24" — criada justamente porque as decisões "ficavam
  espalhadas pelos gaps" (`spec.md:689-690`) — não tem linha para o agrupamento.
- `spec.md:41` (Diretriz 3, seção datada de 2026-08-23) — "as pendências de agrupamento
  **continuam abertas** e não foram fechadas por inferência" — falso hoje.
- **Vence:** plan:173-174/tasks:35 (aprovado). **Correção:** linha do agrupamento na
  Entra 08-24 (ou a lista das 7 partes no R1) e riscar/atualizar `spec.md:41`.

---

## 2. MÉDIOS

### M1. Dois "piso" de banner: 600×325 × 600×315, sem a frase que explica a diferença

- `spec.md:350` — "piso **600 × 325**" e `spec.md:1084` (A22) — "piso **600 × 325**" ×
  `spec.md:375-376` — "cujo piso técnico é **600 × 315**" e `spec.md:404-406` — "tem piso no
  mínimo social (**600×315**)".
- Código conferido: `packages/media/src/imageKinds.ts:95-97` — `minWidth: 600,
  minHeight: 325`, com o comentário *"600x325 mantém a proporção e fica no piso social
  (600x315)"*. O spec nunca reproduz essa justificativa: quem lê a linha 405 entende que o
  piso do banner é o "mínimo social" (600×315), quando o mínimo implementado é 600×325.
- **Vence:** o código (600×325). **Correção:** linha 405 → "tem piso de 600 × 325, que
  cobre o mínimo social (600×315) mantendo a proporção" (reproduzir o comentário do pacote).

### M2. Tabela de validação do plan cobre 13 linhas/14 critérios dos 27, sem declarar o critério de corte

- `plan.md:649-662` lista A1-A11 + A16-A18 (13 linhas; A6/A7 numa só), omitindo **A12-A15**
  e **A19-A27**. O texto diz "Os automatizáveis:" — mas A12 (paridade, checklist), A13
  (Covil admin-only), A14 (DDAL) e A15 (rascunho) são automatizáveis por teste/grep, e
  A19-A27 também. O **A12 é o critério contratual da paridade** ("feature ausente = task
  reaberta") e não tem comando/medição na tabela.
- **Vence:** —. **Correção:** completar a tabela com os 13 critérios que faltam, ou
  declarar o critério de inclusão.

### M3. `slots_filled` tratado em duas tasks de fases diferentes, sem ponteiro entre elas

- `tasks.md:180-181` (T3.2d, Fase 3) — "dar escritor ao fluxo manual … **ou** deixar de
  lê-lo" — escolha em aberto dentro da task; `tasks.md:698-699` (T7.2, Fase 7) — o campo na
  lista de "destino nominal de cada campo".
- O mesmo campo tem duas casas de decisão; a da Fase 3 carrega um "ou" que é decisão de
  produto não registrada, e a da Fase 7 pode reabrir o assunto. Risco: decidir duas vezes,
  de formas diferentes, ou nunca.
- **Vence:** precisa de uma decisão só (seção 6). **Correção:** resolver o "ou" da T3.2d e
  remover a linha da T7.2 (ou apontar para a T3.2d).

### M4. §Gap 8 declara "fonte única — não repetem a contagem", mas os pontos citados repetem "5"

- `spec.md:615-617` — "(Entra, R17, A17, `plan.md` §Perguntas, T4.0m/T4.0o/T7.3b) apontam
  para cá e **não repetem a contagem**". Mas: R17 (`spec.md:1040-1041`) diz "ficam 5";
  A17 (`spec.md:1079`) diz "os 5 removidos"; `plan.md:528-529` diz "ficam 5 de 10"; T4.0m
  (`tasks.md:439-440`) diz "Ficam 5 editores". Quatro dos sete pontos citados repetem o
  número.
- A declaração, falsa hoje, é a armadilha que ela mesma pretendia evitar: se o corte mudar,
  quem atualizar a tabela confiará que os demais pontos se ajustam sozinhos — o cenário C4
  da rodada anterior renascendo.
- **Vence:** a tabela do §Gap 8 como fonte. **Correção:** tirar o número dos quatro pontos
  (deixar só o ponteiro) ou trocar a declaração por "a contagem correta vive aqui; quem
  repete o número assume mantê-lo em dobro".

---

## 3. BAIXOS

| # | Onde | Problema | Correção |
|---|---|---|---|
| B1 | `plan.md:266` "achado 34 do `review.md`"; `plan.md:118(9)` "(achado 46)" | `review.md` apagado (o próprio plan:18 registra); o número nu do 118 também aponta para arquivo morto | citar o fato, não o número |
| B2 | `plan.md:270` "modo `'selection'` existe exatamente para escolha pelo usuário final (D0.5/R18)" | D0.5 foi **revertida** por R18 (`spec.md:1003-1011`) — a citação composta confunde | "(R18)" apenas |
| B3 | `plan.md:299` "saem no corte de **2026-08-24**" | o corte é de **2026-08-23** (`spec.md:613`; `plan.md:528`) | trocar a data |
| B4 | `spec.md:726` "R6.1 e **R16-R24** vieram das rodadas de 2026-08-24" | R16 (`spec.md:1029`) e R17 (`spec.md:1040`) são datados **2026-08-23**; e a metadata (`spec.md:4`) diz "R18-R24" — as duas linhas do spec divergem entre si | "R6.1 e R18-R24 vieram de 2026-08-24; R16-R17, da Fase 2 (2026-08-23)" |
| B5 | `plan.md:583` "`PROFILE_CONTACT_CHANNELS`, **se ampliar** para 7 canais" | decisão tomada 2026-08-24 (`spec.md:911`) | "para ampliar o perfil aos 7 canais (R12, decidido)" |
| B6 | `spec.md:264` "Os '**7 campos sem consumidor**' do §Gap 6" | o §Gap 6 não usa esse rótulo (a lista de payload tem 10+ itens, `spec.md:211-214`); os 7 são a tabela do **§Gap 11** | citar §Gap 11 ou nomear os 7 |
| B7 | `spec.md:956` "os quatro do **primeiro grupo**" | no §Gap 11 o grupo dos 4 é o **Grupo 2** (`spec.md:280-281`); o Grupo 1 é o descartado (`spec.md:276`) | "os quatro do Grupo 2" |
| B8 | `spec.md:606` "par invertido **do par invertido**"; `spec.md:635` "o par invertido … (**o par invertido**)" | frase dobrada, sobra de edição | "o par invertido `synopsis`×`synopsis_narrative`" |
| B9 | `spec.md:605` "**Quatro** campos com 0–1 preenchimento … ocupam editor markdown" | a tabela tem **5** campos 0-1; a conta só fecha porque `table_gm_bio` não tem editor (explicado só para a conta 9×10, `spec.md:583-585`) | "Quatro dos cinco campos 0–1 ocupam editor" |
| B10 | `spec.md:751` "com a frase que diz o ganho" | a frase da faixa etária não está definida; a T4.0s resolve como "redação é do implementador" (`tasks.md:512-513`) mas o spec não reflete | alinhar ao T4.0s ("redação do implementador, padrão R6") |
| B11 | `plan.md:602-603` "aceitar/remover campos hoje descartados — … `price_frequency`, …" | o spec **nunca decide** o destino do campo (medição em `spec.md:212`; ausente do §Gap 11 e da T7.2); R7 exige consumir ou descartar com registro | registrar a decisão no §Gap 11 (seção 6) ou retirar da lista até decidir |
| B12 | `spec.md:683` (célula do título repete "84 caracteres" e "backend aceita 200" duas vezes) + `spec.md:704` (3ª repetição da decisão) | mesma decisão contada 3× | condensar a célula e fazer a linha 704 apontar |
| B13 | `spec.md:690` "(`auditoria.md`, bloco de duplicação 4)" | a auditoria.md atual não tem esse bloco — a rodada anterior foi sobrescrita | citar sem número de bloco |
| B14 | `tasks.md:354-356` (T4.0f) e `plan.md:315` | "`slots_per_session` … omitidos quando vazios" como regra a **preservar** — o campo é **removido** por R20/A23/T4.0u (`spec.md:988`; `tasks.md:279-280`) | preservar só `notes` (que sobrevive para "horário personalizado") |
| B15 | `spec.md:944` (título do R23) "local só em mesa **presencial**" | o corpo do R23 (`spec.md:950-951`), o A26 (`spec.md:1088`) e a T4.0w (`tasks.md:293-295`) dizem "**não for online**" (= presencial E híbrida) | "só em modalidade não-online" |
| B16 | `tasks.md:715` — T4.0x vive sob "Fase 7", com nome de Fase 4 | o trabalho é no **editor** (Fase 4); nenhuma nota explica por que executa na 7 | uma frase: "executa na Fase 7 por ser redundância (R8); o editor fecha com esta task" |
| B17 | `tasks.md:41` "Resta o destino das colunas → T7.3b" | T7.3b já está `[x]` decidido (`tasks.md:728-737`: colunas ficam; resta só registrar o débito quando o mantenedor nomear destino — TN.5 cobre) | riscar a meia-frase |
| B18 | `spec.md:885-887` "não medi se há restrição adicional nessa rota" | a T4.0r **mediu**: a restrição existe e são três pontos (`tasks.md:500-509`) | apontar para T4.0r |
| B19 | `spec.md:59` "Onde morar a regra … é decisão do grill" | o grill decidiu: colunas em `vtt_platforms`/`communication_platforms` por migration (`plan.md:473-478`; "Resolvidas na Fase 2") | apontar para `plan.md` §Regras VTT |
| B20 | `spec.md:541` (fluxo do §Gap 9, item 4) | fala só dos aliases "do nó selecionado"; a reversão (aliases **nas opções**) está no parágrafo seguinte (`spec.md:570-573`) | acrescentar "e nas opções, conforme a reversão abaixo" |
| B21 | `tasks.md:207-217` (T4.0a) | `SystemPicker` e `ContactsFormBlock` aparecem na exceção "exceto dois" **e** na lista "Os demais" (residual do B13 da 3ª rodada) | retirar os dois da lista dos demais |
| B22 | `tasks.md:687` "família `system-suggestions` duplicada … (pendente da investigação do catálogo central)" | decidido: T7.1b (mesas consome `catalog-matching`); fila central = spec 062, fora da 096 (pendências, `tasks.md:44`) | apontar para T7.1b |

---

## 4. O que confere (verificado nesta rodada — não reabrir)

- **Os 3 CRÍTICOS da 3ª rodada corrigidos e re-verificados:** R18 reescrito como "variante
  de apresentação, nada é substituído" (`spec.md:994-1028`); §Gap 9 com a reversão da D0.5
  e a correção do "não há nada a construir" (`spec.md:495-498, 570-573`); R12 com a medição
  corrigida dos 7 canais (`spec.md:868-875`) e T4.0r com os três pontos
  (`tasks.md:500-509`).
- **"13 capacidades" consistente nos 4 pontos** (`spec.md:318`, R19:973, A22:1084,
  T4.0t:226) com a tabela de 13 linhas (`spec.md:321-335`).
- **T4.0h-bis reescrita com o alvo final**, sem correção anexada (`tasks.md:357-399`);
  T4.0h marcada superada (`tasks.md:420-426`); T4.0h-ter com "o pacote É tocado … variante
  de apresentação" (`tasks.md:413-416`).
- **A21 com critério positivo dos aliases nas opções** (`spec.md:1083`); impacto no catálogo
  (reversão vale nos dois) registrado em `plan.md:614-619` e R18 (`spec.md:1007-1011`).
- **Perguntas abertas do plan todas riscadas/decididas** (`plan.md:521-556`); avatar riscado
  na paridade (`plan.md:344`); "cenário com 2 significados" na tabela de pendências
  (`tasks.md:38`).
- **Gates corrigidos da 3ª rodada:** T3.5 com R24/A27 (`tasks.md:198-200`); T6.4 restrita a
  `preferred_vtt_platforms`/`languages` (`tasks.md:653-655`); T4.0k com cabeçalho de fase
  (`tasks.md:553-554` — ressalva A4).
- **Números cruzados que batem:** 57 imported com faixa (+14:2/+16:13/+18:42;
  `spec.md:936-937` = `plan.md:108`); 12 itens na Entra 08-23 (`spec.md:672-685` = T2.3);
  66/62 notificações (`spec.md:205` = `plan.md:111` = `tasks.md:558`); 503.907/423 bytes
  (`spec.md:522-524` = `tasks.md:398-399`); 1.474 linhas (`spec.md:121-124` = `plan.md:562`);
  90 schedules / 0 mesas com 2+ (`spec.md:451-452` = `plan.md:110` = `tasks.md:267`);
  510/690 e 72 edições (`spec.md:545-547` = `tasks.md:363`); aliases 199/409
  (`spec.md:508` = `tasks.md:418-419`); "5 de 10" idêntico em todos os pontos que repetem
  (hoje coerentes — ressalva M4).
- **Referências a arquivos deletados:** `decisoes-medidas.md` — zero ocorrências nos 3
  arquivos (grep); "achado 4" do §Gap 8 — zero (grep). Sobram só as de `review.md` (B1).
- **Working tree:** inventário com dois donos bate com o `git status` real
  (`plan.md:120-135` = pendência `tasks.md:45`); `ogDescription.ts` marcado como "não existe
  em `origin/dev`" (`spec.md:649-650`) — confere com o arquivo não rastreado.
- **Referências de código conferidas no repositório:** `styles.css:1008-1058`
  (`spec.md:238`); `imageKinds.ts:95-97` com `minWidth: 600`/`minHeight: 325` e o comentário
  da proporção; `main.tsx:8` consumindo `styles.css` (`spec.md:244`).
- **"Sincronizar com o Perfil Principal de Mestre"** com texto exato nos 3 pontos
  (`spec.md:894`, `tasks.md:517-518`, A20 `spec.md:1082`).
- **Correções pontuais da 3ª rodada aplicadas:** `aria-invalid` atribuído aos controles
  (`tasks.md:429-431`); `CreateTableForm.tsx:402` com aviso de conferir a linha
  (`tasks.md:176`); A17 "5 editores" no lugar de "< 9" (`plan.md:660`); Entra sem repetir a
  contagem (`spec.md:685, 694`); eventos do R15 com os 4 no plan (`plan.md:268`).

---

## 5. Correções propostas (não aplicadas)

**`spec.md`:**
1. §Gap 10: alinhar "piso 600 × 325 (cobre o mínimo social 600×315 mantendo a proporção)"
   na linha 405 (M1); §Gap 6 linha 202: remover "com múltiplos horários" (A3); linha 41:
   riscar "continuam abertas" (A6); linha 59: apontar para plan §Regras VTT (B19).
2. R23: título "presencial" → "não-online" (B15); linha 956: "Grupo 2" (B7); linhas 885-887:
   apontar para T4.0r (B18); linhas 832-834: nota "(hoje 4; T4.0r amplia)" (A5).
3. §Gap 8: linhas 615-617, ajustar a declaração de fonte única (M4); linha 606/635: limpar
   o "par invertido do par invertido" (B8); linha 605: "quatro dos cinco" (B9).
4. Metadata: linha 726 alinhar à linha 4 (B4); linha 264: citar §Gap 11 (B6); linha 690:
   remover "bloco de duplicação 4" (B13); linha 683/704: condensar o título (B12); linha
   751: alinhar a frase do ganho ao T4.0s (B10); linha 541: item 4 do fluxo com "e nas
   opções" (B20).
5. Entra 08-24: acrescentar linha do agrupamento das 7 partes (A6); decidir `price_frequency`
   (B11, seção 6).

**`plan.md`:**
6. Linhas 129 e 576: decisão nova do commit do media (A1); linha 110: remover "com
   múltiplos horários" (A3); linhas 405-409: nota "(hoje 4; T4.0r amplia)" (A5).
7. Linhas 266/118: limpar refs ao `review.md` (B1); linha 270: "(R18)" (B2); linha 299:
   data do corte (B3); linha 583: "se ampliar" → decidido (B5); linha 602-603:
   `price_frequency` (B11); linha 315: `slots_per_session` (B14).
8. Tabela de validação: completar A12-A15 e A19-A27 ou declarar o critério (M2).

**`tasks.md`:**
9. T4.9: acrescentar R13 e R15 (A2); T4.0k corpo linha 558: remover a meia-frase de
   notificações (A4); T4.0p linha 471-472: nota "(hoje 4; T4.0r amplia)" (A5).
10. T3.2d: resolver o "ou" do `slots_filled` (M3, seção 6); T4.0f: `slots_per_session`
    (B14); T4.0a: retirar os dois excetuados da lista dos demais (B21).
11. T4.0x: nota de por que executa na Fase 7 (B16); pendência linha 41: riscar "Resta o
    destino" (B17); T7.2 linha 687: apontar para T7.1b (B22).

---

## 6. Perguntas que precisam do mantenedor

1. **Editor de horário único × mesa legada com 2+ horários** (A3): o A7 garante preservação
   pelo mapper, mas o que a tela mostra ao abrir uma mesa com 2+ `table_schedules`?
   Medido: produção tem **0 casos**; o parser pode criar vários. Opções medidas: (a) exibir
   só o primeiro e preservar os demais invisíveis (mais simples; A7 já prova a preservação);
   (b) exibir todos como lista read-only com aviso; (c) bloquear edição com aviso.
   Recomendação: (a).
2. **`slots_filled`** (M3): a T3.2d deixa "dar escritor ou deixar de lê-lo" em aberto.
   Opções: (a) gravar/derivar no fluxo manual (mantém a semântica única do campo, parser e
   manual juntos); (b) parar de lê-lo no painel/WhatsApp e usar vagas totais − abertas.
   Recomendação: (a).
3. **`price_frequency`** (B11): destino nunca decidido (1 mesa imported, valor 'sessao';
   nenhum leitor). Consumir no editor ou descartar com registro no §Gap 11? Recomendação:
   descartar — o R20 mudou o modelo de horário e nenhum consumidor existe.
