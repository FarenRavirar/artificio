# Fichas de execução — Spec 033 (Claude especifica · DeepSeek executa)

> Cada ficha é fechada: o quê, em qual arquivo, comandos exatos, critério de "feito", rollback.
> DeepSeek executa UMA ficha por vez e reporta resultado bruto (saída de comando). Não improvisa fora da ficha.
> Ambiente: Windows, PowerShell. Repo: `C:\projetos\artificio`. Branch base: dev.

---

## T6 — Backup pré-Node (Fase 2.0)

**Objetivo:** snapshot de segurança ANTES de tocar Node. Nada muta runtime/remote. Só git tag LOCAL + cópias de arquivo + leitura de deps.

**Pré-condições:** estar em `C:\projetos\artificio`. Nenhuma aprovação extra: tag local + cópia local + leitura.

**Passos (executar na ordem, PowerShell):**

1. Criar tag local de backup:
   ```
   git tag pre-033-f2-node
   ```
2. Garantir pasta de backup off-repo e copiar lockfile:
   ```
   New-Item -ItemType Directory -Force "C:\projetos\artificiobackup\spec-033" | Out-Null
   Copy-Item "C:\projetos\artificio\pnpm-lock.yaml" "C:\projetos\artificiobackup\spec-033\pnpm-lock.yaml.pre-033-f2" -Force
   ```
3. Garantir `artifacts/033/` e capturar inventário de deps:
   ```
   New-Item -ItemType Directory -Force "C:\projetos\artificio\artifacts\033" | Out-Null
   pnpm list --depth 0 -r 2>&1 | Tee-Object "C:\projetos\artificio\artifacts\033\pre-f2-dep-list.txt"
   pnpm outdated -r 2>&1 | Tee-Object "C:\projetos\artificio\artifacts\033\pre-f2-outdated.txt"
   ```
   > Nota: `pnpm outdated -r` retorna exit code ≠ 0 quando há deps desatualizadas — isso é ESPERADO, não é falha. O arquivo deve ter conteúdo.

**Feito quando (verificar e reportar a saída de cada um):**
```
git tag -l "pre-033-f2-*"
Test-Path "C:\projetos\artificiobackup\spec-033\pnpm-lock.yaml.pre-033-f2"
Test-Path "C:\projetos\artificio\artifacts\033\pre-f2-dep-list.txt"
Test-Path "C:\projetos\artificio\artifacts\033\pre-f2-outdated.txt"
```
- `git tag -l` lista `pre-033-f2-node`
- 3× `Test-Path` = `True`
- os 2 `.txt` têm conteúdo (não-vazios)

**NÃO fazer:** `git push`, `git commit`, deploy, tocar VM, `pnpm install`/`update`, editar qualquer fonte. Só os passos acima.

**Rollback:** `git tag -d pre-033-f2-node` (remove tag local); apagar os arquivos copiados. Nada foi pushado.

**Reportar:** colar a saída literal de `git tag -l "pre-033-f2-*"`, dos `Test-Path`, e as primeiras/últimas linhas dos 2 `.txt` (confirmar não-vazios).

**STATUS:** ✅ feito (2026-06-18). Tag + 2 snapshots por DeepSeek; cópia lockfile completada por Claude. Commits `0bcd6a7`/`72da8cb`.

---

## T7 — Baseline pré-Node (Fase 2.1) — DISPARADO EM LOTES PEQUENOS

> Capturar estado ATUAL (Node atual) antes de mudar. Só roda comandos e salva log. Não muta código.

**Lote 1 — build baseline:**
```
turbo build --force 2>&1 | Tee-Object artifacts/033/pre-f2-build.log
```
Feito quando: log salvo; reportar quantos apps verdes (esperado 13/13).

**Lote 2 — lint + tests:**
```
pnpm lint 2>&1 | Tee-Object artifacts/033/pre-f2-lint.log
pnpm --filter @artificio/ui test 2>&1 | Tee-Object artifacts/033/pre-f2-ui-test.log
pnpm --filter @artificio/glossario-backend test 2>&1 | Tee-Object artifacts/033/pre-f2-glossario-test.log
```
Feito quando: 3 logs salvos; anotar passes/falhas como baseline (lint pode ter falhas conhecidas).

