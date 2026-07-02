# Sessao — 26-07-01 — mesas parser learning/spec 058

## Escopo

Registrar uma nova spec para arquitetura escalavel de aprendizado do parser de importacao de mesas, com DeepSeek usando memoria operacional, exemplos proximos, feedback humano, rejeicoes e deduplicacao.

## Contexto

- O arquivo real `D:\teste.json` mostrou que o problema nao e apenas importacao: o parser precisa distinguir rascunhos validos, descartes, preco pago/gratuito/desconhecido, duplicatas e ambiguidades.
- Ajustar cada micro palavra em codigo nao escala. Regex deve ficar restrito a sinais estruturais/obvios.
- O mantenedor pediu uma spec nova para revisao posterior em GPT 5.5 altissimo antes de qualquer implementacao real.

## Plano desta sessao

- Criar `specs/058-mesas-parser-learning-deepseek/`.
- Escrever `spec.md`, `plan.md` e `tasks.md` como proposta arquitetural pre-implementacao.
- Registrar backlog/status documental minimo.
- Nao commitar, nao pushar, nao implementar migration/rota/pipeline agora.

## Evidencia

- T0 ja carregado no chat.
- T1 pertinente consultado: `specs/README.md`, `specs/backlog.md`, `project-state.md`, sessao ativa 057 e padrao da spec 052.

## Resultado

- Criada spec `specs/058-mesas-parser-learning-deepseek/`.
- Criados `spec.md`, `plan.md`, `tasks.md`.
- Atualizados mapas: `specs/README.md`, `specs/backlog.md`, `.specify/memory/project-state.md`, `sessoes/index.md`.
- Estado da spec: planejada/pre-implementacao; implementacao bloqueada ate revisao 5.5 altissimo.

## Retomada — Fase 0

- Pedido do mantenedor: modelo em raciocinio altissimo; executar a Fase 0 da spec 058.
- Escopo desta retomada: revisar criticamente a arquitetura, procurar gaps, decidir MVP minimo, decidir modelo de dados final e atualizar mapas.
- Trava: sem implementar parser/migration/rota/UI nesta fase; apenas arquitetura e decisao registradas.
- Metodo: verificar a spec 058 contra o codigo real existente da 048/052 antes de fechar veredito.

### Evidencia consultada

- T0 completo recarregado: `project-state.md`, `context-capsule.md`, `decisions.md`.
- T1 de specs/sessoes: `specs/README.md`, `specs/backlog.md`, esta sessao.
- Codigo real:
  - `apps/mesas/database/migration_129_import_corrections.sql`
  - `apps/mesas/database/migration_131_discord_import_runs.sql`
  - `apps/mesas/database/migration_133_discord_field_learning.sql`
  - `apps/mesas/backend/src/routes/discord/utils.ts`
  - `apps/mesas/backend/src/discord/fieldLearning.ts`
  - `apps/mesas/backend/src/discord/llmAssist.ts`
  - `apps/mesas/backend/src/discord/aiSuggestions.ts`
  - `apps/mesas/backend/src/discord/aiEval.ts`
  - `apps/mesas/backend/src/routes/discord/metrics.ts`

### Resultado da Fase 0

- Criado `specs/058-mesas-parser-learning-deepseek/reviews.md`.
- Veredito: a direcao geral esta correta, mas o MVP nao deve ser DeepSeek. Primeiro precisa memoria imutavel e baseline.
- Gaps principais registrados:
  - `import_corrections` tem `draft_id ON DELETE CASCADE`, logo nao serve como fonte duravel de aprendizado.
  - `discord_field_learning` e cache util, mas estreito demais para regra de dominio.
  - shadow atual mede autoaprovacao, nao parse/versionamento/duplicata/descarte.
  - DeepSeek atual nao recebe ContextPack com exemplos/regras/rejeicoes/duplicatas.
