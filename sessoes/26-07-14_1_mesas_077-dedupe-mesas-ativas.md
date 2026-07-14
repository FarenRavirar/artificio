# Sessão 26-07-14 — Spec 077: dedupe de mesas ativas

- Data: 2026-07-14
- Objetivo: executar a Spec 077, começando pela Fase 0 obrigatória.
- Escopo: `apps/mesas` backend + frontend; documentação da spec/sessão/backlog/T0.
- Gate: D (mesas).
- Vínculos: `specs/077-mesas-dedupe-mesas-ativas/`.

## Estado de entrada

- T0, `AGENTS.md`, RTK, skill caveman e T1 de specs/sessões lidos.
- Branch encontrada: `feat/mesas-og-scrape-catalog-backup`.
- Working tree já contém mudanças do mantenedor em arquivos de Mesas e pacotes; preservar integralmente.
- Spec 077 está untracked.
- Implementação bloqueada pela própria Fase 0 até decisões explícitas do mantenedor sobre schema e gatilho.

## Plano desta fase

- [ ] Confirmar schema/campos reais de `tables` e pipeline atual de dedupe.
- [ ] Consultar volume real de mesas ativas em produção, read-only.
- [ ] Executar análise exploratória do score sobre amostra/dados reais sem mutar produção.
- [ ] Propor schema, gatilho e algoritmo com evidências.
- [ ] Atualizar backlog, `project-state.md`, `plan.md` e `tasks.md` com estado da Fase 0.
- [ ] Pedir decisão explícita antes de migration/rota/código da feature.

## Arquivos previstos nesta fase

- `sessoes/26-07-14_1_mesas_077-dedupe-mesas-ativas.md`
- `sessoes/index.md`
- `specs/077-mesas-dedupe-mesas-ativas/plan.md`
- `specs/077-mesas-dedupe-mesas-ativas/tasks.md`
- `specs/backlog.md`
- `.specify/memory/project-state.md`

## Critério de conclusão da fase

Fase 0 concluída com evidência real, decisões propostas e aprovação do mantenedor solicitada. Nenhuma migration, rota ou UI antes dessa aprovação.

## Backlog

`BL-077-MESAS-DEDUPE-ATIVAS` aberto em `specs/backlog.md`; implementação marcada
bloqueada até decisão nominal do mantenedor.

## Evidência — Fase 0

- `apps/mesas/backend/src/db/types.ts:225-292`: `tables` expõe título,
  descrição, sistema, origem/URL, status e slug; não guarda hash/texto
  normalizado.
- `apps/mesas/database/migration_137_discord_duplicate_candidates.sql:7-21`:
  estrutura atual exige `parse_case_id` e `candidate_case_id`; ambas FKs para
  `discord_parse_cases`.
- `apps/mesas/backend/src/discord/parseRetrieval.ts:153-187`: score atual usa
  similaridade textual + URL/form + sistema/canal/autor; threshold candidato
  0.75.
- Produção read-only: `SELECT count(*) FROM tables WHERE status='active'`
  retornou **31** em 2026-07-14.
- `specs/077-mesas-dedupe-mesas-ativas/exploratory-active-pairs.sql` executado
  contra produção, read-only. 465 pares possíveis; 3 candidatos fortes:
  `a-voz-nas-cartas-*`, `ecos-bastardos-*`, `mascaras-de-nyarlathotep-*`.
  Todos: título 1.000 + descrição 1.000. Dois: `system_id` diferente.
- Conclusão: sistema é sinal corroborativo, não filtro eliminatório. Full-scan
  sob demanda é barato no volume atual.
- Ferramentas indisponíveis neste turno: `artificio-api-governance`, LSP,
  `codebase-memory-mcp`. Fallback: RTK, código real, SQL read-only.

## Estado ao pausar

- [x] Schema e dedupe atual confirmados.
- [x] Volume real levantado.
- [x] Teste exploratório escrito e executado.
- [x] Proposta registrada no `plan.md`.
- [ ] Mantenedor aprovar tabela nova + gatilho sob demanda + score.
- [ ] Implementação Fase 1+.

