# Runbook de Deploy G1 (esteira `_deploy-module`)

> Deploy canônico = GitHub Actions (D039/D041). VM manual só bootstrap/diagnóstico/rollback aprovado.
> Blindagens da esteira: spec 009. Cicatrizes: D041 (nunca `down` por prefixo global), flock, snapshot, rollback.
>
> **Esteira consolidada (spec 026 F4/F5):** os antigos `deploy-{mesas,glossario,site,accounts}.yml`
> foram REMOVIDOS e substituídos por **um único `deploy.yml` declarativo** que lê
> `.github/deploy-manifest.json` (1 entrada por módulo). Dispatch agora é SEMPRE no `deploy.yml`
> com input `module` + `mode` (+ `env` opcional). NÃO existe mais dispatch por `deploy-<modulo>.yml`.
> `break-glass-deploy-prod.yml` segue chamando `_deploy-module.yml` direto (emergência).

## Bootstrap por módulo — inventário local

O passo a passo da **primeira subida** de cada módulo (`glossario`, `site`,
`downloads`, `links`, e o caso genérico de módulo novo) vive em
`docs/agents-internal/deploy-runbook-bootstrap.md`, fora do repositório.

Não é fragmentação por gosto: aquelas seções são inventário — hostname,
container, porta, volume e variável de env, por módulo e por ambiente. Publicá-las
entregaria o mapa do que existe na VM. O que vale como **regra** e não como alvo
está aqui e em `deploy-flow.md`:

- `.env.<env>` (gitignored) precisa existir na VM **antes** do `up`; a esteira faz
  `git reset --hard`, que não o cria.
- `JWT_SECRET` do módulo tem de ser idêntico ao do `accounts` do mesmo clone
  (SSO compartilhado, D042) — o deploy recusa se divergir.
- `POSTGRES_PASSWORD` só grava na **primeira init** do volume (E009); em volume
  reaproveitado, tem de ser exatamente o segredo original.
- Beta antes de prod: o clone de produção só recebe o módulo depois de `main`
  contê-lo.
- Dispatch é sempre `deploy.yml` com `module` + `mode`; não existe mais
  `deploy-<modulo>.yml`.
- **Não** subir container à mão para "validar" antes do deploy — cria leftover de
  outro projeto compose.

## `accounts` — PROD-only, sem realm de ensaio (D042)

**Leia antes de propor qualquer validação do SSO em "beta".** O `accounts` é o
único módulo cuja mudança não pode ser ensaiada em outro ambiente antes de
produção. Isto é decisão firme (D042), não pendência de infra:

- Manifesto: `env_override: "prod"`, `push_branches: ["main"]`,
  `auto_deploy_on_push: false` (dispatch-only).
- A build-matrix **bloqueia** `workflow_dispatch` com `env=beta` para `accounts`.
- **Não existe `accountsbeta.artificiorpg.com`.** Os módulos beta (`mesasbeta.`,
  `glossariobeta.`, `downloadsbeta.`, `beta.`) redirecionam login para o
  `accounts` de **produção** e validam o cookie com o `JWT_SECRET` de prod.
- Os campos `*_beta` do manifesto (`compose_file_beta`, `db_service_beta`,
  `critical_routes_beta`) **espelham os de prod por defensividade e nunca são
  exercitados**. Ler esses campos como "existe um beta" é o erro clássico aqui.

Consequência operacional: mudança em `accounts` ou `packages/auth` só é exercida
de verdade no deploy de prod, com o SSO de todos os apps dependendo dele. Por
isso o gate correto é **diagnosticar antes**, não ensaiar depois:

**Coordenadas exatas** (errar qualquer uma custa uma rodada de tentativa/erro;
todas confirmadas contra a VM):

| O que | Valor | Erro comum |
|---|---|---|
| Container do banco | `<ACCOUNTS_DB>` | **não** tem sufixo `-prod` |
| Nome do banco | `<AUTH_DB>` | **não** é `accounts` |
| Container da app | `<ACCOUNTS_API>` | — |
| Coluna da ledger | `schema_migrations.migration_name` | **não** é `version` nem `filename` |
| Coluna de identidade em `users` | `google_sub` | **não** é `google_id` |
| Porta do Postgres | **não exposta** (`docker port <ACCOUNTS_DB>` vazio) | túnel SSH local é bloqueado pelo harness |

Acesso read-only, sempre permitido, sem aprovação:
```bash
ssh <VM_ALIAS> "docker exec <ACCOUNTS_DB> psql -U <DB_USER> -d <AUTH_DB> -tAc \"<query>\""
```

1. **Antes de deployar, conferir o Dockerfile contra dependência nova** — ver
   §Dockerfile de produção abaixo. É a checagem que faltava aqui quando o SSO caiu
   em 2026-08-08.
