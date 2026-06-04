# Sessão 26-06-03_1 — infra: backup runbook (Fase 0)

- **Data:** 2026-06-03
- **Módulo:** infra · **Gate:** A
- **Objetivo:** produzir a spec/runbook de backup total e executá-lo até fechar o Gate A.

## Vínculos
- Spec: `specs/001-infra-backup-runbook/{spec,plan,tasks}.md`
- Decisões: D004, D008, D009, D010, D012, D017
- Constituição: §VII (backup antes de destruir)

## Plano de execução
1. ✅ Spec + plan + tasks criados.
2. ✅ **T1 inventário** — `ssh faren` verificado. Params em `docs/agents/infra-map.md`. WP=externo (Ramo B). Escopo travado: **só G1** (D021); telegram/foundry fora; tunnel novo na Fase 1 (D022).
3. ⬜ T2–T8 coleta (4 dumps PG, WP externo, 5 volumes G1, código, segredos, DNS) — `[APROVAÇÃO 1/3]`.
4. ⬜ T9 checksums origem.
5. ⬜ T10 transferir → `artificiobackup` — `[APROVAÇÃO 2]`.
6. ⬜ T11 verificar destino · T12 restore-test.
7. ⬜ T13 manifesto + **aprovação Gate A**.

## Bloqueio atual
WP é **externo** → T3 (Ramo B) precisa das credenciais do painel de hospedagem do `artificiorpg.com` (DB host/user/pass/name + acesso a `wp-content/uploads`). Mantenedor precisa fornecer ou apontar onde o WP está hospedado.

## Arquivos que serão modificados
- `specs/001-infra-backup-runbook/*` (criados)
- `.specify/memory/project-state.md` (Gate A no fim)
- `sessoes/index.md`
- Fora do repo: `C:\projetos\artificiobackup\<DATA>\*`

## Critério de conclusão
Todos os critérios de aceite do `spec.md` ✅, checksums batem, restore-test passa, mantenedor aprova Gate A. Nenhuma ação destrutiva na VM antes disso.

## Estado atual — SESSÃO CONCLUÍDA (backup completo)
**Gate A APROVADO (D031).** Backup G1 **100% completo e validado** (2026-06-04): CDX-001..006 ✅. DBs (dumps+volumes) + secrets (`secrets.7z`) + **deploy dirs** (`opt-dirs/`, fecha gap glossário não-git) = 14 arquivos, 14/14 checksums OK em `artificiobackup\2026-06-04`. Restore-test real OK (14 tabelas). `MANIFEST.md` gerado.
**VM pode ser destruída.** Próximo = Fase 1 (`specs/002-fase1-instancia`). Pendência segurança: rotacionar PAT GitHub vazado + creds. Mover esta sessão p/ `encerradas/` quando autorizado.

