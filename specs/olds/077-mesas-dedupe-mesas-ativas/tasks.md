# Tasks — 077 mesas dedupe mesas ativas

Execução: Codex. Ordem estrita — Fase 0 completa (com evidência) antes de
qualquer task de código de feature.

## Fase 0 — Investigação (bloqueia tudo abaixo)

- [x] Atualizar `specs/backlog.md` e `project-state.md` (abertura da spec).
- [x] Confirmar schema real de `tables` (campos usáveis pra hash/score) —
      registrar evidência (arquivo:linha) em `sessoes/`.
- [x] Levantar volume real de mesas ativas (`count(*)`, read-only) —
      registrar número e se full-scan síncrono é viável.
- [x] Escrever teste exploratório do algoritmo de score contra amostra real
      de `tables` — registrar quantos pares candidatos aparecem hoje.
- [x] Propor e registrar em `plan.md`: tabela nova vs. extensão de
      `discord_duplicate_candidates`.
- [x] Propor e registrar em `plan.md`: gatilho sob demanda vs. automático.
- [x] Levar decisões ao mantenedor e obter aprovação explícita antes de
      migration/rota nova.

## Fase 1+ — Implementação (só após Fase 0 aprovada)

- [x] Migration: tabela de candidatos mesa×mesa (ou ajuste decidido).
- [x] Backend: serviço de comparação/score mesa×mesa.
- [x] Backend: rota `GET /admin/tables/duplicates`.
- [x] Backend: rota `PATCH /admin/table-duplicate-candidates/:id`.
- [x] Backend: estender detecção draft×mesa ativa (não só draft×draft).
- [x] Frontend: badge de duplicata em `DiscordDraftReviewTable.tsx`.
- [x] Frontend: tela/aba de gestão de duplicatas com link direto pras duas
      pontas (mesa pública + admin + draft).

## Fase 2 — Testes e validação

- [x] Teste unitário do serviço de score (par idêntico, par parecido só no
      sistema, par sem relação).
- [x] Teste de rota (`GET`/`PATCH`) cobrindo `requireAdmin` e payload
      inválido.
- [x] `pnpm run lint` + `pnpm run build` (backend + frontend mesas).
- [ ] Smoke manual real: par de mesas ativas semelhantes aparece como
      candidato na tela de gestão (não fechar só com teste unitário).
- [ ] Atualizar `specs/backlog.md` e `project-state.md` (fechamento/status).

## Frente UX — ações rápidas e scan automático (2026-07-16)

Continuação da spec 077 pedida pelo mantenedor após confirmar que o badge de
duplicata (Fase 1+, já `[x]` acima) funcionava conforme desenhado. Sessão:
`sessoes/26-07-16_2_mesas_077-badge-duplicata-e-botoes-rascunho.md`.

- [x] U1 Confirmar badge "possível duplicata (N)" já visível no card de
      rascunho, do lado do %, sem necessidade de código novo
      (`DiscordDraftReviewTable.tsx:461-465`, populado por
      `listTableDuplicateCandidates()`).
- [x] U2 Adicionar botões "Revisar"/"Rejeitar" por linha no card de rascunho
      (do lado esquerdo da data), mantendo a seleção em lote existente
      (checkbox + "Rejeitar selecionados"). Reusa `setSelectedDraft` e
      `rejectDraftIds([draft.id], ...)`. Só visível quando
      `status !== 'synced' && status !== 'rejected'`.
      Arquivo: `apps/mesas/frontend/src/features/discord-sync/components/DiscordDraftReviewTable.tsx`.
      Validado: `tsc --noEmit` + `eslint` limpos. Preview visual local
      bloqueado por SSO cross-domain (cookie de `mesas.artificiorpg.com` não
      atravessa pra `localhost:5173`); confirmado por leitura estrutural do
      JSX + type-check, não por screenshot.
