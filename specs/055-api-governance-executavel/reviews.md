# 055 — Reviews

> Registro de revisões externas/internas da spec 055.

## REV-055-CR1 — CodeRabbit no PR #103 (2026-06-28)

Review automático do CodeRabbit sobre o fechamento estrito (commit `19ad392`). Pétrea: não respondemos o bot no PR; veredicto e ação ficam aqui. **Todos os 7 achados procederam e foram corrigidos no mesmo escopo** (sem débito remanescente).

| # | Arquivo | Severidade | Achado | Resolução |
|---|---|---|---|---|
| 1 | `docs/api/.api-allowlist.json` | Minor | mojibake `diverg�ncias` no `_description` | Corrigido p/ `divergências` (UTF-8). |
| 2 | `scripts/api/bundle-api.ts` | Major | `continue` em YAML quebrado/sem `paths` gerava bundle parcial silencioso | Falha dura (`process.exit(1)`) — bundle é fonte primária, não pode sair incompleto. |
| 3 | `scripts/api/check-api.ts` | Minor | texto do relatório dizia "similaridade ≥ 75" mas lógica usa 90 | Texto + default `minScore` alinhados a 90 (DEB-055-16). |
| 4 | `scripts/api/consumers.ts` | Minor | fallback `service-wrapper` gerava endpoint sintético `<method>` que `hasSyntheticEndpointSegment` descartava (branch morto) | Branch removido; só registra wrapper que resolve p/ endpoint concreto. `inferMethodFromName` (agora morta) removida. |
| 5 | `scripts/api/generate-openapi.ts` | Major | merge de overlay por path inteiro descartava bloco curado quando o path já era gerado nativamente → perda de metadata (ex.: `/admin/secrets/{name}` perdia `auth: service` + `x-artificio-consumers: mesas-backend`) | Reescrito para merge por **path + método**: overlay tem precedência por operação (curadoria > heurística), métodos nativos não cobertos preservados. Validado: secrets recuperou metadata curada. |
| 6 | `scripts/api/generate-openapi.ts` | Major | `site` no inventário mas sem branch em `servers` → `site.openapi.yaml` com `servers:` vazio | Adicionado branch `site` (`beta.artificiorpg.com` + localhost:4322). |
| 7 | `scripts/api/inventory.ts` | Major | recursão de factory seguia qualquer call desconhecido (`app.use(mw())`) caindo no arquivo atual → risco de endpoints falsos sob prefixo errado | Recursão restrita a import que comprovadamente declara Router (`fileDeclaresRouter`); removido fallback p/ arquivo atual. |

