# Mapa de Infraestrutura — VM Oracle (verificado 2026-06-03)

> Saída da T1 (spec 001). **Referência canônica do que existe na VM.** Atualizar se mudar. Evita re-rodar inventário (economia de token). Acesso: `ssh faren` (ver AGENTS → Acesso à VM).

## Host
- **Alias SSH:** `faren` (também `oracle`, `ubuntu`, IP) → Oracle Cloud, **ARM `aarch64`**, Ubuntu 24.04, Docker 29.1.3.
- **Disco:** `/dev/sda1` 146G, **23G usados / 123G livres** (16%). Recriar → 200G.
- **Rede Docker compartilhada:** `gerenciador_telegram_default` (bridge). Tunnel e serviços públicos passam por ela.

## Postgres do G1 (4 bancos → 4 dumps)
| Container | DB | User | Volume | Tamanho |
|---|---|---|---|---|
| `mesas-beta-db` | `mesas_rpg` | `admin` | `mesas-beta_pgdata_mesas_beta` | 77MB |
| `mesas-db` | `mesas_rpg` | `admin` | `mesas_pgdata_mesas_prod` | 70MB |
| `glossario-beta-db` | `glossario_v2` | `admin` | `glossario-beta_pgdata_beta` | 72MB |
| `glossario-db` | `glossario_v2` | `admin` | `glossario_pgdata_prod` | 85MB |
| _(órfão)_ | — | — | `glossario_pgdata_producao` (LINKS=0, legado) | 49MB |

Stacks em `/opt/`: `glossario/` (prod), `glossario-beta/`, `mesas/` (prod), `mesas-beta/`. Cada um com compose `.yml/.beta/.prod/.producao`.

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
- Atual: `gerenciador_telegram-cloudflared-1`, definido em `/opt/gerenciador_telegram/docker-compose.yml`. Roteia o tráfego público hoje.
- **Como o telegram morre, o tunnel velho morre junto.** Fase 1 cria um **tunnel novo** para a instância G1 (D022). Backup só do **DNS export** (T8) para saber todos os hostnames a re-apontar. Token velho **não** precisa de backup.

## Estimativa de backup total
G1 (dumps+volumes) < 1GB · WP uploads 6.34GB · gerenciador_telegram pg 1.35GB · foundry 1.9GB · libs/config ~1GB → **~11–12GB**. Destino `C:\projetos\artificiobackup` (300GB livre) folga.
