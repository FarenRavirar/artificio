# PR #72 — Spec de Remediação (Fase 5c · GitHub Actions + pnpm 11)

**PR:** https://github.com/FarenRavirar/artificio/pull/72
**Branch:** `chore/033-f5-github-pnpm` → `dev`
**Spec-mãe:** `specs/033-infra-toolchain-update/` (esta remediação é sub-artefato; não cria número de spec novo)
**Modo:** SDD Completo (toca CI/CD, deploy, pnpm, infra — gatilho pétreo AGENTS.md §Modos)
**Data abertura:** 2026-06-19
**Estado do PR no momento da abertura:** `MERGEABLE` mas com 5 checks `FAILURE` (todos a mesma raiz) + 13 review-comments de bots (maioria já resolvida em commits anteriores).

> **Sem caminho fácil:** o blocker não se resolve só "commitando o arquivo já editado". A causa é a política `strictDepBuilds` do pnpm 11; o fix correto inclui (a) destravar a build legítima, (b) provar a paridade com o lockfile e (c) instalar guarda contra recorrência. Cada item abaixo tem causa-raiz + fix persistente + critério de aceite executável.

---

## 1. Triagem dos achados (evidência verificada no tree, não no chute)

| # | Origem | Achado | Status verificado | Ação |
|---|---|---|---|---|
| F1 | CI `lint+build+test` + 4× `CI <módulo>` (deploy) | `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: esbuild@0.27.7, esbuild@0.28.0` → exit 1 | **ABERTO — BLOQUEANTE.** Fix existe só no working copy (`pnpm-workspace.yaml` `M`, não commitado) | **R1** |
| F2 | amazon-q (7 comments) | Dockerfiles usando `npm install -g pnpm` em vez de corepack | **RESOLVIDO** — `grep` confirma todos os Dockerfiles em `apps/*` usam `corepack prepare pnpm@11.8.0 --activate` (commit `1523f1d`) | Registrar resolvido; nenhum código |
| F3 | coderabbit (Critical) | Pin SHA `actions/checkout@v7.0.0` divergente | **RESOLVIDO** — tree tem `9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0` (= SHA oficial v7.0.0, confirmado via `gh api`) em todos os 10 workflows (commit `0b09122`) | Registrar resolvido |
| F4 | chatgpt-codex (P2) | `allowBuilds: "*": true` reabre `strictDepBuilds` p/ todo o workspace | **RESOLVIDO** — committed usa mapa enumerado (`sharp`, `bcrypt`), sem wildcard (commit `0b09122`) | F4 reforça R1 (manter enumerado) |
| F5 | coderabbit (Minor) | `tasks.md` T41 usa placeholder `D0NN` | **ABERTO — doc** | **R2** |
| F6 | coderabbit (Minor) | `tasks.md` T44 cita `pnpm 10.12.x` (real = 11.8.0) | **ABERTO — doc** | **R3** |
| F7 | coderabbit (Critical) | `specs/034.../plan.md` API `readRows`/`writeXlsxFile` imprecisa p/ read/write-excel-file v9.x/v4.x | **ABERTO — doc de spec futura** | **R4** |
| F8 | escopo | PR #72 (Fase 5c infra) carrega arquivos de `specs/034-glossario-xlsx-replace/*` (spec não-iniciada) | **ABERTO — higiene de escopo** | **R5 — RESOLVIDO: opção A (manter), mantenedor 2026-06-19** |
| F9 | coderabbit + zizmor `artipacked` (Major, 5 comments) | `actions/checkout` persiste `GITHUB_TOKEN` no git-config por default; falta `persist-credentials: false` | **ABERTO — segurança, sistêmico (não só os 5 flagados)** | **R6** |
| F10 | workflow `deploy` (4 jobs `CI <módulo>` FAILURE + 4 `Deploy …` SKIPPED) | Falha dos deploys | **ABERTO — mesma raiz de F1; sem bug independente** | **R7** |

> **Bots no PR:** AGENTS.md trava pétrea — o agente **não responde/reage/resolve thread** de revisor externo. Todo veredicto vive aqui + backlog + project-state. Fixes que procedem entram por commit normal.

---

## 2. Remediações

### R1 — Destravar build do esbuild no pnpm 11 (BLOQUEANTE) · causa-raiz

**Causa-raiz:** pnpm 11 tornou `strictDepBuilds` default `true`. Toda dependência (incl. transitiva) com lifecycle build-script que **não** esteja em `allowBuilds` faz `pnpm install --frozen-lockfile` sair com exit 1. `esbuild@0.27.7` e `0.28.0` entram transitivamente (vite/vitest/turbo) e têm script de install (baixa o binário nativo). O mapa committed lista só `sharp` e `bcrypt` → esbuild barra → CI e os 4 `CI <módulo>` quebram na mesma linha.