Bug adicional achado nesta rodada (CI vermelho no PR #103, não-CodeRabbit): `inventory.ts` não normalizava separador de path → Windows gerava `\`, CI Linux `/` → artefato divergia do regenerado e o check "Verify generated artifacts committed" falhava. Corrigido (normalização `\`→`/` na linha do `relativePath`).

Validação pós-fixes: `pnpm verify:api` exit 0, `pnpm api:check:strict` exit 0 (allowlist vazia), `pnpm run lint` 15/15, regeneração determinística (sem drift). CODE_ONLY=0, sem regressão de rotas.


## Pendentes aceitas (não bloqueiam fechamento)

### REV-055-F1-01 — OpenAPI base ainda omite rotas criadas por factories

Status: aceita como dívida técnica — coberto por `DEB-055-12`; não bloqueia o fechamento da spec 055 em modo inicial

Severidade: P1

Escopo: Fase 1 (`docs/api/openapi/*.yaml`)

Achado:
O OpenAPI mínimo não documenta quatro rotas reais porque o inventário/generator ainda não resolve factories que retornam `Router()`:

- `PUT /admin/secrets/:name` — `apps/accounts/src/adminSecretsRoutes.ts:73`
- `GET /admin/secrets/:name` — `apps/accounts/src/adminSecretsRoutes.ts:112`
- `POST /api/v1/admin/discord/drafts/:id/correction` — factory em `apps/mesas/backend/src/routes/discord/corrections.ts:9`, handler em `apps/mesas/backend/src/routes/discord/utils.ts:154`
- `POST /api/v1/admin/import/drafts/:id/correction` — factory em `apps/mesas/backend/src/routes/inbox/corrections.ts:4`, handler em `apps/mesas/backend/src/routes/discord/utils.ts:154`

Evidência:
`pnpm api:check` passa porque a allowlist cobre legado, mas checagem direta dos YAMLs retorna `MISSING` para essas quatro operations.

Impacto:
A Fase 1 afirma que existe OpenAPI mínimo por app, mas essas rotas admin importantes continuam invisíveis para agentes/MCP/docs. Isso é especialmente sensível para `accounts` porque envolve segredo administrativo.

Decisão de fechamento:
Não inserir manualmente de forma frágil no YAML se `api:generate-openapi` sobrescreve. A lacuna é aceita no fechamento da spec 055 porque a spec entrega governança executável em modo inicial, não cobertura 100% do legado. Corrigir via suporte a factory/overlay no inventário/gerador antes de ativar modo estrito ou declarar cobertura completa de OpenAPI.

## Aplicadas

### REV-055-F8-01 — `api:diff`/`api:docs` dependiam de shell e `api:diff` não era robusto para `origin/<base>`

Status: aplicada

Severidade: P2

Escopo: Fase 8 (`scripts/api/diff-api.ts`, `scripts/api/build-docs.ts`, `docs/api/README.md`)

Achado:
`api:diff` buscava apenas `dev:path` via `git show`. Em CI de PR, o workflow faz `git fetch origin ${{ github.base_ref }}`, mas isso não garante branch local `dev`; o ref disponível pode ser `origin/dev`. Além disso, `api:diff` e `api:docs` montavam comandos como string (`npx openapi-diff ...`, `redocly build-docs ...`), menos robusto para paths/títulos com espaços e desnecessário porque as dependências já estão no workspace.

Correção aplicada:
`api:diff` agora usa `GITHUB_BASE_REF || dev`, tenta `base` e `origin/base`, e chama `pnpm exec openapi-diff` via `execFileSync`. `api:docs` chama `pnpm exec redocly build-docs` via `execFileSync`. O README foi ajustado para documentar `pnpm api:lint` como wrapper Redocly + validação local de `x-artificio-*`.

Validação:
`pnpm api:diff` passou e gerou `docs/api/generated/api-diff.generated.md`. `pnpm api:docs --app accounts` passou. `pnpm api:docs` passou gerando os 4 HTMLs. `pnpm exec tsc --noEmit --allowImportingTsExtensions --module ESNext --moduleResolution Bundler --target ES2022 --types node scripts/api/diff-api.ts scripts/api/build-docs.ts` passou.

### REV-055-F9-01 — Job `api-governance` cobre o pipeline inicial sem executar docs visuais

Status: aplicada

Severidade: P3

Escopo: Fase 9 (`.github/workflows/ci.yml`)

Achado:
O job `api-governance` foi conferido contra a ordem esperada da spec: checkout com `fetch-depth: 2`, fetch do base ref em PR, install, `api:inventory`, `api:consumers`, `api:lint`, `api:check` e `api:diff` não bloqueante. Não há step `api:docs`, conforme requisito offline-only.

Validação:
Busca no workflow confirmou `pnpm api:inventory`, `pnpm api:consumers`, `pnpm api:lint`, `pnpm api:check`, `pnpm api:diff || true`, `continue-on-error: true`, `fetch-depth: 2` e ausência de `api:docs`.

### REV-055-F7-01 — `api:traffic` não removia query string na chave normalizada

Status: aplicada

Severidade: P2

Escopo: Fase 7 (`scripts/api/traffic.ts`, `docs/api/generated/api-traffic.generated.json`)

Achado:
`traffic.ts` repetia o bug de precedência de `normalizePath()`: a query string não era removida do path real. Isso faria tráfego observado de `/api/groups?source=community` não bater com `GET /api/groups` no `api:check`, reduzindo o valor do relatório de órfãs.

Correção aplicada:
`normalizePath()` agora remove query string antes de trailing slash e normalização de parâmetros.

Validação:
`pnpm api:traffic --manual <json temporário>` gerou `normalizedKey: "GET /api/groups"` para `/api/groups?source=community&status=active`. Depois, `pnpm api:traffic` foi executado sem entrada para remover o tráfego fake e restaurar `api-traffic.generated.json` com 0 rotas. `pnpm exec tsc --noEmit --allowImportingTsExtensions --module ESNext --moduleResolution Bundler --target ES2022 --types node scripts/api/traffic.ts` passou.

### REV-055-F6-01 — Relatório de órfãs tratava `public` como justificativa de ausência de consumidor

Status: aplicada

Severidade: P2

Escopo: Fase 6 (`scripts/api/check-api.ts`, `docs/api/generated/api-orphans.generated.md`)

Achado:
`detectOrphans()` excluía rotas `public` da lista de órfãs, embora a regra da Fase 6 diga que apenas `admin`, `cron`, `webhook`, `cross-app` e `internal` justificam ausência de consumidor. Isso escondia rotas públicas potencialmente mortas ou consumidores não detectados. O relatório também dizia threshold de duplicatas `≥ 60`, mas o código usa `75` + `tokenSimilarity >= 0.5`.

Correção aplicada:
`public` deixou de justificar ausência de consumidor. A normalização de duplicatas também passou a remover query string com a mesma correção de precedência da Fase 5. O texto do relatório agora documenta threshold real `≥ 75`.

Validação:
`pnpm api:check` passou com exit 0, gerando 119 órfãs e 200 duplicatas. `pnpm exec tsc --noEmit --allowImportingTsExtensions --module ESNext --moduleResolution Bundler --target ES2022 --types node scripts/api/check-api.ts` passou.

### REV-055-F5-01 — `api:check` não removia query string por precedência de operador

Status: aplicada

Severidade: P1

Escopo: Fase 5 (`scripts/api/check-api.ts`, `docs/api/.api-allowlist.json`)

Achado:
`normalizePath()` pretendia remover query string, mas por precedência de `||` o `.split('?')` só era aplicado ao fallback `'/'`. Assim consumidores como `GET /api/groups?source=community&status=active` viravam chaves diferentes de `GET /api/groups`, criando `CONSUMER_ONLY` falso e quebrando o baseline.

Correção aplicada:
`normalizePath()` agora executa `split('?')[0]` antes de remover trailing slash e normalizar parâmetros. A allowlist foi regenerada para o baseline após as correções das Fases 2 e 3.

Validação:
`pnpm api:check` passou com 399 chaves únicas, 53 órfãs e 200 duplicatas. Teste negativo adicionando rota fake somente em `api-inventory.generated.json` falhou com exit 1 (`CODE_ONLY nova`) e o arquivo foi restaurado. `pnpm exec tsc --noEmit --allowImportingTsExtensions --module ESNext --moduleResolution Bundler --target ES2022 --types node scripts/api/check-api.ts` passou.

### REV-055-F4-01 — `api:lint` não bloqueava metadado obrigatório ausente

Status: aplicada

Severidade: P1

Escopo: Fase 4 (`redocly.yaml`, `package.json`, `scripts/api/lint-openapi.ts`)

Achado:
O lint via Redocly validava enums quando o campo existia, mas não falhava quando `x-artificio-owner` era removido das operations. O teste negativo com `x-artificio-owner` ausente retornava exit 0, então a trava principal da Fase 4 não era confiável.

Correção aplicada:
`api:lint` passou a executar `scripts/api/lint-openapi.ts`, que roda o Redocly e também valida localmente todos os `x-artificio-*` obrigatórios, enums e `x-artificio-consumers` não vazio em operations `cross-app`.

Validação:
`pnpm api:lint` passa com 7 warnings conhecidos de `no-ambiguous-paths`. Teste negativo com remoção temporária de `x-artificio-owner` em `accounts.openapi.yaml` falha com exit 1 e o arquivo é restaurado. `pnpm exec tsc --noEmit --allowImportingTsExtensions --module ESNext --moduleResolution Bundler --target ES2022 --types node scripts/api/lint-openapi.ts` passou.

### REV-055-F3-01 — Scanner de consumidores truncava template literals após o primeiro parâmetro

Status: aplicada

Severidade: P1

Escopo: Fase 3 (`scripts/api/consumers.ts`)

Achado:
`extractPathFromArg()` montava template literals usando o texto inicial e `:param`, mas não recolocava os trechos literais posteriores. Um endpoint como ``/api/groups/${slug}/report`` virava `/api/groups/:param`, apagando a ação final e criando drift falso contra código/OpenAPI.

Correção aplicada:
O scanner agora adiciona `span.literal.text` após cada placeholder. Também foi corrigido o default de `fetch(url, options)` sem `method`: continua sendo `GET`, não `UNKNOWN`.

Validação:
`pnpm api:consumers` passou e os endpoints únicos subiram de 175 para 198. `pnpm exec tsc --noEmit --allowImportingTsExtensions --module ESNext --moduleResolution Bundler --target ES2022 --types node scripts/api/consumers.ts` passou.

### REV-055-F2-01 — Inventário ignorava o mesmo router montado em múltiplos prefixos

Status: aplicada

Severidade: P1

Escopo: Fase 2 (`scripts/api/inventory.ts`)

Achado:
O controle de recursão usava apenas `filePath::scopeVar`. Quando o mesmo router era montado em prefixos diferentes, o segundo mount era registrado, mas as rotas internas não eram reescaneadas. Caso real: `apps/mesas/backend/src/server.ts` monta `authRoutes` em `/api/v1/auth` e `/auth`; o inventário antigo registrava o mount `/auth`, mas perdia `GET /auth/google`, `GET /auth/google/callback` e `POST /auth/logout`.

Correção aplicada:
O controle de recursão passou a usar `filePath::prefix::scopeVar`, preservando a proteção contra loop dentro do mesmo mount sem perder aliases reais de rota. Também foi ajustado o narrowing de tipo do AST para `tsc --noEmit` pontual.

Validação:
`pnpm api:inventory` passou e subiu de 291 para 294 rotas (`mesas`: 197 → 200). `pnpm exec tsc --noEmit --allowImportingTsExtensions --module ESNext --moduleResolution Bundler --target ES2022 --types node scripts/api/inventory.ts` passou.

### REV-055-F1-02 — Heurística não reconhecia `/api/v1/health`, `/api/v1/me` e segmentos terminados em `/admin`

Status: aplicada

Severidade: P2

Escopo: `scripts/api/generate-openapi.ts` + OpenAPI gerados

Achado:
A classificação usava apenas match exato para `/health`/`/healthz`, `p === '/me'`, e `p.includes('/admin/')`. Isso deixava rotas como `/api/v1/health`, `/api/v1/me` e `/api/v1/systems/admin` com `x-artificio-*` incorretos.

Correção aplicada:
O classificador passou a reconhecer segmentos por regex (`/(^|\/)(health|healthz)$/`, `/(^|\/)admin(\/|$)/`, `/(^|\/)me(\/|$)/`). OpenAPI regenerado.

Validação:
`pnpm api:lint` verde (7 warnings conhecidos de `no-ambiguous-paths`). Checagem direta não encontra mais os casos óbvios de admin/health/me mal classificados.

### REV-055-F10-01 — apps/mesas/MAPA_DE_API.md deprecado como fonte não canônica

Status: aplicada

Severidade: P3

Escopo: Fase 10 (`apps/mesas/MAPA_DE_API.md`, `docs/api/README.md`)

Achado:
O mapa manual no `MAPA_DE_API.md` não acompanha o código real. Agentes podiam usá-lo como fonte primária por ser o doc histórico de referência de rotas.

Correção aplicada:
1. Cabeçalho DEPRECATED explícito no topo do `MAPA_DE_API.md`.
2. Tabela aponta para as fontes canônicas: `docs/api/openapi/*.openapi.yaml`, `docs/api/generated/api-map.generated.md`, `pnpm api:check` e `docs/api/README.md`.
3. Comandos de consulta listados no topo do documento legado.
4. Conteúdo antigo preservado apenas como referência histórica, abaixo do marcador `---`.
5. `docs/api/README.md` declara explicitamente que agente não deve usar memória de chat, sessões anteriores nem mapa manual como fonte primária.

Validação:
`pnpm api:inventory` passou com 294 rotas. `pnpm api:consumers` passou com 299 chamadas e 198 endpoints únicos. `pnpm api:lint` passou com 7 warnings conhecidos de `no-ambiguous-paths`. `pnpm api:check` passou com exit 0, 294 rotas no inventário, 275 chamadas agregadas, 225 operations OpenAPI, 119 órfãs e 200 duplicatas.

## Descartadas

Nenhuma revisão descartada.
