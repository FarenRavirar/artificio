# Saída da medição da Fase 5 — 2026-07-28

Execução read-only de `phase-5-measurement.sql` no `downloads-beta-db`, sobre o acervo
recoletado de 90 materiais. O script abriu `BEGIN TRANSACTION READ ONLY` e encerrou com
`ROLLBACK`; exit 0.

## Métricas por fonte e template

| fonte | template | found no log | created | rejected | duplicate | errors | system matched | system raw | type matched | type raw | type eligible | neutral |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `grimorios_e_dados` | `produto` | 7 | 7 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 7 |
| `itch_io` | `produto` | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| `opera_rpg` | `aventuras` | 9 | 9 | 0 | 0 | 0 | 0 | 9 | 9 | 9 | 9 | 0 |
| `opera_rpg` | `cenarios` | 23 | 23 | 0 | 0 | 0 | 0 | 22 | 23 | 23 | 23 | 0 |
| `opera_rpg` | `outros` | 3 | 3 | 0 | 0 | 0 | 0 | 3 | 0 | 0 | 0 | 3 |
| `opera_rpg` | `personagens` | 14 | 14 | 0 | 0 | 0 | 0 | 14 | 0 | 0 | 0 | 14 |
| `opera_rpg` | `personagens-digitais` | 1 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 1 |
| `opera_rpg` | `regras-e-fichas` | 30 | 30 | 0 | 0 | 0 | 0 | 30 | 0 | 0 | 0 | 30 |

`found no log` não representa `items_found` real: os runs registraram 137/11/25 itens, mas
o log preservou só os 80/7/3 criados. Diagnóstico read-only nos logs do container confirmou
83 ocorrências de `value too long for type character varying(20)`: o enum textual
`skipped_not_portuguese` tem 22 caracteres e não cabe em
`download_scraper_item_log.outcome VARCHAR(20)`. Logo métricas de rejeitados por template e
ground truth estão incompletas.

## Regras

| regra | veredito | matched | total | percentual |
|---|---|---:|---:|---:|
| `catalog:neutral_type_minority` | fail | 32 | 90 | 35,56% não neutros; 58/90 = 64,44% neutros |
| `facets:shape` | pass | 90 | 90 | 100,00% |
| `language:false_positives` | pass | 11 | 11 | 100,00%; não interpretável sem `ground_truth_observed` completo |
| `language:ground_truth_observed` | fail | 4 | 11 | 36,36% |
| `language:portuguese_approved` | fail | 4 | 7 | 57,14% |
| `opera_rpg:aventuras:system_match` | fail | 0 | 9 | 0,00% |
| `opera_rpg:aventuras:type_match` | pass | 9 | 9 | 100,00% |
| `opera_rpg:cenarios:system_match` | fail | 0 | 23 | 0,00% |
| `opera_rpg:cenarios:type_match` | pass | 23 | 23 | 100,00% |
| `opera_rpg:outros:system_match` | fail | 0 | 3 | 0,00% |
| `opera_rpg:personagens-digitais:system_match` | fail | 0 | 1 | 0,00% |
| `opera_rpg:personagens:system_match` | fail | 0 | 14 | 0,00% |
| `opera_rpg:regras-e-fichas:system_match` | fail | 0 | 30 | 0,00% |
| `plain_text:entities` | pass | 90 | 90 | 100,00% |
| `run:grimorios_e_dados:completed` | pass | 1 | 1 | 100,00% |
| `run:grimorios_e_dados:created_positive` | pass | 7 | 11 | 63,64% |
| `run:grimorios_e_dados:found_positive` | pass | 11 | 11 | 100,00% |
| `run:grimorios_e_dados:item_logs_reconciled` | fail | 7 | 11 | 63,64% |
| `run:grimorios_e_dados:reconciled` | pass | 11 | 11 | 100,00% |
| `run:grimorios_e_dados:zero_errors` | pass | 11 | 11 | 100,00% |
| `run:itch_io:completed` | pass | 1 | 1 | 100,00% |
| `run:itch_io:created_positive` | pass | 3 | 25 | 12,00% |
| `run:itch_io:found_positive` | pass | 25 | 25 | 100,00% |
| `run:itch_io:item_logs_reconciled` | fail | 3 | 25 | 12,00% |
| `run:itch_io:reconciled` | pass | 25 | 25 | 100,00% |
| `run:itch_io:zero_errors` | pass | 25 | 25 | 100,00% |
| `run:opera_rpg:completed` | pass | 1 | 1 | 100,00% |
| `run:opera_rpg:created_positive` | pass | 80 | 137 | 58,39% |
| `run:opera_rpg:found_positive` | pass | 137 | 137 | 100,00% |
| `run:opera_rpg:item_logs_reconciled` | fail | 80 | 137 | 58,39% |
| `run:opera_rpg:reconciled` | pass | 137 | 137 | 100,00% |
| `run:opera_rpg:zero_errors` | pass | 137 | 137 | 100,00% |
| `slug:fixture_ground_truth` | pass | 1 | 1 | 100,00% |
| `taxonomy:fixture_ground_truth` | fail | 2 | 4 | 50,00% |

