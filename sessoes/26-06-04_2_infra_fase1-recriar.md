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
**Fase 1 ✅ concluída (smoke 200).** VM nova `164.152.39.46` (aarch64/Ubuntu24/193G), Docker+`artificio_net`, tunnel Cloudflare correto conectado, glossário+mesas restaurados e no ar, dados intactos (glossário prod 8808 terms / beta 8785; mesas 48 tab), sem telegram/foundry.
**Smoke:** `glossariorpg=200`, `mesas=200`, `mesasbeta=200`.

## Rotas do tunnel (Public Hostnames — dashboard, config remota via token)
| Hostname | Service |
|---|---|
| `glossariorpg.artificiorpg.com` | `http://glossario-app:80` |
| `mesas.artificiorpg.com` | `http://mesas-app:80` |
| `mesasbeta.artificiorpg.com` | `http://mesas-beta-frontend:80` |
(glossário beta: adicionar se houver hostname próprio → `http://glossario-beta-app:80`.)

## CDX-205 (refinada) — subir TODOS os serviços ✅
`docker compose up -d` completo em cada `/opt/artificio/{glossario,glossario-beta,mesas,mesas-beta}` (app/api/frontend + db). **✓ Validar:** `docker ps` ~10 containers up, sem telegram. Reportar `docker ps --format "{{.Names}} {{.Status}}"`.

### CDX-207 — Smoke final + fechar rastreabilidade ✅
**a) Smoke:**
```bash
for h in glossariorpg mesas mesasbeta; do echo -n "$h: "; curl -s -o /dev/null -w "%{http_code}\n" "https://$h.artificiorpg.com"; done
ssh faren 'docker ps --format "{{.Names}} {{.Status}}"'
```
**✓ Validar:** os 3 = **200** + todos containers up (sem telegram). Se algum ≠200 → parar e reportar o container/log.

**b) Rastreabilidade (só se smoke 200):** editar docs:
1. `sessoes/26-06-04_2_infra_fase1-recriar.md` → marcar CDX-205/206/207 `✅`; "Estado atual" = `Fase 1 ✅ concluída (smoke 200)`.
2. `sessoes/index.md` → linha `26-06-04_2` status `concluída (Fase 1 ✅)`.
3. `.specify/memory/project-state.md` → trocar a linha de "Fase atual" por:
   `**Fase 2 — monorepo + SSO (início).** Fase 1 ✅ (VM limpa, glossário/mesas no ar 200, dados intactos, sem telegram). Próximo: scaffold monorepo + accounts. (Opus desenha).`
4. `.specify/memory/decisions.md` → append `D036 | 2026-06-04 | Fase 1 concluída: VM nova limpa (artificio_net, tunnel próprio), glossário+mesas restaurados e no ar, sem telegram | smoke 200 | firme`.
**Reportar:** os 3 códigos + confirmação dos 4 arquivos editados.

## 🔴 Rotacionar (vazaram): chave privada + `CHAVES_PRODUCAO.txt` (estavam nos deploy dirs/backup) · tunnel token · PAT GitHub · WP creds. Limpar também do `artificiobackup`.

## Log Opus
- 2026-06-04 — CDX-201..204 validados ✅ (dados intactos, 8808 terms). Falta CDX-205 (apps) + CDX-206 (rotas+smoke). Rotas mapeadas acima. Alerta: chave privada + CHAVES_PRODUCAO.txt vazaram no backup → rotacionar/limpar.

