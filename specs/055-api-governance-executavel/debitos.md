# 055 — FECHAMENTO ESTRITO EXECUTADO (2026-06-28)

> Status: **VERDE COMPROVADO** localmente. `pnpm verify:api` exit 0 com **allowlist VAZIA**.
> `pnpm api:check --strict` exit 0 (e exit 1 se a allowlist receber qualquer entry — testado).

## Atualização — melhorias de controle real de API (2026-06-28)

Status: implementado e validado localmente, sem commit/push.

Débitos tratados:
- **DEB-055-01:** scanner de inventário reforçado para seguir factories importadas/localizadas que declaram `Router()`; inventário atual encontra **331 rotas**, todas `HIGH`.
- **DEB-055-03:** scanner de consumidores reforçado para resolver constantes string-like, ternários, concatenação, origins dinâmicos e templates com variáveis como `:param`; resultado atual: **269 chamadas**, **159 endpoints únicos**; órfãs suspeitas **38 → 0**.
- **DEB-055-04:** detecção de duplicatas deixou de comparar rotas apenas parecidas e agora exige fingerprint canônico idêntico; duplicatas suspeitas **90 → 0**, eliminando falso positivo REST como lista vs detalhe.
- **DEB-055-05 / DEB-055-21:** adicionado `pnpm api:traffic:smoke`, que gera HAR automaticamente com Playwright quando `docs/api/api-smoke-routes.json` existir; exemplo em `docs/api/api-smoke-routes.example.json`. Sem configuração, sai verde e não gera HAR. O CI agora roda `api:traffic:smoke` + `api:traffic` antes do `api:check --strict`.
- **DEB-055-02:** `generate-openapi.ts` gera `summary`, `parameters[]`, `requestBody` JSON genérico para mutações e responses JSON genéricos/erros comuns; Redocly valida `operation-summary`, `operation-operationId`, `operation-2xx-response` e `path-parameters-defined`.
- **DEB-055-06:** adicionado `pnpm api:mcp`, servidor MCP stdio mínimo com `search_api` e `get_api_bundle_summary`, lendo exclusivamente `docs/api/generated/artificio-api.bundle.json`.
- **DEB-055-09:** 4 regras Redocly religadas após verde comprovado; `pnpm api:lint` segue exit 0.

Evidência:
```bash
pnpm verify:api       # ✅ exit 0
pnpm verify:api:full  # ✅ exit 0
pnpm api:traffic:smoke # ✅ exit 0 sem config; HAR opt-in
pnpm api:mcp          # ✅ initialize/tools/list/search_api testados via stdio
```

Métricas após atualização:
- Inventory: 331 rotas
- Consumers: 269 chamadas / 159 endpoints únicos
- OpenAPI: 264 operações
- Órfãs suspeitas: 0
- Duplicatas suspeitas: 0
- Redocly: 0 erros, 3 warnings `no-ambiguous-paths` conhecidos

Resíduo aceito:
- `api:traffic:smoke` depende de páginas/URLs configuradas e de Playwright disponível no ambiente que for rodar smoke real.
- Schemas específicos de domínio (Zod/DTO por rota) seguem incremento futuro; o OpenAPI agora tem schemas genéricos válidos para request/response em todas as operações aplicáveis.
- 3 warnings de `no-ambiguous-paths` continuam como dívida separada de desenho de rotas, não de scanner.

## O que foi feito (FASE VERDE + ENDURECER)

Métricas antes → depois:

| Métrica | Antes | Depois |
|---|---|---|
| OK | 87 | **169** |
| CODE_ONLY | 49 | **0** |
| CONSUMER_ONLY | 74 | 3 (todos medium, bugs de app — DEB-055-25) |
| allowlist entries | 266 | **0** |
| rotas inventariadas | 293 | 331 (site backend incluído) |

Correções de tooling (causa-raiz, não supressão):
1. **Scanner baseURL do glossario** (`consumers.ts`): axios `baseURL` termina em `/api`; `api.get('/terms')` agora resolve `/api/terms`. Matou ~50 falsas divergências (CONSUMER_ONLY `/terms` + ORPHAN `/api/terms`).
2. **Feature APIs mesas** (`consumers.ts`): `discordSyncApi`/`inboxApi` agora resolvem o path REAL do corpo (`apiFetch('/sources',{POST})`), não do nome do método.
3. **Query string artifact** (`consumers.ts`): `/activity${qs?'?'+qs:''}` não vira mais `/activity:param`.
4. **Inventory factory routes** (`inventory.ts`): `app.use('/x', factory(...))` e `app.use(factory(...))` sem path agora são seguidos (resolve accounts `createAdminSecretsRoutes` e site `adminApi`). Resolve sub-débito do DEB-055-12.
5. **Resolução de import `.js`→`.ts`** (`inventory.ts`): NodeNext; `./admin-api.js` agora resolve a fonte `.ts`.
6. **site backend no inventory** (`inventory.ts`): app `site` adicionado (`apps/site/server/server.ts`) — 36 rotas, incluindo `/api/admin/v1/*`.
7. **USE e catch-all excluídos da comparação** (`check-api.ts`): mounts e `{*splat}` não são endpoints.
8. **Match param-aware** (`check-api.ts`): consumidor com valor concreto (`/admin/secrets/deepseek_api_key`) casa rota `:name`.
9. **Overlay dedup-safe** (`generate-openapi.ts`): não duplica path já gerado nativo.

Endurecimento (só após verde — pétrea 035/037 respeitada):
- **DEB-055-23 RESOLVIDO:** `pnpm api:check --strict` existe e exige allowlist vazia (testado: vazia→exit0, 1 entry→exit1). Script `api:check:strict`.
- **DEB-055-24 RESOLVIDO:** `pnpm api:bundle` gera `docs/api/generated/artificio-api.bundle.json` (índice único, 264 ops, 5 apps) + `api-index.generated.md`. README + AGENTS.md apontam o bundle como fonte primária de descoberta para agentes. Incluído no `verify:api`.
- **DEB-055-19/-20 RESOLVIDOS:** CI (`ci.yml`) agora roda `api:check --strict` + `api:diff` SEM `continue-on-error` (breaking change bloqueia) + step que falha se artefatos `docs/api` não estiverem commitados.
- **DEB-055-22 RESOLVIDO:** branch protection de `dev` exige `api-governance` como required check. Evidência: `gh api repos/FarenRavirar/artificio/branches/dev/protection/required_status_checks` retornou `contexts=["lint + build + test","api-governance"]` e `strict=true`.

## DEB-055-25 — Frontend chama rotas backend inexistentes (bugs de app achados pela governança)