2. **Inspeção read-only do banco** — conferir que o schema real satisfaz o que o
   preflight e o drift vão exigir:
   ```bash
   ssh <VM_ALIAS> "docker exec <ACCOUNTS_DB> psql -U <DB_USER> -d <AUTH_DB> \
     -c \"select table_name from information_schema.tables where table_schema='public' order by 1\""
   ssh <VM_ALIAS> "docker exec <ACCOUNTS_DB> psql -U <DB_USER> -d <AUTH_DB> \
     -c 'select migration_name, applied_at from schema_migrations order by 1'"
   ```
   Contagem de pendentes **não fica registrada aqui de propósito**: envelhece a
   cada merge. Medir na hora, contra `apps/accounts/database/*.sql`.
3. **Atenção histórica:** até a spec 090 o `accounts` **não usava o runner de
   migrations** — o schema nascia no boot do container. Ausência de
   `schema_migrations` **não** é motivo para baseline manual: o runner cria a
   ledger antes de listar pendências. Baseline (`--mark-applied`) só entra quando
   o efeito da migration **já está** no banco e falta apenas o registro.
   Afrouxar o drift nunca é opção.
4. Deploy: `gh workflow run deploy.yml --ref main -f module=accounts -f mode=deploy -f env=prod`.
   O job roda drift **e** `critical_routes` — é o que fecha smoke e drift juntos.

### Quando o deploy falha: o que o rollback automático faz, e o que NÃO faz

Medido no incidente de 2026-08-08 (run `31238673567`). O `rollback()` de
`_deploy-module.yml` restaura o **snapshot do banco** e recria os containers.
**Não reverte código:** o clone em `<CLONE_PROD>` já fez
`git reset --hard origin/main`, então recriar sobe a **mesma imagem quebrada** e o
loop continua. Ler "ROLLBACK: tentativa concluida" no log e assumir que voltou ao
estado anterior é o erro.

Consequências práticas, todas verificadas:

- **Não existe imagem anterior para voltar.** `docker images` mantém só a `latest`
  do build novo, e não há dangling. Rollback por imagem **não é opção**.
- **`deploy.yml` não aceita ref/SHA.** Os inputs são `module`, `mode`, `env`,
  `allow_manual_migrations`, `max_auto_pending`. O `--ref` do `gh workflow run`
  escolhe a branch **do workflow**; o script na VM reseta para `origin/main`
  (hardcoded por env). Deployar um commit antigo exige mover `main`.
- **O único caminho é para frente:** corrigir, PR, promote, dispatch.

### Janela de perda de dados no rollback (débito conhecido)

`pg_restore --clean --if-exists` só derruba o que está **no dump**, e o snapshot é
tirado **antes** das migrations, com a aplicação antiga ainda servindo — o
`docker compose down` só vem depois. Medido em 2026-08-08: **4min51s** entre
`snapshot_created` (04:06:58) e `ROLLBACK` (04:11:49).

Um rollback restaura o dump e **apaga toda escrita dessa janela**. Naquele
incidente custou zero (nenhum cadastro nos 5 minutos), mas o risco é real com
tráfego. Efeito colateral do mesmo mecanismo: tabela criada por migration que
rodou **depois** do snapshot sobrevive ao `--clean` (não está no dump) e vira
**drift reverso** — banco à frente da ledger. Não bloqueia redeploy se a migration
for idempotente (`IF NOT EXISTS` / `CREATE OR REPLACE`), que é o padrão exigido.

Upgrade futuro, se isolar auth virar necessário: Opção 2 de D042 (`accountsbeta`
com `JWT_SECRET` próprio e cookie distinto `artificio_session_beta`). Enquanto não
for feito, **não existe atalho**.

## Dockerfile de produção — dependência de pacote workspace (E016/E017)

**Três incidentes, mesma classe.** Pacote `@artificio/*` vira dependency de um
app, o Dockerfile de produção não o cobre, CI passa verde e o container crasha em
runtime com `MODULE_NOT_FOUND` — direto em beta ou prod. E016 (`resend`), E017
(`catalog-matching`), e 2026-08-08 (`sanitize-html`, SSO em 502 para todo o
portal).

**Dois mecanismos distintos de falha, e confundi-los custa a sessão inteira:**

1. **`COPY` faltando** — o `dist` do pacote não chega na imagem. É o E016/E017.
2. **Store podado pelo `--filter`** — o `dist` está lá, mas as **dependências
   externas dele** não. Foi 2026-08-08.

