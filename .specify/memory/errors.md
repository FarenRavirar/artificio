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
