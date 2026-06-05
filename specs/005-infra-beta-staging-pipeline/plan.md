# Plano — 005

## Arquitetura da solução

### Modelo de branch (divergência-proof, D041)
```
feat/*  --PR-->  dev  --PR(standing)-->  main
                  |                        |
            auto-deploy beta         dispatch/auto deploy prod
            /opt/artificio-beta      /opt/artificio
            <modulo>beta.artificio   <modulo>.artificio
```
- `dev` protegida (CI obrigatório); `main` protegida (sem push direto; só merge `dev→main`).
- Invariante `main ⊆ dev` garantida por: (a) proibir push em main, (b) gate no deploy prod que checa `git merge-base --is-ancestor origin/main origin/dev`.
- Promoção 1-clique: action mantém PR `dev→main` aberto e atualizado (cria se não existe). Merge dele = promover.

### Parametrização `env` no `_deploy-module.yml`
Novo input `env` (`beta`|`prod`, default `prod`). Deriva (sem duplicar script):
| Dimensão | prod | beta |
|---|---|---|
| ref git | `origin/main` | `origin/dev` |
| dir VM | `/opt/artificio` | `/opt/artificio-beta` |
| env file | `apps/<m>/.env` | `apps/<m>/.env.beta` |
| compose | input `compose_file` (prod) | input `compose_file_beta` |
| compose project | `mesas` / input `compose_project` | `mesas-beta` / input `compose_project_beta` obrigatório |
| containers/db | inputs prod | inputs beta (`*-beta-*`) |
| domínio/smoke | `critical_routes` | `critical_routes_beta` |

O bloco REMOTE passa a receber `DEPLOY_REF`, `DEPLOY_DIR`, `ENV_FILE` por env var; troca os literais hardcoded (`cd /opt/artificio`, `origin/main`, `apps/${MODULE}/.env`). Caminho prod produz exatamente os mesmos valores de hoje (prova de não-regressão).

### Beta clone na VM
`/opt/artificio-beta` = 2º clone do monorepo, deploy key read-only, checkout `dev`. `.env.beta` por módulo (gitignored, fonte segura). DB beta = volume próprio do `docker-compose.beta.yml`. O beta não faz fallback para `/opt/artificio` prod: todo módulo precisa de `.env.beta`, e `apps/accounts/.env.beta` existe como anchor SSO explícito para comparar `JWT_SECRET` (sem copiar OAuth prod).

### Hydrate prod→beta
Religar `apps/mesas/backend` rota admin `/sync/hydrate` (portada do legado `adminHydration.ts` + `db/prod.ts`), conexão `PROD_DB_URL` read, gate `NODE_ENV!=production`, transação única, auth `@artificio/auth` admin.

## Arquivos afetados (por módulo/pacote)
- **infra/CI:**
  - `.github/workflows/_deploy-module.yml` — input `env` + parametrização ref/dir/env_file/compose/rotas; REMOTE usa vars.
  - `.github/workflows/deploy-mesas.yml` — add trigger `push: dev` (path-filtered) chamando reusável com `env=beta`; mantém prod em `main`/dispatch.
  - `.github/workflows/promote-dev-to-main.yml` (novo) — mantém PR standing `dev→main` atualizado.
  - `.github/workflows/_guard-main-ancestor.yml` ou step no deploy prod — gate invariante.
  - branch protection `main` e `dev` (config via GitHub, ação Codex/mantenedor).
- **apps/mesas:**
  - `docker-compose.beta.yml` (novo, base no legado, rede `artificio_net`, containers `mesas-beta-{api,app,db}`, domínio `mesasbeta.`, sem OAuth próprio).
  - `apps/mesas/.env.beta` (na VM, não git).
  - `backend/src/routes/adminHydration.ts` + `backend/src/db/prod.ts` (religar/portar do legado, auth via `@artificio/auth`).
- **Cloudflare:** hostname `mesasbeta.artificiorpg.com` → container `mesas-beta-app` (tunnel ingress).
- **docs:** `project-state.md`, `roadmap.md` (linha mesas beta), sessão.

## Contratos/interfaces tocados
- **auth/accounts:** beta consome SSO igual prod; `return`/allowlist `.artificiorpg.com` já cobre `mesasbeta.` (sufixo). Confirmar allowlist aceita o subdomínio beta.
- **subdomínio/DNS:** novo hostname `mesasbeta.` no tunnel. Sem mexer em prod.
- **schema:** beta roda as mesmas migrations frameworkadas no seu DB próprio; prod intocado.
- **`_deploy-module.yml`:** contrato reusável muda (novo input) — consumido hoje por `deploy-mesas`/`deploy-accounts`; default `env=prod` preserva chamadas atuais.

## Impacto em consumidores
- `deploy-mesas.yml` e `break-glass-deploy-prod.yml` usam o reusável — novo input opcional não quebra (default prod). Validar no CI.
- Codex e fluxo de PR: alvo passa a ser `dev`. Documentar em AGENTS/operating-model.
- `break-glass-deploy-prod.yml` continua como escape hatch p/ hotfix direto em prod.

## Rollback
- CI/CD: reverter os workflows via git (PR). Caminho prod inalterado se `env=prod` default mantido. Beta usa `docker compose -p mesas-beta`, separado de `mesas`, para `down --remove-orphans` nunca enxergar containers prod como órfãos.
- Beta na VM: `docker compose -f docker-compose.beta.yml down` + remover `/opt/artificio-beta` não afeta prod (E144 respeitado — composes/nomes distintos).
- Deploy beta tem rollback próprio (snapshot+containers) herdado do reusável.
- Branch protection reversível na config do GitHub.

## Validação (como provo que funciona)
1. CI: `env=prod` gera deploy idêntico ao atual (diff do script renderizado / smoke prod 200/401/302 inalterado).
2. Push de teste em `dev` tocando `apps/mesas/**` → `mesasbeta.` sobe 200, prod segue 200 durante o deploy.
3. Push em `dev` tocando só outro path → mesas-beta **não** redeploya.
4. E2E beta: login accounts (sem `deleted_client`), rota privada 401→OK, logout.
5. Hydrate: roda em beta OK; retorna 403 simulando `NODE_ENV=production`; contagens prod inalteradas.
6. Gate: PR/dispatch prod com `main` artificialmente à frente de `dev` → bloqueado com mensagem.
7. Push direto em `main` → rejeitado pela proteção.
