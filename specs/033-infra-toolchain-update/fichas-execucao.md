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