## Cruzamento com `spec.md`, `plan.md` e código

- `plan.md` exige que `download_scraper_item_log` preserve template e hints também para
  rejeitados. O schema real (`migration_022_download_scraper.sql`) torna o outcome de rejeição
  impossível: `VARCHAR(20)` versus 22 caracteres. Isto invalida cobertura de ground truth,
  taxonomia dos rejeitados e métricas de rejeição por template.
- `spec.md` exige OPERA `aventuras`/demais templates com 100% de sistema e `cenarios` com no
  mínimo 95%. Banco real: 79 materiais OPERA com `raw_system_hint='OPERA RPG'`, 0 com
  `system_id`; Gaia 400X é o único `null`, conforme decisão T0.7. Todos os limites falharam.
- `spec.md` exige menos de 50% de neutros. Banco real: 58/90 = 64,44%; falhou. Os 32 itens dos
  templates homogêneos `aventuras`/`cenarios` chegaram ao log com `material_type_hint`
  (`aventura` 9; `cenario` 23), casaram e receberam tipo não neutro. Por isso
  `raw_material_type_hint` ficou corretamente nulo: esse campo preserva somente hint que
  **não** casou; não é o campo do hint original.
- `plain_text:entities` passou 90/90 e `slug:fixture_ground_truth` passou 1/1. Isto cobre os
  campos `plainText` enumerados pela política, arrays/JSON inclusos, e confirma ausência de
  entidade HTML crua no acervo criado — inclusive Grimórios & Dados.
- A contaminação `cat5crew`/`minihex` de DEB-090-01 permanece ressalva declarada: taxa de
  rejeição por idioma é piso. Não foi reinterpretada como falha nova nem corrigida nesta
  medição. O gate não pode ser descrito como verde limpo.

Status: **Fase 5 bloqueada por regras críticas falhando**. T5.8 não executada, conforme T5.9.

## Correção de escopo da regra de sistema

Revisão read-only posterior confirmou que os 79 materiais OPERA dedicados tinham
`raw_system_hint='OPERA RPG'` e **79/79** possuíam `download_system_suggestion` de origem
`scraper` em estado `pending`. O caminho humano entregue pela Fase 4 funcionou exatamente como
desenhado: sistema ainda ausente do catálogo não é criado pelo scraper; fica preservado na fila
para o admin aprovar como `create_system`. A resolução de uma sugestão religa em lote as demais
pendentes com o mesmo `raw_value`.

O SQL foi corrigido para separar `system_matched`, `system_pending` e `system_accounted`.
Reexecução read-only sobre o mesmo acervo: todas as regras OPERA de sistema passaram —
`aventuras` 9/9, `cenarios` 22/23 (95,65%; Gaia 400X é o `null` previsto) e os demais templates
48/48. Isso remove o falso bloqueio de sistema sem escrever `OPERA RPG` diretamente no catálogo.

O gate de tipo **não mudou**. Consulta direta distinguiu os dois campos:

| fonte/template | `download_scraper_item_log.material_type_hint` | `download_material.raw_material_type_hint` | não neutros |
|---|---:|---:|---:|
| OPERA `aventuras` | 9 (`aventura`) | 0 | 9 |
| OPERA `cenarios` | 23 (`cenario`) | 0 | 23 |
| demais templates/fontes | 0 | 0 | 0 |

Logo, não existe perda dos 32 hints: todos casaram. Existe cobertura insuficiente de extração:
58/90 materiais chegaram corretamente ao tipo neutro por não terem hint, reprovando o limite
pré-declarado de menos de 50%. O limite permanece; não foi trocado por critério vacuamente
verdadeiro após a medição.

## Checkpoint corretivo T5.5b

`migration_033` foi aplicada em Beta em 2026-07-28 pelo runner oficial, sem backup conforme
autorização nominal para o ambiente descartável. Pós-condição conferida: `outcome VARCHAR(32)`,
`download_scraper_run.item_log_failures INTEGER NOT NULL DEFAULT 0`,
`item_log_error_detail TEXT` e linha em `schema_migrations`. O runner registrou a aplicação;
não houve intervenção manual separada para reconciliar.

O SQL canônico ganhou a regra `item_logs_reconciled`. Reexecução read-only, ainda sobre as
runs antigas irrecuperáveis, terminou com exit 0 e `ROLLBACK`, falhando como esperado nas três
fontes: OPERA 80/137, Grimórios 7/11 e itch 3/25. Esses dados continuam inválidos para taxas de
rejeição; servem somente como prova de que o gate agora detecta o buraco. A saída final deste
artefato só pode ser substituída depois do deploy do rastro persistente e da nova recoleta.
