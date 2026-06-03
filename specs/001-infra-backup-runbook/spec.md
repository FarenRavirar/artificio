# 001 — Backup total (Fase 0, caminho do Gate A)

- **Módulo/Pacote:** infra (Cloudflare/Oracle/Docker/Postgres/WordPress)
- **Gate relacionado:** **A** (backups completos/verificados/off-VM → libera recriar instância Oracle)
- **Nível SDD:** Completo

## Problema
A instância Oracle vai ser recriada (150→200GB). Antes de destruir qualquer coisa, todo o estado precisa estar copiado **fora da VM**, íntegro e restaurável. Hoje há serviços vivos (glossário, mesas, WordPress, links/servidorvirtual) com bancos e mídia que **não podem ser perdidos**. Cloudinary é externo (persiste), mas credenciais e DNS/tunnel precisam ser preservados.

## Requisitos (numerados, testáveis)
1. **Inventário** completo da VM: containers, volumes, redes, compose files, uso de disco, versões, e **onde o WordPress roda** (Docker na VM vs host externo).
2. **Dumps Postgres** de todos os bancos: glossário (beta+prod) e mesas (beta+prod), em formato custom (`-Fc`), restauráveis.
3. **WordPress integral**: DB (`mysqldump`), `wp-content/uploads` (~6.34GB), `wp-config.php`, **+** export via WP REST API em JSON (insumo do importador da Fase 3).
4. **Código sem GitHub**: `links.artificiorpg.com` + `servidorvirtual.artificiorpg.com` (página TS) → backup **e** push para repositório GitHub novo.
5. **Volumes Docker** nomeados: `tar.gz` de cada (pgdata, frontend_dist, etc.).
6. **Segredos**: todos `.env`, OAuth client secrets, JWT secrets, token do Cloudflare Tunnel, PAT GHCR, senhas de DB → **bundle encriptado** (AES-256), nunca em texto plano no git.
7. **Cloudflare**: export de DNS (todos os registros) + config do tunnel (`cloudflared`).
8. **Cópia off-VM**: tudo em `C:\projetos\artificiobackup\<AAAA-MM-DD>\`, com **manifesto** + **checksums SHA-256**.
9. **Verificação**: restore-test de ≥1 dump Postgres num container scratch (responde `SELECT`) + checagem pontual do WP (DB abre, uploads contam ~6.34GB, REST JSON parseia).

## Critérios de aceite (Gate A)
- [ ] `MANIFEST.md` lista todo item com tamanho + SHA-256.
- [ ] Checksums batem entre VM (origem) e `artificiobackup` (destino).
- [ ] ≥1 dump Postgres restaurado em container scratch e responde `SELECT`.
- [ ] WP: DB restaurável, `uploads.tar.gz` ≈ 6.34GB, REST JSON com contagem ≈ `X-WP-Total`.
- [ ] Segredos no `secrets.7z` (AES-256); `git status` não mostra nenhum segredo.
- [ ] Cópia em `C:\projetos\artificiobackup` confirmada (tamanho + checksum).
- [ ] **Aprovação explícita do mantenedor** → marca Gate A em `project-state.md`.

## Fora de escopo
- Recriar/redimensionar a instância (Fase 1, **só pós-Gate A**).
- Backup de mídia do Cloudinary (externo, persiste — só preservar credenciais).
- Migração/import de conteúdo (Fase 3).

## Riscos e impacto
- **WP host desconhecido** (Docker na VM vs hospedagem externa) → resolvido na Task 1; runbook tem os dois ramos.
- **Dump de prod sob carga** → `pg_dump`/`mysqldump` são consistentes (snapshot); rodar em janela calma. **Não desligar nada** (sem `docker stop`).
- **Segredo vazar em texto plano** → encriptar (R6); `.gitignore` já exclui `.env/*.key/secrets*`.
- **Transferência longa** (6.34GB) → `rsync` resumível ou cópia via RaiDrive (drive montado).
- **Espaço destino**: ~10–15GB total; `C:` tem 300GB livre → folga.
- **Acesso DB via RaiDrive = read-only** (D010); dumps rodam na VM via `docker exec`.
