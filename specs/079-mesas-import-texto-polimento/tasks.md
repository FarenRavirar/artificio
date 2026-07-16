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

- [ ] T1.1 Criar fixture única com os 13 anúncios reais (texto verbatim,
      sem edição) em `apps/mesas/backend/src/inbox/__tests__/fixtures/` ou
      similar — reusar como base de TODAS as tasks seguintes.
- [ ] T1.2 Exportar lista de labels conhecidos de `parseDiscordAnnouncement.ts`
      (reusar, não duplicar strings).
- [ ] T1.3 Implementar `normalizeLooseText` (ou nome decidido): insere `\n`
      antes de label conhecido colado em linha corrida.
- [ ] T1.4 Teste negativo: texto livre com palavra-label dentro de frase
      (não cabeçalho) não ganha quebra espúria.
- [ ] T1.5 Rodar fixture completa (13 casos) após T1.3 — registrar quantos
      bugs dos requisitos 5/6 "somem" só com o normalizador.
- [ ] T1.6 Ligar normalizador em `routes/inbox/import.ts` (só nesse caminho,
      nunca no JSON).
- [ ] T1.7 Validar: suíte `src/discord` + `segmentation.test.ts` completa
      100% verde (regressão zero JSON).

## Fase 2 — Bugs pontuais remanescentes (requisitos 4, 5, 6)

- [x] T2.0 Investigado (2026-07-16, antes de implementar Fase 1): rodei os
      casos "3-duskwood" e "2-narrun" com quebras de linha reais entre labels
      (só simulando o que o normalizador da Fase 1 vai produzir) — sistema,
      título e vagas saem TODOS corretos. Confirma que requisitos 5 e 6 são
      efeito colateral direto do bug estrutural (labels grudados), não bugs
      de regex separados. **Não precisam fix próprio** — só validar que
      seguem corretos após T1.3/T1.6 (T2.1/T2.2 viram só confirmação, não
      implementação).
- [ ] T2.1 Confirmar requisito 5 (vagas) segue correto na fixture completa
      pós-T1.6 — sem código novo esperado, só assert de regressão.
- [ ] T2.2 Confirmar requisito 6 (system_name) segue correto na fixture
      completa pós-T1.6 — sem código novo esperado, só assert de regressão.
- [ ] T2.3 Implementar requisito 4 (contato telefone/WhatsApp) — este SIM é
      bug de extração real, não efeito do normalizador (número de telefone
      nunca teve regex própria). Decisão de campo de destino registrada em
      `plan.md` antes de codar.
- [ ] T2.4 Regressão do fix de T2.3 nos testes focados do arquivo tocado.

## Fase 3 — Campo "Nome do Mestre" (requisito 7)

