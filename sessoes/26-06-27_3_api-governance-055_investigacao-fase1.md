# Sessão: 26-06-27_3 — Investigação Fases 1 e 2 da Spec 055 (API Governance)

**Data:** 2026-06-27
**Objetivo:** Investigar estado real dos 4 apps Express e documentar tudo que um implementador precisa saber para executar a Fase 1 (estrutura de contrato/docs OpenAPI) e Fase 2 (inventário estático de rotas - `api:inventory`).
**App/Projeto:** Transversal — accounts, mesas, glossario, links
**Gate:** D (governança transversal)
**Origem:** `specs/055-api-governance-executavel/`

---

## Plano

1. ✅ Ler AGENTS.md completo (não só T0) — governança, regras pétreas, aprovação obrigatória
2. ✅ Ler spec.md, plan.md e tasks.md da spec 055
3. ✅ Ler T0 completo (project-state.md, context-capsule.md, decisions.md)
4. ✅ Verificar sessões ativas — spec 055 é nova, sem sessão anterior
5. ✅ Investigar os 4 apps Express: accounts, glossario, mesas, links
6. ✅ Verificar existência de docs/api/, MAPA_DE_API.md, scripts/api/
7. ✅ Registrar tudo na documentação da spec
8. ✅ **Fase 2 — Investigar padrões de rota Express para o scanner `api:inventory`**
9. ✅ Mapear 8 categorias de padrão de rota (direta, com middleware, Router, app.use, subrouters aninhados, paths relativos, factory routes, multi-prefix)
10. ✅ Mapear todos os prefixos e rotas do glossario ~50 endpoints
11. ✅ Mapear todos os prefixos e subrouters do mesas ~100+ endpoints
12. ✅ Analisar pattern de subrouters em adminDiscordSync.ts (11 subrouters) e adminImportInbox.ts (4 subrouters)
13. ✅ Verificar glue-code de criação de Router via factory (createCorrectionHandler)
14. ✅ Atualizar tasks.md com contexto completo da Fase 2
15. ✅ **Fase 3 — Investigar padrões de consumo de API nos frontends e packages**
16. ✅ Investigar consumidores do mesas-frontend (~95 endpoints via agent subagente)
17. ✅ Investigar consumidores do glossario-frontend (~40 endpoints, 63 chamadas Axios)
18. ✅ Investigar consumidores de accounts/site/links/site-admin/packages/auth/ui/analytics (~33 endpoints)
19. ✅ Mapear 6 padrões de consumo de API (fetch direto, authFetch, Axios, apiClient, api.* namespace, feature APIs)
20. ✅ Atualizar tasks.md com contexto completo da Fase 3 (estratégia de scan, tabelas, observações críticas)
21. ✅ **Fase 4 — Investigar OpenAPI lint** (2026-06-27)
22. ✅ Analisar estado atual do projeto (sem OpenAPI tooling, sem YAML parser)
23. ✅ Pesquisar 3 ferramentas: Redocly CLI, Spectral CLI, vacuum
24. ✅ Redocly CLI: ~1.5M downloads/semana, MIT, Node >=22.12, lint + docs + bundle
25. ✅ Spectral CLI: ~1.28M downloads/semana, Apache-2.0, só lint
26. ✅ vacuum: Go binary (não-npm) ❌ + npm "vacuum" é template engine (não OpenAPI) ❌
27. ✅ **Decisão:** Redocly CLI (cobre Fase 4 lint + Fase 8 docs, configurable rules validam x-artificio-*)
28. ✅ Config redocly.yaml completa: 5 regras custom + built-in rules ajustadas
29. ✅ Script pnpm api:lint com telemetria desligada
30. ✅ DEB-055-09 (regras built-in desligadas) + DEB-055-10 (peso da dependência) registrados
31. ✅ tasks.md atualizado com contexto completo da Fase 4 (config, rules, exemplos, pipeline)
32. ✅ **Fase 5 — Investigar api:check comparador** (2026-06-27)
33. ✅ Algoritmo de comparação 3-way (inventário × OpenAPI × consumidores)
34. ✅ Tabela de 8 estados de drift (OK, CODE_ONLY, CONTRACT_ONLY, CONSUMER_ONLY, UNUSED_ROUTE, ORPHAN_SUSPECT, UNCERTAIN)
35. ✅ Normalização de paths (:param → placeholder, chaves, query strings)
36. ✅ Mecanismo allowlist para "rota nova" vs "rota legada"
37. ✅ Flag --generate-allowlist para bootstrap
38. ✅ Lógica de exit code (CODE_ONLY novo → 1, CONSUMER_ONLY novo high conf → 1)
39. ✅ Dependência js-yaml identificada (YAML parser, ~200KB)
40. ✅ Formato do relatório Markdown (api-drift.generated.md) definido
41. ✅ 12 tasks expandidas (T5.1–T5.12)
42. ✅ tasks.md atualizado com contexto completo (algoritmo, estados, código esqueleto, 10 observações críticas)
43. ✅ **Fase 6 — Investigar órfãs e duplicadas** (2026-06-27)
44. ✅ ORPHAN_SUSPECT: critérios refinados (scope public sem consumer = órfã, scope admin = UNUSED)
45. ✅ Algoritmo de detecção: reaproveita DriftEntry[] da Fase 5, filtro por scope/status
46. ✅ DUPLICATE_SUSPECT: algoritmo de scoring 4 fatores (method 40, token 40, owner 10, scope 10)
47. ✅ Normalização FORTE para duplicatas (remove :params, /v1/, trailing slash)
48. ✅ Thresholds: ≥80 HIGH, 70-79 MEDIUM, 60-69 LOW
49. ✅ Relatório combinado api-orphans.generated.md (órfãs + duplicatas)
50. ✅ Integração no api:check.ts (executa após Fase 5, não altera exit code)
51. ✅ Validação com dados reais: contact vs contact-click (score ~90, falso positivo)
52. ✅ DEB-055-11 registrado
53. ✅ 9 tasks expandidas (T6.1–T6.9)

