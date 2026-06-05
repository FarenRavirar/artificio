# Mapa de Infraestrutura — VM Oracle (verificado 2026-06-04)

> Saída da T1 (spec 001). **Referência canônica do que existe na VM.** Atualizar se mudar. Evita re-rodar inventário (economia de token). Acesso: `ssh faren` (ver AGENTS → Acesso à VM).

## Host
- **Alias SSH:** `faren` (também `oracle`, `ubuntu`, IP) → Oracle Cloud, **ARM `aarch64`**, Ubuntu 24.04, Docker.
- **IP:** `164.152.39.46`.
- **Estrutura G1:** `/opt/artificio/<servico>`.
- **Rede Docker compartilhada:** `artificio_net` (bridge). Tunnel e serviços públicos passam por ela.

## Postgres do G1 (4 bancos → 4 dumps)
| Container | DB | User | Volume | Tamanho |
|---|---|---|---|---|
| `mesas-beta-db` | `mesas_rpg` | `admin` | `mesas-beta_pgdata_mesas_beta` | 77MB |
| `mesas-db` | `mesas_rpg` | `admin` | `mesas_pgdata_mesas_prod` | 70MB |
| `glossario-beta-db` | `glossario_v2` | `admin` | `glossario-beta_pgdata_beta` | 72MB |
| `glossario-db` | `glossario_v2` | `admin` | `glossario_pgdata_prod` | 85MB |
| _(órfão)_ | — | — | `glossario_pgdata_producao` (LINKS=0, legado) | 49MB |

Stacks em `/opt/artificio/`: `glossario/` (prod), `glossario-beta/`, `mesas/` (prod), `mesas-beta/`, `accounts/`.

## Regra operacional de deploy

Depois do CDX-309, `/opt/artificio` deve virar clone do monorepo. Deploy de código passa por GitHub Actions (`git fetch/reset` na VM, checks, secrets, health/smoke). SSH manual na VM fica para bootstrap do clone, instalação de utilitários operacionais, conexão, diagnóstico ou rollback aprovado. Não usar `scp`/bundle manual como caminho normal de deploy.

Pré-requisitos do bootstrap CDX-309 Parte C na VM: `git`, `docker`, `docker compose`, `flock`, `curl`, `jq`, `postgresql-client`/ferramentas PG via containers, clone `/opt/artificio`, remote `origin` GitHub e `.env` preservado por módulo. O workflow aborta se `jq` faltar; deploy não instala pacote com `sudo`.

## Accounts / SSO
| Item | Valor |
|---|---|
| Host público | `https://accounts.artificiorpg.com` |
| Container API | `accounts-api` |
| Container DB | `accounts-db` |
| Diretório | `/opt/artificio/accounts` |
| Rede | `artificio_net` |
| Callback OAuth | `https://accounts.artificiorpg.com/api/auth/google/callback` |
| Rota Cloudflare | `accounts.artificiorpg.com` → `http://accounts-api:3000` |

Smoke validado:
```text
https://accounts.artificiorpg.com/health -> 200
https://accounts.artificiorpg.com/login -> 200
https://accounts.artificiorpg.com/api/auth/me -> 401 sem cookie
```

## WordPress
- **Externo** (não está em Docker nesta VM). Backup = **Ramo B**: `mysqldump` remoto / plugin + WP REST API. Host/credenciais a obter (painel de hospedagem do `artificiorpg.com`).

## NÃO-G1 na mesma VM — FORA do backup (D021)
Mantenedor decidiu refazer do zero; **não backupear**:
| Item | O quê | Tamanho | Decisão |
|---|---|---|---|
| `gerenciador_telegram` | App Telegram: pg15 + redis + workers | pg 1.35GB | **Não backup** — está no GitHub, refaz do zero no futuro |
| `foundry/` (`/home/ubuntu`) | Foundry VTT | 1.9GB | **Não backup** — refaz do zero |

Backupear mesmo assim (pequeno, segurança): credenciais home (`.aws`, `.oci`, `.docker`, `.ssh`) → `secrets.7z`. Opcional: scripts ops (`auditoria.sh`, `testes.sh`). AI tooling (`.codex`/`.gemini`/`.antigravity`) = ignorar.

## Cloudflare Tunnel
- Atual: container standalone `cloudflared` em `/opt/artificio/cloudflared`.
- Tunnel: `6417d3a0-b98b-42ed-97da-3fb9f6ecfac2`.
- Rede: `artificio_net`.
- `accounts-api` e `cloudflared` estao na mesma rede. Probe em 2026-06-04: `http://accounts-api:3000/health = 200`.

## Estimativa de backup total
G1 (dumps+volumes) < 1GB · WP uploads 6.34GB · gerenciador_telegram pg 1.35GB · foundry 1.9GB · libs/config ~1GB → **~11–12GB**. Destino `C:\projetos\artificiobackup` (300GB livre) folga.
