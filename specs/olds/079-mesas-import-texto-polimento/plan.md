# Plano — 079

## Arquitetura da solução

Fase 0 (investigação, já feita nesta sessão antes de abrir a spec):
- Confirmado que `parseDiscordAnnouncement.ts`/`splitLabelLine` assume 1
  label por linha; texto colado real do Discord frequentemente perde `\n`
  entre labels.
- Confirmado isolamento: JSON (`chatExporterAdapter.ts`) preserva `\n` reais,
  não sofre do mesmo bug.
- Coletados 13 anúncios reais do mantenedor como fixture de regressão
  (`sessoes/` desta spec ou `__tests__/fixtures/` — decidir ao implementar).

Fase 1 — pré-processador de texto colado (requisito 1, o maior):
- Novo módulo `apps/mesas/backend/src/inbox/normalizeLooseText.ts` (ou nome
  similar), chamado SÓ em `routes/inbox/import.ts` antes de
  `textToRawMessage`/`parseDiscordAnnouncement` — nunca no caminho JSON.
- Lista fechada de labels conhecidos (reusar a mesma lista de aliases já
  hardcoded em `parseDiscordAnnouncement.ts` — não duplicar strings, exportar
  e importar).
- Heurística: para cada label conhecido que aparece precedido de espaço (não
  início de linha) e seguido de `:`/`：`, inserir `\n` antes dele. Não
  mexe dentro de blocos que já têm `\n` reais (idempotente — não deve dobrar
  quebra em texto já bem formatado, ver teste negativo).
