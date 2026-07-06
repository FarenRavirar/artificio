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

### DEB-058-02 resolvido + nitpick zod + fix tabela fantasma api-diff (2026-07-02)

- **DEB-058-02 (reparse pendentes sem UI):** PR #125 `fix/mesas-import-reparse-pending` commitado/pushado/mergeado em `dev` (merge commit `498d5a5`), todos checks verdes (`lint + build + test`, codeql, api-governance, secret/osv/semgrep, CodeRabbit, snyk). Deploy beta disparado (`deploy.yml` module=mesas env=beta, run 28625933373).
- **Nitpick CodeRabbit (PR anterior) — procede, aplicado:** `reparseResultSchema` em `apps/mesas/frontend/src/features/discord-sync/api/discordSyncApi.ts` usava `z.number()` puro nos 5 contadores (`total`/`reparsed`/`discarded`/`ignored`/`errors`); migrado p/ `z.number().int().nonnegative()`, alinhado ao `batchResultSchema` no mesmo arquivo. Rejeita fracionário/negativo (bug de backend) antes de virar estado/UI, cumprindo a pétrea de normalização de payload externo. `truncated` inalterado (boolean). Lint verde no arquivo.
- **Fix `docs/api/generated/api-diff.generated.md` (tabela fantasma):** CI reprovou o push com "Artefatos de governança de API desatualizados". Causa raiz: `dev` local estava atrás de `origin/dev` (c21511b vs edfa33b) e `scripts/api/diff-api.ts:86` tenta o ref `dev` local ANTES de `origin/dev`, gerando uma tabela de "3 non-breaking mesas" com `path`/`method` vazios (fantasma). CI não tem branch `dev` local → cai em `origin/dev` fresco e produz "nenhuma mudança". Corrigido com `git update-ref refs/heads/dev origin/dev` (fast-forward do ref local sem checkout) + `pnpm verify:api` → arquivo regenerado com header `**Base:** dev` e conteúdo "Nenhuma mudança detectada". Header mantido como `dev` (não `origin/dev`) para bater com o que o CI grava (`GITHUB_BASE_REF=dev`).
- Commit único (código + artefato) na branch de trabalho, conforme trava pétrea de 1 commit por push.
- **Falta:** rodar o botão "Reparse pendentes" manualmente no mesas-beta pós-deploy p/ zerar as 50 mensagens `pending` travadas (dado órfão sobrevive ao deploy — 1 clique manual).

## Retomada — SDD Lite: 3 bugs reportados na UI de importação (2026-07-02)

### Escopo

Mantenedor reportou via screenshots de `/gestao/importacao`: (1) capa/imagem sempre quebrada mesmo em JSON recém extraído; (2) título vindo com `#` literal; (3) sem controle funcional pra bloquear mesa paga na importação (mecanismo de deteção já existe mas nunca foi ligado a um filtro); (4) caracteres estranhos em campos extraídos. Pedido explícito: SDD Lite (sem spec/plan/tasks formal), correção direta.

### Investigação (Explore + leitura direta)

- **Capa quebrada:** `useDraftForm.ts:34` (antes) e `DiscordDraftReviewTable.tsx:372` faziam fallback `cover_url || cover_url_source` — `cover_url_source` é a URL assinada crua do Discord CDN (expira em minutos). Upload real pro Cloudinary já roda no parse (`persistCoverUpload` em `utils.ts`, chama `uploadCoverForDraft` em `syncHelpers.ts:284`), mas falha silenciosa (`expired_url`/`network`/`cloudinary`, ex.: sem bot token configurado em `discord/config.ts:48-61`) grava `cover_url=null` e a UI caía pro source cru — sempre quebrado quando o upload falha.
- **Título com `#`:** `normalizeTitle()` (`parseDiscordAnnouncement.ts`) só removia `*` e aspas curvas; `splitThreadName()` (fallback de título via 1ª linha do body/thread name) não limpava nada. Mensagens reais (`D:\teste.json`) confirmam: `# Rigor Mortis`, `## **Dark Tower**`, `-# Mesa profissional PAGA`, separadores `▬»━─`, emoji (🔥⚖️📖🎲), zero-width/controle.
- **Filtro mesa paga:** `extractPrice()` já classifica `price_type` corretamente; zero uso desse dado pra bloquear import. `DiscordJsonImportPanel.tsx` não tinha nenhum controle. `processDiscordMessageToDraft` (`utils.ts`) processava tudo sem discriminar.
- **Caracteres estranhos:** mesma raiz do bug do título — decoração markdown/emoji/zero-width do Discord sobrevivendo à extração de título/sistema.

### Decisões nominais do mantenedor (via pergunta)

- Flag mesa paga: default **desmarcado** (bloqueia pagas por padrão; usuário liga explicitamente pra aceitar).
- Capa: corrigir a causa raiz (upload automático já existe), não só reordenar preview — mas manter escopo SDD Lite sem migration nova: frontend não usa mais `cover_url_source` como `<img src>` (fallback fadado), só `cover_url` confirmado.
- Sanitização de caracteres: "só letra/número/acento" pedido literal do mantenedor, mas com exceção pra pontuação presa a palavra de título real (apóstrofo, hífen, `&`, `:`) — confirmado via pergunta após mostrar que a regra estrita quebraria `D&D`/`Baldur's Gate`/`Vampiro: A Máscara`. Roda pré-parse, dentro do próprio parser (`normalizeTitle`/`splitThreadName`), antes de qualquer registro em `discord_parse_cases` (camada de aprendizado).

### Implementação

- `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts`: nova `stripDecorativeMarkup()` — remove zero-width/controle/BOM/replacement char (via `\u` escapes explícitos, não literais — ver nota de bug abaixo), emoji (`\p{Extended_Pictographic}`), marcas decorativas Discord (`#*_~\`▬▭►▶»«━─┃┅┄╍✦`), e aplica whitelist `\p{L}\p{N}\s'&:-` preservando quebra de linha (crítico: `getAnnouncementSystemHint` depende de `\n` pra pegar só a 1ª linha do valor). Plugada em `normalizeTitle()` e nos 2 ramos de `splitThreadName()`.
- `apps/mesas/frontend/src/features/discord-sync/useDraftForm.ts:34` e `components/DiscordDraftReviewTable.tsx:372`: `coverPreviewUrl`/`coverUrl` usam só `cover_url` confirmado; nunca mais renderiza `cover_url_source` cru como `<img>`.
- Filtro de mesa paga: `processDiscordMessageToDraft()` (`routes/discord/utils.ts`) ganhou parâmetro `acceptPaidTables = true` (default preserva comportamento anterior pra callers que não passam); quando `false` e `parsed.table.price_type === 'paga'`, mensagem vira `ignored` e o caso é registrado como `discard` na camada de aprendizado (`recordParseCase`) — sem migration nova, reusa outcome `'discarded'` existente. Propagado por `reparseOneMessage`, `autoParsePendingImportedMessages`, e as 3 rotas (`POST /import-json`, `POST /import-json/file`, `POST /import-json/reparse`) via novo helper `readAcceptPaidTables(req.body)`. Frontend: checkbox "Incluir mesas pagas na importação" em `DiscordJsonImportPanel.tsx`, logo abaixo do texto de upload manual, default `false`; estado em `useJsonImport.ts`, propagado em `discordSyncApi.importJson/importFile/reparsePending`.

### Bug próprio descoberto e corrigido durante a implementação

- Minha 1ª versão de `stripDecorativeMarkup` usava caracteres zero-width **literais** dentro do regex-source (colados no arquivo `.ts`), o que corrompeu a leitura/grep do arquivo (passou a aparecer como binário pro `grep`) e quebrou silenciosamente o `\s+` collapse — colapsava também `\n`, destruindo a dependência de `getAnnouncementSystemHint` em `hint.split(/[\r\n]/)[0]` pra isolar só a 1ª linha do campo "Sistema:" e ignorar linhas de continuação (descrição). Sintoma: teste `NÃO descarta sistema conhecido (D&D) nem por menção solta de "próprio" no corpo` passou a falhar (`classifyHomebrew` retornava `'discard'` por engolir a frase "material autoral de apoio" da continuação). Corrigido: (1) regex reescrita com `\u` escapes explícitos em vez de char literal; (2) collapse de whitespace mudado pra preservar `\n` (`[^\S\n]+` em vez de `\s+`). Lição: nunca colar caractere zero-width/controle literal em regex-source; sempre `\u` escape.

### Validação

- `pnpm --filter @artificio/mesas-backend build` ✅
- `pnpm --filter @artificio/mesas-backend test` ✅ 42 files / 368 tests
- `pnpm --filter @artificio/mesas-frontend build` ✅
- `pnpm --filter @artificio/mesas-frontend test` ✅ 14 files / 149 tests (2 assertions atualizadas pra novo default `acceptPaidTables=false`/`true` conforme caller)
- `pnpm run lint` ✅ (15/15)
- `pnpm run build` ✅ (17/17)
- `pnpm run test` ✅ (24/24 tasks)
- `pnpm verify:api` ✅ exit 0 — sem breaking change (mudança é só em body params opcionais de rotas existentes, não em contrato de rota/schema OpenAPI)
- `git diff --check` ✅ (só warnings CRLF pré-existentes do Windows)

### Estado

Código local, **sem commit/push/deploy** (aguardando autorização nominal). Testado só localmente — sem smoke beta/prod. Escopo tocou só `apps/mesas` (backend+frontend), sem migration, sem contrato de rota novo.

### Correção pós-feedback: separadores de seção não eram só decoração solta (2026-07-02)