- Decisao de modelo:
  - Fase 1: `discord_parse_cases` + `discord_parse_feedback`.
  - Fase 2: `discord_duplicate_candidates` + retrieval local.
  - Fase 3: `discord_learning_rules`; `discord_field_learning` fica como cache/projecao.
  - Fase 4: `discord_llm_decisions` + ContextPack DeepSeek.
- MVP minimo escolhido: instrumentation-only (`parse_case` + feedback imutavel + baseline), sem alterar comportamento, sem nova chamada DeepSeek, sem auto-publicacao.
- Atualizados: `spec.md`, `plan.md`, `tasks.md`, `specs/README.md`, `specs/backlog.md`, `.specify/memory/project-state.md`, `sessoes/index.md`.
- Implementacao segue bloqueada ate autorizacao nominal da Fase 1.

## Retomada — Fase 1

- Pedido nominal do mantenedor: "Inicie a fase 1".
- Escopo autorizado: MVP-058-A instrumentation-only.
- Farei:
  - contratos TypeScript/Zod para `ParseCase` e `ParseFeedback`;
  - migrations online-safe aditivas para `discord_parse_cases` e `discord_parse_feedback`;
  - persistencia best-effort de `parse_case` e feedback imutavel;
  - baseline com `D:\teste.json`;
  - validacao de zero mudanca funcional.
- Nao farei:
  - nova chamada DeepSeek;
  - regra aprendida ativa;
  - auto-descarte/auto-publicacao;
  - commit/push.

### Resultado da Fase 1

- Criada migration online-safe `apps/mesas/database/migration_136_discord_parse_learning.sql`.
  - `discord_parse_cases`: casos de parse versionados, hashes, features, resultado deterministico/final, parser version.
  - `discord_parse_feedback`: eventos humanos imutaveis.
  - FKs para drafts/mensagens/runs usam `ON DELETE SET NULL`, nao cascade destrutivo.
- Tipos Kysely atualizados em `apps/mesas/backend/src/db/types.ts`.
- Criado `apps/mesas/backend/src/discord/parseLearning.ts`:
  - contratos Zod `parseCaseContractSchema` e `parseFeedbackContractSchema`;
  - hash/normalizacao/features;
  - escrita best-effort de `parse_case` e feedback;
  - helpers de status/scope.
- Instrumentacao sem mudar comportamento:
  - `routes/discord/utils.ts`: registra casos no parse/ignore e feedback de correcao/status.
  - `routes/discord/drafts.ts`: registra feedback de rejeicao em lote.
  - `discord/syncHelpers.ts`: registra feedback de sync/publicacao.
  - `routes/inbox/import.ts`: registra casos para texto colado/manual paste.
- Baseline offline registrado em `specs/058-mesas-parser-learning-deepseek/baseline.md`:
  - `D:\teste.json`: 50 total, 43 drafts, 7 descartes, 25 pagas, 3 gratuitas, 15 unknown, todos drafts `needs_review`.
- Validacao:
  - `pnpm --filter @artificio/mesas-backend build` ✅
  - `pnpm --filter @artificio/mesas-backend test` ✅ 36 files / 339 tests
  - `pnpm verify:api` ✅ exit 0 (regenerou artefatos `docs/api/generated/*` e `docs/api/openapi/mesas.openapi.yaml`; warnings existentes de paths ambiguos).
  - `pnpm run lint` ✅
  - `pnpm run build` ✅
  - `git diff --check` ✅ (apenas warnings CRLF do Windows)
  - logs esperados de testes existentes permanecem (adminProfile erro simulado, fieldLearning db down simulado, purge de capa simulado).
- Sem commit/push.

## Retomada — Fase 2

- Pedido nominal do mantenedor: "Faça a fase 2 do 058".
- Escopo autorizado: retrieval local + duplicatas em shadow.
- Farei:
  - migration online-safe para `discord_duplicate_candidates`;
  - retrieval por hash exato, hash normalizado, `pg_trgm` e sinais estruturais;
  - separacao de exemplos positivos, negativos, corrigidos e candidatos de duplicata para futuro ContextPack;
  - persistencia best-effort de candidatos sem agir sozinho.