O segundo é contraintuitivo e foi o que atrasou o diagnóstico: dentro da imagem
quebrada, `packages/content-editor/node_modules/sanitize-html` **existia** — como
symlink para `.pnpm/sanitize-html@2.17.6`, cujo alvo tinha sido removido.
`pnpm install --prod --filter <X>` mantém no `.pnpm` só o que os pacotes filtrados
precisam; quem fica de fora vira symlink órfão. Contraste que confirma:
`zod`/`kysely`/`express` (dos filtrados) sobreviveram.

**Dependência transitiva conta.** `apps/accounts` não importa `content-editor` em
lugar nenhum — quem importa é `packages/comments`, que o app importa. Auditar só
o que `src/` importa direto não enxerga isso.

**O gate cobre os dois mecanismos**
(`scripts/ci/check_dockerfile_workspace_deps.mjs`, job
`guard-dockerfile-workspace-deps` em `pr-checks.yml`). Resolve fecho transitivo,
cobra `COPY dist`/`dist-cjs` e cobra `--filter` mais os `test -d` das deps
externas. Roda local com `node scripts/ci/check_dockerfile_workspace_deps.mjs`.

> **O gate já teve buraco silencioso.** Até 2026-08-08 ele procurava
> `FROM ... AS production` **pelo nome**; `apps/accounts/Dockerfile` chama os
> stages de `deps`/`build`/`runtime`, então o app era **pulado sem avisar** —
> nunca foi conferido, em nenhum PR. Hoje casa o **último `FROM`** (posição, não
> nome) e cobre 6 imagens. Ao criar app novo, conferir que ele aparece na saída do
> gate: ausência é o modo de falha, não o erro.

**Guard no Dockerfile: `test -d` por dependência, mais um import real.** `test -d`
segue symlink e falha quando o alvo sumiu — pega o caso do store podado. Mas só
prova pasta a pasta; o import do `dist` prova a **cadeia inteira** resolver:
```dockerfile
RUN node --input-type=module -e "import('/app/packages/comments/dist/index.js')"
```
Verificado dentro da imagem quebrada de 2026-08-08: devolve `EXIT=1`. Teria
barrado o build. Falhar aqui quebra o **build**; falhar em runtime quebra o SSO.

**Validar sem Docker local** (Docker Desktop costuma estar fora; `accounts` não
tem stage chamado `production`, então `--target production` nem se aplica). Roda o
install real numa imagem limpa, na VM:
```bash
ssh <VM_ALIAS> "docker run --rm -v <CLONE_PROD>:/src:ro node:24-alpine sh -c '
  cp -r /src /repo; cd /repo
  rm -rf node_modules apps/*/node_modules packages/*/node_modules
  corepack enable && corepack prepare pnpm@11.8.0 --activate
  pnpm install --prod --filter @artificio/<pkg> --frozen-lockfile --ignore-scripts
  test -d packages/<pkg>/node_modules/<dep> && echo OK || echo FALHA'"
```
Foi assim que se provou o defeito (sem o filtro, `ls .pnpm/sanitize-html*` →
`No such file`) e a correção (com o filtro, os três presentes).

## Blindagens ativas (spec 009)
- **R1 reconcile:** antes do 1º `up`, remove container de nome esperado pertencente a outro projeto compose (leftover). Não toca volume nem containers de outro nome.
- **R1b opt-in same-project orphan:** para bootstrap legado com mesmo compose project e service label antiga, `_deploy-module.yml` pode rodar `down --remove-orphans` no project alvo antes do primeiro `up`. Usar só quando o modulo optar explicitamente.
- **R2 guard exec-bit:** `pr-checks` falha se `ENTRYPOINT/CMD ["./*.sh"]` referenciar `.sh` não-`100755` no git. Corrigir: `git add --chmod=+x <arquivo>`.
- **R3:** erro de `.env` ausente instrui o bootstrap; este runbook.
- **R4:** resumo de smoke/health no `GITHUB_STEP_SUMMARY` do run.

## Contrato Real IP do ingress (spec 023 / D069)
Todo app publico atras do Cloudflare Tunnel deve seguir o contrato unico:

- Caminho esperado: Cloudflare edge -> Tunnel -> `cloudflared` na `<DOCKER_NET>` -> app.
- Subnet atual da `<DOCKER_NET>`: `<DOCKER_SUBNET>` (verificada por `docker network inspect <DOCKER_NET>` em 2026-06-15).
- Apps nginx (`mesas`, `glossario`): definir `TRUSTED_REAL_IP_FROM=${TRUSTED_REAL_IP_FROM:-<DOCKER_SUBNET>}` no compose; no nginx usar `set_real_ip_from ${TRUSTED_REAL_IP_FROM}` + `real_ip_header CF-Connecting-IP`; repassar `X-Forwarded-For $remote_addr`.
- Apps Express direto ou atras de nginx (`accounts`, `site`, backends de `mesas`/`glossario`): definir `TRUSTED_PROXY_CIDR=${TRUSTED_PROXY_CIDR:-<DOCKER_SUBNET>}`; usar esse valor em `app.set("trust proxy", ...)`.
- Nunca usar `$proxy_add_x_forwarded_for` nesta topologia: ele anexa o hop do tunnel/nginx e pode fazer o Express rate-limitar todo mundo no mesmo balde.
- Nunca repassar `X-Forwarded-For $http_cf_connecting_ip` como contrato duravel: funciona para IP real, mas aceita header cru antes de validar o hop confiavel.
- Validar local: `node scripts/ci/check_ingress_realip_contract.mjs`.
- Validar pos-deploy: `nginx -t` nos apps nginx, config renderizada sem os padroes proibidos, health/smoke publico e rotas 401 esperadas.