## Aprovação do mantenedor

- 2026-07-14: `autorizado` para proposta da Fase 0: tabela nova,
  gatilho admin sob demanda, score URL/título/descrição com sistema
  corroborativo e decisão exclusivamente manual.
- Autorização cobre implementação local e validação. Não cobre commit, push,
  PR, deploy ou escrita na VM/DB real.

Estado histórico da pausa pré-aprovação: nenhum código de feature, migration,
rota ou UI havia sido alterado; gates seriam executados após implementação.

## Implementação local

- Migration 145: `table_duplicate_candidates`, alvo exclusivo mesa ou
  parse-case, índices únicos parciais, decisão manual e auditoria.
- `tableDuplicateDetection.ts`: score puro por trigramas normalizados, URL,
  sistema corroborativo; scanner sob demanda para mesa×mesa e draft×mesa.
- API admin: listar, recalcular e decidir candidato. Decisão draft×mesa também
  alimenta `discord_parse_feedback`; mesa×mesa não força trilha Discord.
- UI: aba `/gestao/mesas/duplicatas`, botão `Checar duplicatas`, links para
  mesa pública/admin/draft, três decisões manuais.
- Fila `/gestao/mesas/rascunhos`: badge `possível duplicata (N)`; deep-link
  `?draft=<id>` abre editor.
- OpenAPI + gerados atualizados por `pnpm verify:api`.

## Validação

- `pnpm --filter @artificio/mesas-backend exec tsc --noEmit` ✅
- `pnpm --filter @artificio/mesas-frontend exec tsc --noEmit` ✅
- backend test: 44 arquivos, 456 testes ✅
- frontend test: 17 arquivos, 173 testes ✅
- lint backend/frontend ✅
- `pnpm verify:api` ✅; mesas `breaking=0`, `non-breaking=3`
- `pnpm run lint` ✅; 21/21 pacotes
- `pnpm run build` ✅; 21/21 pacotes
- `git diff --check` ✅

## Pendência real

- Docker local indisponível (`docker_engine` não encontrado). Não foi possível
  aplicar migration nem subir app/DB local.
- Smoke exigido segue aberto: aplicar migration em beta/local, rodar botão,
  confirmar pares e links/badge. Produção não foi alterada.
- Spec não está concluída nem deployada.

## Retomada — débitos do agente paralelo

- Mantenedor pediu investigar e corrigir `DEB-077-01` a `DEB-077-05`.
- Agente paralelo já editou `CatalogTree.tsx`, validação de sessões,
  `gmPanel.ts`, `apiClient.ts` e `debitos.md` no working tree compartilhado.
- Antes de novas edições: validar causa/fix no código material, consumidores,
  schema backend e testes. Preservar mudanças concorrentes em `AGENTS.md` e
  demais arquivos não relacionados.
## Débitos paralelos — investigação e correção

- DEB-077-01: confirmado falso vazio no `CatalogTree`; correção paralela validada e teste de regressão adicionado. Teste obsoleto ainda usava a prop removida `showEmptySearchResults`; reconciliado.
- DEB-077-02: backend/schema confirmam `end_time` nullable/opcional; validação frontend corrigida e regressão adicionada.
- DEB-077-03: rota de edição agora sanitiza CDN efêmero do Discord; regressão de rota adicionada.
- DEB-077-04: cancelamento continua funcional; ruído de console limitado a DEV.
- DEB-077-05: registro estava desatualizado; os dois erros `set-state-in-effect` já foram corrigidos e lint repo-wide havia passado.
- Testes: `catalog-ui` 12/12; `mesas-frontend` 174/174; `mesas-backend` 456/456.
- Gates finais: `pnpm verify:api` verde (3 mudanças não-breaking já esperadas da 077); `pnpm run lint` 21/21; `pnpm run build` 21/21.