**STATUS:** ✅ feito (2026-06-18). Baseline: build **13/13**; ui test **8/8**; glossario-backend **22/22**; lint **2/5** (falhas conhecidas: `@artificio/content` + `@artificio/analytics` sem config ESLint — não regressão, baseline). Commit pendente junto com T8.

---

## Fase 2 restante — Node 24 (T8–T12) — DISPATCH ÚNICO

> Unidade = fase inteira. DeepSeek faz T8 (edição) → T9 (check pnpm) → T10/T11/T12 (testes de impacto vs baseline). Alvo: **Node 24 LTS** em todo lugar.

### T8 — Alinhar Node 24 (edições EXATAS)

**Workflows (trocar `node-version: 20` → `node-version: 24`):**
- `.github/workflows/ci.yml:56`
- `.github/workflows/_deploy-module.yml:150`

**Dockerfiles (trocar a tag da imagem base, manter o resto da linha):**
- `apps/accounts/Dockerfile` linhas 1 e 12: `node:20-alpine` → `node:24-alpine`
- `apps/glossario/backend/Dockerfile` linhas 7 e 21: `node:25.9.0-alpine` → `node:24-alpine`
- `apps/glossario/frontend/Dockerfile` linha 7: `node:25.9.0-alpine` → `node:24-alpine`
- `apps/mesas/backend/Dockerfile` linhas 7 e 21: `node:25.9.0-alpine` → `node:24-alpine`
- `apps/mesas/frontend/Dockerfile` linha 7: `node:25.9.0-alpine` → `node:24-alpine`
- `apps/site/Dockerfile` linha 4: `node:25.9.0-slim` → `node:24-slim`

**Raiz:**
- `package.json` (raiz): adicionar bloco `"engines": { "node": ">=24" }` (se já existir `engines`, só setar `node`).
- Criar `.nvmrc` na raiz com o conteúdo exato: `24`

**@types/node (alinhar para `^24`):**
- `apps/glossario/backend/package.json:33`: `^25.5.0` → `^24`
- `apps/mesas/backend/package.json:57`: `^20.12.7` → `^24`
- `apps/mesas/frontend/package.json:46`: `^24.12.0` → `^24`
- `package.json` (raiz, `^24.0.0`): manter (já 24)

**Regenerar lockfile:**
```
pnpm install
```
> `pnpm install` aqui é AUTORIZADO (regenera lockfile pós-bump de @types/node). NÃO rodar `pnpm update`. NÃO `git push`/`commit`/deploy/VM.

### T9 — pnpm
- Confirmar `packageManager`/CI pnpm = `10.12.1` (já alinhado). Não bumpar pnpm.

### T10 — build de impacto
```
turbo build --force 2>&1 | Tee-Object artifacts/033/post-f2-build.log
```
Critério: **13/13 verde** (igual baseline). Se algum app quebrar → PARAR e reportar qual + erro.

### T11 — lint + tests de impacto
```
pnpm lint 2>&1 | Tee-Object artifacts/033/post-f2-lint.log
pnpm --filter @artificio/ui test 2>&1 | Tee-Object artifacts/033/post-f2-ui-test.log
pnpm --filter @artificio/glossario-backend test 2>&1 | Tee-Object artifacts/033/post-f2-glossario-test.log
```
Critério: ui **8/8**, glossario **22/22** (igual baseline); lint = mesmas 2 falhas conhecidas (content/analytics), zero NOVA falha.

### T12 — tsc mesas-backend (smoke de tipo)
```
pnpm --filter @artificio/mesas-backend exec tsc --noEmit 2>&1 | Tee-Object artifacts/033/post-f2-mesas-tsc.log
```
Anotar nº de erros (baseline de tipo pré-Express; erros pré-existentes OK).

**Feito quando (reportar curto):** grep `node:(20|25` nos Dockerfiles = 0; `.nvmrc` existe; `engines.node` presente; build 13/13; ui 8/8; glossario 22/22; lint sem nova falha. Colar só os números + qualquer erro NOVO.

**Rollback:** `git reset --hard pre-033-f2-node` + `pnpm install --frozen-lockfile` (lockfile original em `artificiobackup/spec-033/pnpm-lock.yaml.pre-033-f2`).