**Por que não é "caminho fácil":** adicionar `esbuild: true` resolve o sintoma, mas:
- O mesmo erro vai voltar a cada nova dep nativa (next, @swc, lightningcss, etc.). Precisa de **guarda** (R1c).
- Manter enumerado (não `"*": true`) honra F4/codex — segurança supply-chain do `strictDepBuilds` permanece ativa.

**Fix:**

**R1a** — `pnpm-workspace.yaml`: confirmar bloco `allowBuilds` enumerado com `esbuild: true` (já no working copy):
```yaml
allowBuilds:
  sharp: true
  bcrypt: true
  esbuild: true
```

**R1b** — Provar paridade local antes de qualquer commit (reproduzir o ambiente CI):
```bash
pnpm install --frozen-lockfile   # deve terminar SEM ERR_PNPM_IGNORED_BUILDS, exit 0
```
- Se aparecer outro pacote ignorado → adicionar ao mapa enumerado (nunca `"*": true`) e repetir.

**R1c** — Guarda anti-recorrência (persistência): o `[ERR_PNPM_IGNORED_BUILDS]` já é fatal no CI por causa do `--frozen-lockfile` + `strictDepBuilds`. Para detectar **antes** do push, documentar em `docs/agents/infra-map.md` (seção pnpm) a regra:
> "Dep nova com build-script → `pnpm install` local acusa `Ignored build scripts`. Adicionar o pacote a `allowBuilds` (enumerado, nunca `"*": true`) e revalidar com `--frozen-lockfile`. Decisão D080."
- Registrar **D080** em `decisions.md`: *"pnpm 11 `strictDepBuilds=true`; `allowBuilds` enumerado por pacote (sem wildcard) é a política do monorepo. Builds nativas conhecidas: sharp, bcrypt, esbuild."*

**Aceite R1:**
- `pnpm install --frozen-lockfile` local → exit 0, sem `Ignored build scripts`.
- `pnpm-workspace.yaml` sem `"*": true`.
- Após push: os 5 checks (`lint+build+test`, `CI mesas/glossario/site/accounts`) verdes na run do PR.
- D080 registrada; nota em `infra-map.md`.

---

### R2 — `tasks.md` T41: substituir `D0NN` por IDs reais

**Causa-raiz:** placeholder não-executável; próximo número livre em `decisions.md` = **D080** (último = D079).
Atribuir, em ordem:
- **D080** — pnpm 11 `strictDepBuilds`/`allowBuilds` enumerado (criada por R1; T41 referencia se couber, ou usa-se a seguinte sequência p/ as 3 decisões de toolchain originais).
- As 3 decisões originais de T41 (Node 24 LTS canônico; imagens base com tag explícita; toolchain unificado versão-única) recebem **D081, D082, D083** respectivamente.

> Nota: R1 cria D080 (pnpm). Renumerar as 3 de T41 para D081/D082/D083 evita colisão. Ajustar T41 com esses IDs concretos.

**Aceite:** `grep "D0NN" specs/033-infra-toolchain-update/tasks.md` → 0 resultados; IDs D081–D083 batem com os títulos.

---

### R3 — `tasks.md` T44: `pnpm 10.12.x` → `pnpm 11.8.0`

**Causa-raiz:** doc desatualizada; PR #71 (mergeado em `dev`) migrou para pnpm 11.8.0. Se T44 executar com `10.12.x`, `infra-map.md` diverge da realidade.
**Fix:** editar `tasks.md` linha ~874: `pnpm 10.12.x` → `pnpm 11.8.0`.
**Aceite:** `grep "pnpm 10" specs/033-infra-toolchain-update/tasks.md` → 0; T44 cita `11.8.0`.

---

### R4 — `specs/034.../plan.md`: corrigir API de read/write-excel-file

**Causa-raiz:** plano de spec futura cita API inexistente/imprecisa. coderabbit (web-verified):
- `read-excel-file@9.x` **não exporta `readRows`**. Fluxo correto: `readExcelFile(input, { sheet })` retorna linhas; para schema usa-se `readSheet`/`parseData`. Aceita `File | Blob | ArrayBuffer` (não `Uint8Array` diretamente — converter `Uint8Array` → `ArrayBuffer`/`Blob`).
- `write-excel-file@4.1.1`: `writeXlsxFile<T>(...)` é genérica; no browser o fluxo é `.toBlob()` (não retorno único `Promise<Blob>` implícito). Com `fileName` ele dispara download direto.