- [x] U3 Disparar `scanTableDuplicateCandidates()` automaticamente ao final do
      import de arquivo/paste DiscordChatExporter (tela `/gestao/importacao`
      → "Importar arquivo"), sem exigir clique manual em "Checar duplicatas".
      Fire-and-forget (`.catch()`, não atrasa a resposta HTTP), condicionado a
      `autoParse.parsed > 0` (só roda se o parser efetivamente criou/atualizou
      draft — scan é full-scan, sem sentido em import vazio).
      Arquivo: `apps/mesas/backend/src/routes/discord/import.ts`
      (`respondImportSuccess`, cobre `POST /` e `POST /file`).
      Validado: `tsc --noEmit` + `eslint` limpos.
      Escopo explicitamente confirmado pelo mantenedor: só o fluxo de
      import de arquivo/paste JSON. Fetch automático do bot, reparse
      individual e inbox de texto colado (`routes/inbox/import.ts`) ficaram
      fora do pedido — mapeados em `sessoes/26-07-16_2_...md` como ampliação
      de escopo futura, não decidida.
- [ ] U4 `pnpm run lint` + build repo-wide (validação pontual já rodada por
      pacote; falta rodar suíte completa antes de fechar a frente).
- [ ] U5 Smoke manual real: importar JSON com mesa parecida a uma ativa,
      confirmar candidato aparece na aba Duplicatas e badge aparece no card
      de Rascunhos sem clique manual.
- [ ] U6 Autorização do mantenedor para commit/push/PR (nenhuma autorização
      dada ainda; regra pétrea — não commitar por inferência).
- [x] U7 Bug real reportado pelo mantenedor com caso de produção (anúncio "O
      Sangue das Estrelas"): parser não marcava `requires_pc`/
      `requires_microphone` mesmo com VTT (Roll20) e Discord detectados por
      catálogo — regra antiga só contava texto explícito tipo "necessário ter
      PC" (comentário em `parseDiscordAnnouncement.ts:2160`, agora
      atualizado). Mantenedor decidiu inverter a regra: VTT detectado infere
      `requires_pc=true`; plataforma de comunicação = Discord infere
      `requires_microphone=true`. Texto explícito continua tendo prioridade
      (positivo/negativo/ambíguo do texto nunca é sobrescrito pela inferência).
      Arquivo: `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts`
      (bloco `technicalRequirements`, ~linha 2160-2170).
      Teste antigo que validava a regra revogada
      ("não inventa PC ou microfone só porque VTT e Discord foram citados")
      substituído por 2 novos: infere true por VTT/Discord, e texto explícito
      vence a inferência.
      Validado: `tsc --noEmit` limpo; suíte `src/discord` completa 324/324.
- [x] U8 Bug real de produção: `POST /admin/discord/drafts/:id/correction`
      retornava 500 mascarado como "aprendizado ficou pendente". Causa raiz
      **provada por reprodução real** (Docker Postgres 16 isolado, schema-only
      de prod via `pg_dump`, script Kysely local): `confirmed_fields` é
      `string[]` gravado direto numa coluna `jsonb`; o driver `pg`
      (`lib/utils.js prepareValue`) serializa array JS como array-literal
      Postgres (`{a,b,c}`), não JSON — só objetos passam por
      `JSON.stringify()`. Postgres rejeita com `22P02 invalid input syntax for
      type json`, `detail: Expected ":", but found ","` — assinatura idêntica
      ao erro real de produção. Fix: `confirmed_fields: asJsonbArray(confirmedFields)`
      (helper já existente em `discord/shared.ts`) em
      `apps/mesas/backend/src/routes/discord/utils.ts` (`registerDraftCorrection`).
      Mensagem de erro do backend também ampliada (log com `pgCode`/`pgDetail`/
      `pgWhere`) e frontend (`useDraftForm.ts handleSaveFields`) parou de
      mascarar erro real como "pendente" quando `submitCorrectionDiff` lança.
      Auditoria de escopo (2026-07-16): as outras 11 colunas
      `ColumnType<unknown,unknown,unknown>` em `db/types.ts` (`signals_json`,
      `output_value`, `scope_json`, `before_value`, `after_value`,
      `request_json`, `response_json`, `validated_result_json`,
      `predicted_payload`, `actual_payload`) foram checadas — todas recebem
      objeto genérico ou já usam `sql...::jsonb` explícito, nenhuma recebe
      array JS puro. Não são vulneráveis à mesma classe de bug; nada a
      corrigir.
      Validado: `tsc --noEmit` limpo; suíte backend completa 549/549; eslint
      limpo. Recursos de teste (container Docker, scripts temporários)
      removidos ao final.