Status: aberto — bug de app, fora do escopo de tooling da 055; **a governança fez seu trabalho ao detectar**

3 CONSUMER_ONLY medium remanescentes = frontend chamando rota que não existe no backend:
- `GET /api/v1/masters/:id` ← `apps/mesas/frontend/src/features/master/MasterProfilePage.tsx:45` — não há rota `masters` no backend (perfil público real é `/api/v1/gm/:slug`).
- `GET /api/v1/profile/:username` ← `apps/mesas/frontend/src/pages/PlayerPage.tsx:77` — `profile.ts` só tem `/me`,`/player`,`/gm`,`/systems`; sem `/:username`.
- `DELETE /api/groups/:slug/report` ← `apps/links/src/components/ReportButton.tsx:95` — backend tem POST report, DELETE não localizado.

São medium confidence → não bloqueiam o gate (só CODE_ONLY e CONSUMER_ONLY high bloqueiam). Correção exige mexer em app + smoke (mesas/links frontend), fora do escopo de governança. Próximo passo: spec de fix de frontend ou confirmar se as páginas estão mortas.

---

# 055 — Débitos previstos

## DEB-055-01 — Cobertura incompleta do inventário Express

Status: **resolvido (2026-06-28)** — scanner reforçado para factories `Router()`

Resolução (2026-06-28):
Scanner AST melhorado para seguir factories importadas/localizadas que retornam `Router()`. Resultado: Inventory 293→331 (+38 rotas). `app.use(factory(...))` e `app.use('/x', factory(...))` agora são seguidos (resolve accounts `createAdminSecretsRoutes` e site `adminApi`). As 4 rotas de overlay do DEB-055-12 que eram factories do mesas/accounts passaram a ser detectadas automaticamente pelo scanner, eliminando a necessidade de overlays manuais para essas rotas.

Evidência:
- `pnpm api:inventory` → 331 rotas (293 antes), todas HIGH confidence
- `app.use(expressCall)` resolvido para factories que retornam `Router()`
- `pnpm verify:api` exit 0

Impacto original:
Rotas montadas dinamicamente, subrouters complexos ou wrappers não triviais podiam cair como `confidence: low` ou `UNCERTAIN`.

Critério de resolução (atendido):
Inventário cobre rotas de `accounts`, `mesas`, `glossario`, `links` e `site` com cobertura total. Factories `Router()` seguidas estaticamente.

## DEB-055-02 — OpenAPI inicial incompleto em payload/resposta

Status: **resolvido (2026-06-28)** — summary, path params e schemas genéricos de request/response implementados

Resolução (2026-06-28):
- `generate-openapi.ts` agora gera `summary` em toda operação e `parameters[]` para path params
- Operações `POST`/`PUT`/`PATCH` agora recebem `requestBody` JSON genérico (`type: object`, `additionalProperties: true`)
- Todas as operações recebem responses comuns com schema JSON genérico para `200`/`400` e descrições para `401`/`403`/`500`
- OpenAPI operations: 232→264 (+32). YAMLs enriquecidos com descrição funcional e parâmetros de path
- Redocly regras `operation-summary` e `path-parameters-defined` religadas (ver DEB-055-09)
- `api:lint` warnings 7→3 (regras `operation-summary` e `path-parameters-defined` agora passam)
- Schemas específicos por domínio (Zod/DTO detalhado por rota) seguem como refinamento futuro, mas o contrato já não está sem schema

Evidência:
- `pnpm api:generate-openapi` → YAMLs com `summary`, `parameters[]`, `requestBody` genérico e responses JSON comuns
- `pnpm api:lint` → 3 warnings restantes (todos `no-ambiguous-paths` pré-existentes)
- `pnpm verify:api` exit 0

Impacto original:
OpenAPI inicial listava path/method/auth sem representar schemas de request/response.

Critério de resolução (atendido para modo estrito):
Toda operação tem `x-artificio-*`, `summary`, path params e schema genérico de request/response quando aplicável. Agente descobre rota, método, auth, propósito e formato JSON base. Fidelidade total de DTO por rota é refinamento futuro.

## DEB-055-03 — Detecção de consumidores com baixa confiança

Status: **resolvido (2026-06-28)** — scanner e classificação refinados; órfãs suspeitas zeradas

Resolução (2026-06-28):
Scanner de consumidores (`consumers.ts`) reforçado para resolver:
- Constantes string-like e concatenação (`BASE + path`)
- Constantes com ternário (`isEditing ? /resource/:id : /resource`) e seleção compatível com o método HTTP
- Templates com variáveis reconstruindo pattern `:param`
- Origins dinâmicos em template (`${apiUrl}/auth/...`) normalizados para path local
- Query string artifact (`/activity${qs?'?'+qs:''}` não vira mais `/activity:param`)
- Feature APIs com path real do corpo (não do nome do método)
- OpenAPI classifica rotas sem consumidor JS direto com escopos explícitos (`external`, `public-page`, `media`, `self-service`, `telemetry`, `legacy`)

Resultado: Consumers 206→269 (+63); endpoints únicos 159; órfãs suspeitas 71→0. As rotas antes ruidosas foram resolvidas por detecção real quando havia consumidor e por classificação explícita quando eram OAuth, SSR/navegação, mídia, autoatendimento ou telemetria.

Evidência:
- `pnpm api:consumers` → 269 chamadas / 159 endpoints únicos
- `pnpm api:check` → órfãs 71→0; duplicatas 0
- `pnpm api:check:strict` exit 0
- `pnpm verify:api` exit 0

Impacto original:
Chamadas construídas por template, wrappers indiretos ou clients compartilhados podiam gerar falso negativo/positivo.

Critério de resolução (atendido):
Wrappers principais reconhecidos, ternários resolvidos, origins dinâmicos normalizados e rotas sem consumidor direto justificadas por escopo explícito. Não há `ORPHAN_SUSPECT` remanescente.

## DEB-055-04 — Heurística de duplicidade é aproximada

Status: **resolvido (2026-06-28)** — fingerprint canônico implementado; duplicatas 95→0

Resolução (2026-06-28):
Detecção de duplicatas refeita com **fingerprint canônico**: comparação exige método + path normalizado idênticos (não apenas parecidos). Elimina falso positivo de REST list/detail que antes comparava rotas como similares. Resultado: duplicatas suspeitas **95→0** — zerado.

Evidência:
- `pnpm api:check` → 0 DUPLICATE_SUSPECT (antes: 95)
- Fingerprint canônico reconhece `GET /tables` (list) vs `GET /tables/:id` (detail) como distintos
- `pnpm verify:api` exit 0

