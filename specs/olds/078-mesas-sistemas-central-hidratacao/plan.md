# Plano — 078 sistemas centrais e projeção Mesas Beta

Status: Fases 0–5 concluídas localmente; Fase 6 em preflight read-only e requer
backup/restore-test + autorização nominal para qualquer write real. Ordem obrigatória.

## Fase 0 — Baseline e contrato

1. Registrar vocabulário, arquitetura, D114, backlog, índice, sessão e `project-state`.
2. Inventariar reads/writes runtime em `systems`/`system_aliases` por ambiente.
3. Mapear onboarding e draft JSON ponta a ponta.
4. Comparar recursos em matriz e escolher base por capacidade.
5. Mapear referências de sistemas em colunas, arrays e JSONB.
6. Definir contrato versionado de snapshot/dry-run.
7. Atualizar `project-state` antes da Fase 1.

Resultado: snapshot Central existente será reutilizado; matriz escolheu
`SystemPicker`/`useSystemsCatalog` como UI base e parser/candidate scorer como
motor de resolução. Referências UUID/FKs locais exigem projeção pronta antes da
hidratação Mesas. ID Central não-UUID é falha de contrato.

## Fase 1 — Adapter único

1. Interface: árvore/flat, ID/slug, aliases, candidatos, validação e mutações.
2. Adapter Prod: Central Site Prod.
3. Adapter Beta: projeção local Mesas Beta.
4. Ambiente fail-closed; teste impede Prod usar adapter local.
5. Fachadas públicas preservadas.
6. Checkpoint T0.

## Fase 2 — Hidratador Central→Mesas Beta

1. Endpoint/job só Beta; origem fixa Site Prod.
2. Snapshot/version/checksum e dry-run.
3. Reconciliação UUID; colisão slug/path vira erro.
4. Upsert topológico system/edition/variant/aliases.
5. Atualizar existentes, inserir ausentes, preservar extras, zero delete.
6. Transação, idempotência, métricas, retry e logs sanitizados.
7. Testes + checkpoint T0.

## Fase 3 — Corrigir Mesas Prod→Beta

1. Allowlist explícita do domínio Mesas.
2. Excluir domínio de sistemas.
3. Remover join/resolução de `tables.system_id` via legado local.
4. Exigir projeção pronta/versão mínima.
5. Validar UUIDs antes do commit da transação.
6. Testar mesas, usuários, PII, preferências, `user_systems`, grupos e retry.
7. Checkpoint T0.

## Fase 4 — Consumidores runtime

1. Parser Discord/JSON.
2. Onboarding/preferências.
3. Grupos fechados.
4. DDAL.
5. CRUD/sugestões e `/systems`.
6. Busca estática: zero query direta fora adapter/hidratador/scripts permitidos.
7. Checkpoint T0.

## Fase 5 — Unificar onboarding e draft JSON

1. Matriz comparativa antes do código.
2. Motor único de matching/candidatos/hierarquia.
3. Picker/form único, acessível e contextual.
4. Learning/proveniência sem autoaprovação.
5. Testes de equivalência.
6. Reprocessar `D:\teste.json` e `D:\teste [part 2].json`.
7. Checkpoint T0.

Resultado: onboarding usa `SystemPicker` + `SystemSuggestionModal` compartilhados;
parser/scorer/provider permanecem motor único. Casos reais `dnd5`,
`3DeT Victory`, `OSE`, `V5` e `Lobisomem: O Apocalipse` cobertos. Auditoria dos
dois JSONs: 130→137 matches, sem aproximação para sistema ausente.

## Fase 6 — Dados e ensaio

1. Backups/restore-test Site Prod e Mesas Beta.
2. Dry-run em cópias.
3. Curadoria de colisões/extras/órfãos.
4. Apply + rerun idempotente em cópias.
5. Ensaio completo: sistemas antes; mesas/usuários depois.
6. Rollback provado + checkpoint T0.

## Fase 7 — Gates e rollout

1. Testes Mesas/Site, `verify:api`, lint, build e diff-check.
2. Backup real off-VM.
3. Commit/push/PR só com autorização própria.
4. Reviews verificados; um commit por rodada autorizada.
5. Merge/deploy Beta com autorização separada.
6. Hidratar sistemas; depois mesas/usuários.
7. Smoke dos seis consumidores.
8. Atualizar `project-state`, backlog, tasks e sessão com prova real.

## Rollback

- Código: rollback pela esteira centralizada.
- Dados: restaurar dumps verificados; sem DELETE corretivo ad hoc.
- Hidratação: conflito aborta antes do commit.
- Adapter: retorno temporário somente por gate explícito e auditado.
