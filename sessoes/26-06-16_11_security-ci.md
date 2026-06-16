# Sessão 2026-06-16 #11 — Segurança/qualidade/revisão automática gratuita (spec 026 F-SEC)

**Objetivo:** configurar revisão automática + checks gratuitos no repo público, só GitHub Actions nativo + OSS sem token/cadastro/App externo. Sem tocar deploy/prod/VM/DNS/banco.

**Gate:** Fase 3. **Escopo:** `.github/` (infra CI). SDD: fatia infra (F-SEC do guarda-chuva `BL-INFRA-WORKFLOWS-026`).

## Investigação (estado real)
- Monorepo pnpm@10.12.1 + Turborepo; apps {accounts,glossario,mesas,site,site-admin}, packages {analytics,auth,config,content,ui}.
- Langs: TS 292, TSX 178, SQL 89, MJS 11, JS 6, Astro 15, Py 3, Shell 17.
- CI existente: `pr-checks.yml` (shellcheck/actionlint/migration-dir/exec-bit). CI build/test só dentro de `_deploy-module.yml`. **Sem CI holístico de PR. Sem security scanning.**
- Dependabot só github-actions. **SEM LICENSE** (público ≠ open source).

## Implementado (PR #40, branch `chore/026-security-ci`)
- `.github/dependabot.yml`: +ecosystem npm (root + globs apps/packages, grupos dev/prod).
- `ci.yml`: lint+build+test monorepo (postgres + env dummy não-secreto), PR+push main/dev.
- `codeql.yml`: CodeQL js/ts, build-mode none.
- `dependency-review.yml`: PR.
- `osv-scanner.yml`: reusável oficial, SARIF.
- `secret-scan.yml`: TruffleHog OSS.
- `scorecard.yml`: OpenSSF Scorecard, `publish_results=false`.
- `semgrep.yml`: Semgrep OSS `--config auto` (sem Cloud/token).
- Terceiros pinados por SHA (F2). Permissão mínima, zero secret/token externo, sem deploy.

## Commits
- `77b62f0` chore(ci): add native security/quality scanning + monorepo CI.
- `3854e5f` fix(ci): semgrep boota em Python 3.12 (setuptools) + guard SARIF.

## Validação (checks PR #40)
- actionlint ✅, shellcheck ✅, migration-dir ✅, exec-bit ✅, TruffleHog ✅.
- **Dependency Review ❌** — não é workflow: `Dependency graph` DESABILITADO no repo. Fix = Settings (manual).
- **Semgrep ❌ 1ª rodada** — `ModuleNotFoundError: pkg_resources` (Python 3.12 sem setuptools). Corrigido em `3854e5f`.
- CodeQL / ci / OSV: aguardando (lentos).

## Observação fora de escopo
Repo já tem integrações externas pré-instaladas (NÃO adicionadas por mim, fora do escopo desta etapa): **CodeRabbit, Snyk, Amazon Q Developer, semgrep-cloud-platform**. Disparam nos checks. Mantenedor pode desativar via Settings/conta.

## Settings manuais pendentes (informados, não simulados)
1. `Settings → Code security and analysis`: habilitar **Dependency graph** (dependency-review exige) + **Secret scanning** + **Push protection**.
2. NÃO ativar CodeQL **Default setup** (colide com `codeql.yml` advanced).
3. Branch protection / required checks em `main`/`dev` após 1ª rodada verde.

## Próxima etapa (fora desta — exige conta/token)
Amazon Q, SonarCloud, Snyk, Codacy, CodeRabbit, Sourcery, Semgrep Cloud, Scorecard `publish_results`.

## Fechamento checks (commit `e2bbf57`, 2026-06-16)
- Único vermelho restante era **TruffleHog OSS** (exit 125 `docker: manifest unknown`): o action puxa `ghcr.io/trufflesecurity/trufflehog:${VERSION}` e a TAG da imagem **não** tem prefixo `v`. Fix: `version: v3.95.5` → `3.95.5` em `secret-scan.yml`.
- Melhorias do mesmo commit (sem mudar comportamento de scan): SHA-pin também de `actions/*` (checkout/setup-node/setup-python/cache) nos 6 workflows; doc das creds dummy do service postgres efêmero; `|| true` → `continue-on-error: true` no Semgrep.
- Resultado: **17 SUCCESS + 1 SKIPPED (gate de deploy), 0 fail. `mergeStateStatus=CLEAN`.**

## Veredicto das revisões automáticas (TAREFA 2 — registrado em doc, NÃO respondido no PR)
Regra pétrea nova em `AGENTS.md` (Git/Branch/Deploy): **agente nunca responde/comenta/resolve/dispara bots revisores no PR**; todo veredicto vive na documentação. Revisões abaixo eram contra `77b62f0` (pré-fixes):
- **amazon-q #1 — `actions/*` não-pinadas violam F2:** parcialmente improcedente (F2 = "terceiros"; `actions/*` é 1st-party GitHub e todos os terceiros reais já estavam SHA-pinados). **Aplicado mesmo assim** como defesa-em-profundidade (eleva Pinned-Dependencies do Scorecard).
- **amazon-q #2 — creds `admin:admin` hardcoded (ci.yml):** improcedente (service container efêmero, sem rede externa, banco descartado). **Documentado** com comentário no workflow para não re-sinalizar.
- **amazon-q #3 — Semgrep `|| true` mascara achados:** procede em parte. **Aplicado** `continue-on-error: true` (mascara só achados, não erro de infra/install).
- **codex #4 — pinar imagem runtime TruffleHog:** já resolvido em `a14582c` + fix da tag hoje.
- **codex #5 — Semgrep `--config auto` envia métricas:** já resolvido em `a14582c` (`--metrics=off`); fetch de regras no registry é decisão consciente documentada.
- **Sem ações cegas.** Nenhum thread respondido no PR (regra nova).

## Backlog
`BL-INFRA-SEC-SCAN` aberto (em-revisão PR #40). Governança PR-obrigatório (D072) aplicada: fatia foi por branch+PR, não commit direto em dev.
