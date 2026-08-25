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
| ~~Fase 3/4~~ | ~~Diff não commitado tem DOIS donos~~ — **RESOLVIDO (2026-08-24):** a frente OG + `imageKinds.ts` da spec 096 entraram na PR #284 (`1e32bb8`); a Fase 3 entrou na PR #285 (`5da15b3`). Ambas mergeadas em `dev` — `imageKindHint` existe em `origin/dev` e a Fase 4 pode começar |
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

## Fase 3 — Correções de perda de dado · PR próprio — CONCLUÍDA 2026-08-24 (PR #285 mergeada em `dev`, `5da15b3`)

Vem antes do editor de propósito: são bugs que já causam dano hoje, e o editor novo
depende de os dois mappers estarem certos.

**`packages/ui` saiu do título desta fase (2026-08-23):** o único item que a tocava era o
`color-scheme` (T3.4), já implementado no pacote desde `3ae4f6b`. A fase é agora só de
correção de dado — sem pacote compartilhado, sem aprovação nominal pendente.

- [x] T3.1 — `mapTableApiToInitialData.ts`: ler `is_covil` (não `is_covil_mesa`) e
      `schedules` (não `sessions`). Teste com resposta real da API. · A6, A7
      **Feito:** as duas chaves trocadas; teste com fixture do formato real de `gmPanel`
      (red phase registrada: 15/17 → 17/17, fixando 2+ horários preservados e `is_covil`
      mantido na edição).
- [x] T3.2 — `tableValidators.ts` + `mapper.ts`: aceitar e enviar `age_rating` e
      `table_level`. **Sem backfill** nas 41 mesas (decisão registrada). · A5
      **Feito:** enums medidos no `pg_enum` real (idade: `livre`/`+10`…`+18`; nível:
      `iniciante`/`intermediario`/`avancado`/`todos`); validator aceita com os defaults
      reais das colunas; mapper envia; create grava. **Guard no PUT:** grava só quando o
      body enviou o campo (o `.default()` do zod materializa os defaults em payload
      parcial — sem o guard, editar qualquer campo rebaixaria a faixa salva).
- [x] T3.2f — **Exibir faixa etária na página da mesa e no card** (R24, A27 — decidido
      2026-08-24). Corrigir o payload (T3.2) não basta: as mesas importadas já têm faixa
      real e nenhuma aparecia. Exibir corrige essas **sem nenhum mestre editar nada**.
      Toca `features/table` e `features/catalog` — fora do editor, exceção nomeada em
      §Fora de escopo. **Feito:** rota da lista passou a devolver `t.age_rating`; mapper da
      view e tipos ganharam `ageRating`; card e ficha técnica exibem.
      **Regra de exibição (decisão do mantenedor, 2026-08-24):** preenchida `'livre'` →
      marcador **"Livre"** discreto **sem 🔞**; preenchida `+10`…`+18` → **🔞 +N**; **não
      preenchida (`null`) → nada**; valor fora do enum → nada. O "ruidoso" que a A27
      proíbe é o 🔞, não a informação "Livre". Regra única em
      `frontend/src/utils/ageRating.ts` (`ageRatingLabel`/`isRestrictedAgeRating`).
- [x] T3.2b — ~~Alinhar o par sinopse~~ **RESOLVIDO POR REMOÇÃO (2026-08-23).** O mantenedor
      decidiu remover **as duas** sinopses do editor (`synopsis` 1/107, `synopsis_narrative`
      0/107). Não há mais o que alinhar: sem editor, não há coluna certa ou errada. Passa a
      T4.0o. · `spec.md` §Gap 8
- [x] T3.2c — `gm_avatar_url`: **remover do contrato do form** (decidido 2026-08-23, opção
      C). **Feito:** removido de estado/props/tipos/mapper/validator/fixture do form; a
      resposta da API (alias computado) continua — `types/tables.ts`, `tableViewMapper`,
      `TableCard`, `useMestre`, WhatsApp e `routes/tables.ts` intocados.
- [x] T3.2d — `slots_filled`: **DAR ESCRITOR ao fluxo manual** (decidido por medição em
      2026-08-24). **Feito:** o mapper grava `filled = total − abertas` (mesma semântica do
      parser e dos leitores — medida nas três fontes antes de escrever); validator ganhou
      refine espelhando o CHECK `slots_filled_valid` do Postgres (create e PUT), para o
      cliente fora do form receber 400 em vez de 500 do banco.
      **A conferir (trade-off registrado):** quando o mestre fecha recrutamento sem lotar,
      o valor gravado superestima preenchidas — única derivação coerente sem campo próprio.
- [x] T3.2e — ~~Rebindar o editor de sinopse para `synopsis_narrative`~~ **CANCELADA — SEM
      OBJETO (2026-08-23).** A decisão da opção A (rebind) foi **substituída** pela decisão
      do mantenedor de **remover as duas sinopses**. Rebindar um campo que vai ser apagado é
      trabalho jogado fora. O par invertido (editor gravava `synopsis`, página lia `synopsis_narrative`) fecha por remoção, não
      por correção de binding. Substituída por T4.0o. · `spec.md` §Gap 8
- [x] T3.3 — Teste de regressão do preço 55/40. · A8
      **Feito:** caso existente reforçado em `TableActionPanel.test.tsx` — asserções
      "R$ 55", "R$ 40 / sessão" e economia só como % (nenhum valor derivado).
