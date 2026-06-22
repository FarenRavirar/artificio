# Sessão — 2026-06-21 — Spec 042 Duplicate Code Refactor

**Objetivo:** Analisar duplicação de código com `cpd`, criar spec 042 para refatorar top 3 achados, implementar os 3 itens.

**App/Pacote:** `packages/feedback` (novo) + `apps/mesas/backend` + `apps/glossario/backend` + `apps/site/server`

**Gate:** nenhum

## Vínculos

- Spec: `specs/042-duplicate-code-refactor/`
- Backlog: `specs/backlog.md` — `BL-DUPLICATE-042`
- Ferramenta: `cpd` 5.0.11

## Plano

1. ✅ Rodar `cpd` — 5.57% duplicação, 134 clones, 2.275 linhas
2. ✅ Extrair top 3 por impacto
3. ✅ Investigar cada item com evidência file:line
4. ✅ Criar spec 042 (spec.md, plan.md, tasks.md)
5. ✅ Implementar Item 1: `packages/feedback` + migrar 3 consumidores
6. ✅ Implementar Item 2: `actorNameResolver.ts` + migrar 6 rotas
7. ✅ Implementar Item 3: `suggestionHelpers.ts` + migrar 4 rotas
8. ✅ Build 16/16, testes 219/219, cpd 4.60%

## Checklist de fechamento

- [x] Spec 042 criada com 3 fases e 37 tasks
- [x] Backlog atualizado
- [x] project-state.md atualizado
- [x] specs/README.md atualizado
- [x] Item 1 concluído: zero clones nos arquivos de feedback
- [x] Item 2 concluído: 6→1 fonte de resolveActorName
- [x] Item 3 concluído: 4 pares de handlers → 3 shared factory functions
- [x] Build 17/17 verde
- [x] Testes 219/219 verde
- [x] cpd final: 5.57% → 4.60% (-0.97pp, -411 linhas, -18 clones)
- [x] 13 revisões de PR resolvidas (R042-001 a R042-013)
- [x] PR #83 mergeada em `dev` (154 arquivos, +7663/-3040)
- [x] Deploy beta disparado: mesas + glossario + site
- [x] Promovido `dev→main` (run `27926641721`)
- [x] Deploy prod: mesas (`27926664572`), glossario (`27926665007`), site (`27926665494`)

## Critério de conclusão

Spec 042 implementada, mergeada em `dev` (PR #83), promovida `dev→main` (run `27926641721`) e deploy prod mesas/glossario/site (runs `27926664572`/`27926665007`/`27926665494`). 3 fontes únicas criadas. Duplicação reduzida em 18%. 13 revisões de PR resolvidas.

## Evidência

### Antes
- cpd: 5.57%, 2.275 linhas, 134 clones
- 3 feedback validators duplicados (95% idêntico)
- 6 definições de resolveActorName em 6 rotas
- 4 pares de handlers scenario↔system copiados

### Depois
- cpd: 4.60%, 1.864 linhas, 116 clones (-18%)
- 1 `packages/feedback` fonte única, 3 apps consumindo
- 1 `services/actorNameResolver.ts` fonte única, 6 rotas consumindo
- 1 `routes/suggestionHelpers.ts` com 3 factory functions, 4 rotas consumindo
- Build 16/16 ✅, testes 219/219 ✅

### Arquivos criados
- `packages/feedback/` — types, helpers, normalize, parse, barrel (7 arquivos)
- `apps/mesas/backend/src/services/actorNameResolver.ts`
- `apps/mesas/backend/src/routes/suggestionHelpers.ts`

### Arquivos editados (14)
- `apps/glossario/backend/package.json` — +dep @artificio/feedback
- `apps/glossario/backend/src/validators/feedbackValidator.ts` — re-export
- `apps/site/package.json` — +dep @artificio/feedback
- `apps/site/server/lib/feedback-validator.ts` — re-export + decodeScreenshotDataUri
- `apps/mesas/backend/package.json` — +dep @artificio/feedback
- `apps/mesas/backend/src/validators/devFeedbackValidator.ts` — wrapper
- `apps/mesas/backend/src/routes/scenarioSuggestions.ts` — import actorNameResolver + listMineHandler
- `apps/mesas/backend/src/routes/systemSuggestions.ts` — idem
- `apps/mesas/backend/src/routes/gmPanel.ts` — import actorNameResolver
- `apps/mesas/backend/src/routes/vttPlatforms.ts` — import actorNameResolver
- `apps/mesas/backend/src/routes/scenarioSuggestionsAdmin.ts` — import actorNameResolver + rejectHandler + listAdminHandler
- `apps/mesas/backend/src/routes/systemSuggestionsAdmin.ts` — idem