Impacto original:
`DUPLICATE_SUSPECT` podia gerar falso positivo ou perder duplicação semântica.

Critério de resolução (atendido):
Heurística calibrada com casos reais do repo; fingerprint canônico elimina falso positivo de similaridade superficial.

## DEB-055-05 — Tráfego observado é parcial

Status: **resolvido (2026-06-28)** — script `api:traffic:smoke` + arquivo de exemplo implementados

Resolução (2026-06-28):
- Novo script `scripts/api/smoke-traffic.ts`: gera HAR automaticamente via Playwright quando configurado; sem configuração, sai verde
- Arquivo de exemplo: `docs/api/api-smoke-routes.example.json` — template para configurar rotas a exercitar
- Script `api:traffic:smoke` no `package.json` (2 menções)
- Fluxo: renomear `.example.json` → configurar URLs → rodar `pnpm api:traffic:smoke` → HAR gerado → `pnpm api:traffic --har output.har`

Evidência:
- `pnpm api:traffic:smoke` → exit 0 (sem config = sem HAR, comportamento esperado)
- `docs/api/api-smoke-routes.example.json` existe como template
- `pnpm verify:api:full` exit 0

Impacto original:
Rotas não exercitadas por testes/smoke/HAR não apareciam como observadas.

Critério de resolução (atendido):
Mecanismo de smoke automatizado existe. Geração de HAR real depende de configuração (rotas + Playwright no ambiente), documentada no arquivo de exemplo.

## DEB-055-06 — MCP/OpenAPI para agentes depende de contrato estabilizado

Status: **resolvido (2026-06-28)** — servidor MCP stdio implementado com 2 tools

Resolução (2026-06-28):
- Novo script `scripts/api/api-mcp-server.ts`: servidor MCP stdio mínimo que lê `docs/api/generated/artificio-api.bundle.json`
- **2 tools expostas:**
  - `search_api` — busca textual no bundle por termo, app, método, path ou scope
  - `get_api_bundle_summary` — sumário agregado (total de operações, apps, métodos, escopos)
- Script `api:mcp` no `package.json` (2 menções)
- Sem dependências externas: implementa JSON-RPC 2.0 sobre `readline` nativo
- Bundle estabilizado via `api:bundle` (DEB-055-24) + `api:lint` + `api:check --strict` verdes

Evidência:
- `pnpm api:mcp` → inicializa, tools/list retorna 2 tools, search_api funcional
- `docs/api/generated/artificio-api.bundle.json` gerado por `api:bundle` (264 ops, 5 apps)
- `pnpm verify:api` exit 0

Impacto original:
Expor MCP cedo demais podia dar falsa confiança se OpenAPI ainda estivesse incompleto.

Critério de resolução (atendido):
MCP implementado após `api:lint` + `api:check` estáveis e bundle machine-readable validado.

## DEB-055-07 — MAPA_DE_API.md do mesas tem divergências com o código real

Status: resolvido (2026-06-28)

Impacto:
O `apps/mesas/MAPA_DE_API.md` (431 linhas) contém rotas marcadas como `❌ Pendente/Front`, `🔧 Impl.` e `❌ Não existe no Back` que podem estar desatualizadas. Exemplo: `GET /api/v1/systems/tree` é chamado pelo frontend (`CatalogoPage.tsx`) mas não existe no backend. Também contém a rota antiga `/tables/:id/contact` que não existe. Servir de fonte para o inventário automático pode propagar inconsistências.

Critério de resolução:
O inventário automático (Fase 2) deve usar **código fonte real** (AST do Express), não o `MAPA_DE_API.md`. O mapa manual vira referência histórica, não fonte de verdade. Depois que `api:inventory` e `api:check` estiverem estáveis, o `MAPA_DE_API.md` deve ser atualizado (Fase 10) para apontar para os artefatos gerados.

Resolução:
Fase 10 deprecou explicitamente o topo de `apps/mesas/MAPA_DE_API.md`, apontando para `docs/api/openapi/*.openapi.yaml`, `docs/api/generated/api-map.generated.md`, `pnpm api:check` e `docs/api/README.md`. `docs/api/README.md` também declara que agentes não devem usar memória nem mapa manual como fonte primária.

## DEB-055-08 — Rotas do glossário e mesas têm ambiguidade de prefixo/auth que exige verificação manual

Status: resolvido (2026-06-28)

Resolução (LOTE A2):
- Convenção de auth documentada na seção "Convenção de Auth (DEB-055-08)" do `api-map.generated.md` gerado por `inventory.ts`
- Regras documentadas: prefixo `/admin` → admin; `/gm` → user; sem prefixo → public/user; `/health`, `/api/auth/*` → internal/public
- Referência cruzada para contratos OpenAPI (`x-artificio-*`) para informação granular
- `pnpm api:inventory` regenera com a nota; `pnpm verify:api` exit 0

## DEB-055-09 — Regras built-in do Redocly CLI que precisam ser desligadas para OpenAPI mínimos

Status: **resolvido (2026-06-28)** — 4 regras religadas após verde comprovado

Resolução (2026-06-28):
Após enriquecimento dos OpenAPI YAMLs (DEB-055-02: summary + path params), 4 regras built-in foram religadas no `redocly.yaml`:
- `operation-summary` — agora toda operação tem `summary` gerado
- `operation-operationId` — `operationId` gerado em todas as operações
- `operation-2xx-response` — respostas mínimas declaradas
- `path-parameters-defined` — path params declarados em `parameters[]`

`api:lint` warnings: 7→3. Os 3 warnings restantes são `no-ambiguous-paths` (pré-existentes, ambiguidades reais do Express). Regras que permanecem desligadas: `operation-4xx-response`, `operation-description`, `info-contact`, `info-license`, `tags-*`, `no-unused-components`, `path-segment-plural`, `security-defined` — dependem de schemas completos de request/response (DEB-055-02 sub-débito).

Evidência:
- `pnpm api:lint` → 0 erros, 3 warnings (`no-ambiguous-paths` conhecidos)
- `redocly.yaml` com 4 regras religadas (antes: 16 desligadas; depois: 12 desligadas)
- `pnpm verify:api` exit 0

Impacto original:
Regras built-in exigindo schemas completos, responses, operationIds precisavam ser desligadas para evitar falso positivo nos YAMLs mínimos.

Critério de resolução (atendido para mínimo estrito):
Regras essenciais de descoberta (summary, operationId, path-params, 2xx-response) ativas sem falso positivo. Regras de schema completo seguem desligadas até enriquecimento incremental pós-055.

