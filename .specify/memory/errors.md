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

### E008 — build do `apps/site` quebra: `Missing field tsconfigPaths` (Vite 8/rolldown vs Astro/Vite 7)
- **Módulo/Pacote:** apps/site (Astro 6.4.8) · @tailwindcss/vite · vite@8 (rolldown) · CI `lint+build+test` + deploy site
- **Sintoma:** `@artificio/site#build` falha (exit 1) com `[@tailwindcss/vite:generate:build] Missing field 'tsconfigPaths' on BindingViteResolvePluginConfig.resolveOptions` (stack: `rolldown@1.0.3` → `vite@8` `oxcResolvePlugin` → `@tailwindcss/vite`). Determinístico (não flaky); reproduzível local. Disparado por regeneração do lockfile (PR dependabot #73), não por bump direto.
- **Causa raiz:** `apps/site` é Astro 6.4.8, cujo engine de build é **Vite 7** (`astro@6.4.8` pina `vite ^7.3.2`; Astro 6 não é rolldown/Vite 8). O site usa `@tailwindcss/vite`, que importa `vite` como peer. Como `apps/site` **não declarava `vite`**, a resolução dependia da topology de hoisting do lockfile: ao mudar o lock (regen do dependabot), o `@tailwindcss/vite` resolveu o **vite@8 hoisted** (das SPAs React) em vez do Vite 7 do Astro → dois Vite majors no mesmo build → o `oxcResolvePlugin` do vite@8 (rolldown 1.0.3) rejeita config sem `tsconfigPaths`.
- **Solução:** declarar `"vite": "^7.3.2"` em `apps/site/package.json` devDeps (mesma faixa do Astro). `@tailwindcss/vite` passa a resolver `vite@7.3.5` deterministicamente. `^7` capa `<8` → dependabot não pode driftar p/ Vite 8 (que quebraria o Astro). NÃO bumpar rolldown (latest 1.1.2 é API-incompat com vite@8.0.16: remove `viteWasmFallbackPlugin`); tailwind/vite já latest. Vide D084.
- **Prevenção:** Vite 8 é APENAS das SPAs React (accounts/mesas-frontend/glossario-frontend/site-admin/ui); o site Astro é Vite 7 por design (D084). Validar com `turbo build --force` (13/13) + `pnpm@11.8.0 install --frozen-lockfile`. Regen de lockfile (dependabot ou fresh) que mexa em hoisting pode reexpor combos latentes — rodar o build completo no CI de todo PR de deps.
- **Data:** 2026-06-19