Mantenedor apontou (com evidência) que a limpeza inicial estava rasa: os separadores reais do Discord (`▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬`, `━━━━`, `═══`) aparecem em **blocos de repetição** (linha inteira do mesmo caractere), não como pontuação isolada — e a limpeza anterior só cobria whitelist de título/system_name, não o corpo/description nem o texto que alimenta `discord_parse_cases`.

- Contei ocorrências reais em `D:\teste.json`: `▬` (1142x) concentrado em só 27 linhas 100%-separadoras — confirma o padrão descrito.
- Nova `stripSeparatorLines()` (exportada de `parseDiscordAnnouncement.ts`) com 4 regras, cada uma calibrada contra os 50 casos reais do JSON: (1) linha inteira composta só de caracteres decorativos+espaço → remove a linha; (2) marcador decorativo solto no início de uma linha-de-campo (`▬ Sistema: X`, `» Título: Y`) → remove só o prefixo, preserva o dado; (3) bloco de 4+ repetições consecutivas do mesmo símbolo em qualquer posição (separador colado depois do dado, ex.: `» Título: X ▬▬▬▬▬▬▬▬▬▬▬`) → remove o bloco; (4) símbolos puramente gráficos (`▬▭►▶»«━─┃┅┄╍✦═⎯⸻`, que nunca aparecem soltos em português natural — diferente de `#`/`*`/`-`/`_`/`=`/`~`, que têm uso legítimo isolado) → remove em qualquer posição/quantidade.
- Aplicada logo na montagem do `body` em `parseDiscordAnnouncement()` e `getAnnouncementSystemHint()` — roda ANTES de qualquer extração de campo (título, sistema, mentions, host, contato), garantindo que nenhum campo nem a camada de aprendizado (`discord_parse_cases`) seja contaminado.
- Nova `cleanDescriptionText()` separada (não misturada em `stripSeparatorLines`) — remove mentions Discord crus (`<@id>`, `<@&roleId>`) e markdown de ênfase (`**`, `*`, `__`, `_`, `~~`, `` ` ``) SÓ no texto final de `description`, DEPOIS que `rawEvidence`/host/contato já extraíram esses tokens do body original. Mentions crus viram ID numérico sem nome legível — não úteis pra quem lê o anúncio da mesa (decisão nominal do mantenedor); ficam preservados à parte em `_raw_evidence.role_mentions`/`user_mentions` pra quem precisar auditar.
- `normalizeParseLearningText()` (`parseLearning.ts`, usado pra `normalized_text`/hash/features/retrieval de `discord_parse_cases`) agora chama `stripSeparatorLines()` ANTES do collapse de `\s+` — sem isso, a linha separadora vira ruído colado no meio do texto único-linha depois do collapse.
- **1ª tentativa (mentions+emphasis dentro de `stripSeparatorLines`) quebrou 5 testes:** `extractHostFromMentions`/`extractRoleAndUserMentions`/`resolveDiscordContact` operam sobre o `body` e precisam ler `<@id>`/`<@&id>` crus — remover cedo demais destruía `host_discord_id`, `contact_discord` e `_raw_evidence`. Corrigido separando em duas funções: `stripSeparatorLines` (segura, roda cedo, só decoração estrutural) e `cleanDescriptionText` (mentions+ênfase, roda só na `description` final, depois que tudo mais já foi extraído).
- Validado iterativamente rodando o parser real contra os 50 casos de `D:\teste.json` (script descartável, não commitado) até `STILL HAS ▬` = 0 em todos.
- Validação final: `pnpm --filter @artificio/mesas-backend build` ✅; `pnpm --filter @artificio/mesas-backend test` ✅ 42 files/368 tests; `pnpm run lint` ✅ 15/15; `pnpm run build` ✅ 17/17; `pnpm run test` ✅ 24/24 repo-wide. Sem mudança de contrato de API (parser puro, backend-only).
- Sem commit/push/deploy — aguardando autorização nominal.

### Sumário final pré-commit (DEB-058-03) — arquivos, decisões, trade-offs

**Escopo total do diff** (`apps/mesas` backend+frontend, sem `packages/*`, sem migration, sem contrato de rota novo — só body params opcionais em rotas existentes):

| Arquivo | O que mudou | Por quê |
|---|---|---|
| `backend/src/discord/parseDiscordAnnouncement.ts` | `stripDecorativeMarkup()` (whitelist letra/número/acento/espaço + pontuação de palavra), `stripSeparatorLines()` (4 regras contra separadores estruturais), `cleanDescriptionText()` (mentions crus + markdown de ênfase), `readAcceptPaidTables` NÃO está aqui (está em `import.ts`) | Título/sistema/description chegavam com `#`, `▬▬▬`, `<@id>`, `**` sobrevivendo ao parser |
| `backend/src/discord/parseLearning.ts` | `normalizeParseLearningText()` chama `stripSeparatorLines()` antes do collapse de espaço | Sem isso, `discord_parse_cases.normalized_text`/hash/features ficavam contaminados pelos mesmos separadores |
| `backend/src/routes/discord/import.ts` | `readAcceptPaidTables(req.body)`, propagado nas 3 rotas (`/`, `/file`, `/reparse`) | Mecanismo de detecção de `price_type` existia mas não filtrava nada — pedido explícito do mantenedor de um controle funcional |
| `backend/src/routes/discord/utils.ts` | `processDiscordMessageToDraft(..., acceptPaidTables = true)`, `reparseOneMessage(..., acceptPaidTables)` | Ponto único onde parse decide draft vs. descarte — reusa outcome `'discarded'` existente, sem migration |
| `frontend/.../useDraftForm.ts` | `coverPreviewUrl` só usa `cover_url` confirmado | `cover_url_source` é URL Discord CDN assinada que expira em minutos — usá-la como fallback de `<img>` garantia preview quebrado sempre que o upload real falhasse |
| `frontend/.../DiscordDraftReviewTable.tsx` | Mesma correção na lista de rascunhos (thumbnail) | Mesmo bug, segundo local de renderização |
| `frontend/.../DiscordJsonImportPanel.tsx` | Checkbox "Incluir mesas pagas na importação" (default `false`) abaixo do texto de upload manual | Local exato pedido pelo mantenedor |
| `frontend/.../useJsonImport.ts` | State `acceptPaidTables`, propagado em `handleSubmit`/`handleReparsePending` | Fiação do checkbox até a chamada de API |
| `frontend/.../discordSyncApi.ts` | `importJson`/`importFile`/`reparsePending` ganham parâmetro `acceptPaidTables` | Contrato de request, sem mudar rota/schema OpenAPI (campo opcional) |
| `discordSyncApi.test.ts`, `DiscordJsonImportPanel.test.tsx` | Assertions atualizadas pro novo parâmetro | Testes pré-existentes verificavam `toHaveBeenCalledWith` sem o 2º arg |
| `docs/api/generated/*.json/.md` | Regenerados por `pnpm verify:api` | Consumers/inventory mudaram (novo campo no client), sem breaking change |

**Decisões que exigiram pergunta ao mantenedor (não inferidas):**
1. Default do checkbox de mesa paga → **desmarcado** (bloqueia por padrão).
2. Fix de capa → corrigir causa raiz (parar de usar URL fadada), não só reordenar preview, mas sem escopo de migration nova.
3. Regra de sanitização de texto → whitelist letra/número/acento/espaço **com exceção** pra pontuação presa a palavra (apóstrofo/hífen/`&`/`:`) — a regra 100% literal quebraria `D&D`, `Baldur's Gate`, `Vampiro: A Máscara`.
4. Escopo da limpeza de separadores → título **e** description **e** camada de aprendizado (não só título) — mantenedor corrigiu minha 1ª entrega que só cobria título/system_name.
5. Mentions crus (`<@id>`) em description → remover (mantenedor: "esses id não ajudam em nada... não são úteis pra mesas").

**Bugs próprios descobertos e corrigidos durante o trabalho (nenhum ficou só no chat):**
- Zero-width char literal colado em regex-source corrompeu leitura do arquivo + quebrou `\s+` collapse (destruía dependência de `\n` em `getAnnouncementSystemHint`) — pego por teste existente, corrigido com `\u` escapes.
- 1ª versão de limpeza de mentions/markdown rodando cedo demais (dentro de `stripSeparatorLines`) quebrou extração de `host_discord_id`/`contact_discord`/`_raw_evidence` — pego por 5 testes falhando, corrigido separando em `cleanDescriptionText` que roda só depois da extração.

**O que NÃO foi feito (fora de escopo SDD Lite, não bloqueia):**
- Sem migration nova (filtro de mesa paga reusa outcome `discarded` existente).
- Sem smoke beta/prod (validação só local, contra `D:\teste.json` real + suites automatizadas).
- `image_upload_status`/`image_upload_last_error` não exposto na UI (daria visibilidade de POR QUE a capa falhou) — resolvido de forma mais simples (não mostrar fallback quebrado), registrar como possível melhoria futura se o mantenedor quiser diagnóstico mais rico.

## Retomada — investigação sistema não detectado (2026-07-02)

### Pedido do mantenedor

Draft real ("Ruins of Gauntlight") não detectou sistema "Pathfinder 2e" apesar do texto trazer claramente. Mantenedor pediu: registrar sessão, investigar, pensar solução escalável (infinitas formas de escrever), e propor melhoria de UX pro campo Sistema (select vira lista enorme; sugeriu modelo "tag" com cruzamento contra banco de sistemas/aliases/edições).

### Investigação (read-only, sem código alterado)

- Lido `parseDiscordAnnouncement.ts`: `findSystemMatch`/`matchSystem` (linha 202-262) já cruzam contra `SystemEntry[]` (name/name_pt/aliases) vindo do banco — mecanismo de match já existe e é razoável.
- Causa raiz: `splitLabelLine()` (linha 546) exige `:`/`：` na MESMA linha do label. Texto do draft usa formato "Sistema" (linha própria) + "Pathfinder 2e" (linha seguinte), SEM `:` — é layout tipo WordPress/site colado, diferente do nativo Discord `Sistema: X`. `extractLabelValue` nunca acha o label nessa forma, `explicitSystem` fica null, fallback de thread name também não ajuda (thread name é só o título).
- Segundo achado (mesmo turno): `DraftEditorTab.tsx:137-142` usa `<select>` HTML nativo com `systems.map` — lista plana sem busca, confirma reclamação do mantenedor. Já existe `SystemTreeSelector.tsx` (combobox com busca, usado no fluxo de criação de mesa) — candidato a reuso.
- Terceira ideia (tag-like + sugestão automática): pipeline de `system_suggestion` já existe (`SystemSuggestionModal.tsx`/`SystemSuggestionResolutionDrawer.tsx`) para quando parser não acha match — mas depende do hint textual estar isolado corretamente primeiro (mesmo bug do item 1: sem hint, sem sugestão).

### Registro

- Criado `specs/058-mesas-parser-learning-deepseek/debitos.md` com DEB-058-04 (3 sub-achados: parser não cobre layout label-newline-valor; UX de `<select>` sem busca; sugestão automática depende do fix do hint).
- Nenhum código alterado nesta investigação — aguardando decisão do mantenedor (perguntas feitas via AskUserQuestion no mesmo turno).

### Decisões nominais do mantenedor (2026-07-02, via pergunta)

- Escopo completo A+B+C: extração sem `:` + matcher hierárquico (usa árvore real `parent_id`/`node_type` já existente em `systems`, ambiguidade vira `needs_review` com candidatos, não chute) + normalização tolerante a abreviação/erro leve. Mantenedor rejeitou explicitamente "mexer o mínimo possível" — pediu pensar fora da caixa antes de codar.
- Auto-alias no loop de aprendizado: ao resolver `system_suggestion`, grava texto do Discord como alias novo (`is_official=false`) do sistema/edição escolhido — fecha loop sem IA.
- UX: trocar `<select>` do `DraftEditorTab.tsx` pelo `SystemTreeSelector.tsx` já existente (reuso, sem componente novo).
- Processo: continua dentro da spec 058 (não abre SDD Lite separado). Registrado como Fase 9 em `tasks.md` (T9.1-T9.8).

### Estado

Plano registrado em `specs/058-mesas-parser-learning-deepseek/tasks.md` (Fase 9) e `debitos.md` (DEB-058-04). Pronto pra iniciar implementação — aguarda próximo turno/autorização de início de código.

### Escopo fechado após rodada de perguntas (2026-07-02)

Mantenedor corrigiu escopo inicial (não é só sistema): "se em algum momento do texto citar algum dos sistemas conhecidos ou alias, tem que fazer cruzamentos até encontrar o sistema mais correto" + "candidatos não só de sistema, mas das abas que temos que preencher" + "se existem as informações, tem que ser preenchidas".

Mapeamento campo a campo do form de draft (`title, system_id, type, modality, price_type, slots_total, slots_open, day_of_week, start_time, frequency, contact_url, contact_discord, description, cover_quality`) contra `parseDiscordAnnouncement.ts`:

- **Já cobertos (varrem corpo/texto inteiro livremente, não só label):** modalidade (`extractModality`), tipo (`extractType`), preço (`extractPrice`), vagas (`extractSlots`), dia da semana (`extractDayOfWeek`), horário (`extractStartTime`/`extractDiscordTimestamp`), contato URL/Discord (`extractContactUrl`/`extractContactDiscord`), descrição (label ou corpo inteiro fallback). Confirmado lendo código real linha a linha — mantenedor pediu confirmação campo a campo antes de aceitar, não aceitei de primeira.
- **Gap 1 confirmado:** sistema — banco de referência (`systems`+`system_aliases`, nome/name_pt/alias/edição) existe e tem matcher (`findSystemMatch`/`matchSystem`), mas só roda sobre `systemHint` (label estruturado) OU fallback em `fullText` só quando não há hint nenhum. Não varre título+descrição+corpo sempre juntando candidatos. Causa raiz do caso relatado (DEB-058-04).
- **Gap 2 confirmado:** plataforma e tags — têm tabela no banco, mas parser NUNCA cruza contra elas (nenhuma função `extractPlatform`/`extractTags` existe).
- **Gap 3 confirmado:** frequência — só é INFERIDA (`deriveFrequency`: campanha+dia→"semanal" sempre), nunca lê texto explícito ("quinzenal", "mensal" citado é ignorado).

Escopo autorizado nominalmente para IMPLEMENTAÇÃO (ainda não iniciada — só análise/registro até aqui):
1. Motor de busca full-text para SISTEMA: varre título+campo+descrição+corpo inteiro, coleta todos os candidatos que casam com banco de sistemas/aliases/edições, rankeia (label explícito > título > corpo; edição > sistema pai; exato > tolerante), decide sozinho só sem conflito — conflito real (2 sistemas diferentes citados) vai pra `needs_review`.
2. Mesmo motor estendido para PLATAFORMA e TAGS (bancos de referência existentes, hoje sem cruzamento nenhum).
3. FREQUÊNCIA ganha extração própria (enum fixo semanal/quinzenal/mensal, regex livre no corpo) ANTES do fallback `deriveFrequency` atual.
4. UX: trocar `<select>` nativo em `DraftEditorTab.tsx` (sistema) pelo componente de busca já existente (`SystemTreeSelector.tsx` ou equivalente), evitando lista plana gigante.

Fora de escopo desta rodada (registrado, não descartado): "sistema como tag que aprende sozinho" completo (auto-cadastro de alias por uso) — mantenedor quis discutir desenho antes, mas a conversa evoluiu direto pro escopo acima; retomar se ele quiser aprofundar esse ponto especificamente depois.

Nenhum código alterado ainda. Próximo passo: atualizar `debitos.md`/`tasks.md` da spec 058 com esse escopo fechado e pedir autorização nominal explícita pra começar a implementação.

### Revisão adversarial do plano ampliado (agente g1-governance-reviewer, 2026-07-02)

Escrito `specs/058-mesas-parser-learning-deepseek/auto-preenchimento-draft.md` (visão ampliada pós-pedido do
mantenedor de "auto-preenchimento máximo perfeito possível" cobrindo TODOS os campos do form, não só sistema).
Mapeamento contra schema real confirmou gap maior que o previsto: `TablesTable` (mesa publicada) tem
`vtt_platform_id`, `communication_platform_id`, `age_rating`, `content_warnings`, `safety_tools`,
`style_tags`, `setting_styles` que NÃO EXISTEM em `DiscordTableDraftTable` (draft) nem no editor
(`DraftEditorTab.tsx`) — não é só falta de extração, é falta de campo no schema.

Mandado agente `g1-governance-reviewer` (read-only) revisar adversarialmente o doc. Achados:

1. **[crítico]** Fase E do doc ("garantir propagação draft→mesa") tratava isso como pendência simples. Código
   real (`apps/mesas/backend/src/discord/syncHelpers.ts:451-471`, função de sync draft→`tables`) já existe e
   o `.set()` mapeia só um subconjunto fixo de campos (`title/description/type/modality/price_type/
   price_value/slots_*/system_id/cover_url/actual_gm_name/status`). Qualquer campo novo adicionado ao draft
   (VTT platform/age_rating/tags/etc.) fica preenchido no draft e É DESCARTADO SILENCIOSAMENTE na
   sincronização se essa função não for editada também. Fase E é reescrever `syncHelpers.ts`, não só
   "verificar propagação".
2. **[importante]** Não existe tabela de referência pra `content_warnings`/`safety_tools`/`style_tags`/
   `setting_styles` — confirmado `string[]` livre sem FK em `db/types.ts`. Motor de matching-contra-banco
   (Fase A) NÃO se aplica a esses 4 campos, só a sistema/VTT platform/communication platform. Escopo de Fase
   A precisa reduzir.
3. **[importante]** `extractContacts` (`syncHelpers.ts:148-170`) só distingue `'discord'` vs `'form'` genérico
   — enum `TableContactChannel` tem `'whatsapp'`/`'facebook'`/`'instagram'`/`'phone'`/`'email'` mas nunca são
   usados. Mantenedor pediu explicitamente "recrutamento (link, whats, formulários)" como categorias
   distintas — gap não coberto no doc original.
4. **[importante — GAP do pedido original]** "o usuario do discord se tiver nada" (citação literal do
   mantenedor) — fallback de contato pro autor Discord (`host_discord_id`, já existe no draft) quando não há
   link/whats/form nenhum. `extractContacts` não tem esse fallback. Doc original não cobria.
5. **[nota]** Pergunta 4 do doc (migration precisa SDD Completo?) já tinha resposta objetiva em `AGENTS.md`:
   migration/banco SEMPRE exige SDD Completo, regra é por TIPO de mudança, não por escopo de app — não
   precisava ficar em aberto.
6. **[nota]** Pergunta 6 (precedência `_homebrew_suspect` vs. motor novo) já respondida pelo próprio comentário
   do tipo em `types.ts:78-84` — descarte nítido já retorna null cedo, ambíguo é o único caso que chega a
   `_homebrew_suspect`. Sem conflito real.
7. **[nota]** Pergunta 5 (over-engineering `ddal_*`) confirmada correta pela leitura do schema — campos são
   de importação de organizador específico (D&D Adventurers League), não campo de anúncio humano genérico.
   Doc já acertou a suposição, só não fechou a pergunta como resolvida.

Veredito do revisor: CORRIGIR (doc precisa de ajuste antes de virar plano de implementação).

Nenhum código alterado. Próximo passo: revisar `auto-preenchimento-draft.md` incorporando os 4 gaps reais
(Fase E de sync, escopo reduzido de Fase A pra campos sem banco, categorização de contato whats/form/discord/
fallback autor) e levar de volta ao mantenedor pra fechar escopo final antes de qualquer autorização de
código.

### Doc corrigido pós-revisão (2026-07-02)

`auto-preenchimento-draft.md` atualizado incorporando os 7 achados do revisor:
- Fase E reescrita: não é "garantir propagação", é edição obrigatória de `syncHelpers.ts` (`.set()` de
  update só mapeia campos fixos hoje — campo novo sem essa edição = perda silenciosa de dado).
- Fase A com escopo reduzido: `content_warnings`/`safety_tools`/`style_tags`/`setting_styles` SEM banco de
  referência, saem do motor de matching, viram extração de texto livre à parte.
- Fase F nova: categorização real de contato (whatsapp/form/discord distintos, hoje tudo não-Discord vira
  'form' genérico).
- Fase G nova: fallback de contato via `host_discord_id` quando não há link/whats/form — gap direto do pedido
  original do mantenedor ("o usuario do discord se tiver nada") que não estava coberto na 1ª versão do doc.
- Perguntas 3-6 fechadas com resposta objetiva (schema/AGENTS.md/código já respondiam).

Nenhum código alterado. Doc `specs/058-mesas-parser-learning-deepseek/auto-preenchimento-draft.md` pronto
pra revisão final do mantenedor antes de fechar escopo de implementação.

### Simulação real contra 3 JSONs reais fornecidos pelo mantenedor (2026-07-02)

Mantenedor forneceu `D:/teste_hoje.json`, `D:/teste_hoje2.json`, `D:/teste_hoje3.json` (exports reais
recém-extraídos, formato DiscordChatExporter, canal "🎲╺╸campanhas"), pedindo 2ª revisão com simulação real
antes de fechar plano.

- `teste_hoje2.json` (41KB) está TRUNCADO — JSON incompleto, corta no meio de um objeto (erro de parse
  confirmado, `SyntaxError` na posição 39836). Não é bug do parser — arquivo cortado na origem/extração.
  Registrar como observação pro mantenedor (re-extrair se precisar dos dados desse arquivo).
- `teste_hoje.json` e `teste_hoje3.json` (50 mensagens cada) válidos. Rodei simulação REAL: código atual
  (`chatExporterAdapter.adaptMessageToImportRaw` + `parseDiscordAnnouncement` + `classifyHomebrew`, sem
  alteração nenhuma) contra as 100 mensagens, com lista mock de 7 sistemas comuns (Pathfinder 2e/1e, D&D 5e,
  Vampiro, CoC, Tormenta20, Ordem Paranormal) no lugar do banco real.
- Resultado: `teste_hoje.json` → 45 drafts válidos (5 descartados por homebrew), **32/45 (71%) SEM
  system_id**. `teste_hoje3.json` → 46 drafts válidos (4 descartados), **30/46 (65%) SEM system_id**.
- **ACHADO NOVO, mais grave que o bug original relatado:** na maioria desses casos sem sistema, o
  `raw_system_hint` FOI extraído corretamente do label (`Sistema:`/`SISTEMA:` com `:`) — ex.: `"D&D5e(2014)"`,
  `"D&D 5ª Edição"`, `"Dungeons & Dragons 5e 2014"`, `"D&D 3.5, D20 System"`, `"3DeT Victory"`, `"3DeT Victory
  Super"`, `"Tormenta 20 + complementos"`. O bug original (label sem `:`, formato WordPress) é UM caso; a
  maioria real dos casos observados tem `:` presente e hint extraído — mas o MATCHING contra o banco de
  sistemas ainda falha, porque a variação de escrita de edição/versão/complemento é maior do que
  `stripVersionSuffix`/`findSystemMatch` cobrem hoje (ex.: sistema no banco provavelmente é "D&D 5ª Edição"
  ou "Dungeons & Dragons 5e", mas o texto varia livre: "D&D5e(2014)" sem espaço, "Dungeons & Dragons 5e 2014"
  sem parênteses, "D&D 3.5, D20 System" citando DOIS sistemas na mesma linha separados por vírgula).
- Isso muda a prioridade do plano: o gap de MATCHING TOLERANTE (edição/versão/variação de escrita/sistema
  duplo citado) é maior em volume real (~70% dos drafts sem banco real ainda por confirmar exato %) do que o
  gap de LAYOUT SEM DOIS-PONTOS (1 caso reportado originalmente). Como o teste usou banco MOCK (não o banco
  real de produção com todos os nomes/aliases cadastrados), o percentual real pode ser menor — sistemas reais
  do banco podem já ter aliases mais próximos do texto. Mas o padrão de variação de escrita é evidência
  real e não deve ser ignorado.
- Script de simulação (`_tmpSimulate.ts`, descartável, não commitado) removido após uso. JSONs copiados
  pro scratchpad da sessão de trabalho pra uso do agente revisor independente.
- Próximo passo: mandar 2º agente independente (sem ver o plano anterior tendencioso) simular/revisar contra
  os dados reais e o plano corrigido, focando em achar mais gaps de matching tolerante e variação real de
  escrita antes de fechar escopo de implementação.

### 2ª revisão independente com simulação própria (agente general-purpose, 2026-07-02)

Rodou simulação PRÓPRIA (sem ver o plano antes, script próprio, mesmos 2 JSONs válidos, 91 mensagens úteis)
+ revisou o plano depois. Achados:

**Confirmações (não são novidade, batem com o já registrado):**
- Variação de escrita em sistema quebra matching mesmo com hint extraído certo — confirmado com exemplos
  novos.
- Volume de campos ausentes do schema do draft (age_rating/vtt_platform/style_tags/communication_platform)
  é ALTO, não caso isolado: 44/91 citam classificação indicativa, 65/91 citam VTT, 78/91 citam estilo/tags,
  10/91 citam comunicação. Reforça prioridade da Fase B/C do plano.

**Gaps NOVOS não cobertos no plano:**

1. **[crítico]** `type` (campanha/one-shot/aberta) falha em 37/91 (41%) — e É O PAI de `frequency`.
   `deriveFrequency()` só infere quando `type === 'campanha'`. Posts que descrevem cadência sem usar a
   palavra "campanha" literal (ex.: "Constância: Quinzenalmente", "Quinzenal, Sextas, 20h") ficam com
   `type: null` E `frequency: null` — mesmo tendo "Quinzenal" escrito no texto. O plano tratava `frequency`
   como só "falta extração direta" (Fase C); na real o bloqueio raiz é `type` não ser inferido a partir de
   cadência. Correção: extração de cadência (quinzenal/semanal/mensal) deveria também poder setar
   `type: 'campanha'`, não só alimentar `frequency` isoladamente.
2. **[importante]** `contact_url` ausente em 64/91 (70%), `contact_discord` ausente em 27/91 (30%) — volume
   real bem maior que o esperado. Confirma que a Fase G do plano (fallback via `host_discord_id`) está bem
   priorizada — sem ela, 70% dos drafts ficam sem QUALQUER contato mesmo tendo autor conhecido.
3. **[nota]** Sistema citado 2x na mesma linha do label (ex. "D&D 3.5, D20 System") — plano cobre
   implicitamente via ranking de conflito→needs_review, mas não define regra explícita pra esse caso
   específico (mesma linha/mesmo label é sinal mais forte que conflito espalhado pelo texto; "D20 System" é
   meta-sistema genérico, não sistema jogável — pode não precisar de needs_review automático).
4. **[nota — técnico]** Interação `stripDecorativeMarkup` × `stripVersionSuffix`: limpeza de decoração
   remove pontuação de versão ANTES do matching de versão rodar (ex. "1.3" vira "1 3" após
   `stripDecorativeMarkup`, quebrando a regex de `stripVersionSuffix` que espera separador consistente).
   Achado técnico de implementação pra Fase A: normalização de versão precisa rodar antes da limpeza
   decorativa remover o separador, ou a regex de versão precisa tolerar espaço no lugar de ponto.

Ambos os agentes independentes convergem no mesmo veredito geral: plano cobre bem a estrutura (Fases A-G),
mas faltava (a) `type` como raiz de `frequency`, (b) volume real alto de contato ausente reforça prioridade
de Fase G, (c) detalhe técnico de ordem de normalização de versão. Nenhum achado dos dois agentes contradiz
o plano — só amplia/corrige.

Nenhum código alterado. Próximo passo: atualizar `auto-preenchimento-draft.md` incorporando Fase C
(frequência) corrigida para depender de extração de `type` por cadência, e registrar achado técnico de
ordem stripDecorativeMarkup/stripVersionSuffix como nota de implementação da Fase A.

### Correção de foco do mantenedor + 3ª revisão independente (2026-07-02)

Mantenedor corrigiu 2 pontos antes da 3ª rodada:
1. JSON truncado não é "arquivo perdido" — normalmente só o fim corta, resto é válido. Recuperado
   manualmente `D:/teste_hoje2.json` (39836 bytes, corte no fim de uma mensagem, não meio de objeto) cortando
   pro último `\n    }` completo de mensagem + fechando array/objeto → `D:/teste_hoje2.recovered.json` com 8
   mensagens válidas recuperadas (script Node ad-hoc, não versionado).
2. Preview de revisão: NÃO é "bruto"/JSON cru. É o `content` da mensagem (texto real do anúncio,
   decoração `▬▬▬` limpa mas informação preservada) mostrado formatado ao lado do form do draft — humano
   compara rápido "texto diz X, campo ficou vazio → bug ou precisa ensinar sistema".
3. Sistema é citado em quase todo anúncio real (experiência do mantenedor), mesmo quando autoral/não
   cadastrado — hint tem que sempre virar sugestão visível, nunca desaparecer silenciosamente.

Mandado 3º agente (`general-purpose`, sem ver o plano antes, simulação própria do zero) atacar esses 3
ângulos + rodar contra os 3 arquivos reais (`teste_hoje.json`, `teste_hoje3.json`,
`teste_hoje2.recovered.json`). Achados:

1. **[crítico — NOVO, categoria própria]** Import falha 100% em JSON truncado — `chatExporterImportService.ts:28`
   (`parseUploadedJsonBuffer`) e rota de import fazem `JSON.parse(rawJson)` bruto num try/catch que, ao
   falhar, retorna 400 imediato ("JSON inválido") pro arquivo INTEIRO. Zero mensagens importadas mesmo que
   49/50 estejam intactas. Confirma exatamente a suspeita do mantenedor: não existe parser tolerante a
   truncamento hoje. Schema Zod (`chatExporterAdapter.ts:14`, `discordChatExporterExportSchema.safeParse`)
   também derruba o arquivo inteiro. Gap de ROBUSTEZ DE INGESTÃO, categoria separada do parser de campo —
   não estava no plano de auto-preenchimento (que só cobre qualidade de extração, não resiliência de upload).
2. **[importante — confirma com números reais]** Hint de sistema aparece em quase toda mensagem real:
   41/50 (`teste_hoje.json`), 45/50 (`teste_hoje3.json`), 3/8 (`teste_hoje2.recovered.json`, dataset pequeno).
   Código JÁ preserva o hint explicitamente pra sugestão (`parseDiscordAnnouncement.ts:858-860`,
   `rawSystemHint` documentado "para criar system_suggestion automática e para o revisor ver") — não achou
   caminho de descarte silencioso. Já coberto no plano (Fase A); volume real é reforço, não novidade.
3. **[importante — NOVO, mas fácil]** Preview lado a lado é viável SEM migration nova — `content_raw` já é
   coluna real em `discord_import_messages`/`import_messages` (`db/types.ts:622,668`), nunca é perdido no
   parse. Frontend já busca `content_raw` em outros componentes (`MessagesView.tsx`, `discordSyncApi.ts`),
   mas `DraftEditorTab.tsx` (o editor do draft) NUNCA referencia `content_raw` — hoje só mostra campos
   estruturados, sem o texto original ao lado. Implementação: passar `content_raw` pro editor + reusar
   `stripSeparatorLines`/`stripDecorativeMarkup` (já existem, já fazem limpeza "legível sem esconder
   informação") pra formatar exibição. Gap novo genuíno, resposta prática: sim, dá pra fazer sem migration.

Limitação do agente: simulou com `systems=[]` (sem conectar banco real), então número de MATCH real
(`system_id` preenchido) não foi medido — só a extração do hint bruto, que era o que os ângulos pediam.

Nenhum código de produção alterado (script temporário do agente deletado, confirmado limpo). Próximo passo:
atualizar `auto-preenchimento-draft.md` com Fase H (robustez de import truncado — categoria própria) e Fase I
(preview lado a lado no editor, reusando content_raw + funções de limpeza já existentes).

### Visão estratégica de produto registrada (2026-07-02) — norte do mesas, não só da spec 058

Mantenedor pediu registro explícito e duradouro do objetivo final do módulo `mesas`, citando investimento
real (tokens, specs, custo de API DeepSeek pago propositalmente) — não é detalhe de implementação, é norte
estratégico que qualquer IA/chat futuro precisa entender antes de decidir arquitetura de importação/parser.

Resumo (íntegra em `apps/mesas/CONTEXT.md`, seção "Visão estratégica de produto"):
- Dois modos: humano posta manual (sempre existe, é o piso) + automação completa via fontes autorizadas tipo
  Discord (objetivo ideal, ASSÍNTOTA — aceito explicitamente que 100% talvez nunca chegue).
- Caminho do meio (onde o produto está e vai continuar por tempo indeterminado): parser extrai máximo →
  curadoria humana rápida/baixo atrito → correção vira aprendizado estruturado → precisão sobe a cada rodada.
- DeepSeek é agente de segunda linha deliberado (API paga pra isso, já configurada em `accounts`): entra
  onde parser falha, pode pesquisar na internet, organizar, aprender — não é feature pontual.
- Sistema desconhecido no banco NUNCA é motivo de descarte automático — pode ser sistema real não cadastrado,
  homebrew genuíno, ou nome gerado por IA que o autor do post nem sabe que é "não oficial". Parser não julga
  sozinho; sempre vira sugestão visível pro revisor decidir.

Confirmado pelo mantenedor por 2 rodadas de pergunta/resposta antes do registro (não foi assumido de
primeira — 1ª formulação minha foi validada como "isso, exatamente" + 1 correção fina sobre DeepSeek
pesquisar internet/organizar, não só decidir campo ambíguo).

Escrito em `apps/mesas/CONTEXT.md` (T1 do módulo, carregado por qualquer trabalho em `apps/mesas`) em vez de
só na spec 058, porque é norte do módulo inteiro — specs 052/058 e futuras de importação/curadoria devem
CITAR essa seção como motivação, não repetir a explicação.

Nenhum código alterado. Registro documental puro.

### Ajuste de princípio — não é lista de campos, é regra universal (2026-07-02)

Mantenedor corrigiu escopo mais uma vez, e é fundamento, não detalhe: **não é "sistema + alguns campos que
achamos"** — é regra universal: **TODO campo que existe no formulário humano de criação de mesa é candidato
a auto-preenchimento. Se a informação está no texto do anúncio, vai pro campo certo. Só cai em descrição
solta o que não tem campo estruturado correspondente.** Exemplo dado: se descrição cita "precisa de
microfone", isso tem campo próprio (`requires_microphone` em `TablesTable`) — não pode ficar só implícito no
texto da descrição, tem que setar o campo.

Motivação de produto (reforça a visão registrada em `apps/mesas/CONTEXT.md`): a automação existe pra
publicar mesa de quem NÃO teria publicado sozinho — facilita divulgação, cresce a base de mesas, atrai mais
gente ao site, cresce o hobby de RPG no Brasil. Site é gratuito, presente do mantenedor pra comunidade. Isso
eleva a régua: quanto mais completo o preenchimento automático, menos trabalho de curadoria humana, mais
fácil o "presente" funcionar de verdade.

Consequência prática: meu levantamento anterior (campo por campo, feito manualmente lendo `DraftEditorTab.tsx`
+ comparando com `TablesTable`) já pegou parte disso (VTT/comunicação/age_rating/tags/frequência) mas não é
sistemático — perdi campos como `cenario`/`scenario_id`, `requires_microphone`/`requires_camera`/
`requires_pc`, forma de recrutamento como categoria própria (não só contato). Próximo passo: levantamento
COMPLETO e sistemático de TODO campo do formulário humano de criação de mesa (`StepConfig.tsx`,
`StepFinal.tsx`, outros steps do fluxo de criação manual) contra `TablesTable` e o parser atual — não mais
achar campo por acaso, mapear os 100% antes de fechar escopo de implementação.

Nenhum código alterado.

### Levantamento sistemático completo dos campos do form manual (agente Explore, 2026-07-02)

49 campos mapeados nos 5 steps (`StepBasic`, `StepSystem`, `StepConfig`, `StepSessions`, `StepFinal`) —
substitui o levantamento parcial anterior (feito campo por campo, sem sistematicidade). Tabela completa
salva no resultado do agente (não versionada como arquivo — vai ser incorporada ao plano).

Achado novo: `content_warnings`, `safety_tools`, `city`, `state` existem em `TablesTable` mas NÃO têm UI em
NENHUM dos 5 steps do form manual — nem humano preenche isso hoje. Ficam fora de escopo do auto-preenchimento
até virarem campo real de produto (não faz sentido parser preencher campo que nem o form manual expõe).

Campos confirmados como candidatos reais a auto-preenchimento (têm UI manual, parser não cobre ou cobre
parcial): cenário (`selectedScenarioId`/`scenario_id`, banco `scenarios` — gap total, nunca cogitado antes),
plataforma VTT + comunicação (já mapeado), faixa etária (`age_rating`, já mapeado), nível de
experiência/complexidade (`experience_level`/`table_level` — gap novo), estilos de cenário (`settingStyles`),
requer PC/câmera/microfone (`requiresPc/Camera/Microphone` — exemplo literal citado pelo mantenedor), canal
de contato com todas as opções reais (`whatsapp/discord/phone/email/facebook/instagram/form` — confirma Fase
F do plano anterior, com opções exatas do enum real), sessão zero gratuita, duração de campanha, faixa de
nível (`levelRange`), estilo de jogo (`styleText`), resumo curto (`listingExcerpt`).

Fora de escopo confirmado (administrativo, não é campo de anúncio humano genérico): todo bloco DDAL (9
campos, D&D Adventurers League), `isCovilMesa` (admin only), `publisherRole`/`actualGmName` (quem publica —
não é informação do ANÚNCIO, é decisão de quem faz a importação).

Nenhum código alterado. Próximo passo: reescrever `auto-preenchimento-draft.md` com a lista definitiva de
campos-alvo baseada neste levantamento sistemático, substituindo a lista parcial anterior.

### Doc final atualizado com levantamento sistemático (2026-07-02)

`auto-preenchimento-draft.md` reescrito incorporando os 49 campos mapeados: nova seção "Levantamento
SISTEMÁTICO e definitivo", Fase B/C corrigidas (removido `content_warnings`/`safety_tools`/`city`/`state` —
sem UI em lugar nenhum; adicionado `scenario_id`/`experience_level`/`table_level`/
`requires_pc,camera,microphone`/`session_zero_free`), Fase F corrigida com enum real de canal de contato
confirmado (`whatsapp|discord|phone|email|facebook|instagram|form`, igual ao form manual).

Plano agora cobre Fases A-I + levantamento sistemático de 49 campos, com fora-de-escopo explícito e
justificado (DDAL/covil/publisher role = administrativo, não é dado do anúncio; content_warnings/safety_tools/
city/state = sem UI, não é campo de produto ainda).

Nenhum código alterado. Doc pronto para decisão final do mantenedor sobre início de implementação.

### Validação de fidelidade do CONTEXT.md contra a sessão real (2026-07-02)

Mantenedor pediu revisão final: "quero saber se está correto agora, e não vamos mais nos distanciar" —
tratado como rodada definitiva, não mais aproximação.

Adicionado ao `apps/mesas/CONTEXT.md` a parte que faltava: regra universal de campo (não só sistema, todo
campo do form manual é candidato — exemplo literal do microfone) e o "porquê" de negócio (site gratuito,
presente pra comunidade, publicar mesa de quem não teria publicado sozinho, crescer o hobby).

Mandado agente `general-purpose` independente (sem ver meu resumo, só lendo `CONTEXT.md` + sessão inteira do
zero) auditar fidelidade linha por linha. Achado único: eu tinha escrito "dezenas de horas de investimento"
quando o mantenedor disse literalmente "milhares de dólares em tokens" — métrica errada, inventada por mim.
Também tinha perdido a citação de fechamento "quero saber se está correto agora, e não vamos mais nos
distanciar", que marca a seção como definitiva/estável, não aproximação contínua. Resto do documento (dois
modos, caminho do meio, DeepSeek pesquisando internet, sistema desconhecido nunca descartado, regra universal
de campo, porquê de negócio) confirmado fiel, sem distorção/perda/invenção.