## Log Codex
- 2026-06-04 — Codex retomou pelo T0 (`project-state`, `context-capsule`, `decisions`) + sessão ativa. Próximo passo: executar CDX-001..005 em ordem após aprovação explícita do mantenedor para escrita na VM/cópia off-VM e após obter `wp-hostinger.env` fora do git.
- 2026-06-04 — CDX-001 executado. Resultado válido: 4 dumps PG não-zero (`mesas_beta`, `mesas_prod`, `glossario_beta`, `glossario_prod`) + 5 tars de volumes em `/tmp/artificio-backup-2026-06-04/`; tamanho total `67M`.
- 2026-06-04 — CDX-002 parcialmente executado: `.env` encontrados em `secrets-stage` (`glossario-beta.env`, `glossario.env`, `mesas-beta.env`, `mesas.env`). Bloqueado para fechar: falta `wp-hostinger.env` local e `7z/7za/7zz` não está disponível nem na VM nem no Windows local.
- 2026-06-04 — CDX-002 concluído: `wp-hostinger.env` copiado para `secrets-stage`; `secrets.7z` criado via container temporário Alpine+p7zip; `secrets-stage` removido. Senha do `.7z` salva fora do repo em `C:\projetos\artificiobackup\secrets-7z-password.txt`.
- 2026-06-04 — CDX-003 concluído: `CHECKSUMS.sha256` gerado na origem cobrindo 10 arquivos; origem `67M`.
- 2026-06-04 — CDX-004 concluído: backup transferido para `C:\projetos\artificiobackup\2026-06-04`; total local `69591772 bytes`.
- 2026-06-04 — CDX-005 concluído: checksums locais OK; restore-test de `glossario_prod.dump` passou após criar role temporária `admin` no container `bk-test`; 14 tabelas listadas; container removido.
- 2026-06-04 — Codex retomou CDX-006 a pedido do mantenedor: backup dos dirs `/opt/{mesas,mesas-beta,glossario,glossario-beta}` para fechar gap glossário não-git antes de recriar VM.
- 2026-06-04 — CDX-006 concluído e validado: 4 tars em `opt-dirs` (`glossario`, `glossario-beta`, `mesas`, `mesas-beta`), todos non-zero; `CHECKSUMS.sha256` refeito com 14 arquivos; destino local `C:\projetos\artificiobackup\2026-06-04` validado 14/14 OK.
- 2026-06-04 (Opus) — **CDX-001 validado ✅** (dumps non-zero + volumes, 67M).
- 2026-06-04 (Opus) — **Gate A APROVADO** (D031). Pré-flight recriação: site independe da VM ✅; gap glossário não-git → **CDX-006** (backup dos `/opt` dirs) antes de destruir; DNS no Cloudflare (não-gap). **PAT GitHub vazado em `/opt/mesas-beta` remote → rotacionar** (D032).
- 2026-06-04 (Opus) — **CDX-002 simplificado (D030):** bundle = `secrets.tar.gz` **plaintext** local (sem openssl/senha — Codex roda direto). `wp-hostinger.env` já criado em `C:\projetos\artificiobackup\` (fora do git) com as creds. Cada CDX tem `✓ Validar`. **Rotacionar todas as creds pós-migração.** Codex pode rodar CDX-002→003→004→005 sem passo local do mantenedor.

---

## Tarefas para Codex
> Gatilho: "realize as tarefas para codex na sessão". Executar `CDX-*` pendentes em ordem.
> **REGRA: Codex roda o `✓ Validar` de cada tarefa ANTES de retornar. Só reporta se passou. Se falhar, não avança — cola o erro.**
> `DATA` = `date +%F`. Backup local em `C:\projetos\artificiobackup\<DATA>\`.

### CDX-001 — Dumps PG + tar de volumes (VM)  ✅ VALIDADO (Opus, 2026-06-04)
Resultado: 4 dumps não-zero (mesas_beta 629KB, mesas_prod 292KB, glossario_beta 534KB, glossario_prod 542KB) + 5 tars (15–19MB) = 67M. OK. Conteúdo confirmado no CDX-005.
Objetivo: gerar 4 dumps Postgres G1 + 5 tars de volume em `/tmp/artificio-backup-<DATA>/` na VM.
```bash
ssh faren 'BK=/tmp/artificio-backup-$(date +%F); mkdir -p "$BK"/{postgres,volumes};
for m in "mesas-beta-db:mesas_beta" "mesas-db:mesas_prod" "glossario-beta-db:glossario_beta" "glossario-db:glossario_prod"; do
  c=${m%%:*}; n=${m##*:};
  docker exec "$c" sh -c '"'"'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"'"'"' > "$BK/postgres/$n.dump"; done;
for v in mesas-beta_pgdata_mesas_beta mesas_pgdata_mesas_prod glossario-beta_pgdata_beta glossario_pgdata_prod glossario_pgdata_producao; do
  docker run --rm -v "$v":/data -v "$BK/volumes":/bk alpine tar czf "/bk/$v.tar.gz" -C /data .; done;
echo "=== PG ==="; ls -la "$BK"/postgres; echo "=== VOL ==="; ls -la "$BK"/volumes; du -sh "$BK"'
```
Feito quando: 4 `.dump` + 5 `.tar.gz`, nenhum 0 bytes. **Reportar:** o `ls -la` dos dois dirs + `du -sh`.

### CDX-002 — Secrets bundle (plaintext local, D030)  🔄 RETOMAR
4 `.env` de serviço já em `secrets-stage` na VM. Junta o `wp-hostinger.env` (já criado em `C:\projetos\artificiobackup\wp-hostinger.env`, fora do git) e faz **tar plaintext** `secrets.tar.gz` no staging da VM. **Sem encriptação** (D030: local-only, rotacionar pós-migração). Rodar em **Git-Bash**.
```bash
DATA=$(ssh faren 'date +%F')
# garante os 4 .env de serviço no stage da VM (recria se sumiu)
ssh faren "BK=/tmp/artificio-backup-$DATA; test -d \"\$BK/secrets-stage\" || { mkdir -p \"\$BK/secrets-stage\"; for d in mesas mesas-beta glossario glossario-beta; do [ -f \"/opt/\$d/.env\" ] && cp \"/opt/\$d/.env\" \"\$BK/secrets-stage/\$d.env\"; done; }"
# adiciona as creds WP (arquivo local, fora do git)
scp /c/projetos/artificiobackup/wp-hostinger.env faren:/tmp/artificio-backup-$DATA/secrets-stage/
# tar plaintext + remove o stage
ssh faren "BK=/tmp/artificio-backup-$DATA; tar czf \"\$BK/secrets.tar.gz\" -C \"\$BK\" secrets-stage && rm -rf \"\$BK/secrets-stage\"; ls -la \"\$BK/secrets.tar.gz\""
```
**✓ Validar (antes de retornar):** o tar tem que listar **5** arquivos:
```bash
ssh faren "tar tzf /tmp/artificio-backup-$DATA/secrets.tar.gz"
```
Esperado: `secrets-stage/{glossario,glossario-beta,mesas,mesas-beta}.env` + `secrets-stage/wp-hostinger.env`. Se faltar algum → parar e reportar.
**Reportar:** `ls -la` do `secrets.tar.gz` + os 5 nomes (**sem conteúdo**).

### CDX-003 — Checksums origem (VM)  ⬜
```bash
ssh faren 'BK=/tmp/artificio-backup-$(date +%F); cd "$BK" && find . -type f ! -name CHECKSUMS.sha256 -exec sha256sum {} \; > CHECKSUMS.sha256; cat CHECKSUMS.sha256; du -sh "$BK"'
```
**✓ Validar:** `wc -l CHECKSUMS.sha256` bate com nº de arquivos (`find . -type f | wc -l` menos 1). Inclui dumps, volumes e `secrets.tar.gz`. **Reportar:** conteúdo do checksums + `du -sh`.

### CDX-004 — Transferir VM → backup local  ⬜  `[aprovação: transfer]`
```powershell
$DATA = (ssh faren 'date +%F').Trim()
New-Item -ItemType Directory -Force "C:\projetos\artificiobackup\$DATA" | Out-Null
scp -r faren:/tmp/artificio-backup-$DATA/* "C:\projetos\artificiobackup\$DATA\"
Get-ChildItem -Recurse "C:\projetos\artificiobackup\$DATA" | Measure-Object Length -Sum
```
**✓ Validar:** nº de arquivos local == nº na VM (`ssh faren "find /tmp/artificio-backup-$DATA -type f | wc -l"`). **Reportar:** árvore + tamanho total local + os dois contadores.

### CDX-005 — Verificar + restore-test  ⬜
Verificar checksums no destino (Git-Bash): `cd "/c/projetos/artificiobackup/<DATA>" && sha256sum -c CHECKSUMS.sha256`.
Restore-test de 1 dump:
```bash
ssh faren 'docker run -d --name bk-test -e POSTGRES_PASSWORD=test postgres:16-alpine; sleep 5;
docker cp /tmp/artificio-backup-$(date +%F)/postgres/glossario_prod.dump bk-test:/tmp/d.dump;
docker exec bk-test createdb -U postgres t; docker exec bk-test pg_restore -U postgres -d t /tmp/d.dump;
docker exec bk-test psql -U postgres -d t -c "\dt" | head -30; docker rm -f bk-test'
```
**✓ Validar:** `sha256sum -c` = **zero FAILED** E restore lista ≥1 tabela com linhas. Se algum FAILED ou 0 tabelas → parar e reportar. **Reportar:** resultado do `-c` + as tabelas listadas. → Opus valida e fecha **Gate A**.

### CDX-006 — Backup dos dirs de deploy `/opt` (gap glossário não-git)  ⬜  `[pré-recriação]`
Glossário (`/opt/glossario*`) **não é git** → sem isto, recriar a VM perde o deploy. Backupear os 4 dirs de serviço (compose/config/.env/scripts, sem node_modules), re-checksum e transferir. Git-Bash.
```bash
DATA=$(ssh faren 'date +%F')
# tar dos dirs de deploy na VM (exclui node_modules/dist/.git pra encolher)
ssh faren "BK=/tmp/artificio-backup-$DATA; mkdir -p \"\$BK/opt-dirs\"; for d in mesas mesas-beta glossario glossario-beta; do tar czf \"\$BK/opt-dirs/\$d.tar.gz\" --exclude=node_modules --exclude=dist --exclude=.git -C /opt \"\$d\"; done; ls -la \"\$BK/opt-dirs\"; du -sh \"\$BK/opt-dirs\""
# re-checksum FULL na origem
ssh faren "BK=/tmp/artificio-backup-$DATA; cd \"\$BK\" && find . -type f ! -name CHECKSUMS.sha256 -exec sha256sum {} \; > CHECKSUMS.sha256; wc -l CHECKSUMS.sha256"
# transferir os novos + checksums atualizado pro local
scp -r faren:/tmp/artificio-backup-$DATA/opt-dirs "/c/projetos/artificiobackup/$DATA/"
scp faren:/tmp/artificio-backup-$DATA/CHECKSUMS.sha256 "/c/projetos/artificiobackup/$DATA/"
```
**✓ Validar:** 4 `.tar.gz` em `opt-dirs` (incl. `glossario.tar.gz` e `glossario-beta.tar.gz`), non-zero; no destino `cd /c/projetos/artificiobackup/$DATA && sha256sum -c CHECKSUMS.sha256` = zero FAILED. **Reportar:** `ls -la opt-dirs` local + resultado do `-c`.
