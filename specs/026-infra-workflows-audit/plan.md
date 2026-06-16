# Plano — 026 (Auditoria + direcao-alvo; SEM implementacao nesta fatia)

## Inventario verificado da esteira (2026-06-16)

14 workflows em `.github/workflows/`. Papel · trigger · deploy real · reuso:

| Arquivo | Papel | Deploy real | Observacao |
|---|---|---|---|
| `_deploy-module.yml` | Reusavel: CI + deploy parametrizado (snapshot, migration, health, smoke, rollback, lock VM) | `deploy=true` | **Fonte unica boa.** `mesas`/`glossario`/`site` usam. `accounts` NAO. |
| `_lint-shell.yml` | Reusavel: ShellCheck + actionlint + self-tests (migration lock, branch invariant) | nunca | Chamado por `pr-checks` E por cada `deploy-*` → duplicado. |
| `_enforce-migration-dir.yml` | Reusavel: bloqueia `.sql` fora de allowlist | nunca | OK. So em PR. |
| `pr-checks.yml` | Gate de PR: lint + migration-dir + exec-bit | nunca | OK. |
| `deploy-mesas.yml` | CI/deploy `mesas` via `_deploy-module` | dispatch=deploy ou push dev | Clone. `env`-by-ref inline (fix dispatch local, nao central). |
| `deploy-glossario.yml` | CI/deploy `glossario` via `_deploy-module` | dispatch=deploy (bootstrap-safe) | Clone. `reconcile_same_project_orphans:true`. |
| `deploy-site.yml` | CI/deploy `site` (beta-only) via `_deploy-module` | dispatch=deploy | Clone. DRAFT D049. |
| `deploy-accounts.yml` | **Snowflake** SSO: tarball+scp+compose manual | dispatch=deploy | Sem snapshot/rollback/migration framework. `BL-CDX-310`. |
| `promote-dev-to-main.yml` | PR standing dev→main | nunca | OK. |
| `promote-prod-fast-forward.yml` | Promocao ff `main ⊆ dev` (confirm token) | n/a (move ref) | OK. |
| `guard-main-ancestor.yml` | Alarme `main ⊆ dev` em push main (D042) | nunca | OK (compensa branch protection ausente). |
| `break-glass-deploy-prod.yml` | Emergencia rastreada (so `mesas`) via `_deploy-module` | confirm BREAK_GLASS | OK; so cobre `mesas`. |
| `docker-cleanup.yml` | Manutencao VM semanal; lock EXCLUSIVE vs deploys | nunca | OK. `permissions:{}`. |
| `mesas-auto-archive.yml` | Cron diario → endpoint publico `mesas` | nunca | **Falha:** Cloudflare 403. `BL-MESAS-AUTO-ARCHIVE-CF`. |

## Mapa de redundancia (custo de manutencao)

- **Clones de deploy** (`deploy-mesas`/`glossario`/`site`): bloco `on:` + `paths:` +
  `lint-shell` + `_deploy-module(with:...)`. Alterar o padrao de trigger ou path =
  **3 arquivos hoje, 7+ no futuro** (downloads/esferas/srd/links). Causa raiz do churn.
- **`env`-by-ref** replicado 3x. Cada copia e um lugar onde o bug `dispatch-prod`
  pode reaparecer. Deveria ser 1 funcao/derivacao central.
- **`_lint-shell` 2x** por push (PR gate + workflow de modulo). Defensavel, mas custa
  minutos; decidir se centraliza so no PR gate ou mantem.
- **`accounts` divergente**: tudo que `_deploy-module` ja resolve (snapshot, rollback,
  migration, lock, smoke padronizado) esta reimplementado/ausente em `accounts`.

## Mapa de seguranca

| Achado | Evidencia | Severidade | Direcao |
|---|---|---|---|
| `accounts` expoe `ports: "3000:3000"` | `BL-ACCOUNTS-PORT`, infra-map, spec 023 | media | `expose` interno na `artificio_net`; smoke SSO obrigatorio. |
| Actions sem pin de SHA | `_lint-shell.yml:21` `@master`; `:38` `@v1` | media | pinar em SHA + Dependabot/renovate para bump rastreado. |
| `secrets: inherit` amplo | `deploy-*.yml` | baixa | passar secrets explicitos ao reusavel. |
| Cron via endpoint publico WAF'd | `mesas-auto-archive.yml`, run `27607245699` | media | caminho interno seguro OU bypass WAF nomeado p/ rota cron; toca CF (aprovacao). |
| `permissions` por workflow | a maioria `contents:read`; cleanup `{}`; promote `write` | ok | manter minimo; auditar ao consolidar. |
| SSH key reescrita por job | `_deploy-module`, `deploy-accounts`, `docker-cleanup` | baixa | aceitavel; composite action poderia centralizar. |