---

## Checklist de fechamento

- [x] AGENTS.md lido completo (governança, gates, aprovação, git, regras pétreas)
- [x] spec.md, plan.md, tasks.md lidos e entendidos
- [x] T0 completo lido (project-state.md, context-capsule.md, decisions.md)
- [x] Estado real das APIs confirmado: Express 5 puro nos 4 apps
- [x] Rotas reais de accounts mapeadas (app.ts: 8 rotas + adminSecretsRoutes)
- [x] Rotas reais do glossário mapeadas (index.ts: 15 routers + health)
- [x] Rotas reais do links mapeadas (server.ts: rotas diretas + admin router)
- [x] Rotas reais do mesas mapeadas (server.ts: ~27 routers)
- [x] `docs/api/` confirmado inexistente
- [x] `scripts/api/` confirmado inexistente
- [x] `apps/mesas/MAPA_DE_API.md` lido (431 linhas, legado)
- [x] state.md atualizado para sessão atual
- [x] tasks.md atualizado com evidências da investigação (Fases 1 + 2 + 3 + 4)
- [x] debitos.md atualizado (DEB-055-07 a DEB-055-10 adicionados)
- [x] project-state.md atualizado
- [x] specs/backlog.md verificado
- [x] **Fase 2 investigada**: 8 padrões de rota, mapa de montagem, ferramenta AST
- [x] **Fase 3 investigada**: 6 padrões de consumo de API mapeados via 3 subagentes simultâneos
- [x] mesas-frontend: ~95 endpoints, 4 camadas de wrapper + feature APIs (discordSyncApi 28, inboxApi 8)
- [x] glossario-frontend: ~40 endpoints, 63 chamadas Axios, padrão limpo e centralizado
- [x] accounts/site/links/site-admin/packages: ~33 endpoints, 5 padrões distintos
- [x] Total consolidado: ~170 endpoints, ~230 chamadas em 6 subsistemas
- [x] 5-pass scan strategy documentada no tasks.md
- [x] **Fase 4 investigada**: OpenAPI lint com Redocly CLI
- [x] 3 ferramentas analisadas: Redocly CLI (✅), Spectral CLI (⚠️), vacuum (❌)
- [x] Config redocly.yaml completa: 5 regras custom x-artificio-* + built-in rules ajustadas
- [x] Script `pnpm api:lint` com telemetria desligada
- [x] DEB-055-09 + DEB-055-10 registrados
- [x] **Fase 5 investigada**: api:check comparador 3-way (allowlist, exit code, js-yaml)
- [x] **Fase 6 investigada**: órfãs e duplicadas
- [x] ORPHAN_SUSPECT: lógica refinada (admin/cron = UNUSED, public + sem consumer = órfã)
- [x] DUPLICATE_SUSPECT: scoring 4 fatores, normalização forte, thresholds
- [x] Integração no api:check.ts sem alterar exit code
- [x] Relatório api-orphans.generated.md (órfãs + duplicatas)
- [x] Validação com dados reais (contact vs contact-click = falso positivo conhecido)
- [x] DEB-055-11 registrado