## Deploys simultâneos podem falhar em `cannot lock ref` (sem dano, mas o container não é recriado)

Sintoma medido em 2026-08-15 (site/mesas/downloads em beta, disparados juntos):
dois passaram, o do `site` abortou com `exit 1` no step `Deploy module on VM`:
```
error: cannot lock ref 'refs/remotes/origin/dev': is at ea363f7a but expected 500da4b8
 ! 500da4b8..ea363f7a  dev -> origin/dev  (unable to update local ref)
```
**O perigo é a falha ser silenciosa do ponto de vista do smoke:** o clone fica no
commit certo, as rotas seguem 200, mas o container **não é recriado** e continua
servindo código velho. Verificar sempre por dentro, não pelo status do run:
```bash
ssh <VM_ALIAS> "docker ps --filter name=<mod> --format '{{.Names}}\t{{.Status}}'"  # idade delata
ssh <VM_ALIAS> "docker exec <mod>-app sh -c 'grep -c \"<trecho novo>\" /repo/<arquivo>'"
```

**Não é falta de `+`/force no refspec — hipótese medida e descartada.** O clone da
VM tem `remote.origin.fetch = +refs/heads/*:refs/remotes/origin/*` (conferido com
`git config --get-all`), então o `+` já se aplica. `cannot lock ref` é outra
camada: a verificação de valor antigo (compare-and-swap) do `git update-ref`, que
grava só se o ref ainda estiver no valor lido antes — e aborta a transação inteira
se outro processo mudou no intervalo. O `+` governa política de fast-forward, não
atomicidade de escrita. Ref: `git-scm.com/docs/git-update-ref`.

**Também não é "paralelismo é abuso":** `_deploy-module.yml:341` usa `flock -s`
(lock **compartilhado** da VM) e `:347` um lock exclusivo **por módulo** — deploys
de módulos diferentes em paralelo são o desenho.

**Agravante presente no clone:** `.git/packed-refs` é de 2026-06-05 e declara
`origin/dev`/`origin/main` num commit obsoleto, divergente dos refs soltos. É
fator conhecido desta classe de erro, e o timeout de lock do `packed-refs` é de
1 s por padrão — janela pequena, compatível com dois fetches quase simultâneos.

**Contorno confiável hoje:** serializar — um módulo por vez, ou redisparar sozinho
o que perdeu a corrida. **Correção definitiva ainda não aplicada nem aprovada**
(candidatos medidos na documentação, não neste repo: `git pack-refs --all` para
reconciliar, e/ou elevar `core.packedRefsTimeout`). Não aplicar sem aprovação
nominal: é escrita no clone de deploy.

## Estado sujo na VM (diagnóstico/limpeza)
Conferir antes de limpar (read-only):
```bash
docker inspect <container> --format 'name={{.Name}} image={{.Config.Image}} project={{index .Config.Labels "com.docker.compose.project"}}'
docker ps -a --filter "name=<modulo>" --format '{{.Names}}\t{{.Image}}\t{{.Status}}'
docker volume ls | grep -i <modulo>
```
Remoção cirúrgica (nomes exatos, nunca pipe-delete às cegas; volume só se vazio/incorreto):
```bash
docker rm -f <container-app> <container-db>
docker volume rm <projeto>_<volume>
```

## Recriar só o `-api` à mão derruba a API pública do módulo (nginx cacheia o IP do upstream)

**Vale para todo módulo front+back separado** (`downloads`, `mesas`): o tunnel só
conhece o container de app; o nginx dele faz `proxy_pass http://<mod>-api:3000`
para toda a `/api/`. O worker do nginx resolve esse nome **uma vez, no boot**, e
guarda o IP. Recriar só o `-api` (`docker compose up -d --force-recreate <mod>-api`)
troca o IP na rede docker e **toda a API pública passa a 502**, enquanto a home
segue 200 — o que faz o incidente parecer problema de tunnel ou de rota.