- [x] T3.4 — ~~`packages/ui`: `color-scheme`~~ **SEM TRABALHO A FAZER (medido 2026-08-23).**
      O contrato já existe em `packages/ui/src/styles.css:1008-1058` desde `3ae4f6b`
      (2026-08-17), e o `mesas` já consome (`main.tsx:8`; o `index.css:111-113,241` do app
      documenta a remoção da versão local). O registro da Fase 2 ("zero ocorrências") estava
      errado. **A aprovação nominal que esta task exigia deixa de ser pré-requisito da
      Fase 3.** Sobra só A10 como conferência visual do mantenedor. · `spec.md` §Gap 7
- [x] T3.4b — **`confirm()` nativo → `useConfirm`** no painel do mestre (arquivar,
      desarquivar, ativar, desativar, deletar). Achado da auditoria de pacotes — conserto,
      não pergunta (AGENTS.md). **Feito:** as 2 chamadas nativas (ativar/desativar,
      arquivar/desarquivar) trocadas pelo `useConfirm` do design system, texto preservado,
      variante `warning` (precedente do `AdminTablesPanel`); `ConfirmProvider` já cobria a
      página. O delete já usava `InlineDeleteConfirmation` — fora da substituição.
- [x] T3.5 — 🔁 **GATE DE FASE** — reler `spec.md` §Gap 6, §Gap 7, **§Gap 8** e A5-A8, A10,
      **mais R24/A27** (faixa etária visível — T3.2f é desta fase e o gate não a listava:
      achado A7 da 3ª auditoria). **Passou:** cada critério conferido no código (A5-A8,
      R24/A27 item a item); Gap 8 não invadido (o corte é Fase 4); zero CSS tocado (A10).
      A conferência visual do menu aberto do `<select>` (A10) segue com o mantenedor —
      não é automatizável.
- [x] T3.6 — Validação do pacote afetado + `pnpm verify:api`; PR contra `dev`.
      **Feito:** backend 147/147, frontend 96/96 (arquivos afetados), `tsc` limpo nos dois,
      `verify:api` exit 0 (breaking=0). PR #285 aberta e **mergeada** em `dev`
      (`5da15b3`).

## Fase 4 — Editor de anúncio (frontend) · PR próprio — EM ANDAMENTO (2026-08-24)

**Estado:** Ondas 1 e 2 concluídas, seguidas de duas rodadas de revisão adversarial
(docs→código e bugs/duplicação/normalização) e duas ondas corretivas — ver a nota de
auditoria abaixo. Onda 1: backend (T4.0h-ter, T4.0p2, T4.0r, T4.7-backend), pacote
`catalog-ui` (T4.0h-bis) e esqueleto do editor no frontend (`features/table-editor/`).
Onda 2: consumo do seletor de 3 colunas (T4.0h-bis), legenda do banner (T4.0t-bis),
card "Horário Personalizado" (T4.0u), identidade do mestre (T4.0p/p2/q/r), prévia do
card (T4.2b), instrumentação (T4.0i), tela "minhas sugestões" (T4.0k), fechamento do
`catalog-matching` (T4.0g), migração do CSS e remoção do form antigo (T4.8). Restam:
conferência formal de gate (T4.9), validação final + PR (T4.10) e smoke visual do
mantenedor (A1/A2/A10 runtime).

**Regra de processo do mantenedor (2026-08-24):** agregar arquivos de código na
faixa ~300-700 linhas (nada de arquivo novo pequeno espalhado — o esqueleto foi
consolidado de 24 para 15 arquivos); testes só DEPOIS do desenho estabilizar (não
criar teste para arquivo que será refeito). Todo estado abaixo foi verificado
contra o código (o 3º subagente foi cancelado — sem relatório dele).

**Testes da onda 1 concluídos (2026-08-24):** 89/89 em 4 arquivos do editor —
`editorValidation.test.ts` (31), `editorMapping.test.ts` (35, entrada+saída),
`useTableEditor.test.tsx` (11, publish/autosave/restauração), `TableEditor.test.tsx`
(12, casca/navegação/A4/A15). Correções que os testes revelaram: import `DraftStatus`
com caminho errado no TableEditor (1 linha) e 7 chamadas a `setEditingTableId`
remanescentes no PainelMestrePage (estado redundante removido).

**Normalizadores/helpers (regra do mantenedor, 2026-08-24 — vale em TODAS as fases e
tasks):** toda task de código cita QUAL normalizador/helper existente usou — nunca
criar versão local do que o repo já tem. Inventário: `@artificio/media/image-kinds`
(`normalizeImageFrame`, `imageKindHint`), `utils/ageRating` (`normalizeAgeRating`),
`utils/safeExternalUrl` (`validateContactValue`), `table-editor/utils/editorMapping`
(`normalizePriceType` — subiu do mapper antigo na T4.8, junto com os comentários de
auditoria), `@artificio/catalog-matching`
(`normalizeSettingStyles`). Medição do editor (onda 2): editorMapping usa
`normalizeImageFrame` + `normalizeAgeRating` + `normalizePriceType` +
`normalizeSettingStyles`; editorValidation usa `validateContactValue` +
`normalizePriceType`; `normalizeFrequency` é helper local de 3 linhas sem equivalente
compartilhado. **`catalog-matching` consumido (onda 2 — T4.0g fechado):** `setting_styles`
é lido com `normalizeSettingStyles` do pacote, que preserva e deduplica — nunca
descarta; o backend já normalizava na escrita (medido).

