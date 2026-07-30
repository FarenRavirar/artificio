# Erros Conhecidos — Artifício RPG

> Registro de erros/regressões e suas soluções validadas. Antes de tentar de novo, procure aqui por `E###` ou pelo sintoma. Ao resolver algo novo e não trivial, registre.

## Formato

```
### E001 — <título curto do sintoma>
- **Módulo/Pacote:** apps/srd | packages/auth | accounts (SSO) | infra/cloudflare | ...
- **Sintoma:** o que se observa.
- **Causa raiz:** diagnóstico validado.
- **Solução:** passos que resolveram (com evidência).
- **Prevenção:** como evitar de novo.
- **Data:** AAAA-MM-DD
```

## Registros

### E001 — serviço não sobe após restore (frontend `dist` ausente)
- **Módulo/Pacote:** infra · glossário (e qualquer serviço que sirva `dist` pré-buildado)
- **Sintoma:** após restaurar deploy dirs do backup, `docker compose up` falha/serve vazio porque `dist/` não existe.
- **Causa raiz:** backup dos `opt-dirs` excluiu `dist` (`--exclude=dist`); o serviço servia build pré-gerado, não buildava no deploy.
- **Solução:** rebuildar `dist` antes do up (ex.: `docker run --rm -v $PWD:/app -w /app node:20-alpine sh -c 'npm ci && npm run build'`), depois `docker compose up -d`.
- **Prevenção:** no redeploy, se o serviço serve `dist` pré-buildado, buildar primeiro; ou garantir que o compose tenha etapa de build.
- **Data:** 2026-06-04

### E002 — Dockerfile referencia arquivo não versionado (`nginx.conf.template`)
- **Módulo/Pacote:** apps/glossario (frontend) · padrão p/ qualquer módulo nginx
- **Sintoma:** `docker compose build glossario-*-app` falha no `COPY apps/glossario/frontend/nginx.conf.template` — arquivo ausente no commit (lido do legado mas não escrito no import). Bloqueia o deploy antes de criar a imagem.
- **Causa raiz:** import manual/robocopy do legado copiou `frontend/src/**` mas o `nginx.conf.template` fica em `frontend/` (fora de `src/`) e o Dockerfile foi escrito à mão referenciando-o.
- **Solução:** criar `apps/glossario/frontend/nginx.conf.template` (proxy `/api/` → `${API_UPSTREAM}`, SPA fallback). Achado pelo review do Codex no PR #14.
- **Prevenção:** ao escrever Dockerfile à mão, conferir que todo `COPY <path>` existe no git (`git ls-files <path>`); rodar `docker build` local quando houver Docker, senão grep dos COPY vs `git status`.
- **Data:** 2026-06-11

### E003 — runner de migrations do monorepo tenta aplicar migrations legadas em DB pré-migrado
- **Módulo/Pacote:** infra/CI-CD (`scripts/deploy/apply_required_migrations.sh`) · apps/glossario
- **Sintoma:** deploy do glossário falharia: `_deploy-module` roda `apply_required_migrations.sh ... database` que faz `find apps/<mod>/database -maxdepth 1 -name 'migration_*.sql'`; o DB `glossario_v2` vivo não tem a tabela `schema_migrations` do framework → as 12 migrations legadas viram "pending" → estoura `MAX_AUTO_PENDING=5` e/ou falha no `parse_header` (faltam `-- @class/@requires-backup/@author/@created/@description`).
- **Causa raiz:** o DB legado já foi migrado pelo fluxo próprio (manual/init.sql), não pelo framework `schema_migrations` do monorepo. As migrations históricas no path escaneado confundem o runner.
- **Solução:** mover `migration_*.sql` p/ `apps/glossario/database/legacy/` (fora do `maxdepth 1` do glob) → runner acha 0 pendentes → no-op (igual ao site, que migra no entrypoint). `init.sql` fica no topo (não casa o glob `migration_*`); só roda em volume novo (docker-entrypoint-initdb). Migrations viram registro histórico. Achado pelo review do Codex no PR #14.
- **Prevenção:** módulo importado com DB pré-migrado por fluxo próprio NÃO deve expor `migration_*.sql` no path do runner; deixar em `database/legacy/`. Se um dia adotar o framework, fazer baseline de `schema_migrations` no DB vivo + headers.
- **Data:** 2026-06-11

### E004 — `@types/multer@2` quebra build do mesas-backend (express 4 vs tipos express 5)
- **Módulo/Pacote:** apps/mesas (backend) — **pré-existente no `dev`**, exposto por CI
- **Sintoma:** `apps/mesas/backend/src/routes/upload.ts(25,40) TS2769: No overload matches this call` — `IRouterMatcher`/`RequestHandler` de `@types/express-serve-static-core@5.1.1` vs `@4.19.8`. Reproduzido em worktree limpo de `origin/dev` com `--frozen-lockfile`.
- **Causa raiz:** mesas usa `express ^4.19.2` + `@types/express ^4.17.21` (express 4), mas `@types/multer ^2.1.0` (par do multer 2.x) traz tipos de **express 5**; o `upload.single()` fica tipado contra express 5, incompatível com o router express 4.
- **Solução (PONTE aplicada 2026-06-11):** `pnpm.overrides` no root `package.json` — `"@types/multer>@types/express": "^4.17.21"` força o `@types/multer@2` a usar tipos express-4 (runtime do multer inalterado). `turbo build --filter=@artificio/mesas-backend --force` **verde**. **Fix definitivo = spec 016** (migrar mesas p/ express 5, D060) → ao migrar, **remover o override** (senão volta a divergir). Não fecha o E004; é unblock do CI/deploy.
- **Prevenção:** uma única major de express no monorepo (stack canônica). Não misturar express 4 e 5. CI de build deve rodar sem cache turbo mascarando (deploys via imagem podem esconder build TS quebrado).
- **Data:** 2026-06-11

### E005 — `glossario.` "não no ar": DNS ausente + redirect legado do Cloudflare
- **Módulo/Pacote:** apps/glossario · infra/cloudflare (DNS + tunnel + rules)
- **Sintoma:** `https://glossario.artificiorpg.com` "não funcionava" — ora não resolvia (DNS), ora dava **301** para `https://glossariorpg.artificiorpg.com`. Containers prod (`glossario-app/api/db`) sempre **healthy** na `artificio_net`; BETA `glossariobeta.` 200; nginx servia o HTML internamente. Logo NÃO era app/deploy.
- **Causa raiz:** dois itens de Cloudflare faltando/errados, independentes dos containers: (1) o **public hostname** do tunnel foi criado mas **sem o registro DNS CNAME** `glossario`→`<tunnel>.cfargotunnel.com` (proxied); (2) havia uma **regra de redirect legada** no Cloudflare (`glossario.`→`glossariorpg.` 301) — o corpo do 301 dizia `cloudflare` (não nginx), provando origem na borda.
- **Solução:** (1) criar CNAME `glossario`→`6417d3a0-...cfargotunnel.com` (proxy ON), igual ao `glossariobeta`; (2) remover a regra de redirect (Rules→Redirect Rules / Page Rules / Bulk Redirects). Depois: `curl -sI https://glossario.artificiorpg.com/` = **200** servindo o glossário novo, `/api/terms` 200.
- **Prevenção:** ao publicar hostname novo no tunnel, conferir que o **DNS CNAME** foi criado de fato (não assumir auto-criação) e **varrer redirect/page rules** por regra antiga apontando o hostname novo p/ legado. Diagnóstico rápido: `curl -sSI` (status+Location) e olhar `Server`/corpo (`cloudflare` = borda; `nginx` = origem).
- **Data:** 2026-06-12

