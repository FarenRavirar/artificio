# Tasks — 096

**Modelo de entrega:** uma fase por PR (spec grande, múltiplas frentes). Cada fase fecha
sozinha: código + teste + verde local, PR contra `dev`, bots revisam, achados analisados
na documentação, então a fase seguinte começa.

Fluxo de 4 etapas definido pelo mantenedor (2026-08-23):
1. **Levantamento inicial** (orquestrador) — Fase 0 ✅ concluída.
2. **Conferência externa (Claude)** — Fase 1, aguarda o mantenedor trazer o resultado.
3. **Protótipos/fluxos + pesquisa de mercado + grill** — Fase 2 ✅ concluída.
4. **Implementação** (orquestrador) — Fases 3 a 7, desenhadas abaixo.

**Ordem das fases 3-7 é deliberada:** os bugs de perda de dado vêm primeiro (já causam
dano hoje, e o editor depende dos mappers corretos); o editor vem antes das regras de VTT
e do parser porque os dois desembocam nele. A Fase 1 pode entrar a qualquer momento — não
bloqueia a 3.

## 🔁 Gate de fase (obrigatório, penúltima task de TODA fase)

Cada fase termina com uma task **🔁 GATE DE FASE** antes do PR: reler os requisitos e as
seções **nomeados** da `spec.md`/`plan.md` e conferir a implementação contra eles, item por
item. Existe porque `tasks.md` é resumo e quem implementa tende a ficar preso na checklist.

- Divergência → corrigir antes do PR; se a dúvida é se a spec está errada,
  **perguntar ao mantenedor**.
- **Nunca** seguir o `tasks.md` contra a `spec.md`/`plan.md` em silêncio.
- **Nunca** fechar fase com requisito não atendido nem "atendido em parte".
- Débito descoberto que toca o frontend/backend do escopo **é resolvido nesta spec**; o
  agente não decide adiar — na dúvida, pergunta.

## Pendências técnicas nomeadas (não bloqueiam começar, bloqueiam fechar)

| Onde | O que falta perguntar/decidir |
|---|---|
| ~~Fase 2~~ | ~~Agrupamento das 7 partes~~ — **APROVADO em 2026-08-24** pelo mantenedor, com o artefato de validação à vista: *"'Para quem é' tem 6 campos; 'Regras e extras' tem 12, está ok"*. A assimetria é aceita: os 12 incluem o bloco DDAL, que só aparece em D&D 5e. Ajustes decididos na mesma passagem viraram R19-R21 (§Gap 10) |
| ~~Fase 2~~ | ~~Prévia do card na lateral~~ — **DECIDIDO 2026-08-24: é informação útil**, junto com o modo **"Ver como jogador"**. O mestre confere o que publica sem sair do editor → R22, T4.2b |
| ~~Gap 6~~ | ~~Par "Meet" × "Google Meet"~~ — **investigado 2026-08-24, caminho medido:** `communication_platform_aliases` **já registra "Meet" como alias de "Google Meet"** — a linha própria de "Meet" (`slug=meet`) é a duplicata a eliminar. Uso: **"Meet" 1 mesa, "Google Meet" 0**. Caminho: repontar a mesa para `google-meet` e remover a linha `meet` (o alias já cobre quem digitar "Meet"). **Exige `UPDATE`+`DELETE` em produção → aprovação nominal por ação** (§Autorização) → T7.1 |
| ~~Gap 6~~ | ~~Cenário com 2 significados~~ — **RESOLVIDO POR MEDIÇÃO (2026-08-24): não é duplicação, são dois conceitos.** `scenario_id` é **nó do catálogo central** (Forgotten Realms, Ravenloft — reutilizável entre sistemas, com sugestão e aprovação); `setting_name` é **texto livre** da ambientação própria da mesa. Produção: **19** mesas com `scenario_id`, **15** com `setting_name`, e apenas **3** com os dois — se fossem o mesmo conceito, a sobreposição seria alta. O que confunde é o rótulo: "Cenário" no StepSystem (`:73`) e "Ambientação" no StepFinal (`:506`), em etapas distantes. **Correção no editor: os dois ficam na MESMA parte**, com o de catálogo primeiro e o livre logo abaixo, rotulado de forma a deixar claro que é para quando o cenário não está no catálogo. Sem remoção de campo. → T4.0x |
| ~~Gap 6~~ | ~~Destino nominal dos campos sem consumidor~~ — **DECIDIDO 2026-08-24** (R23, §Gap 11): `content_warnings`/`safety_tools` **entram** com os termos do glossário; `city`/`state` **entram, condicionados a modalidade não-online**; `custom_scenario`/`style_tags`/`features` **descartados**. Medição que separou os grupos: os 4 primeiros já têm validator+mapper+exibição prontos; os 3 últimos não têm nem validator → T4.0w |
| ~~Gap 6~~ | Exibição de `rules_notes` — **DECIDIDO (2026-08-23): seção "Regras da Mesa" na MesaPage** (opção A) → T7.2b |
| Gap 6 | Par `synopsis` × `synopsis_narrative` — ~~opção A (rebind)~~ **SUPERADO no mesmo dia: os dois campos saem do editor** (`spec.md` §Gap 8) → T4.0m; T3.2e cancelada. Destino das colunas também decidido (ficam no banco) → T7.3b |
| ~~Gap 6~~ | `gm_avatar_url` — **DECIDIDO (2026-08-23): remover do contrato do form** (opção C) → T3.2c |
| ~~Gap 6~~ | `featured` — **DECIDIDO (2026-08-23): toggle admin** (opção A) → T7.2c |
| ~~Gap 6~~ | Família `system-suggestions` — **DECIDIDO (2026-08-23): (c) consumir `catalog-matching`** → T7.1b; fila única central = alvo da spec 062 (fora da 096) |
| Fase 3/4 | **Diff não commitado tem DOIS donos** (inventário completo, 2ª auditoria). **Frente OG:** `og.ts`, `syncHelpers.ts`, `parseDiscordAnnouncement.ts` (+teste), `tableValidators.ts`, `MestrePage.tsx`, `ogDescription.ts` (novo), `packages/content/*` (+`description.ts` novo), e os apps `downloads`/`glossario`/`links`. **Spec 096:** `packages/media/src/imageKinds.ts` (+teste) — R19/§Gap 10. **DECIDIDO 2026-08-24: entra no PRÓXIMO commit**, junto com o diff OG — não espera o 1º PR da spec. Resolve o C2 da 2ª auditoria: enquanto não commitado, `imageKindHint` não existe em `origin/dev` e a T4.0t-bis falharia no primeiro import. **Ambíguo, decidido ficar no OG:** o fix DDAL (`tableService.ts`, `CreateTableForm.tsx`) — separar = retrabalho, `--amend` proibido. **Bloqueia:** a Fase 4 depende do merge do OG, ou refaz a correção (T4.0b) |
| ~~Fase 3~~ | ~~R9 toca `packages/ui` → aprovação nominal~~ — **resolvido em 2026-08-23:** o `color-scheme` já está no pacote desde `3ae4f6b` (2026-08-17); nada a editar, trava cai (T3.4) |
| ~~Fase 4~~ | ~~Quais campos de texto grande sobrevivem~~ — **DECIDIDO 2026-08-23:** ficam **5 de 10**; saem as duas sinopses, `style_text`, `listing_excerpt` e `benefits_text`; regras sobem para baixo da descrição (`spec.md` §Gap 8 → T4.0m, T4.0o) |
| ~~Fase 7~~ | ~~Colunas removidas saem do banco?~~ — **DECIDIDO 2026-08-23: ficam.** Só a UI sai; remoção das colunas vira **débito** (T7.3b). Sem migration nesta spec |
| ~~Fase 4~~ | ~~`benefits_text` sem decisão~~ — **DECIDIDO 2026-08-23: removido** junto com os demais (T4.0m) |
| ~~Fase 4~~ | ~~Aprovação para tocar `ui/primitives` no A2~~ — **AUTORIZADO em 2026-08-24**, junto com os demais pacotes compartilhados do escopo (`spec.md` §Autorização de escopo). Commit/push/PR/deploy continuam exigindo aprovação por ação |

**Resolvidas na Fase 2** (registro para não reabrir): modelo da tela (editor de anúncio,
não wizard/gaveta/rolagem) · criar e editar na mesma tela · rascunho no backend + autosave
· `age_rating`/`table_level` sem backfill · parser sinaliza mas não barra · regras VTT em
colunas de catálogo, não mapa em código · `OnboardingPage` fora do escopo · Gap 3 encerrado
por conferência. Detalhe em `spec.md` §Decisões de escopo.

---

## Fase 0 — Levantamento inicial (orquestrador, read-only) — CONCLUÍDA 2026-08-23

- [x] T0.1 — Mapear fluxo de criação atual. **Feito:** tabela de campos por etapa em
      `plan.md` §Gap 1 (subagente A: 6 steps, validações em `validation.ts`, navegação
      `useStepNavigation.ts:19-45`). Corrigiu premissa: `OnboardingPage` é preferências de
      usuário, não o wizard de mesa. · atende R1, R6, R8 (base para redesign)