- Nao farei:
  - chamada DeepSeek nova;
  - auto-descartar, auto-publicar, atualizar mesa existente ou impedir draft automaticamente;
  - UI de decisao humana de duplicata;
  - commit/push.

### Resultado da Fase 2

- Criada migration online-safe `apps/mesas/database/migration_137_discord_duplicate_candidates.sql`.
  - `discord_duplicate_candidates`: candidato, score, sinais, status humano futuro e auditoria.
  - Indices para `pg_trgm` em `discord_parse_cases.normalized_text`, `features_json` e consultas de candidatos.
- Criado `apps/mesas/backend/src/discord/parseRetrieval.ts`.
  - Hash bruto/normalizado tem prioridade maxima.
  - `similarity()` do `pg_trgm` entra como sinal local ordenavel.
  - Sinais estruturais entram no score: form URL, anexos, guild, canal, autor e sistema inferido.
  - Contexto separado em `duplicate_candidates`, `similar_cases`, `positive_examples`, `negative_examples` e `corrected_examples`.
- `parseLearning.ts` agora registra features mais ricas (`text_urls`, `form_urls`, `attachment_urls`, `embed_urls`) e chama retrieval em best-effort apos criar `parse_case`.
- Sem mudanca de comportamento final:
  - nenhuma mesa e criada/atualizada/descartada automaticamente por duplicata;
  - candidato fica com `status='candidate'` aguardando decisao humana futura.
- Validacao inicial:
  - `pnpm --filter @artificio/mesas-backend build` ✅
  - `pnpm --filter @artificio/mesas-backend test` ✅ 37 files / 343 tests
  - `pnpm verify:api` ✅ exit 0 (warnings existentes de paths ambiguos; artefatos API regenerados)
  - `pnpm run lint` ✅
  - `pnpm run build` ✅
  - `git diff --check` ✅ (apenas warnings CRLF do Windows)
  - busca de trailing whitespace nos arquivos da Fase 2 ✅

## Retomada — Fase 3

- Pedido nominal do mantenedor: "Avance pra fase 3".
- Escopo autorizado: learning rules ampliadas.
- Farei:
  - migration online-safe para `discord_learning_rules`;
  - regra derivada de feedback humano;
  - lookup/aplicacao com guardas de escopo, status e confianca;
  - rejeicao/supressao de regra contraditoria;
  - tratamento de conflito sem decisao silenciosa;
  - compatibilidade/backfill com `discord_field_learning`.
- Nao farei:
  - DeepSeek ContextPack;
  - UI nova de explicacao/ensino;
  - auto-publicacao;
  - commit/push.

### Resultado da Fase 3

- Criada migration online-safe `apps/mesas/database/migration_138_discord_learning_rules.sql`.
  - `discord_learning_rules`: `rule_type`, `field`, `input_token`, `output_value`, `scope_type`, `scope_json`, `scope_hash`, `confidence`, `hits`, `rejections`, `applied_count`, `status`, `source`.
  - `discord_learning_rule_applications`: auditoria de aplicacao/conflito/shadow por regra.
  - Backfill de `discord_field_learning` como `migration_seed`, preservando compatibilidade.
- Criado `apps/mesas/backend/src/discord/learningRules.ts`.
  - Gera regra `field_value` a partir de correcao humana.
  - Aplica somente regra `active`, confianca >= 0.80 e escopo compativel.
  - Conflito de valores divergentes bloqueia hit silencioso.
  - Correcao contraditoria incrementa rejeicao, reduz confianca e suprime a regra.
- Integração:
  - `registerDraftCorrection()` grava regra ampliada junto com o learning-store legado.
  - `enrichDraftWithLlm()` consulta regras ampliadas antes do store legado/IA e registra aplicacoes.