**CSS do editor (migrado na onda 2 — achado do mantenedor de 2026-08-24):**
`TableEditor.css` caiu de ~354 para **89 linhas**, permanecendo só a casca imersiva
(fixed/`100dvh`/grid de 3 faixas/coluna de 212px/`min(900px,100%)`), que nenhum pacote
fornece. As regras utilitárias (flex/gap/padding/fonte/largura) viraram classes
Tailwind no markup; as reestilizações de primitives (`.artificio-field`/
`.artificio-control` 206px, campo de 120px) migraram por **markup com `!important`
medido e justificado** (Baymard 206px/120px) — sem reestilização local de primitive.

**Auditoria de padrões do código novo (2026-08-24 — preocupação do mantenedor: aderência
aos padrões, não só funcionamento).** Conforme: primitives de `@artificio/ui` nos
controles; tokens `var(--*)` do pacote (sem hex fixo); `authenticatedFetch`
(`authPost`/`authPut`/`authPatch`) em toda escrita; `fetch` cru SÓ em rotas públicas
(sistemas/cenários — mesmo precedente de `useVttPlatforms`); ícones e convenções de
acessibilidade. **Desvios encontrados e CORRIGIDOS nesta rodada:**
- `TableEditor` reimplementava o fetch/normalização/flatten de sistemas quando o repo
  JÁ tem `hooks/useSystemsCatalog` — trocado pelo hook compartilhado
  (`CatalogoPage`/`OnboardingPage` usam o mesmo);
- as parts usavam o `MarkdownEditor` local, que é **adaptador temporário legado** do
  `@artificio/content-editor` — código novo agora importa o `ContentEditor` do pacote
  direto (IdentityPart/ExtrasPart/ValuesPart);
- "← Voltar" com seta de texto → ícone `ArrowLeft` do lucide-react (padrão do app).
Regra para as próximas ondas: antes de criar helper/fetch/estilo local, verificar o
hook/pacote/utilitário existente — reimplementar padrão existente é o desvio.
**Segunda varredura (mesma sessão) — mais desvios achados e corrigidos:**
- `parsePriceValue`/`parseClearablePriceValue` estavam **copiados** no editorMapping
  (função + comentários de auditoria NaN→null duplicados do mapper antigo) → agora
  exportados do mapper antigo e importados (fonte única; migram para `editorMapping`
  na T4.8, junto com os normalizadores de preço);
- `getPartIndex` export morto no TableEditor → removido;
- **limites do editor mais lenientes que o backend** (causaria 400 no submit):
  `notes` de sessão (backend 500, editor sem limite — 2 editores) e `city` (backend
  100, editor sem limite) → `maxLength` adicionados; conferido o resto do contrato
  (description 5000, rules_notes 2000, billing 500, technical 1000, bio 2000, title
  200 — editor = backend);
- `textLimitError`/`titleError`/`descriptionError` recalculavam o excesso → agora
  usam `contentOverflow` do `@artificio/content-editor`.
**Revisão adversarial (onda 2) — 2 revisores (docs→código e bugs/duplicação/normalização),
aprovado com ressalvas; correções aplicadas e testadas:**
- **C1 (race autosave×publish):** timer de autosave pendente fazia `POST` concorrente
  ao publish → mesa duplicada. Corrigido com `publishingRef` + `cancelPendingAutosave`
  + flag `active`; teste com fake timers.
- **C2 (rascunho local contaminando criação):** dado de edição vazava para uma criação
  nova — autosave local desabilitado em `isEditing`; `clearDraft` cancela timers (evita
  ghost pós-publish).
- **C3 (parse_case_id reenviado):** o id era mandado a cada autosave remoto — agora só
  no payload do publish (`includeParseCaseId`).
- **B1 (restauração sem validação de shape):** rascunho inválido crashava o publish —
  `isValidDraftState` valida arrays/objetos/elementos; inválido → warn + clear.
- **B2/B3 (sem normalização):** `next_schedule` e `useVttPlatforms` não normalizavam —
  guard no card + zod no hook.
- **A3 (obrigatórios duplicados):** `REQUIRED_FIELDS_FOR_PROGRESS` × `REQUIRED_FIELD_IDS`
  unificados — `isFieldFilled` derivada em `editorValidation`.
- **D5 (city/state presos ao trocar para online):** limpos em `handleModalityChange`.
- **D7 (limites nos contatos):** `maxLength` value 500 / label 100 / discord 500.
- **A4 (DDAL espelhado front/back):** `DDAL_ELIGIBLE_PATHS` com comentário cruzado entre
  as duas camadas (já em `origin/dev`).
- **A2 (validação do Discord):** já delegava a `safeExternalUrl` — medido, sem
  reimplementação.
**Validação final das rodadas corretivas:** front `tsc -p tsconfig.test.json` 0 erros;
backend `tsc` 0; suítes pontuais 179/179 (onda 1) e 76/76 (onda 2); eslint 0;
`verify:api` exit 0 (breaking=0, rodado pelo orquestrador).
**Achados laterais em aberto para o mantenedor (não são do editor):**
- `services/apiClient.ts` × `utils/authenticatedFetch.ts` são dois wrappers HTTP/auth
  no repo (retry/dedup/refreshSession em ambos); o editor usa `authenticatedFetch`,
  consistente com o fluxo antigo que substitui — unificar é decisão do mantenedor.
- `formatWhatsAppDisplay` (`utils/safeExternalUrl`) exibe número internacional errado:
  `+1415...` vira `(14) 15555-2671` — o link do WhatsApp sai correto, o **display é
  inventado** para número fora do padrão BR. Correção é decisão do mantenedor.
- **Janela de deploy:** o form antigo (`CreateTableForm`) segue em produção até a
  Fase 4 ser deployada; o backend novo já aceita os dois fluxos — sem janela de
  quebra, mas a remoção do form antigo só chega à prod junto do deploy da Fase 4.

