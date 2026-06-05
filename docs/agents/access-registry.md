# Registro de Acesso & Segredos — Artifício RPG

> O "ter acesso / não ter acesso". Registra **onde** vivem credenciais e **quem/o quê** pode usá-las. **Nunca contém valores de segredo** — só localização e política. Valores ficam em `.env` (gitignored) e no `secrets.7z` (AES-256, off-VM).

## Acesso à infraestrutura
| Recurso | Como | Política |
|---|---|---|
| VM Oracle | `ssh faren` (chave em `~/.ssh/config` local) | Read-only sem aprovação; **write = aprovação pétrea** (AGENTS) |
| DB da VM (Postgres) | via `docker exec` / RaiDrive | Read-only padrão (D010); escrita = aprovação |
| GitHub | `gh` CLI | repos privados; PAT no bundle |
| Cloudflare | API token | DNS/tunnel; token no bundle |

## Inventário de segredos (locais, SEM valores)
| Segredo | Onde vive | Uso | Backup |
|---|---|---|---|
| `.env` de mesas (beta+prod) | `/opt/mesas*/.env` (VM) | OAuth, JWT, DB pass, Cloudinary, Discord | → `secrets.7z` |
| `.env` de glossário (beta+prod) | `/opt/glossario*/.env` (VM) | DB pass, JWT, etc. | → `secrets.7z` |
| WP Hostinger (DB + FTP) | `secrets.7z` (off-VM) | **Fase 3** (migração: media on-demand) | bundle |
| Cloudinary keys | `.env` dos serviços | upload de imagem (signed) | → bundle |
| GHCR PAT | bundle | pull de imagem na VM | bundle |
| Cloudflare token | bundle | DNS/tunnel | bundle |
| OAuth Google (client) | `C:\projetos\artificiobackup\accounts-oauth.env` (fora do git) + futuro env do `accounts.` | SSO | bundle |
| GitHub Actions deploy `accounts` | Repo secrets (`FarenRavirar/artificio`) + cofre local `C:\projetos\Secrets\artificio` | CI/CD e deploy VM | cofre local |
| Chave SSH `faren` | `*.key` local (gitignored) | acesso VM | **nunca no repo/bundle versionado** |

## GitHub Actions — `accounts`
Secrets cadastrados no repo `FarenRavirar/artificio` (valores nunca lidos/impressos):
```text
ACCOUNTS_ENV
DEPLOY_HOST
DEPLOY_KNOWN_HOSTS
DEPLOY_PORT
DEPLOY_SSH_PRIVATE_KEY
DEPLOY_USER
```

Cofre local sem git:
```text
C:\projetos\Secrets\artificio\accounts.env
C:\projetos\Secrets\artificio\deploy-known-hosts
```

Detalhe operacional: `docs/agents/github-actions-secrets.md`.

## Política (pétrea)
- **Agentes NUNCA** imprimem, ecoam, logam ou commitam segredo. Ler só via `env` em runtime.
- Filtrar saída de inventário: nunca exibir `*PASSWORD*|*TOKEN*|*SECRET*|*KEY*`.
- Segredo **jamais** no git. `.gitignore` cobre `.env/*.key/secrets*/client_secret*`.
- OAuth `accounts.`: `GOOGLE_CLIENT_SECRET` e JSON `client_secret_*.json` nunca entram em chat, issue, commit, log ou doc público. Docs registram só caminho/nomes de variáveis e client id público quando necessário.
- GitHub Actions: validar secrets só por nome/presença/tamanho. Nunca `echo` de `ACCOUNTS_ENV`, chave SSH, tokens JWT ou senha de banco.
- Bundle de segredos: **`secrets.tar.gz` plaintext** em `C:\projetos\artificiobackup` (fora do git), **sem encriptação por ora** (D030 — local-only, sem fricção). `wp-hostinger.env` idem (fora do git). **Encriptação real + ROTAÇÃO de todas as creds = obrigatório no setup da instância nova.** Pasta `artificiobackup` não pode ir pra cloud-sync.
- **Rotação obrigatória** de qualquer credencial exposta em chat/log (ex.: WP DB+FTP de 2026-06-03) **após a migração**.
- Princípio do menor privilégio: cada serviço só com os segredos que precisa; sem reuso de senha entre serviços no setup novo.

## Não ter acesso (explícito)
- Público / repo / front-end: **zero** segredo.
- `gerenciador_telegram`, `foundry`: fora do escopo G1 (D021) — não acessar/backupear.
- WP de produção: **só leitura** na migração; nunca escrita (até Gate C, que está adiado).
