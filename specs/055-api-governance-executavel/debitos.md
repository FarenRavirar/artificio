# 055 — Débitos previstos

## DEB-055-01 — Cobertura incompleta do inventário Express

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial

Impacto:
Rotas montadas dinamicamente, subrouters complexos ou wrappers não triviais podem cair como `confidence: low` ou `UNCERTAIN`.

Critério de resolução:
Inventário cobre rotas de `accounts`, `mesas`, `glossario` e `links` com cobertura aceitável, e lacunas específicas têm fallback documentado.

## DEB-055-02 — OpenAPI inicial incompleto em payload/resposta

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial

Impacto:
OpenAPI inicial pode listar path/method/auth sem representar todos os schemas de request/response.

Critério de resolução:
Schemas reais passam a vir de Zod/DTO/contrato tipado ou são preenchidos com evidência de código/teste, nunca por inferência livre.

## DEB-055-03 — Detecção de consumidores com baixa confiança

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial

Impacto:
Chamadas construídas por template, wrappers indiretos ou clients compartilhados podem gerar falso negativo/positivo.

Critério de resolução:
Wrappers principais são reconhecidos por configuração/testes, e baixa confiança não bloqueia sem evidência.

## DEB-055-04 — Heurística de duplicidade é aproximada

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial

Impacto:
`DUPLICATE_SUSPECT` pode gerar falso positivo ou perder duplicação semântica.

Critério de resolução:
Heurística calibrada com casos reais do repo; modo estrito só ativado quando falso positivo estiver baixo ou exigir justificativa humana.

## DEB-055-05 — Tráfego observado é parcial

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial

Impacto:
Rotas não exercitadas por testes/smoke/HAR não aparecem como observadas.

Critério de resolução:
Roteiro de smoke/teste cobre fluxos críticos por app; relatório deixa claro que ausência de tráfego não prova rota morta.

## DEB-055-06 — MCP/OpenAPI para agentes depende de contrato estabilizado

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial

Impacto:
Expor MCP cedo demais pode dar falsa confiança se OpenAPI ainda estiver incompleto.

Critério de resolução:
MCP só entra após `api:lint` + `api:check` estáveis e documentação operacional validada.

## DEB-055-07 — MAPA_DE_API.md do mesas tem divergências com o código real

Status: resolvido (2026-06-28)

Impacto:
O `apps/mesas/MAPA_DE_API.md` (431 linhas) contém rotas marcadas como `❌ Pendente/Front`, `🔧 Impl.` e `❌ Não existe no Back` que podem estar desatualizadas. Exemplo: `GET /api/v1/systems/tree` é chamado pelo frontend (`CatalogoPage.tsx`) mas não existe no backend. Também contém a rota antiga `/tables/:id/contact` que não existe. Servir de fonte para o inventário automático pode propagar inconsistências.

Critério de resolução:
O inventário automático (Fase 2) deve usar **código fonte real** (AST do Express), não o `MAPA_DE_API.md`. O mapa manual vira referência histórica, não fonte de verdade. Depois que `api:inventory` e `api:check` estiverem estáveis, o `MAPA_DE_API.md` deve ser atualizado (Fase 10) para apontar para os artefatos gerados.

Resolução:
Fase 10 deprecou explicitamente o topo de `apps/mesas/MAPA_DE_API.md`, apontando para `docs/api/openapi/*.openapi.yaml`, `docs/api/generated/api-map.generated.md`, `pnpm api:check` e `docs/api/README.md`. `docs/api/README.md` também declara que agentes não devem usar memória nem mapa manual como fonte primária.

## DEB-055-08 — Rotas do glossário e mesas têm ambiguidade de prefixo/auth que exige verificação manual

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial (registrado 2026-06-27)

Impacto:
Muitos routers do glossário (15) e mesas (~27) montam handlers com middlewares de auth/rate-limit dentro do arquivo de rota, não no server.ts. O inventário AST inicial pode não conseguir resolver o middleware exato de cada rota, resultando em `x-artificio-auth` impreciso ou `confidence: low`.

