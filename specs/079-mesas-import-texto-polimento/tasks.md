# Tasks — 079 mesas import texto polimento

## Fase 0 — Investigação (já concluída na sessão de abertura, 2026-07-16)

- [x] T0.1 Confirmar relato do mantenedor (anúncio "A Censura") com
      verificação real: bug NÃO era "import texto desintegrado do parser" —
      é o MESMO `parseDiscordAnnouncement.ts` usado pelo JSON.
- [x] T0.2 Encontrar e corrigir causa raiz do relato original (herdado como
      spec 077, já commitado nesta sessão antes de abrir a 079):
      - `▬▬▬` como decoração inline virando fronteira de segmento
        (`segmentation.ts` → `splitBySeparators`).
      - "Data e hora: a definir" não resolvendo `day_of_week` para
        `to_define` (`DAY_TO_DEFINE_PATTERNS`).
- [x] T0.3 Testar bateria de 13 anúncios reais fornecidos pelo mantenedor —
      revelou bug estrutural maior (labels grudados numa linha só) presente
      em ~8 dos 13 casos, não coberto pelo fix de T0.2.
- [x] T0.4 Confirmar isolamento: JSON (`chatExporterAdapter.ts`) preserva
      `\n` reais do `content` da API Discord — bug de labels-grudados é
      exclusivo do fluxo de texto colado manual.
- [x] T0.5 Abrir esta spec (079) com escopo completo; registrar os 13 casos
      reais como fixture de evidência.

## Fase 1 — Normalizador de labels grudados (requisito 1, maior prioridade)

- [x] T1.1 Fixture criada em
      `apps/mesas/backend/src/inbox/__tests__/fixtures/discord-announcements-real.txt`
      — ampliada em 2026-07-17 pra 33 anúncios reais (verbatim de
      `D:\texto_colado.txt`, 1030 linhas; o recorte original de 13/22 era
      parcial do mesmo arquivo).
- [x] T1.2 `BARE_LABEL_STOP_KEYS` exportado de `parseDiscordAnnouncement.ts`
      (era privado), reaproveitado por `normalizeLooseText.ts` sem duplicar
      strings.
- [x] T1.3 `normalizeLooseText.ts` implementado: insere `\n` antes de label
      conhecido colado em linha corrida (guarda de 2+ `:` na linha, evita
      falso positivo tipo "Regras da Mesa:").
- [x] T1.4 Teste negativo cobrindo texto livre com palavra-label dentro de
      frase — `normalizeLooseText.test.ts`.
- [x] T1.5 Fixture completa rodada após T1.3 — confirmado que requisitos 5/6
      "somem" só com o normalizador (ver T2.0).
- [x] T1.6 Normalizador ligado em `routes/inbox/import.ts` (só nesse
      caminho — JSON não tocado, `chatExporterAdapter.ts` preserva `\n`
      reais da API Discord).
- [x] T1.7 Suíte `src/discord` + `src/inbox` 100% verde (498 testes,
      regressão zero no caminho JSON).

## Fase 2 — Bugs pontuais remanescentes (requisitos 4, 5, 6)

- [x] T2.0 Investigado (2026-07-16, antes de implementar Fase 1): rodei os
      casos "3-duskwood" e "2-narrun" com quebras de linha reais entre labels
      (só simulando o que o normalizador da Fase 1 vai produzir) — sistema,
      título e vagas saem TODOS corretos. Confirma que requisitos 5 e 6 são
      efeito colateral direto do bug estrutural (labels grudados), não bugs
      de regex separados. **Não precisam fix próprio** — só validar que
      seguem corretos após T1.3/T1.6 (T2.1/T2.2 viram só confirmação, não
      implementação).
- [x] T2.1 Confirmado: requisito 5 (vagas) correto na fixture completa
      pós-T1.6 — assert de regressão em `realWorldFixture.test.ts`.
- [x] T2.2 Confirmado: requisito 6 (system_name) correto na fixture
      completa pós-T1.6 — assert de regressão em `realWorldFixture.test.ts`.
