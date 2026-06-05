# GitHub Actions Secrets — Artificio G1

> Operacional. Registra nomes, caminhos e validacoes. Nunca colocar valores aqui.

## Escopo
Secrets de CI/CD do repo `FarenRavirar/artificio`.

Fluxo canonico: `docs/agents/deploy-flow.md`.

`deploy-accounts.yml` ainda e transicional. Modulos novos devem usar `_deploy-module.yml` + `deploy-<modulo>.yml`.

## Repo GitHub
```text
https://github.com/FarenRavirar/artificio
Settings -> Secrets and variables -> Actions -> Repository secrets
```

Secrets esperados:
```text
ACCOUNTS_ENV
DEPLOY_HOST
DEPLOY_KNOWN_HOSTS
DEPLOY_PORT
DEPLOY_SSH_PRIVATE_KEY
DEPLOY_USER
```

Validado por `gh secret list --repo FarenRavirar/artificio` em 2026-06-04: os 6 nomes existem. Valores nao foram lidos.

## Cofre Local
Pasta fora do git:
```text
C:\projetos\Secrets\artificio
```

Arquivos de referencia:
```text
C:\projetos\Secrets\artificio\accounts.env
C:\projetos\Secrets\artificio\deploy-known-hosts
```

`accounts.env` deve conter:
```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_CALLBACK_URL
PUBLIC_URL
COOKIE_DOMAIN
JWT_SECRET
JWT_REFRESH_SECRET
POSTGRES_PASSWORD
DATABASE_URL
```

`deploy-known-hosts` deve conter entradas limpas para:
```text
164.152.39.46
```

Validado localmente em 2026-06-04:
```text
accounts.env: 9/9 chaves presentes
deploy-known-hosts: 3 linhas nao-comentadas para 164.152.39.46
```

## Deploy De Modulos

Workflow reutilizavel:
```text
.github/workflows/_deploy-module.yml
```

Secrets compartilhados por modulo:
```text
DEPLOY_HOST
DEPLOY_KNOWN_HOSTS
DEPLOY_PORT
DEPLOY_SSH_PRIVATE_KEY
DEPLOY_USER
```

Regra:
```text
PR = CI/checks; deploy real = workflow_dispatch mode=deploy.
```

O workflow nao imprime valor de segredo e nao instala pacote na VM. Prereqs da VM ficam no bootstrap documentado em `deploy-flow.md`.

## SSO Accounts
Dominio publico:
```text
https://accounts.artificiorpg.com
```

OAuth callback:
```text
https://accounts.artificiorpg.com/api/auth/google/callback
```

Cloudflare:
```text
tunnel: 6417d3a0-b98b-42ed-97da-3fb9f6ecfac2
rota: accounts.artificiorpg.com -> http://accounts-api:3000
```

Arquivo OAuth antigo/de backup:
```text
C:\projetos\artificiobackup\accounts-oauth.env
```

## VM Deploy
Destino:
```text
/opt/artificio/accounts
```

Servicos Docker:
```text
accounts-db
accounts-api
```

Rede:
```text
artificio_net
```

Validado em 2026-06-04:
```text
accounts-api em artificio_net
cloudflared em artificio_net
probe na artificio_net -> http://accounts-api:3000/health = 200
```

## Politica De Segredo
Proibido:
```text
imprimir secrets em log
commitar .env
commitar JSON OAuth
commitar chave SSH privada
commitar senha de banco
commitar JWT_SECRET/JWT_REFRESH_SECRET
colar valores em issue/PR/chat/doc publico
```

Workflow deve validar presenca por tamanho/existencia, nunca por valor.

## Sucesso
Antes de usar o workflow para deploy real:
```text
1. Build local/Actions passa.
2. Workflow confirma 6 secrets presentes sem imprimir valor.
3. Workflow conecta na VM por SSH sem prompt.
4. Workflow escreve /opt/artificio/accounts/.env com permissao 600.
5. Workflow confirma 9 chaves esperadas no .env sem valor.
6. accounts-api e cloudflared estao na artificio_net.
7. https://accounts.artificiorpg.com/health retorna 200.
8. https://accounts.artificiorpg.com/login retorna 200.
9. /api/auth/me sem cookie retorna 401.
```