- [x] T4.0 — **Cruzar a tabela de paridade** (`plan.md` §Frontend — paridade de features)
      linha a linha antes de escrever. Feature não migrada = task reaberta. · A12
      **Feito (medido):** a conferência linha a linha de `plan.md` §Frontend foi
      executada pela revisão adversarial (vereditos 1-14) e fechou com **2 desvios
      corrigidos** (o `MarkdownEditor` local→`ContentEditor` do pacote e o "← Voltar"
      com ícone `ArrowLeft`); sem feature não migrada. O fechamento formal do gate fica
      em T4.9.
- [x] T4.0a — Componentes ricos preservados, **não reescritos como input simples** —
      **exceto dois, que outras tasks desta mesma fase substituem** (M2 da 2ª auditoria):
      `ContactsFormBlock` → base passa a ser o `ContactMethodsEditor` (**T4.0r**), e o fluxo
      de `SystemPicker` → o **wrapper permanece**, o **fluxo** muda conforme **T4.0h-bis**. Os demais:
      `SystemPicker` (árvore hierárquica), `SystemSuggestionModal` (3 níveis
      sistema→edição→variante, cadeia encadeada, caminho de admin), `ScenarioSelector`
      (busca com normalização de acento) + `ScenarioSuggestionModal`,
      `SettingStylesField` (sugestão de estilos pelo nome do
      cenário),       `MarkdownEditor` **nos campos que sobrevivem ao corte** — 5, ver T4.0m (o registro antigo
      dizia 7; a contagem real do fluxo atual é 9).
      **Feito (medido):** imports do editor reusam os componentes ricos — `ContentEditor`
      do pacote (substitui o `MarkdownEditor` local), ScenarioSelector, SettingStylesField,
      ImageUploader, `ContactMethodsEditor` (o `ContactsFormBlock` foi removido na T4.0r),
      System/ScenarioSuggestionModal, ParsePreviewTextArea; o `SystemPicker` foi substituído
      pelo `CatalogSystemSelector` na T4.0h-bis. Conferência item a item no gate T4.9.
- [x] T4.0a-bis — ~~Sistema de imagem inteiro~~ **FUNDIDA EM T4.0t (2026-08-24).** Era a
      mesma task, escrita duas vezes com uma contradição no meio: pedia **"mais o avatar do
      mestre (`gmAvatarUrl`)"**, campo que **T3.2c manda REMOVER do contrato** (decisão de
      2026-08-23, opção C — o campo não tem UI e a resposta da API é alias computado). As
      duas se cancelavam. A lista de capacidades vive agora só em T4.0t, com a tabela de
      §Gap 10 como fonte. Achado crítico 2 da auditoria de 2026-08-24.
- [x] T4.0t — **Banner abaixo do título + sistema de imagem sem regressão** (R19, A22).
      **Feito (medido):** IdentityPart reusa o `ImageUploader` existente logo abaixo do
      título; as 13 capacidades do banner viajam com o componente e foram conferidas uma a
      uma (`spec.md` §Gap 10 item 2 — a 13ª é `aria-live`/`role="alert"`). A legenda que
      orienta o mestre é a T4.0t-bis (feita). O motivo de existir como task própria segue
      válido: tratar "banner" como campo simples é o erro recorrente que esta task evita.
- [x] T4.0t-bis — **Legenda que faz o mestre prever o resultado** (R19, A22 — pedido de
      2026-08-24).
      **Feito (medido):** o `ImageUploader` consome `imageKindHint(kind)` (frase com
      proporção 1200×650, formatos JPG/PNG/WEBP, limite 5 MB); valores 100% do
      `imageKindSpec`, nunca de literal; as 13 capacidades do banner preservadas.
      **Correção de registro:** o helper (`imageKindHint`, `minWidth`/`minHeight`,
      `recommendedWidth/Height`, `acceptedMimeTypes`) **já está em `origin/dev`** — o
      registro anterior dizia "entra no próximo commit / `git grep minWidth origin/dev` →
      zero", que é FALSO (medi o helper presente em `origin/dev`). **A legenda orienta sem
      impor:** nenhum validador consome `minWidth`; transformar o mínimo em bloqueio é
      decisão à parte. **PNG: nada a alterar** — cadeia inteira verificada, incluindo
      Cloudinary sem `allowed_formats`.
- [x] T4.0u — **Um horário só, com "horário personalizado"** (R20, A23).
      **Feito (medido):** WhenPart grava `schedule_day_status='to_define'` + texto em
      `notes`, sem repeater; o card exibe **"Horário Personalizado"** (rótulo + subtítulo
      com notes) quando `next_schedule.schedule_day_status='to_define'`
      (`TableCard.tsx:232-243`); o backend da **LISTA** passou a devolver
      `schedule_day_status`+`notes` no `next_schedule` (aditivo, sem migration, detalhe
      intacto). Testes: back 13/13, front 12/12. **"Vagas por sessão" nunca foi exibido no
      card — nada a remover** (correção de registro). Mesa legada com 2+ horários: o
      editor exibe o primeiro (menor `sort_order`) e preserva os demais no banco — nunca
      apaga o que não mostra (decisão de 2026-08-24).
- [x] T4.0w — **Segurança de mesa e local** (R23, A26 — decidido 2026-08-24). **Nada de
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
      **Feito (medido):** AudiencePart (pills dos 14 termos do glossário + entrada livre)
      e WherePart (cidade/estado só em modalidade não-online).
