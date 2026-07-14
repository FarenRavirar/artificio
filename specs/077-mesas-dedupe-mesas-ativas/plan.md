# Plano — 077 mesas dedupe mesas ativas

Status: Fase 0 executada; decisões propostas, aguardando aprovação de implementação.
Execução prevista: Codex. Este plano define ordem obrigatória —
investigação (com testes que provam o achado) sempre antes de qualquer
código de feature.

## Fase 0 — Investigação (obrigatória, bloqueia Fase 1+)

Cada item abaixo deve terminar com evidência registrada (comando rodado,
output, arquivo:linha) em `sessoes/` — não fechar por dedução.

1. Confirmar schema real de `tables` (campos disponíveis pra hash/comparação:
   título, descrição, sistema, link de inscrição/form, GM, canal Discord de
   origem se houver) — `apps/mesas/backend/src/db/types.ts` +
   `database/migration_*` relevantes. Evidência: grep/read citado.
2. Levantar volume real de mesas ativas em produção (`SELECT count(*) FROM
   tables WHERE status = 'active'`, read-only) — decide se full-scan
   síncrono é viável ou precisa índice/job.
3. Escrever teste exploratório (script local ou teste unitário descartável)
   que roda o algoritmo de score candidato (adaptado de
   `classifyMatchKind`/sinais de `discord_duplicate_candidates`) contra um
   dump/amostra real de `tables`, e reporta quantos pares candidatos
   apareceriam **hoje**, antes de decidir schema novo. Isso confirma que o
   algoritmo tem sinal útil antes de migrar banco.
4. Decidir: tabela nova (`table_duplicate_candidates`) vs. estender
   `discord_duplicate_candidates` com FK opcional pra `tables.id`. Tendência:
   tabela nova, para não forçar union de domínios (parse_case vs table) numa
   única FK — mas registrar decisão explícita com o porquê, não assumir.
5. Decidir gatilho de detecção:
   - Opção A: rodar comparação sob demanda (botão "checar duplicatas" na
     tela de gestão) — mais simples, sem custo contínuo.
   - Opção B: rodar automaticamente no publish de mesa (`draft` → `active`)
     e no sync de draft — reaproveita padrão do OG scrape automático (spec
     059/PR #157), mas adiciona custo síncrono a esses fluxos.
   - Tendência: Opção A pro MVP (evita acoplar custo em fluxos já sensíveis
     como publish), B como follow-up se o mantenedor pedir.
6. Confirmar algoritmo de score adaptado pra `tables` (sem `normalized_text`
   pronto) — provavelmente precisa normalizar título+descrição na hora da
   comparação (mesmo approach de `discord_parse_cases.normalized_text`, mas
   calculado em runtime ou coluna gerada). Validar com o teste do item 3.
7. Levar as decisões 4/5/6 ao mantenedor antes de codar Fase 1 — nenhuma
   migration ou rota nasce sem essa aprovação (regra pétrea: pacote
   compartilhado/schema novo não é decisão do agente sozinho).

## Fases previstas (sujeitas a ajuste após Fase 0, só iniciam com decisões aprovadas)

1. **Backend — schema e detecção**
   - Migration da tabela de candidatos mesa×mesa (ou extensão decidida acima).
   - Serviço de comparação (reaproveitar `pg_trgm`/GIN trgm já criado na
     migration_137 se aplicável a `tables`).
   - Rota `GET /admin/tables/duplicates` (lista) + `PATCH
     /admin/table-duplicate-candidates/:id` (decisão), espelhando o padrão
     de `routes/discord/duplicates.ts`.

2. **Backend — draft × mesa ativa**
   - Estender a detecção existente (`discord_duplicate_candidates` ou nova
     lógica) pra também comparar `discord_parse_cases` contra `tables`
     ativas, não só entre si.

3. **Frontend — indicador na listagem**
   - Badge/contador em `DiscordDraftReviewTable.tsx` quando o draft tem
     candidato de duplicata pendente.

4. **Frontend — tela de gestão de duplicatas**
   - Nova aba ou extensão de `DuplicatesTab.tsx` pra listar pares mesa×mesa
     e draft×mesa fora do contexto de um único draft, com link direto pras
     duas pontas (público `/mesas/:slug` + admin).

5. **Validação**
   - Teste automatizado do serviço de comparação/score (unit, cobrindo
     casos: par idêntico, par parecido só no sistema, par sem relação).
   - Teste de rota (`GET .../duplicates`, `PATCH .../:id`) com `requireAdmin`.
   - Lint + build backend/frontend mesas.
   - Smoke manual com par de mesas ativas semelhantes (real, pós-lint/build
     verdes — nunca fechar tarefa só com teste unitário se o critério de
     aceite pede execução real).

## Decisões pendentes de aprovação do mantenedor

- Tabela nova vs. extensão de schema existente (impacta migration).
- Gatilho sob demanda vs. automático (impacta UX e custo).
- Se o merge de duplicata confirmada ganha alguma ação além de marcação
  manual (ex.: sugestão de campos a copiar) — mantido fora de escopo por
  padrão, confirmar antes de expandir.

## Evidência da Fase 0 — 2026-07-14

- Schema material: `TablesTable` tem `title`, `description`, `system_id`,
  `source_url`, `source_id`, `origin`, `status` e `slug`; não tem texto/hash
  normalizado persistido (`apps/mesas/backend/src/db/types.ts:225`).
- Dedupe atual: `discord_duplicate_candidates` tem duas FKs obrigatórias para
  `discord_parse_cases`; não representa `tables` sem romper o contrato atual
  (`migration_137_discord_duplicate_candidates.sql:7`).
- Produção, consulta read-only: **31 mesas ativas**. Full-scan mesa×mesa = 465
  pares; custo pequeno para botão sob demanda.
- Teste exploratório executado: `exploratory-active-pairs.sql`. Resultado: 3
  pares fortes, todos com similaridade 1.000 em título e descrição:
  `a-voz-nas-cartas-*`, `ecos-bastardos-*`, `mascaras-de-nyarlathotep-*`.
  Dois pares têm `system_id` diferente; sistema deve corroborar, nunca vetar.
- Ferramentas `artificio-api-governance`, LSP e `codebase-memory-mcp` não estão
  expostas neste cliente/turno. Fallback usado: RTK + código real + SQL
  read-only. API bundle deverá ser consultado/regenerado na implementação.

## Proposta para aprovação

1. **Tabela nova.** `table_duplicate_candidates`, polimórfica só no nível de
   ponta (`left_table_id` obrigatório; `right_table_id` ou `right_parse_case_id`
   mutuamente exclusivos). Mantém `discord_duplicate_candidates` intacta e
   cobre mesa×mesa + draft×mesa sem FK opcional ambígua no legado.
2. **Gatilho sob demanda no MVP.** Botão admin recalcula candidatos. Com 31
   ativas/465 pares, full-scan é viável; zero latência extra no publish/sync.
3. **Score.** URL de origem igual = sinal forte; título e descrição
   normalizados usam `pg_trgm`; `system_id` igual soma score, mas diferença não
   elimina candidato. Limiar inicial calibrado pelo teste real e coberto por
   testes unitários.
4. **Decisão manual somente.** Confirmar/rejeitar/atualizar existente; nenhum
   merge, cópia ou delete automático.
