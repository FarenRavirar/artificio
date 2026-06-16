# Sessao 26-06-16_10 — Auditoria da esteira de workflows (CI/CD)

- **Data:** 2026-06-16
- **Escopo:** infra / CI-CD / `.github/workflows/*`
- **Gate:** D (esteira por modulo)
- **Spec:** `specs/026-infra-workflows-audit/`
- **Autorizacao:** mantenedor pediu **levantamento/investigacao sem chute**; direcao-alvo
  escolhida via AskUserQuestion (accounts→`_deploy-module`; manifesto+matrix). SEM commit/
  push/deploy. SEM editar workflow.

## Objetivo

Investigar a bagunça de CI/CD ("sempre aplicar fix") e produzir spec de auditoria +
roadmap, sem implementar.

## T0/T1 lidos

T0: `project-state.md`, `context-capsule.md` (decisions.md ja absorvido via memoria).
T1 infra: `AGENTS.md` (Git/Branch/Deploy, Aprovacao), `deploy-flow.md`, `deploy-runbook.md`,
`specs/backlog.md`, e os 14 workflows + `scripts/deploy/*` (listados).

## Achados (evidencia em `specs/026-*/plan.md`)

- 3 deploy-*.yml clones; `env`-by-ref replicado (bug `BL-DEP-MESAS-DISPATCH-ENV`).
- `accounts` snowflake fora do `_deploy-module` (`BL-CDX-310`); compose shim.
- `_lint-shell` 2x por push.
- path-filters nao cobrem manifests raiz (`BL-DEP-PATHFILTERS`).
- seguranca: `accounts ports:3000:3000` (`BL-ACCOUNTS-PORT`), actions `@master`/`@v1` sem
  pin, `secrets:inherit`, cron WAF 403 (`BL-MESAS-AUTO-ARCHIVE-CF`).
- updates de app sem trilho (`D-DEP1`/`D-DEP2`/Express5).

## Executado

- Criados `specs/026-infra-workflows-audit/{spec,plan,tasks}.md` (auditoria + roadmap F1-F9).
- T1-T4 da spec marcados feitos (inventario/redundancia/seguranca/direcao-alvo).
- Backlog: aberta linha `BL-INFRA-WORKFLOWS-026` (guarda-chuva); itens de infra existentes
  mapeados as fatias F1-F9.
- Pedido extra do mantenedor: cap de cache de imagem por modulo no proprio deploy (max 2,
  poda excedente na hora). Adicionado como requisito 6a/3a na spec, design em `plan.md`,
  fatia **F10** + `BL-INFRA-CACHE-CAP-F10`. Verificacao antes/depois no summary.

## F10 IMPLEMENTADO LOCAL (autorizado: "REALIZAR E IMPLEMENTAR com opcional, manter recomendado")

- Novos: `scripts/deploy/lib_image_cache.sh`, `scripts/deploy/prune_module_image_cache.sh`,
  `scripts/ci/check_image_cache_policy.sh`.
- Editados: `.github/workflows/_deploy-module.yml` (chamada pos-smoke + grep do summary),
  `.github/workflows/_lint-shell.yml` (passo do self-test).
- Recomendado mantido: `docker-cleanup.yml` segue cap 3 (folga); deploy cap 2.
- Validacao local: `bash scripts/ci/check_image_cache_policy.sh` => 6/6 ok
  (`image_cache_policy_selftest=ok`); guards de arg (max invalido rc2; docker ausente rc1) OK.
  Shellcheck roda no CI `_lint-shell` (ausente local).
- **NAO feito (precisa aprovacao nominal):** commit, push, deploy/dispatch. Prova real de
  disco/healthy/rollback fica para o 1o dispatch de modulo autorizado.

## Segunda revisao (g1-governance-reviewer, opus) — aplicada

- Achado medio: com tag movel do compose, imagem anterior vira `<none>` (dangling) e
  `docker image prune -f` (que ja roda) a remove; o cap-por-repo e quase no-op nesse caso e
  o "fallback de rollback" prometido nao existe (rollback e por snapshot de DB). F10 vale
  como TETO de tags + observabilidade pedida, nao como rollback.