- [x] T4.0v — **Requisitos junto da plataforma; valores reunidos** (R21, A24). Os 3
      checkboxes (`requires_pc`/`requires_camera`/`requires_microphone`) formam **lista
      explícita** na parte "Onde joga", ao lado do VTT que os auto-marca (R3) — medido:
      **já são checkbox** (`StepFinal.tsx:359-388`), o defeito é o lugar, escondidos no
      colapsável a duas etapas do select. E **todos os campos de valor numa parte só**, na
      ordem da decisão: hoje `price_type`       (`StepConfig.tsx:343`) e `accepts_donations`
      (`:391`) estão numa etapa, `billing_text` (`StepFinal.tsx:247`) e `session_zero_free`
      (`:267`) noutra.
      **Feito (medido):** WherePart (3 requisitos ao lado do VTT) + ValuesPart (valores
      todos numa parte: tipo, avulso, mensal, doação, sessão zero, billing). A
      auto-marcação por VTT é da Fase 5 (T5.3).
- [x] T4.0b — **Covil admin-only** (`userRole === 'admin'`) e **DDAL em D&D 5e 2014 ou
      2024** com os **9 campos** e o efeito que desmarca ao trocar de sistema. · A13, A14
      **Feito (medido):** ExtrasPart com Covil gateado por role e DdalBlock com os 9
      campos; elegibilidade via `DDAL_ELIGIBLE_PATHS` (2014+2024) e desmarca automático
      no TableEditor. **Nota:** a correção DDAL veio na PR #284 (`3ccdc92`) — esta task
      herdou a constante de `origin/dev`, não a recriou.
      **Correção de registro (onda 2):** o registro anterior afirmava que
      `DDAL_ELIGIBLE_PATHS` "NÃO está em `origin/dev` / `git grep` → zero" — **FALSO**:
      medi o símbolo presente em `origin/dev` (backend `tableService.ts:18` e frontend
      `CreateTableForm.tsx`). O conteúdo da correção: a regra cobria só o path de 2024 em
      dois lugares (`CreateTableForm.tsx:26` e `tableService.ts:7`), então mesa de 5e 2014,
      que é DDAL legítima, não conseguia marcar o selo. Virou `DDAL_ELIGIBLE_PATHS` com os
      dois slugs medidos no catálogo real (`dungeons-dragons/5e/2024` e
      `dungeons-dragons/5e/dungeons-dragons-5e-2014` — o de 2014 não é simétrico ao de
      2024). No editor novo a constante é espelhada front/back com comentário cruzado (A4);
      front e backend continuam tendo de concordar.
- [x] T4.0c — Rascunho local sem regressão: modal "Rascunho encontrado" com
      Continuar/Descartar, expiração de 7 dias, `beforeunload`, limpeza de `parseCaseId`
      ao restaurar (senão contamina `discord_parse_cases`). · A15
      **Feito (medido):** useAutosave + draftStorage + beforeunload em useTableEditor;
      modal de restauração no TableEditor; `parseCaseId` zerado ao restaurar
      (useTableEditor:257-263).
- [x] T4.0d — Condicionais e efeitos: limpeza de campo invisível ao trocar cobrança/doação,
      "Personalizado" com aviso, fallback de catálogo com erro, reconciliação UUID↔slug de
      VTT na edição, cobrança detalhada quando `paga` **ou** já houver `billingText`.
      **Feito (medido):** ValuesPart:32-35 (limpeza ao trocar tipo) e WherePart
      (Personalizado, Banner de fallback, UUID↔slug).
- [x] T4.0e — **Regras de validação preservadas** (`plan.md` §Regras de validação): erro
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
      **Feito (medido):** editorValidation.ts com `partOfField` (erro leva à parte),
      `validateContactValue` (fonte única), `textLimitError` com contagem de excesso,
      título 3-200; conferência dos limites campo a campo no gate T4.9.
- [x] T4.0f — **Regras do mapper preservadas** (`plan.md` §Regras do mapper): `''` zera ×
      `undefined` preserva; guard `Number.isFinite` nos preços; contatos vazios filtrados;
      primeiro dia/horário derivado; `notes`/`slots_per_session` omitidos quando vazios.
      **Feito (medido):** editorMapping.ts com omissão REAL de `undefined` (chave
      deletada — `null` zera e permanece); teste editorMapping.test.ts 18/18.
      **Normalizadores usados:** `normalizeImageFrame`, `normalizeAgeRating`,
      `normalizePriceType` (reusados — nenhum reimplementado); `normalizeFrequency`
      local (sem equivalente compartilhado). Pendência de normalizador do
      `setting_styles` — **fechada na T4.0g** (lido com `normalizeSettingStyles` do
      `@artificio/catalog-matching`).
- [x] T4.0h-bis — **Seleção de sistema: três colunas com busca por nível** (R18, A21).
      **Feito (medido):** `CatalogSystemSelector` novo no pacote `catalog-ui` (3 colunas
      Sistema·Edição·Variante, cada uma com caixa de busca própria, coluna sem filho não
      aparece, busca server-side `?search=`/`?parent_id=`) **e consumo no editor completo**
      — IdentityPart usa o `CatalogSystemSelector`, `onSuggest` ligado ao
      `SystemSuggestionModal` existente, aliases por extenso em `selection` (reversão da
      D0.5, vale também no `CatalogSystemPopover`); teste do popover atualizado. Demais
      consumidores (`SystemPicker`, `ScenarioSelector`, `DraftEditorTab`, admin, catálogo)
      mantêm o empilhamento. 29/29 testes do pacote.