Medido em 2026-08-15 no `downloads` prod, durante rotação de credencial.

**Como confirmar que é isto, e não o tunnel** (o teste que separa os dois):
```bash
# de DENTRO do app: resolve na hora, funciona -> descarta DNS/rede
ssh <VM_ALIAS> "docker exec <mod>-app sh -c 'wget -qO- --timeout=5 http://<mod>-api:3000/api/v1/health'"
# o processo nginx, porém, registra o IP velho:
ssh <VM_ALIAS> "docker logs --tail 20 <mod>-app 2>&1 | grep -i 'connect() failed'"
#   -> connect() failed (111: Connection refused) while connecting to upstream
```
**Correção:** `docker restart <mod>-app` (reresolve o nome). Health volta a 200.

**O deploy pela esteira não tem esse problema** — recria app e api juntos.
Confirmado no mesmo dia pelo `glossario` (mesma topologia, deploy verde, zero
502) e pelo próprio `downloads` no deploy seguinte. A regra vale só para
recriação manual de container isolado.

**Pista falsa a descartar:** `Unable to reach the origin service` no log do
`cloudflared` é genérico e aparece em qualquer janela de recriação. Conferir o
`dest=` antes de atribuir ao módulo errado — em 2026-08-15 os erros no log eram
do `links` (deploy simultâneo), não do `downloads` que estava sendo diagnosticado.

## Rotação de senha / volume Postgres (E009)
Postgres grava a senha em `pg_authid` **só na primeira init** do volume (`POSTGRES_PASSWORD`). Trocar a senha no `.env` de um módulo cujo volume **já existe** NÃO reescreve o `pg_authid` → app conecta pela rede docker (`pg_hba: host all all all scram-sha-256`), senha não bate, `28P01 password authentication failed` em loop, container `nao ficou healthy`.

- **Criar `.env` na VM sem corromper bytes:** here-string + `ssh '<host> cat > apps/<mod>/.env'` e validar (`wc -c` / hash esperado). **Nunca** `ssh "...$(grep ...)..."` em PowerShell double-quotes — `\n` vira literal e quebra senha/URL (causa-raiz das 3 falhas do links em 2026-06-21).
- **Senha do volume já existe e não bate:**
  - DB **vazio** (1ª subida, sem dado): `docker rm -f <app> <db>` + `docker volume rm <projeto>_pgdata_<env>` + re-disparar deploy → re-init com `.env` correto.
  - DB **com dado**: `docker exec <db> psql -U <DB_USER> -d <db> -c "ALTER USER <DB_USER> PASSWORD '<senha do .env>'"` (não destrutivo) + `docker restart <app>`.
- **Diagnóstico de auth:** testar **pela rede docker** (scram), nunca `psql -h 127.0.0.1` — `pg_hba` tem localhost como `trust` e aceita qualquer senha (falso positivo). Comparar senhas por `sha256sum` dos últimos chars, nunca imprimir o valor.

## Migrations
- mesas: `apps/mesas/database/` (aplicadas pelo `apply_required_migrations.sh`, frameworkado).
- downloads: `apps/downloads/database/` (aplicadas pelo `apply_required_migrations.sh`, mesmo framework do mesas; sem `init.sql` estático — DB nasce vazio e as migrations numeradas fazem todo o schema).
- site: migra **no entrypoint do container** (`db/migrations/`), não pela esteira. **Atualizado pela spec 090:** o runner não é mais "no-op gracioso" quando o diretório falta — diretório ausente virou `exit 1` (T1.11/T1.12, causa do E018, que mascarou `015`/`016` por 7 dias em beta e prod). O site é **excluído nominalmente** por `if [ "$MODULE" = "site" ]` em `_deploy-module.yml`; qualquer outro módulo sem diretório de migrations **quebra o deploy de propósito**.
- glossário: migrations legadas ficam em `apps/glossario/database/legacy/`; fora do glob `migration_*.sql` do runner, no-op até uma baseline explícita (D059).
- accounts: `apps/accounts/database/` pelo runner padrão **a partir da spec 090** — antes o schema nascia no boot do container (`migrate.ts`, removido em T0.12). Quais migrations existem e quais estão pendentes **não ficam listadas aqui**: `ls apps/accounts/database/` contra `select migration_name from schema_migrations` dá a resposta atual, e qualquer lista escrita aqui envelhece no próximo merge. Ver §`accounts` — PROD-only.
  - **Aplicar a migration não basta para trocar mecanismo.** A `007` criou `community_service_credential`, mas trocar o `SERVICE_SECRET` exigiu emitir e distribuir credenciais (T2.2a-op) — passo separado, com aprovação própria. Vale para toda migration que só prepara o schema de uma feature.

## Credenciais de serviço (`SERVICE_CREDENTIAL`) — spec 090 T2.2a