- [x] T0.2 — Mapear fluxo de edição. **Feito:** `PainelMestrePage.tsx:394-408` reutiliza
      100% do form; `step=1`/`maxStepUnlocked=1` sempre; botão "Publicar Mesa" na edição;
      única diferença funcional é PUT vs POST (`useCreateTableForm.ts:253-264`).
      · atende R2
- [x] T0.3 — Diagnosticar bug do preço (55/40 → 39,96). **Encerrado por conferência do
      mantenedor (2026-08-23):** conferiu 3×, campo de edição mostra 40; nenhuma fórmula
      no código gera 39,96 de 55/40 (economia é só %, 27%, correta); candidato
      learning-store descartado por medição no banco de produção (nenhuma regra de
      `price_value`); testes existentes 19/19+25/25+27/27 verdes. Permanece teste de
      regressão (R4). · atende R4
- [x] T0.4 — Auditar parser "colar anúncio". **Feito:** 8 falhas medidas com
      arquivo:linha (`plan.md` §Gap 4), experimento `tsx` com anúncio sintético;
      capacidades existentes não ligadas (catálogos VTT/comunicação/cenário, aliases
      aprendidos). Testes 8/8 e 5/5 verdes. · atende R5
- [x] T0.5 — Inventariar backend × frontend. **Aprofundado em 2 rodadas + banco de
      produção (read-only):** perda silenciosa de `age_rating`/`table_level` (UI coleta,
      payload descarta, banco grava default — 41 manuais 100% 'livre'/'todos'); **2 bugs
      de edição** (mesa Covil desmarcada — 2 mesas em produção; horários múltiplos
      colapsam); notificações órfãs (66/62 não lidas); ~40 rotas reclassificadas
      (valiosa/duplicada/admin/morta); payload descartado em rotas consumidas;
      capacidades prontas para o editor. Tudo em `plan.md` §Gap 6. · atende R7
- [x] T0.6 — Inventariar requisitos PC/mic/câmera por VTT. **Feito:** colunas por mesa já
      existem (`migration_11:32-35`) mas UI só no colapsável do StepFinal; **nenhuma
      estrutura de requisitos por VTT** (grep = 0); 10 VTTs + 5 comunicações canônicos.
      · atende R3
- [x] T0.7 — 🔁 **GATE DE FASE — cruzar levantamento com `spec.md` §Problema.** Os 6 gaps
      com evidência arquivo:linha no `plan.md`; premissa do Gap 1 corrigida na própria
      spec; pergunta aberta do Gap 3 registrada como bloqueante (não como conclusão);
      colisão de working tree medida (`rtk git status --short`).
- [x] T0.8 — Consolidar resumo da etapa 1 para o mantenedor levar à conferência externa
      (Claude): entregue na mensagem final do orquestrador desta fase (fatos medidos +
      perguntas abertas).
- [x] T0.9 — **Auditoria interna contra o código (subagente revisor, autorizada pelo
      mantenedor 2026-08-23).** Resultado: **aprovado com ressalvas** — 7 divergências,
      todas documentais (soma de linhas 2.438→1.474; mecanismo da Falha 6 do Gap 4
      corrigido — sinais de ambiguidade chegam no payload, o front é que não lê; 5
      deslocamentos de citação de linha). **Nenhum número de produção divergiu**
      (24/24 revalidados via psql read-only). Correções aplicadas em `spec.md`/`plan.md`.

## Fase 1 — Conferência externa (Claude) · sem código

- [ ] T1.1 — Registrar o resultado da conferência do Claude trazido pelo mantenedor **no
      destino que ele nomear** (`reviews.md` foi aposentado — não usar). Destino provável:
      `plan.md` (apontamentos aplicados ou justificados) + `tasks.md` (novas tasks).
- [ ] T1.2 — Aplicar correções/apontamentos ao levantamento (`plan.md`, `spec.md` se
      necessário), marcando o que mudou e por quê.
- [ ] T1.3 — 🔁 **GATE DE FASE — cruzar com `spec.md` §Problema e `plan.md`.** Nenhuma
      correção da conferência perdida; cada apontamento com destino registrado (aplicado
      ou justificado).

## Fase 2 — Pesquisa de mercado + protótipo + grill · sem código — CONCLUÍDA 2026-08-23

- [x] T2.1 — Pesquisar melhores práticas com fonte citada. **Feito:** tabela em `plan.md`
      §Pesquisa de mercado — captura do **produto real** do Airbnb Listing Editor
      (comunidade oficial), estudo de usabilidade do fluxo de anúncio (3/5 não percebem
      rolagem; 3/5 não acham o campo com erro), Baymard (largura por conteúdo; 32%
      erram obrigatório quando só um lado é marcado), NN/g (proximidade; wizard é errado
      para edição), PatternFly (não usar inline-edit quando editar é a função primária).
      Descartado com evidência: Formstack multi-step, que mede formulário de captação.
- [x] T2.2 — Protótipo navegável, **4 rodadas**, cada uma rejeitada pelo mantenedor com o
      motivo registrado: (1) três formas lado a lado → "não pode ter barra de rolagem";
      (2) seções que cabem → "virou onboarding com sidebar, mudou nada"; (3) cartões do
      anúncio → "clicar para editar é onboard travestido"; (4) **editor de anúncio com
      campos sempre abertos → aceito como modelo**. O que cada rejeição fixou está em
      `spec.md` §Decisões de escopo.
- [x] T2.3 — Grill com o mantenedor. Decisões em `spec.md` §Entra — **12 itens** de 2026-08-23, mais a tabela §Entra de 2026-08-24.
- [x] T2.4 — **Inventário de features do form atual** (feito porque a rodada 3 do
      protótipo esquecera features existentes — cobrança do mantenedor). Medido em
      `StepBasic/StepConfig/StepFinal/StepSessions/SessionRepeater/validation.ts`:
      contador de 5.000 com toolbar, campos condicionais, limpeza de campo invisível que
      evita 400, "✏️ Personalizado", cards de rádio, catálogos por API com loading/erro,
      DDAL, semáforo de faixa etária. Tabela em `plan.md` §Frontend — paridade de features.
- [x] T2.5 — **Revisão do protótipo em navegador** (não só publicar). Bugs próprios
      achados e corrigidos: desalinho de até 26px em 4 das 7 partes → 0px; lateral não
      renderizada; navegação morta (lista recriada a cada tecla matava o clique);
      "Publicar" inerte por `disabled`; ~370px de vazio; rótulos cortados.
- [x] T2.6 — **Achado lateral: Gap 7** (`<select>` ilegível no escuro). Causa correta (a
      lista nativa não obedece a CSS da página; só `color-scheme` a alcança), **mas a
      medição estava errada**: registrou "`color-scheme` inexistente no repositório" quando
      o contrato já vivia em `packages/ui/src/styles.css:1008-1058` desde `3ae4f6b`
      (2026-08-17). Corrigido em 2026-08-23 — R9 vira "não regredir", T3.4 fecha sem código.
- [x] T2.7 — 🔁 **GATE DE FASE — cruzar com `spec.md`.** R1-R8 reescritos, R9 e R10
      criados, critérios de aceite A1-A11 objetivos, fora de escopo fechado. Perguntas sem
      resposta ficaram na tabela de pendências com dono — nenhuma virou decisão inferida.

## Fase 3 — Correções de perda de dado · PR próprio

Vem antes do editor de propósito: são bugs que já causam dano hoje, e o editor novo
depende de os dois mappers estarem certos.

**`packages/ui` saiu do título desta fase (2026-08-23):** o único item que a tocava era o
`color-scheme` (T3.4), já implementado no pacote desde `3ae4f6b`. A fase é agora só de
correção de dado — sem pacote compartilhado, sem aprovação nominal pendente.

- [ ] T3.1 — `mapTableApiToInitialData.ts`: ler `is_covil` (não `is_covil_mesa`) e
      `schedules` (não `sessions`). Teste com resposta real da API. · A6, A7
- [ ] T3.2 — `tableValidators.ts` + `mapper.ts`: aceitar e enviar `age_rating` e
      `table_level`. **Sem backfill** nas 41 mesas (decisão registrada). · A5
- [ ] T3.2f — **Exibir faixa etária na página da mesa e no card** (R24, A27 — decidido
      2026-08-24). Corrigir o payload (T3.2) não basta: **57 mesas importadas já têm faixa
      real** (+14: 2, +16: 13, +18: 42) e nenhuma aparece. Exibir corrige essas 57 **sem
      nenhum mestre editar nada**. Toca `features/table` e `features/catalog` — fora do
      editor, exceção nomeada em §Fora de escopo. Cuidar para mesa `livre` legítima não
      ganhar selo ruidoso.
- [x] T3.2b — ~~Alinhar o par sinopse~~ **RESOLVIDO POR REMOÇÃO (2026-08-23).** O mantenedor
      decidiu remover **as duas** sinopses do editor (`synopsis` 1/107, `synopsis_narrative`
      0/107). Não há mais o que alinhar: sem editor, não há coluna certa ou errada. Passa a
      T4.0o. · `spec.md` §Gap 8
