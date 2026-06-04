# 002 — Fase 1: recriar VM limpa, centrada no Artifício

- **Módulo:** infra · **Gate:** pós-A (Gate A ✅ D031)
- **Nível SDD:** Completo · **Caminho:** recriação completa (D034, supera D033/resize)

## Problema
Refazer a VM do zero, **sem dependência do telegram** (era o 1º projeto). A nova VM é do projeto **Artifício**: nomes, rede e tunnel próprios. Restaurar **só o reconstruível** — código, `.env`, bancos (tudo no backup G1 validado). `telegram`/`foundry` **não** voltam (rebuild futuro do GitHub). Site `artificiorpg.com` (Hostinger) independe da VM — segue no ar. Free-tier não roda 2x A1 → terminar a atual antes de criar a nova (downtime de glossário/mesas aceito).

## Requisitos
1. **Terminar VM atual** + **criar nova**: boot **200GB**, ARM `aarch64` (A1), Ubuntu 24.04. IP novo. Backup G1 é a rede de segurança.
2. Base limpa: Docker + compose plugin; rede **`artificio_net`** (sem nome telegram, D035).
3. **Tunnel Cloudflare novo, standalone** (próprio do Artifício, fora de stack de app); ingress p/ `glossariorpg.`, `mesas.`, `mesasbeta.`.
4. Restaurar DBs **via `pg_restore` dos dumps** (`-Fc`, portável). Deploy glossário + mesas (beta+prod) do backup (`opt-dirs/` + `.env` do `secrets.7z`), **composes editados p/ `artificio_net`**.
5. DNS Cloudflare re-apontado pro tunnel novo.
6. Alias SSH atualizado pro IP novo (`~/.ssh/config`).
7. Estrutura limpa em `/opt/artificio/<serviço>` (sem entulho do telegram).

## Critérios de aceite
- [ ] `glossariorpg.`/`mesas.`/`mesasbeta.artificiorpg.com` → 200.
- [ ] Dados conferem (ex.: glossário `terms`, contagens batem com backup).
- [ ] `df -h /` ≈ 200GB.
- [ ] Rede `artificio_net` + tunnel novo; **zero** referência a telegram na VM nova.
- [ ] `ssh` conecta no IP novo.

## Fora de escopo
Monorepo/G1 novo (Fases 2+), site/`accounts.`/`srd`/`esferas`/`downloads`, rebuild do telegram/foundry. Aqui: restaurar glossário+mesas numa VM nova limpa.

## Riscos
- **Downtime** glossário/mesas na janela (site independe). Aceito.
- **IP novo** → atualizar ssh + tunnel é novo de qualquer forma. Baixo.
- **Arch/endian** → mitigado: `pg_restore` dos dumps, não volume tar.
- **Rede renomeada** → editar composes (mecânico, Codex).
- **Creds vazadas** (PAT/WP/`.env`) → **rotacionar** ao subir o novo (não reusar as antigas).