- [x] T4.0h-ter — **`GET /systems` aceita `parent_id`** (R18, A21) — **única mudança de
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
      **Feito (medido):** implementado na rota sobre `loadFlat()` — caminho ÚNICO para
      central e projeção local; `search` combinável, `limit`/`cursor` preservados; 6
      testes; `verify:api` exit 0 (breaking=0). O OpenAPI não modela query params — só o
      inventário regenerou (números de linha).
- [x] T4.0h — ~~Seleção de catálogo de ponta a ponta~~ **SUPERADA por T4.0h-bis/T4.0h-ter
      (2026-08-24).** Descrevia o modelo **antigo** — "navegação por nós em colunas" —, que
      o mantenedor substituiu pelo fluxo **progressivo** (sistema só busca → edição abre se
      houver → variante abre se houver; R18). E reabria como pendência a conferência dos
      `aliases`, **já encerrada por medição**: a rota devolve populado
      (`"aliases":["The Masquerade","Vampiro","VtM"]`), 199 sistemas têm alias.
      Achado alto 4 da auditoria de 2026-08-24. · R13, R14, R18
- [x] T4.0l — **O editor nasce sobre `ui/primitives`** (R16, A16). Baseline medido: o fluxo
      atual importa **zero** de `@artificio/ui` em 4.117 linhas, com 16 primitives ociosos.
      Usar `Field` (label+hint+error+required, com `role="alert"` no erro —
      `primitives.tsx:141-160`; **`aria-invalid` fica nos controles**, via prop `invalid` de
      `TextInput`/`Textarea`/`Select`, `:170-190`), `TextInput`, `Textarea`, `Select`, `Button`, `Panel`,
      `Modal`, `Drawer`, `Badge`, `Banner` e os quatro estados
      (`Loading`/`Empty`/`Error`/`Success`) em vez de controle cru. Todo `<input>`/`<select>`/
      `<textarea>`/`<button>` nativo remanescente carrega comentário inline dizendo por que o
      primitive não serve. Mata de passagem três duplicações medidas (ErrorState
      local, "Carregando..." inline, `<select>` cru).
      **Feito (medido):** todos os componentes do editor importam Field/TextInput/Textarea/
      Select/Button/Panel/Badge/Banner/Modal de `@artificio/ui`; zero controle cru nos
      arquivos do editor (grep). Grep de A16 (zero cru) repete no gate T4.9.
- [x] T4.0m — **Aplicar o corte dos campos de texto** (R17, A17), decidido em 2026-08-23:
      o editor novo **não tem** "Sinopse narrativa" (nenhuma das duas), "Descrição do estilo
      de jogo", "Resumo alternativo para listagens" nem "Benefícios e diferenciais". Ficam
      **5** editores. **Só a UI sai — as colunas permanecem no banco** (T7.3b); não escrever
      migration por causa deste corte. Tabela campo a campo em `spec.md` §Gap 8.
      **Feito (medido):** zero editor dos 5 campos cortados no editor (grep); o teste
      editorMapping.test.ts fixa a ausência no payload.
- [x] T4.0o — **"Regras e observações da mesa" logo abaixo da Descrição** (R17, A17). Hoje
      vive no colapsável de avançados do `StepFinal.tsx:179`, longe do texto principal;
      35/107 mesas já têm conteúdo ali. No editor novo os dois ficam juntos, na mesma parte.
      Complementa T7.2b, que dá exibição pública ao campo.
      **Feito (medido):** rulesNotes logo abaixo da Descrição em IdentityPart
      (IdentityPart.tsx:155-160).
- [x] T4.0p2 — **Criar o perfil de mestre dentro do editor** (R12 — decisão do mantenedor,
      2026-08-24).
      **Feito (medido):** o perfil nasce junto da mesa — ordem perfil→mesa; se a mesa
      falhar, o perfil permanece criado (comentado e testado). `CreateGmProfileForm`
      removido do fluxo; `POST /gm/profile` aceita `contact_methods` (mesmo schema do PUT).
- [x] T4.0p — **Herança da identidade do mestre** (R12, A19). Pré-carregar do perfil de
      mestre, **sem escrever nele**; não editou = mesa espelha o perfil; editou = vira
      valor daquela mesa e o perfil permanece intacto (A19 prova por teste).
      **Feito (medido):** herança pré-carregada — `bio_long`→`tableGmBio`,
      `nickname`→`masterDisplayName`, `contact_methods`→contatos; `omitInherited` em
      nome/bio; **contatos propositalmente NÃO omitidos** (a página pública não tem fallback
      de contatos — omitir os herdados os faria sumir). Publicador anunciante não herda
      nada: repeater entra vazio, como hoje.
- [x] T4.0r — **UM editor de contatos, servindo perfil E mesa** (R12, decisão 2026-08-24).
      **Feito (medido):** um único `ContactMethodsEditor` — base = a estrutura do perfil
      (`components/mestre/ContactMethodsEditor.tsx`), **não** o `ContactsFormBlock` — serve
      mesa e perfil; ordenação por **setas ↑↓**, sem drag; erro por linha via
      `validateContactValue` (fonte única); **7 canais nos dois lados** —
      `MestreContactMethods` ampliado para 7 e o tipo consolidado numa fonte só
      (`types/tables.ts`), alinhado ao `CONTACT_CHANNELS` do backend; o perfil passou a
      aceitar os 7 (`PROFILE_CONTACT_CHANNELS`, validação + serialização + exibição).
      Metadados de canal consolidados em `components/mestre/channelMeta.ts` (A1);
      `formatWhatsAppDisplay` movida para `utils/safeExternalUrl` (A5). **`ContactsFormBlock`
      REMOVIDO** (órfão — grep zero).