- Validacao inicial:
  - `pnpm --filter @artificio/mesas-backend build` ✅
  - `pnpm --filter @artificio/mesas-backend test` ✅ 38 files / 348 tests
  - `pnpm verify:api` ✅ exit 0 (warnings existentes de paths ambiguos; artefatos API regenerados)
  - `pnpm run lint` ✅
  - `pnpm run build` ✅
  - `git diff --check` ✅ (apenas warnings CRLF do Windows)
  - busca de trailing whitespace nos arquivos da Fase 3 ✅

## Retomada — Fase 4

- Pedido nominal do mantenedor: "avance para a fase 4".
- Escopo autorizado: DeepSeek ContextPack com cache/auditoria e resposta validada.
- Farei:
  - migration online-safe para `discord_llm_decisions`;
  - `ContextPack` Zod com regras, conflitos, exemplos proximos e politicas;
  - prompt resistente a prompt injection;
  - cache por hash + provider/model/prompt_version;
  - auditoria de sucesso/falha/timeout/cache hit;
  - fallback deterministico quando retorno for invalido.
- Nao farei:
  - auto-publicacao;
  - decisao irreversivel;
  - UI nova;
  - commit/push/deploy.

### Resultado da Fase 4

- Criada migration online-safe `apps/mesas/database/migration_139_discord_llm_decisions.sql`.
  - `discord_llm_decisions`: provider, model, prompt_version, context_pack_hash, request/response/validated JSON, latencia, token estimate, status e erro.
  - Indice unico parcial de cache para decisoes `success`.
- Criado `apps/mesas/backend/src/discord/llmContextPack.ts`.
  - `contextPackSchema` com politicas, mensagem normalizada, parse deterministico, campos pendentes, regras aplicaveis, conflitos e exemplos de retrieval.
  - `hashContextPack()` para cache estavel.
- `llmAssist.ts` agora expõe `assistDiscordParseWithContextPack()`.
  - Consulta cache antes de chamar DeepSeek.
  - Valida schema da API, JSON e campos extraidos.
  - Registra auditoria para sucesso, cache hit, resposta invalida, HTTP error, timeout e erro.
  - Prompt trata mensagem do Discord como dado nao confiavel.
- Integração:
  - `enrichDraftWithLlm()` chama o wrapper ContextPack no fluxo existente de sugestao revisavel.
  - Retorno invalido continua caindo para deterministico/learning local.
- Validacao inicial:
  - `pnpm --filter @artificio/mesas-backend build` ✅
  - `pnpm --filter @artificio/mesas-backend test` ✅ 39 files / 350 tests
  - `pnpm verify:api` ✅ exit 0 (warnings existentes de paths ambiguos; artefatos API regenerados)
  - `pnpm run lint` ✅
  - `pnpm run build` ✅
  - `git diff --check` ✅ (apenas warnings CRLF do Windows)
  - busca de trailing whitespace nos arquivos da Fase 4 ✅

## Retomada — Fase 5

- Pedido nominal do mantenedor: "implemente a fase 5".
- Escopo autorizado: UX e decisao humana de duplicatas.
- Farei:
  - rota para listar candidatos de duplicata do draft;
  - rota para registrar decisao humana (`confirmed_duplicate`, `rejected_duplicate`, `update_existing`);
  - aba "Duplicatas" no preview de draft;
  - testes de backend, frontend e API client.
- Nao farei:
  - auto-descartar draft;
  - auto-atualizar mesa existente;
  - auto-publicacao;
  - commit/push/deploy.

### Resultado da Fase 5

- Criado `apps/mesas/backend/src/routes/discord/duplicates.ts`.
  - `GET /admin/discord/drafts/:id/duplicates` retorna candidatos do `parse_case` mais recente do draft.
  - `PATCH /admin/discord/duplicate-candidates/:id` grava decisao humana em `discord_duplicate_candidates.status`.
  - A decisao alimenta `recordParseFeedback()` como `duplicate` ou `not_duplicate`.
