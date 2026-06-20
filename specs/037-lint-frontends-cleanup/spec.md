# 037 — Limpeza de lint dos frontends (glossario + mesas)

- **Módulo/Pacote:** apps/glossario/frontend, apps/mesas/frontend
- **Gate relacionado:** nenhum (qualidade/CI)

## Problema

A spec 035 (BL-CI-ESLINT-FLAT-CONFIG) tornou o `lint` um gate obrigatório no
`ci.yml` (removeu `continue-on-error`). Isso expôs ~79 erros de lint
pré-existentes em dois frontends, antes mascarados pela flag advisory:

- `@artificio/glossario-frontend`: 50 erros
- `@artificio/mesas-frontend`: 29 erros (`@artificio/mesas` apenas delega)

A spec 035 assumia lint verde 13/13 antes de remover a flag (T2c → T2b), mas a
remoção ocorreu sem o verde. Estes erros bloqueiam qualquer PR repo-wide
(inclusive a PR #74 do links, que não tocou nestes arquivos).

Decisão do mantenedor: corrigir de verdade (refatorar), em spec própria, sem
misturar com a PR do links e sem afrouxar o gate.

## Requisitos (numerados, testáveis)

1. `pnpm --filter @artificio/glossario-frontend lint` sai com código 0.
2. `pnpm --filter @artificio/mesas-frontend lint` sai com código 0.
3. `pnpm -w turbo run lint` verde (13/13 pacotes).
4. `react-hooks/set-state-in-effect` (42): refatorar para padrão correto
   (estado derivado em render / `useMemo` / handler), não suprimir por disable.
5. `@typescript-eslint/no-explicit-any` (23): tipar corretamente (sem `any`).
6. `react-refresh/only-export-components` (4), `react-hooks/static-components`
   (4), `react-hooks/immutability` (1): refatorar conforme a regra.
7. `no-unused-vars` (3), `preserve-caught-error` (2), `exhaustive-deps` (3):
   corrigir.
8. Zero mudança de comportamento observável: build verde + smoke das telas
   afetadas.

## Critérios de aceite

- Lint verde nos 2 pacotes e no turbo repo-wide.
- `pnpm --filter @artificio/glossario-frontend build` e
  `pnpm --filter @artificio/mesas-frontend build` verdes.
- `tsc --noEmit` (typecheck) verde nos 2 pacotes.
- Nenhum `eslint-disable` novo sem justificativa inline.

## Fora de escopo

- Mudar a config do `ci.yml` (já é gate; não tocar).
- Backend mesas (`@artificio/mesas-backend`, `lint=none`).
- Mudar versões de plugins ESLint.
- CVEs de dependências (undici/setuptools/xlsx/dompurify/nanoid/form-data/uuid no
  `pnpm-lock.yaml` e `requirements.txt`) — pré-existentes repo-wide, débito de
  bump separado em `backlog.md`. Não entram nos "7 new" do CodeQL.

---

## Adendo — 7 alertas CodeQL high da PR #74 (mesma branch/escopo)

Após os fixes de lint, a #74 passou em `lint + build + test` mas falhou no
**CodeQL**: "7 new alerts including 7 high severity". Investigação read-only
classificou cada um. Tratados nesta mesma spec/branch (monorepo = um projeto só).

| # | Regra | Local | Veredito |
|---|-------|-------|----------|
| 1 | `js/path-injection` | links/server/server.ts:332 | **Real** — `req.params.slug` em `resolve(DIST,"grupo",slug,…)` sem validação; Express decodifica params → `..%2f` escapa de DIST. Só `existsSync` (oráculo de existência), mas traversal legítimo. |
| 2 | `js/missing-rate-limiting` | links/server/server.ts:330 | **Real** — `/grupo/:slug` SSR público (FS + query DB) sem limite → DoS. |
| 3 | `js/missing-rate-limiting` | links/server/server.ts:345 | **Real** — fallback 404 público (FS) sem limite. |
| 4 | `js/missing-rate-limiting` | links/server/server.ts:127 | **Baixo** — `admin.use(requireAuth, requireAdmin)` já protegido por sessão+role; rate-limit = defesa-em-profundidade. |
| 5 | `js/missing-token-validation` (CSRF) | links/server/server.ts:26 | **Gap real** — `cookieParser()` + escrita por cookie sem guard CSRF. |
| 6 | `js/missing-token-validation` (CSRF) | site/server/server.ts:25 | **Gap real (sistêmico)** — mesmo padrão; arquivo apareceu por ter sido tocado na PR. |
| 7 | `js/missing-token-validation` (CSRF) | accounts/src/app.ts:62 | **Gap real (sistêmico)** — idem. |

### Contexto de segurança apurado (read-only)
- **Cookie de sessão** (`apps/accounts/src/cookies.ts`): `httpOnly:true, secure:true,
  sameSite:"lax", domain=.artificiorpg.com`. `SameSite=Lax` mata CSRF cross-**site**
  (evil.com) mas **não** intra-frota: `links.`/`mesas.`/`accounts.` são same-site
  (mesmo domínio registrável) → XSS/subdomínio comprometido pode forjar. Gap legítimo.
- **mesas já tem solução madura**: `apps/mesas/backend/src/middleware/csrfProtection.ts`
  — double-submit token (`xsrf_token` cookie não-httpOnly + header `x-xsrf-token`)
  **+** Origin allowlist **+ bypass de `Authorization: Bearer`** (consumidor não-browser
  escapa). Montado global em `server.ts:86` com `allowedFrontendOrigins`.
- **Blast-radius do CSRF central:** nenhum consumidor não-browser por cookie achado.
  `discord.ts` usa `Bearer` mas é **outbound** (chama discord.com), não consumidor da
  nossa API. Bypass-Bearer do padrão mesas já isenta server-to-server. CORS da frota
  já restringe origens (`credentials:true` + allowlist).

### Solução proposta (PENDENTE autorização nominal — não implementar)
- **R-CQL1** — links/server.ts:332: validar `slug === slugify(slug)` + containment
  `filePath.startsWith(resolve(DIST,"grupo") + sep)` antes de tocar FS.
- **R-CQL2** — links: `publicLimiter` nas rotas públicas (`/grupo/:slug`, fallback 404);
  `adminLimiter` no `admin.use(...)`. `trust proxy` já setado (linha 25).
- **R-CQL3** — CSRF: **promover** o padrão maduro de mesas para `@artificio/auth`
  (reuso, não cópia por-app) e montar em links/site/accounts após `cookieParser()`.
  Isenta safe-methods + Bearer; valida Origin contra allowlist por env; double-submit
  token como fallback.
- **R-CQL4** — CodeQL re-rodado na #74 → 0 high novos; `lint+build+test` segue verde;
  nenhum cliente legítimo (browser frota / Bearer) toma 403.

## Riscos e impacto em outros módulos

- glossario e mesas estão em produção; refatorar effects pode alterar
  comportamento. Mitigar com build + smoke + revisão por arquivo.
- `set-state-in-effect` muitas vezes vira estado derivado — risco de loop/render
  se mal feito. Validar cada caso.
