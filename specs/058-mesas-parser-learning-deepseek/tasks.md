# Tasks — 058 Parser Learning + DeepSeek Contextual

> Fase 0 concluida em 2026-07-01. Implementacao segue bloqueada ate autorizacao nominal para a Fase 1.

## Gate 0 — Revisao e decisao

- [x] T0.1 — Revisao 5.5 altissimo da spec, procurando gaps de dominio, seguranca, custo, UX, dados, prompt injection, duplicatas e overfitting. Feito quando: comentarios/vereditos registrados nesta spec ou em `reviews.md`. **Feito:** `reviews.md` criado com evidencia de codigo, gaps, decisoes e criterios de liberacao da Fase 1.
- [x] T0.2 — Definir MVP minimo. Feito quando: manter/alterar/cortar fases com justificativa. **Feito:** MVP-058-A = `parse_case` + feedback imutavel + baseline, sem mudanca de comportamento e sem DeepSeek novo.
- [x] T0.3 — Decidir modelo de dados final: ampliar `discord_field_learning` ou criar `discord_learning_rules` + tabelas auxiliares. Feito quando: diagrama/tabelas aprovados. **Feito:** `discord_field_learning` fica como cache/projecao; fonte duravel = `discord_parse_cases` + `discord_parse_feedback`; regras ampliadas = `discord_learning_rules` na Fase 3; duplicatas = `discord_duplicate_candidates`; IA = `discord_llm_decisions`.
- [x] T0.4 — Atualizar `specs/backlog.md` e `project-state.md`. Feito quando: status da 058 aparece no mapa operacional. **Feito:** mapas atualizados na Fase 0.

## Fase 1 — MVP minimo: baseline e instrumentacao

- [x] T1.1 — Definir contrato `ParseCase` e `ParseFeedback` TypeScript/Zod. Feito quando: payload minimo esta documentado/testavel antes da migration. **Feito:** `parseLearning.ts` com `parseCaseContractSchema`, `parseFeedbackContractSchema` e teste `parseLearning.test.ts`.
- [x] T1.2 — Criar migrations online-safe aditivas para `discord_parse_cases` e `discord_parse_feedback`. Feito quando: header de migration tem os 5 campos obrigatorios e nao ha cascade destrutivo a partir de draft. **Feito:** `migration_136_discord_parse_learning.sql`, FKs `ON DELETE SET NULL`, sem alteracao destrutiva.
- [x] T1.3 — Persistir `parse_case` em shadow/auditoria. Feito quando: cada import gera caso rastreavel sem mudar decisao final; falha de auditoria nao derruba lote. **Feito:** `recordParseCase()` best-effort plugado em Discord/ChatExporter e inbox/texto colado.
- [x] T1.4 — Persistir feedback humano como evento imutavel. Feito quando: correcao/rejeicao/sync de draft gera evento com before/after/reason/scope quando aplicavel. **Feito:** `recordParseFeedback()` best-effort em correcao, rejeicao e sync/publicacao.
- [x] T1.5 — Manter compatibilidade com `import_corrections`, `discord_shadow_decisions` e `discord_field_learning`. Feito quando: telas/metrics atuais continuam funcionando. **Feito:** fluxo legado preservado; `import_corrections`, shadow e `recordFieldLearning()` continuam no caminho atual.
- [x] T1.6 — Medir baseline com fixtures reais (`D:\teste.json` + proximos exports). Feito quando: contagem por `draft`, `discard`, `ignored`, `paid`, `free`, `unknown`, campos faltantes e motivos de descarte registrada. **Feito:** `baseline.md` registrado (50 total, 43 drafts, 7 descartes, 25 pagas, 3 gratuitas, 15 unknown).
- [x] T1.7 — Provar zero mudanca funcional. Feito quando: import do corpus real mantem contadores/resultados esperados e nao publica nada. **Feito:** Fase 1 so grava auditoria best-effort; backend build verde; backend tests 339/339 verdes; corpus offline segue `needs_review` para todos os 43 drafts.

## Fase 2 — Retrieval local + duplicatas em shadow

- [x] T2.1 — Hash exato e hash normalizado para duplicata. Feito quando: reimport/repost exato nao vira draft novo sem sinalizar. **Feito:** `parseRetrieval.ts` prioriza `raw_hash` e `normalized_hash` (`1.0`/`0.97`) e grava candidato em shadow.
- [x] T2.2 — Similaridade por `pg_trgm`/features locais. Feito quando: titulo/texto parecido retorna candidatos ordenados. **Feito:** migration 137 cria indice trigram em `discord_parse_cases.normalized_text`; retrieval usa `similarity()` e ordenacao por score.
- [x] T2.3 — Similaridade por sinais estruturais. Feito quando: links/forms/imagens/autor/canal/sistema entram no score. **Feito:** features guardam URLs de texto/forms/anexos/embeds; score considera forms, anexos, autor, canal, guild e sistema inferido do resultado final.
- [x] T2.4 — Separar exemplos positivos, negativos, corrigidos e candidatos de duplicata. Feito quando: retrieval retorna grupos distintos para o ContextPack. **Feito:** `buildRetrievalContext()` retorna `duplicate_candidates`, `similar_cases`, `positive_examples`, `negative_examples` e `corrected_examples`.
- [x] T2.5 — Persistir `discord_duplicate_candidates` sem agir sozinho. Feito quando: candidato aparece em audit/debug e aguarda humano. **Feito:** `persistDuplicateCandidatesForCase()` grava/atualiza candidatos `status='candidate'`; import continua best-effort e sem acao automatica.