Critério de resolução:
Documentar no inventário que rotas com prefixo `/admin` são `admin` por convenção, rotas sem prefixo são `user`/`public`. A verificação granular de auth deve ser refinada em iterações futuras.

## DEB-055-09 — Regras built-in do Redocly CLI que precisam ser desligadas para OpenAPI mínimos

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial (registrado 2026-06-27)

Impacto:
Os OpenAPI YAMLs da Fase 1 são mínimos (só paths + x-artificio-*). Regras built-in do ruleset `recommended` que exigem schemas completos, responses, operationIds etc. precisam ser desligadas para evitar falso positivo. Isso reduz temporariamente a validação estrutural total.

Regras desligadas:
- `operation-2xx-response` — não temos schemas completos de resposta
- `operation-4xx-response` — idem
- `operation-operationId` — operationId é opcional nos YAMLs mínimos
- `operation-summary` — summary é opcional
- `operation-description` — description é opcional
- `info-contact` — contato não é obrigatório
- `info-license` — licença não é obrigatória
- `no-server-example.com` — servers podem ter example.com (temporário)
- `tags-alphabetical`, `operation-tag-defined`, `operation-singular-tag` — tags são opcionais
- `operation-parameters-unique` — parâmetros não são definidos ainda
- `no-unused-components` — components não existem ainda
- `path-segment-plural` — /health, /me são singular
- `security-defined` — YAMLs mínimos sem security schemes definidos
- `path-parameters-defined` — path params não declarados em parameters[] nos YAMLs mínimos

Critério de resolução:
À medida que os OpenAPI forem enriquecidos (schemas reais, operationIds, tags, descrições), as regras podem ser religadas uma a uma. O débito é considerado resolvido quando todas as regras built-in relevantes estão ativas sem falso positivo nos YAMLs do monorepo.

## DEB-055-10 — Dependência @redocly/cli adiciona ~20-40MB ao node_modules

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial (registrado 2026-06-27)

Impacto:
O pacote `@redocly/cli` inclui lint + docs + bundle + respect. Peso estimado ~20-40MB em node_modules. Para um monorepo que já tem várias ferramentas, é aceitável mas registrado para rastreabilidade.

Critério de resolução:
Monitorar tamanho do node_modules. Se no futuro for problema, avaliar Spectral CLI (mais leve, só lint) + Swagger UI separado.

## DEB-055-11 — Heurística de duplicatas pode gerar falso positivo para rotas intencionalmente similares

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial (registrado 2026-06-27)

Impacto:
A heurística de similaridade de paths (token matching, stripping de :params e /v1/) pode gerar falso positivo para rotas que são intencionalmente similares mas servem propósitos diferentes. Exemplo real: `POST /api/v1/gm/:slug/contact` vs `POST /api/v1/gm/:slug/contact-click` (score ~90) — ambas são intencionais e distintas. Outro exemplo: `POST /api/v1/admin/discord/drafts/:id/sync` vs `POST /api/v1/admin/import/drafts/:id/sync` — mesmo pattern em subsistemas diferentes.

Critério de resolução:
Threshold inicial de 75 pontos. Monitorar taxa de falso positivo nas primeiras execuções. Se > 30% dos alertas forem falso positivo, subir threshold para 80 ou refinar a normalização (ex: não remover o último token do path, que geralmente é a ação específica). False positives conhecidos viram allowlist no relatório.

## DEB-055-13 — Divergência código-OpenAPI-consumidores: 311 entries na allowlist

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial (registrado 2026-06-27; recalculado 2026-06-28)

Impacto:
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

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial (registrado 2026-06-27)

