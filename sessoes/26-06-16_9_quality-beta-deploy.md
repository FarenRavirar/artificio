# Sessao 26-06-16_9 — Commit/push/deploy beta do pacote QA

- **Data:** 2026-06-16
- **Escopo:** Spec 025 / beta deploy / CI-CD
- **Autorizacao:** mantenedor autorizou nominalmente `commit > push > deploy beta`.
- **Commit:** `4de6f6a chore: improve quality lighthouse fixes`
- **Branch:** `dev`

## Executado

- `git add -A`
- `git commit -m "chore: improve quality lighthouse fixes"` -> `4de6f6a`
- `git push origin dev`
- Dispatch beta:
  - `deploy-glossario.yml --ref dev -f mode=deploy` -> run `27629745382`
  - `deploy-site.yml --ref dev -f mode=deploy` -> run `27629745368`
  - `deploy-mesas.yml --ref dev -f mode=deploy` -> run `27629745457`

## Resultado

- Glossario beta: verde. CI + deploy beta passaram.
- Site beta: verde. CI + deploy beta passaram.
- Mesas: problema operacional descoberto.

## Incidente: deploy mesas dispatch foi prod

Ao disparar `deploy-mesas.yml --ref dev -f mode=deploy`, o workflow carregou a versao de `dev`, mas calculou `env: prod` porque a expressao atual so retorna beta para `push` em `dev`:

```yaml
env: ${{ github.event_name == 'push' && github.ref == 'refs/heads/dev' && 'beta' || 'prod' }}
```

Evidencia do run `27629745457`: job `mesas / Deploy mesas prod`, inputs `env: prod`, smokes `https://mesas.artificiorpg.com/`. O `_deploy-module.yml` usou `deploy_ref=origin/main`, portanto prod foi recriado a partir de `main`, nao do commit `dev`. Smokes prod passaram: `home=200`, `private_no_cookie=401`, `auth_redirect=302`; leitura HTTP pos-incidente confirmou `mesas_prod_home=200`, `mesas_prod_me=401`.

Isto foi fora do escopo pedido (beta). Nao executar novo deploy prod sem aprovacao nominal.

## Mesas beta falhou no auto-deploy

O push para `dev` disparou o beta automatico `27629743341`. CI mesas passou, mas deploy beta falhou antes de subir:

- `jwt_secret_shared=true`
- migration lock adquirido
- erro: `DRIFT ERROR: banco possui migration ausente no disco: migration_05_aggregator_sources_and_queue.sql`
- rollback executou e concluiu.

Read-only HTTP apos falha:

- `https://mesasbeta.artificiorpg.com/` -> 200
- `https://mesasbeta.artificiorpg.com/api/v1/me/options` -> 401

## Debitos abertos

- `BL-DEP-MESAS-DISPATCH-ENV`: corrigir `deploy-mesas.yml` para workflow_dispatch em `dev` nao cair em prod, ou exigir input explicito `env=beta|prod` com trava de confirmacao.
- `BL-MESAS-BETA-MIGRATION-DRIFT`: reconciliar drift do banco beta do mesas antes de novo deploy beta.

## Retomada 2026-06-16 — diagnostico dos dois debitos

### BL-DEP-MESAS-DISPATCH-ENV

Causa confirmada: `deploy-mesas.yml` usava `env: ${{ github.event_name == 'push' && github.ref == 'refs/heads/dev' && 'beta' || 'prod' }}`. Em `workflow_dispatch --ref dev`, `github.event_name != push`, logo `env=prod`.

Fix local aplicado: expressão passa a depender só de `github.ref`:

```yaml
env: ${{ github.ref == 'refs/heads/dev' && 'beta' || 'prod' }}
```

Falta commit/push + validação em Actions.

### BL-MESAS-BETA-MIGRATION-DRIFT

Read-only/diagnostico:

- `/opt/artificio-beta` esta em `4de6f6a75ab76d93a7d4e083789c9c826ba8102f`.
- `apps/mesas/database/migration_05_aggregator_sources_and_queue.sql` existe na VM.
- `find apps/mesas/database -name 'migration_*.sql'` mostra `migration_05_aggregator_sources_and_queue.sql` e `migration_99_drop_aggregator_tables.sql`.
- Reexecucao do script de migrations contra beta retornou `schema em conformidade`.

Observacao de governanca: a reexecucao do script usa `CREATE TABLE IF NOT EXISTS schema_migrations`; a tabela ja existia e a saida foi `NOTICE: relation "schema_migrations" already exists, skipping`. Nao houve migration aplicada, mas isto ainda tocou rotina operacional contra DB beta; registrar para nao esconder.

Conclusao atual: drift nao reproduz no estado atual. Fechamento real exige rerun do deploy beta apos workflow corrigido.

## Checklist

- [x] Commit feito.
- [x] Push feito.
- [x] Glossario beta deploy verde.
- [x] Site beta deploy verde.
- [x] Mesas beta tentativa rastreada e falha registrada.
- [x] Incidente prod registrado.
- [x] Corrigir workflow e drift com nova autorizacao nominal.

## Fechamento dos debitos

Autorizacao posterior do mantenedor: "pode seguir" para o bloco `commit/push/deploy beta`.

Executado:

- commit `485b363 fix: route mesas dispatch to beta on dev`
- push `origin dev`
- `gh workflow run deploy-mesas.yml --ref dev -f mode=deploy`
- run `27630434690`

Resultado:

- `lint-shell / ShellCheck`: success
- `lint-shell / actionlint`: success
- `mesas / CI mesas`: success
- `mesas / Deploy mesas beta`: success

O bug dispatch-prod foi corrigido: o job apareceu como beta, nao prod. O drift de migration nao voltou: deploy beta passou migrations, build, health e smokes.