- [x] U9 Bug real de produção: faixa etária "20+" (e qualquer N>18) não era
      reconhecida pelo parser. Regra do mantenedor: qualquer valor acima de
      18 é tratado como `+18`. Fix em `extractAgeRating`
      (`parseDiscordAnnouncement.ts`, regex ampliada pra `1[89]|[2-9]\d`) e em
      `normalizeLegacyAgeRating` (`draftFormUtils.ts`, converte legado `NN+`
      pra `+18` quando `N>=18`).
      Validado: `tsc --noEmit` limpo; testes novos em
      `parseDiscordAnnouncement.test.ts` e `draftFormUtils.test.ts`.
- [x] U10 Bug real de produção (anúncio "As Crônicas do Norte"): texto
      "Dias e horários da mesa: A decidir com os jogadores!" marcava
      `start_time` como pendência resolvida mas não `day_of_week`. Fix:
      `DAY_TO_DEFINE_RE` novo em `parseDiscordAnnouncement.ts`
      (`extractDayOfWeek`), reconhece "a decidir/combinar/definir com os
      jogadores" e retorna sentinela `to_define` (mesmo contrato já usado pra
      `start_time`).
      Validado: `tsc --noEmit` limpo; teste novo com texto real do anúncio.
- [x] U11 Regra do mantenedor: quando só `slots_open` está declarado no
      anúncio (sem total explícito), assumir `slots_total=5` por padrão. Fix:
      `DEFAULT_SLOTS_TOTAL_WHEN_ONLY_OPEN=5` em `extractSlots`
      (`parseDiscordAnnouncement.ts`).
      Validado: `tsc --noEmit` limpo; suíte `src/discord` completa 327/327
      (progressão 158→159→161 no arquivo principal ao longo dos fixes U9-U11).
