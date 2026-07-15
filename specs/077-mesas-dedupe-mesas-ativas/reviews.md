# Reviews — 077 mesas dedupe mesas ativas

## PR #159 — SonarCloud (2026-07-14)

- `tableDuplicateDetection.ts`: procede. `scanTableDuplicateCandidates()`
  acumulava score, normalização, dois loops e persistência (complexidade 20;
  limite 15). Extraídos builders de candidatos, sem mudar score/threshold.
- `ModeracaoSection.tsx` (2 achados): procedem. Título e descrição usavam
  ternários aninhados. Extraídos mapas tipados por subaba.
- `exploratory-active-pairs.sql`: procede. Comparação de `system_id` nullable
  tornou-se explícita com `IS NOT NULL` antes da igualdade.
- `TableDuplicatesPanel.tsx`: procede. Effect removido de `void load()`;
  rejeição defensiva fica tratada por `.catch()` documentado.

Todos classificados como correção imediata, sem débito novo.
## PR #160 — Codex, CodeRabbit e SonarCloud (2026-07-14)

- **Aplicar:** `user_systems` na migration 148; pai de variante no drawer;
  learning somente quando altera sistema; importador com erro controlado para
  `variants`; validação Zod das respostas de correction/retry; limiar por
  `ACTIVE_CONFIDENCE`; `FORBIDDEN_KEYS`; teste de catálogo no script do site;
  metadata de migration limitada ao cabeçalho.
- **Não aplicar:** docstrings em massa; smells puramente cosméticos; “constantes”
  para literais SQL; remoção de `EXISTS`; `NOT VALID` seguido de `VALIDATE` na
  mesma migration; extração transversal de helpers; redesenho do retry para job.
  Motivo: ganho não material, falso positivo, ou ampliação arquitetural que pede
  decisão própria e não é necessária para corrigir a PR.
- Threads não serão respondidas nem resolvidas pelo agente, conforme governança.