- Teste negativo explícito: texto de sinopse/descrição contendo a palavra
  "sistema" ou "mestre" sem ser um cabeçalho de campo (ex: "o sistema de
  vigilância os observava") não pode ganhar quebra espúria.

Fase 2 — bugs pontuais de extração (requisitos 4, 5, 6):
- Requisito 5 (vagas capturando hora): investigar `slotsViaLabel`/
  `extractSlots` — regex de vagas deve escopar ao valor já extraído pelo
  label (`extractLabelValue`), não re-buscar dígitos soltos no texto inteiro
  após a Fase 1 resolver a maior parte por si (repetir bateria dos 13 casos
  DEPOIS da Fase 1 para ver quantos bugs "somem" só com a quebra de linha
  correta, antes de codar fix extra).
- Requisito 4 (telefone/WhatsApp): nova função `extractContactPhone`
  (regex de telefone BR perto de "whatsapp"/"zap"/"zapzap"), só populando
  quando `contact_url`/`contact_discord` explícito ausentes. Decidir campo de
  destino: reaproveitar `contact_url` com prefixo (`tel:`/`whatsapp:`) ou
  campo novo `contact_phone` — avaliar impacto em `syncHelpers.ts`/schema
  antes de escolher (registrar decisão aqui antes de codar).
- Requisito 6 (system_name contaminado): revalidar após Fase 1; se persistir,
  isolar causa em `extractLabelValue`/`matchSystem`.

Fase 3 — campo "Nome do Mestre" (requisito 7):
- **Achado da investigação (2026-07-16): NÃO precisa migration.** O campo de
  destino já existe — `actual_gm_name` na tabela `tables`
  (`migration_04_publisher_role_and_contacts.sql`), já usado pelo form manual
  (`StepConfig.tsx`), já mapeado em `mapper.ts`/`mapTableApiToInitialData.ts`.
  Hoje, no sync via Discord, `actual_gm_name` recebe `gmName =
  config.getGmName(payload, adminDisplayName)` (`syncHelpers.ts:573`), que lê
  `payload.source.author_name` — o nome de exibição de QUEM POSTOU a
  mensagem no Discord, não um campo extraído do texto do anúncio. Isso é
  ERRADO quando divulgador ≠ mestre real (caso real #11 do lote de evidência:
  "Narrador: um conhecido meu, apenas estou postando por ele"). Fix real do
  requisito 7 é no PARSER, não no schema:
  - Adicionar `raw_gm_name`/`host_name` (nome exato a decidir) em
    `TableDraftPayload` (`discord/types.ts`) — campo NOVO no contrato do
    draft, extraído de labels `Mestre:`/`Narrador:`/`GM:`/`DM:` com valor
    texto (`extractHostName`, distinto do já existente
    `extractHostDiscordId` que só pega menção `<@id>`).
  - Em `syncHelpers.ts`, `gmName` passa a preferir o valor extraído do texto
    quando presente e não-vazio, com fallback pro `author_name` atual (não
    quebra comportamento hoje estável quando o texto não tem o label).
- Frontend: campo já existe (`StepConfig.tsx` no form manual) — no
  `DraftEditorTab.tsx` (revisão admin de draft Discord), expor o mesmo campo
  populado pela sugestão do parser, editável antes do sync.

Fase 5 — pré-preenchimento assistido no fluxo público `create-table`
(requisito 8, maior novidade de produto desta spec):
- **Reuso, não duplicação**: mesmo parser (`parseDiscordAnnouncement` +
  normalizador da Fase 1) chamado a partir de uma rota nova ou reaproveitada
  do backend admin (`routes/inbox/import.ts` já faz parse sem persistir
  imediatamente — avaliar extrair um `parseTextForPreview(text)` que devolve
  só o draft parseado, sem tocar `discord_import_table_drafts`/
  `import_messages`, já que aqui não é fluxo de curadoria admin).
- Backend: rota nova (ex.: `POST /api/v1/tables/parse-preview` ou dentro do
  namespace de `create-table`) — **auth**: mestre autenticado (SSO), não
  `requireAdmin` (rota admin não pode ser reaproveitada crua — é fluxo
  público). Roda parser + normalizador, devolve o objeto de campos sugeridos
  (mesmo formato usado por `mapTableApiToInitialData.ts`/`FormState`), SEM
  persistir nada em `discord_import_table_drafts`/`import_messages` (evita
  poluir tabelas de curadoria admin com rascunhos de mestres comuns) — mas
  **grava o `deterministic_result_json` em memória de request/sessão curta**
  para comparar depois com o que o mestre efetivamente publicar (ver abaixo).
- Frontend (`create-table`): **novo passo 0, antes do form atual** —
  `PainelMestrePage.tsx` hoje entra direto em `view === 'create-table'` →
  `<CreateTableForm>`. Passa a mostrar primeiro uma tela de escolha com 2
  cards lado a lado (design validado com o mantenedor, ver protótipo
  desta sessão):
  - Card 1 "Preencher manualmente" — form em branco, fluxo atual sem
    mudança (`CreateTableForm` direto).
  - Card 2 "Colar anúncio" (destacado como opção recomendada/mais rápida,
    borda de accent) — abre textarea (reaproveitar `TextPasteArea.tsx`,
    ajustado para chamar a rota nova de preview, não `/import-text`).
    Depois de colar e confirmar, mapeia resposta em `useCreateTableForm.ts`
    (reaproveitar `mapTableApiToInitialData.ts`) e entra no MESMO
    `CreateTableForm` de sempre, só que pré-preenchido — sem form paralelo
    novo, sem divergência de UI entre os dois caminhos.
  - Aviso fixo abaixo dos cards: nunca publica sozinho, mestre sempre revisa
    e confirma campo a campo antes de salvar (mesmo texto em ambos os
    caminhos, reforça o modelo "sugestão, não decisão automática").
  - Escolha entre os 2 cards não é permanente/lembrada — sempre pergunta de
    novo a cada "Nova Mesa" (mestre pode ter, às vezes, anúncio pronto e às
    vezes não).
- **Aprendizado (parte crítica do requisito)**: no momento da submissão real
  do form (`POST`/`PUT` de criação de mesa em `useCreateTableForm.ts`), SE
  a sessão tinha um `deterministic_result_json` de preview pendente, chamar
  `recordParseCase`/`buildParseCaseContract` (`parseLearning.ts`) com
  `finalResult = payload publicado`, `finalAction` = ação equivalente a uma
  correção humana (reaproveitar o mesmo enum de `parseActionFromDraftStatus`/
  criar variante `create_table_manual` se o enum não cobrir esse contexto —
  registrar decisão exata na task de implementação). Isso é o mesmo padrão
  de `registerDraftCorrection` (`routes/discord/utils.ts`), só disparado por
  um fluxo público em vez de admin.
- Correlação preview↔submissão: usar um ID de sessão curto (gerado no
  preview, devolvido ao frontend, reenviado na submissão) — não expor nem
  depender de `import_message_id`/`draft_id` (não existem aqui, não é fluxo
  admin).
- Nome do Mestre (requisito 7) nesse fluxo: se extraído do texto e divergir
  do nome de exibição da conta logada, mostrar como sugestão secundária, não
  sobrescrever o campo de identidade automaticamente.

## Arquivos afetados (por módulo/pacote)

- `apps/mesas/backend/src/inbox/` (novo normalizador + testes)
- `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts` (fixes pontuais
  requisitos 5/6, extração de mestre requisito 7, extração de telefone
  requisito 4 — todos aditivos)
- `apps/mesas/backend/src/routes/inbox/import.ts` (chamar normalizador;
  possível extração de `parseTextForPreview` reaproveitada pela Fase 5)
- `apps/mesas/backend/src/routes/tables/` (rota nova de preview, Fase 5 —
  confirmar namespace real ao implementar)
- `apps/mesas/backend/src/discord/parseLearning.ts` (reaproveitado, sem
  redesenho — Fase 5 só chama `recordParseCase`/`buildParseCaseContract`
  existentes a partir de um novo `finalAction`)
- `apps/mesas/frontend/src/features/discord-sync/components/DraftEditorTab.tsx`
  (campo Nome do Mestre)
- `apps/mesas/frontend/src/features/inbox/components/TextPasteArea.tsx`
  (reaproveitado/adaptado para o preview do create-table, Fase 5)
- `apps/mesas/frontend/src/features/create-table/` (hook, mapper, form —
  novo passo de pré-preenchimento, Fase 5)
- `apps/mesas/backend/db/` (migration, SE decisão de requisito 7 for
  persistir — a confirmar; Fase 5 não deve precisar de migration nova, dado
  que não persiste rascunho, só popula form)
- Testes: `parseDiscordAnnouncement.test.ts`, `segmentation.test.ts` (herda),
  novo arquivo de fixture com os 13 casos reais, testes novos de
  `create-table` (preview + aprendizado disparado na submissão).

## Contratos/interfaces tocados

- Nenhum contrato de auth/accounts/SSO — rota nova da Fase 5 usa auth de
  mestre logado já existente (SSO), não cria mecanismo novo.
- Possível migration em `apps/mesas/database/` (schema `tables` ou
  `discord_import_table_drafts`) SE requisito 7 decidir persistir — checklist
  de migration da AGENTS.md aplica (5 campos de header, `pnpm verify:api` se
  expuser campo em rota admin).
- Rota nova de preview (Fase 5) entra em `docs/api/generated/*` via
  `pnpm verify:api` normalmente (rota pública nova sempre precisa).
- `discord_parse_cases` (tabela existente do pipeline de aprendizado) passa a
  receber registros com origem `create_table` além de `discord`/
  `manual_paste` — se `final_action`/`source_kind` for enum fechado no
  schema, confirmar se aceita valor novo ou se precisa migration de enum
  (checar `db/types.ts`/schema antes de codar Fase 5).

## Impacto em consumidores

- Só consumidores internos de `apps/mesas`: frontend admin `/gestao/*` E,
  a partir da Fase 5, frontend público `create-table` (mestres comuns).
  Nenhum consumidor externo/outro módulo lê esses payloads.

## Rollback

- Todas as mudanças são aditivas (novo módulo, novos campos opcionais, novos
  padrões OR'd em regex existente). Rollback = reverter commit/PR; nenhuma
  migration destrutiva prevista (campo novo é sempre nullable).

## Validação (como provo que funciona)

- Fixture com os 13 anúncios reais (texto verbatim) rodando fim a fim
  (segmentação + parse) com assert de campos-chave (título, sistema, vagas,
  contato) por caso.
- Suíte completa `src/discord` + `segmentation.test.ts` verde (regressão
  zero no JSON).
- `tsc --noEmit` + `eslint` limpos (backend+frontend mesas).
- Smoke manual real na tela `/gestao/importacao` com pelo menos 3 dos 13
  casos colados manualmente (não só teste automatizado).