### E006 — IP real inseguro/inconsistente atras do Cloudflare Tunnel
- **Módulo/Pacote:** infra/Cloudflare Tunnel · apps/mesas · apps/glossario · apps/site · apps/accounts
- **Sintoma:** rate-limit por IP bloqueia usuarios legitimos em balde unico, ou atacante com caminho de bypass consegue falsificar IP via `CF-Connecting-IP`/`X-Forwarded-For`. Logs mostram IP do tunnel/nginx ou IP arbitrario em vez do visitante validado.
- **Causa raiz:** topologia real e `Cloudflare Tunnel -> cloudflared -> app`. Em nginx, `$proxy_add_x_forwarded_for` anexa o hop interno e o Express com `trust proxy 1` pode escolher o hop errado. Repassar `$http_cf_connecting_ip` cru corrige o balde unico, mas nao valida se a conexao veio do proxy confiavel. Em Express direto ou atras de nginx, `trust proxy = 1` confia genericamente em um hop sem amarrar ao CIDR interno.
- **Solução:** contrato D069/spec 023. Nginx: `set_real_ip_from ${TRUSTED_REAL_IP_FROM}` (default `172.18.0.0/16`, subnet da `artificio_net`) + `real_ip_header CF-Connecting-IP`, e repassar `$remote_addr`. Express direto: `app.set("trust proxy", TRUSTED_PROXY_CIDR)` com default `172.18.0.0/16`.
- **Prevenção:** rodar `node scripts/ci/check_ingress_realip_contract.mjs`; busca final por `$proxy_add_x_forwarded_for`, `proxy_set_header X-Forwarded-For $http_cf_connecting_ip` e `app.set("trust proxy", 1)`. Ao recriar rede Docker, atualizar env `TRUSTED_REAL_IP_FROM`/`TRUSTED_PROXY_CIDR`.
- **Data:** 2026-06-15

### E007 — Push bloqueado: secret em arquivo de diagnóstico/backup no commit
- **Módulo/Pacote:** git/GitHub Push Protection
- **Sintoma:** `git push` rejeitado com `GH013: Push cannot contain secrets`. O GitHub detecta token/refresh token em arquivo dentro do commit (ex.: dump SQL de diagnóstico em `artifacts/`).
- **Causa raiz:** `git add -A` (ou `git add .`) estagiou arquivos untracked em `artifacts/`/diretório de diagnóstico que continham secrets em plaintext (ex.: dump SQL com `refresh_token`). Esses arquivos eram lixo de diagnóstico de fases anteriores, não parte do trabalho atual.
- **Solução:** (1) remover o arquivo do commit via `git rm --cached` + `git commit --amend`; (2) verificar se outros arquivos no mesmo commit também contêm secrets (`rg -l 'refresh_token\|client_secret\|PRIVATE KEY' artifacts/`); (3) adicionar `artifacts/` ao `.gitignore` se ainda não estiver; (4) force-push do amend (`git push --force-with-lease`).
- **Prevenção:** nunca `git add -A` em repo com lixo de diagnóstico; usar `git add` por path específico. Verificar arquivos untracked antes de commit. `artifacts/` deve estar no `.gitignore` ou conter apenas arquivos sem secrets.
- **Data:** 2026-06-19

### E009 — deploy de módulo novo: `links-app` crash loop com `28P01 password authentication failed` apesar do `.env` correto
- **Módulo/Pacote:** apps/links (1ª subida prod) · infra/deploy · padrão p/ qualquer módulo com Postgres em volume
- **Sintoma:** deploy falha em `Deploy module on VM` → `ERRO: links-app nao ficou healthy`; logs do app: `error: password authentication failed for user "admin"` (`code: 28P01`, `routine: auth_failed`) em loop. `links-db` sobe **healthy**. `.env`/`DATABASE_URL`/env do container têm a senha **correta** (sha bate com `POSTGRES_PASSWORD`), e `psql -h 127.0.0.1 -U admin` **funciona** — mas o app continua falhando.
- **Causa raiz:** Postgres grava a senha em `pg_authid` **só na primeira init** do volume (a partir de `POSTGRES_PASSWORD`). O volume `links_pgdata_links_prod` foi inicializado numa tentativa anterior com senha **corrompida**; trocar a senha no `.env` depois **não** reescreve o `pg_authid` do volume já existente. O app conecta pela **rede docker** (`pg_hba.conf`: `host all all all scram-sha-256` → exige senha correta) → mismatch → 28P01. **Armadilha de diagnóstico:** `pg_hba` tem `local`/`127.0.0.1`/`::1` como `trust` → `psql` via localhost aceita **qualquer** senha (testado: senha errada retornou `1`) = falso positivo. A corrupção original veio de gerar o `.env` na VM via `ssh "...$(grep ...)..."` em **double-quotes do PowerShell**, que tratou `\n` como literal e quebrou os bytes da senha/URL.
- **Solução:** DB vazio (1ª subida, sem dado real) → `docker rm -f <app> <db>` + `docker volume rm <projeto>_pgdata_<env>` + re-disparar deploy (re-init com `.env` correto). DB com dado real → `ALTER USER admin PASSWORD '<senha do .env>'` (não destrutivo, sincroniza `pg_authid`) + `docker restart <app>`. Evidência links 2026-06-21: volume dropado, run `27891323485` re-disparado.
- **Prevenção:** (1) gerar `.env`/senha sem corromper bytes — here-string + `ssh '<host> cat > .env'`, validar com `wc -c`/hash esperado, **nunca** `ssh "...$(...)..."` em PowerShell (interpola/quebra `\n`). (2) Trocar senha de volume Postgres já existente exige **recriar volume OU `ALTER USER`** — editar só o `.env` não basta. (3) Diagnosticar auth **pela rede docker** (outro container na mesma net, scram), não por `127.0.0.1` (que é `trust` e mascara). Ver runbook §"Rotação de senha / volume Postgres".
- **Data:** 2026-06-21