Corrigido `CONTEXT.md` linha 20-21: métrica trocada pra "milhares de dólares em tokens/specs" (correta) +
citação de fechamento adicionada.

`apps/mesas/CONTEXT.md` — Visão estratégica de produto: FECHADA, validada por 1 rodada de auditoria de
fidelidade independente. Norte estável pra qualquer IA/agente que trabalhar em `apps/mesas` daqui em diante.

### Reescrita do plano como executável por agente frio (2026-07-02)

Mantenedor pediu teste de execução real: "se um agente frio pegar o plano, ele consegue implementar?".
Diagnóstico: NÃO, doc anterior era histórico de investigação (9 fases A-I espalhadas, decisões corrigidas em
cima de decisões anteriores, "avaliar na implementação" pendurado, sem ordem de execução nem critério de
pronto).

Investigação adicional antes de reescrever (achado crítico não visto antes): tabela real do draft é
`discord_import_table_drafts` (`DiscordImportTableDraftsTable`, `db/types.ts:640`) — **NÃO tem colunas
soltas por campo**, o draft inteiro é serializado dentro de `parsed_payload`/`normalized_payload` (JSONB
genérico). `DiscordTableDraftTable` é o TIPO TypeScript desse payload, não schema de coluna. Consequência:
Fase B (campos novos) NÃO precisa de migration SQL — é só adicionar propriedade ao tipo TS. Isso DERRUBA a
trava de SDD Completo por migration que o doc anterior tinha fixado como obrigatória — corrigido: Fases
B/C/D/F/G/I são SDD Lite (apps/mesas isolado, sem migration real).