- `apps/mesas/backend/src/routes/adminDiscordSync.ts` monta as rotas novas sob `/drafts` e `/duplicate-candidates`.
- Frontend:
  - `discordSyncApi.ts` ganhou `listDuplicateCandidates()` e `resolveDuplicateCandidate()`.
  - `types.ts` ganhou tipos de `DuplicateCandidate`.
  - `DiscordDraftPreview.tsx` mostra a aba "Duplicatas" quando a API completa existe.
  - `DuplicatesTab.tsx` lista score, sinais, texto normalizado e botoes de decisao humana.
- Ajuste aplicado durante revisao:
  - a aba "Duplicatas" agora aparece apenas quando `listDuplicateCandidates` e `resolveDuplicateCandidate` estao injetados, evitando aba vazia com contrato parcial.
- Testes adicionados:
  - `apps/mesas/backend/src/routes/discord/duplicates.test.ts`
  - `apps/mesas/frontend/src/features/discord-sync/components/DuplicatesTab.test.tsx`
  - cobertura de candidatos no `discordSyncApi.test.ts`
  - cobertura da aba no `DiscordDraftPreview.test.tsx`
- Validacao:
  - `pnpm --filter @artificio/mesas-backend build` ✅
  - `pnpm --filter @artificio/mesas-frontend build` ✅
  - `pnpm --filter @artificio/mesas-backend test` ✅ 40 files / 354 tests
  - `pnpm --filter @artificio/mesas-frontend test` ✅ 14 files / 157 tests
  - `pnpm verify:api` ✅ exit 0; mesas +3 non-breaking; warnings existentes de paths ambiguos
  - `git diff --check` ✅ (apenas warnings CRLF do Windows)
  - `pnpm run lint` ✅
  - `pnpm run build` ✅
  - `pnpm run test` ✅ repo-wide
- Sem commit/push/deploy.

## Retomada — Fase 6

- Pedido nominal do mantenedor: "avance para a fase 6".
- Escopo autorizado: UX de revisao que ensina.
- Farei:
  - mostrar origem por campo no formulario de revisao;
  - mostrar evidencia textual curta quando houver dado no payload;
  - preservar feedback estruturado existente no save/rejeicao/duplicata;
  - manter a revisao sem formulario extra.
- Nao farei:
  - migration nova;
  - rota nova;
  - auto-publicacao;
  - commit/push/deploy.

### Resultado da Fase 6

- `draftFormUtils.ts` ganhou:
  - `DraftFieldInsight`;
  - `buildDraftFieldInsights(parsedPayload, currentPayload)`;
  - classificacao por `parser`, `learning-store`, `deepseek` e `humano`.
- `useDraftForm.ts` calcula `fieldInsights` a partir de `parsed_payload` + payload atual.
- `DraftEditorTab.tsx` mostra chips compactos abaixo dos campos:
  - origem (`Parser`, `Learning`, `DeepSeek`, `Humano`);
  - sugestao pendente quando vem de `_ai_suggestions`;
  - evidencia curta de `_raw_evidence`, alteracao humana ou valor extraido.
- Feedback estruturado:
  - save continua usando `submitCorrectionDiff()` com before/after por campo;
  - rejeicao continua registrada por `handlePatchDraft()` como `discard`;
  - duplicata continua registrada por `PATCH /duplicate-candidates/:id`.
- Testes adicionados/atualizados:
  - `draftFormUtils.test.ts`: origem parser, humano, learning/DeepSeek.
  - `DraftEditorTab.test.tsx`: chips de origem/evidencia sem formulario extra.
  - `DiscordDraftPreview.test.tsx`: mock atualizado com `fieldInsights`.