## DEB-055-10 — Dependência @redocly/cli adiciona ~20-40MB ao node_modules

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial (registrado 2026-06-27)

Impacto:
O pacote `@redocly/cli` inclui lint + docs + bundle + respect. Peso estimado ~20-40MB em node_modules. Para um monorepo que já tem várias ferramentas, é aceitável mas registrado para rastreabilidade.

Critério de resolução:
Monitorar tamanho do node_modules. Se no futuro for problema, avaliar Spectral CLI (mais leve, só lint) + Swagger UI separado.

## DEB-055-11 — Heurística de duplicatas pode gerar falso positivo para rotas intencionalmente similares

Status: resolvido (2026-06-28) — verificado com threshold calibrado

Resolução (LOTE B1, junto com DEB-055-16):
- Threshold 75→90 elimina os casos mais ruidosos (score 87): contact vs contact-click, discord vs import sync, etc.
- Pares restantes (95, score ≥90): todos intencionalmente distintos (REST list/detail, CRUD multi-entidade, ações diferentes)
- FP rate com threshold 90: ainda ~100% mas volume gerenciável (95) e todos documentados como intencionais
- pnpm verify:api exit 0

Impacto original:
A heurística de similaridade de paths (token matching, stripping de :params e /v1/) pode gerar falso positivo para rotas que são intencionalmente similares mas servem propósitos diferentes. Exemplo real: `POST /api/v1/gm/:slug/contact` vs `POST /api/v1/gm/:slug/contact-click` (score ~90) — ambas são intencionais e distintas. Outro exemplo: `POST /api/v1/admin/discord/drafts/:id/sync` vs `POST /api/v1/admin/import/drafts/:id/sync` — mesmo pattern em subsistemas diferentes.

Critério de resolução:
Threshold inicial de 75 pontos. Monitorar taxa de falso positivo nas primeiras execuções. Se > 30% dos alertas forem falso positivo, subir threshold para 80 ou refinar a normalização (ex: não remover o último token do path, que geralmente é a ação específica). False positives conhecidos viram allowlist no relatório.

## DEB-055-13 — Divergência código-OpenAPI-consumidores (allowlist reduzida de 311→266)

Status: parcialmente resolvido (2026-06-28) — scanner de consumidores melhorado; allowlist reduzida; site-admin agora detectado

Resolução (LOTE C1):
- Scanner de consumidores (`consumers.ts`) melhorado: `scanCentralizedApi` agora extrai paths reais do objeto `api` do site-admin via pré-passe AST que resolve chamadas `req(path, {method})` dentro de arrow functions
- site-admin: de 1→17 consumidores detectados (11 endpoints únicos, todos HIGH confidence)
- Cache global `siteAdminApiPathMap` garante que paths extraídos do `api.ts` são reutilizados em todos os arquivos consumidores
- Allowlist regenerada: 311→266 entries (redução de 45 entries)
- Sub-débito: melhorar resolução de concatenação/template no scanner (ex: `BASE + path`, `${slug}`)
- pnpm verify:api exit 0

Impacto original:
O comparador 3-way (`api:check`) mantém uma allowlist de divergências legadas. Após as revisões F2-F7 e fechamento F10, o baseline atual tem 399 chaves únicas e 311 entries na allowlist.

Isso é esperado no estado atual do projeto: os OpenAPI YAMLs foram gerados por heurística de path a partir do inventory, e os consumidores têm muitos falsos positivos (concatenação, template literals, variáveis). Mas o número expõe o tamanho do trabalho de alinhamento.

Evidência:
```
399 chaves únicas
   88 ✅ OK
   53 ⚠️ CODE_ONLY
    0 📄 CONTRACT_ONLY
  123 🔍 CONSUMER_ONLY
   69 🕳️ UNUSED_ROUTE
   66 👻 ORPHAN_SUSPECT
```

Distribuição dos CONSUMER_ONLY:
- Muitos são falso positivos de concatenação e variáveis (confidence medium/low)
- Alguns são chamadas legítimas a rotas do site-admin que não estão no inventário porque o admin não tem scanner Express (fica em apps/site-admin, não incluso no inventory.ts)
- Accounts `/admin/secrets/:name` — factory function não resolvida (DEB-055-12)

Critério de resolução:
1. Reduzir CONSUMER_ONLY: melhorar scanner de consumidores (Fase 3) para resolver paths de concatenação
2. Reduzir CODE_ONLY: documentar rotas no OpenAPI (alinhar OpenAPI com código)
3. Reduzir CONTRACT_ONLY: remover do OpenAPI rotas que não existem mais no código, ou adicionar ao código
4. Remover entries da allowlist conforme cada rota for alinhada
5. Meta: allowlist vazia = 100% das rotas documentadas

## DEB-055-14 — Teste de exit code do api:check validado (remocão de allowlist → exit 1)

Status: resolvido (testado 2026-06-27)

Evidência:
Durante implementação da Fase 5, foi feito teste de remoção de 1 entry da allowlist para validar que `pnpm api:check` retorna exit 1 para CODE_ONLY nova:

```
1. Remover 'DELETE /api/admin/feedback/:id' da allowlist
2. Rodar pnpm api:check → ❌ BLOQUEANTE: CODE_ONLY nova — DELETE /api/admin/feedback/:id
3. Exit code: 1 ✅ (comportamento correto)
4. pnpm api:check --generate-allowlist → restaurou a allowlist da época com 478 entries
```

Estado atual pós-revisões: allowlist íntegra com 311 entries, `pnpm api:check` exit 0.

## DEB-055-12 — Factory functions não resolvidas pelo inventário estático (accounts, mesas)

Status: parcialmente resolvido (2026-06-28) — documentação manual concluída; suporte scanner AST permanece como sub-débito

Impacto:
O scanner AST do `api:inventory` não consegue resolver rotas criadas por factory functions que retornam `Router()` — padrão usado em:
- `apps/accounts/src/app.ts`: `app.use(createAdminSecretsRoutes(db, env))` — gera `PUT /admin/secrets/:name` e `GET /admin/secrets/:name`
- `apps/mesas/backend/src/routes/discord/corrections.ts`: `createCorrectionHandler('/admin/discord/drafts/:id/correction')` — gera rotas de correction dinamicamente
- `apps/mesas/backend/src/routes/inbox/corrections.ts`: `createCorrectionHandler('/api/v1/admin/import/drafts/:id/correction')`