Impacto:
O scanner AST do `api:inventory` não consegue resolver rotas criadas por factory functions que retornam `Router()` — padrão usado em:
- `apps/accounts/src/app.ts`: `app.use(createAdminSecretsRoutes(db, env))` — gera `PUT /admin/secrets/:name` e `GET /admin/secrets/:name`
- `apps/mesas/backend/src/routes/discord/corrections.ts`: `createCorrectionHandler('/admin/discord/drafts/:id/correction')` — gera rotas de correction dinamicamente

O marcador `app.use(factoryCall)` não tem path string nem segundo argumento identificável — o primeiro argumento é a própria factory call. O scanner não consegue extrair o path desse padrão por limitação de análise estática.

Evidência:
- accounts: 9 rotas encontradas vs 11 esperadas (faltam PUT /admin/secrets/:name e GET /admin/secrets/:name)
  - Fonte: `apps/accounts/src/app.ts:172` — `app.use(createAdminSecretsRoutes(db, env))`
  - Fonte: `apps/accounts/src/adminSecretsRoutes.ts` — router com PUT + GET /admin/secrets/:name
- mesas: 2 rotas de correction não detectadas:
  - `POST /api/v1/admin/discord/drafts/:id/correction`
    - Fonte: `apps/mesas/backend/src/routes/discord/corrections.ts` — `createCorrectionHandler('/admin/discord/drafts/:id/correction')`
  - `POST /api/v1/admin/import/drafts/:id/correction`
    - Fonte: `apps/mesas/backend/src/routes/inbox/corrections.ts` — `createCorrectionHandler('/admin/import/drafts/:id/correction')`

Critério de resolução:
Adicionar suporte a `app.use(expressCall)` onde o primeiro argumento é uma call expression que retorna Router. Extrair paths literais dos argumentos da factory quando detectável. Alternativa: permitir allowlist manual para essas rotas no `api-allowlist.json`. Rotas dessas factories devem ser documentadas manualmente no OpenAPI (Fase 1) até o scanner ser atualizado.

Decisão de fechamento:
`REV-055-F1-01` confirmou em revisão da Fase 1 que as quatro rotas seguem ausentes dos YAMLs OpenAPI gerados. A lacuna é aceita para fechamento da spec 055 em modo inicial, mas bloqueia modo estrito/cobertura 100% até haver suporte a factory/overlay explícito.

## DEB-055-15 — 119 rotas órfãs suspeitas identificadas (Fase 6)

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial (registrado 2026-06-27)

Impacto:
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

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial (registrado 2026-06-27)

Impacto:
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

## DEB-055-17 — Tráfego observado depende de entrada manual no estado atual

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial (registrado 2026-06-27)

Impacto:
O script `api:traffic` (Fase 7) depende de entrada externa: HAR exportado manualmente do browser DevTools ou JSON de teste escrito à mão. Não há automação que capture tráfego automaticamente — nem Playwright smoke, nem HAR generation em CI, nem wrapper de supertest genérico.

Isso significa que, no estado atual:
- `api:traffic` é um script manual opcional, não parte do pipeline obrigatório
- A análise de órfãs em `api:check` continuará sem o benefício de tráfego observado
- O valor real do tráfego (reduzir falso positivo de órfã) só será atingido quando houver smoke automatizado que gere HAR

Critério de resolução:
1. Fase 7 é implementável e funcional, mas o impacto real depende de automação futura
2. Após implementação, smoke manual pode ser feito via `pnpm api:traffic --har export.har`
3. Para automação real: adicionar Playwright smoke test que gera HAR, ou wrapper supertest que persiste chamadas observadas
4. Débito pode ser marcado como "resolvido" quando `api:traffic` existir + documentação do fluxo, mesmo sem automação

## DEB-055-18 — Docs visual depende de Redocly build-docs (sem customização de tema)

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial (registrado 2026-06-27)

Impacto:
A documentação visual (Fase 8) usa Redocly `build-docs` com tema padrão. O HTML gerado é funcional (lista paths, métodos, metadados x-artificio-*), mas não segue o design system do Artifício RPG (cores, fontes, logo). A customização via `--theme` é possível mas não foi aplicada.