- [x] T2.3 Requisito 4 (contato telefone/WhatsApp) implementado —
      `WHATSAPP_PHONE_RE`/`extractContactPhoneUrl` em
      `parseDiscordAnnouncement.ts`, gera link `wa.me` como `contact_url`
      (weakest-priority fallback, atrás de forms/URL confirmada/menção
      Discord explícita — corrigido em review pra vencer URL *não*-confirmada).
- [x] T2.4 Regressão do fix de T2.3 coberta em
      `parseDiscordAnnouncement.test.ts` + fixture real (casos "A Censura" e
      "Vampiro a Máscara Dark Ages").

## Fase 3 — Campo "Nome do Mestre" (requisito 7)

- [x] T3.0 Investigado: `actual_gm_name` já existe na tabela `tables`
      (`migration_04_publisher_role_and_contacts.sql`), já usado pelo form
      manual (`StepConfig.tsx`). **Sem migration nova.** Bug real encontrado:
      sync via Discord hoje popula esse campo com o autor da MENSAGEM
      (`payload.source.author_name`), não um valor extraído do texto — errado
      quando divulgador ≠ mestre real (caso #11 do lote: "Narrador: um
      conhecido meu, apenas estou postando por ele").
- [x] T3.1 Parser extrai `Mestre:`/`Narrador:`/`GM:`/`DM:` como texto
      (`extractHostName` em `parseDiscordAnnouncement.ts`) — campo novo
      `raw_gm_name` em `DiscordTableDraftTable` (`discord/types.ts`).
- [x] T3.2 `syncHelpers.ts`/`syncDiscordDraftToTable.ts`/
      `syncImportDraftToTable.ts`: `gmName` prefere `raw_gm_name` extraído
      do texto quando presente; fallback pro `author_name`/
      `adminDisplayName` conforme fluxo (admin explícito sempre vence).
- [x] T3.3 Frontend `DraftEditorTab.tsx`: campo "Nome do mestre (opcional)"
      exposto, populado pela sugestão do parser, editável antes do sync.
- [x] T3.4 Testes focados backend (`parseDiscordAnnouncement.test.ts`,
      `syncDiscordDraftToTable.test.ts`, `syncImportDraftToTable.test.ts`)
      cobrindo extração + prioridade de fallback.

## Fase 5 — Pré-preenchimento assistido no fluxo público `create-table` (requisito 8)

- [x] T5.1 Decisão: rota `POST /api/v1/gm/parse-preview` (namespace `gm`,
      não `tables` — consistente com o resto das rotas de mestre logado).
      Correlação preview↔submissão via `discord_parse_cases` existente
      (`final_action: 'draft'` no preview, UPDATE pra `'synced'` no submit
      real) — sem tabela/persistência intermediária nova.
- [x] T5.2 `parseTextForPreview.ts` criado, reaproveitando
      `normalizeLooseText` + `segmentAnnouncements` + `parseDiscordAnnouncement`
      + `buildTableDraftFields`/`extractContacts`/`extractSchedules` do
      fluxo admin — zero duplicação de tradução de campo. Não persiste em
      `discord_import_table_drafts`/`import_messages`.
- [x] T5.3 Rota `POST /gm/parse-preview` — `authMiddleware` + checagem de
      `gm_profiles` (igual `POST /gm/tables`, corrigido em review — a
      checagem faltava na 1ª versão). Devolve formato consumível por
      `mapTableApiToInitialData.ts`/`FormState`.
- [x] T5.4 Correlação via `discord_parse_cases.id` (`parse_case_id`),
      reenviado pelo front no submit real — sem ID de sessão separado.
- [x] T5.5 Confirmado: `final_action` é `string` livre em
      `DiscordParseCasesTable` (não enum fechado) — `'synced'` já era valor
      aceito, sem migration necessária.
- [x] T5.6 `gmPanel.ts` `POST /tables`: quando `data.parse_case_id` presente,
      `recordPublishedParseCase` (fire-and-forget, best-effort) fecha o loop
      — UPDATE `final_result_json`/`final_action='synced'`, com proteção
      `WHERE final_action='draft'` (corrigido em review — impede
      sobrescrever case já fechado por outro mestre).
- [x] T5.7 `PainelMestrePage.tsx`: `createTableEntryMode`
      ('choice'/'manual'/'paste') — tela de escolha com 2 cards
      ("Preencher manualmente" vs "Colar anúncio", badge "Mais rápido",
      borda de accent), disclaimer fixo de nunca publicar sozinho. Escolha
      não persiste entre sessões.
- [x] T5.8 `ParsePreviewTextArea.tsx` + `useCreateTableForm.ts`: resposta do
      preview mapeada via `mapTableApiToInitialData` (import dinâmico,
      alinhado ao padrão já usado no modo edição — corrigido em review por
      anular code-split), popula o form; mestre segue fluxo normal de
      edição/revisão/submissão.
- [x] T5.9 `ParsePreviewTextArea.tsx`: banner de sugestão (`suggestedGmName`)
      quando `actual_gm_name` extraído diverge do `user.name` da conta
      logada — nunca sobrescreve automaticamente, só avisa pra revisar o
      campo no form abaixo. Implementado na auditoria de 2026-07-17 (não
      existia antes).
- [x] T5.10 Degrade gracioso: `mapTableApiToInitialData` já tem fallback por
      campo (`stringValue`/`nullableStringValue` com default); preview sem
      alguns campos não quebra o form, mantém default atual.
- [x] T5.11 Testes focados: `parseTextForPreview.test.ts` (5 casos) +
      `gmPanel.parsePreview.test.ts` (8 casos, criado na auditoria de
      2026-07-17 — cobre autorização, resposta com/sem match, e o loop de
      aprendizado completo: UPDATE synced, proteção contra sobrescrita,
      falha best-effort não derruba publicação).
- [ ] T5.12 Smoke manual real: colar anúncio real no fluxo público, confirmar
      pré-preenchimento, corrigir 1+ campo, publicar, confirmar registro em
      `discord_parse_cases` (read-only, `psql SELECT`). **Bloqueado**
      (2026-07-17): sem backend local com Postgres/SSO configurado nesta
      sessão; não improvisado contra beta/prod sem autorização nominal.

## Fase 4 — Validação e fechamento

- [x] T4.1 Fixture completa (33 anúncios reais) passando com campos corretos
      nos pontos dos requisitos 1, 4, 5, 6 — assert por caso em
      `realWorldFixture.test.ts` (10 testes), não só smoke visual.
- [x] T4.2 `turbo run lint` (21/21) + `turbo run build` (21/21) repo-wide
      verdes (2026-07-17). Nota: `pnpm run lint`/`pnpm run build` na raiz
      (via script npm) batem num bug de infra pré-existente não relacionado
      a esta spec — `turbo run lint`/`turbo run build` direto contorna e
      confirma o resultado real.
- [x] T4.3 `pnpm verify:api` rodado (rota nova `POST /gm/parse-preview` +
      `createTableSchema`/`CreateTablePayload` alterados) — 0 breaking
      changes, 1 non-breaking (a rota nova).
- [ ] T4.4 Smoke manual real: colar 3+ casos reais em `/gestao/importacao` →
      "Importar texto", conferir draft criado. **Bloqueado** (mesmo motivo
      de T5.12 — sem ambiente local com backend+Postgres).
- [x] T4.5 `specs/backlog.md` (`BL-079-PARSER-TEXTO`) e `project-state.md`
      atualizados (2026-07-17).
- [ ] T4.6 Autorização do mantenedor para commit/push/PR — **pendente**
      (regra pétrea, nada commitado ainda; PR #172 já existe pro conteúdo
      commitado anteriormente, mas correções desta auditoria seguem locais).

## Nota de execução

Mantenedor vai enviar mais textos/anúncios reais ao longo da spec — cada novo
lote amplia a fixture da Fase 1 (T1.1) e pode revelar bugs pontuais novos para
a Fase 2. Não fechar a Fase 1/2 prematuramente; reabrir T1.5/T2.x conforme
novos casos chegarem, antes de avançar para Fase 5.