### E008 — build do `apps/site` quebra: `Missing field tsconfigPaths` (Vite 8/rolldown vs Astro/Vite 7)
- **Módulo/Pacote:** apps/site (Astro 6.4.8) · @tailwindcss/vite · vite@8 (rolldown) · CI `lint+build+test` + deploy site
- **Sintoma:** `@artificio/site#build` falha (exit 1) com `[@tailwindcss/vite:generate:build] Missing field 'tsconfigPaths' on BindingViteResolvePluginConfig.resolveOptions` (stack: `rolldown@1.0.3` → `vite@8` `oxcResolvePlugin` → `@tailwindcss/vite`). Determinístico (não flaky); reproduzível local. Disparado por regeneração do lockfile (PR dependabot #73), não por bump direto.
- **Causa raiz:** `apps/site` é Astro 6.4.8, cujo engine de build é **Vite 7** (`astro@6.4.8` pina `vite ^7.3.2`; Astro 6 não é rolldown/Vite 8). O site usa `@tailwindcss/vite`, que importa `vite` como peer. Como `apps/site` **não declarava `vite`**, a resolução dependia da topology de hoisting do lockfile: ao mudar o lock (regen do dependabot), o `@tailwindcss/vite` resolveu o **vite@8 hoisted** (das SPAs React) em vez do Vite 7 do Astro → dois Vite majors no mesmo build → o `oxcResolvePlugin` do vite@8 (rolldown 1.0.3) rejeita config sem `tsconfigPaths`.
- **Solução:** declarar `"vite": "^7.3.2"` em `apps/site/package.json` devDeps (mesma faixa do Astro). `@tailwindcss/vite` passa a resolver `vite@7.3.5` deterministicamente. `^7` capa `<8` → dependabot não pode driftar p/ Vite 8 (que quebraria o Astro). NÃO bumpar rolldown (latest 1.1.2 é API-incompat com vite@8.0.16: remove `viteWasmFallbackPlugin`); tailwind/vite já latest. Vide D084.
- **Prevenção:** Vite 8 é APENAS das SPAs React (accounts/mesas-frontend/glossario-frontend/site-admin/ui); o site Astro é Vite 7 por design (D084). Validar com `turbo build --force` (13/13) + `pnpm@11.8.0 install --frozen-lockfile`. Regen de lockfile (dependabot ou fresh) que mexa em hoisting pode reexpor combos latentes — rodar o build completo no CI de todo PR de deps.
- **Data:** 2026-06-19

### E010 — guard `validate_sql_against_class` barra DROP de atributo (falso-positivo `online-safe`)
- **Módulo/Pacote:** infra / CI/CD — `scripts/deploy/lib_migrations.sh:59` (guard de migration)
- **Sintoma:** deploy prod abortado com rollback automático:
  ```
  Error: database/migration_128_import_messages.sql esta marcada online-safe mas contem instrucao destrutiva.
  ROLLBACK: restaurando snapshot e containers de mesas...
  ```
  O guard bloqueou `DROP NOT NULL` e `DROP CONSTRAINT` (não destrutivos de dado) de uma migration legitimamente marcada `online-safe`. O deploy beta passou porque as migrations 128/129 já estavam aplicadas (set-diff pula migrations já em `schema_migrations`). Run de origem: `28125222995` (2026-06-24).
- **Causa raiz:** `grep -Eiq '\b(DROP|TRUNCATE|DELETE[[:space:]]+FROM)\b'` — o token `\bDROP\b` é largo demais e casa qualquer comando que comece com `DROP`, incluindo `DROP NOT NULL`, `DROP CONSTRAINT`, `DROP DEFAULT` (que são alterações de schema sem perda de dado). Além disso, a regex não incluía `[[:space:]]+` entre `DROP` e o alvo, o que ampliava ainda mais o match.
- **Solução (spec 050):** regex estreito com lista branca explícita de objetos proibidos + lista de atributos permitidos indiretamente:
  ```
  grep -Eiq '\b(DROP[[:space:]]+(TABLE|DATABASE|SCHEMA|COLUMN|VIEW|MATERIALIZED|SEQUENCE|TYPE|INDEX|FUNCTION|TRIGGER|RULE|EXTENSION|TABLESPACE|ROLE|USER)|TRUNCATE|DELETE[[:space:]]+FROM)\b'
  ```
  Também adicionado strip de comentário de bloco (`/* */`) para evitar falso-positivo de DROP comentado.
- **Prevenção:** teste shell automatizado (`scripts/deploy/test_migration_guard.sh`, 28 cenários) plugado no CI `_lint-shell.yml` como gate. Varredura completa de 62 migrations online-safe confirmou que nenhuma destrutiva real passa (R1/R2/R3 provados). Cópia órfã `apps/mesas/scripts/deploy/` removida (escopo A, 6 arquivos).
- **Follow-up:** ✅ re-deploy prod mesas concluído (2026-06-26). Promote dev→main (`e9ccd25`, run 28236171046) + deploy prod mesas (`28236817132`, specs 049+050+051). Migrations 128/129 aplicadas; guard `validate_sql_against_class` corrigido na spec 050 funcionou — sem falso-positivo `DROP NOT NULL`.
- **Data:** 2026-06-24

### E011 — deploy beta/prod aborta: `migration_*.sql falhou na validacao de campos do cabecalho`
- **Módulo/Pacote:** infra / CI/CD — `scripts/deploy/apply_required_migrations.sh` + `scripts/deploy/lib_migrations.sh:parse_header`
- **Sintoma:** deploy (dispatch `deploy.yml`) falha no step "Deploy module on VM":
  ```
  ::error::database/migration_134_discord_chat_exporter_profiles.sql falhou na validacao de campos do cabecalho.
  ```
- **Causa raiz:** `parse_header` exige **5 campos** (`@class`, `@requires-backup`, `@author`, `@created`, `@description`) nas primeiras 20 linhas. A migration 134 tinha só 3 (`@migration`, `@description`, `@class`); faltavam `@requires-backup`, `@author`, `@created`. **`@migration` NÃO é um dos 5 — é decorativo.** Gap estrutural: nenhum gate CI valida header antes do merge — `parse_header` só roda no deploy da VM, então header quebrado passa PR/CI verde e só estoura no beta. Já recorreu várias vezes.
- **Solução:** completar o header com os 5 campos, copiando do vizinho verde mais recente. Fix aplicado em `migration_134` (author=spec-057, created=2026-06-30, requires-backup=false, class=online-safe).
- **Prevenção:** regra pétrea de checklist de migration adicionada em `AGENTS.md` §Banco (5 campos + regras `requires-backup→manual-risk`, `online-safe` sem DDL destrutivo, dir allowlisted). Débito aberto: gate CI que roda `parse_header` nas `migration_*.sql` changed do PR (falhar no PR, não no deploy) — registrar em `specs/backlog.md`.
- **Data:** 2026-07-01

### E012 — deploy prod aborta: `Muitas migrations pendentes (N > 5)` após várias specs seguidas sem promote a prod
- **Módulo/Pacote:** infra / CI/CD — `scripts/deploy/apply_required_migrations.sh` (guard `MAX_AUTO_PENDING=5`)
- **Sintoma:** deploy (`deploy.yml`, `mode=deploy env=prod`) falha no step "Deploy module on VM":
  ```
  ##[error]Muitas migrations pendentes (9 > 5).
  ROLLBACK: restaurando snapshot e containers de mesas...
  ```
  Rollback automático teve sucesso (containers recriados/healthy, prod restaurado ao estado anterior) — sem dano, mas deploy não completa.
- **Causa raiz:** guard existe pra impedir aplicar muitas migrations de schema de uma vez sem revisão passo a passo (proteção correta). Mas o fluxo real do projeto promove `dev→main` esporadicamente (várias specs seguidas mexem em `apps/mesas/database/` e só vão a prod juntas no próximo fast-forward) — isso faz o número de pendentes ultrapassar 5 quase sempre que passa um tempo sem promote. Não é falha de migration nenhuma (todas as 9 do caso real — 133 a 141, specs 057/058 — eram `online-safe`/`requires-backup:false`, `CREATE TABLE IF NOT EXISTS`/`ADD COLUMN`/`CREATE INDEX`, sem DROP/DELETE).
- **Solução aplicada (caso real 2026-07-07):** aplicar as migrations pendentes manualmente via SSH usando o MESMO script oficial (`bash scripts/deploy/apply_required_migrations.sh <compose> <db_service> <db_name> <db_user> <migrations_dir>`), só com `MAX_AUTO_PENDING=9` (ou N igual ao total pendente) passado como env var pra essa rodada pontual — preserva todo o lock/checksum/header-validation do script real, não é SQL solto nem escrita direta em `schema_migrations`. Depois do schema em conformidade, reroda `deploy.yml` normal (que só cuida do código/containers). **Cuidado:** dividir em "lotes" artificiais não funciona — o script sempre compara o total pendente contra `MAX_AUTO_PENDING` de uma vez (não há suporte nativo a lote parcial); ajustar o limite pro total real é o caminho, não fatiar chamadas.
- **Prevenção:** nenhuma automática ainda — considerar (a) promover `dev→main` com mais frequência (reduz acúmulo), ou (b) um step opcional no `promote-prod-fast-forward.yml` que aplica migrations pendentes logo após o fast-forward (antes de qualquer deploy de código ficar bloqueado), ou (c) alertar/contar pendentes quando `dev` diverge de `main` por N commits. Registrado como débito em `specs/backlog.md`.
- **Data:** 2026-07-07
- **Caso repetido (spec 082, downloads, 2026-07-23):** mesmo padrão em projeto novo, não por acúmulo de promotes — Downloads nunca teve deploy Beta bem-sucedido; primeiro deploy real trouxe as 19 migrations completas de uma vez e estourou `MAX_AUTO_PENDING=5`. Confirma que o guard não é bug/defeito a corrigir, é proteção funcionando como projetado; solução é a mesma independente da causa do acúmulo (promotes atrasados ou primeiro deploy de projeto novo).
  - **Pré-requisitos operacionais descobertos ao rodar a solução manual (faltavam nesta entrada):**
    1. `apply_required_migrations.sh`/`lib_migrations.sh` só aplicam `-p <projeto>` ao `docker compose` se `COMPOSE_PROJECT` estiver exportado (`compose_project_flag()`). Sem essa env var, compose resolve o nome do projeto pelo diretório e não enxerga containers subidos sob outro nome de projeto (ex.: `downloads-beta`) — dá erro `service "<db>" is not running` mesmo com o container healthy.
    2. O script não aceita `--env-file`; ele roda `docker compose` cru no cwd, que só lê `.env` (nome fixo), nunca `.env.beta`. Nos clones (`/opt/artificio-beta`), o env real do módulo vive em `apps/<modulo>/.env.beta`, não `.env`. Sem copiar/linkar para `.env` antes de rodar, a interpolação do compose falha em variáveis obrigatórias do OUTRO serviço do mesmo compose file (ex.: `CATALOG_INTERNAL_TOKEN` do serviço `api` quebra até uma migration que só mexe no serviço `db`), porque `docker compose exec` interpola o arquivo inteiro, não só o serviço alvo.
  - **Comando completo validado (caso downloads-beta):**
    ```bash
    cd /opt/artificio-beta
    cp apps/downloads/.env.beta apps/downloads/.env   # temporário; docker compose só lê .env
    COMPOSE_PROJECT=downloads-beta MAX_AUTO_PENDING=19 \
      bash scripts/deploy/apply_required_migrations.sh \
      apps/downloads/docker-compose.beta.yml downloads-beta-db downloads admin apps/downloads/database
    rm -f apps/downloads/.env   # remover a cópia temporária logo depois
    ```
    Sempre fazer `pg_dump` (snapshot pré-migration) antes, mesmo em banco declarado vazio — é o rollback manual se algo falhar no meio do lote.
  - **Caso repetido (spec 085, downloads, 2026-07-25) — desta vez guard de CLASSE (`manual-risk`), não de QUANTIDADE.** `migration_025_download_scraper_platform.sql` (`@class: manual-risk`, tem `DROP CONSTRAINT`) bloqueou `deploy.yml env=beta` com `Existem migrations manual-risk pendentes. Use ALLOW_MANUAL_MIGRATIONS=true.` Rollback automático do workflow funcionou limpo (snapshot restaurado, containers healthy). **Achado novo confirmado por busca exaustiva:** nenhum workflow do repo (`deploy.yml`, `_deploy-module.yml`, `break-glass-deploy-prod.yml` — que só cobre `mesas`/prod) expõe `ALLOW_MANUAL_MIGRATIONS` nem `REQUIRE_PROD_BACKUP_FOR_MANUAL` como input de `workflow_dispatch` — não existe caminho via `gh workflow run` pra aplicar migration `manual-risk`, é sempre SSH manual (mesmo padrão E012 acima, script oficial). **Achado extra:** rodar em **beta** (não prod) o script ainda aborta com `Backup PROD_BACKUP_FILE ausente para manual-risk` — `REQUIRE_PROD_BACKUP_FOR_MANUAL` (default `true`) não distingue ambiente sozinho; precisa passar `REQUIRE_PROD_BACKUP_FOR_MANUAL=false` explícito em beta (com snapshot manual já feito antes, mesma disciplina do E012). Comando validado (variação deste caso — 1 migration manual-risk isolada, não acúmulo de `MAX_AUTO_PENDING`):
    ```bash
    cd /opt/artificio-beta
    cp apps/downloads/.env.beta apps/downloads/.env
    docker exec downloads-beta-db pg_dump -U admin -d downloads -Fc -f /tmp/predeploy_manual.dump
    docker cp downloads-beta-db:/tmp/predeploy_manual.dump /tmp/artificio-downloads-beta-manual-$(date +%s).dump
    docker exec downloads-beta-db rm -f /tmp/predeploy_manual.dump
    ALLOW_MANUAL_MIGRATIONS=true REQUIRE_PROD_BACKUP_FOR_MANUAL=false COMPOSE_PROJECT=downloads-beta \
      bash scripts/deploy/apply_required_migrations.sh \
      apps/downloads/docker-compose.beta.yml downloads-beta-db downloads admin apps/downloads/database
    rm -f apps/downloads/.env
    ```
    Depois: `gh workflow run deploy.yml --ref dev -f module=downloads -f mode=deploy -f env=beta` normal (schema já em conformidade) — `success` confirmado (`gh run view 30146119480`).
  - **Débito registrado (2026-07-25), não corrigido nesta sessão (mantenedor optou por só documentar):** adicionar `allow_manual_migrations`/`require_prod_backup_for_manual` como inputs de `workflow_dispatch` em `deploy.yml`/`_deploy-module.yml` eliminaria o SSH manual pra esse caso — mudança de infra/CI, pede spec/PR própria, fora do escopo da spec 085.
  - **Caso repetido (spec 089, downloads, 2026-07-30) — 3ª ocorrência no MESMO módulo, mesma classe de guard.** `migration_034_download_material_metadata_markdown.sql` (`@class: manual-risk`, `@requires-backup: true`, backfill de dados) bloqueou `deploy.yml env=beta` (`gh run 30556457825`, exit 3). Rollback automático limpo de novo — containers `healthy`, banco na 033, snapshot do run criado antes do abort. Nada novo na mecânica: a solução foi exatamente o comando validado acima (`ALLOW_MANUAL_MIGRATIONS=true REQUIRE_PROD_BACKUP_FOR_MANUAL=false`), aplicando 034+035+036 num lote, `EXIT=0`, seguido de `gh workflow run` normal verde (`gh run 30557942321`).
    - **O que esta ocorrência acrescenta — sinal de previsão, não mecânica nova.** Nas 3 vezes o bloqueio só apareceu DEPOIS de disparar o deploy e consumir o ciclo inteiro de CI+build+rollback (~6min). O sinal existia antes e é barato: comparar o disco contra `schema_migrations` e checar a classe das pendentes. Rodar isto ANTES de qualquer `gh workflow run ... mode=deploy` num módulo que teve migration nova desde o último deploy:
      ```bash
      # 1. o que o banco já tem (read-only, não precisa de aprovação)
      ssh faren "docker exec <db-service> psql -U admin -d <db> -t \
        -c \"SELECT migration_name FROM schema_migrations ORDER BY migration_name;\""
      # 2. o que o disco tem
      ls apps/<modulo>/database/ | grep -E '^migration_'
      # 3. classe das que faltam — se qualquer uma for manual-risk, o deploy VAI abortar
      head -1 apps/<modulo>/database/migration_<NNN>_*.sql
      ```
      Atalho pra passo 3 em módulo inteiro: `rtk rg "manual-risk" apps/<modulo>/database/ -l`. Cruzar essa lista com as pendentes do passo 1-2 responde a pergunta antes do deploy.
    - **Coluna da tabela é `migration_name`, não `filename`.** `SELECT filename FROM schema_migrations` erra com `column "filename" does not exist`. Schema real: `migration_name text PK`, `applied_at timestamptz`, `applied_by text`.
    - **Falso alarme descartado nesta investigação (não repetir a suspeita):** o deploy verde imediatamente anterior (`gh run 30396262824`, 28/07 20:25) parecia ter contornado o guard, já que a 034 é datada 28/07. Não contornou — a 034 entrou em `dev` só no merge da PR #226 (29/07 01:55), depois daquele deploy, que logou `[drift] disco e banco batem (33 migrations)`. **Data no header `@created` da migration não é data de entrada em `dev`**; comparar contra `git log` do merge, não contra o header, antes de concluir que um gate falhou.
    - **Débito do 2026-07-25 (inputs de `workflow_dispatch`) segue aberto e agora tem 3 ocorrências de custo real.** Cada uma queimou um ciclo de deploy completo mais uma rodada de SSH manual. Continua sendo mudança de infra/CI que pede spec/PR própria.

### E013 — contato Discord de fallback usava nome de exibição do servidor (não contactável fora dele)
- **Módulo/Pacote:** `apps/mesas/backend/src/discord/parseDiscordAnnouncement.ts` (fallback de contato, DEB-048-26) + `syncHelpers.ts` + `apps/mesas/frontend/src/components/TableContacts.tsx`
- **Sintoma:** draft sem link/menção explícita de contato preenchia `contact_discord` com o NOME de exibição do autor (ex.: "João Pedro") — visualmente parecia funcionar, mas é nickname do servidor, não é pesquisável nem contactável fora dele. Link gerado (`discord.gg/<nome>`) também estava quebrado — tratava o valor como código de convite de servidor, nunca como identificador de usuário.
- **Causa raiz:** `authorContact = message.discord_author_name ?? message.discord_author_id ?? null` priorizava nome sobre ID. Nome de exibição de servidor Discord não é @username global nem sobrevive a mudança de nickname; só o ID (snowflake) é estável e resolve via `https://discord.com/users/{id}` (deep-link oficial, confirmado em discord-api-docs#5183) em qualquer client logado.
- **Solução:** fallback trocado pra usar só `discord_author_id` (nunca nome). `syncHelpers.ts` passou a rotular esse valor com `label: 'Perfil Discord'` quando for snowflake/mention crua (senão UI mostra número cru). `TableContacts.tsx` reconhece snowflake/mention e monta link de perfil (`discord.com/users/{id}`) em vez de tentar como invite code. Teste ponta a ponta real (mensagem simulada com autor real de 18 dígitos) confirmou pipeline completo: parser → extractContacts → link final clicável e correto.
- **Achado relacionado (mesma investigação):** auditoria de completude por IA (`audit-completeness`) tinha 2 furos estruturais que a fizeram "não achar lacuna" num draft sem contato real: (1) `contact_discord`/`host_discord_id` são excluídos do payload mandado pro DeepSeek por design de privacidade — a IA nunca podia reportar contato faltando; (2) prompt só pedia campos VAZIOS ("missing"), nunca comparava se um campo JÁ PREENCHIDO batia com o texto — um valor errado mas presente (ex.: vagas mal extraídas) nunca virava achado. Corrigido: prompt v2 pede `issue_type: missing|incorrect`; checagem local (sem LLM) cobre o gap de contato que a exclusão de privacidade deixava cego.
- **Feature nova (pedido do mantenedor):** botão pequeno "IA" por campo (ao lado do badge "Parser" em cada input do editor de draft) — reaudita só aquele campo sob demanda, em vez de só a auditoria geral do draft inteiro.
- **Prevenção:** teste `parseDiscordAnnouncement.test.ts` atualizado pra nova regra (id, não nome). Nenhum gate automático detecta esse tipo de "campo populado mas semanticamente inútil" — fica como lição: extração automática que preenche um campo não é garantia de que o valor é utilizável pelo humano do outro lado.
- **Data:** 2026-07-07

### E014 — [STATUS: RESOLVIDO, confirmado em prod] migration referencia coluna inexistente: `column "updated_at" of relation "systems" does not exist`
- **Módulo/Pacote:** apps/mesas/database — `migration_147_system_hierarchy_contract.sql` (spec-077/078) · `scripts/deploy/apply_required_migrations.sh`
- **Sintoma:** aplicação manual de migrations manual-risk pendentes (`ALLOW_MANUAL_MIGRATIONS=true`) aborta com:
  ```
  ERROR:  column "updated_at" of relation "systems" does not exist
  LINE 2:   SET node_type = 'edition', depth = 1, updated_at = now()
  ```
  Reproduzido primeiro em beta; mesmo schema real em prod (coluna nunca existiu em nenhum ambiente). Rollback de transação (`BEGIN...COMMIT` do script) preservou integridade do banco em ambos os ambientes — sem dano em nenhum ponto.
- **Causa raiz:** `UPDATE systems SET ... updated_at = now()` em `migration_147` referenciava coluna `systems.updated_at` que **nunca foi criada** por nenhuma migration anterior (`\d systems` na VM confirma ausência). Nenhum gate de CI valida a migration contra o schema real antes do merge — só estoura na aplicação manual/deploy, igual ao padrão de [[E011]].
- **Solução:** removidas as 2 ocorrências de `, updated_at = now()` das linhas 15 e 31 de `migration_147_system_hierarchy_contract.sql` (coluna não usada em nenhum outro lugar da migration). PR #164 (branch `fix/mesas-078-migration-147-updated-at`), mergeada em `dev` (`1b7aef5`) e promovida a `main`. Reaplicada com sucesso em **beta** (2026-07-15, run manual via SSH) e depois em **prod** (2026-07-15, run manual via SSH, junto com [[E015]] corrigida) — `schema em conformidade` em ambos. Deploy prod mesas subsequente (`gh run 29454298339`) `success`.
- **Prevenção:** nenhuma automática ainda. Mesmo gap estrutural do E011: rodar as migrations manual-risk contra uma cópia real do schema (não só sintaxe) antes do merge seria o gate correto — registrar como débito relacionado a [[E011]] em `specs/backlog.md`.
- **Relacionados:** [[E011]] (header incompleto só estoura fora do CI), [[E015]] (mesmo lote de aplicação, migration seguinte, mesma sessão de deploy spec-078).
- **Data:** 2026-07-15

### E015 — [STATUS: RESOLVIDO, confirmado em prod] `CREATE INDEX CONCURRENTLY cannot run inside a transaction block`
- **Módulo/Pacote:** apps/mesas/database — `migration_146_learning_feedback_outbox.sql` (spec-077-onda-a) · `scripts/deploy/apply_required_migrations.sh`
- **Sintoma:** aplicação manual de migrations pendentes em **prod** aborta com:
  ```
  ERROR:  CREATE INDEX CONCURRENTLY cannot run inside a transaction block
  ```
  Rollback de transação limpo (`schema_migrations` sem registro parcial da 146, banco íntegro). Beta já tinha os índices resultantes aplicados por fora deste script antes desta sessão (origem não investigada, fora do escopo desta correção).
- **Causa raiz:** `apply_required_migrations.sh` envolve **toda** migration (independente de `@class`) em `BEGIN; ... COMMIT;` no loop principal de aplicação. `CREATE INDEX CONCURRENTLY`/`CREATE UNIQUE INDEX CONCURRENTLY` é proibido pelo Postgres dentro de bloco de transação — limitação estrutural do banco, não específica de prod/beta. Qualquer migration futura com `CONCURRENTLY` falha do mesmo jeito via este runner.
- **Solução:** removido `CONCURRENTLY` das 2 ocorrências em `migration_146_learning_feedback_outbox.sql` (`idx_import_corrections_learning_outbox` e `idx_discord_parse_feedback_correction_field`) — lock breve tolerável, tabelas não são hot-path crítico. PR #165 (branch `fix/mesas-146-remove-concurrently`), mergeada em `dev` (`9d0c76e`) e promovida a `main`. Reaplicada com sucesso em **beta** (2026-07-15, deploy `gh run 29453579920` `success`) e em **prod** (2026-07-15, run manual via SSH — `CREATE INDEX` sem erro, `schema em conformidade`). Deploy prod mesas subsequente (`gh run 29454298339`) `success`.
- **Prevenção:** nenhuma automática ainda. Possível gate: `lib_migrations.sh` recusar `CREATE INDEX CONCURRENTLY`/`CREATE UNIQUE INDEX CONCURRENTLY` na validação de classe (mesmo padrão do guard `validate_sql_against_class` de [[E010]]), já que o runner NUNCA consegue rodar isso — registrar como débito.
- **Relacionados:** [[E014]] (mesmo lote de aplicação, migration anterior, mesma sessão de deploy spec-078), [[E010]] (guard de validação de classe de migration), [[E012]] (mesmo runner, guard de quantidade pendente).
- **Data:** 2026-07-15

### E016 — 1º deploy real de `downloads` em beta: 5 erros encadeados no Dockerfile de produção, só descobertos via deploy remoto (deveriam ter sido pegos por auditoria estática)
- **Módulo/Pacote:** `apps/downloads/backend/Dockerfile` (stage `production`, introduzido/alterado na PR #193, spec 084 Modo 2a/2b)
- **Sintoma:** 5 falhas sequenciais no primeiro `workflow_dispatch` de `deploy.yml` (module=downloads, env=beta), cada uma só descoberta depois de corrigir a anterior e disparar deploy de novo (~8-10min de build real na VM por ciclo, PRs #195/#196/#197):
  1. `[ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL] Command "patchright" not found` — `pnpm exec patchright install` sem `--filter`, rodando recursivo em todo o workspace no stage `production` (só `downloads-backend`/`media` tinham `node_modules` instalado ali).
  2. Achado de review (Codex, PR #195): instalação do Chromium rodava como `root` mas o runtime roda como `USER node` — sem `PLAYWRIGHT_BROWSERS_PATH` fixo, cache do Playwright ficaria em `/root/.cache`, invisível para o processo `node` em runtime.
  3. `sh: apt-get: not found` / `Failed to install browsers` (exit 127) — imagem base `node:24-alpine` (musl); Playwright/Patchright `--with-deps` só sabem instalar deps de SO via `apt-get` (Debian/Ubuntu), sem suporte oficial a Alpine.
  4. Achado de review (Codex, PR #196): `node:24-slim` não vem com `wget` pré-instalado (diferente do busybox do Alpine) — healthcheck do compose beta/prod (`wget --spider .../api/v1/health`) quebraria mesmo com o container saudável.
  5. `Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'resend' imported from /repo/packages/email/dist/client.js` — `@artificio/email` declara `resend` como dependency própria; o `pnpm install --prod --filter` do stage `production` só cobria `downloads-backend`/`media`, nunca `email` (que entrava só via `COPY --from=builder .../dist`, sem `node_modules` próprio).
- **Causa raiz:** o Dockerfile foi escrito/editado incrementalmente (comentários "Achado de review PR #193"/"PR #195" no próprio arquivo confirmam) sem nunca ter sido validado de ponta a ponta com `docker build` real nem com auditoria estática cruzando `COPY`/`RUN pnpm install --filter`/dependencies declaradas de cada `package.json` copiado contra o que de fato fica instalado na imagem final. Cada erro individualmente é óbvio quando isolado (filtro de pnpm ausente, distro sem `apt-get`, dependency de um pacote não instalada) — o padrão comum é: instalação de runtime/deps do stage `production` tratada como afterthought, adicionada depois que o resto do Dockerfile já existia, sem reconferir o conjunto.
- **Solução:** PRs #195 (`--filter` no exec + `PLAYWRIGHT_BROWSERS_PATH`), #196 (`node:24-slim` + `wget`), #197 (`--filter @artificio/email`). Todas mergeadas em `dev`. Auditoria estática pós-fato (nesta mesma sessão) confirmou que os `dist`/`dist-cjs` dos demais pacotes workspace (`auth`, `catalog-client`, `changelog`, `config`) são garantidos pelo `turbo.json` (`build.dependsOn: ["^build"]` builda toda dependência upstream automaticamente) — não é o mesmo tipo de gap do `resend`, que é dependency de runtime instalada via `pnpm install`, não output de build.
- **Prevenção:** **[[E002]] já registrava exatamente esta prevenção ("rodar `docker build` local quando houver Docker, senão grep dos COPY vs `git status`") e não foi seguida nesta sessão — a causa raiz do retrabalho não foi falta de processo documentado, foi falha de consulta ao `errors.md` antes de agir.** Daqui pra frente, qualquer edição em `Dockerfile` de stage `production`/multi-stage exige, ANTES de disparar deploy real: (1) se Docker Desktop disponível, `docker build --target production -f <Dockerfile> .` local; (2) se não, auditoria estática manual: para cada `COPY <path>` sem `--from=builder`, confirmar `git ls-files <path>`; para cada `COPY --from=builder .../dist(-cjs)`, confirmar que o pacote de origem está no grafo `dependsOn: ["^build"]` do `turbo.json` (ou é buildado explicitamente); para cada `RUN pnpm install --prod --filter <pkg>`, listar TODOS os pacotes cujo `dist` é copiado via `--from=builder` e cruzar cada um contra suas `dependencies` reais no `package.json` — todo pacote com dependency própria (não coberta por hoisting de outro `--filter` já instalado) precisa do seu próprio `--filter` no install; para `RUN apt-get/apk install` de ferramentas de runtime (ex.: browsers headless), conferir contra a distro base se o gerenciador de pacote e os binários usados no `CMD`/healthcheck (`wget`, `curl`) realmente existem nela.
- **Relacionados:** [[E002]] (mesmo padrão — Dockerfile referenciando algo ausente —, prevenção já existia e não foi aplicada).
- **Data:** 2026-07-24

### E017 — recorrência de E016: `downloads-beta-api` crash loop pós-deploy (`@artificio/catalog-matching` faltando na imagem de produção)
- **Módulo/Pacote:** `apps/downloads/backend/Dockerfile` (stage `production`)
- **Sintoma:** deploy `deploy.yml env=beta module=downloads` (2026-07-26, spec 086 fases 9/10) completou build/CI verde, mas `downloads-beta-api` entrou em `Restarting` (crash loop) logo após subir; `downloads-beta-app`/`downloads-beta-db` seguiram `healthy`. Log do container: `Error: Cannot find module '/repo/apps/downloads/backend/node_modules/@artificio/catalog-matching/dist-cjs/index.js'`, `code: MODULE_NOT_FOUND`. `trap rollback ERR` do workflow **não disparou de fato** (só a definição da função apareceu no log com `set -x`; o job terminou em `failure` sem a chamada real de rollback rodar) — confirmado via SSH que containers ficaram no estado pós-deploy quebrado, não revertido.
- **Causa raiz:** exatamente o padrão [[E016]] (mesmo achado #5, `resend`/`email`), recorrente porque a prevenção documentada em E016 ("qualquer edição em Dockerfile de stage production exige `docker build` local ou auditoria estática ANTES do deploy real") não foi seguida quando `@artificio/catalog-matching` foi adicionado como dependency nova do backend (fase 4/9 desta spec, `scraperIngest.ts` e `systemSuggestionsAdmin.ts`) — a lista de `COPY --from=builder .../dist(-cjs)` do Dockerfile não foi reconferida contra os imports novos do código.
- **Solução:** adicionadas as 2 linhas faltantes (`COPY --from=builder /repo/packages/catalog-matching/dist` + `dist-cjs`) no mesmo ponto da lista onde os outros pacotes com `dist-cjs` (auth, catalog-client) já estavam. Auditoria estática completa refeita: `grep "from '@artificio/"` em `apps/downloads/backend/src` levantou 7 pacotes workspace importados (media, auth, changelog, catalog-client, email, config, catalog-matching) — todos os 7 confirmados no `COPY` do Dockerfile após o fix; `media` não tem `dist-cjs` (é ESM puro, sem `main`/`require` no `package.json`, correto não copiar).
- **Prevenção:** reforça a de E016 — a auditoria estática (grep de imports `@artificio/*` do código-fonte × lista de `COPY` do Dockerfile) precisa rodar **toda vez que uma dependency workspace nova é adicionada** a um `package.json` de app com Dockerfile de produção, não só quando o Dockerfile em si é editado.
- **✅ COBERTO POR (2026-07-27, PR #219):** `scripts/ci/check_dockerfile_workspace_deps.mjs`, job `guard-dockerfile-workspace-deps` em `.github/workflows/pr-checks.yml`. Fecha o débito que esta linha registrava em aberto. O gate cruza, para cada app com stage `production`, os `@artificio/*` importados por `src/` contra os `COPY --from=builder .../dist` do Dockerfile, e falha o PR com a lista do que falta.
  - **Validado contra o defeito real:** removendo as linhas `COPY packages/catalog-matching/dist*` do `apps/downloads/backend/Dockerfile` (o E017 exato), o gate falha apontando o pacote; restaurado, volta a verde. Não é teste que passa nos dois casos.
  - **Duas exclusões deliberadas, ambas para evitar falso-positivo** — mexer nelas exige entender por que existem: (1) **stage `FROM nginx`** é pulado, porque frontend servido por nginx não resolve `@artificio/*` em runtime (o Vite bundla tudo no `dist` da SPA durante o build; a imagem final não tem Node); (2) **`dist-cjs` só é cobrado de quem resolve `require` para `dist-cjs`** — testar `main`/`exports.require` existirem não basta, porque `config` e `media` apontam `require` para `./dist/index.js` e não têm `dist-cjs` nenhum, enquanto `auth` e `catalog-client` apontam para `./dist-cjs/` e precisam.
  - **Limite conhecido:** o gate lê `COPY` textualmente, então não cobre `RUN pnpm install --prod --filter` nem `apt-get`/`apk` — os outros achados do E016 seguem dependendo da auditoria manual descrita acima.
- **Achado adicional, investigado e corrigido no mesmo dia:** `trap rollback ERR` do script de deploy (`.github/workflows/_deploy-module.yml`) não executou a chamada real quando o erro ocorreu nas checagens de health/smoke pós-deploy. **Causa raiz confirmada por teste isolado:** `exit 1` explícito **nunca** dispara `trap ... ERR` no bash — só um comando que falha (código de saída não-zero) sob `set -e` dispara o trap; `exit` é saída intencional do shell, não "erro" pro propósito do trap. Confirmado com 3 testes mínimos (`bash -c 'trap ... ERR; set -euo pipefail; exit 1'` nunca imprime o trap; `false` sem `exit` dispara normalmente). O script tinha 2 pontos de `exit 1` **depois** de `trap rollback ERR` ser definido (checagem de banco pronto, linha ~439; checagem de health/smoke, linhas ~467/484/488) — nenhum deles chamava rollback de fato.
- **Solução:** adicionada chamada explícita `rollback` antes de cada `exit 1` pós-trap (4 pontos: banco não ficou pronto, container não ficou healthy, smoke de rota falhou nas 2 variantes). Não depende mais do `trap ERR` capturar esses casos — o `trap` continua útil como rede de segurança para falha de **comando** (`docker compose up` retornando erro, por exemplo), mas o rollback de checagem de negócio agora é chamado direto. Validado com `shellcheck` no bloco de shell extraído do workflow (limpo, sem achados).
- **Prevenção:** ao adicionar novo ponto de `exit 1` num script que depende de `trap ... ERR` para cleanup/rollback, sempre chamar a função de cleanup explicitamente antes do `exit` — nunca assumir que o trap cobre saída manual do script.
- **Relacionados:** [[E016]] (mesmo Dockerfile, mesmo tipo de gap, mesma prevenção não seguida a tempo).
- **Data:** 2026-07-26

---

### E018 — migration nova do `apps/site` fica pendente indefinidamente: guard de restart do entrypoint pula `pnpm run migrate`
- **Módulo/Pacote:** `apps/site` (`docker-entrypoint.sh`) · banco do Site (`site-prod-db`, `site-beta-db`)
- **Sintoma:** migration nova commitada e mergeada em `dev`/`main` **não** aparece no banco, sem nenhum erro em log de deploy ou de container. Descoberto na spec 088 (2026-07-27) ao verificar a dependência cruzada da taxonomia central: `select slug from catalog_material_types` retornou `ERROR: relation "catalog_material_types" does not exist` em **beta E prod**, embora `apps/site/db/migrations/015_catalog_material_types.sql` e `016_catalog_material_types_seed.sql` existissem em disco e estivessem mergeadas. `select version from schema_migrations order by version desc limit 1` devolveu `014_promote_beta_system_extras` nos dois ambientes. Container `site-prod-app` e `site-beta-app` `Up (healthy)` o tempo todo — nada indicava pendência.
- **Causa raiz:** o `apps/site` **não** usa o runner de migrations do monorepo (`scripts/deploy/apply_required_migrations.sh`); migra no próprio entrypoint. E o entrypoint tem um guard de resiliência de restart (spec 009 R6, D049) que **retorna antes** da migração:
  ```sh
  if [ -f dist/index.html ] && [ "${SITE_FORCE_REBUILD:-false}" != "true" ]; then
    echo "[site] dist presente — serve direto (restart sem rebuild)"
    exec pnpm run serve
  fi
  echo "[site] migrate (store)"
  pnpm run migrate
  ```
  O guard é **correto para o que foi desenhado**: evita re-importar WP e rebuildar Astro a cada OOM/reboot/`restart: always`, dando restart instantâneo. O efeito colateral não previsto é que `pnpm run migrate` mora **depois** do `exec`, então todo restart de container existente pula a migração. Só container **novo** (deploy/recreate, sem `dist`) ou `SITE_FORCE_REBUILD=true` aplica migration.
  Agravante que esconde o problema: os containers do site sobem uma vez e ficam semanas no ar (`site-prod-app` e `site-beta-app` de 2026-07-20 quando o erro foi descoberto, 7 dias depois). Além disso, `deploy.yml` só deploya se `deploy_paths` do manifesto mudar — mudança que toca **só** `apps/site/db/migrations/` pode não disparar deploy nenhum, e mesmo disparando, se o container não for recriado o `dist` continua lá.
- **⚠️ CORREÇÃO DE VEREDITO (achado do Codex na review da PR #219, 2026-07-27).** A entrada anterior afirmava que mover `migrate` no entrypoint **fechava** este erro. **Não fecha.** O site tem `auto_deploy_on_push: false` (`.github/deploy-manifest.json:75`), então merge/promote não deploya; e o deploy real recria imagem e container (`_deploy-module.yml:457-459`), enquanto container **existente** segue rodando a imagem antiga — cujo `db/migrations/` não tem o SQL novo. Container **novo** já rodava `migrate` mesmo antes da mudança, porque `dist` é excluído da imagem (`.dockerignore:4`) e o guard não pegava. Ou seja, nos dois cenários o resultado é o mesmo de antes: **migration nova segue pendente até `workflow_dispatch` manual**. O ganho da mudança é real mas menor — remove a dependência do `dist` para migrar, então um container recriado por qualquer motivo migra cedo. Não é a correção que a entrada anunciava.
- **✅ COBERTO POR (2026-07-27, PR #219):** `scripts/deploy/check_migration_drift.sh`, chamado em `_deploy-module.yml` entre o health-check e o smoke de rotas. É o alarme que faltava: compara `db/migrations` em disco contra `schema_migrations` no banco e **falha o deploy com rollback** em qualquer divergência, nas duas direções (disco à frente = schema defasado; banco à frente = hotfix manual não reconciliado).
  - **Por que rodar DEPOIS do deploy:** verifica o resultado, não a intenção. Container `healthy` não prova schema em dia — foi exatamente assim que `015`/`016` passaram batido.
  - **Por que um script novo em vez de reusar o runner:** `apply_required_migrations.sh` é incompatível com o site em três eixos — coluna (`migration_name` vs `version`), glob (`migration_*.sql` vs `NNN_*.sql`) e diretório (`database/` vs `db/migrations/`). Pior: chamado com `"database"`, que no site não existe, ele imprime `diretorio ausente; nada a aplicar` e **sai verde** (`apply_required_migrations.sh:65-66`). Era essa saída falso-positiva que mascarava a defasagem. O script novo parametriza coluna/glob/strip-extensão, então serve os dois estilos.
  - **Validado contra bancos reais**, nas três situações: drift banco-à-frente em `site-prod-db` e `site-beta-db` (detectou `015`/`016` aplicadas manualmente e ausentes do clone), drift disco-à-frente com diretório sintético, e caso limpo em `downloads-beta-db` (29/29, coluna e glob padrão do runner).
- **Solução parcial (aplicada 2026-07-27):** `pnpm run migrate` foi movido no `docker-entrypoint.sh` para **antes** do guard de `dist`. Migrar sempre não custa o restart instantâneo que o guard protege — `db/migrate.ts` consulta `schema_migrations` e é no-op sem pendência; o que o guard evita é o **rebuild** (export + `astro build` + pagefind), que segue condicional. Verificado por smoke que discrimina: com a ordem antiga o `migrate` não executa (defeito reproduzido); com a nova executa **e** o serve direto continua funcionando.
- **⚠️ Armadilha: `docker exec <app> pnpm run migrate` NÃO resolve sozinho.** Foi a primeira tentativa e **falhou em silêncio aparente** — saída `migrate: 0 new, 14 total (driver=pg)`, exit 0, nada aplicado. Causa: o container roda a **imagem** buildada no último deploy, e os arquivos `015`/`016` não existem nela (`site-beta-app` era de 2026-07-20, anterior às migrations). `migrate.ts` lista `db/migrations/` de dentro do container — não vê arquivo que o deploy não levou. **`0 new` num container defasado não significa "nada pendente", significa "nada visível".** Sempre conferir `docker exec <app> ls db/migrations/ | tail` antes de concluir que está em dia.
- **Aplicação pontual, quando o container está defasado e não se quer deploy só para migrar:** enviar o SQL do clone da VM para dentro do banco, sem depender da imagem, e registrar a versão manualmente (senão vira drift):
  ```bash
  cd /opt/artificio-beta && git fetch origin          # só fetch; NÃO mexe no working tree
  git show origin/<ref>:apps/site/db/migrations/<arquivo>.sql \
    | docker exec -i site-<env>-db psql -U admin -d site -v ON_ERROR_STOP=1
  docker exec site-<env>-db psql -U admin -d site \
    -c "INSERT INTO schema_migrations (version) VALUES ('<arquivo-sem-.sql>') ON CONFLICT (version) DO NOTHING;"
  ```
  O nome registrado tem de ser **exatamente** `file.replace(/\.sql$/, "")` (`db/migrate.ts:28`) — divergir faz o runner reaplicar no próximo boot. `ON_ERROR_STOP=1` é obrigatório: sem ele o `psql` segue após erro e reporta sucesso com schema pela metade.
- **Ordem entre ambientes:** aplicar em beta primeiro e conferir, depois prod. E **respeitar o fluxo `dev`→`main`** — em 2026-07-27, `015` (spec 086) já estava em `main` e foi aplicada em prod, mas `016` (spec 088) só existia em `dev` e **não** foi aplicada em prod: colocar no banco de produção migration que ainda não passou por `main` inverte a ordem de promoção. Ela entra quando a spec 088 for promovida.

### E019 — [ERRO DE PROCESSO DO AGENTE, não de código] diagnóstico fechado no primeiro achado plausível, sem consultar `errors.md` nem verificar a hipótese
- **Módulo/Pacote:** processo de diagnóstico do agente de IA (transversal — atinge infra, deploy, migrations, review de bot)
- **Sintoma:** o agente encontra uma explicação coerente para o sintoma, para de investigar e age sobre ela. A explicação costuma ser parcialmente certa, o que esconde o erro: o comando proposto não existe, o culpado apontado é inocente, ou a correção resolve o sintoma citado e deixa a causa. Custo real observado: comando inválido oferecido ao mantenedor como pronto para execução, acusação indevida a um gate que funcionava, e ciclos de deploy queimados.
- **Casos reais (todos 2026-07-30, mesma sessão — a repetição na MESMA sessão é o dado relevante):**
  1. **Comando inexistente proposto como solução.** Deploy beta de `downloads` abortou com `Existem migrations manual-risk pendentes`. O agente propôs destravar com `gh workflow run deploy.yml ... -f allow_manual_migrations=true`, em bloco de APROVAÇÃO NECESSÁRIA, pronto para rodar. **Esse input não existia em nenhum workflow do repo.** O [[E012]] já registrava exatamente isso ("não existe caminho via `gh workflow run` pra aplicar migration `manual-risk`, é sempre SSH manual"), com o comando correto ao lado. O agente não leu `errors.md` antes de propor — leu depois, quando o mantenedor mandou investigar.
  2. **Gate acusado sem checar a linha do tempo.** O agente notou que a `migration_034` é datada `@created: 2026-07-28` e que houve deploy verde de `downloads` em 28/07 20:25; concluiu que aquele deploy havia contornado o guard e levantou suspeita de furo no gate. Falso: a 034 entrou em `dev` só no merge da PR #226 (29/07 01:55), **depois** do deploy, que logou `[drift] disco e banco batem (33 migrations)`. **Data no header `@created` é quando o arquivo foi escrito, não quando entrou na branch** — comparar contra `git log` do merge, nunca contra o header.
  3. **Correção rasa sobrevivendo a duas rodadas de review.** Na `migration_036`, o agente escolheu preservar nota de triagem com `COALESCE` ao consolidar duplicatas. Resolvia o sintoma imediato (não perder texto do moderador) e destruía o discriminador: linha virava `dismissed` sem marcador, e os dois leitores de abuso passavam a contá-la como denúncia improcedente. Só apareceu no achado P2 do Codex na PR #231. Antes disso, o mesmo arquivo já tinha sido corrigido duas vezes pelo mesmo motivo — cada correção tratando o achado da vez, nenhuma revisando o desenho.
- **Causa raiz:** o primeiro achado plausível encerra a busca. Falta um passo explícito entre "tenho uma hipótese" e "proponho a ação": confirmar que a hipótese explica *todos* os fatos e que o remédio existe. Agravante estrutural: `errors.md` é consultado como registro *pós-incidente* ("onde eu anoto o que aprendi") em vez de fonte *pré-diagnóstico* ("o que já sabemos sobre este sintoma") — o AGENTS.md manda consultar antes (§Erros Conhecidos, passo 2), e foi esse passo que faltou no caso 1.
- **Prevenção — checklist obrigatório antes de propor ação de mérito sobre um sintoma:**
  1. **`errors.md` primeiro, sempre.** Buscar pelo texto literal do erro antes de formular hipótese: `rtk rg "<trecho exato da mensagem>" .specify/memory/errors.md`. Caso conhecido já traz comando validado e armadilha registrada.
  2. **Todo comando proposto ao mantenedor precisa existir.** Flag/input/subcomando citado em bloco de APROVAÇÃO NECESSÁRIA deve ser verificado na fonte (`rtk rg "<flag>" .github/workflows/`, `--help`, o script) antes de ser oferecido. Bloco de aprovação é contrato de execução, não rascunho.
  3. **Antes de acusar gate/CI/ferramenta de falhar, provar a linha do tempo.** Data de header, nome de arquivo e número de spec não são evidência de quando algo entrou numa branch — só `git log`/`git show` do merge são. Gate que funciona acusado de furo custa investigação inteira.
  4. **Buscar o fato que derruba a hipótese, não o que a confirma.** Se a explicação é "X causou Y", procurar ativamente um caso de X sem Y. Nos três casos acima esse contra-exemplo existia e era barato de achar.
  5. **Ao corrigir achado de review, revisar o desenho, não só a linha citada.** Terceira correção no mesmo arquivo pelo mesmo motivo é sinal de que as duas anteriores trataram sintoma. Regra já escrita em `AGENTS.md` §Regras Gerais de Código ("solução mínima" proibida como critério) — este erro é o registro de ela ter sido violada na prática.
- **Data:** 2026-07-30
- **Relacionados:** [[E012]] (o registro que existia e não foi lido no caso 1), [[E011]] (mesmo padrão de falha que só estoura fora do CI), [[E018]] (precedente de **correção de veredito** — entrada anterior afirmava fechar o erro e não fechava; achado do Codex na PR #219. Mostra que veredito de diagnóstico erra também *dentro* do `errors.md`, e que a correção pertence à própria entrada).
- **Prevenção:** migration nova em `apps/site/db/migrations/` **não** está aplicada só porque o PR foi mergeado — o caminho de aplicação do site é diferente do dos outros módulos. Depois de mergear migration do site, **verificar no banco**, nunca no log de deploy: `docker exec site-<env>-db psql -U admin -d site -t -c "select version from schema_migrations order by version desc limit 1"` tem de mostrar a nova. Se não mostrar, aplicar pelo procedimento pontual acima (o `docker exec ... pnpm run migrate` só resolve se o container já tiver o arquivo). A correção do entrypoint fecha a causa **para os deploys futuros**; container que já estava no ar antes dela continua defasado até o próximo deploy. Vale em dobro quando outro módulo **depende** do schema do site (spec 088: o ingest do Downloads lê a taxonomia central por HTTP e falharia com `catalog_material_type_not_found` em todo material, aparentando scraper quebrado quando o defeito é a migração ausente).
- **Relacionados:** [[E003]] (também sobre módulo cujo DB é migrado por fluxo próprio e não pelo runner do monorepo — ali a consequência era o runner tentar aplicar o que não devia; aqui é ninguém aplicar o que devia).
- **Data:** 2026-07-27
