# Glossario

Modulo do Grande Glossario de RPG dentro do monorepo Artificio RPG. O codigo veio do legado `glossario_rpg_artificio`; dados vivos continuam no banco `glossario_v2`.

## Deploy

Workflow: `.github/workflows/deploy-glossario.yml`, via `_deploy-module.yml`.

Bootstrap seguro:
- Fazer primeiro o BETA em `dev`: `gh workflow run deploy-glossario.yml --ref dev -f mode=deploy`.
- Nao fazer PROD enquanto `origin/main` nao contiver `apps/glossario`.
- Nao mexer em `glossariorpg.artificiorpg.com` durante o bootstrap beta.
- O redirect `glossariorpg.` -> `glossario.` e uma etapa posterior.

Nota do primeiro cutover beta: os containers legados usam `project=glossario-beta`, mas service labels antigas (`app-beta`/`api-beta`/`db-beta`). O workflow ativa `reconcile_same_project_orphans` em `dev`, removendo esses orphans com `docker compose down --remove-orphans` sem apagar volumes antes de subir o DB novo.

## Env files na VM

BETA:
```text
/opt/artificio-beta/apps/glossario/.env.beta
```

PROD futuro:
```text
/opt/artificio/apps/glossario/.env
```

Chaves esperadas:
```text
POSTGRES_USER=admin
POSTGRES_PASSWORD=<segredo do volume legado>
POSTGRES_DB=glossario_v2
JWT_SECRET=<igual ao accounts do mesmo clone>
ADMIN_EMAIL=<email admin>
ALLOWED_ORIGINS=
BETA_READONLY_MEMBERS=true
```

Nunca imprimir valores reais. Validar por presenca/fingerprint.

## Volumes preservados

- BETA: `glossario-beta_pgdata_beta`
- PROD: `glossario_pgdata_prod`

O `POSTGRES_PASSWORD` precisa ser o mesmo que inicializou o volume legado correspondente; se divergir, o Postgres nao sobe/autentica.

## Rotas Tunnel

- BETA: `glossariobeta.artificiorpg.com` -> `http://glossario-beta-app:80`
- PROD futuro: `glossario.artificiorpg.com` -> `http://glossario-app:80`
- Legado intocado no bootstrap: `glossariorpg.artificiorpg.com`

## Validacao pos-deploy BETA

```bash
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' | grep -Ei 'glossario-beta'

docker inspect glossario-beta-app glossario-beta-api glossario-beta-db \
  --format 'name={{.Name}} project={{index .Config.Labels "com.docker.compose.project"}} service={{index .Config.Labels "com.docker.compose.service"}} image={{.Config.Image}} networks={{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' 2>/dev/null

curl -I -L --max-time 20 https://glossariobeta.artificiorpg.com/
curl -I -L --max-time 20 https://glossariobeta.artificiorpg.com/api/terms

docker exec glossario-beta-api wget -qO- http://localhost:3000/health 2>/dev/null || \
docker exec glossario-beta-api curl -fsS http://localhost:3000/health 2>/dev/null || true
```

Tambem validar busca e login no browser. Como o `JWT_SECRET` muda para o mesmo segredo do `accounts`, tokens antigos do glossario legado podem expirar; novo login e aceitavel e transitorio.