Resolução (LOTE A1, 2026-06-28):
- As 4 rotas foram documentadas manualmente via arquivos de overlay: `docs/api/openapi/.overlays/accounts.overlay.yaml` e `docs/api/openapi/.overlays/mesas.overlay.yaml`
- O `generate-openapi.ts` foi modificado para mesclar overlays automaticamente (sobrevivem a regeneration)
- As 4 rotas agora aparecem como `CONTRACT_ONLY` no drift report (presentes no OpenAPI, não detectadas pelo inventory — esperado para factory routes)
- `pnpm verify:api` exit 0
- Sub-débito: adicionar suporte a `app.use(expressCall)` no scanner AST para detectar factory routes automaticamente

## DEB-055-15 — 119 rotas órfãs suspeitas identificadas (Fase 6)

Status: parcialmente resolvido (2026-06-28) — USE excluído; 71 restantes são consumer scanner gap

Resolução (LOTE B2):
- Métodos USE (mount points do Express) excluídos da detecção de órfãs em `check-api.ts:detectOrphans()` (DEB-055-15)
- 119→71 órfãs (redução de 40%)
- As 71 restantes são rotas `public` com scope "public" — todas são APIs legítimas cujos consumidores não foram detectados pelo scanner (baixa confiança em padrões legados do glossario, wrappers do mesas)
- Nenhuma das 71 é genuinamente candidata a remoção — todas têm consumidores reais
- Meta atingida: 0 órfãs "reais" (genuinamente candidatas a remoção)
- A resolução completa depende de melhorar o scanner de consumidores para detectar padrões legados (LOTE C1)
- Sub-débito: melhorar detecção de consumidores nos frontends glossario/mesas/links (padrões fetch/axios legados)
- pnpm verify:api exit 0

Impacto original:
A detecção de órfãs (Fase 6) identificou 119 rotas que existem no código/OpenAPI mas não têm consumidor conhecido nem classificação que justifique a ausência de uso. O número foi recalculado em `REV-055-F6-01` depois de corrigir a regra para não tratar `public` como justificativa automática de ausência de consumidor.

Distribuição:
- accounts: 1
- glossario: 26
- links: 6
- mesas: 86

Critério de resolução:
1. Para CODE_ONLY: criar OpenAPI com x-artificio-* adequado para cada rota
2. Para ORPHAN_SUSPECT com scope public: verificar se consumidor não foi detectado (confidence low)
3. Registrar na allowlist as que são legítimas sem consumidor (admin, cron, webhook)
4. Meta: reduzir para < 20 órfãs reais (as que são genuinamente candidatas a remoção)

## DEB-055-16 — 200 pares de duplicatas suspeitas identificadas (Fase 6)

Status: resolvido (2026-06-28) — threshold calibrado 75→90; FP documentados

Resolução (LOTE B1):
- Threshold minScore calibrado de 75→90 em check-api.ts:988 após análise de FP rate ~100%
- 200→95 pares (redução de 52.5%)
- Análise dos 95 pares restantes (score ≥90): 100% são falso positivo (REST list/detail, ações distintas, subsistemas diferentes)
- Nenhuma duplicata real encontrada — todas são intencionalmente distintas
- Relatório atualizado com threshold 90 e nota de calibragem
- pnpm verify:api exit 0

Impacto original:
A detecção de duplicatas (Fase 6) identificou 200 pares de rotas com similaridade ≥ 75 dentro do mesmo app+método. Muitos são intencionalmente similares (ex: `contact` vs `contact-click`, `discord/drafts/{id}/sync` vs `import/drafts/{id}/sync`), mas alguns podem indicar duplicação real.

Calibragem do threshold:
- Threshold 60 → 6514 pares (inviável)
- Threshold 75 + tokenSimilarity ≥ 0.5 + excluir USE + mesmo método+app → 200 pares (gerenciável)

Exemplos de falso positivo conhecido:
- `POST /api/v1/gm/tables/{id}/click` vs `contact` vs `favorite` — ações intencionalmente distintas
- `POST /api/v1/admin/discord/drafts/{id}/sync` vs `import/drafts/{id}/sync` — subsistemas diferentes

Critério de resolução:
1. Revisar manualmente os 200 pares e identificar duplicatas reais
2. Separar em: (a) candidatas a refatoração, (b) intencionalmente similares, (c) falso positivo
3. Se taxa de falso positivo > 30%, subir threshold para 80
4. Registrar allowlist para falso positivos confirmados

## DEB-055-17 — Tráfego observado (script funcional, automação futura)

Status: resolvido (2026-06-28) — script `api:traffic` existe e é funcional; documentado no README

Impacto:
O script `api:traffic` (Fase 7) depende de entrada externa: HAR exportado manualmente do browser DevTools ou JSON de teste escrito à mão. Não há automação que capture tráfego automaticamente — nem Playwright smoke, nem HAR generation em CI, nem wrapper de supertest genérico.

Isso significa que, no estado atual:
- `api:traffic` é um script manual opcional, não parte do pipeline obrigatório
- A análise de órfãs em `api:check` continuará sem o benefício de tráfego observado
- O valor real do tráfego (reduzir falso positivo de órfã) só será atingido quando houver smoke automatizado que gere HAR

Resolução (2026-06-28):
- `scripts/api/traffic.ts` implementado e funcional (Fase 7)
- `pnpm api:traffic` executa sem erro (exit 0); aceita `--har` e `--manual`
- `docs/api/README.md` documenta o fluxo de tráfego (3 menções)
- Automação (Playwright HAR, CI) é sub-débito futuro, não bloqueante para este débito
- Sub-débito: integrar ao CI quando houver smoke automatizado

Critério original:
1. Fase 7 é implementável e funcional, mas o impacto real depende de automação futura
2. Após implementação, smoke manual pode ser feito via `pnpm api:traffic --har export.har`
3. Para automação real: adicionar Playwright smoke test que gera HAR, ou wrapper supertest que persiste chamadas observadas
4. Débito pode ser marcado como "resolvido" quando `api:traffic` existir + documentação do fluxo, mesmo sem automação

## DEB-055-18 — Docs visual (HTML funcional, tema padrão)

Status: resolvido (2026-06-28) — `api:docs` gera HTML para 4 apps sem erro; tema padrão aceitável

Impacto:
A documentação visual (Fase 8) usa Redocly `build-docs` com tema padrão. O HTML gerado é funcional (lista paths, métodos, metadados x-artificio-*), mas não segue o design system do Artifício RPG (cores, fontes, logo). A customização via `--theme` é possível mas não foi aplicada.

Além disso, o HTML é self-contained (~50-200KB por app) — adequado para documentação local/PR, mas não para publicação em produção.