**Quais credenciais existem não fica registrado aqui** — envelhece a cada emissão
ou revogação. Medir na hora:
```bash
ssh <VM_ALIAS> "docker exec <ACCOUNTS_DB> psql -U <DB_USER> -d <AUTH_DB> -tAc \
  \"select token_id, source_app, realms, rotation_slot, scopes, \
          revoked_at is not null as revogada, revoked_reason \
    from community_service_credential order by source_app, created_at\""
```
Cuidado com o nome da coluna: é **`realms`** (array), não `realm` — o singular dá
`column does not exist`.

**Selecionar `rotation_slot` e `token_id` não é zelo: sem eles a leitura inverte
o sentido do que está na tela.** Uma consulta que traz só `source_app`/`revogada`
mostra "uma ativa e uma revogada" e não diz qual papel cada uma tem — e a
conclusão intuitiva (*sobrou a antiga, revogaram a nova*) é o oposto do que
significa. Ver §Como ler o par `current`/`next` abaixo.

**O que era, e por que mudou.** `SERVICE_SECRET` é um segredo **único e global**:
medição de 2026-08-04 encontrou o **mesmo digest** em `accounts`, `downloads` e
`mesas`, tanto em `<CLONE_PROD>` (prod) quanto em `<CLONE_BETA>`. Seis
serviços, dois realms, uma chave. Consequências: o mesmo valor abre
`/internal/users/:id` **e** `/admin/secrets/:name` (que devolve segredo
decifrado), vazar um app compromete todos, e rotacionar exigiria trocar seis
`.env` ao mesmo tempo — por isso, na prática, nunca foi rotacionado.

**O que substitui.** `community_service_credential` guarda
`token_id` (público) + `token_hash` (Argon2id) + `source_app` + `realms` +
`scopes`. O header vira `X-Service-Token: <token_id>.<segredo>`, e a resolução
devolve **identidade**, não `true/false` — é daí que `realm` e `source_app` são
derivados, nunca do payload.

**Variáveis por serviço:**
- `SERVICE_CREDENTIAL` — credencial registrada, formato `<token_id>.<segredo>`.
  **Valor próprio de cada app e de cada realm**; nunca reaproveitar entre apps nem
  entre beta e prod. **Obrigatória (`:?`)** nos compose dos consumidores desde o
  fim de T2.2a-op — o deploy falha no boot se a variável não existir, que é o
  comportamento correto para credencial: sem ela o serviço não autentica, e subir
  degradado esconderia o problema.
- `SERVICE_SECRET` — **legado removido do código** em T2.2a-op (2026-08-07):
  `serviceToken.ts` foi deletado junto com o fallback, quando ficou sem chamador.
  O nome ainda aparece em `.env` da VM como **resíduo em arquivo**, não como
  credencial viva — `docker inspect` do container em execução confirma que a
  variável não está no ambiente. Não voltar a tratá-lo como caminho de
  autenticação.

Consomem: `accounts` (valida), `downloads` (**6 escopos desde 2026-08-15**:
`users.read`, `secrets.read`, `comment.read`, `report.write`, `moderation.write`,
`notification.write`), `mesas` (`secrets.read`, api e cron). O `site` **tem credencial registrada mas
ainda não consome**: nenhum `SERVICE_CREDENTIAL` no compose dele, e o app não
importa `@artificio/comments`. A credencial de `beta` nasceu do smoke da T2.6c e
serve à integração de T3.9b (Fase 3) — presença no banco sem `:?` no compose é
preparação, não pendência.

**Emitir (dentro do container do `accounts`, `DATABASE_URL` no ambiente):**
```bash
node dist/scripts/serviceCredentialAdmin.js issue \
  --source-app downloads --realm prod --slot next \
  --scopes users.read,secrets.read,comment.read,report.write,moderation.write,notification.write
node dist/scripts/serviceCredentialAdmin.js list
node dist/scripts/serviceCredentialAdmin.js revoke --token-id <id> --reason "rotação AAAA-MM-DD"
```
O segredo é impresso **uma única vez** e não é recuperável — o banco guarda só o
hash. Perder o valor exige emitir outra credencial.