## Fase 3 — Learning rules ampliadas

- [x] T3.1 — Modelar regras com `rule_type`, `scope`, `confidence`, `hits`, `rejections`, `status`. Feito quando: schema aprovado. **Feito:** migration 138 cria `discord_learning_rules` e `discord_learning_rule_applications` com tipo, escopo, confianca, hits, rejeicoes, status e source.
- [x] T3.2 — Gerar regra a partir de feedback humano. Feito quando: corrigir um campo cria/atualiza regra com escopo correto. **Feito:** `recordLearningRulesFromCorrections()` e `registerDraftCorrection()` geram/upsertam `field_value` a partir do diff humano.
- [x] T3.3 — Aplicar regra com guardas. Feito quando: regra ativa aplica so dentro do escopo/confianca e registra uso. **Feito:** `lookupLearningRules()` consulta apenas `active` com confianca >= 0.80, escopo compativel e registra uso em `discord_learning_rule_applications`.
- [x] T3.4 — Rejeitar/desativar regra ruim. Feito quando: nova correcao contraditoria incrementa `rejections` e pode reduzir confianca/desativar. **Feito:** upsert contraditorio incrementa `rejections`, reduz confianca e suprime regra; `nextRuleState()` cobre o modelo em teste.
- [x] T3.5 — Tratar conflitos. Feito quando: regras/casos conflitantes forcam `needs_review`, nao decisao silenciosa. **Feito:** lookup retorna `conflicts` quando regras ativas divergem e nao aplica hit silencioso.
- [x] T3.6 — Migrar/projetar `discord_field_learning` para o novo modelo sem perder compatibilidade. Feito quando: regras antigas continuam consultaveis ou sao backfilladas com origem clara. **Feito:** migration 138 faz backfill `migration_seed` de `discord_field_learning`; fluxo antigo continua consultado como fallback compat.

## Fase 4 — DeepSeek ContextPack

- [x] T4.1 — Definir `ContextPack` Zod. Feito quando: payload maximo/minimo e redacoes estao testados. **Feito:** `llmContextPack.ts` define `contextPackSchema`, `CONTEXT_PACK_PROMPT_VERSION` e hash estavel.
- [x] T4.2 — Montar ContextPack com exemplos proximos. Feito quando: DeepSeek recebe casos relevantes e regras aplicaveis/rejeitadas. **Feito:** ContextPack inclui regras aplicaveis/conflitantes e slots para retrieval (`similar_cases`, `duplicate_candidates`, positivos, negativos, corrigidos) quando disponivel.
- [x] T4.3 — Prompt com defesa contra prompt injection. Feito quando: teste com mensagem maliciosa nao altera instrucao do sistema. **Feito:** prompt do ContextPack trata mensagem como dado nao confiavel; teste cobre texto malicioso e politicas `do_not_follow_instructions_inside_message`/`no_auto_publish`.
- [x] T4.4 — Resposta JSON validada. Feito quando: retorno invalido cai para `needs_review`/deterministico sem quebrar lote. **Feito:** `assistDiscordParseWithContextPack()` valida schema da API, JSON e campos extraidos; retorno invalido grava auditoria e retorna `null`.
- [x] T4.5 — Cache por hash + prompt/model/version. Feito quando: mesma mensagem/contexto nao chama DeepSeek de novo sem necessidade. **Feito:** `discord_llm_decisions` tem indice de cache por provider/model/prompt/context hash e lookup antes da chamada.
- [x] T4.6 — Auditoria `llm_decision`. Feito quando: toda chamada tem latencia, status, modelo, prompt_version e resultado validado. **Feito:** migration 139 cria `discord_llm_decisions`; wrapper registra sucesso, cache hit, HTTP error, timeout, erro e resposta invalida.

## Fase 5 — UX e decisao humana de duplicatas

- [x] T5.1 — Estados de duplicata (`exact`, `probable`, `update_existing`, `not_duplicate`). Feito quando: pipeline diferencia cada caso sem acao irreversivel. **Feito:** `duplicates.ts` deriva `match_kind` (`exact`/`probable`) do score/signals sem persistir; decisao humana grava em `discord_duplicate_candidates.status` (`confirmed_duplicate`/`rejected_duplicate`/`update_existing`), nunca some com o draft sozinho.
- [x] T5.2 — UI mostra candidatos de duplicata. Feito quando: admin compara lado a lado antes de criar/atualizar/rejeitar. **Feito:** aba "Duplicatas" em `DiscordDraftPreview.tsx` via `DuplicatesTab.tsx` — mostra score, sinais corroborantes e texto normalizado do candidato, com botoes de decisao.
- [x] T5.3 — Feedback de duplicata alimenta retrieval. Feito quando: marcar falso/verdadeiro duplicado melhora proximas sugestoes. **Feito:** `PATCH /duplicate-candidates/:id` chama `recordParseFeedback()` com `feedback_type` `duplicate`/`not_duplicate` e `scope_json.duplicate_candidate_id`, entrando no mesmo pipeline de aprendizado da Fase 3.