- [ ] T3.2c — `gm_avatar_url`: **remover do contrato do form** (decidido 2026-08-23, opção
      C): apagar estado/props (`useCreateTableForm.ts:113-116`, `StepFinal.tsx:44-47`),
      passagem (`CreateTableForm.tsx` — conferir a linha ao editar: o diff OG deslocou o trecho para `:402`), `mapper.ts:133`, tipos
      (`createTable.types.ts:82,147`), `mapTableApiToInitialData.ts:142`,
      `tableValidators.ts:201`, fixture `mapper.test.ts:58`. A resposta da API (alias
      computado) continua. 
- [ ] T3.2d — `slots_filled`: **DAR ESCRITOR ao fluxo manual** (decidido por medição em
      2026-08-24). Produção: **19 das 66** mesas importadas têm valor; **0 das 42** manuais —
      o campo funciona, só nunca é escrito fora do parser. Parar de lê-lo perderia o dado
      real das 19; dar escritor conserta as 42. **Execução aqui (Fase 3); a menção em T7.2 é
      só inventário, não reabre a decisão.** O sintoma: painel e WhatsApp hoje contam
      vagas erradas — leem campo que só o parser escreve) ou deixar de lê-lo. 
- [x] T3.2e — ~~Rebindar o editor de sinopse para `synopsis_narrative`~~ **CANCELADA — SEM
      OBJETO (2026-08-23).** A decisão da opção A (rebind) foi **substituída** pela decisão
      do mantenedor de **remover as duas sinopses**. Rebindar um campo que vai ser apagado é
      trabalho jogado fora. O par invertido (editor gravava `synopsis`, página lia `synopsis_narrative`) fecha por remoção, não
      por correção de binding. Substituída por T4.0o. · `spec.md` §Gap 8
- [ ] T3.3 — Teste de regressão do preço 55/40. · A8
- [x] T3.4 — ~~`packages/ui`: `color-scheme`~~ **SEM TRABALHO A FAZER (medido 2026-08-23).**
      O contrato já existe em `packages/ui/src/styles.css:1008-1058` desde `3ae4f6b`
      (2026-08-17), e o `mesas` já consome (`main.tsx:8`; o `index.css:111-113,241` do app
      documenta a remoção da versão local). O registro da Fase 2 ("zero ocorrências") estava
      errado. **A aprovação nominal que esta task exigia deixa de ser pré-requisito da
      Fase 3.** Sobra só A10 como conferência visual do mantenedor. · `spec.md` §Gap 7
- [ ] T3.4b — **`confirm()` nativo → `useConfirm`** no painel do mestre (arquivar,
      desarquivar, ativar, desativar, deletar). O design system já exporta
      `ConfirmDialog`/`useConfirm`/`ConfirmProvider`; o painel usa o do navegador.
      Achado da auditoria de pacotes — conserto, não pergunta (AGENTS.md).
- [ ] T3.5 — 🔁 **GATE DE FASE** — reler `spec.md` §Gap 6, §Gap 7, **§Gap 8** e A5-A8, A10,
      **mais R24/A27** (faixa etária visível — T3.2f é desta fase e o gate não a listava:
      achado A7 da 3ª auditoria).
- [ ] T3.6 — Validação do pacote afetado + `pnpm verify:api`; PR contra `dev`.

## Fase 4 — Editor de anúncio (frontend) · PR próprio

- [ ] T4.0 — **Cruzar a tabela de paridade** (`plan.md` §Frontend — paridade de features)
      linha a linha antes de escrever. Feature não migrada = task reaberta. · A12
- [ ] T4.0a — Componentes ricos preservados, **não reescritos como input simples** —
      **exceto dois, que outras tasks desta mesma fase substituem** (M2 da 2ª auditoria):
      `ContactsFormBlock` → base passa a ser o `ContactMethodsEditor` (**T4.0r**), e o fluxo
      de `SystemPicker` → o **wrapper permanece**, o **fluxo** muda conforme **T4.0h-bis**. Os demais:
      `SystemPicker` (árvore hierárquica), `SystemSuggestionModal` (3 níveis
      sistema→edição→variante, cadeia encadeada, caminho de admin), `ScenarioSelector`
      (busca com normalização de acento) + `ScenarioSuggestionModal`,
      `SettingStylesField` (sugestão de estilos pelo nome do
      cenário), `MarkdownEditor` **nos campos que sobrevivem ao corte** — 5, ver T4.0m (o registro antigo
      dizia 7; a contagem real do fluxo atual é 9).
- [x] T4.0a-bis — ~~Sistema de imagem inteiro~~ **FUNDIDA EM T4.0t (2026-08-24).** Era a
      mesma task, escrita duas vezes com uma contradição no meio: pedia **"mais o avatar do
      mestre (`gmAvatarUrl`)"**, campo que **T3.2c manda REMOVER do contrato** (decisão de
      2026-08-23, opção C — o campo não tem UI e a resposta da API é alias computado). As
      duas se cancelavam. A lista de capacidades vive agora só em T4.0t, com a tabela de
      §Gap 10 como fonte. Achado crítico 2 da auditoria de 2026-08-24 (`auditoria.md`).
- [ ] T4.0t — **Banner abaixo do título + sistema de imagem sem regressão** (R19, A22).
      Posição: logo depois do título da mesa, na parte Identidade — hoje abre o `StepFinal`
      (`:156-175`), a quatro etapas do título. **As 13 capacidades migram** (a 13ª é `aria-live`/`role="alert"` — acessibilidade, a mais fácil de esquecer no gate), conferidas uma a
      uma (`spec.md` §Gap 10 item 2): upload local (44px), URL manual, importar link externo
      (`POST /upload/url`), "Manter link direto" com tooltip, editor de recorte
      (`@artificio/image-editor`), crop não destrutivo, "Ajustar enquadramento" sem reenviar,
      upload antes do crop, invalidação de crop+dimensões ao trocar de imagem, validação por
      `kind` (`imageKindSpec`, mesma do backend), prévia com placeholder e rótulo
      personalizado × padrão, remover, `aria-live`/`role="alert"`.
      **Motivo de existir como task própria:** o mantenedor apontou regressão aqui pela
      segunda vez na spec; tratar "banner" como campo simples é o erro recorrente.
- [ ] T4.0t-bis — **Legenda que faz o mestre prever o resultado** (R19, A22 — pedido de
      2026-08-24). Hoje a UI diz só *"JPG, PNG ou WEBP até 5 MB"* (`ImageUploader.tsx:191`)
      e **omite a proporção**, que é o que determina o enquadramento: o mestre envia imagem
      quadrada, ela entra num 1200/650 e ele descobre o corte depois.
      **Exibir:** proporção **1200 × 650**, formatos **JPG/PNG/WEBP**, limite **5 MB** — e
      uma prévia do enquadramento antes do envio, se couber no layout.
      **Valores vêm do `imageKindSpec`** (`packages/media/src/imageKinds.ts:46-53`), nunca
      de literal — o repo já teve telas com limites divergentes para o mesmo endpoint
      (`useImageUpload.ts:9-12` registra o `AvatarUploader` de 2 MB como bug de contrato).
      **Tamanho mínimo — no pacote desde 2026-08-24; entra no PRÓXIMO commit** (decisão do
      mantenedor; até lá `git grep minWidth origin/dev` → zero):
      `imageKindSpec` ganhou `recommendedWidth/Height`, `minWidth/Height` e
      `acceptedMimeTypes`, mais o helper `imageKindHint(kind)` que monta a frase. A task
      agora é **consumir** o helper no editor, não decidir os valores. Testes do pacote
      72/72; `tsc` limpo em `packages/media` + mesas front/back.
      **Recomendado 1200 × 650, piso 600 × 325.** Não é preferência: o
      banner **vira `og:image`** (`og.ts:238`), declarado como **1200 × 630** (`:75-76`), e
      600 × 315 é o piso das plataformas sociais (Discord, WhatsApp, Twitter, Facebook).
      Produção confirma o dano: dos 9 banners com dimensão registrada, **7 estão abaixo de
      1200 px**, mediana **720**, menor **473** — o preview compartilhado sai rebaixado hoje.
      **Não inventar regra, medido:** (a) `minWidth`/`minHeight` **já estão no pacote**
      (acrescentados em 2026-08-24), mas **nenhum validador os consome** — então a legenda
      **orienta sem impor**; transformar em bloqueio é decisão à parte, não suposta aqui; (b) `maxDimension: 1600` com `crop:'limit'` **reduz** a imagem
      maior, não a rejeita (`imageKinds.ts:29-33`) — "máximo 1600 px" seria falso;
      (c) **não prometer transparência**: `fetch_format:"auto"` (`imageKinds.ts:115`) faz o
      Cloudinary entregar WebP/AVIF conforme o navegador.
      **PNG: nada a fazer — cadeia inteira verificada** (a primeira medição parou na
      validação; o mantenedor cobrou o Cloudinary). `ImageUploader.tsx:162` (`accept`),
      `useImageUpload.ts:31`, backend `upload.ts:24`, **Cloudinary sem `allowed_formats`**
      em `services/cloudinary.ts`, **40 banners `.png` em produção**, e `curl` num PNG real
      devolvendo `200` com `content-type: image/png`. **Não há contrato a alterar.**