Reescrito `auto-preenchimento-draft.md` com seção nova no topo: "PLANO DE EXECUÇÃO" — 8 passos em ordem
(H→G→F→A→B/C→E→D→I), cada um com arquivo exato, contrato de mudança, e critério de pronto verificável.
Resolvidas ambiguidades que travariam agente frio: nome exato de tabela/tipo, decisão de `style_tags` vs
`setting_styles` como campos DISTINTOS (não sinônimos — confirmado em `db/types.ts:299-300`), ordem
determinística de implementação, critério de aceite geral no fim (não é 100% automação, é: todo campo
extraído+testado, zero perda draft→mesa, import tolerante a truncamento, preview funcionando, testes verdes,
zero auto-publicação sem revisão).

Histórico de investigação anterior mantido abaixo da seção nova, marcado como "consultar só se precisar
entender o porquê", não mais como lista de tarefas.

Nenhum código alterado. Próximo passo: validar com agente sem contexto desta sessão se o plano de execução é
suficiente pra implementar sem voltar com pergunta.

### Teste de execução por agente frio + fechamento da última ambiguidade (2026-07-02)

Mandado agente `general-purpose` SEM contexto desta sessão (só o doc + código real) avaliar as 8 fases do
plano de execução, uma por uma: "você teria informação suficiente pra codar AGORA, sem perguntar nada?".