## Direcao-alvo (decisao do mantenedor — registrada, NAO implementada)

1. **Manifesto + 1 workflow matrix.** Um `deploy.yml` (ou `_deploy-module` chamado por
   matrix) le um manifesto declarativo por modulo — JSON/YAML com `module`, `compose_file[_beta]`,
   `compose_project[_beta]`, `db_service[_beta]`, `db_name[_beta]`, `health_containers[_beta]`,
   `critical_routes[_beta]`, flags (`reconcile_same_project_orphans`, bootstrap-safe).
   Adicionar modulo = **1 entrada no manifesto**, sem novo arquivo. `env`-by-ref derivado
   em UM lugar.
2. **`accounts` → `_deploy-module`** (`BL-CDX-310`): reconciliar o snowflake a esteira
   reusavel + compose versionado correto. Maior ganho anti-churn; mexe em SSO →
   fatia isolada, SDD Completo, smoke `login/me/logout` + allowlist, aprovacao nominal.
3. **Hardening transversal:** `accounts` `ports`→`expose`; pin de actions; path-filters
   raiz; cron interno.

> Direcao-alvo = norte para as fatias futuras. Esta spec NAO escreve esses workflows.

## F10 — Limpeza de build cache no deploy (IMPLEMENTADO; revisado pos-inspecao VM)

**Conclusao verificada (read-only VM, 2026-06-16, Docker 29.5.3):**
- imagens NAO acumulam: 1 tagueada por repo (`tag=latest` movel), `dangling=0`;
- vilao real = **build cache: 26.6GB total, 20.9GB reclaimable <7d**, sobrevivia ao
  `builder prune --filter until=168h`;
- deploy builda com `--no-cache --pull` => cache de build **nunca reusado** => descartavel.

**Implementado:**
- `_deploy-module.yml` pos-deploy: `docker image prune -f` + **`docker builder prune -f`**
  (total, sem filtro de idade). BuildKit preserva cache de build ativo => deploy
  concorrente seguro. Zero perda de velocidade (cache nunca era lido).
- `docker-cleanup.yml` semanal: `builder prune` total tambem (rede de seguranca).
- **Cap "max 2 imagens/repo" DESCARTADO** (no-op no naming atual). Scripts
  `lib_image_cache.sh`/`prune_module_image_cache.sh`/`check_image_cache_policy.sh` e o passo
  de self-test no `_lint-shell.yml` foram REMOVIDOS — sem codigo morto.

---

### (Historico) design original do cap de imagem por repo — descartado

**Estado atual:** `_deploy-module.yml` (apos smoke) roda so `docker image prune -f`
(remove dangling) + `docker builder prune -f --filter "until=168h"`. NAO limita imagens
taguadas por repo. O cap por repo (manter 3) existe so no `docker-cleanup.yml` semanal
(`docker images <repo> --format '{{.ID}}' | tail -n +4 | xargs -r docker rmi -f`). Entre
duas limpezas semanais, cada recreate deixa uma imagem nova → cache de imagem acumula e
enche `/var/lib/docker` na VM Oracle (200GB).

**Alvo:** podar no proprio deploy, por modulo, mantendo **max 2 tagueadas** por
repositorio (teto de acumulo). Mais apertado que o semanal (3); coexistem.

**Achado da revisao (g1-governance-reviewer, 2026-06-16):** com tag movel (`compose build`
reusa `repo:latest`), a imagem anterior PERDE a tag e vira `<none>` (dangling); logo
`docker images <repo>` mostra ~1 tagueada e o cap-por-repo e quase no-op nesse caso. O
acumulo real = dangling (retag) + cache de build, ja podados por `docker image prune -f` +
`builder prune` no fim do deploy. Portanto o cap NAO e mecanismo de rollback (rollback e por
snapshot de DB) e NAO promete "1 fallback". Valor do F10: (a) TETO garantido p/ repos com tag
estavel/unica (evita acumulo se algum dia tag por SHA/run-id), (b) verificacao/observabilidade
por deploy (antes->depois no summary, o que o mantenedor pediu). Validar naming real de imagem
na VM no 1o dispatch para confirmar se o cap age ou e teto preventivo.

