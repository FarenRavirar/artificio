# Plano — 002 Fase 1 (recriar VM limpa)

## Divisão
- **Mantenedor (console Oracle + Cloudflare):** terminar/criar VM, tunnel novo, DNS. Opus guia.
- **Codex (software na VM):** Docker, rede, restore, deploy, smoke. Opus valida.

## Sequência
1. **[Mantenedor·Oracle]** Terminar a VM atual → criar nova: ARM A1 (mesmo OCPU/RAM), **boot 200GB**, Ubuntu 24.04, região atual. Anotar **IP novo**. (Backup G1 = segurança.)
2. **[Mantenedor]** `~/.ssh/config`: trocar `HostName` (faren/oracle/ubuntu) pro IP novo. `ssh faren echo ok`.
3. **[Codex CDX-201]** Base: instalar Docker + compose; `docker network create artificio_net`.
4. **[Mantenedor·Cloudflare]** Criar **tunnel novo** (nome ex. `artificio`); pegar o **token**. Opus monta o `cloudflared` standalone.
5. **[Codex CDX-202]** `cloudflared` standalone (compose em `/opt/artificio/cloudflared`) com o token (env, não logar); ingress p/ os 3 hostnames.
6. **[Codex CDX-203]** Copiar backup `artificiobackup\2026-06-04\` → VM nova; extrair `opt-dirs/*` em `/opt/artificio/<svc>`; restaurar `.env` do `secrets.7z`.
7. **[Codex CDX-204]** `pg_restore` dos 4 dumps em containers limpos (role `admin`; `mesas_rpg`/`glossario_v2` beta+prod).
8. **[Codex CDX-205]** Editar composes p/ rede `artificio_net` → `docker compose up` glossário+mesas (beta+prod).
9. **[Mantenedor·Cloudflare]** DNS: re-apontar `glossariorpg`/`mesas`/`mesasbeta` pro tunnel novo.
10. **[Codex CDX-206]** Smoke: 3 subdomínios 200 + contagens DB batem.

## Restore (crítico)
DBs **dos dumps** (`pg_restore -Fc`), portável/arch-safe — não copiar `pgdata` tar. Volume tars = fallback.

## Estrutura nova (limpa, sem telegram)
`/opt/artificio/{cloudflared,glossario,glossario-beta,mesas,mesas-beta}`. Rede `artificio_net`. Tunnel próprio. **Nada de telegram.**

## Decisões em aberto (mantenedor, console)
- Shape A1: mesmo OCPU/RAM (provável 4/24)? 
- Boot 200GB único (recomendado) vs boot+block.
- Região: manter (latência/IP).

## Segurança
**Rotacionar** ao subir: senhas dos `.env` (DB/JWT/OAuth/Cloudinary), WP DB+FTP, PAT GitHub. Não reusar as do backup. Tunnel token = novo.

## Rollback
VM antiga só é terminada no passo 1 (decisão consciente; backup cobre). Se o restore falhar, re-tentar dos dumps/volume tars. Nada irrecuperável (backup íntegro off-VM).
