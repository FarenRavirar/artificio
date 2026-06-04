# Tasks — 001 Backup total (runbook executável)

> VM = bash via SSH. Local = PowerShell (Windows). Placeholders `<...>` preenchidos na **T1**.
> `[APROVAÇÃO]` = exige bloco de aprovação de `AGENTS.md` antes de rodar. Read-only (T1, T4, T11) dispensa.
> Staging na VM: `BK=/tmp/artificio-backup-$(date +%F)` ; destino local: `C:\projetos\artificiobackup\<AAAA-MM-DD>\`.

---

## T1 — Inventário / descoberta  *(read-only, sem aprovação)*
```bash
mkdir -p "$BK"/{inventory,postgres,wordpress/rest-api,volumes,code,cloudflare}
docker ps -a            > "$BK/inventory/docker-ps.txt"
docker volume ls        > "$BK/inventory/volumes.txt"
docker network ls       > "$BK/inventory/networks.txt"
df -h                   > "$BK/inventory/df.txt"
for c in $(docker ps --format '{{.Names}}'); do docker inspect "$c" > "$BK/inventory/inspect-$c.json"; done
find /opt /root /home -name 'docker-compose*.yml' 2>/dev/null | tee "$BK/inventory/compose-locations.txt"
# WordPress: descobrir se roda em Docker aqui ou em host externo
docker ps --format '{{.Names}} {{.Image}}' | grep -iE 'wordpress|mysql|maria' || echo "WP nao-Docker -> host externo"
```
**Feito quando:** tabela de parâmetros do `plan.md` preenchida (containers PG, user/db, volumes, WP_HOST_TYPE, WP_DB_*, uploads path, tunnel).

## T2 — Dumps Postgres  `[APROVAÇÃO 1]`
4 bancos G1. Creds lidas do **env do próprio container** (não vazam na saída). `-Fc` = custom, restaurável. Sem `-t` (binário seguro).
```bash
docker exec mesas-beta-db     sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$BK/postgres/mesas_beta.dump"
docker exec mesas-db          sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$BK/postgres/mesas_prod.dump"
docker exec glossario-beta-db sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$BK/postgres/glossario_beta.dump"
docker exec glossario-db      sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$BK/postgres/glossario_prod.dump"
```
**Feito quando:** 4 `.dump` > 0 bytes; `pg_restore -l <NOME>.dump | head` lista objetos.

## T3 — WordPress: **FORA do backup** (D024)
WP de `artificiorpg.com` tem backup em nuvem da Hostinger → não backupear aqui. Só guardar **creds (DB+FTP) no `secrets.7z`** (T7) para a migração. Comandos abaixo ficam de referência, **não executar nesta fase.**

**~~Ramo A (WP em Docker na VM)~~ — N/A (WP externo):**
```bash
docker exec <WP_DB_CONTAINER> sh -c 'exec mysqldump -u<WP_DB_USER> -p"<WP_DB_PASS>" <WP_DB_NAME>' | gzip > "$BK/wordpress/wp-db.sql.gz"
docker run --rm -v <UPLOADS_VOL>:/data -v "$BK/wordpress":/bk alpine tar czf /bk/uploads.tar.gz -C /data .
docker cp <WP_CONTAINER>:/var/www/html/wp-config.php "$BK/wordpress/wp-config.php"
```
**Ramo B (WP em host externo):**
```bash
mysqldump -h <WP_DB_HOST> -u <WP_DB_USER> -p <WP_DB_NAME> | gzip > "$BK/wordpress/wp-db.sql.gz"
# uploads via SFTP/SSH do host, ou plugin (UpdraftPlus/All-in-One) -> baixar export
tar czf "$BK/wordpress/uploads.tar.gz" -C <WP_UPLOADS_PATH> .
```
**Feito quando:** `gunzip -t wp-db.sql.gz` OK; `uploads.tar.gz` ≈ 6.34GB; `wp-config.php` presente.

## T4 — WordPress: export REST API JSON  → **DIFERIDA p/ Fase 3 (migração), D025**
Não é backup. O importador puxa conteúdo+mídia **on-demand** na migração. Script de referência:
```bash
BASE=https://artificiorpg.com/wp-json/wp/v2
for t in posts pages media categories tags; do
  tp=$(curl -sI "$BASE/$t?per_page=100&page=1" | tr -d '\r' | awk -F': ' 'tolower($1)=="x-wp-totalpages"{print $2}')
  : "${tp:=1}"
  for p in $(seq 1 "$tp"); do curl -s "$BASE/$t?per_page=100&page=$p&_embed"; done | jq -s 'add' > "$BK/wordpress/rest-api/$t.json"
done
```
**Feito quando:** `jq length rest-api/posts.json` ≈ total de posts do WP (≥300).

## T5 — Volumes Docker (tar) — **só G1** (D021)  `[APROVAÇÃO 1]`
Belt-and-suspenders dos pgdata (autoritativo é o dump T2) + captura o volume **órfão** `producao` (sem container, só dá pra tar).
```bash
for v in mesas-beta_pgdata_mesas_beta mesas_pgdata_mesas_prod \
         glossario-beta_pgdata_beta glossario_pgdata_prod glossario_pgdata_producao; do
  docker run --rm -v "$v":/data -v "$BK/volumes":/bk alpine tar czf "/bk/$v.tar.gz" -C /data .