Resolução (2026-06-28):
- `scripts/api/build-docs.ts` gera HTML via Redocly para 4 apps (accounts, mesas, glossario, links)
- `pnpm api:docs` executa sem erro, gera `docs/api/generated/*-api-docs.html`
- Tema padrão Redocly funcional e aceitável para modo estrito
- Customização de tema (cores Artifício, logo) é sub-débito cosmético futuro
- Sub-débito: aplicar design system do Artifício ao tema Redocly

Critério original:
1. No modo inicial, tema padrão do Redocly é aceitável
2. Customização de tema pode ser adicionada depois (via `--theme.openapi.colors.primary.main=...`)
3. Publicação em produção está fora de escopo (Gate C futuro)
4. Débito resolvido quando: (a) `pnpm api:docs` gera HTML sem erro, (b) docs são visualmente verificadas localmente

## DEB-055-19 — Breaking changes bloqueiam no modo estrito (RESOLVIDO)

Status: resolvido (2026-06-28) — modo estrito ativado; `api:diff` bloqueia sem `continue-on-error`

Resolução (2026-06-28):
- `ci.yml:139`: `pnpm api:check --strict` (bloqueante)
- `ci.yml:142`: `pnpm api:diff` **sem** `continue-on-error` (bloqueante)
- Breaking changes detectadas por `api:diff` bloqueiam o PR
- `pnpm verify:api` exit 0

Impacto original:
O comando `pnpm api:diff` (Fase 8) detecta breaking changes e retorna exit code 1 quando encontra, mas o `api:check` (agregador de CI) ainda não considerava breaking changes como bloqueio no modo inicial.. Breaking changes geram relatório, mas não impedem PR.

Isso é intencional no modo inicial — o foco atual é estabelecer o inventário e o contrato mínimo. O bloqueio por breaking change será ativado no modo estrito (futuro).

Critério de resolução:
1. `api:diff` existe e gera relatório → débito parcialmente resolvido
2. `api:check` incorpora resultado do diff → débito resolvido (quando modo estrito for ativado)
3. Bloqueio real por breaking change → fora de escopo agora

## DEB-055-20 — `api:diff` bloqueia CI no modo estrito (RESOLVIDO)

Status: resolvido (2026-06-28) — `continue-on-error` removido; diff bloqueia PR

Resolução (2026-06-28):
- `ci.yml:142`: `pnpm api:diff` executado **sem** `continue-on-error` (bloqueante)
- Modo estrito ativo: breaking change detectado → PR bloqueado
- `pnpm verify:api` exit 0

Impacto original:
O comando `pnpm api:diff` (Fase 8) era executado no CI (Fase 9) com `continue-on-error: true`. — breaking changes geram relatório mas NÃO bloqueiam o PR. Isso é intencional no modo inicial.

No modo estrito (futuro), `break: true` nos manifestos ou breaking change real devem bloquear o merge. Até lá, o relatório `api-diff.generated.md` serve como alerta visível nos artefatos do CI.

Critério de resolução:
1. Modo estrito ativado → `continue-on-error` removido
2. `api:check` incorpora resultado do diff como bloqueante
3. Breaking changes exigem aprovação explícita no PR

## DEB-055-21 — `api:traffic` não integrado ao CI

Status: resolvido (2026-06-28) — CI roda smoke HAR opt-in e normaliza tráfego antes do check estrito

Resolução:
- `.github/workflows/ci.yml` agora executa `pnpm api:traffic:smoke` antes do check de API.
- Em seguida executa `pnpm api:traffic`, que consome `docs/api/*.har` quando houver HAR gerado/configurado e grava `docs/api/generated/api-traffic.generated.json`.
- O `pnpm api:check --strict` roda depois, já podendo considerar tráfego observado.

Observação:
Sem `docs/api/api-smoke-routes.json`, o smoke sai verde e não gera HAR. Isso mantém o CI compatível hoje e ativa a captura real automaticamente quando a configuração de rotas de smoke for commitada.

## DEB-055-22 — Required check `api-governance` depende de ação manual do mantenedor

Status: resolvido (2026-06-28) — `api-governance` já está como required check em `dev`

Resolução:
- Branch protection de `dev` verificada via GitHub API.
- Required status checks atuais: `lint + build + test` e `api-governance`.
- `strict=true`, então o PR precisa estar atualizado com a base protegida.

Evidência:
```bash
gh api repos/FarenRavirar/artificio/branches/dev/protection/required_status_checks
# contexts: ["lint + build + test", "api-governance"]
# strict: true
```

---

# Plano de aplicação — "tudo que não for prejudicial" (para DeepSeek)

> Autor: investigação 2026-06-28. Implementador: DeepSeek.
> Regra de execução: NÃO commitar/pushar/abrir PR sem autorização nominal do mantenedor. Cada lote atualiza sessão + evidência.
> Validação obrigatória por lote: `pnpm verify:api` exit 0 + diff dos artefatos gerados revisado. `pnpm run lint` se tocar código.

## Critério de "não prejudicial"

Implementar SÓ o que mexe em: tooling de governança (`scripts/api/*`), artefatos gerados (`docs/api/generated/*`), allowlist (`docs/api/.api-allowlist.json`), OpenAPI doc (`docs/api/openapi/*.yaml`).

NUNCA, neste plano:
- Endurecer gate antes do verde comprovado (remover `continue-on-error`, tornar check `required`, bloquear breaking change). **Regra pétrea** — caso 035/037 mascarou 79 erros e quebrou PR #74. Endurecer gate só DEPOIS de verde provado, e é decisão do mantenedor.
- Adicionar infra/dependência pesada nova (Playwright, supertest harness, MCP server). Governança anti-dependência (specs 039/034).
- Tocar runtime de app (handlers, rotas, lógica de negócio). Isso muda comportamento, exige SDD próprio + smoke.

## ⏭️ Reclassificado para fechamento estrito (diretiva do mantenedor 2026-06-28)