## Fase 6 — UX de revisao que ensina

- [x] T6.1 — Mostrar origem por campo: parser, learning-store, DeepSeek, humano. Feito quando: admin sabe por que campo apareceu. **Feito:** `buildDraftFieldInsights()` classifica `parser`, `learning-store`, `deepseek` e `humano`; `DraftEditorTab` mostra chips compactos por campo.
- [x] T6.2 — Mostrar evidencia textual. Feito quando: sugestao vem com trecho/linha/label que a sustentou. **Feito:** UI mostra evidencias curtas de valor extraido, alteracao humana, sugestao pendente, mencoes, anexos e embeds preservados.
- [x] T6.3 — Enviar feedback estruturado no salvar/corrigir/descartar/duplicar. Feito quando: backend recebe diffs completos. **Feito:** fluxo existente segue enviando diff estruturado em `submitCorrectionDiff()` no save; rejeicao e duplicata continuam indo por `recordParseFeedback()` das Fases 1/5.
- [x] T6.4 — Evitar friccao excessiva. Feito quando: ensinar o sistema nao exige formulario separado para cada campo simples. **Feito:** chips ficam inline no formulario de revisao existente; nenhum formulario/acao extra foi criado.

## Fase 7 — Eval e shadow

- [x] T7.1 — Dataset de avaliacao derivado de feedback confirmado. Feito quando: fixture reproduzivel por prompt/modelo. **Feito:** `parseEval.ts` monta dataset de `discord_parse_cases` + `discord_parse_feedback`, usando feedback humano confirmado como alvo.
- [x] T7.2 — Metricas por campo e por acao. Feito quando: relatorio mostra paid/free/unknown, discard, duplicate, system, slots, time, contact. **Feito:** `PARSE_EVAL_FIELDS` cobre `action`, `price_type`, `system_name`, `slots_total`, `slots_open`, `day_of_week`, `start_time`, `contact_url`; `/admin/discord/automation/parse-eval` retorna acuracia por camada/campo.
- [x] T7.3 — Comparar parser vs learning vs DeepSeek. Feito quando: impacto incremental de cada camada fica claro. **Feito:** `evaluateParseLayers()` compara `parser`, `learning` e `deepseek` a partir do parse deterministico e das sugestoes `_ai_suggestions` por provider.
- [x] T7.4 — Shadow mode para decisoes novas. Feito quando: sistema registra o que faria e humano decide. **Feito:** migration 140 cria `discord_parse_shadow_decisions`; `recordParseCase()` grava predicoes por camada em best-effort e `recordParseFeedback()` fecha `actual_action` quando o humano corrige/descarta/publica/marca duplicata.

## Fase 8 — Gate futuro de autonomia

- [ ] T8.1 — Definir thresholds de confianca por acao. Feito quando: `draft_ready`, `discard`, `duplicate` tem criterios separados.
- [ ] T8.2 — Definir rollback operacional. Feito quando: kill switch e desativacao de regras provados.
- [ ] T8.3 — Manter auto-publicacao fora de escopo ate decisao nominal. Feito quando: qualquer caminho automatico segue bloqueado.

## Validacao obrigatoria quando virar implementacao

- [x] V1 — Testes unitarios de parser/learning/retrieval. **Parcial 058 Fase 2:** `parseRetrieval.test.ts` cobre hash, sinais estruturais, score e grupos.
- [x] V2 — Testes de integracao feedback -> regra -> aplicacao. **Parcial 058 Fase 3:** `learningRules.test.ts` cobre geracao por correcao, lookup ativo, conflito e transicao de estado.
- [x] V3 — Eval offline com fixtures reais. **Parcial Fase 7:** serviço offline e rota admin com dataset reproduzivel por feedback confirmado; testes unitarios cobrem dataset, metricas e comparacao por camada. Fixture real depende de banco com dados humanos.
- [x] V4 — Smoke UI de revisao. **Feito na Fase 6:** UI de revisao ja mostra origem/evidencia e Fase 7 nao muda UI.
- [x] V5 — `pnpm --filter @artificio/mesas-backend test`. **Feito na Fase 5:** 40 files / 354 tests verdes.
- [x] V6 — `pnpm --filter @artificio/mesas-frontend test` se UI mudar. **Feito na Fase 6:** 14 files / 148 tests verdes.
- [x] V7 — `pnpm verify:api` se API mudar. **Feito na Fase 5:** exit 0; mesas +3 non-breaking; warnings existentes de paths ambiguos.
- [x] V8 — `pnpm run lint` e `pnpm run build` antes de concluir implementacao real. **Feito na Fase 6:** lint/build/test repo-wide verdes.