- [x] U12 Bug real de produção (import via texto, anúncio "Hero Academy -
      Neo Neon", tela `/gestao/importacao` → Importar texto): `GET
      /admin/import/drafts/:id` em loop → 429 Too Many Requests; "Texto
      original" nunca carregava ("Sem texto original disponível"); campo
      "Contato Discord" apagava sozinho ao digitar. Causa raiz única:
      `handleDraftUpdate` em `DiscordDraftReviewTable.tsx` era recriada a
      cada render (não memoizada), virando dependência instável do
      `useEffect` de fetch em `DiscordDraftPreview.tsx` — cada resposta
      disparava novo fetch em loop, e cada reset do draft reescrevia o form
      por cima do que o usuário tinha acabado de digitar. Fix:
      `useCallback` em `handleDraftUpdate`.
      Bug adicional (mesmo sintoma, causa própria): o adapter `inboxDraftApi`
      em `ModeracaoSection.tsx` fazia `as Promise<DiscordDraft>` (cast sem
      runtime real) sobre `InboxDraft`, que tem `raw_text`, não
      `content_raw` — o campo ficava sempre `undefined` mesmo com resposta OK
      do backend. Fix: mapeamento explícito `inboxDraftToDiscordDraft`
      (`raw_text` → `content_raw`) aplicado em `getDraft`/`reparseDraft`/
      `updateDraft` do adapter.
      Validado: `tsc -b && vite build` limpo; `eslint` limpo; suíte
      `discord-sync` + `ModeracaoSection` 183/183.
- [x] U13 Pedido do mantenedor: campo "Capa" no editor de draft só permitia
      upload de arquivo, sem opção de colar URL de imagem já hospedada (CDN)
      — útil especificamente pro fluxo de import via texto colado. Adicionado
      input "Colar URL de imagem (CDN)" + botão "Usar URL" em
      `DraftEditorTab.tsx`, ligado a `onSetCoverUrl` (novo,
      `useDraftForm.ts handleSetCoverUrl`, despacha o mesmo `SET_COVER` do
      reducer usado pelo upload).
      Validado: `tsc -b && vite build` limpo; `eslint` limpo; testes
      atualizados (`DraftEditorTab.test.tsx`).
- [x] U14 Autorização do mantenedor para commit/push/PR de U8-U13. Commit
      `5674805`, PR #170 aberta contra `dev`, merge, deploy Mesas Beta
      (run 29509312900), promote `dev→main` fast-forward (run 29509886305),
      deploy Mesas Prod (run 29509927847) — todos verdes.
- [x] U15 Review Sonar da PR #170 (5 achados, todos introduzidos no próprio
      PR, todos confirmados válidos e corrigidos): regex de `DAY_TO_DEFINE`
      e `extractAgeRating` acima do limite de complexidade (split em
      array/testes separados); cognitive complexity de
      `createCorrectionHandler` e `handleSaveFields` acima do limite
      (extraídas `buildCorrectionsPreview`/`logCorrectionFailure`/
      `recordLearningForSave`); template literal aninhado em `utils.ts`
      (variável intermediária). Sem mudança de comportamento — só estrutura.
      Validado: tsc limpo, lint 21/21, build 21/21, testes 31/31 tasks
      (549 mesas-backend), `verify:api` exit 0. Commit `6cf92ee`, mesmo PR.
- [x] U16 Achados Codex da PR #170 (2 achados, ambos válidos, ambos
      corrigidos no mesmo commit `6cf92ee`):
      (a) URL de capa colada (`onSetCoverUrl`/U13) ia direto pra `cover_url`
      — backend (`uploadCoverForDraft`) trata `cover_url` preenchido como já
      persistido e pula o upload real, publicando link expirável/hotlinked
      (CDN assinado do Discord) como capa da mesa. Fix: vai como
      `cover_url_source` (pendente); sync real baixa e sobe pro Cloudinary
      antes de confirmar em `cover_url`.
      (b) `slots_total` inventado abaixo do `slots_open` real quando só
      "vagas disponíveis" é declarado (default fixo 5, ex.: "disponíveis: 8"
      virava total:5) — `normalizeSlots` clampava `slots_open` pro total
      depois, escondendo vagas reais silenciosamente. Fix: default só quando
      `open <= 5`; senão `open` vira o próprio total.
      (c, achado extra do mantenedor no mesmo ciclo) `handleDraftUpdate` em
      `DiscordDraftReviewTable.tsx` fazia `setSelectedDraft(updated)`
      incondicional — reabria o modal de preview se o mantenedor tivesse
      fechado (`selectedDraft=null`) enquanto o update assíncrono ainda
      estava em voo. Fix: updater funcional, só aplica se ainda houver draft
      selecionado.
      Validado: tsc limpo, 151 testes frontend `discord-sync` + 161 testes
      parser backend verdes.
- [x] U17 Bugs reais de produção reportados após deploy do PR #170, tela
      `/gestao/mesas/rascunhos` e editor de draft (screenshots, caso real
      "Crônicas do Fim dos Dias" e "somewhere in Duskwood" —
      `D:\teste [part 2].json`):
      (a) Badge "possível duplicata" na lista só mostrava contagem, sem
      apontar pra qual candidato/mesa. Fix: badge clicável abre o preview do
      draft já na aba "Duplicatas" (`DiscordDraftPreview` ganhou prop
      `initialTab`).
      (b) Botões "Revisar"/"Rejeitar" pareciam ter sumido em telas estreitas
      quando o draft tinha badge de duplicata — causa raiz: row sem
      `flex-wrap`, badge extra empurrava os botões pra fora do overflow
      visível (não eram removidos, eram cortados). Fix: `flex-wrap` na row.
      Efeito colateral do fix do badge clicável: o wrapper da linha inteira
      era um `<button>` e o badge virou outro `<button>` aninhado dentro
      dele (HTML inválido) — trocado por `div role="button"` com suporte a
      teclado (Enter/Space).
      (c) Menção Discord `<@id>` sozinha (sem link) NÃO é contato usável —
      ID cru não é clicável/pesquisável fora do servidor. O filtro
      `requireExplicitContact` (import JSON) aceitava
      `contact_discord_explicit` como substituto de link; agora exige
      `contact_url` de verdade. `contact_discord`/`contact_discord_explicit`
      continuam preenchidos (útil como exibição), só não contam mais pro
      filtro de qualidade.
      (d) Typo de plataforma ("owbear" por "Owlbear Rodeo") não batia em
      nenhum alias hardcoded — `findPlatformMatch` ganhou fallback de fuzzy
      matching (Levenshtein/similaridade ≥0.75, só quando o match exato
      falha, só comparando tokens da linha de plataformas pra evitar falso
      positivo em texto livre longo). Reusa `levenshtein`/`similarity` já
      existentes em `systemSuggestionCandidates.ts` (agora exportadas) —
      sem dependência nova.
      (e) Label "Época" (sinônimo de ambientação/cenário no template da
      comunidade) não era reconhecido por `extractLabelValue` — adicionado
      à lista de labels de `setting_name`.
      (f) `experience_level` (ex.: "todos") saía cru, sem rótulo, no anúncio
      de compartilhamento WhatsApp — sem contexto, parecia campo residual
      cortado do template. Fix: `whatsappAnnouncement.ts` agora prefixa
      "Nível:"/"Experiência:" antes de cada valor.
      Validado: tsc limpo (frontend+backend), 165 testes parser backend
      (3 novos + 1 teste de integração completo usando o texto exato
      exportado do Discord no caso "Duskwood"), 6 testes
      `whatsappAnnouncement` (1 novo), teste de `utils.test.ts` invertido
      pra refletir a nova regra de contato (era "menção basta", agora
      "menção não basta sem link").
- [ ] U18 Autorização do mantenedor para commit/push/PR de U17 (nenhuma
      autorização dada ainda; regra pétrea — não commitar por inferência).

## MIGRADO PARA SPEC 079 (2026-07-16)

Bug real de produção (anúncio "A Censura", import via texto colado) revelou
escopo maior que essa frente comporta — parser de texto colado tem bug
estrutural (labels grudados em linha corrida) presente em ~8/13 anúncios
reais testados, não só o caso pontual relatado. Mantenedor decidiu: todo
trabalho de parser de texto colado (segmentação `▬▬▬` inline, sentinela
"data e hora: a definir", e tudo que vier depois) passa a viver inteiro em
`specs/079-mesas-import-texto-polimento/`, não fica fragmentado entre specs.

- [x] (migrado) Fix `▬▬▬` inline não fragmenta segmento —
      `apps/mesas/backend/src/inbox/segmentation.ts`. Implementado e validado
      nesta sessão (339/339 backend, tsc limpo); dono de manutenção passa a
      ser a spec 079.
- [x] (migrado) Fix "Data e hora: a definir" → `day_of_week=to_define` sem
      exigir "dia(s)"/"horário(s)" explícito —
      `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts`
      `DAY_TO_DEFINE_PATTERNS`. Implementado e validado nesta sessão; dono de
      manutenção passa a ser a spec 079.
- Commit/push/PR desses dois fixes: pendente, será feito junto com o resto do
  trabalho da spec 079 (mantenedor optou por não fechar/commitar parcial).

## Frente parser — ampliação de escopo (2026-07-14)

- [x] P0.1 Ler handoff/arquitetura e confirmar caminho do parser, learning e dois
      modos DeepSeek.
- [x] P0.2 Rodar baseline em `D:\teste.json` e `D:\teste [part 2].json`.
      Evidência: 200 mensagens, 169 drafts, 63 sinais de requisito e 0 capturas
      pelo extrator atual sem catálogo.
- [x] P0.3 Registrar antes do avanço: aliases ativos só chegavam a título/sistema;
      `field_value` chegava só a `_ai_suggestions`; inferência VTT/Discord era
      insegura.
- [x] P1.1 Consumir aliases aprendidos em preço, vagas, dia, horário, contato e
      descrição.
- [x] P1.2 Implementar tri-state de PC/câmera/microfone com ambiguidade explícita.
- [x] P1.3 Registrar checkpoint P1 e casos de teste antes de executar validação.
- [x] P2.1 Definir e registrar guardas da aplicação automática de regra humana
      ativa antes de editar o fluxo de learning.
- [x] P2.2 Aplicar learning ativo no campo do draft, recalcular sistema/missing/status
      e manter proveniência, sem auto-publicar.
- [x] P2.3 Provar com DeepSeek automático desligado.
- [x] P3.1 Testes focados parser/backend (155/155).
- [x] P3.2 Reexecutar auditoria dos 2 corpora: 0/63 -> 47/63 capturados (74,6%).
- [x] P3.3 Registrar checkpoint P3 antes dos gates globais.
- [x] P4.1 `pnpm run lint` (21/21).
- [x] P4.2 `pnpm run build` (21/21).
- [x] P4.3 Revisar diff e registrar estado final; sem commit/push/deploy.

## Frente parser P5 — autonomia segura

- [x] P5.0 Registrar objetivo e ordem antes da auditoria.
- [x] P5.1 Auditar unidade/escopo de `field_value`, `label_alias` e store legado.
- [x] P5.2 Classificar campos em fatos, categorias, entidades e sinais semânticos.
- [x] P5.3 Mapear lacunas de aprendizado, promoção, conflito e rollback.
- [x] P5.3a Desligar gravação/consumo do store legado no fluxo vivo.
- [x] P5.3b Restringir `field_value` autoaplicável a `system_name`.
- [x] P5.3c Adicionar regressões de não-generalização de fatos por anúncio.
- [x] P5.4 Propor ondas priorizadas com gates mensuráveis de autonomia.
- [x] P5.4a Validar hardening: backend completo + lint/build repo-wide.
- [x] P5.5 Mantenedor escolheu Onda A — feedback confiável (2026-07-14).
- [x] P5.6 Localizar contratos/schema dos quatro fluxos da Onda A: aplicação,
      recorreção, confirmação explícita e persistência observável.
- [x] P5.7 Definir e registrar contrato material da Onda A antes do código.
- [x] P5.8 Implementar Onda A sem liberar automação operacional.
  - [x] P5.8a Migration/tipos + `_learning_applied` auditável.
  - [x] P5.8b Outbox transacional, recorreção e feedback de confirmação.
  - [x] P5.8c API/UI observável + retry explícito.
- [x] P5.9 Validar testes focados, corpora reais, backend/frontend, lint/build e
      diff-check, com checkpoint antes de cada gate.
- [ ] P5.10 Smoke real em beta/Postgres: curadoria grava confirmação/correção,
      outbox fica observável, retry conclui falha simulada e novo draft consome o
      learning com DeepSeek automático desligado; anexar evidência.

## Frente parser P6 — vagas X/Y

- [x] P6.0 Registrar regra canônica antes da investigação.
- [x] P6.1 Localizar todas as interpretações X/Y e testes existentes.
- [x] P6.2 Reusar implementação correta; remover divergência filled/open.
- [x] P6.3 Validar nos corpora reais e regressões: 28/28 drafts elegíveis,
      149/149 focados, backend 477/477, lint/build 21/21.
- [x] P6.4 Substituir regra max/min por cascata semântica de rótulo;
      genérico `X/Y` volta a ser ambíguo.
  - [x] P6.4a Implementar open/filled/generic e regressões focadas (175/175).
  - [x] P6.4b Reauditar corpora e gates completos: 28/28 coerentes; backend
        487/487; frontend 177/177; lint/build 21/21.

## Frente parser P7 — sistema e alternativas

- [x] P7.0 Registrar relato, separar seleção de exibição e definir rastreio.
- [x] P7.1 Reproduzir sistema incorreto e ausência de sugestões no código/dados.
- [x] P7.2 Corrigir causa material e adicionar regressões.
  - [x] P7.2a Backend: ordem de match, candidatos determinísticos e learning
        seguro `system_entity` (174/174 focados).
  - [x] P7.2b Frontend: exibir candidatos abaixo do picker e testar aplicação
        (16/16 focados).
- [x] P7.3 Auditar corpora reais e validar backend/frontend/lint/build.
  - [x] P7.3a Auditoria inicial: 200 mensagens; revelou colisão D&D→Gamma
        World e comprovou transporte de alternativas em 74 drafts.
  - [x] P7.3b Corrigir desempate de alias colidente e repetir regressão/corpus:
        175/175 focados; 200 mensagens; 100 vínculos; 69 com alternativas.
  - [x] P7.3c Executar suites completas, lint, build e diff-check: backend
        483/483; frontend 176/176; lint/build 21/21; diff-check verde.
- [ ] P7.4 REABERTA: resolver sistema em duas etapas, base → edição/filho,
      restringindo tokens de versão à árvore da base reconhecida.
  - [x] P7.4a Implementar raiz→descendente e regressões focadas (176/176).
    - [x] P7.4a.1 Raiz, descendência, aliases seguros e ranking posicional.
    - [x] P7.4a.2 Corrigir gate de folha nomeada só pela edição; `D&D 5e`
          seleciona `dnd-5e`, sem Gamma entre alternativas.
  - [x] P7.4b Reauditar corpora e gates completos.
    - [x] P7.4b.1 Seleção: 98/155, D&D 5e correto, Gamma ausente.
    - [x] P7.4b.2 Resolver alternativas cartesianas impossíveis dentro da raiz;
          2014/2024 são variantes sob 5e, nunca edições irmãs nem filhas de 1e.
      - [x] P7.4b.2a Localizar perda da cadeia ancestral antes do código:
            parser achata descendentes da raiz e scorer busca filho entre irmãos.
      - [x] P7.4b.2b Restringir candidatos à cadeia raiz→edição→variante
            (26/26 testes focados).
      - [x] P7.4b.2c Auditar contrato universal no backend: parser, scorer,
            loaders, CRUD, moderação, sugestões, imports e migrations.
      - [x] P7.4b.2d Auditar contrato universal no frontend: tipos, árvore,
            picker, criação/sugestão e editor de draft.
      - [x] P7.4b.2e Corrigir resíduos e provar com testes genéricos de outro
            sistema além de D&D, incluindo variante textual.
      - [x] P7.4b.2f Endurecer fonte central (`apps/site`) para validar pai em
            create/update; alinhar Mesas e impedir novo legado cartesiano.
      - [ ] P7.4b.2g Remover conceito legado `subsystem` de código/API/frontend;
            auditar e reclassificar dados existentes antes da constraint final.
        - [x] P7.4b.2g.1 Remover de `packages/catalog-ui`, `site-admin`, clientes
              `downloads`/`glossario` e todo texto operacional de `mesas`.
        - [x] P7.4b.2g.2 Garantir `system → edition → variant` em validação de
              escrita e banco; migration aborta diante de legado não auditado.
        - [x] P7.4b.2g.3 Busca global final: nenhuma ocorrência operacional;
              apenas histórico imutável ou guarda explícita de rejeição.
          - [x] Código ativo/frontend/clientes compartilhados sem quarto tipo.
          - [x] Neutralizar `apply_migrations_06_07.sql` e criar guarda final de DB.
        - [x] P7.4b.2g.4 Remover importação cartesiana e validar cadeia de sugestão.
        - [x] P7.4b.2g.5 Testes focados backend/frontend/pacote compartilhado.
        - [x] P7.4b.2g.6 Auditar catálogo existente por classificação semântica
              errada e preparar correções explícitas, sem regra universal por ano.
          - [x] Auditoria pública: 2 violações estruturais + 5 grupos candidatos.
          - [x] Preparar correção D&D 1e e merge D&D 2024 sem perda (não aplicada).
          - [ ] Mantenedor decidir Mage/Mothership/OSE/Shadowrun após evidência.
        - [x] P7.4b.2g.7 Reauditar 200 anúncios contra catálogo público atual.
          - [x] Rodada 1: 122/155; expôs nomes de filhos com prefixo ancestral.
          - [x] Corrigir prefixo ancestral e podar raízes concorrentes/aliases genéricos.
          - [x] Rodada 2 após testes focados reais.
          - [x] Rodada final: casos comuns D&D corretos; 33 ausentes do catálogo.
          - [x] Remover irmãos/raízes concorrentes após seleção conclusiva.
          - [x] Inferência genérica de variante por descendente único (14/24).
          - [x] Inferência única + decimal/ano curto validada em corpus/controle.
        - [x] P7.4b.2g.9 Gate API: dois mounts de `retry-learning` declarados no
              overlay canônico; `pnpm verify:api` verde, 360 operações, 0 breaking.
        - [ ] P7.4b.2g.8 Antes de qualquer merge/migration na VM: backup completo
              dos bancos afetados, restauração/integridade verificada e cópia
              off-VM em `C:\projetos\artificiobackup`; anexar evidência. BLOQUEANTE.
          - [x] Corrigir metadata da migration 148 para `manual-risk` e
                `requires-backup: true`; descoberta ordenada 146–148 confirmada.
          - [x] Impedir autoexecução de site 008/009: adicionar metadata
                `manual-risk`/backup e gate fail-closed no runner de migrations do
                site, com testes; deploy comum não aplica merge (26/26).
          - [ ] Definir e implementar caminho de deploy manual do site: encaminhar
                autorização/atestados e montar backup não vazio no container para
                executar 008/009; deploy comum deve continuar bloqueado.
          - [ ] Aplicar, com autorização nominal e evidência, Mesas 146 → 147 →
                148 antes de site 008 → 009 no ambiente alvo.
        - [ ] P7.4b.2g.10 Após migrations em beta: smoke `D&D 5e`, `5e 2014`,
              `5e 2024`, ano sem edição e alternativas; nenhum Gamma/Drakar e
              `D&D 2024` não pode permanecer na raiz.
## PR #160 — revisão de bots

- [x] R160.1 Inventariar reviews inline, comentários colapsados e checks.
- [x] R160.2 Classificar impacto e registrar descartes prejudiciais/sem ganho.
- [x] R160.3 Aplicar correções funcionais e hardenings seguros.
- [x] R160.4 Adicionar/ajustar regressões proporcionais.
- [x] R160.5 Rodar testes focados, `verify:api`, lint e build.
- [x] R160.6 Revisar diff final; sem responder bots, commit ou push.
## PR #160 — segunda rodada de review

- [x] R160.7 Validar os dois novos achados contra código/schema.
- [x] R160.8 Restringir policy ao cabeçalho inicial e adicionar regressões.
- [x] R160.9 Tornar comparação de `type` null-safe.
- [x] R160.10 Validar testes focados, lint e build.
## PR #160 — merge e deploy Beta

- [x] R160.11 Backup + restore-test de Mesas/Site Beta e cópia off-VM.
- [ ] R160.12 Aplicar migrations por operação excepcional sem alterar a esteira
      central; wiring experimental rejeitado após auditoria arquitetural.
- [ ] R160.13 Commit/push único e checks verdes.
- [ ] R160.14 Merge da PR #160 em `dev`.
- [ ] R160.15 Deploy Mesas Beta + smoke.
- [ ] R160.16 Deploy Site Beta + smoke.