- [x] T4.0s — **Faixa etária vira recomendado** (R6.1): tirar o asterisco decorativo de
      `StepConfig.tsx:334` (que nunca teve validação por trás — o select tem default
      `'livre'`) e marcar o campo como **recomendado**, com a frase do ganho — **a redação é do implementador**
      (o R6 dá o padrão com o exemplo do banner); sugestão: "ajuda o jogador a saber se a mesa
      é para ele". Publicar não é
      bloqueado por ele. O dado errado em produção se resolve por T3.2/A5 (payload aceitar
      `age_rating`), não por obrigatoriedade.
      **Feito (medido):** `RECOMMENDED_GAIN.ageRating = 'ajuda o jogador a saber se a mesa
      é para ele'` (editorValidation.ts:73); campo sem asterisco, opção vazia
      "Selecione a faixa etária" para mesa antiga com faixa nula (AudiencePart).
- [x] T4.0q — **Botão "Sincronizar com o Perfil Principal de Mestre"** (R12, A20). Texto
      **exato**, definido pelo mantenedor — não parafrasear.
      **Feito (medido):** botão com o texto exato, visível **só** para gm em estado editado;
      grava o campo herdado (bio/nickname/contatos) no perfil (`gm_profiles`) — a única
      escrita mesa→perfil do editor, sempre deliberada (A20 provado por teste: salvar a mesa
      sem clicar não toca `gm_profiles`).
- [ ] T4.0n — **Alinhamento vem do pacote** (A18). Medir A2 com os controles já dentro de
      **Estado:** aguarda a medição de A2 no gate (só tocar o pacote se sobrar desalinho;
      conferir também a declaração duplicada de `.artificio-field`).
      `Field`; se sobrar desalinho, a causa é `.artificio-field` não fixar altura de rótulo
      (`styles.css:945-955`, `display:grid` sem `min-height` no label) — **corrigir no
      pacote** (autorização de escopo de 2026-08-24 cobre a edição; commit/push/PR seguem por
      ação), nunca no CSS do `mesas`. Conferir de passagem a
      declaração duplicada de `.artificio-field` (`:728` e `:945`).
- [x] T4.0i — **Instrumentação** (R15): eventos de início, publicação, abandono e uso do
      parser via `@artificio/analytics`. Hoje o fluxo emite zero eventos (medido).
      **Feito (medido):** 4 eventos via `@artificio/analytics` — `editor_open`/`publish`/
      `abandon`/`parser_use`, na convenção do pacote, sem PII; abandono sensível
      (`isDirty && !isActive` no unmount).
- [x] T4.0j — ~~Identidade do mestre: editar grava no perfil~~ **OBSOLETA — NÃO EXECUTAR
      (2026-08-24).** Descrevia a mecânica **substituída** pelo mantenedor: "editar grava no
      perfil, a mudança vale para todas as mesas". A mecânica vigente é a inversa —
      pré-carrega do perfil e **editar vira valor daquela mesa, com o perfil intacto**
      (R12). O "qual par é a fonte" também já foi medido e decidido: `gm_profiles`
      (`bio_long`/`nickname`/`contact_methods`), porque é o que a página pública lê
      (`tableViewMapper.ts:278`, `tables.ts:158,637`).
      **Substituída por T4.0p** (herança) **e T4.0q** (botão de sincronizar).
      Mantida marcada e visível de propósito: executar esta task desfaria a decisão do
      mantenedor — achado crítico 1 da auditoria de 2026-08-24.
- [x] T4.0g — **Pacotes compartilhados mantidos** (`plan.md` §Pacotes compartilhados):
      `@artificio/content-editor` (inclusive `contentCountLabel`/`contentOverflow` no
      parser), `@artificio/image-editor`, `@artificio/media/image-kinds`,
      `@artificio/catalog-matching` — no lugar do local
      `services/systemSuggestionCandidates.ts` (560 linhas, assinatura idêntica); **a troca
      dos 2 importadores backend é executada por T7.1b**, não aqui.
      **Não são pacotes, são utilitários locais do `mesas`** (correção da 3ª auditoria) —
      consumir como estão, sem tratá-los como compartilhados: `utils/safeExternalUrl`,
      `utils/authenticatedFetch`, `contexts/useAuth`.
      **Feito (medido):** content-editor, image-editor e media/image-kinds consumidos;
      **`catalog-matching` consumido (pendência fechada)** — `setting_styles` lido com
      `normalizeSettingStyles` do pacote (editorMapping), que preserva e deduplica — nunca
      descarta; o backend já normalizava na escrita (medido). Resta só T7.1b (troca dos 2
      importadores backend).
- [x] T4.0k — **Consumir API existente, não criar endpoints** — atenção ao escopo: a parte
      de notificações EXECUTA NA FASE 7 (T7.4b); aqui só a tela "minhas sugestões" e o
      botão de sugerir VTT.
      **Feito (medido):** tela "minhas sugestões" (`features/suggestions/` +
      `/perfil/minhas-sugestoes/:suggestionId?`) consumindo `GET /system-suggestions/mine`
      e `/scenario-suggestions/mine`, + botão sugerir VTT (`POST /vtt-platforms/suggest`);
      **zero endpoint novo**; zero notifications aqui (Fase 7). 21/21 testes.
      **Decisão do mantenedor (2026-08-24) que rege a Fase 7 (T7.4b):** notificações de mesa
      passam a ser gravadas no sistema do **accounts** — o `NotificationBell` de
      `packages/ui` já lê por `source_app` (`:174-182`). Exige `POST` novo no accounts,
      repontar os **6 escritores** do mesas, migrar as **66** notificações (escrita em
      produção → aprovação nominal) e remover as 3 rotas de leitura órfãs do mesas.
      Detalhe completo na T7.4b.
