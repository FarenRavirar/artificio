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