done
```
**NÃO** tarar `gerenciador_telegram_*` nem nada de foundry (D021).
**Feito quando:** 5 `.tar.gz` G1; nenhum 0 bytes.

## T6 — Código sem GitHub (links + servidorvirtual)  `[APROVAÇÃO 3 p/ push]`
```bash
# localizar e copiar o código TS das duas páginas (caminho descoberto na T1)
cp -r <LINKS_PATH> "$BK/code/links"
cp -r <SERVIDORVIRTUAL_PATH> "$BK/code/servidorvirtual"
# git bundle de segurança (se já forem repos) ou init novo
```
Local (PowerShell) — criar repos privados e push:
```powershell
gh repo create artificio-links --private --source "C:\projetos\artificiobackup\<DATA>\code\links" --push
gh repo create artificio-servidorvirtual --private --source "...\code\servidorvirtual" --push
```
**Feito quando:** código copiado **e** repos GitHub privados criados com push (R4).

## T7 — Segredos → bundle encriptado  `[APROVAÇÃO 1]`
Alvos: `.env` dos serviços G1 + WP creds + Cloudinary/GHCR/CF. Registro: `docs/agents/access-registry.md`.
```bash
ssh faren 'BK=/tmp/artificio-backup-$(date +%F); mkdir -p "$BK/secrets-stage";
for d in mesas mesas-beta glossario glossario-beta; do
  [ -f "/opt/$d/.env" ] && cp "/opt/$d/.env" "$BK/secrets-stage/$d.env"; done;
# WP Hostinger creds: criar wp-hostinger.env no stage (valores fornecidos pelo mantenedor, fora deste arquivo)
ls "$BK/secrets-stage"'
# encriptar (na VM ou local): AES-256 com header encriptado
7z a -p -mhe=on "$BK/secrets.7z" "$BK/secrets-stage/"* && rm -rf "$BK/secrets-stage"
```
**Feito quando:** `secrets.7z` abre com a senha; `secrets-stage` removido; **nenhum** segredo solto. Senha do bundle só no cofre do mantenedor.

## T8 — Cloudflare: DNS + tunnel  *(maior parte read-only)*
```bash
cloudflared tunnel list > "$BK/cloudflare/tunnel-list.txt"
cp ~/.cloudflared/*.yml "$BK/cloudflare/" 2>/dev/null
# DNS export via API (token read-only) ou painel -> Export
curl -s -H "Authorization: Bearer <CF_TOKEN_RO>" \
  "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records?per_page=500" | jq . > "$BK/cloudflare/dns-export.json"
```
**Feito quando:** `dns-export.json` lista todos os subdomínios; config do tunnel salva. (Credencial do tunnel vai no `secrets.7z`, não em claro.)

## T9 — Checksums na origem  *(sem aprovação)*
```bash
cd "$BK" && find . -type f ! -name CHECKSUMS.sha256 -exec sha256sum {} \; > CHECKSUMS.sha256
du -sh "$BK"
```
**Feito quando:** `CHECKSUMS.sha256` cobre todos os arquivos; tamanho total registrado.

## T10 — Transferir VM → artificiobackup  `[APROVAÇÃO 2]`
**Via scp (PowerShell local):**
```powershell
$DATA = "<AAAA-MM-DD>"
New-Item -ItemType Directory -Force "C:\projetos\artificiobackup\$DATA" | Out-Null
scp -r <USER>@<VM_HOST>:/tmp/artificio-backup-$DATA/* "C:\projetos\artificiobackup\$DATA\"
```
**Via RaiDrive:** copiar `/tmp/artificio-backup-<DATA>/` do drive montado para `C:\projetos\artificiobackup\<DATA>\` (`rsync` resumível se cair).
**Feito quando:** todos os arquivos presentes no destino; tamanho total bate com T9.

## T11 — Verificar no destino  *(read-only)*
```powershell
# Git-Bash:  cd "C:\projetos\artificiobackup\<DATA>" && sha256sum -c CHECKSUMS.sha256
# PowerShell puro: comparar Get-FileHash -Algorithm SHA256 vs CHECKSUMS.sha256
```
**Feito quando:** todos os checksums conferem (origem == destino). Zero `FAILED`.

## T12 — Restore-test (prova de integridade)  `[APROVAÇÃO 1 — container scratch]`
```bash
docker run -d --name bk-test -e POSTGRES_PASSWORD=test postgres:16-alpine
docker cp "<DATA>/postgres/glossario_prod.dump" bk-test:/tmp/d.dump
docker exec bk-test createdb -U postgres t
docker exec bk-test pg_restore -U postgres -d t /tmp/d.dump
docker exec bk-test psql -U postgres -d t -c "\dt" -c "select count(*) from <TABELA_CONHECIDA>;"
docker rm -f bk-test
```
WP spot-check: `gunzip -t wp-db.sql.gz` ; `tar -tzf uploads.tar.gz | wc -l` ; `jq length rest-api/posts.json`.
**Feito quando:** restore lista tabelas e `count > 0`; WP checks OK.

## T13 — Manifesto + Gate A
- Escrever `MANIFEST.md` (item · tamanho · sha256 · origem).
- Atualizar `.specify/memory/project-state.md`: marcar critérios do Gate A.
- Pedir **aprovação explícita** do mantenedor para fechar o **Gate A**.
**Feito quando:** todos os critérios de aceite do `spec.md` ✅ e mantenedor aprova Gate A. **Só então** Fase 1 (recriar instância).