**Fix:** corrigir os blocos de código do plan.md (linhas ~27-39 e ~52-79):
- Remover import/uso de `readRows`; usar `readExcelFile(blob, { sheet: 1 })` com input `Blob`/`ArrayBuffer`; documentar conversão de `Uint8Array`.
- Ajustar exemplo `writeXlsxFile` para refletir `.toBlob()` ou `fileName` conforme a doc v4.1.1.
- Manter marcado como **a validar na implementação** (é plano, não código).

**Aceite:** plan.md não cita `readRows`; nota de conversão `Uint8Array→Blob` presente; bloco write-excel-file consistente com v4.1.1.

> **Decisão de escopo:** R4 é doc de uma spec **não-iniciada** (034). Pode ser corrigido aqui (barato) OU extraído junto de R5. Recomendado corrigir agora por ser one-shot e já apontado por bot Critical.

---

### R5 — Higiene de escopo: arquivos da spec 034 no PR de infra

**Causa-raiz:** PR #72 é Fase 5c de infra (033), mas o diff inclui `specs/034-glossario-xlsx-replace/{spec,plan,tasks}.md` + `opencode.md`. Mistura escopo de spec não-iniciada num PR de CI/CD.

**Decisão necessária do mantenedor (não infiro):**
- **Opção A (recomendada):** manter 034 no PR como *planejamento documental* (já estão escritos; remover atrasa), desde que R4 corrija as imprecisões. Documentar no corpo do PR que são docs de planejamento.
- **Opção B:** extrair `specs/034/*` e `opencode.md` para branch/PR próprio (`docs/034-xlsx-plan`), deixando #72 puro de infra.

**Aceite:** decisão registrada na sessão + project-state; PR coerente com a opção escolhida.

---

### R6 — `persist-credentials: false` nos checkouts (segurança · sistêmico)

**Causa-raiz:** `actions/checkout` grava o `GITHUB_TOKEN` em `.git/config` por default. Qualquer step/script subsequente no mesmo job lê o token → superfície de ataque (zizmor regra `artipacked`). coderabbit flagou 5 workflows, **mas é sistêmico**: 14 dos 15 workflows com checkout não setam o flag (`scorecard.yml` já seta — precedente do próprio repo).

**Sem caminho fácil — não aplicar cego:** um workflow **push autenticado p/ `main`** quebra se as credenciais não persistirem. Classifiquei cada checkout pelo uso real de git:

| Workflow | Op git real | `persist-credentials` |
|---|---|---|
| `promote-prod-fast-forward.yml` | **`git push origin …:refs/heads/main`** (L42) — push autenticado | **`true` (explícito)** — exceção legítima; documentar intenção |
| `_deploy-module.yml` | `git fetch`/`reset --hard` no runner (público) + reset na VM via SSH (token próprio) | `false` |
| `guard-main-ancestor.yml` | só `git fetch` (público) | `false` |
| `mesas-auto-archive.yml` | só `git fetch origin main` | `false` |
| `docker-cleanup.yml` | só `git fetch origin main` | `false` |
| `_enforce-migration-dir.yml` | só `git fetch --depth=1` (público) | `false` |
| `ci.yml`, `codeql.yml`, `dependency-review.yml`, `_lint-shell.yml`, `pr-checks.yml`, `secret-scan.yml`, `semgrep.yml`, `deploy.yml` | nenhuma op git autenticada (lint/build/test/scan) | `false` |
| `scorecard.yml` | — | já `false` (precedente, sem mudança) |

> Repo é **público** (memória `repo-public-history-rewrite`) → `git fetch` de `origin` funciona sem token. Sem submódulos. Por isso `false` é seguro em tudo menos no push p/ `main`.

**Fix:** adicionar a cada checkout (exceto promote e scorecard):
```yaml
      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0
        with:
          persist-credentials: false
```
Em `promote-prod-fast-forward.yml`, setar **explícito** `persist-credentials: true` + comentário: o push p/ `main` exige o token persistido (exceção consciente ao `artipacked`).

**Aceite R6:**
- `grep -L "persist-credentials" .github/workflows/*.yml` → só workflows sem checkout.
- `promote-prod-fast-forward.yml` com `true` explícito + comentário.
- `actionlint` local verde nos workflows tocados.
- `promote-prod-fast-forward` continua fazendo o FF push (validar na próxima promoção real ou via dry-run do step).

> **Risco se errar:** setar `false` no promote quebraria a promoção `dev→main` silenciosamente (só detectável no próximo deploy de prod). Por isso a tabela é explícita — não aplicar com find/replace global.

---

### R7 — Falhas dos deploys: diagnóstico (não há bug de deploy independente)

**Investigação (jobs do workflow `deploy` na run 27846619869):**