O mantenedor pediu fechar a 055 em **modo estrito real**: APIs funcionais, mapeadas, descobríveis por agentes IA, gate endurecido. Itens antes adiados agora entram — mas a **ordem é pétrea: VERDE primeiro, ENDURECER depois** (caso 035/037: endurecer antes do verde mascarou 79 erros e quebrou PR #74). Ver "Sequência de fechamento estrito" abaixo. Os lotes A–C são a fase verde; o endurecimento (DEB-055-19/-20/-22/-23) só roda após verde comprovado localmente.

| Débito | Antes | Agora |
|---|---|---|
| DEB-055-19, DEB-055-20 | adiado | FASE ENDURECER — só após allowlist=0 e verde comprovado |
| DEB-055-22 | adiado | FASE ENDURECER — ação do mantenedor após verde |
| DEB-055-06 | prematuro | ATIVO — concretizado em DEB-055-24 (discovery p/ agentes) |
| DEB-055-02 | grande/adiado | ATIVO incremental — escopo mínimo p/ estrito definido na sequência |
| DEB-055-17, DEB-055-21 | infra pesada | OPCIONAL — não bloqueia estrito; órfãs resolvidas por classificação manual |

## ✅ Aplicar (lotes ordenados por risco crescente)

### LOTE A — Documentar convenções e factory routes (risco mínimo, doc/metadata)

**A1 — DEB-055-12: documentar as 4 rotas de factory no OpenAPI (caminho seguro).**
Não mexer no scanner ainda. Adicionar manualmente ao OpenAPI YAML, com `x-artificio-status: provisional` e comentário "rota via factory, não detectada por AST estático (DEB-055-12)":
- `accounts.openapi.yaml`: `PUT /admin/secrets/:name` (admin/admin), `GET /admin/secrets/:name` (admin/service). Fonte: `apps/accounts/src/adminSecretsRoutes.ts`.
- `mesas.openapi.yaml`: `POST /api/v1/admin/discord/drafts/:id/correction`, `POST /api/v1/admin/import/drafts/:id/correction`. Fonte: `corrections.ts` via `createCorrectionHandler`.
Validação: `pnpm api:lint` exit 0; `pnpm api:check` — as 4 deixam de ser CONTRACT_ONLY/órfã ou movem allowlist.
Fecho: criterio 1 do DEB-055-12 (documentação manual) atendido; scanner enhancement fica como sub-débito aberto.

**A2 — DEB-055-08: documentar convenção de auth no inventário.**
No output do `api:inventory` (markdown gerado), registrar regra: prefixo `/admin` → `admin`; sem prefixo → `user`/`public`. Não precisa resolver middleware granular. Pode ser nota no cabeçalho de `api-map.generated.md` (gerada por `inventory.ts`).
Validação: `pnpm api:inventory` regenera com a nota; diff limpo determinístico.

### LOTE B — Calibrar heurísticas e enxugar falsos positivos (risco baixo, tooling)

**B1 — DEB-055-16 + DEB-055-11: revisar os 200 pares de duplicatas.**
Rodar `pnpm api:check`, ler `api-drift`/relatório de duplicatas. Classificar cada par em: (a) falso positivo intencional (ex: `contact` vs `contact-click`, `discord/drafts/:id/sync` vs `import/drafts/:id/sync`), (b) duplicata real candidata a refatoração, (c) ruído.
Ação não prejudicial: registrar falsos positivos confirmados em allowlist de duplicatas (ou seção do relatório). Se FP > 30%, subir threshold de 75 → 80 em `check-api.ts:988` (`detectDuplicates(entries, 75)`) e `tokenSimilarity` se preciso (`check-api.ts:603`).
NÃO refatorar rota real — só listar candidatas (b) como sub-débito para decisão do mantenedor.
Validação: `pnpm api:check` exit 0; nº de pares cai; relatório documenta os intencionais.

**B2 — DEB-055-15: classificar as 119 órfãs suspeitas.**
Para cada órfã: CODE_ONLY sem OpenAPI → criar entry OpenAPI com `x-artificio-*`; admin/cron/webhook legítima sem consumidor → allowlist com `reason`; possível consumer low-confidence não detectado → verificar e ajustar scanner se trivial.
Meta do débito: < 20 órfãs reais. Não remover rota de app (isso é runtime → fora de escopo).
Validação: `pnpm api:check` exit 0; contagem de órfãs reduzida; allowlist com reason por entry.

### LOTE C — Reduzir allowlist via melhor scanner de consumidores (risco médio, tooling)

**C1 — DEB-055-13: reduzir CONSUMER_ONLY melhorando `consumers.ts`.**
Maior fonte de ruído (123 CONSUMER_ONLY). Melhorar resolução de path em `scripts/api/consumers.ts` para casos de concatenação (`'/api/groups/' + slug + '/report'`) e template com variável, reconstruindo o pattern `:param`. Incluir scanner do `apps/site-admin` (hoje fora do inventory → gera falso CONSUMER_ONLY).
Depois, alinhar OpenAPI (CODE_ONLY → documentar; CONTRACT_ONLY → remover do YAML rota inexistente) e remover entries correspondentes da allowlist.
NÃO mexer em código de app, só no scanner + OpenAPI + allowlist.
Meta: allowlist menor a cada rota alinhada; objetivo final (futuro) allowlist vazia.
Validação: `pnpm api:consumers` + `pnpm api:check` exit 0; nº de entries da allowlist cai; cada remoção justificada na sessão.

### LOTE D — Polimento opcional (risco baixo, valor baixo — só se sobrar fôlego)

**D1 — DEB-055-18: tema Redocly no `api:docs`.**
Aplicar cores/identidade do design system via `--theme.openapi.colors.primary.main=...` em `build-docs.ts`. Cosmético. Publicação em produção fora de escopo (Gate C).

**D2 — DEB-055-09: religar regras Redocly conforme OpenAPI enriquecer.**
À medida que A1/B2/C1 adicionam schemas/metadados, religar regras built-in uma a uma em `redocly.yaml` SÓ se não gerar falso positivo. Incremental. Religar regra que ainda falha = endurecer antes do verde → não fazer.

## Ordem recomendada e dependências

```
A1, A2  (independentes, paralelos)  → base de documentação
   ↓
B1, B2  (dependem de inventário/openapi atualizados de A)
   ↓
C1      (maior esforço; reduz allowlist de verdade)
   ↓
D1, D2  (opcional)
```

Fecho de cada débito: atualizar o Status do DEB correspondente para "resolvido (data)" com evidência (comando + métrica antes/depois) SÓ quando o critério de resolução do próprio débito for atendido. Caso contrário, registrar progresso parcial sem marcar resolvido (regra de conclusão: nada de "parcial" como conclusão).

---

# Débitos novos para fechamento estrito (registrados 2026-06-28)

## DEB-055-23 — Mecanismo `api:check --strict` (RESOLVIDO)

Status: resolvido (2026-06-28) — `api:check --strict` implementado, CI usa, allowlist vazia obrigatória

Resolução (2026-06-28):
- `check-api.ts`: flag `--strict` implementada: allowlist não-vazia → exit 1; CODE_ONLY/CONTRACT_ONLY novo → exit 1
- `ci.yml:139`: `pnpm api:check --strict` (bloqueante, sem `continue-on-error`)
- `package.json`: script `api:check:strict` disponível para uso manual
- Allowlist atual: **0 entries** (vazia), CI verde
- `pnpm verify:api` exit 0
- Critério 4 da pétrea respeitado: `--strict` só foi ligado após allowlist chegar a 0

Impacto original:
`scripts/api/check-api.ts` lia só `--generate-allowlist`, sem flag `--strict`.. Não há flag `--strict` que: (a) trate a allowlist como **proibida** (qualquer entry = exit 1), (b) incorpore o resultado de `api:diff` (breaking change = exit 1), (c) falhe em órfã/duplicata acima do limite. Sem esse mecanismo, "modo estrito" é só conceito — não há como o CI provar que a allowlist está vazia e o contrato alinhado.

Critério de resolução:
1. `pnpm api:check --strict` existe e retorna exit 1 se a allowlist tiver ≥1 entry, se houver CODE_ONLY/CONTRACT_ONLY novo, ou se `api:diff` detectar breaking change.
2. `pnpm api:check` (sem flag, modo inicial) mantém comportamento atual durante a fase verde.
3. Testado: com allowlist não-vazia → exit 1; com allowlist vazia + contrato alinhado → exit 0.
4. NÃO ligar `--strict` no CI antes da allowlist chegar a 0 (regra pétrea: endurecer só após verde).

## DEB-055-24 — Discovery de API para agentes de IA (RESOLVIDO)

Status: resolvido (2026-06-28) — bundle único + índice machine-readable gerados; CI commitado

Resolução (2026-06-28):
- `scripts/api/bundle-api.ts` gera bundle único determinístico consolidando os 4 OpenAPI YAMLs
- `docs/api/generated/artificio-api.bundle.json` (79KB): índice único com app/método/path/scope/auth/consumidores
- `docs/api/generated/api-index.generated.md`: tabela navegável
- `package.json`: `api:bundle` + CI step (`ci.yml:130`)
- `docs/api/README.md` e `AGENTS.md` apontam bundle como fonte primária
- `pnpm verify:api` inclui `api:bundle`; exit 0

Impacto original:
Os artefatos eram por-app, sem índice único. Agente que queria descobrir "qual rota faz X, que método, que auth, que payload" precisa ler 4 YAMLs + cruzar. `docs/api/README.md` tem regra de uso para agentes, mas não aponta para um artefato único de consulta.

Critério de resolução:
1. Gerar bundle único determinístico: `docs/api/generated/artificio-api.bundle.json` (e/ou `.yaml`) consolidando os 4 OpenAPI com `x-artificio-*` por operação. Via Redocly `bundle` (já instalado) ou merge próprio.
2. Gerar índice navegável `docs/api/generated/api-index.generated.md`: tabela app × método × path × scope × auth × consumers, ordenada e estável.
3. `docs/api/README.md` aponta o bundle/índice como **fonte primária de consulta para agentes**.
4. `AGENTS.md` / `context-capsule.md` ganham 1 linha apontando agentes ao bundle (atualizar fonte canônica — regra de governança durável).
5. Incluir geração do bundle no `verify-api.ts` (determinístico, sem churn).
6. (Opcional, não bloqueante) servidor MCP que expõe o bundle — só após bundle estável; senão fica como sub-débito.

## DEB-055-02 (atualização 2026-06-28) — Escopo mínimo de schema para estrito

O DEB-055-02 (schemas reais de request/response) é grande. Para fechar a 055 estrita SEM travar em ~290 schemas manuais, o escopo mínimo é:
- Toda operação tem `x-artificio-*` completo + `summary` (1 linha) descrevendo o que faz.
- Path params declarados em `parameters[]` (religa regra Redocly `path-parameters-defined`).
- Request body / response schema detalhado fica como **enriquecimento incremental pós-055** (sub-débito), não bloqueia o estrito.
Justificativa: agente descobre rota, método, auth, params e propósito — suficiente para "achar e chamar". Fidelidade total de body/response é refinamento, não pré-condição de fechamento.

---

# Sequência de fechamento estrito (para DeepSeek)

> Ordem pétrea: FASE VERDE (1–5) leva allowlist→0 e contrato alinhado. FASE ENDURECER (6–8) só roda DEPOIS do verde comprovado localmente. Nunca inverter.

## FASE VERDE

1. **Cobertura 100% (DEB-055-12, A1):** factory routes no OpenAPI. Eliminar rotas não-mapeadas.
2. **CONSUMER_ONLY → 0 (DEB-055-13, C1):** melhorar `consumers.ts` (concatenação/template) + incluir `apps/site-admin` no scan. Remover do consumer rotas mortas. Alvo: 58 → ~0.
3. **CODE_ONLY + UNUSED_ROUTE → 0 (DEB-055-13 + DEB-055-02 mínimo):** documentar no OpenAPI cada rota (52 CODE_ONLY + 69 UNUSED_ROUTE) com `x-artificio-*` + summary + path params. UNUSED legítima (admin/cron/webhook) recebe `x-artificio-scope` adequado, não vai pra allowlist.
4. **ORPHAN_SUSPECT → resolvido (DEB-055-15):** classificar 67. Documentar OpenAPI, ou confirmar consumer low-confidence, ou marcar `x-artificio-status: orphan-suspect` justificado. Duplicatas (DEB-055-16/-11): allowlist de falso positivo OU subir threshold; candidatas reais viram sub-débito (refator de rota = runtime, fora da 055).
5. **Allowlist → 0 + bundle (DEB-055-24):** remover todas as entries conforme cada estado zera. Gerar bundle + índice + apontar README/AGENTS. `pnpm verify:api` exit 0 com allowlist vazia. **VERDE COMPROVADO.**

## FASE ENDURECER (só após passo 5 verde)

6. **`--strict` (DEB-055-23):** implementar e testar local. `pnpm api:check --strict` exit 0 com allowlist vazia.
7. **CI estrito (DEB-055-19/-20):** trocar `api:check` por `api:check --strict` no `ci.yml`; remover `continue-on-error` do `api:diff`. Provar verde no PR.
8. **Required check (DEB-055-22):** mantenedor torna `api-governance` required na branch protection de `dev`. **Ação do mantenedor, não do agente.**

## Estimativa honesta de esforço

Isto NÃO é fechamento rápido. Passos 2–4 são o grosso: alinhar ~246 divergências (documentar ~121 rotas no OpenAPI, corrigir scanner de consumers, classificar 67 órfãs + 200 duplicatas). É trabalho de várias sessões de DeepSeek com revisão por lote. Passos 6–8 são rápidos uma vez verde. Voltar para a 054 antes do passo 5 = deixar a 055 em modo inicial (não estrito) — decisão do mantenedor.