- [ ] T4.0u — **Um horário só, com "horário personalizado"** (R20, A23). Remover o repeater
      de N horários (medido: **0 mesas** com 2+ em produção, 90 schedules/90 mesas) e a
      opção **"horário personalizado"** abre campo livre onde o mestre explica a agenda.
      **Card do catálogo exibe "Horário Personalizado"** nesse caso — toca
      `features/catalog` além do editor.
      **Contrato definido por investigação em 2026-08-24 (sem coluna nem flag nova):**
      marca por `schedule_day_status='to_define'` (enum já existente,
      `tableValidators.ts:162-164`); texto livre em **`table_schedules.notes`** (`text`
      nullable, já existe); `day_of_week`/`start_time` são **`NOT NULL`**, então "sem
      horário" não é representável — o sentinela `'to_define'` já é o do `SessionRepeater`.
      No card, ramo novo em `TableCardSchedule` (`TableCard.tsx:227-240`) antes de montar
      `dayLabel + time`. Consumidores que já leem `schedule_day_status` (WhatsApp, og,
      página da mesa) herdam sem mudança própria.
      **Remover "Vagas por sessão"** (`slots_per_session`): redundante com vagas totais e
      abertas, preenchido em **3 de 90**.
      **Atenção:** a tabela `table_schedules` permanece, então o Bug 2 da edição (T3.1,
      mapper lê `sessions` e backend devolve `schedules`) continua valendo.
      **Mesa legada com 2+ horários — resolvido por medição (2026-08-24):** o caso é
      **estruturalmente possível mas nunca ocorreu**, e não vai ocorrer pelo parser —
      `extractSchedules` (`syncHelpers.ts:292-330`) retorna **0 ou 1** schedule, e produção
      tem **0 mesas** com 2+ em qualquer origem. Comportamento definido: o editor **exibe o
      primeiro** (menor `sort_order`) e **preserva os demais intactos** no banco — nunca
      apaga o que não mostra. É a única opção que não perde dado e não exige UI para um caso
      que não existe. Se algum dia aparecer, o dado continua lá e a página pública o exibe.
- [ ] T4.0w — **Segurança de mesa e local** (R23, A26 — decidido 2026-08-24). **Nada de
      backend novo:** validator, mapper e exibição pública já existem para os quatro campos;
      falta a entrada no editor.
      - **`content_warnings` e `safety_tools`**: oferecer os **14 termos do glossário**
        (`utils/safetyToolsGlossary.ts` — 6 ferramentas: X-Card, Linhas e Véus, Lua e Sol,
        Check-in, Script Change, Open Door; 8 avisos: violência, violência gráfica, terror,
        morte, abuso, temas sexuais, gore, discriminação), com entrada livre para o que
        faltar. **Não usar campo de texto aberto:** as colunas são `text[]` sem enum e o
        glossário casa por chave normalizada — "violencia" sem acento perde a descrição que
        `TableSecurity.tsx` mostra ao jogador.
      - **`city`/`state`**: só aparecem quando a modalidade **não** for online (medido:
        107/107 mesas são online). Precedente no próprio form: VTT e comunicação já são
        condicionais a `isOnline` (`StepConfig.tsx`).
      - **Descartar `custom_scenario`, `style_tags`, `features`**: sem validator, sem leitor,
        sem dado; `style_tags` duplica `setting_styles` (54 mesas, vira filtro). Colunas
        ficam no banco, como as do corte de texto (T7.3b).
- [ ] T4.0v — **Requisitos junto da plataforma; valores reunidos** (R21, A24). Os 3
      checkboxes (`requires_pc`/`requires_camera`/`requires_microphone`) formam **lista
      explícita** na parte "Onde joga", ao lado do VTT que os auto-marca (R3) — medido:
      **já são checkbox** (`StepFinal.tsx:359-388`), o defeito é o lugar, escondidos no
      colapsável a duas etapas do select. E **todos os campos de valor numa parte só**, na
      ordem da decisão: hoje `price_type` (`StepConfig.tsx:343`) e `accepts_donations`
      (`:391`) estão numa etapa, `billing_text` (`StepFinal.tsx:247`) e `session_zero_free`
      (`:267`) noutra.
- [ ] T4.0b — **Covil admin-only** (`userRole === 'admin'`) e **DDAL em D&D 5e 2014 ou
      2024** com os **9 campos** e o efeito que desmarca ao trocar de sistema. · A13, A14
      **Escrito em 2026-08-24, mas NÃO está em `origin/dev`** — correção do registro após a
      auditoria (achado crítico 3): `git grep DDAL_ELIGIBLE_PATHS origin/dev` → **zero**. A
      constante existe **só no diff não commitado** da branch `fix/mesas-og-descricao-vazia`
      (`rtk git status` mostra `tableService.ts` e `CreateTableForm.tsx` como ` M`), e esta
      spec parte de `origin/dev`. **Quem implementar precisa trazer a mudança ou refazê-la**
      — não assumir que está no código.
      **Destino do diff — investigado em 2026-08-24: fica na frente OG.** `rtk git status`
      mostra `tableService.ts` e `CreateTableForm.tsx` **já modificados no mesmo diff** que
      `og.ts`, `tableValidators.ts`, `syncHelpers.ts` e `parseDiscordAnnouncement.ts`.
      Separar exigiria desfazer o DDAL nesses dois arquivos, commitar o resto e refazê-lo —
      retrabalho, com `--amend` proibido. **Consequência:** a Fase 4 depende de o diff OG
      estar mergeado, ou refaz a correção.
      O conteúdo da correção: a regra cobria só o path de
      2024 em dois lugares — `CreateTableForm.tsx:26` e `tableService.ts:7` —, então mesa de
      5e 2014, que é DDAL legítima, não conseguia marcar o selo. Virou
      `DDAL_ELIGIBLE_PATHS` com os dois slugs medidos no catálogo real
      (`dungeons-dragons/5e/2024` e `dungeons-dragons/5e/dungeons-dragons-5e-2014` — note
      que o de 2014 **não** é simétrico ao de 2024). O editor novo herda a lista; front e
      backend continuam tendo de concordar.
- [ ] T4.0c — Rascunho local sem regressão: modal "Rascunho encontrado" com
      Continuar/Descartar, expiração de 7 dias, `beforeunload`, limpeza de `parseCaseId`
      ao restaurar (senão contamina `discord_parse_cases`). · A15
- [ ] T4.0d — Condicionais e efeitos: limpeza de campo invisível ao trocar cobrança/doação,
      "Personalizado" com aviso, fallback de catálogo com erro, reconciliação UUID↔slug de
      VTT na edição, cobrança detalhada quando `paga` **ou** já houver `billingText`.
