# Sessão 2026-06-16 #13 — F4 manifesto + workflow matrix (spec 026)

**Objetivo:** consolidar os 3 clones `deploy-{mesas,glossario,site}.yml` (~95% idênticos) num manifesto declarativo + 1 workflow matrix. PR próprio (#44, branch `infra/026-f4-deploy-manifest`, base `dev`). SDD Completo.

## 3 decisões do mantenedor (registradas antes de editar)
1. **F4 absorve F11** (gating `detect` nasce dentro do `deploy.yml`, um PR só).
2. **Deletar os 3 clones** na validação (senão triggers colidem = deploy duplo); rollback = git revert + re-dispatch.
3. **Aceitar `on:paths` estático → `detect` dinâmico** (amplia CI por módulo; cache mitiga).

## Implementado
- `.github/deploy-manifest.json` — 1 entrada/módulo; diferenças = DADO (env_override, compose, db, health, critical_routes, reconcile, auto_deploy_on_push, push_branches, deploy_paths).
- `.github/workflows/deploy.yml` — `lint-shell` + `build-matrix` (carrega manifesto + decide deploy por módulo, absorve `detect` do F11 via git diff vs `deploy_paths`) → `deploy` matrix (`fromJSON` → `uses: ./_deploy-module.yml`, `with:` 100% do manifesto, `toJSON(matrix.*)` p/ os campos string-JSON).
- `_deploy-module.yml` intocado. `accounts` fora (snowflake=F5). `break-glass-deploy-prod.yml` mantido.

## Validação local (dry-run da lógica detect, 7 cenários)
push apps/mesas → só mesas; push infra → ninguém; site/glossario bootstrap-safe (auto_deploy=false); push main → sem auto-deploy prod; PR/dispatch-ci → CI sem deploy; dispatch-deploy → só o módulo escolhido. JSON+YAML OK.

## CI PR #44 (commit 6691b6d)
**19 SUCCESS + 4 SKIPPED, 0 fail, mergeStateStatus=CLEAN.** Bloqueante GHA CONFIRMADO em runtime: `fromJSON` matrix + `uses:` reusável + `toJSON(matrix.*)` + coerção boolean funcionam (matrix expandiu nos 3 jobs reusáveis; deploy-na-VM SKIPPED por deploy=false em PR).

## Veredicto revisão automática amazon-q (5 comentários — NÃO respondidos no PR, regra pétrea)
1. `[ "$MODULE_INPUT" != "$m" ]` quebraria vazio: **mecanismo errado** (var quoted = sem syntax error; short-circuit `EVENT=workflow_dispatch`; `set -u` ok pois env set-but-empty). **Aplicado `${MODULE_INPUT:-}`** como hardening grátis.
2. invalid BEFORE → deploy=true deployaria prod: **improcedente** — `auto_deploy_on_push` só mesas, `push_branches=["dev"]` ⇒ beta, nunca prod; semântica deliberada do F11 absorvido. **Descartado.**
3. `on:push:[main]` auto-deploya prod: **improcedente** — `detect` gateia por `push_branches=["dev"]`; sim provou push main → tudo false; `on:push:main` só roda CI (paridade clones). **Descartado.**
4. jq falha silenciosa: **procede parcial** — `.modules` vazio = no-op silencioso (jq malformado já quebra por set -e). **Aplicado guard `[ -z "$modules" ] && exit 1`.**
5. `count != '0'` string vs numeric: ambos funcionam (GHA coage). **Aplicado `!= 0`** (idiomático).

Sem ação cega. Fix commit re-valida YAML+sim (zero regressão).

## Próximo
Validação dispatch BETA módulo-a-módulo (glossario→mesas→site) por aprovação nominal, NADA prod. Depois merge #44→dev autorizado.
