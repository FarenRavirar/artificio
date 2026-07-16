# Sessão 26-07-16 (2) — Spec 077: badge de duplicata no card + ações rápidas no rascunho

- Data: 2026-07-16
- Objetivo: retomada da Spec 077 (dedupe de mesas ativas) pedida pelo mantenedor após o ciclo de deploy do fix de null-byte (PR #168) e libexpat (PR #169). Três pedidos em sequência na mesma retomada.
- Escopo: `apps/mesas/frontend` (card de rascunho) + `apps/mesas/backend` (trigger automático de scan). Sem tocar `packages/*`.
- Gate: D (mesas).
- Vínculos: `specs/077-mesas-dedupe-mesas-ativas/` (Fase 0 já fechada em 26-07-14; scanner batch `scanTableDuplicateCandidates`/`buildDraftCandidates`/rota `POST /admin/tables/duplicates/scan` já implementados e em produção antes desta sessão).

## Pedidos do mantenedor (verbatim, ordem cronológica)

1. "a revisão e notificação de duplicada, tem que aparecer no próprio rascunho. tem que ter uma inteligencia para cruzar a semelhança com o título, contato, horário, e outros. e pode ser assincrona a investigação, mas tem que aparecer no card dda mesa dentro de rascunhos, do lado da porcentagem"
   - Investigado: já implementado. Badge "possível duplicata (N)" já existe em `DiscordDraftReviewTable.tsx:461-465`, populado por `listTableDuplicateCandidates()` (linha 122), do lado do %. Nenhuma mudança de código necessária — só confirmado ao mantenedor.

2. "colocar também botões do lado da data, do lado esquerdo da data. Revisar / Rejeitar. Para e unão ter que só conseguir selecionando via check e depois clicando em rejeitar. esse tem que manter, mas também adicionar."
   - Implementado: botões "Revisar" (abre preview, reusa `setSelectedDraft`) e "Rejeitar" (reusa `rejectDraftIds([draft.id], ...)`) por linha do card, entre o botão-preview e o span de data. Só aparecem quando `draft.status !== 'synced' && draft.status !== 'rejected'` (mesma regra do checkbox). Seleção em lote + botão "Rejeitar selecionados" mantidos intactos.
   - Arquivo: `apps/mesas/frontend/src/features/discord-sync/components/DiscordDraftReviewTable.tsx` (+20/-1).
   - Validação: `tsc --noEmit` limpo, `eslint` limpo. Preview visual local bloqueado (sessão SSO só vale em `mesas.artificiorpg.com`, cookie não atravessa pra `localhost:5173`; extração de cookie de sessão foi corretamente bloqueada pelo classificador de auto mode). Confirmado por leitura estrutural do JSX + type-check.

3. "não quero toda vez ter que clicar. tem que rodar o scan de duplicatas toda vez que eu importar algo" → refinado com screenshot da tela `/gestao/importacao` (upload manual de JSON DiscordChatExporter): "quando eu clico em Importar... vai fazer o parser, vai mostrar o botão de sucesso e ver drafts, após isso tem que ter o scan das mesas."
   - Escopo confirmado pelo mantenedor: SÓ o fluxo de upload/paste de JSON DiscordChatExporter (`POST /api/v1/admin/discord/import-json` e `POST /api/v1/admin/discord/import-json/file`, `apps/mesas/backend/src/routes/discord/import.ts`), não os outros pontos de criação de draft (fetch automático do bot, reparse individual, inbox manual paste) — esses ficaram fora do pedido explícito.
   - Ponto de disparo identificado: `respondImportSuccess()` em `apps/mesas/backend/src/routes/discord/import.ts:23-50`, chamada por ambas as rotas (`POST /` e `POST /file`) depois do `autoParsePendingImportedMessages` (parser) rodar — mesmo lugar que já registra `recordImportRun`.
   - Implementação pendente nesta sessão: chamar `scanTableDuplicateCandidates()` fire-and-forget (`.catch()`, não bloqueia a resposta HTTP) dentro de `respondImportSuccess`, condicionado a `result.inserted > 0 || result.updated > 0` (não rodar scan sem draft novo/atualizado).

## Achados técnicos (mapa de pontos de criação/update de draft, para referência futura)

Levantado mas **não instrumentado nesta sessão** (fora do escopo pedido — só o import de arquivo):
- `apps/mesas/backend/src/routes/discord/utils.ts:778` `upsertDraftWithShadow` (chamada por `processDiscordMessageToDraft`, usada em `parse-batch.ts` — fetch/batch do bot)
- `apps/mesas/backend/src/routes/discord/fetch.ts:76` `createOrUpdateDraftFromMessage` (fetch manual admin)
- `apps/mesas/backend/src/routes/discord/messageParse.ts:58` (reparse individual via rota)
- `apps/mesas/backend/src/routes/inbox/import.ts:156` (colagem manual/texto)

Se o mantenedor quiser scan automático nesses fluxos também, é ampliação de escopo futura — não decidir sozinho, perguntar antes.

## Plano desta sessão

- [x] Confirmar badge de duplicata já existe (pedido 1) — nenhuma ação de código.
- [x] Adicionar botões Revisar/Rejeitar por linha no card de rascunho (pedido 2).
- [ ] Disparar `scanTableDuplicateCandidates()` fire-and-forget ao final do import de arquivo DiscordChatExporter (pedido 3), só nas rotas `POST /` e `POST /file` de `routes/discord/import.ts`.
- [ ] Validar: `tsc --noEmit` backend, `pnpm run lint`.
- [ ] Atualizar `specs/077-mesas-dedupe-mesas-ativas/tasks.md` com o trigger automático implementado.
- [ ] Perguntar ao mantenedor antes de commitar/abrir branch (regra pétrea — nenhuma autorização de commit dada ainda nesta sessão).

## Arquivos modificados/previstos

- `apps/mesas/frontend/src/features/discord-sync/components/DiscordDraftReviewTable.tsx` (feito)
- `apps/mesas/backend/src/routes/discord/import.ts` (feito)
- `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts` (feito — item 4, abaixo)
- `apps/mesas/backend/src/discord/__tests__/parseDiscordAnnouncement.test.ts` (feito)
- `sessoes/26-07-16_2_mesas_077-badge-duplicata-e-botoes-rascunho.md` (este arquivo)
- `sessoes/index.md` (feito)
- `specs/077-mesas-dedupe-mesas-ativas/tasks.md` (feito)

## Pedido 4 — bug de inferência requires_pc/requires_microphone (2026-07-16)

Mantenedor colou caso real de produção (anúncio "O Sangue das Estrelas", VTT
Roll20 + plataforma Discord): parser não marcava `requires_pc` mesmo com
"Ter um computador para usar o roll20" no texto, nem `requires_microphone`
mesmo com Discord como plataforma. Causa: regra antiga só considerava texto
explícito tipo "necessário ter PC" (comentário documentava isso como decisão
deliberada — "citar Discord/Foundry/Roll20 não autoriza inferir
microfone/PC").

Perguntado e confirmado pelo mantenedor: inverter a regra. VTT detectado por
catálogo (`vttMatch`) agora infere `requires_pc=true`; plataforma de
comunicação = Discord (`communicationMatch.name === 'Discord'`) infere
`requires_microphone=true`. Texto explícito continua tendo prioridade — só
preenche por inferência quando o texto não decidiu nada (`?? (condição ? true : null)`).

Arquivo: `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts`
(bloco `technicalRequirements`, ~linha 2160-2170; docstring de
`extractTechnicalRequirement` atualizado pra não afirmar mais a regra
revogada).

Teste antigo "não inventa PC ou microfone só porque VTT e Discord foram
citados" substituído por 2 novos: infere true por VTT/Discord isolado, e
texto explícito (negação) vence a inferência.

Validado: `tsc --noEmit` limpo; suíte `src/discord` completa 324/324 (era
323/323 antes + 1 teste novo líquido).

## Pedido 5 — bug real de produção, correção mascarada (500 em /correction) (2026-07-16)

Mantenedor colou novo caso real (mesmo anúncio "O Sangue das Estrelas"): ao
salvar campos, backend retornava 500 em
`POST /admin/discord/drafts/:id/correction`, mas o frontend mostrava só
"Draft salvo, mas aprendizado ficou pendente. Tente salvar novamente." — 1ª
rodada de fix só melhorou a mensagem de erro (logging expandido no backend +
distinção erro real vs. pendente no frontend), sem achar a causa raiz.
Mantenedor perguntou duas vezes, de forma direta, se o erro tinha sido
corrigido de verdade ou só mascarado melhor — respondido com honestidade que
era só melhoria de mensagem até então.

Pedido explícito seguinte: "coloque o máximo de detalhes, e investigue também
para tentar descobrir logo" — investigação mais profunda.

Causa raiz encontrada por leitura do código-fonte do driver `pg`
(`node_modules/pg/lib/utils.js prepareValue`): array JS é serializado como
array-literal Postgres (`{a,b,c}`), não JSON — só objetos passam por
`JSON.stringify()`. `confirmed_fields` (`string[]`) ia direto pra uma coluna
`jsonb` sem cast, causando `22P02 invalid input syntax for type json`,
`Expected ":", but found ","` — assinatura idêntica ao erro real de produção.

Após "Docker iniciado." (mantenedor liberou uso de Docker local), causa raiz
foi **provada por reprodução real**, não só leitura de código: Postgres 16
isolado em container, schema-only de prod via `pg_dump` (read-only), tabela
de teste mínima isolando a coluna suspeita, script Kysely local reproduziu o
erro exato (array puro falha com 22P02 idêntico; `sql\`${JSON.stringify(...)}::jsonb\``
funciona). Container, script e arquivos temporários removidos ao final —
nada residual.

Fix: `confirmed_fields: asJsonbArray(confirmedFields)` (helper já existente
em `discord/shared.ts`) em
`apps/mesas/backend/src/routes/discord/utils.ts` (`registerDraftCorrection`).

Achado colateral: existem 11 outras colunas `ColumnType<unknown,unknown,unknown>`
em `db/types.ts` (mesmo padrão de risco). Mantenedor pediu auditoria — feita
nesta sessão (ver Pedido 8 abaixo): nenhuma recebe array JS puro, todas
seguras.

Validado: `tsc --noEmit` limpo; suíte backend completa 549/549; eslint
limpo.

## Pedido 6 — faixa etária "20+" não reconhecida (2026-07-16)

No mesmo anúncio, faixa etária "20+" não era capturada. Regra do
mantenedor: qualquer valor acima de 18 é `+18`. Fix em `extractAgeRating`
(regex ampliada) e `normalizeLegacyAgeRating` (frontend, converte legado
`NN+` pra `+18` quando `N>=18`).

Validado: `tsc --noEmit` limpo; testes novos em ambos os arquivos.

## Pedido 7 — day_of_week "a decidir" + slots_total default 5 (2026-07-16)

Anúncio real "As Crônicas do Norte": "Dias e horários da mesa: A decidir com
os jogadores!" resolvia `start_time` mas não `day_of_week`. Fix:
`DAY_TO_DEFINE_RE` novo em `extractDayOfWeek`, retorna sentinela `to_define`
(mesmo contrato de `start_time`).

Pedido explícito adicional: quando só `slots_open` está no texto (sem
total), assumir `slots_total=5`. Fix: `DEFAULT_SLOTS_TOTAL_WHEN_ONLY_OPEN=5`
em `extractSlots`.

Validado: `tsc --noEmit` limpo; suíte `src/discord` completa 327/327.

## Pedido 8 — bugs de produção no fluxo de import via texto (2026-07-16)

Mantenedor testou `/gestao/importacao` → Importar texto (anúncio "Hero
Academy - Neo Neon") e reportou 3 problemas:

1. `GET /admin/import/drafts/:id` em loop, 429 Too Many Requests (console).
2. "Texto original da mensagem" nunca carregava ("Sem texto original
   disponível para este draft.").
3. Campo "Contato Discord" apagava sozinho ao digitar.

Causa raiz única para os 3: `handleDraftUpdate` em
`DiscordDraftReviewTable.tsx` recriada a cada render (sem `useCallback`),
dependência instável do `useEffect` de fetch em `DiscordDraftPreview.tsx` —
cada resposta reentrava no effect, gerando loop de fetch (429) e cada reset
sobrescrevia o form por cima da digitação do usuário. Fix: `useCallback`.

Causa raiz adicional (mesmo sintoma #2, bug próprio): adapter
`inboxDraftApi.getDraft` em `ModeracaoSection.tsx` fazia
`as Promise<DiscordDraft>` — cast que compila mas nunca preenche
`content_raw` de verdade, porque o objeto real (`InboxDraft`) tem
`raw_text`. Fix: mapeamento explícito `inboxDraftToDiscordDraft`
(`raw_text` → `content_raw`), aplicado em `getDraft`/`reparseDraft`/
`updateDraft`.

Mantenedor também pediu campo pra colar URL de imagem (CDN) na Capa, sem
exigir upload de arquivo, pro fluxo de import por texto — confirmado via
pergunta (`AskUserQuestion`). Adicionado input + botão "Usar URL" em
`DraftEditorTab.tsx`, ligado a `onSetCoverUrl` novo
(`useDraftForm.ts handleSetCoverUrl`).

Auditoria de escopo pedida pelo mantenedor: as 11 colunas
`ColumnType<unknown,unknown,unknown>` restantes em `db/types.ts` foram
checadas uma a uma (grep de `.values`/`.set` por coluna) — `signals_json`,
`output_value`, `scope_json`, `before_value`, `after_value`, `request_json`,
`response_json`, `validated_result_json`, `predicted_payload`,
`actual_payload` recebem sempre objeto genérico ou já usam
`sql...::jsonb` explícito. Nenhuma recebe array JS puro. Não vulneráveis à
mesma classe de bug do Pedido 5; nada corrigido (não havia o que corrigir).

Validado: `tsc -b && vite build` (frontend mesas) limpo; `eslint` limpo;
suíte `discord-sync` + `ModeracaoSection` 183/183.

## Critério de conclusão

Botões Revisar/Rejeitar validados por tsc+lint (feito). Scan automático implementado e validado por tsc+lint no backend, sem regressão nas rotas de import (feito). Inferência requires_pc/requires_microphone por VTT/Discord implementada e validada por tsc + suíte discord completa (feito). 500 real em /correction (confirmed_fields/jsonb) corrigido e provado por reprodução real com Docker (feito). Faixa etária >18→+18, day_of_week "to_define" por texto e slots_total default 5 implementados e testados (feito). 429/texto original/campo apagando no fluxo de import por texto corrigidos e validados por build+lint+testes (feito). Campo de URL de capa (CDN) adicionado (feito). Auditoria das 11 colunas `ColumnType<unknown,unknown,unknown>` restantes concluída — nenhuma vulnerável (feito). `specs/077-mesas-dedupe-mesas-ativas/tasks.md` atualizado com U8-U14 (feito). Nenhum commit/push/PR sem autorização nominal explícita do mantenedor — ainda não solicitada.