## Log Codex
- 2026-06-04 — CDX-201 testado/corrigido: `Host faren` aponta para `164.152.39.46`; `IdentityFile` trocado para `C:/projetos/Secrets/ssh-key-MINHAVM.key`; ACL da chave restringida ao usuário local; host key nova aceita. Validação passou: `ok`, `aarch64`, `Ubuntu 24.04.4 LTS`.
- 2026-06-04 — CDX-202 concluído e validado: Docker instalado/habilitado na VM nova (`Docker version 29.5.3, build d1c06ef`); rede `artificio_net` criada/listada (`bridge`, `local`).
- 2026-06-04 — VM minimal atualizada (`apt update/upgrade`) e pacotes base instalados: `ca-certificates curl git unzip p7zip-full postgresql-client jq htop nano rsync tree ufw`.
- 2026-06-04 — CDX-203 concluído e validado: backup `2026-06-04` copiado para `/home/ubuntu/bk`; `/opt/artificio/{glossario,glossario-beta,mesas,mesas-beta}` restaurado; 4 `.env` instalados; compose files presentes. Limpeza pós-restore: removidos dos deploy dirs arquivos sensíveis/entulho `ssh-key-*privada.key` e `CHAVES_PRODUCAO.txt` (backup original preservado).
- 2026-06-04 — Revisão pós-CDX-203: disco `/` = `193G` com `191G` livre; Docker/rede OK; 4 `.env` oficiais presentes; achados `.env.backup*` antigos sob `/opt/artificio` (prováveis segredos velhos) e `/var/run/reboot-required` presente após upgrade. Próximo recomendado antes do CDX-204: remover `.env.backup*` dos deploy dirs e rebootar VM limpa.
- 2026-06-04 — Pré-CDX-204: removidos 17 `.env.backup*` dos deploy dirs; VM rebootada; SSH voltou; Docker e `artificio_net` OK; `/var/run/reboot-required` ausente.
- 2026-06-04 — CDX-204 exigiu antecipar a troca mecânica de rede nos composes (`gerenciador_telegram_default` → `artificio_net`) porque DB service não subia sem a rede antiga. Backup `.bak-cdx-net` criado ao lado dos composes alterados; grep validou zero referência antiga.
- 2026-06-04 — CDX-204 concluído e validado: DB containers subidos via compose (`glossario-db`, `glossario-beta-db`, `mesas-db`, `mesas-beta-db`); primeiro `pg_restore --clean` falhou em mesas por `uuid-ossp` dependente, corrigido com `DROP SCHEMA public CASCADE` + recriação de schema e restore sem `--clean` nos 4 DBs frescos. Validação: `glossario-db` 14 tabelas/`terms=8808`; `glossario-beta-db` 14 tabelas/`terms=8785`; `mesas-db` 48 tabelas/`activity_log=22`; `mesas-beta-db` 48 tabelas/`activity_log=67`.
- 2026-06-04 — CDX-206 parcial (conexão tunnel): token Cloudflare salvo fora do repo em `C:\projetos\artificiobackup\cloudflare-tunnel-token.txt` e na VM em `/opt/artificio/cloudflared/.env` (`600`); container `cloudflared` standalone subido em `artificio_net`. Validação: container `Up`; tunnelID `db5ece8c-b482-470c-b358-181920014243`; 4 conexões registradas (`gru13`, `gru17`, `gru20`, `gru19`); prechecks DNS/UDP/TCP/API = `PASS`. Token vazou no chat → rotacionar após migração.
- 2026-06-04 — CDX-206 correção: tunnel anterior era de conta Cloudflare errada. Container `cloudflared` removido/recriado com token correto (conta com domínio). Token atualizado em `C:\projetos\artificiobackup\cloudflare-tunnel-token.txt` e `/opt/artificio/cloudflared/.env` (`600`). Validação: container `Up`; tunnelID correto `6417d3a0-b98b-42ed-97da-3fb9f6ecfac2`; 4 conexões registradas (`gru02`, `gru07`, `gru08`, `gru07`); prechecks DNS/UDP/TCP/API = `PASS`. Token novo também vazou no chat → rotacionar depois.
- 2026-06-04 — CDX-205 concluído e validado: apps/API/frontends subidos (`glossario-app`, `glossario-api`, `glossario-beta-app`, `glossario-beta-api`, `mesas-app`, `mesas-api`, `mesas-cron`, `mesas-beta-frontend`, `mesas-beta-api`) + 4 DBs + `cloudflared`; nenhum container telegram. Ajuste necessário: `frontend/dist` do glossário havia sido excluído no backup, então foi regenerado via container `node:20-alpine` antes do compose.
- 2026-06-04 — CDX-207 concluído e validado: smoke público retornou `200` para `glossariorpg.artificiorpg.com`, `mesas.artificiorpg.com`, `mesasbeta.artificiorpg.com` em 5 tentativas; containers up/healthy e sem telegram. Rastreabilidade atualizada em `sessoes/26-06-04_2_infra_fase1-recriar.md`, `sessoes/index.md`, `.specify/memory/project-state.md`, `.specify/memory/decisions.md` (D036).
