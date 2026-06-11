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
