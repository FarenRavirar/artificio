# Tasks — 078 sistemas centrais e projeção Mesas Beta

Regra: toda fase começa e termina atualizando esta lista, sessão e `project-state.md`. `decisions.md` complementa, nunca substitui estado operacional.

## Fase 0 — Registro e baseline

- [x] T0.1 Criar Spec 078 dedicada (`spec`, `plan`, `tasks`, `reviews`, `debitos`).
- [x] T0.2 Registrar: catálogo Mesas ≠ sistemas de RPG; Central = Site Prod.
- [x] T0.3 Registrar decisões no `project-state.md`, não somente em `decisions.md`.
- [x] T0.4 Atualizar backlog, README de specs e índice de sessões.
- [x] T0.5 Marcar “sem projeções” da 062 como superada somente para Mesas Beta.
- [x] T0.6 Inventariar reads/writes diretos em `systems`/`system_aliases`.
- [x] T0.7 Mapear UUIDs em colunas, arrays e JSONB.
- [x] T0.8 Mapear onboarding e draft JSON ponta a ponta.
- [x] T0.9 Criar matriz “melhor/mais avançado/mais recente” dos dois fluxos.
- [x] T0.10 Atualizar `project-state.md` com resultado antes da Fase 1.

## Fase 1 — Contrato único

Estado: concluída. Provider read/write selecionado por ambiente; lifecycle soft
e snapshot explícito implementados. Fase 2 liberada.

- [x] T1.1 Especificar interface única de leitura.
- [x] T1.1a Especificar interface de mutação com lifecycle/redirect soft.
- [x] T1.2 Reader Central para Mesas Prod.
- [x] T1.2a Writer Central atrás da fachada única.
- [x] T1.3 Reader local para Mesas Beta.
- [x] T1.3a Writer local seguro, sem hard delete.
- [x] T1.3b Migration local: origem, status, merge e versão Central observada.
- [x] T1.4 Gate fail-closed + regressão Prod nunca-local.
- [x] T1.5 Preservar fachadas públicas.
- [x] T1.6 Atualizar `project-state.md` e sessão antes da Fase 2.

## Fase 2 — Central Site Prod→Mesas Beta

Estado: implementação concluída; apply/restore real permanece na Fase 6.

- [x] T2.1 Snapshot/version/checksum.
- [x] T2.2 Dry-run e relatório.
- [x] T2.3 Upsert topológico com UUID preservado.
- [x] T2.4 Atualizar existentes/aliases; inserir ausentes; zero delete.
- [x] T2.5 Colisão/órfão fail-closed.
- [x] T2.6 Auth, transação, observabilidade e retry idempotente.
- [x] T2.7 Testes de idempotência e extras Beta.
- [x] T2.8 Atualizar `project-state.md` e sessão antes da Fase 3.

## Fase 3 — Mesas Prod→Beta sem sistemas RPG

Estado: concluída. Hidratação Mesas separada do domínio RPG e protegida pela
versão/referências da projeção. Nenhum banco real tocado.

- [x] T3.1 Excluir domínio de sistemas da allowlist.
- [x] T3.2 Remover resolução de `tables.system_id` via legado.
- [x] T3.3 Exigir projeção Beta pronta.
- [x] T3.4 Validar referências de mesas/usuários/preferências/grupos.
- [x] T3.5 Preservar PII/dry-run.
- [x] T3.6 Testes transacionais e retry.
- [x] T3.7 Atualizar `project-state.md` e sessão antes da Fase 4.

## Fase 4 — Consumidores runtime

Estado: concluída. Runtime usa provider; acesso local direto restrito a
provider/hidratador/guard/scripts.

- [x] T4.1 Parser Discord/JSON usa contrato único.
- [x] T4.2 Onboarding usa contrato único.
- [x] T4.3 Preferências usam contrato único.
- [x] T4.4 Grupos fechados usam contrato único.
- [x] T4.5 DDAL usa contrato único.
- [x] T4.6 CRUD/sugestões usam contrato único.
- [x] T4.7 Provar zero acesso direto fora adapter/hidratador/scripts permitidos.
- [x] T4.8 Atualizar `project-state.md` e sessão antes da Fase 5.

## Fase 5 — Onboarding + draft JSON

Estado: concluída. Fluxos compartilham provider/picker/modal; parser mantém
extração/learning sem criação silenciosa. JSONs reais reprocessados.