**Capturar o segredo sem imprimi-lo no terminal do agente** (§AGENTS.md proíbe
expor segredo em saída). Redirecionar para arquivo na VM e mascarar o eco:
```bash
ssh <VM_ALIAS> "docker exec <ACCOUNTS_API> node dist/scripts/serviceCredentialAdmin.js issue \
  --source-app <mod> --realm <realm> --slot next --scopes <lista> \
  --description '<motivo>' > /tmp/cred.out 2>/tmp/cred.err; echo exit=\$?; \
  cat /tmp/cred.err; sed -E 's/(X-Service-Token: [a-z0-9-]+)\..*/\1.<OCULTO>/' /tmp/cred.out"
# publicar sem trafegar o valor: extrai do arquivo direto para o .env
ssh <VM_ALIAS> "cd <deploy_dir>/apps/<mod> && cp .env<sufixo> .env<sufixo>.bak-\$(date +%Y%m%d) && \
  novo=\$(grep '^X-Service-Token: ' /tmp/cred.out | sed 's/^X-Service-Token: //') && \
  test -n \"\$novo\" && sed -i \"s|^SERVICE_CREDENTIAL=.*|SERVICE_CREDENTIAL=\$novo|\" .env<sufixo>"
```
**O nome do arquivo de env difere por realm** (medido em 2026-08-15): beta usa
`.env.beta`, prod usa **`.env`** (não `.env.prod`). Assumir o mesmo nome nos dois
edita arquivo inexistente e o container sobe com a credencial velha, sem erro.

**Escopo novo exige que o `accounts` em prod já o conheça.** Emitir com um escopo
que o build em execução não tem falha com `erro: escopo inválido: <escopo>` e
`exit=1`, **antes** do `INSERT` — nada é gravado. Foi o que aconteceu em
2026-08-15 com `notification.write`: o container rodava build anterior às
migrations `010`/`011`, e a lista de `SERVICE_SCOPES` do `dist` tinha 7 dos 8
escopos. O `CHECK` de `scopes` na tabela recusaria igual. Conferir antes:
```bash
ssh <VM_ALIAS> "docker exec <ACCOUNTS_API> sh -c 'grep -o \"<escopo>\" dist/serviceCredential.js | head -1'"
ssh <VM_ALIAS> "docker exec <ACCOUNTS_DB> psql -U <DB_USER> -d <AUTH_DB> -tAc \
  \"select pg_get_constraintdef(oid) like '%<escopo>%' from pg_constraint \
    where conrelid='community_service_credential'::regclass and conname like '%scope%'\""
```
Se faltar, o pré-requisito é **deploy do `accounts` em prod** (aplica as migrations
pelo runner padrão), não ajuste no script.

**Rotação sem downtime** (janela `current` + `next`; inverter a ordem derruba o
consumidor):
1. `issue --slot next` — a `current` segue ativa e atendendo;
2. publicar o novo valor em `SERVICE_CREDENTIAL` do consumidor e reiniciar;
3. confirmar tráfego pela nova (`list` mostra `último uso`);
4. só então `revoke` a antiga, com motivo.

**O passo 3 é o gargalo real da rotação, não o passo 1** (medido em 2026-08-15,
rotação do `downloads` em beta e prod — as duas pararam aqui). `last_used_at` só
grava quando algum consumidor de fato autentica, e **nem todo consumidor é
acionável por requisição pública**: no `downloads`, `resolveUserEmail` só dispara
em moderação de material e `getSecret('deepseek_api_key')` só na ingestão
(`languageDetector.ts`, cache de 5 min). Todas as rotas que os acionam exigem
`authMiddleware + requireRole('admin')`. Consequência: **navegar no site não
destrava a rotação** — e revogar sem o passo 3 derruba o consumidor.

Caminhos que fecham o passo 3, em ordem de preferência:
- **Esperar o job agendado que usa a credencial.** No `downloads`, o
  `scraperScheduler` roda `'0 4 * * *'` e a ingestão chama o detector de idioma
  por item — exercita `secrets.read` sem intervenção humana. Conferir
  `last_used_at` depois do horário.
- **Uma ação real na UI** pelo mantenedor (abrir fila de moderação, moderar um
  material) — imediato, mas exige pessoa logada.
- **Nunca** presumir uso a partir de container saudável ou rota pública em 200:
  ambos ficam verdes com a credencial nova jamais exercitada.

### Como ler o par `current`/`next` — uma `current` ativa é o repouso, não sobra

**O estado normal de qualquer par `(source_app, realm)` é: uma `current` ativa,
mais o histórico de `next` revogadas ao lado.** Rotação encerrada e rotação
abortada terminam no **mesmo estado** — a `current` atendendo —, porque a `next`
sai revogada nos dois casos: no encerramento ela virou a nova `current`; no
aborto ela foi descartada. A tabela não distingue os dois, e não precisa.

Consequência prática, medida em 2026-08-11: `site` aparecia com uma credencial
ativa e uma revogada com motivo `"smoke T2.6c encerrado"`. Lido sem
`rotation_slot`, parece que revogaram a nova e esqueceram a velha viva — e a
correção "óbvia" seria revogar a que ficou. Com `rotation_slot` na consulta, o
mesmo dado diz o contrário: a revogada era a **`next`**, a ativa é a **`current`**,
e o par está em repouso normal, idêntico a `downloads` e `mesas`. **Nada a
corrigir.**

