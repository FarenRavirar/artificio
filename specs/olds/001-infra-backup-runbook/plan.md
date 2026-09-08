# Plano — 001 Backup total

## Estratégia
Tudo **read-only / não-destrutivo**. Nada de `docker stop`. Dumps rodam **na VM** via `docker exec` (consistentes), juntam num diretório de staging na VM, geram checksums, e são transferidos para `C:\projetos\artificiobackup` (RaiDrive ou `scp`). Verificação de checksum no destino + restore-test local provam integridade. Só então Gate A.

Sequência: **descobrir → coletar → empacotar → checksum (origem) → transferir → checksum (destino) → restore-test → manifesto → aprovação Gate A.**

## Estrutura do destino
```
C:\projetos\artificiobackup\<AAAA-MM-DD>\
  inventory\      docker-ps.txt, volumes.txt, networks.txt, df.txt, inspect\*, compose\*
  postgres\       glossario_beta.dump  glossario_prod.dump  mesas_beta.dump  mesas_prod.dump
  wordpress\      wp-db.sql.gz  uploads.tar.gz  wp-config.php  rest-api\{posts,pages,media,categories,tags}.json
  volumes\        <volume>.tar.gz  (um por volume nomeado)
  code\           links\  servidorvirtual\  (+ git bundle de cada)
  cloudflare\     dns-export.json  tunnel-config.yml  cert/ (refs, não a chave em claro)
  secrets.7z      AES-256 — .env, OAuth, JWT, tunnel token, GHCR PAT, senhas DB
  MANIFEST.md     item · tamanho · sha256
  CHECKSUMS.sha256
```

## Parâmetros (Task 1 — VERIFICADOS 2026-06-03, ver `docs/agents/infra-map.md`)
Acesso: `ssh faren` (ARM aarch64, Ubuntu 24.04). Disco 146G/123G livre.
| Banco G1 | Container | DB | User | Volume |
|---|---|---|---|---|
| mesas beta | `mesas-beta-db` | `mesas_rpg` | `admin` | `mesas-beta_pgdata_mesas_beta` |
| mesas prod | `mesas-db` | `mesas_rpg` | `admin` | `mesas_pgdata_mesas_prod` |
| glossário beta | `glossario-beta-db` | `glossario_v2` | `admin` | `glossario-beta_pgdata_beta` |
| glossário prod | `glossario-db` | `glossario_v2` | `admin` | `glossario_pgdata_prod` |

- Frontend volumes: `mesas-beta_frontend_dist_beta`, `mesas_frontend_dist_prod` (~1.5MB, opcional — rebuildáveis).
- `glossario_pgdata_producao` = **órfão/legado** (LINKS=0). Dump por segurança, mas não é o prod vivo.
- `WP_HOST_TYPE` = **EXTERNO** (não-Docker) → **Ramo B**. `WP_DB_*` e uploads a obter no painel de hospedagem do `artificiorpg.com`.
- `CF_TUNNEL` = atual no telegram (descartado, D022). Só DNS export (T8).
- **Fora do backup (D021):** `gerenciador_telegram`, `foundry`.

## Arquivos afetados (este projeto)
- Cria: `specs/001-infra-backup-runbook/{spec,plan,tasks}.md`, `sessoes/26-06-03_1_infra_backup-runbook.md`.
- Gera (fora do repo): conteúdo em `C:\projetos\artificiobackup\`.
- Atualiza: `.specify/memory/project-state.md` (Gate A), `sessoes/index.md`.
- **Nenhum** arquivo de runtime tocado. Backup não muda a VM.

## Contratos/interfaces tocados
Nenhum de aplicação. Toca infra (leitura) + cria repos GitHub para `links`/`servidorvirtual`.

## Aprovações necessárias (AGENTS — pétrea)
Cada execução na VM e transferência exige bloco de aprovação. Agrupar por etapa:
- **[APROVAÇÃO 1]** rodar dumps + tars na VM (escreve em `/tmp` da VM; read-only no DB).
- **[APROVAÇÃO 2]** transferir VM → `artificiobackup` (`scp`/`rsync`/RaiDrive).
- **[APROVAÇÃO 3]** `git push` dos repos novos (links/servidorvirtual).

## Rollback
Backup é read-only: sem rollback. Se uma etapa falhar, repetir. Nada na VM é alterado/destruído. Staging em `/tmp` pode ser limpo após verificação.

## Validação (prova de que funciona)
1. `sha256sum -c CHECKSUMS.sha256` no destino → tudo OK.
2. Restore-test: subir `postgres:16-alpine` scratch, `pg_restore` de 1 dump, `SELECT count(*)` numa tabela conhecida > 0.
3. WP: `gunzip -t wp-db.sql.gz` OK; `tar -tzf uploads.tar.gz | wc -l` plausível; `jq length rest-api/posts.json` ≈ total WP.
4. `secrets.7z` abre com a senha; conteúdo confere; `git status` limpo de segredos.