- Validacao:
  - `pnpm --filter @artificio/mesas-frontend build` ✅
  - `pnpm --filter @artificio/mesas-frontend test` ✅ 14 files / 148 tests
  - `git diff --check` ✅ (apenas warnings CRLF do Windows)
  - `pnpm verify:api` ✅ exit 0; warnings existentes de paths ambiguos
  - `pnpm run lint` ✅
  - `pnpm run build` ✅
  - `pnpm run test` ✅ repo-wide
- Sem commit/push/deploy.

## Retomada — Fase 7

- Pedido nominal do mantenedor: "implemente a fase 7".
- Escopo autorizado: eval e shadow do parser learning.
- Farei:
  - dataset de avaliacao a partir de `discord_parse_cases` + feedback humano confirmado;
  - metricas por campo e por acao;
  - comparacao incremental parser vs learning vs DeepSeek;
  - shadow mode por camada, sem decisao automatica.
- Nao farei:
  - auto-publicacao;
  - auto-descarte;
  - deploy;
  - commit/push.

### Resultado da Fase 7

- Criada migration online-safe `apps/mesas/database/migration_140_discord_parse_eval_shadow.sql`.
  - `discord_parse_shadow_decisions`: registra predicao por camada (`parser`, `learning`, `deepseek`), acao prevista, payload previsto, confianca, reason codes e resultado humano posterior.
  - FKs usam `ON DELETE SET NULL`; nenhuma acao irreversivel.
- Criado `apps/mesas/backend/src/discord/parseEval.ts`.
  - Monta dataset reproduzivel de `discord_parse_cases` + `discord_parse_feedback`.
  - Usa feedback humano confirmado como alvo.
  - Mede `action`, `price_type`, `system_name`, `slots_total`, `slots_open`, `day_of_week`, `start_time`, `contact_url`.
  - Compara camadas `parser`, `learning` e `deepseek` a partir do resultado deterministico e das sugestoes `_ai_suggestions` por provider.
- `recordParseCase()` agora grava shadow por camada em best-effort apos inserir o caso.
- `recordParseFeedback()` fecha `actual_action` do shadow quando o humano corrige, descarta, publica, ignora ou decide duplicata.
- `GET /admin/discord/automation/parse-eval` retorna `{ examples, layers }` com acuracia por campo/camada.
- Ajuste mecanico: separador de hash em `parseLearning.ts` trocado de NUL literal para `\u0000`, mantendo assinatura e deixando diff textual.
- Testes:
  - `apps/mesas/backend/src/discord/__tests__/parseEval.test.ts`.
- Validacao inicial:
  - `pnpm --filter @artificio/mesas-backend test -- src/discord/__tests__/parseEval.test.ts src/discord/__tests__/parseLearning.test.ts` ✅ 41 files / 360 tests
  - `pnpm --filter @artificio/mesas-backend build` ✅
  - `pnpm verify:api` ✅ exit 0; mesas +4 non-breaking; warnings existentes de paths ambiguos
  - `git diff --check` ✅ (apenas warnings CRLF do Windows)
  - `pnpm run lint` ✅
  - `pnpm run build` ✅
  - `pnpm run test` ✅ repo-wide
- Ajuste de validação:
  - `DuplicatesTab.tsx` foi ajustado para remover `setState` sincronico dentro de `useEffect`; estado agora e chaveado por `draftId`, mantendo loading correto na troca de draft e lint verde.
- Sem commit/push/deploy.

### Fase 5 (T5.1-T5.3) — decisao humana de duplicatas