- [x] T3.0 Investigado: `actual_gm_name` já existe na tabela `tables`
      (`migration_04_publisher_role_and_contacts.sql`), já usado pelo form
      manual (`StepConfig.tsx`). **Sem migration nova.** Bug real encontrado:
      sync via Discord hoje popula esse campo com o autor da MENSAGEM
      (`payload.source.author_name`), não um valor extraído do texto — errado
      quando divulgador ≠ mestre real (caso #11 do lote: "Narrador: um
      conhecido meu, apenas estou postando por ele").
- [ ] T3.1 Parser: extrair `Mestre:`/`Narrador:`/`GM:`/`DM:` como texto (não
      só menção `<@id>`, que já existe via `extractHostDiscordId`) — novo
      campo em `TableDraftPayload` (`discord/types.ts`), nome a decidir
      (`raw_gm_name`/`host_name`).
- [ ] T3.2 `syncHelpers.ts`: `gmName` prefere valor extraído do texto quando
      presente e não-vazio; fallback pro `author_name` atual quando ausente
      (não regride comportamento hoje estável).
- [ ] T3.3 Frontend `DraftEditorTab.tsx`: expor campo (já existe UI
      equivalente em `StepConfig.tsx` do form manual — reaproveitar padrão),
      populado pela sugestão do parser, editável antes do sync.
- [ ] T3.4 Testes focados backend (parser + syncHelpers fallback) + frontend.

## Fase 5 — Pré-preenchimento assistido no fluxo público `create-table` (requisito 8)

- [ ] T5.1 Confirmar/decidir com mantenedor antes de codar: namespace da rota
      nova de preview (`POST /api/v1/tables/parse-preview` ou similar), se
      `import_message_id`/persistência intermediária é aceitável ou se deve
      ser 100% stateless (ver plan.md — decisão de correlação preview↔submissão).
- [ ] T5.2 Backend: extrair/criar `parseTextForPreview(text)` reaproveitando
      normalizador (Fase 1) + `parseDiscordAnnouncement`, sem persistir em
      `discord_import_table_drafts`/`import_messages`.
- [ ] T5.3 Backend: rota nova, auth de mestre logado (SSO, não
      `requireAdmin`), devolve campos sugeridos no formato consumível por
      `mapTableApiToInitialData.ts`/`FormState`.
- [ ] T5.4 Backend: mecanismo de correlação preview↔submissão (ID de sessão
      curto, sem depender de tabelas do fluxo admin).
- [ ] T5.5 Verificar `discord_parse_cases`/`final_action` aceita novo valor de
      origem (`create_table` ou equivalente) — migration de enum se schema
      for fechado (checar `db/types.ts` antes de codar).
- [ ] T5.6 Backend: na submissão real de criação de mesa
      (`useCreateTableForm.ts` → rota de criar mesa), SE havia preview
      pendente correlacionado, chamar `recordParseCase`/
      `buildParseCaseContract` com `finalResult` = payload publicado —
      fecha o loop de aprendizado.
- [ ] T5.7 Frontend: novo passo 0 em `PainelMestrePage.tsx` (view
      `create-table`) — tela de escolha com 2 cards: "Preencher manualmente"
      (fluxo atual, sem mudança) vs "Colar anúncio" (destacado, borda de
      accent, badge "mais rápido"). Aviso fixo: nunca publica sozinho.
      Escolha não é lembrada entre sessões — pergunta sempre. Reaproveitar
      `TextPasteArea.tsx` adaptado pra rota de preview (não `/import-text`)
      dentro do card 2.
- [ ] T5.8 Frontend: mapear resposta do preview em `useCreateTableForm.ts`
      (reaproveitar `mapTableApiToInitialData.ts`), preencher form, mestre
      segue fluxo normal de edição/revisão/submissão — nunca publica sozinho.
- [ ] T5.9 Frontend: campo Nome do Mestre (requisito 7) nesse fluxo mostra
      sugestão secundária quando diverge do nome de exibição da conta, sem
      sobrescrever identidade automaticamente.
- [ ] T5.10 Degrade gracioso: campos não extraídos mantêm default atual do
      form, não ficam em branco/quebrado.
- [ ] T5.11 Testes focados: preview retorna campos esperados para 2-3 dos 13
      casos reais; submissão com correção manual gera registro de
      aprendizado com `final_result_json` divergente do
      `deterministic_result_json`.
- [ ] T5.12 Smoke manual real: colar anúncio real no fluxo público, confirmar
      pré-preenchimento, corrigir 1+ campo, publicar, confirmar registro em
      `discord_parse_cases` (read-only, `psql SELECT`).

## Fase 4 — Validação e fechamento

- [ ] T4.1 Fixture dos 13 casos passando com campos corretos nos pontos dos
      requisitos 1, 4, 5, 6 (assert por caso, não só smoke visual).
- [ ] T4.2 `pnpm run lint` + `pnpm run build` (mesas backend+frontend no
      mínimo; repo-wide antes do fechamento).
- [ ] T4.3 `pnpm verify:api` SE rota/payload admin OU rota nova de preview
      (Fase 5) mudou/criou payload público.
- [ ] T4.4 Smoke manual real: colar 3+ dos 13 casos em
      `/gestao/importacao` → "Importar texto", conferir draft criado.
- [ ] T4.5 Atualizar `specs/backlog.md` e `project-state.md`.
- [ ] T4.6 Autorização do mantenedor para commit/push/PR (regra pétrea — não
      commitar por inferência).

## Nota de execução

Mantenedor vai enviar mais textos/anúncios reais ao longo da spec — cada novo
lote amplia a fixture da Fase 1 (T1.1) e pode revelar bugs pontuais novos para
a Fase 2. Não fechar a Fase 1/2 prematuramente; reabrir T1.5/T2.x conforme
novos casos chegarem, antes de avançar para Fase 5.