**Onde engata:** dentro do script remoto de `_deploy-module.yml`, **depois** do smoke
verde e do `rm -f "$snapshot_file"` (so poda apos sucesso confirmado; falha cai no
rollback que precisa da imagem anterior). Substitui/complementa o `docker image prune -f`
final por uma poda por-repo dos containers do modulo.

**Ferramenta proposta:** `scripts/deploy/prune_module_image_cache.sh <max=2> <repo...>`,
chamada com os repos das imagens dos containers do modulo (derivados de
`HEALTH_CONTAINERS` + `DB_SERVICE` via `docker inspect --format '{{.Config.Image}}'` →
repo sem tag). Logica nuclear (mesma do semanal, parametrizada):

```sh
# por repo, mantem os N mais novos (docker images lista por criacao decrescente),
# remove o resto. tail -n +$((N+1)) p/ N=2 => tail -n +3.
docker images "$repo" --format '{{.ID}}' | tail -n +3 | xargs -r docker rmi -f 2>/dev/null || true
```

**Guardas (pétreas):**
- nunca remover imagem do container atual (e a mais nova → preservada pelo `tail`);
- nunca tocar volume nem rede `artificio_net`;
- `rmi -f` tolerante a "image is being used" (`|| true`); imagem em uso por OUTRO
  container nao e removida pelo daemon;
- so roda sob o lock VM compartilhado ja existente (FD 8) — nunca durante a manutencao
  exclusiva.

**Verificacao/observabilidade (o "fazer a verificacao" pedido):**
- antes/depois: `docker images "$repo" --format '{{.ID}}'` contado por repo;
- emitir `image_cache_<repo>=<antes>-><depois>` capturado pelo `tee` e exposto no
  `GITHUB_STEP_SUMMARY` (step "Resumo do deploy", R4), junto de `healthy_`/`smoke_`;
- opcional CI: `scripts/ci/check_image_cache_policy.sh` que falha se algum repo de modulo
  ficar com >2 apos a poda (auto-teste local, estilo `test_migration_lock.sh`).

**Alinhar semanal:** decidir se `docker-cleanup.yml` baixa de 3→2 para casar com o cap
de deploy, ou mantem 3 como folga (recomendado manter 3 no semanal: rede de seguranca
maior; deploy mantem 2 no caminho quente). Registrar a escolha na fatia.

## Arquivos afetados (por fatia futura — nenhum tocado nesta fatia)

- Consolidacao matrix: `.github/workflows/deploy-*.yml` (substituidos/reduzidos), novo
  manifesto (ex.: `.github/deploy-manifest.yml` ou `infra/modules.json`), `_deploy-module.yml`.
- Accounts: `deploy-accounts.yml`, `apps/accounts/docker-compose.prod.yml` (versionar),
  `apps/accounts/docker-compose.yml`.
- Hardening: `_lint-shell.yml` (pins), `mesas-auto-archive.yml`, path-filters em deploys.
- F10 build cache (implementado): `_deploy-module.yml` + `docker-cleanup.yml`
  (`builder prune` total).

## Contratos/interfaces tocados (em fatias futuras)

- **SSO/accounts:** migracao da esteira toca o servico de login — contrato sagrado.
- **Ingress (spec 023):** mover cron toca topologia Cloudflare Tunnel → app.
- **Branch invariant (D041/D042):** consolidacao nao pode quebrar `main ⊆ dev` nem o
  fluxo de promocao ff.

## Impacto em consumidores

- Todo `apps/*` publico depende da esteira para subir. Consolidacao mal feita = deploy
  quebrado em multiplos modulos de uma vez → fatiar e validar 1 modulo por vez.

## Rollback

- Auditoria (esta fatia): rollback = apagar `specs/026-*` e a linha de backlog/sessao.
  Zero efeito em runtime/infra.
- Fatias futuras: cada uma define seu rollback (snapshot DB ja coberto pelo
  `_deploy-module`; para workflow, reverter o arquivo e re-disparar dispatch verde).

## Validacao (como provo que a auditoria esta correta)

- Inventario conferido contra `ls .github/workflows/` e leitura de cada arquivo (feito).
- Cada achado tem arquivo:linha / run ID / item de backlog (na tabela acima).
- Roadmap (tasks.md) mapeia 1:1 os `BL-*`/`D-*` de infra do `specs/backlog.md`.
- Busca final: nenhum diff em `.github/workflows/`.