- Backend: `apps/mesas/backend/src/routes/discord/duplicates.ts` (novo) — `GET /drafts/:id/duplicates` (estado derivado `match_kind` exact/probable via score/signals, sem migration nova) + `PATCH /duplicate-candidates/:id` (persiste decisao humana em `discord_duplicate_candidates.status` + alimenta `recordParseFeedback` da Fase 3, reaproveitando `feedback_type` `duplicate`/`not_duplicate` ja existente). Montado em `adminDiscordSync.ts`.
- Frontend: `types.ts` + `discordSyncApi.ts` (schemas zod novos) + `DuplicatesTab.tsx` (novo) + aba "Duplicatas" em `DiscordDraftPreview.tsx`/`useDraftForm.ts`, degrade gracioso quando a API nao suporta (ex.: Inbox).
- Validacao: `tsc --noEmit` limpo (back+front), `pnpm run lint` limpo (1 fix `react-hooks/set-state-in-effect`), `pnpm run build` 17/17, vitest backend alvo 5/5.
- `tasks.md` da spec 058 atualizado (T5.1-T5.3 `[x]`).

### Achado de review externo (Codex, PR #124) — corrigido

- **Bug real no scanner `scripts/api/inventory.ts`:** ao resolver `router.use()` para um router importado, o codigo pegava "o primeiro Router local do arquivo" em vez de casar pelo nome exportado real. `duplicates.ts` exporta 2 routers (default `router` com GET, named `duplicatesRouter` com PATCH) — o scanner gerava `GET /duplicate-candidates/{id}/duplicates` (rota fantasma, 404 real) e nunca publicava o `PATCH /duplicate-candidates/{id}` que a UI chama de verdade.
- Fix: `collectImports` agora rastreia o nome exportado de origem por binding local (`importExportName`); `collectExportsToLocal` (novo) mapeia export→variavel local de cada arquivo; resolucao de `routerScopeVar` usa esse match exato, com fallback ao heuristico antigo so se nao resolver.
- Regenerado: `pnpm api:inventory` → `pnpm api:bundle` → `pnpm api:generate-openapi` → `pnpm api:lint` (limpo; warnings restantes preexistentes em glossario, nao tocados) → `pnpm api:check` (exit 0, 0 orfas/duplicatas). YAML confere as 2 rotas reais.

### Achado proprio (investigacao) — auto-parse truncava acima de 500, corrigido

- `apps/mesas/backend/src/routes/discord/import.ts`: `POST /import-json` (auto-parse) e `POST /import-json/reparse` faziam `.limit(500)` numa unica query e reportavam `total`/`auto_parse.total` como se fosse o universo inteiro; import aceita ate 2000 mensagens/lote, entao acima de 500 o resto ficava `pending` sem nova rodada automatica, calado.
- Fix: `autoParsePendingImportedMessages` agora fatia `importedMessages` em lotes de 500 e soma os totais. `/reparse` sem `messageIds` repete a mesma query em lotes (cada mensagem processada sai do filtro de status, entao a proxima iteracao pega o proximo lote) ate esgotar ou bater teto de seguranca (20 lotes = 10k), retornando `truncated:true` se bater o teto; com `messageIds` explicito (>500), fatia em chunks e cada chunk resolve numa unica query.
- Teste de regressao novo `apps/mesas/backend/src/routes/discord/import.test.ts` (3/3 verde): >1200 importedMessages em 3 lotes; reparse sem ids em 2 lotes (500+300); reparse batendo o teto de seguranca reporta `truncated:true`.
- Validacao: `tsc --noEmit` limpo no arquivo tocado (2 erros restantes sao preexistentes em `chatExporterImportService.test.ts`, ja modificado antes desta sessao, nao relacionados); vitest alvo 3/3.
- **Build quebrado (nao introduzido nesta sessao):** `pnpm run build` do `mesas-backend` falha por `chatExporterImportService.test.ts:300,309` (fixture sem `reactions`/`mentions`/`inlineEmojis` do tipo). Registrado em `specs/backlog.md` (`BL-058-PARSER-LEARNING-DEEPSEEK`, DEB-058-BUILD-01) — nao corrigido nesta sessao (fora do escopo pedido, mas bloqueia build verde da spec).
- Sem commit/push/deploy.
