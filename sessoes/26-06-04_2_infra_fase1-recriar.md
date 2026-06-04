# Sessão 26-06-04_2 — infra: Fase 1 recriar VM limpa

- **Data:** 2026-06-04 · **Módulo:** infra · **Gate:** pós-A
- **Objetivo:** VM nova 200GB, limpa, centrada no Artifício (sem telegram). Restaurar glossário+mesas do backup.
- **Spec:** `specs/002-fase1-instancia/` · **Decisões:** D034, D035 · **Backup:** `C:\projetos\artificiobackup\2026-06-04\`

## Parâmetros
- Alias SSH: `faren` · chave nova: `C:/projetos/Secrets/ssh-key-MINHAVM.key` · IP novo: **<mantenedor preenche>**
- Rede: `artificio_net` · Estrutura: `/opt/artificio/<svc>` · Tunnel: novo, standalone
- Bancos: `mesas-*-db` → `mesas_rpg` (admin) · `glossario-*-db` → `glossario_v2` (admin)

---

## Tarefas para Codex
> Gatilho: "realize as tarefas para codex na sessão". Ordem. **Cada uma: rodar `✓ Validar` antes de retornar; só reporta se passou.** VM nova é Ubuntu **fresh** (sem Docker/composes — vêm do backup).

### CDX-201 — Atualizar `~/.ssh/config` + testar acesso  ⬜
Editar o bloco `Host faren` em `C:\Users\paulo\.ssh\config`: `HostName <IP_NOVO>` (mantenedor informa) e `IdentityFile "C:/projetos/Secrets/ssh-key-MINHAVM.key"`. Mesmo p/ `oracle`/`ubuntu` se existirem.
**✓ Validar:** `ssh -o BatchMode=yes faren 'echo ok; uname -m; lsb_release -ds'` → `ok` + `aarch64` + Ubuntu 24.04. **Reportar:** a saída.

### CDX-202 — Docker + rede (VM nova)  ⬜  `[sudo → aprovação]`
```bash
ssh faren 'curl -fsSL https://get.docker.com | sudo sh; sudo usermod -aG docker ubuntu; sudo systemctl enable --now docker; docker network create artificio_net; docker --version; docker network ls | grep artificio_net'
```
(se `docker` exigir sudo até relogar, usar `sudo docker` nesta tarefa.)
**✓ Validar:** `docker --version` ok + `artificio_net` listada. **Reportar:** as duas linhas.

### CDX-203 — Copiar backup + restaurar estrutura  ⬜
```bash
DATA=2026-06-04
ssh faren 'sudo mkdir -p /opt/artificio && sudo chown ubuntu:ubuntu /opt/artificio'
scp -r "/c/projetos/artificiobackup/$DATA" faren:/home/ubuntu/bk
ssh faren 'cd /home/ubuntu/bk/opt-dirs; for d in glossario glossario-beta mesas mesas-beta; do mkdir -p /opt/artificio/$d; tar xzf $d.tar.gz -C /opt/artificio/; done; ls -la /opt/artificio'
```
Restaurar `.env`: extrair `secrets.7z` (senha em `C:\projetos\artificiobackup\secrets-7z-password.txt`) e colocar cada `*.env` no `/opt/artificio/<svc>/.env` correspondente. **wp-hostinger.env** fica guardado (Fase 3).
**✓ Validar:** `ls /opt/artificio/{glossario,glossario-beta,mesas,mesas-beta}/docker-compose*.yml` existem + cada `.env` presente. **Reportar:** árvore de `/opt/artificio`.

### CDX-204 — Restaurar bancos via pg_restore (dos dumps)  ⬜
Para cada serviço, subir só o container de DB (do compose restaurado) e restaurar o dump correspondente. Padrão por banco:
```bash
# exemplo glossario prod (repetir p/ os 4: glossario_prod, glossario_beta, mesas_prod, mesas_beta)
ssh faren 'cd /opt/artificio/glossario && docker compose up -d <servico-db>; sleep 8;
docker exec -i <glossario-db> sh -c "psql -U admin -d glossario_v2 -c \"\\dt\"" || true;
docker exec -i <glossario-db> pg_restore -U admin -d glossario_v2 --clean --if-exists < /home/ubuntu/bk/postgres/glossario_prod.dump'
```
(role `admin` já vem nos composes via `POSTGRES_USER`. Ajustar nomes de container/serviço conforme cada compose.)
**✓ Validar:** em cada banco, `psql -U admin -d <db> -c "\\dt" | wc -l` > 0 e contagem de tabela-chave (glossário: `select count(*) from terms`) > 0. **Reportar:** nº de tabelas + count de `terms` (glossário) por banco.

### CDX-205 — Rede `artificio_net` nos composes + subir tudo  ⬜  `[deploy]`
Editar os `docker-compose*.yml` de `/opt/artificio/*`: trocar referência de rede externa `gerenciador_telegram_default` → `artificio_net`. Então `docker compose up -d` em cada serviço (glossário+mesas, beta+prod).
**✓ Validar:** `docker ps` mostra glossario/mesas (8 containers) healthy/up, **nenhum** telegram. **Reportar:** `docker ps --format "{{.Names}} {{.Status}}"`.

### CDX-206 — Tunnel novo + DNS + smoke  ⬜  `[mantenedor: tunnel/DNS]`
1. **[Mantenedor·Cloudflare]** criar tunnel novo (ex. `artificio`), pegar token; configurar DNS dos 3 hostnames apontando pro tunnel.
2. **[Codex]** `cloudflared` standalone em `/opt/artificio/cloudflared` (token via env/arquivo, **não logar**), ingress p/ `glossariorpg`→glossario-app, `mesas`→mesas-app, `mesasbeta`→mesas-beta-frontend (portas do compose).
```bash
ssh faren 'docker run -d --name cloudflared --restart=always --network artificio_net cloudflare/cloudflared:latest tunnel --no-autoupdate run --token <TUNNEL_TOKEN>'
```
**✓ Validar:** `curl -s -o /dev/null -w "%{http_code}" https://glossariorpg.artificiorpg.com` (e mesas/mesasbeta) = **200**. **Reportar:** os 3 códigos + `docker ps` do cloudflared.

---

## Estado atual
Spec 002 (recriar limpa) pronta. Aguardando: mantenedor cria VM nova + informa IP → Codex roda CDX-201..206. **Rotacionar PAT/WP/`.env` nesta virada.** telegram/foundry não voltam.

## Log Codex
- 2026-06-04 — CDX-201 testado/corrigido: `Host faren` aponta para `<IP_DA_VM>`; `IdentityFile` trocado para `C:/projetos/Secrets/ssh-key-MINHAVM.key`; ACL da chave restringida ao usuário local; host key nova aceita. Validação passou: `ok`, `aarch64`, `Ubuntu 24.04.4 LTS`.
- 2026-06-04 — CDX-202 concluído e validado: Docker instalado/habilitado na VM nova (`Docker version 29.5.3, build d1c06ef`); rede `artificio_net` criada/listada (`bridge`, `local`).
- 2026-06-04 — VM minimal atualizada (`apt update/upgrade`) e pacotes base instalados: `ca-certificates curl git unzip p7zip-full postgresql-client jq htop nano rsync tree ufw`.
- 2026-06-04 — CDX-203 concluído e validado: backup `2026-06-04` copiado para `/home/ubuntu/bk`; `/opt/artificio/{glossario,glossario-beta,mesas,mesas-beta}` restaurado; 4 `.env` instalados; compose files presentes. Limpeza pós-restore: removidos dos deploy dirs arquivos sensíveis/entulho `ssh-key-*privada.key` e `CHAVES_PRODUCAO.txt` (backup original preservado).