---

## Arquivos modificados nesta sessão (documentação apenas)

1. `.opencode/artificio-flow/state.md` — atualizado com sessão spec 055 + Fases 1 a 6
2. `specs/055-api-governance-executavel/tasks.md` — Fases 0-6 com contexto completo (Fase 6: órfãs, duplicatas, scoring, thresholds, 9 tasks)
3. `specs/055-api-governance-executavel/debitos.md` — DEB-055-07 a DEB-055-11 adicionados
4. `sessoes/26-06-27_3_api-governance-055_investigacao-fase1.md` — esta sessão (Fases 1+2+3+4+5+6)
5. `.specify/memory/project-state.md` — entrada spec 055 atualizada

---

## Critério de conclusão

**Fase 1:** Tasks T0.1–T0.5 concluídas com evidência. Tasks T1.1–T1.8 com contexto completo.

**Fase 2:** Tasks T2.1–T2.11 com contexto completo: 8 padrões de rota, mapa de montagem, código AST.

**Fase 3:** Tasks T3.1–T3.12 com contexto completo: 6 padrões de consumo, tabelas por app, estratégia 5 passes.

**Fase 4:** Tasks T4.1–T4.8 com contexto completo:
- Redocly CLI recomendado vs Spectral CLI (alternativa) vs vacuum (rejeitado)
- Config `redocly.yaml` completa com 5 regras custom `x-artificio-*`
- 12 regras built-in desligadas para OpenAPI mínimos (justificadas)
- Script `pnpm api:lint` com telemetria desligada
- Exemplo de OpenAPI mínimo com metadados
- Pipeline de execução documentada
- DEB-055-09 e DEB-055-10 adicionados

**Fase 5:** Tasks T5.1–T5.12 com contexto completo:
- Algoritmo de comparação 3-way (inventário × OpenAPI × consumidores)
- 8 estados de drift: OK, CODE_ONLY, CONTRACT_ONLY, CONSUMER_ONLY, UNUSED_ROUTE, ORPHAN_SUSPECT, DUPLICATE_SUSPECT, UNCERTAIN
- Normalização de paths (:param → placeholder, chaves, query strings)
- Allowlist como mecanismo de "rota nova" vs "rota legada"
- Flag `--generate-allowlist` para bootstrap inicial
- Exit code: CODE_ONLY novo → 1, CONSUMER_ONLY novo high conf → 1
- Dependência js-yaml para parsear OpenAPI YAMLs
- Relatório Markdown (api-drift.generated.md) com tabelas por app e estados
- 10 observações críticas + esqueleto de código + tabela de teste

**Fase 6:** Tasks T6.1–T6.9 com contexto completo:
- ORPHAN_SUSPECT: critérios refinados (scope admin/cron/webhook = UNUSED, public sem consumer = órfã, CODE_ONLY sem classificação = órfã)
- DUPLICATE_SUSPECT: scoring 4 fatores (method 40, token 40, owner 10, scope 10)
- Normalização FORTE para duplicatas (remove :params, /v1/, trailing slash)
- Thresholds: ≥80 HIGH, 70-79 MEDIUM, 60-69 LOW
- Relatório combinado api-orphans.generated.md (órfãs + duplicatas)
- Integração no api:check.ts sem alterar exit code
- Validação com dados reais, falso positivo documentado (contact vs contact-click)
- DEB-055-11 (falso positivo duplicatas) registrado

## Atualizar project-state.md

Item: Spec 055 — Investigação Fases 1 a 6 concluída. Fase 6 (órfãs e duplicadas) investigada: ORPHAN_SUSPECT refina classificação por scope. DUPLICATE_SUSPECT com scoring 4 fatores (≥80 HIGH). Relatório api-orphans.generated.md integrado ao api:check.ts, sem afetar exit code. DEB-055-11 registrado. Tasks T6.1–T6.9 completas. Próximo: implementação.
