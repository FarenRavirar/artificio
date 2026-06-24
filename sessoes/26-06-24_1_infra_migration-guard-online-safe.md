# Sessão 26-06-24_1 — infra: guard de migration online-safe (spec 050)

- **Data:** 2026-06-24
- **App/escopo:** infra / `scripts/deploy/` (guard de migration)
- **Gate:** D (mesas)
- **Spec:** `specs/050-infra-migration-guard-online-safe/`
- **Objetivo:** planejar correção do falso-positivo do guard `online-safe` que abortou o deploy prod de mesas + tratar o débito de duplicação do guard. **Claude planeja; DeepSeek implementa.**

## Vínculos
- Origem: deploy prod mesas `run 28125222995` (rollback automático).
- Débito de duplicação já registrado: `BL-DEP-MESAS-LEGACY-SCRIPTS` (backlog) + `specs/035-infra-small-debts/` R0/T6.
- Novo débito: `BL-MESAS-MIGRATION-GUARD-FALSE-POSITIVE`.

## O que foi feito (planejamento + registro)
1. Diagnóstico completo (não corrigido — fora do escopo do mantenedor para esta sessão):
   - Causa raiz: `validate_sql_against_class` (`scripts/deploy/lib_migrations.sh:59`) usa `\bDROP\b` largo demais; barra `DROP NOT NULL`/`DROP CONSTRAINT` de `migration_128` (não destrutivos).
   - Beta passou porque 128/129 já estavam em `schema_migrations` (aplicadas 2026-06-22 por `ci:agent@opencode`); prod parou em 127 e tentou aplicar 128 pela 1ª vez → bloqueio.
   - Achado secundário: 2 cópias divergentes do guard; a ativa é `scripts/deploy/` (flock). `apps/mesas/scripts/deploy/*` são órfãos (= `BL-DEP-MESAS-LEGACY-SCRIPTS`).
2. Spec 050 criada conforme skill `new-spec`: `spec.md` (o quê/porquê + requisitos R1-R7), `plan.md` (regex/arquivos/validação), `tasks.md` (Fases A-D; Fase C dedicada à duplicação cruzando spec 035).
3. Estado de prod: intacto (rollback restaurou 127 + código anterior). Mesas 049 **não** em prod. Beta OK.

## Backlog
- ✅ Atualizado: `BL-MESAS-MIGRATION-GUARD-FALSE-POSITIVE` (novo) + `BL-DEP-MESAS-LEGACY-SCRIPTS` (referência à spec 050).

## Critério de conclusão (da sessão de planejamento)
- [x] Spec 050 com 3 arquivos no template do skill.
- [x] Débito de duplicação verificado contra spec 026/035 e amarrado na Fase C.
- [x] Bug registrado no backlog no mesmo turno.
- [x] project-state atualizado.

## Pendências (para DeepSeek / mantenedor)
- Implementação das Fases A-D (DeepSeek).
- Deletar órfãos (T12) e re-deploy prod (T19) = aprovação nominal do mantenedor.

## project-state
- Atualizar: spec 050 planejada; mesas bloqueado para prod até guard corrigido + re-deploy gated.