- Nits aplicados: chamada do prune agora emite `::warning::` em rc!=0 (nao vira no-op
  silencioso); wording corrigido em `_deploy-module.yml`, `prune_module_image_cache.sh`,
  `spec.md`, `plan.md` (teto, nao fallback). Sem achado de segredo/permissions/volume/rede;
  logica pura confirmada correta (self-test 6/6).
- Pendencia registrada p/ 1o dispatch: confirmar naming real de imagem na VM (tag movel vs
  unica) p/ saber se o cap age ou e teto preventivo.

## Inspecao read-only na VM (autorizada) + PIVO de F10 (2026-06-16)

Mantenedor autorizou `ssh faren` read-only. `docker images`/`system df` na VM (Docker 29.5.3):
- todo repo `glossario*/mesas*/accounts/site` = 1 imagem tagueada (`tag=latest` movel);
- `dangling=0` (image prune ja zera);
- **build cache = 26.6GB total, 20.9GB reclaimable <7d** (sobrevivia ao `until=168h`);
- deploy builda `--no-cache --pull` => cache de build nunca reusado.

Conclusao: o cap de imagem (max 2/repo) era **no-op**; o "cache que so acumula" e o
**build cache**. Decisao do mantenedor (AskUserQuestion): (1) `builder prune -f` total
pos-deploy + alinhar semanal; (2) **remover** o F10 de imagem (sem codigo morto).

Aplicado:
- `_deploy-module.yml`: bloco de imagem removido; pos-deploy agora `docker image prune -f`
  + `docker builder prune -f` (total).
- `docker-cleanup.yml`: `builder prune` total (era `until=168h`).
- `_lint-shell.yml`: passo de self-test removido.
- Removidos: `scripts/deploy/lib_image_cache.sh`, `scripts/deploy/prune_module_image_cache.sh`,
  `scripts/ci/check_image_cache_policy.sh`.
- Docs spec 026 (spec/plan/tasks) + backlog reescritos p/ build cache.

Insight registrado (regra bug-registry): cap de imagem sem inspecao real teria entrado
como no-op; inspecao read-only na VM e barata e deveria preceder fix de infra "no chute".

## Furo do prune em accounts + governanca read-only (2026-06-16)

- **Furo fechado:** `accounts` (snowflake, nao usa `_deploy-module`) builda `--no-cache
  accounts-api` mas NAO podava cache => acumulava ate o semanal. Adicionado `docker image
  prune -f` + `docker builder prune -f` ao fim do deploy em `deploy-accounts.yml`
  (provisorio ate F5/BL-CDX-310 migrar accounts). Agora TODO caminho de deploy poda cache
  morto a cada deploy: `_deploy-module` (mesas/glossario/site) + accounts + semanal.
- **Governanca:** mantenedor pediu read-only na VM sempre permitido. `AGENTS.md` (secao
  Aprovacao Obrigatoria + Acesso a VM) e `context-capsule.md` rule 2 reescritos: read-only
  via `ssh faren` (`docker ps|images|system df|logs|inspect`, `psql SELECT`, `pg_dump`,
  `git status|log|diff`) e SEMPRE permitido, sem aprovacao; so escrita exige nominal. Nota:
  bloqueio do harness e separado (classificador), tratado como falso-bloqueio a escalar; nao
  criar allow amplo `Bash(ssh faren:*)` no settings (liberaria escrita tambem — inseguro).

## Pendente / proximo passo

- T5/T-final: confirmar reconciliacao do backlog (feito nesta sessao) + atualizar
  `project-state.md`.
- Implementacao = fatias F1-F9, cada uma com aprovacao nominal propria. Nada executado.

## Backlog

- Atualizado: nova linha `BL-INFRA-WORKFLOWS-026` em P0; roadmap referencia os debitos de
  infra existentes sem duplicar. Nenhum debito de infra ficou orfao.