- [x] T5.1 Registrar matriz comparativa antes de editar.
- [x] T5.2 Motor único de matching/candidatos/hierarquia.
- [x] T5.3 Picker/form único e acessível.
- [x] T5.4 Aliases, learning, alternativas e proveniência.
- [x] T5.5 Zero criação silenciosa pelo parser.
- [x] T5.6 Testes equivalentes onboarding×draft.
- [x] T5.7 Reprocessar dois JSONs reais e registrar delta.
- [x] T5.8 Atualizar `project-state.md` e sessão antes da Fase 6.

## Fase 6 — Dados e ensaio

Estado: iniciada somente em preflight read-only. Writes reais exigem aprovação
nominal e T6.1/T6.2 vêm antes de qualquer apply.

- [x] T6.1 Backup Site Prod e Mesas Beta; checksums/off-VM.
- [x] T6.2 Restore-test.
- [ ] T6.3 Dry-run e classificação humana de conflitos. Em andamento: primeiro
  dry-run bloqueou 1.374 colisões; 1.264/1.289 UUIDs Beta têm mapping Central
  determinístico. Planejador passou a consumir mapping: residual caiu para uma
  colisão (`Call of Cthulhu/7e`) e 25 extras. D115 decidiu CAIN/Mutants; mappings
  finais e remap de referências em implementação.
- [x] T6.3a Auditar 16 extras contra `name_pt`/aliases; nenhum coincide com a única tradução central preenchida; tradução não vira nó.
- [x] T6.3b Corrigir dívida central já decidida: migration 013 validada em restore-test e rerun.
- [x] T6.3c Promover 16 extras Beta: migration 014 validada; 11 sistemas + 5 edições, UUIDs preservados, zero extra residual.
- [x] T6.4 Apply em cópias + rerun idempotente: 1.287 ativos centrais, zero create/update/remap/conflict no rerun.
- [x] T6.5 Ensaio ordenado das duas hidratações.
  - Restore Site Prod + Mesas Prod + Mesas Beta e migrations passaram em cópias.
  - Projeção Beta passou e rerun ficou `create=0/update=0/remap=0/conflict=0`.
  - Bloqueio encontrado no fluxo real: 8 referências Prod usam UUID legado já
    remapeado pelo snapshot; guard e payload da hidratação ainda tratam UUID cru.
  - Próximo passo proposto: resolver legacy mapping/redirect no guard e nos quatro
    campos hidratados (`tables`, `user_systems`, `user_preferences`, `gm_profiles`),
    testar e repetir T6.5 desde cópias limpas.
  - Correção implementada: resolver encadeado único, validação já canônica e
    remap/dedupe dos quatro payloads; testes focados 8/8 e lint verdes.
  - 4 referências sem origem em qualquer catálogo eram órfãs reais: 2 mesas +
    1 preferência. Migration 150 remove só associações, preserva registros.
  - Conflito `gm_profiles` segue decisão Prod-wins: nome/slug Prod prevalecem;
    Beta conflitante perde nickname e recebe slug técnico estável.
  - Hidratação real passou duas vezes; rerun teve zero inserts. Fingerprints de
    `systems` (2.560) e aliases (851) permaneceram idênticas.
- [x] T6.6 Rollback restaurável provado: dumps verificados restauraram ambas as cópias com `--exit-on-error`.
- [x] T6.7 Atualizar `project-state.md` e sessão antes da Fase 7.

## Fase 7 — Validação e rollout

- [x] T7.1 Testes Mesas/Site focados e completos: monorepo 31/31 tasks; Mesas backend 542 testes.
- [x] T7.2 `pnpm verify:api` verde.
- [x] T7.3 `pnpm run lint` verde.
- [x] T7.4 `pnpm run build` verde.
- [x] T7.5 Revisão mecânica e diff-check verde.
- [x] T7.6 Atualizar `project-state.md` antes de pedir commit/push.
- [ ] T7.7 Commit/push/PR somente autorização nova.
- [ ] T7.8 Reviews por rodada; novo commit só autorizado.
- [ ] T7.9 Merge/deploy Beta com autorização separada.
- [ ] T7.10 Hidratar sistemas; depois mesas/usuários.
- [ ] T7.11 Smoke parser, onboarding, draft JSON, preferências, grupo e DDAL.
- [ ] T7.12 Atualizar `project-state.md`, backlog, tasks e sessão com evidência final.