Estrutura: `deploy.yml` → matriz chama reusable `_deploy-module.yml` por módulo. Cada módulo roda 3 jobs em cadeia:
1. **`Resolve env`** — `SUCCESS` em todos (mesas/glossario/site/accounts).
2. **`CI <módulo>`** — `FAILURE` em todos. Step `Install` (`_deploy-module.yml:162` → `pnpm install --frozen-lockfile`) sai com `[ERR_PNPM_IGNORED_BUILDS] esbuild@0.27.7, esbuild@0.28.0` exit 1 — **idêntico a F1**. Os steps `Build module`/`Test module` nem rodam.
3. **`Deploy <módulo>`** — `SKIPPED` por `needs: ci` (não roda quando CI falha). **Não é falha; é gate de segurança funcionando.**

**Conclusão:** as 4 falhas de deploy são 100% downstream do blocker pnpm. **Não existe bug de deploy próprio.** `_deploy-module.yml` já está correto: `Setup pnpm` usa `corepack prepare pnpm@11.8.0` (L142-145), checkout pinado no SHA certo, postgres service health-check ok (os logs de PG nos jobs são ruído da inicialização do service container, não erro).

**Após R1 (workspace com `esbuild`):** `Install` passa → `Build`/`Test` por módulo rodam → `CI <módulo>` verde → `Deploy` deixa de ser bloqueado.

**Semântica esperada do `Deploy` (não confundir com falha):** com `CI` verde, o `Deploy` ainda pode **não** rodar de propósito conforme o manifesto por módulo:
- `glossario`/`mesas`/`accounts`: **bootstrap-safe / dispatch-only** (`auto_deploy_on_push=false`) → deploy só via `workflow_dispatch`, não em PR/push. Permanecer `skipped` no PR é **correto**.
- `site`: paridade spec 030/031 (env deriva do ref). Em PR não promove prod.
- Em contexto de PR, nenhum módulo faz deploy real de qualquer forma (deploy é gated por `push`/`dispatch`, não por `pull_request`).

**Aceite R7 (sem ação de código própria — validação pós-R1):**
- Re-run do PR após R1: 4 jobs `CI <módulo>` verdes.
- Jobs `Deploy <módulo>` permanecem `skipped` no contexto PR (esperado), **sem** erro.
- Nenhuma edição em `_deploy-module.yml`/`deploy.yml` por R7 (já corretos); R6 cobre o `persist-credentials` desses arquivos.

---

## 3. Ordem de execução

1. **R1** (destrava CI — prioridade máxima; sem isso o PR não mergeia).
2. **R6** (segurança checkouts — actionlint local antes do push).
3. R2, R3, R4 (docs).
4. R5 — **RESOLVIDO**: opção A, manter `specs/034/*` no PR (decisão mantenedor 2026-06-19). Documentar no corpo do PR que são docs de planejamento.
5. Push do branch → confirmar checks verdes na run do PR (não comentar no PR).
6. Atualizar `project-state.md` + `specs/backlog.md` (fechar débito do blocker pnpm; registrar resolvidos F2/F3/F4; registrar R6 como hardening).

> **Autorização:** nenhum `git commit`/`git push`/merge aqui sem pedido nominal do mantenedor por ação (AGENTS.md pétrea). Esta spec só planeja + edita arquivos locais quando autorizado.

## 4. Critério de conclusão (DoD)

- [x] `pnpm install --frozen-lockfile` local (CI=true) exit 0, **sem `Ignored build scripts`** (validado 2026-06-19, `Done in 1m1.9s pnpm 11.8.0`, IGNORED count 0).
- [ ] 5 checks do PR verdes (`lint+build+test` + `CI mesas/glossario/site/accounts`).
- [ ] Jobs `Deploy <módulo>` permanecem `skipped` no PR (R7 — esperado, sem erro).
- [x] D080 em `decisions.md` (política pnpm 11 `allowBuilds`). T44 ganhou nota pnpm; `infra-map.md` em si é editado na execução de T44 (spec 033).
- [x] `tasks.md`: T41 `D0NN`→`D081/D082/D083`; T44 `pnpm 10.12.x`→`11.8.0`.
- [x] `034/plan.md`: API read/write-excel-file corrigida (`readRows` removido; conversão `Uint8Array→Blob`; `writeXlsxFile` `fileName`/`.toBlob()`).
- [x] R6: `persist-credentials: false` em 14 checkouts; `promote-prod-fast-forward` explícito `true` + comentário. YAML válido (`yaml.safe_load` ok). `actionlint` **pendente** (não instalado local → valida no check `_lint-shell` do PR).
- [x] R5 decidido: opção A (manter 034 no PR) — mantenedor 2026-06-19.
- [ ] `project-state.md` + `backlog.md` atualizados; sessão fechada.
- [ ] Nenhuma interação do agente na conversa do PR.