- [x] T4.1 — Casca de altura fixa: `100dvh`, sem rolagem em nenhum nível. · A1
      **Feito (medido):** TableEditor.css — `100dvh` + `overflow: hidden` na casca e nas
      faixas internas.
- [x] T4.2 — Lateral: partes, contagem de pendências, progresso. Botões criados **uma
      vez** (recriar mata o clique — bug medido no protótipo).
      **Feito (medido):** EditorSidebar (memo + key estável por parte) com pendências e
      progresso — TableEditor.tsx.
- [x] T4.2b — **Prévia do card + "Ver como jogador"** (R22, A25 — decidido 2026-08-24).
      **Feito (medido):** prévia na lateral com o **`TableCardComponent` real**, montando o
      objeto `TableCard` com os MESMOS mappers do payload (`cardPreviewMapping`);
      "Ver como jogador" abre em nova aba — só com `slug`+`active`; rascunho desabilitado
      com tooltip. Exceção A1 documentada no CSS (área da prévia).
- [ ] T4.3 — Campos sempre abertos, largura por conteúdo esperado, rótulo de altura fixa
      para alinhar os controles da linha. · A2
      **Estado:** campos abertos e larguras prontos; o rótulo de altura fixa (A2) fica
      para a medição do gate — T4.0n se sobrar desalinho.
- [x] T4.4 — Criar e editar na mesma tela; estado (rascunho/no ar) só muda selo e botão.
      Alterar campo de mesa no ar em 2 interações. · A3
      **Feito (medido):** PainelMestrePage passa `TableEditorInitialData` (edição) ou nada
      (criação); EditorTopBar troca selo/botão por estado.
- [x] T4.5 — Três níveis de campo com marca e explicação; validação no blur e ao
      publicar; mensagem por campo. · A11, R6
      **Feito (medido):** EditorField com `data-ob` (3 níveis + frases do ganho),
      `validateFieldOnBlur` e `validateEditorAll` no publish, mapa de erro por campo.
- [x] T4.6 — Publicar com pendências **revela** o que falta (não desabilita o botão):
      marca todos, foca o primeiro, lista as partes. **Nada é salvo nesse clique** (decisão do
      mantenedor, 2026-08-24): a validação não grava; a mesa continua como estava, e o
      autosave segue por conta própria. · A4
      **Feito (medido):** publish valida tudo ANTES do fetch (retorna false com
      `revealedPending` → foco no primeiro erro + EditorPendingFooter lista as partes);
      nenhuma escrita acontece nesse clique.
- [x] T4.7 — Promover o rascunho ao backend (`status='draft'`) **preservando** o que já
      existe em `useAutosave`/`draftStorage`; painel do mestre distingue rascunho de mesa
      no ar. · R10
      **Feito (medido):** create sem status nasce `draft` (default real da coluna);
      promoção SÓ via `PATCH /gm/tables/:id/status` (PUT rejeita `status`); POST/PUT sem
      `status` + PATCH de promoção; autosave remoto (debounce 2,5s, SÓ rascunho — mesa
      ativa nunca tocada; POST cria e guarda o id, PUT atualiza, falha → toast); painel
      com `DraftTableCard`; rascunho segue o mestre sem prazo (local vira cache de
      digitação; abandonado permanece no banco — aceito). Testes do hook (11) + blindagem
      da revisão adversarial: publish de criação com rascunho remoto usa PUT no MESMO id
      (race autosave×publish C1), autosave local desligado em edição (C2), parse_case_id
      só no publish (C3).
- [x] T4.8 — Remover `CreateTableForm`, `useStepNavigation` e `components/form-steps/*`.
      **Feito (medido):** form antigo REMOVIDO — 18 arquivos, −4.220 linhas
      (`CreateTableForm`, `useCreateTableForm`, `useStepNavigation`, `form-steps/*`,
      `create-table/types/*`, mapper/validation/`mapTableApiToInitialData` + testes); os
      normalizadores de preço sobem para `editorMapping` (comentários de auditoria
      preservados, 12 testes); grep final só menções históricas em comentário; `DraftStatus`
      exportado de `useAutosave.ts`; sobram `useAutosave`/`draftStorage`/`ParsePreviewTextArea`
      (consumidores legítimos).
- [ ] T4.9 — 🔁 **GATE DE FASE** — reler `spec.md` R1, R2, R6, **R6.1**, R10, R11, **R12,
      R16, R17, R18, R19, R20, R21, R22, R23** e **R13** (consumo dos pacotes) e **R15** (instrumentação) e A1-A4,
      A11-A15, **A16-A26**, mais a tabela de
      paridade **linha a linha**. (Lista ampliada em 2026-08-24 após auditoria: faltavam
      justamente R12 e R18-R21 — as decisões que esta fase implementa.) O gate anterior desta spec deixou passar
      6 features (autosave, modal de rascunho, `beforeunload`, Covil admin-only, DDAL
      condicional, contatos multi-canal) porque a tabela foi montada por grep — aqui se
      confere contra o arquivo, não contra a memória.
- [ ] T4.10 — Validação do pacote afetado; PR contra `dev`.
      **Nota de validação (medido 2026-08-24):** no frontend do mesas,
      `tsc -p tsconfig.json --noEmit` é FALSO VERDE (project references, checa 0
      arquivos) — o type-check real é `npx tsc -p tsconfig.test.json --noEmit`.
      **Estado:** não iniciada (só depois de T4.8 + T4.9).

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