Além disso, o HTML é self-contained (~50-200KB por app) — adequado para documentação local/PR, mas não para publicação em produção.

Critério de resolução:
1. No modo inicial, tema padrão do Redocly é aceitável
2. Customização de tema pode ser adicionada depois (via `--theme.openapi.colors.primary.main=...`)
3. Publicação em produção está fora de escopo (Gate C futuro)
4. Débito resolvido quando: (a) `pnpm api:docs` gera HTML sem erro, (b) docs são visualmente verificadas localmente

## DEB-055-19 — Breaking changes não bloqueiam no modo inicial

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial (registrado 2026-06-27)

Impacto:
O comando `pnpm api:diff` (Fase 8) detecta breaking changes e retorna exit code 1 quando encontra, mas o `api:check` (agregador de CI) ainda não considera breaking changes como bloqueio no modo inicial. Breaking changes geram relatório, mas não impedem PR.

Isso é intencional no modo inicial — o foco atual é estabelecer o inventário e o contrato mínimo. O bloqueio por breaking change será ativado no modo estrito (futuro).

Critério de resolução:
1. `api:diff` existe e gera relatório → débito parcialmente resolvido
2. `api:check` incorpora resultado do diff → débito resolvido (quando modo estrito for ativado)
3. Bloqueio real por breaking change → fora de escopo agora

## DEB-055-20 — `api:diff` não bloqueia CI no modo inicial

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial (registrado 2026-06-27)

Impacto:
O comando `pnpm api:diff` (Fase 8) é executado no CI (Fase 9) com `continue-on-error: true` — breaking changes geram relatório mas NÃO bloqueiam o PR. Isso é intencional no modo inicial.

No modo estrito (futuro), `break: true` nos manifestos ou breaking change real devem bloquear o merge. Até lá, o relatório `api-diff.generated.md` serve como alerta visível nos artefatos do CI.

Critério de resolução:
1. Modo estrito ativado → `continue-on-error` removido
2. `api:check` incorpora resultado do diff como bloqueante
3. Breaking changes exigem aprovação explícita no PR

## DEB-055-21 — `api:traffic` não integrado ao CI

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial (registrado 2026-06-27)

Impacto:
A Fase 7 (`api:traffic`) não é executada em CI porque depende de entrada externa (HAR exportado manualmente ou JSON de teste). Sem automação (Playwright smoke, HAR generation), o tráfego observado não pode ser incorporado ao pipeline de CI.

Isso significa que a análise de órfãs no `api:check` continuará sem o benefício de tráfego observado — algumas rotas podem ser falsos positivos de órfã simplesmente porque o tráfego real não foi capturado.

Critério de resolução:
1. Adicionar smoke automatizado que gere HAR (Playwright ou wrapper supertest)
2. Adicionar step `pnpm api:traffic` no CI ANTES do `api:check`
3. Validar que tráfego reduz falso positivo de órfãs

## DEB-055-22 — Required check `api-governance` depende de ação manual do mantenedor

Status: aberto — dívida aceita, não bloqueia fechamento da spec 055 em modo inicial (registrado 2026-06-27)

Impacto:
O job `api-governance` será adicionado ao `ci.yml` na Fase 9, mas só se torna um required check na branch protection de `dev` por ação manual do mantenedor (via `gh api` ou GitHub UI).

Até lá, o job roda no CI e aparece nos checks do PR, mas não bloqueia o merge — o PR pode ser mergeado mesmo com o job falhando (desde que `lint + build + test` passe).

Critério de resolução:
1. Job `api-governance` adicionado ao `ci.yml` → débito aberto
2. Mantenedor adiciona "api-governance" como required check via GitHub UI ou CLI → débito resolvido
3. Alternativa: esperar 1-2 PRs com o job rodando sem required check para provar estabilidade, depois ativar