- [ ] T4.0e — **Regras de validação preservadas** (`plan.md` §Regras de validação): erro
      sempre leva à parte que contém o campo (equivalente do "um passo só valida o que
      renderiza"); **sessão flexível é exclusiva**; fim de sessão opcional; limites de
      texto iguais aos do backend, com mensagem dizendo quantos caracteres passaram;
      validação de contato por canal via `validateContactValue` (fonte única com o perfil e
      espelho do backend).

      **Limites de texto — estado medido (reescrito em bloco único na 2ª auditoria; antes o
      `title` aparecia explicado duas vezes):**
      - **`title`: o front sobe de 100 para 200**, alinhando ao backend
        (`validation.ts:43` × `tableValidators.ts:138`; coluna é `text` sem limite; maior
        título real: 84 caracteres). Baixar o backend quebraria as mesas importadas do
        Discord, que não passam pelo front. O campo também ganha largura maior (§Entra).
      - **`setting_name`: NÃO há descompasso** — correção da 2ª auditoria. O registro dizia
        "100×200", mas **nenhum limite de 100 existe no front**: `SettingStylesField.tsx:43`
        só exige ≥3 caracteres, e o backend aceita 200 (`tableValidators.ts:215`). A
        afirmação anterior estava errada.
      - **"12 campos sem limite no front"**: a lista **não sobreviveu** — morava no
        `review.md`, apagado. **Re-medir na Fase 4** e registrar os campos por nome antes de
        usar o número; o editor novo nasce com limite por campo de qualquer forma.
- [ ] T4.0f — **Regras do mapper preservadas** (`plan.md` §Regras do mapper): `''` zera ×
      `undefined` preserva; guard `Number.isFinite` nos preços; contatos vazios filtrados;
      primeiro dia/horário derivado; `notes`/`slots_per_session` omitidos quando vazios.
- [ ] T4.0h-bis — **Seleção de sistema: três colunas com busca por nível** (R18, A21).
      **Alvo final** (decisão do mantenedor de 2026-08-24, com o desenho à vista):
      - **Três colunas lado a lado** — Sistema · Edição · Variante em paralelo, **cada uma
        com caixa de busca própria**, e o caminho escolhido ("Vampire › 5ª Edição") abaixo.
      - **Sistema é só busca** (690 nós na raiz — grande demais para listar); **Edição** e
        **Variante** mostram opções **e** têm busca própria.
      - **Coluna sem filho não aparece** — medido: **510 dos 690** sistemas não têm edição
        (74%) e só **72** edições têm variante; parar no primeiro nível é o caso comum.
      - **Aliases visíveis NAS OPÇÕES**, não só no nó escolhido.
      - **Busca server-side** (`?search=`/`?parent_id=`), nunca `view=tree`.

      **O que o `CatalogTree` JÁ faz — não reimplementar:**
      | Pronto | Onde |
      |---|---|
      | raiz só aparece com termo digitado | `:355` `shouldShowRootLevel` |
      | níveis progressivos, só com filho real para `role="user"` | `buildVisibleLevels` `:78-91` |
      | "Nenhum sistema encontrado" + sugerir com o termo | `:398-478` (`onSuggest`) |
      | `selection` suprimindo nome PT e parágrafo técnico | `:29-32`, `:546` |

      **O que exige trabalho — e onde:**
      1. **Layout de três colunas com busca por nível** — hoje o componente **empilha**
         (`flex flex-col gap-3`, `:425`, rótulo "Edições de X") e tem **uma busca só**
         (`:414`, filtra apenas sistemas). Entra como **variante de apresentação no pacote**:
         `CatalogSystemPopover`, `SystemPicker`, `SystemSuggestionModal`, `DraftEditorTab`,
         `SystemsAdminView` e `CatalogExplorer` **mantêm o empilhamento**.
      2. **Aliases nas opções** — **reverte a D0.5 da spec 094** (`:25-32`), que os suprimia
         em `selection` por poluição visual. `presentation="selection"` passa a suprimir
         **só** "nome PT" e o parágrafo técnico. **Atinge o catálogo**: o
         `CatalogSystemPopover` é o consumidor atual desse modo e passará a exibir os badges.
         **Isso é intencional** — decisão de 2026-08-24: a reversão vale nos **dois**
         consumidores, uma regra só para toda seleção de sistema (`plan.md` §Impacto em
         consumidores).
      3. **Ligar a busca server-side** no consumidor, com o `parent_id` de T4.0h-ter.
      4. **Ligar `onSuggest` ao `SystemSuggestionModal` existente** (511 linhas, hierarquia de
         3 níveis, caminho admin×usuário) — **não** criar fluxo de sugestão novo.
         **A sugestão aprovada escreve no CENTRAL**, que é o que faz o sistema sugerido no
         `mesas` aparecer no `downloads` (`plan.md` §Catálogo central).

      **Contexto que motivou o redesenho** (§Gap 9): `StepSystem.tsx:57-65` não passa
      `presentation`, então o mestre recebe o modo `full` — "nome PT: —" por nó
      (`:199-204`), badge de aliases (`:206`) e parágrafo sobre nós da árvore (`:546-549`),
      vocabulário de curadoria. E o form baixa **503.907 bytes** de `?view=tree` por
      abertura, contra **423** de `?search=vampiro&limit=5`.
- [ ] T4.0h-ter — **`GET /systems` aceita `parent_id`** (R18, A21) — **única mudança de
      backend do Gap 9**. Medido: a rota só aceita `view`/`search`/`limit`/`cursor`
      (`systems.ts:28-35`); a busca devolve `has_children: true` com `children: []`
      (`?search=vampire&limit=3` → "Buffy the Vampire Slayer", `children_count: 1`,
      `children: []`); e `GET /systems/:id` responde **404** (só existem `/health`, `/` e
      três `/admin/*`). Sem o parâmetro, abrir um nível exigiria rebaixar a árvore inteira —
      os 492 KB que este gap existe para eliminar. Aditivo, sem migration; atualizar
      OpenAPI e rodar `pnpm verify:api`.
      **Vale nas DUAS fontes do catálogo** (diretriz do catálogo central, 2026-08-24):
      `centralProvider` e `localProvider` implementam a mesma interface
      (`systemCatalogProvider.ts:56,75`) — **produção lê o central, beta/dev leem a projeção
      local** (`:49-51`). Se o `parent_id` só funcionar numa delas, o editor quebra
      exatamente no ambiente que ninguém testou. Testar os dois caminhos.
      **Não SUBSTITUIR `SystemPicker`/`CatalogTree` — mas o pacote É tocado:** o layout de
      três colunas com busca por nível entra como **variante de apresentação**, preservando o
      empilhamento dos demais consumidores (R13/R18/A21). Edição de pacote autorizada por
      escopo desde 2026-08-24.
      **Encerrada a pendência do `plan.md`** ("conferir se a rota devolve `aliases`"):
      devolve populado — medido `"aliases":["The Masquerade","Vampiro","VtM"]` na resposta
      real; 199 sistemas têm alias. A busca por apelido funciona.
- [x] T4.0h — ~~Seleção de catálogo de ponta a ponta~~ **SUPERADA por T4.0h-bis/T4.0h-ter
      (2026-08-24).** Descrevia o modelo **antigo** — "navegação por nós em colunas" —, que
      o mantenedor substituiu pelo fluxo **progressivo** (sistema só busca → edição abre se
      houver → variante abre se houver; R18). E reabria como pendência a conferência dos
      `aliases`, **já encerrada por medição**: a rota devolve populado
      (`"aliases":["The Masquerade","Vampiro","VtM"]`), 199 sistemas têm alias.
      Achado alto 4 da auditoria de 2026-08-24 (`auditoria.md`). · R13, R14, R18
- [ ] T4.0l — **O editor nasce sobre `ui/primitives`** (R16, A16). Baseline medido: o fluxo
      atual importa **zero** de `@artificio/ui` em 4.117 linhas, com 16 primitives ociosos.
      Usar `Field` (label+hint+error+required, com `role="alert"` no erro —
      `primitives.tsx:141-160`; **`aria-invalid` fica nos controles**, via prop `invalid` de
      `TextInput`/`Textarea`/`Select`, `:170-190`), `TextInput`, `Textarea`, `Select`, `Button`, `Panel`,
      `Modal`, `Drawer`, `Badge`, `Banner` e os quatro estados
      (`Loading`/`Empty`/`Error`/`Success`) em vez de controle cru. Todo `<input>`/`<select>`/
      `<textarea>`/`<button>` nativo remanescente carrega comentário inline dizendo por que o
      primitive não serve. Mata de passagem três duplicações medidas (ErrorState
      local, "Carregando..." inline, `<select>` cru).
- [ ] T4.0m — **Aplicar o corte dos campos de texto** (R17, A17), decidido em 2026-08-23:
      o editor novo **não tem** "Sinopse narrativa" (nenhuma das duas), "Descrição do estilo
      de jogo", "Resumo alternativo para listagens" nem "Benefícios e diferenciais". Ficam
      **5** editores. **Só a UI sai — as colunas permanecem no banco** (T7.3b); não escrever
      migration por causa deste corte. Tabela campo a campo em `spec.md` §Gap 8.
- [ ] T4.0o — **"Regras e observações da mesa" logo abaixo da Descrição** (R17, A17). Hoje
      vive no colapsável de avançados do `StepFinal.tsx:179`, longe do texto principal;
      35/107 mesas já têm conteúdo ali. No editor novo os dois ficam juntos, na mesma parte.
      Complementa T7.2b, que dá exibição pública ao campo.
- [ ] T4.0p2 — **Criar o perfil de mestre dentro do editor** (R12 — decisão do mantenedor,
      2026-08-24). Hoje `CreateGmProfileForm` (`PainelMestrePage.tsx:170-207`) é
      **pré-requisito separado**: sem perfil, o painel manda criar antes de anunciar. No
      editor novo, o mestre sem perfil preenche nickname/bio/contatos na parte "Mestre e
      contato" e **o perfil nasce junto com a mesa** — acaba o formulário anterior.
      **Lacuna medida (C2 da 2ª auditoria):** `POST /gm/profile` (`gmPanel.ts:255-270`)
      **não aceita `contact_methods`** — insere só slug/nickname/bio_long/languages/
      specialties/badges/tagline/promo/selling_points/closed_group. Os contatos exigem um
      **segundo chamado** (`PUT /gm/profile`, que os aceita — `:337`) ou **expandir o POST**.
      Caminho recomendado: **expandir o POST**, porque é uma escrita só e evita o estado
      pela metade; POST+PUT exigiria compensação se o segundo falhar.
      **Consequência a tratar:** são duas escritas (perfil + mesa) num fluxo só; definir a
      ordem e o que acontece se a segunda falhar (perfil criado, mesa não).
- [ ] T4.0p — **Herança da identidade do mestre** (R12, A19). Pré-carregar do perfil de
      mestre, **sem escrever nele**: `gm_profiles.bio_long` → campo de bio (29/39 mestres
      têm), `gm_profiles.nickname` → nome de exibição (34/39), `gm_profiles.contact_methods`
      → repeater de contatos (15/39). Não editou = mesa espelha o perfil; editou = vira
      `tables.table_gm_bio` / `tables.master_display_name` / linhas em `table_contacts`, e o
      perfil **permanece intacto** (é o A19 que prova isso).
      **O que já existe e não se reescreve:** a exibição pública já resolve o fallback —
      `tableViewMapper.ts:278` (`table_gm_bio ?? gm_bio_long`) e `tables.ts:158,637`
      (`COALESCE(gm.nickname, p.display_name)`). **O que falta é só o editor pré-carregar.**
      **Contatos é o único elo realmente quebrado:** o fluxo de criação tem **zero**
      ocorrências de `contact_methods` (medido); o perfil grava JSONB via
      `PUT /gm/profile` e a mesa grava a tabela `table_contacts`, sem ponte. Formatos
      compatíveis (`{channel,value,label,discord_server_url}`); o perfil cobre **4** canais e
      a mesa **7** — **hoje** o perfil é subconjunto, então a conversão inicial é direta;
      **T4.0r amplia o perfil para os mesmos 7** (validação + serialização + exibição), e a
      partir daí as duas listas são idênticas.
      Publicador **anunciante** não herda nada: repeater entra vazio, como hoje.
      **Detalhes decididos em 2026-08-24:** contatos puxam **todos** os do perfil, com
      remover/adicionar livres; nickname **mantém** o campo por mesa (5 dos 6 usos atuais são
      redigitação idêntica ao perfil, 1 difere de verdade — é o caso que justifica o campo);
      **sem marca de origem** (o campo vir preenchido já comunica).
- [ ] T4.0r — **UM editor de contatos, servindo perfil E mesa** (R12, decisão 2026-08-24).
      Base: a estrutura de `components/mestre/ContactMethodsEditor.tsx` (304 linhas), **não**
      a do `ContactsFormBlock.tsx` (162), que não tem ícone por canal, reordenação nem menu
      de adicionar. "100%" é a mecânica inteira: ordenação **por setas ↑↓**, forma de inserir e
      **todas as capacidades que o `ContactsFormBlock` já tem e não podem se perder**
      (placeholder por canal, rótulo opcional, campo extra de link do servidor só no Discord,
      erro próprio por linha) mais
      **todos os canais**. O painel do mestre ganha o mesmo — *"se o painel do mestre não
      tem, tem que adicionar também"*.
      - **Ordenar é por setas ↑↓, sem arrastar** (mantenedor revogou o arrastar em
        2026-08-24). É o que o editor do perfil já faz — nada novo a construir, e o caminho
        de teclado vem junto.
      - **Ordenar tem efeito público:** a página da mesa exibe por `sort_order`
        (`tableViewMapper.ts:39-40`; `tables.ts:316` já faz `orderBy`) — a ordem decide qual
        canal o jogador vê primeiro. O formulário de mesa nunca deu esse controle.
      - **7 canais nos dois lados.** `CONTACT_CHANNELS` (`tableValidators.ts:21`) tem os 7 e
        vale para a **mesa**; o **perfil** é restrito por `PROFILE_CONTACT_CHANNELS`
        (`contactUrls.ts:25`). **Não é só o front** — correção de 2026-08-24; os três pontos
        a mudar estão no bullet abaixo.
      - **Consolidar o tipo triplicado:** 4 valores em `ContactMethodsEditor.tsx:10` e em
        `MestreContactMethods.tsx:11`, 7 corretos em `types/tables.ts:8`. Uma fonte só,
        alinhada ao `CONTACT_CHANNELS` do backend.
      - **DECIDIDO 2026-08-24: o perfil passa a aceitar os 7 canais.** Hoje é restrito a 4
        (`PROFILE_CONTACT_CHANNELS` em `contactUrls.ts:25`). São **três** pontos a mudar, e
        o terceiro é o que falha em silêncio:
        (1) **validação** — `tableValidators.ts:87` rejeita canal fora do Set;
        (2) **serialização** — `contactSerializer.ts:60` **descarta sem erro** (o dado
        entraria no banco e sumiria na leitura, sem mensagem nenhuma);
        (3) **exibição** — `MestreContactMethods.tsx:27-52` tem os 4 canais **hardcoded**
        com ícone e rótulo; sem ampliá-lo, o canal novo é salvo e **não aparece** na página
        do mestre.
        Mais os testes de `contactSerializer.test.ts`.
- [ ] T4.0s — **Faixa etária vira recomendado** (R6.1): tirar o asterisco decorativo de
      `StepConfig.tsx:334` (que nunca teve validação por trás — o select tem default
      `'livre'`) e marcar o campo como **recomendado**, com a frase do ganho — **a redação é do implementador**
      (o R6 dá o padrão com o exemplo do banner); sugestão: "ajuda o jogador a saber se a mesa
      é para ele". Publicar não é
      bloqueado por ele. O dado errado em produção se resolve por T3.2/A5 (payload aceitar
      `age_rating`), não por obrigatoriedade.
- [ ] T4.0q — **Botão "Sincronizar com o Perfil Principal de Mestre"** (R12, A20). Texto
      **exato**, definido pelo mantenedor — não parafrasear. Aparece quando o
      mestre editou um campo herdado (bio, nickname ou contatos) e grava aquele valor no
      perfil (`gm_profiles`). É a **única** escrita mesa→perfil do editor, e é sempre
      deliberada — salvar a mesa sem clicar **não** pode tocar `gm_profiles` (o A20 prova
      isso por teste). Fecha as três escolhas do mestre: manter o do perfil / personalizar só
      nesta mesa / promover o novo texto para o perfil.
- [ ] T4.0n — **Alinhamento vem do pacote** (A18). Medir A2 com os controles já dentro de
      `Field`; se sobrar desalinho, a causa é `.artificio-field` não fixar altura de rótulo
      (`styles.css:945-955`, `display:grid` sem `min-height` no label) — **corrigir no
      pacote** (autorização de escopo de 2026-08-24 cobre a edição; commit/push/PR seguem por
      ação), nunca no CSS do `mesas`. Conferir de passagem a
      declaração duplicada de `.artificio-field` (`:728` e `:945`).
- [ ] T4.0i — **Instrumentação** (R15): eventos de início, publicação, abandono e uso do
      parser via `@artificio/analytics`. Hoje o fluxo emite zero eventos (medido).
- [x] T4.0j — ~~Identidade do mestre: editar grava no perfil~~ **OBSOLETA — NÃO EXECUTAR
      (2026-08-24).** Descrevia a mecânica **substituída** pelo mantenedor: "editar grava no
      perfil, a mudança vale para todas as mesas". A mecânica vigente é a inversa —
      pré-carrega do perfil e **editar vira valor daquela mesa, com o perfil intacto**
      (R12). O "qual par é a fonte" também já foi medido e decidido: `gm_profiles`
      (`bio_long`/`nickname`/`contact_methods`), porque é o que a página pública lê
      (`tableViewMapper.ts:278`, `tables.ts:158,637`).
      **Substituída por T4.0p** (herança) **e T4.0q** (botão de sincronizar).
      Mantida marcada e visível de propósito: executar esta task desfaria a decisão do
      mantenedor — achado crítico 1 da auditoria de 2026-08-24 (`auditoria.md`).
- [ ] T4.0g — **Pacotes compartilhados mantidos** (`plan.md` §Pacotes compartilhados):
      `@artificio/content-editor` (inclusive `contentCountLabel`/`contentOverflow` no
      parser), `@artificio/image-editor`, `@artificio/media/image-kinds`,
      `@artificio/catalog-matching` — no lugar do local
      `services/systemSuggestionCandidates.ts` (560 linhas, assinatura idêntica); **a troca
      dos 2 importadores backend é executada por T7.1b**, não aqui.
      Reimplementar qualquer um destes **pacotes** localmente é a "exceção por app" proibida
      pelo AGENTS.md.
      **Não são pacotes, são utilitários locais do `mesas`** (correção da 3ª auditoria) —
      consumir como estão, sem tratá-los como compartilhados: `utils/safeExternalUrl`,
      `utils/authenticatedFetch`, `contexts/useAuth`.
- [ ] T4.0k — **Consumir API existente, não criar endpoints** — **atenção ao escopo: a parte
      de notificações EXECUTA NA FASE 7 (T7.4b)**; aqui só a tela "minhas sugestões" e o
      botão de sugerir VTT. (diretriz "tudo será
      usado"): tela "minhas sugestões" usa `GET /api/v1/system-suggestions/mine` e
      `/scenario-suggestions/mine` (já existem, sem consumidor); `POST
      /api/v1/vtt-platforms/suggest` ganha botão. **As notificações NÃO entram aqui** — executam
      na Fase 7 (T7.4b), conforme o cabeçalho desta task.
      **Rotas medidas (inline — `review.md` apagado):** `GET /api/v1/system-suggestions/mine`
      (`systemSuggestions.ts:189`) e `/scenario-suggestions/mine` (`scenarioSuggestions.ts:98`)
      existem e têm **zero consumidor** no front (57 sugestões de sistema + 8 de cenário em
      produção); `POST /api/v1/vtt-platforms/suggest` (`vttPlatforms.ts:124`) existe **sem
      botão** (0 sugestões); `routes/notifications.ts` expõe `GET /`, `PATCH /read-all` e
      `PATCH /:id/read`, com **zero** consumidor no front do mesas.
      **DECISÃO DO MANTENEDOR (2026-08-24): unificar no accounts.** As notificações de mesa
      passam a ser gravadas no sistema do **accounts**, e o `NotificationBell` de
      `packages/ui` — que já consulta `${accountsOrigin}/api/v1/notifications?source_app=`
      (`:174-182`) — passa a mostrá-las junto com as demais. Um lugar só para o usuário
      olhar, em todos os apps.
      **Custo medido, e ele muda o escopo:**
      - o accounts **já tem `source_app`** (`notificationRoutes.ts:31,95,175`) e leitura
        filtrada por app — a metade da leitura está pronta;
      - **mas NÃO tem rota de escrita**: `notificationRoutes.ts` expõe só `GET` (`:86`,
        `:164`) e `PATCH` (`:116`). **Nenhum `POST`** — o mesas não tem como gravar lá hoje;
      - a escrita no mesas está em **6 arquivos** (`syncHelpers.ts`,
        `suggestionHelpers.ts`, `systemSuggestionsAdmin.ts`, `scenarioSuggestionsAdmin.ts`,
        `vttPlatforms.ts`, `services/adminNotifications.ts`) e precisa passar a chamar o
        accounts;
      - as **66 notificações existentes** (62 não lidas) precisam migrar ou ser descartadas.
      **DECIDIDO 2026-08-24: a migração ENTRA nesta spec.** Deixa de ser bloqueio e vira
      trabalho da Fase 7, com estas partes nomeadas:
      1. **`POST` no accounts** — `notificationRoutes.ts` só tem `GET` (`:86`, `:164`) e
         `PATCH` (`:116`); criar a rota de escrita aceitando `source_app`.
      2. **Os 6 escritores do mesas** passam a chamar o accounts: `syncHelpers.ts`,
         `suggestionHelpers.ts`, `systemSuggestionsAdmin.ts`, `scenarioSuggestionsAdmin.ts`,
         `vttPlatforms.ts`, `services/adminNotifications.ts`.
      3. **Migrar as 66 notificações** de `mesas-db` (62 não lidas) — ou decidir descartar as
         lidas. Escrita em produção → aprovação nominal por ação quando chegar a hora.
      4. **O sino passa a mostrá-las**: o `NotificationBell` já filtra por `source_app`
         (`:174-182`), então a leitura não precisa de trabalho novo.
      **Consequência:** as 3 rotas de leitura do mesas (`routes/notifications.ts`) ficam
      órfãs de vez — remover junto, senão fica o mesmo débito com outro nome.
- [ ] T4.1 — Casca de altura fixa: `100dvh`, sem rolagem em nenhum nível. · A1
- [ ] T4.2 — Lateral: partes, contagem de pendências, progresso. Botões criados **uma
      vez** (recriar mata o clique — bug medido no protótipo).
- [ ] T4.2b — **Prévia do card + "Ver como jogador"** (R22, A25 — decidido 2026-08-24).
      A prévia ocupa a lateral e usa o **`TableCardComponent` real**
      (`components/TableCard.tsx:271`), montando um objeto `TableCard`
      (`types/tables.ts:34`) a partir do estado do editor, com os mesmos mappers do payload
      — **não** um card desenhado à mão, que divergiria do verdadeiro no primeiro ajuste de
      layout. "Ver como jogador" abre a página da mesa como o público a vê.
      **Ganho lateral:** é o primeiro consumidor do estado do editor em formato de leitura,
      então expõe cedo descompasso entre o que o editor guarda e o que o catálogo lê.
- [ ] T4.3 — Campos sempre abertos, largura por conteúdo esperado, rótulo de altura fixa
      para alinhar os controles da linha. · A2
- [ ] T4.4 — Criar e editar na mesma tela; estado (rascunho/no ar) só muda selo e botão.
      Alterar campo de mesa no ar em 2 interações. · A3
- [ ] T4.5 — Três níveis de campo com marca e explicação; validação no blur e ao
      publicar; mensagem por campo. · A11, R6
- [ ] T4.6 — Publicar com pendências **revela** o que falta (não desabilita o botão):
      marca todos, foca o primeiro, lista as partes. **Nada é salvo nesse clique** (decisão do
      mantenedor, 2026-08-24): a validação não grava; a mesa continua como estava, e o
      autosave segue por conta própria. · A4
- [ ] T4.7 — Promover o rascunho ao backend (`status='draft'`) **preservando** o que já
      existe em `useAutosave`/`draftStorage`; painel do mestre distingue rascunho de mesa
      no ar. · R10
      **Alcance decidido em 2026-08-24:** o rascunho **segue o mestre entre máquinas, sem
      prazo** — o do servidor é o que vale, e o local (7 dias, um navegador) vira cache de
      digitação. A mesa `draft` fica no painel até publicar ou apagar; **não há expiração
      automática**. Consequência aceita: rascunho abandonado permanece no banco.
- [ ] T4.8 — Remover `CreateTableForm`, `useStepNavigation` e `components/form-steps/*`.
      Grep provando zero referência remanescente.
- [ ] T4.9 — 🔁 **GATE DE FASE** — reler `spec.md` R1, R2, R6, **R6.1**, R10, R11, **R12,
      R16, R17, R18, R19, R20, R21, R22, R23** e **R13** (consumo dos pacotes) e **R15** (instrumentação) e A1-A4,
      A11-A15, **A16-A26**, mais a tabela de
      paridade **linha a linha**. (Lista ampliada em 2026-08-24 após auditoria: faltavam
      justamente R12 e R18-R21 — as decisões que esta fase implementa.) O gate anterior desta spec deixou passar
      6 features (autosave, modal de rascunho, `beforeunload`, Covil admin-only, DDAL
      condicional, contatos multi-canal) porque a tabela foi montada por grep — aqui se
      confere contra o arquivo, não contra a memória.
- [ ] T4.10 — Validação do pacote afetado; PR contra `dev`.

## Fase 5 — Regras VTT → requisitos · PR próprio

- [ ] T5.1 — Migration `online-safe` **única**: `implies_pc`/`implies_microphone`/
      `implies_camera` em `vtt_platforms` **e** `communication_platforms`, com seed
      (Foundry/Roll20/Fantasy Grounds → PC; Discord/Teams → mic; Meet/Zoom → mic+câmera).
      Header de 5 campos conferido contra o vizinho verde mais recente.
- [ ] T5.2 — Expor as colunas nas rotas de catálogo; consumir no editor.
- [ ] T5.3 — Auto-marcação **com o porquê ao lado** do requisito; mestre pode desmarcar.
      Requisito e plataforma na mesma parte. · R3
- [ ] T5.4 — 🔁 **GATE DE FASE** — reler `spec.md` §Gap 2 e R3.
- [ ] T5.5 — Validação + `pnpm verify:api`; PR contra `dev`.

## Fase 6 — Parser · PR próprio

- [ ] T6.1 — Ligar catálogos (VTT, comunicação, cenário) e aliases aprendidos no
      parse-preview — hoje a rota chama o parser sem eles e descarta o que leu.
- [ ] T6.2 — Consumir no frontend os sinais de ambiguidade que o backend **já** envia e o
      front ignora; marcar visualmente campo preenchido pelo parser, dizendo de onde veio.
- [ ] T6.3 — Extrações faltantes: mensal, doações, `@username`, "PC e microfone",
      "4 vagas (2 abertas)", `raw_system_hint` não casado.
- [ ] T6.4 — Herança do perfil GM: **`preferred_vtt_platforms` e `languages`** pré-preenchendo
      o editor. **`contact_methods` NÃO entra aqui** — já é herdado por T4.0p (Fase 4);
      reimplementar seria trabalho duplicado (achado M6 da 3ª auditoria). · R7
- [ ] T6.5 — **Publicar nunca é bloqueado** por campo adivinhado (decisão registrada).
- [ ] T6.6 — 8 fixtures, uma por falha do §Gap 4. · A9
- [ ] T6.7 — 🔁 **GATE DE FASE** — reler `spec.md` §Gap 4 e R5.
- [ ] T6.8 — Validação + `pnpm verify:api`; PR contra `dev`.

## Fase 7 — Redundâncias e campos sem destino · PR próprio

- [ ] T7.1 — Resolver o par "Meet" × "Google Meet" (R8).
- [ ] T7.4b — **Migrar notificações de mesa para o accounts** (decidido 2026-08-24; a parte
      de notificações da T4.0k executa aqui, não na Fase 4). Detalhe completo na T4.0k.
      Resumo: criar `POST` no `accounts/src/notificationRoutes.ts` (hoje só `GET`/`PATCH`),
      apontar os **6 escritores** do mesas para lá, migrar as **66** notificações (escrita em
      produção → aprovação nominal), e remover as 3 rotas de leitura do mesas que ficam
      órfãs. O `NotificationBell` já lê por `source_app` — a leitura não muda.
- [ ] T7.1c — **Subir a escrita do catálogo para o pacote** (débito medido em 2026-08-24).
      `createCatalogNode` está **duplicado em dois apps** —
      `apps/mesas/backend/src/services/catalogClient.ts:167` e
      `apps/downloads/backend/src/services/catalogClient.ts:308` — enquanto
      `@artificio/catalog-client` exporta só `catalogFetch`, `checkCatalogHealth`,
      `archiveCatalogNode` e `flattenTree`. **A escrita nunca subiu para o pacote**, embora a
      leitura tenha subido. Mesma classe do dup de 560 linhas do `catalog-matching` (T7.1b).
      Pacote compartilhado: edição autorizada por escopo; verificar impacto nos dois apps.
- [ ] T7.1b — **Matar a duplicação local do `@artificio/catalog-matching`** (decidido
      2026-08-23, D5-c): apagar `services/systemSuggestionCandidates.ts` (560 linhas) e
      trocar os 2 importadores (`systemSuggestionsAdmin.ts:8-9`,
      `parseDiscordAnnouncement.ts:2`) para o pacote. Contrato de resolução (tipos/zod)
      sobe para pacote quando convier. 
- [ ] T7.2b2 — **`price_frequency`: MANTER, e dar entrada no editor** (decidido por medição
      em 2026-08-24). A auditoria sugeria descartar por ter **1 mesa** em produção — mas a
      medição mostra que **a página pública já o renderiza**: `TableActionPanel.tsx:87-88`
      exibe "/ {priceFrequency}" ao lado do preço, e o mapper já o envia (`mapper.ts:187`).
      É coluna com leitor, escritor e exibição — **capacidade completa sem campo no form**,
      não campo morto. Descartar removeria exibição funcional. Cabe na parte "Valores"
      (R21), ao lado de cobrança e valores.
- [ ] T7.2 — Destino nominal de cada campo sem consumidor do §Gap 6 **+ achados novos da
      auditoria adversarial** — consumir, mover ao perfil ou descartar, **um por um, com o
      porquê**: `gm_profiles` (20 colunas mortas × 2 colunas 39/39 de herança),
      `notifications.link` morta, `imported_expires_at` fantasma, família
      `system-suggestions` duplicada mesas×downloads (**decidido**: o mesas consome `catalog-matching`, T7.1b; fila única central é alvo da spec 062 — antes: pendente da investigação do catálogo
      central).
      **Lista inline (o `review.md` foi apagado; estes são os itens medidos nesta spec):**
      `gm_profiles` com **20 colunas 0/39** (avatar/banner imgur, tagline, game_format,
      tools, gm_style, promo_badge_text, closed_group_*, discord_id/username, avg_rating)
      × **2 colunas 39/39** de herança (`preferred_vtt_platforms`, `contact_methods`);
      `notifications.link` **0/66** (substituída por `action_url`, 66/66);
      `imported_expires_at` **fantasma** (citada em `db/types.ts:299` e no allowlist do
      hydration, **coluna não existe** no `information_schema`);
      `table_history` (0 linhas, sem escritor), `table_tags` e `table_platforms`
      (join tables 0/0 — o que vive é a query de `/me/options`);
      `slots_filled` lido em 3 pontos e escrito **só pelo parser**
      (`gmPanel.ts:575`, `whatsappAnnouncement.ts:227`, `tableViewMapper.ts:203`);
      `scenarios.description`/`name_pt` **4/123**;
      `vtt_platforms.website_url` **0/10** e `communication_platforms.website_url` **0/6**;
      `ddal_org_code` **0** na única mesa DDAL;
      `benefits_text`/`table_gm_bio` **0/107**, `listing_excerpt` **1/107**.
      Os 7 do §Gap 11 já têm destino decidido (R23). · R7, R8
- [ ] T7.2b — **Exibir `rules_notes` na MesaPage** (decidido 2026-08-23, opção A): +1
      campo no select de `tables.ts` (ao lado de `ddal_rules_notes`, `:592`), +1 campo no
      viewModel com **nome novo** (`tableRules` — `rulesNotes` já existe em
      `tableView.types.ts:59` e pertence ao DDAL; reusar quebraria a certificação), +1 no mapper (`tableViewMapper.ts`), +1 seção
      "Regras da Mesa" em `TableContent.tsx` (padrão `{vm.x && ...}` com `MarkdownContent`).
      
- [ ] T7.2c — **Toggle `featured` no admin** (decidido 2026-08-23, opção A): aceitar
      `featured` no `PUT /admin/tables/:id` (`adminTables.ts:241,257-259`, clone do
      `is_covil`) + incluir no select (`:315`); toggle no `AdminTablesPanel.tsx` (clone
      `:201-207`). Selo/ordenação/filtro já existem.
- [ ] T4.0x — **Cenário e Ambientação na mesma parte** (**executa na Fase 7 por ser
      redundância do R8; o trabalho em si é no editor** — o editor fecha com esta task) (resolve o "cenário com 2
      significados"). Medido: **não é duplicação** — `scenario_id` é nó do catálogo central
      (19 mesas), `setting_name` é texto livre da ambientação própria (15 mesas), e só **3**
      usam os dois. O defeito é de **lugar e rótulo**: "Cenário" no `StepSystem:73` e
      "Ambientação" no `StepFinal:506`, a etapas de distância. No editor os dois ficam
      juntos — catálogo primeiro, livre abaixo, com rótulo que diga que serve para quando o
      cenário não está no catálogo. Nenhum campo é removido.
- [ ] T7.3 — Redundâncias do form — **em grande parte resolvidas pelo corte de 2026-08-23**
      (T4.0m): `styleText` × `settingStyles` some com a remoção do `style_text`;
      `synopsisNarrative` sem editor some com a remoção das duas sinopses; "mestre em 3
      campos" vira a herança do R12 (T4.0p); **cenário × ambientação** resolvido por T4.0x
      (medido: são dois conceitos, não duplicação). **Task sem resto — fecha quando as
      quatro acima estiverem feitas.**
- [x] T7.3b — ~~Destino das colunas órfãs do corte~~ **DECIDIDO (2026-08-23): as colunas
      FICAM no banco.** Os campos saem só do editor; nenhum `DROP`, nenhuma migration nesta
      spec. Motivo do mantenedor: esperar o dado esfriar antes de apagar. A remoção das 5
      colunas órfãs (`synopsis`, `synopsis_narrative`, `style_text`, `listing_excerpt`,
      `benefits_text`) vira **débito**, registrado só no destino que ele nomear.
      **Consequência a conferir na Fase 4:** a seção **"🎭 História"**
      (`TableContent.tsx:25-30`) continua no código lendo `synopsis_narrative` — hoje
      **0/107, vazia em todas as mesas**, então segue invisível; não se remove o bloco agora.
      Leitores com fallback para `description`, que não regridem:
      `whatsappAnnouncement.ts:376`, `ogDescription.ts:62`.
- [ ] T7.4 — 🔁 **GATE DE FASE** — reler `spec.md` R7, R8 e §Gap 6.
- [ ] T7.5 — Validação; PR contra `dev`.

## Fase N — Validação final e fechamento

- [ ] TN.0 — 🔁 **GATE FINAL — varredura completa.** Percorrer **todos** os requisitos e
      critérios de aceite um por um, mais os gaps do §Problema, e reconferir as travas
      objetivas — não assumir que os gates de fase cobriram. Requisito não atendido =
      spec não está pronta, mesmo com todas as tasks marcadas.
- [ ] TN.1 — `rtk tsc`/lint/build/test verdes.
- [ ] TN.2 — `pnpm verify:api` final (se tocou `apps/**`, `packages/**`,
      `scripts/api/**`, `docs/api/openapi/**`).
- [ ] TN.3 — **Auditoria de cobertura de teste**, por tabela: cada arquivo novo/alterado
      com seu `.test` correspondente, separando novos de estendidos, com o caminho de cada
      um. Arquivo tocado sem teste = task reaberta, não fechada.
- [ ] TN.4 — Achados de review de bot resolvidos: o fix que procede vira commit normal
      **com comentário no próprio código** citando origem (PR + bot + severidade) — padrão
      `Achado real (review PR #NNN, <bot>, <P1|P2|nitpick>): …` já usado nesta base. O que
      **não** virou código vai **somente para o destino que o mantenedor nomear**
      (`tasks.md`/`specs/backlog.md` quando autorizado), com o porquê. **Nunca**
      responder, comentar, resolver thread ou reagir no PR (`AGENTS.md`).
- [ ] TN.5 — Registrar pendências **somente nos destinos que o mantenedor nomear**
      (backlog/sessão/project-state nunca automaticamente — AGENTS.md). Conferir que
      **nenhuma** pendência da tabela do topo ficou só no chat.
- [ ] TN.6 — Smoke real pós-deploy quando o aceite exigir execução (dry-run/plano/doc não
      fecham task executável — `AGENTS.md` §Erros que não podem se repetir).