Resultado: 7/8 fases PRONTAS PRA IMPLEMENTAR sem intervenção. Confirmou como corretas as descobertas desta
sessão (draft é JSONB, sem migration necessária; único branch de sync é update, sem insert separado — dúvida
que o próprio plano levantava, resolvida). Único bloqueio real: Fase B/C tinha ambiguidade não resolvida
sobre origem textual de `setting_styles` (o próprio doc já admitia "ainda a decidir").

Investigado e FECHADO com evidência de código real (não suposição):
- `style_tags` (`TablesTable`, `db/types.ts:300`) confirmado por grep: NÃO tem UI em lugar nenhum do form
  manual. Sai de escopo, junto com `content_warnings`/`safety_tools`/`city`/`state`.
- `setting_styles` (`db/types.ts:299`) TEM UI real: componente `SettingStylesField.tsx`, usado em
  `StepFinal.tsx:346-352`, sempre em PAR com `setting_name` (mesma seção "Cenário e Estilos", mesmas props).
  Corrigido plano: os dois entram JUNTOS na Fase B/C (antes `setting_name` estava errado na lista de "baixa
  prioridade fora de escopo" — contradição corrigida).

Plano de execução agora 8/8 fases sem ambiguidade bloqueante, validado por agente frio independente + achado
final fechado com evidência real de código (grep + leitura de componente).

Nenhum código de produção alterado. `auto-preenchimento-draft.md` está pronto pra implementação — próximo
passo é autorização nominal do mantenedor pra começar a codar.

## Implementação iniciada 2026-07-02 (autorizada pelo mantenedor)

Ordem seguida: H → G → F → A → B/C → E → D → I (plano `auto-preenchimento-draft.md`).

### Fase H — robustez de import truncado (CONCLUÍDA)
- `apps/mesas/backend/src/discord/chatExporterImportService.ts`: nova função `tryRecoverTruncatedJson`
  (corta buffer bruto pro último objeto de mensagem completo `\n    }` dentro de `messages`, fecha
  array+objeto raiz, tenta reparse). `parseUploadedJsonBuffer` agora tenta recovery antes de rejeitar com
  400; retorna `truncationWarning` quando recupera parcialmente.
- `apps/mesas/backend/src/routes/discord/import.ts`: `respondImportSuccess` ganhou parâmetro
  `truncationWarning`, propagado na resposta JSON (`data.warning`). Rota `/file` passa
  `parsed.truncationWarning`.
- Testes novos em `chatExporterImportService.test.ts` (+ fixture `truncatedTailJsonBuffer` em
  `fixtures/chatExporterSample.ts`, indentação real do DiscordChatExporter, 2 msgs completas + corte na 3ª):
  recupera 2 mensagens de buffer truncado; rejeita buffer sem nenhuma mensagem completa (fixture antiga
  `truncatedJsonString`, corte no meio do 1º objeto, minified); parseia buffer válido sem warning.
- Validação real: `pnpm --filter @artificio/mesas-backend test` — 42 suites, 373 testes, todos verdes
  (incluindo os 3 novos). `pnpm --filter @artificio/mesas-backend build` — limpo.
- Nota: `rtk vitest run <arquivo>` retornou `describe is not defined` (suite falha ao carregar) — bug/config
  do rtk com este monorepo, não do código. Usei `pnpm --filter @artificio/mesas-backend test` direto, que
  funcionou normalmente. Não investigado a fundo (rtk é ferramenta nova instalada pelo mantenedor nesta
  sessão) — registrar como nota, não bloqueou a Fase H.

Próximo: Fase G (fallback de contato via `host_discord_id` em `extractContacts`, `syncHelpers.ts`).

### Fases G + F — fallback de contato via host_discord_id + categorização real de canal (CONCLUÍDAS)
- `apps/mesas/backend/src/discord/syncHelpers.ts`:
  - `validateDraftForSync`: `host_discord_id` agora conta como sinal válido de contato (antes só
    `contact_url`/`contact_discord` — draft com só autor Discord ficava bloqueado de sincronizar mesmo
    depois do fallback da Fase G existir).
  - `extractContacts`: nova função `classifyContactChannel(rawUrl)` categoriza host de WhatsApp
    (`wa.me`/`api.whatsapp.com`/`chat.whatsapp.com`) → `'whatsapp'`, Discord → `'discord'`, resto →
    `'form'`; fallback de e-mail/telefone BR via regex quando `new URL()` falha (string não é URL válida).
    Fim de `extractContacts`: se `contacts.length === 0` e `host_discord_id` existe, adiciona contato
    `channel: 'discord'` com esse valor (Fase G, citação do mantenedor "o usuario do discord se tiver
    nada").
- Testes novos em `syncHelpers.test.ts` (fixtures `makeDraft`/`makeDraftTable` novas): fallback host_discord_id
  quando sem contact_url/contact_discord; não usa fallback quando já há contact_discord explícito; vazio
  quando não há nenhum sinal; WhatsApp→whatsapp; Discord→discord; outro link→form (mantém comportamento);
  validateDraftForSync não bloqueia com só host_discord_id; bloqueia sem nenhum sinal.
- Validação real: `pnpm --filter @artificio/mesas-backend test` — 42 suites, 381 testes verdes (20 em
  syncHelpers.test.ts, 8 novos). `pnpm --filter @artificio/mesas-backend build` — limpo.
- Nota: Instagram/Facebook NÃO implementados (regra do plano: só adicionar detecção com evidência real de
  uso na amostra — não verificado ainda, mantido fora por ora).

Próximo: Fase A (motor de matching full-text sistema+VTT+comunicação, `parseDiscordAnnouncement.ts`).

### Fase A (parcial) — fix de raiz do bug original DEB-058-04 (CONCLUÍDO E VALIDADO)
- `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts`, função `extractLabelValue`: agora aceita
  formato "label sozinho na linha, valor na linha seguinte" (sem ':'), além do formato `Label: valor` já
  suportado. Ativa só quando a linha INTEIRA normaliza pra um label conhecido (`normalizeLabelKey`) — não
  quebra texto livre nem introduz falso-positivo (guard confirmado pelos 382 testes verdes, zero regressão).
  `splitLabelLine` continua exigindo ':' (não mudou) — o fallback é tratado no nível de `extractLabelValue`.
- Teste novo em `parseDiscordAnnouncement.test.ts`: reproduz o caso real "Ruins of Gauntlight" (texto
  original do draft `5c1c8755-9328-4adf-a941-39a2a3bc244e` que abriu a investigação) — "Sistema\nPathfinder
  2e\n..." sem ':'. Confirma `system_id` resolvido corretamente contra banco de sistemas.
- Validação real: `pnpm --filter @artificio/mesas-backend test` — 42 suites, 382 testes verdes (381→382,
  1 novo). `pnpm --filter @artificio/mesas-backend build` — limpo. Zero regressão nos 95 testes existentes
  do parser.
- **Bug original que abriu a spec 058/DEB-058-04 está corrigido e provado.** Resto da Fase A (motor
  genérico full-text reaproveitável pra VTT/comunicação, ranking multi-candidato robusto, correção de ordem
  `stripVersionSuffix`/`stripDecorativeMarkup`) segue como trabalho adicional — maior escopo, não bloqueia
  mais o caso que disparou a investigação original.

Checkpoint: H, G, F e o fix de raiz da Fase A prontos e testados (382 testes verdes, build limpo, zero
regressão). Resto do plano (motor full-text genérico completo, Fases B/C/D/E/I) segue pendente.

### Fase A (completa) + B + C — motor genérico + campos novos no draft (CONCLUÍDAS)
- `parseDiscordAnnouncement.ts`: `findSystemMatch` generalizado em `findEntryMatch<T>` genérico (nome+aliases,
  ranking por origem/prioridade/exatidão) + wrapper `findSystemMatch` (compat) + `findPlatformMatch` novo
  (VTT/comunicação, sem edição/versão). Novo tipo `MatchEntry` (id+name+aliases) exportado.
  `parseDiscordAnnouncement` ganhou 4º parâmetro opcional `platforms?: { vtt?, communication? }`.
- `types.ts` (`DiscordTableDraftTable`): campos novos — `scenario_id`, `raw_scenario_hint`,
  `vtt_platform_id`, `communication_platform_id`, `age_rating`, `setting_name`, `setting_styles`,
  `experience_level`, `table_level`, `requires_pc`, `requires_camera`, `requires_microphone`,
  `session_zero_free`. Novos enums `TableDraftAgeRating`/`TableDraftExperienceLevel`/`TableDraftTableLevel`
  (espelham `TablesTable` do db/types.ts).
- `parseDiscordAnnouncement.ts`, extração nova: `extractExplicitFrequency` (cadência explícita
  semanal/quinzenal/mensal/avulsa, prioridade sobre `deriveFrequency`, também infere `type: 'campanha'`
  quando cadência citada e type ausente — resolve achado dos 41% de `type` faltante da simulação real);
  `extractAgeRating` (regex livre, aceita "+18" e "18+"); `splitFreeTextList` (normaliza lista separada por
  `/`,`,`,"e","ou" — usado em `setting_styles`); `requires_pc/camera/microphone` (regex de menção explícita);
  `session_zero_free` (regex de menção explícita); `vtt_platform_id`/`communication_platform_id` via
  `findPlatformMatch` sobre label "Plataformas"/"Local do Jogo" ou fullText.
- `shared.ts`: `loadVttPlatformsForParser`/`loadCommunicationPlatformsForParser` novos (mesmo padrão de
  `loadSystemsForParser`, carregam `vtt_platforms`/`communication_platforms` ativos do banco).
- `routes/discord/utils.ts` (`parseDiscordMessage`, ponto central usado por fetch/parse-batch/reparse):
  carrega e injeta `platforms` no parser. Outros 3 call sites diretos (`inbox/import.ts`, `inbox/drafts.ts`)
  NÃO foram conectados nesta rodada — escopo mínimo, parâmetro é opcional e não quebra nada, mas VTT/
  comunicação só funcionam hoje no fluxo principal de import Discord real, não no import de texto colado
  manual. Registrar como próximo passo se o mantenedor quiser cobertura completa.
- Testes novos em `parseDiscordAnnouncement.test.ts`: extração de VTT+comunicação+age_rating+setting_styles
  no exemplo real "Ruins of Gauntlight" completo; cadência explícita "Quinzenalmente" infere type=campanha
  (bug dos 41% da simulação real). Fixtures de 3 arquivos de teste (`aiAutomation.test.ts`,
  `llmContextPack.test.ts`, `syncHelpers.test.ts`) atualizadas com os 13 campos novos do tipo. Mock de
  `discord/shared` em `utils.test.ts` ganhou os 2 loaders novos.
- Validação real: `pnpm --filter @artificio/mesas-backend test` — 42 suites, 384 testes verdes.
  `pnpm --filter @artificio/mesas-backend build` — limpo. `pnpm run lint` (repo-wide) — 15/15 tasks
  verdes, zero erro.

Checkpoint: Fases H, G, F, A (completa) e B/C prontas e testadas (384 testes verdes, build+lint limpos,
zero regressão). Faltam: D (UI editor draft + select com busca), E (sync draft→mesa dos campos novos —
CRÍTICO, sem isso os campos da Fase B/C são perdidos silenciosamente ao confirmar draft), I (preview lado
a lado com content_raw).

### Fase E — sincronização draft → mesa publicada (CONCLUÍDA, crítica)
- `apps/mesas/backend/src/discord/syncHelpers.ts`:
  - `buildTableData` (branch de CRIAÇÃO de mesa nova): adicionados os 13 campos novos —
    `scenario_id`, `age_rating`, `vtt_platform_id`, `communication_platform_id`, `experience_level`
    (agora usa `t.experience_level ?? 'todos'` em vez de hardcode `'todos'`), `table_level`,
    `setting_name`, `setting_styles`, `requires_pc/camera/microphone`, `session_zero_free`.
  - Branch de UPDATE (dentro de `syncDraftToTable`, `.updateTable('tables').set({...})`): mesmos 13
    campos adicionados — antes desaparecia tudo silenciosamente ao sincronizar um draft de mesa JÁ
    existente (source_id repetido).
  - Confirmado: só existem esses 2 pontos de escrita em `tables` (`buildTableData` p/ criação,
    `.set()` p/ update) — ambos agora cobertos, sem terceiro ponto oculto.
- Testes novos em `syncHelpers.test.ts`: `buildTableData` propaga todos os 13 campos novos quando
  preenchidos no draft; usa defaults seguros (`false`/`null`/`'todos'`) quando não preenchidos — confirma
  que o insert nunca quebra por campo ausente.
- Validação real: `pnpm --filter @artificio/mesas-backend test` — 42 suites, 386 testes verdes (384→386).
  `pnpm --filter @artificio/mesas-backend build` — limpo. `pnpm run lint` (repo-wide) — 15/15 verde.

Checkpoint: Fases H, G, F, A, B/C, E completas e testadas (386 testes verdes, build+lint limpos, zero
regressão). Bug de perda silenciosa de dado (draft→mesa) está fechado — todo campo novo da Fase B/C agora
chega na mesa publicada nos dois caminhos (criação e update).

Faltam: D (UI do editor de draft — inputs pros campos novos + select de sistema com busca) e I (preview
lado a lado com content_raw no editor). Ambas são mudança de frontend (`DraftEditorTab.tsx`).

### Fase D — UI do editor de draft (CONCLUÍDA, verificação visual parcial)
- `apps/mesas/frontend/src/features/discord-sync/draftFormUtils.ts`: `DraftForm` ganhou os 13 campos
  novos como strings/booleans editáveis (`age_rating`, `experience_level`, `table_level`, `setting_name`,
  `setting_styles` — join/split por vírgula, `requires_pc/camera/microphone`, `session_zero_free`).
  `buildForm`/`buildUpdatedPayload` atualizados nos dois sentidos (payload→form, form→payload). Campos SEM
  UI ainda (`scenario_id`, `vtt_platform_id`, `communication_platform_id` — são FK, exigem select próprio
  ainda não construído) continuam preservados no payload via `...baseTable` spread — não são perdidos, só
  não editáveis nesta rodada.
- Novo componente `SystemSearchSelect.tsx`: combobox leve com busca (input+dropdown filtrado por
  nome/nome_pt/alias, mostra até 30 resultados), substitui o `<select>` nativo de sistema no editor.
  **Decisão de design:** não reusei `SystemTreeSelector.tsx` (candidato original do plano) — é um
  componente de 3 colunas pensado pro form completo de criação de mesa (base/edição/variante lado a lado),
  desproporcional pro editor compacto de draft. `SystemSearchSelect` é mais simples e cabe no layout atual.
- `DraftEditorTab.tsx`: adicionados inputs pros 10 campos editáveis novos (classificação indicativa,
  nível de experiência, complexidade da mesa, cenário/ambientação, estilos, 4 checkboxes de requisito
  técnico) + troca do select de sistema.
- Testes: fixtures de `draftFormUtils.test.ts` atualizadas com os campos novos (2 literais de `DraftForm`
  corrigidos). `pnpm --filter @artificio/mesas-frontend test` — 14 suites, 149 testes verdes.
  `pnpm --filter @artificio/mesas-frontend build` — limpo.
- **Gap de verificação:** NÃO foi possível validar visualmente no browser real (login/SSO + dados reais de
  draft necessários; preview estático configurado em `.claude/launch.json` não conecta a backend/auth).
  Validação ficou restrita a: build TS limpo + suite de testes de componente (`DraftEditorTab.test.tsx`,
  que renderiza o form e passa) — prova que monta sem erro de runtime, mas não prova UX/layout real em
  produção. Recomendo checagem manual do mantenedor no ambiente real antes de considerar Fase D 100%
  fechada do ponto de vista de produto (funcionalmente está completa e testada).

Checkpoint: Fases H, G, F, A, B/C, E, D completas (build+lint+test limpos, 149+386 testes verdes
combinados). Falta só Fase I (preview lado a lado com content_raw no editor).

### Fase I — preview lado a lado com content_raw (CONCLUÍDA — plano 8/8 fases implementadas)
- Backend, `routes/discord/drafts.ts` (GET /:id): agora busca `content_raw` de
  `discord_import_messages` via `draft.discord_message_id` (achado: essa coluna no draft é o UUID da
  linha da mensagem, não o Discord snowflake — confirmado lendo `syncHelpers.ts` que já fazia esse join
  pro sync), aplica `stripSeparatorLines` (função REAL já existente em `parseDiscordAnnouncement.ts`,
  reusada como o plano pedia) e devolve como `content_raw` no payload do draft.
- Backend, `routes/inbox/drafts.ts` (GET /:id, fluxo separado de import de texto colado): já tinha
  `raw_text` via join com `import_messages`; unifiquei contrato adicionando `content_raw` (mesmo texto,
  também limpo com `stripSeparatorLines`) — assim o frontend não precisa saber a origem do draft
  (Discord real vs. texto colado manual).
- Frontend, `types.ts`: `DiscordDraft` ganhou `content_raw?: string | null`.
- Frontend, `DraftEditorTab.tsx`: layout mudou de single-column pra grid 2 colunas (form à esquerda,
  painel de texto original sticky à direita, `lg:` breakpoint — colapsa pra empilhado em telas menores).
  Painel novo mostra `contentRaw` formatado em `<pre>` com scroll próprio (max-h-[70vh]), preserva quebras
  de linha, mostra "Sem texto original disponível" quando null.
- `DiscordDraftPreview.tsx`: passa `draft.content_raw` pro editor.
- Validação real: `pnpm --filter @artificio/mesas-backend test` — 386 testes verdes.
  `pnpm --filter @artificio/mesas-frontend test` — 149 testes verdes. Build backend+frontend limpos.
  `pnpm run lint` (repo-wide) — 15/15 verde.
- **Mesmo gap de verificação visual da Fase D**: não validado em browser real com sessão/dados reais —
  só build TS + testes de componente existentes (que continuam passando, provam que não quebrou nada,
  mas não substituem checagem visual humana do layout/UX novo).

## STATUS FINAL: Plano de execução 8/8 fases implementadas (H, G, F, A, B/C, E, D, I)

Todas as fases do `auto-preenchimento-draft.md` foram codificadas, testadas (build+lint+test limpos em
backend e frontend, ~535 testes verdes combinados, zero regressão) e registradas nesta sessão com
detalhamento arquivo-a-arquivo. Bug original (DEB-058-04, sistema "Pathfinder 2e" não detectado em
formato label-newline-valor) está corrigido e coberto por teste que reproduz o caso real.

Pendências conhecidas, não bloqueantes:
1. Verificação visual manual das Fases D e I no ambiente real (login/SSO) — recomendado antes do mantenedor
   considerar o trabalho 100% fechado do ponto de vista de produto/UX.
2. `scenario_id`/`vtt_platform_id`/`communication_platform_id` extraídos e sincronizados, mas SEM UI de
   edição no editor (preservados no payload, não editáveis manualmente ainda) — precisariam de select
   próprio com busca (mesmo padrão do `SystemSearchSelect` novo), fora de escopo desta rodada.
3. `inbox/import.ts` e `inbox/drafts.ts` (import de texto colado manual) NÃO recebem `platforms` (VTT/
   comunicação) no parser — só o fluxo principal de Discord real (`routes/discord/utils.ts`) tem essa
   integração. Extensão de escopo se o mantenedor quiser paridade completa.
4. `pnpm run test`/`pnpm run build` repo-wide completo (não filtrado por pacote) não foi rodado nesta
   sessão — só os pacotes tocados (`mesas-backend`, `mesas-frontend`) foram validados individualmente,
   conforme regra de `AGENTS.md` (testes pesados evitados localmente, CI cobre o repo completo).

Nenhum commit/push/PR feito — aguarda autorização nominal do mantenedor.

### Pendência 2 (registrada no fechamento anterior) — UI de edição pra scenario_id/vtt_platform_id/communication_platform_id (CONCLUÍDA)

Mantenedor pediu implementação completa "tanto pro parse quanto pra proposta do site". Confirmado: form
MANUAL de criação de mesa (`StepConfig.tsx`) JÁ tinha esses 3 campos (select próprio, fluxo humano não
afetado por esta pendência). O que faltava era só o lado do EDITOR DE DRAFT (revisão de import Discord).

- **Backend:** nenhum endpoint novo necessário — `GET /api/v1/scenarios`, `GET /api/v1/vtt-platforms`,
  `GET /api/v1/communication-platforms` já existiam (rotas públicas, usadas pelo form manual). Só precisava
  ser consumido pelo editor de draft também.
- Frontend, `draftFormUtils.ts`: novo tipo `SimpleCatalogEntry` (id+name) + schema Zod +
  `loadScenarios`/`loadVttPlatforms`/`loadCommunicationPlatforms` (mesmo padrão de `loadSystems`).
  `DraftForm` ganhou `scenario_id`/`vtt_platform_id`/`communication_platform_id`. `buildForm`/
  `buildUpdatedPayload` atualizados nos dois sentidos.
- Novo componente `CatalogSearchSelect.tsx`: combobox genérico com busca (mesmo padrão de
  `SystemSearchSelect`, mas sem nome_pt/aliases — só id+name), reusado pelos 3 campos novos. Inclui opção
  "Limpar seleção" (esses 3 campos são opcionais, diferente de sistema que é obrigatório).
- `useDraftForm.ts`: 3 `useEffect` novos carregando os catálogos (mesmo padrão do carregamento de
  sistemas), expostos no hook (`scenarios`/`scenariosLoading`/`vttPlatforms`/`vttPlatformsLoading`/
  `communicationPlatforms`/`communicationPlatformsLoading`).
- `DraftEditorTab.tsx`: 3 selects novos (Cenário via catálogo, Plataforma VTT, Plataforma de comunicação)
  — campo "Cenário/Ambientação" de texto livre (`setting_name`) renomeado pra deixar claro que é distinto
  do cenário via catálogo (`scenario_id`).
- `DiscordDraftPreview.tsx`/testes: props propagadas, fixtures de `DraftEditorTab.test.tsx` e
  `draftFormUtils.test.ts` atualizadas com os 3 campos novos.
- Validação real: `pnpm --filter @artificio/mesas-frontend test` — 149 testes verdes.
  `pnpm --filter @artificio/mesas-frontend build` — limpo. `pnpm --filter @artificio/mesas-backend test`
  — 386 testes verdes (sem alteração de backend nesta rodada, confirmado sem regressão).
  `pnpm run lint` (repo-wide) — 15/15 verde.

**Status atual:** os 3 campos agora têm cobertura completa nos dois lados — extraídos pelo parser (Fase
A/C), sincronizados pra mesa publicada (Fase E), editáveis no draft (esta pendência) e editáveis no form
manual de criação (já existia). Nenhum gap de campo remanescente identificado nesta spec.