**Antes de propor revogar qualquer credencial ativa, checar as quatro:**

1. **Qual é o `rotation_slot`?** `current` ativa é o estado esperado. Só `next`
   ativa e parada, sem rotação em curso, é candidata a revisão.
2. **Revogar é irreversível.** `serviceCredentialAdmin.js` expõe apenas
   `issue|list|revoke` — **não existe `unrevoke`**. O segredo em claro é impresso
   uma vez e o banco guarda só o hash Argon2id, então "voltar atrás" significa
   `issue` novo, `token_id` novo e redistribuição ao consumidor.
3. **A linha nunca é apagada.** `migration_007:118-121`: revogada sai do índice
   único parcial e **permanece na tabela** — apagá-la destruiria a trilha de qual
   credencial escreveu o quê. `DELETE` não é opção, em nenhum cenário.
4. **Quem vai precisar dela depois?** Credencial emitida antes da integração
   existir é preparação, não resíduo. `site` tem credencial de `beta` desde o
   smoke da T2.6c e a integração dele é **T3.9b** (Fase 3, sino no header) —
   revogar hoje só adianta trabalho de reemissão.

**Credencial sem uso recente não é, por si, credencial indevida.** `last_used_at`
parado marca ausência de tráfego, não superfície aberta: o que mede risco é o par
`realms`+`scopes`. Uma credencial de `beta` com `comment.write,comment.read` não
alcança segredo (`secrets.read`) nem e-mail (`users.read`) — o pior caso é
escrever comentário em assunto de beta. Avaliar o escopo antes de tratar como
incidente.

**Quando a revisão for legítima, a via correta é rotacionar, não revogar avulso:**
`issue --slot next` → trocar o consumidor → confirmar tráfego → `revoke` a
`current`. A revogação vem **depois** da confirmação, que é a ordem dos passos
acima; revogar antes é o erro que causa indisponibilidade.

**Nunca imprimir o segredo em log, erro ou notificação.** Para comparar valores
entre `.env`, usar `sha256sum` e mostrar só os primeiros caracteres do digest.

⚠️ **`docker restart` NÃO aplica variável nova do `.env`.** Medido em 2026-08-05
ao distribuir `SERVICE_CREDENTIAL`: depois de reiniciar os cinco serviços, `env`
dentro do container ainda mostrava `SERVICE_CREDENTIAL=0`. `restart` recria o
**processo** com o ambiente original do container; quem relê o arquivo é
`docker compose up -d`, que **recria o container**. Consequência prática: editar
`.env` + `restart` parece ter funcionado (serviço saudável, sem erro) e não
aplicou nada — falso-verde que só aparece quando alguém depende da variável.

Depois de qualquer edição de `.env`, **conferir dentro do container** antes de
declarar concluído, sem imprimir valor:
```bash
docker exec <container> sh -c 'env | grep -c NOME_DA_VAR'   # 1 = chegou
```
O caminho canônico para aplicar é o `deploy.yml` do módulo (rastro no Actions);
`docker compose up -d` manual é exceção e exige aprovação própria.

## Promoção a prod
`promote-prod-fast-forward.yml` (dispatch + confirmação), preserva `main ⊆ dev`. Nunca squash/merge commit em `dev→main`.

Comando (a confirmação é literal, e o workflow recusa qualquer outro valor):
```bash
gh workflow run promote-prod-fast-forward.yml -f confirm=PROMOTE_DEV_TO_MAIN
```
Existem **dois** workflows com "promote" no nome: `promote-dev-to-main.yml` é só o
PR standing de revisão (roda em `push` para `dev`); o canônico é o
`promote-prod-fast-forward.yml`.

Conferir antes que é fast-forward de verdade:
```bash
git fetch origin && git merge-base --is-ancestor origin/main origin/dev \
  && echo "ff possivel" || echo "divergiu — NAO promover"
git log --oneline origin/main..origin/dev | wc -l   # quantos commits entram
```

**Promover não deploya — trava já registrada em `AGENTS.md`, repetida aqui porque
é onde se erra.** O promote só move o ponteiro de `main`; não builda nem recria
container. Depois dele, **cada módulo ainda exige `workflow_dispatch` próprio** com
`--ref main -f env=prod`. Corolário medido em 2026-08-15: deployar `accounts`/`links`
(que só têm realm prod, e portanto saem de `main`) **antes** do promote sobe
exatamente o código que já estava no ar — o run fica verde e nada muda. Conferir
que o artefato pretendido existe em `main` antes de disparar:
```bash
git ls-tree -r --name-only origin/main -- apps/<mod>/database/ | tail -3
```
