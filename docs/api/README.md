# Governança de APIs — Artifício RPG

## Regra para agentes de IA

**Agentes de IA estão proibidos de usar memória de chat, sessões anteriores, ou mapas manuais (ex: `apps/mesas/MAPA_DE_API.md` — DEPRECATED) como fonte primária para consulta de rotas de API.**

A fonte da verdade é SEMPRE o inventário gerado pelo código real:

1. `pnpm api:inventory` — inventário sempre atualizado das rotas Express
2. `docs/api/openapi/*.openapi.yaml` — contratos OpenAPI com metadados `x-artificio-*`
3. `pnpm api:check` — comparador 3-way que detecta divergências entre código, OpenAPI e consumidores
4. `docs/api/generated/api-map.generated.md` — mapa gerado a partir do inventário

Nenhum dos artefatos acima é mantido manualmente. São todos gerados por scripts que escaneiam o código real. Qualquer divergência entre documentação manual e código real é resolvida a favor do código (regra pétrea do AGENTS.md §Erros que não podem se repetir).

## Arquitetura

```
Código Express real              # Fonte da verdade (4 apps)
   ├── api:inventory.json         # Inventário estático de rotas (Fase 2)
   ├── api-consumers.json         # Consumidores de API (Fase 3)
   └── openapi/*.yaml             # Contrato OpenAPI (Fase 1)

Comparação 3-way:
   api:check                      # api-drift.generated.md + api-orphans.generated.md

Validação:
   pnpm api:lint                  # Redocly + validação local de x-artificio-* (Fase 4)
```

## Diretórios

| Caminho | Conteúdo | Editável? |
|---------|----------|-----------|
| `docs/api/README.md` | Esta documentação | ✅ Manual |
| `docs/api/openapi/*.yaml` | Contratos OpenAPI por app | ✅ Manual / Gerado |
| `docs/api/generated/` | Artefatos gerados por scripts | ❌ Automático |
| `docs/api/.api-allowlist.json` | Allowlist de divergências legadas (Fase 5) | ⚠️ Gerado + curadoria |

## Scripts disponíveis

| Comando | Descrição |
|---------|-----------|
| `pnpm api:inventory` | Gera inventário de rotas Express (`api-inventory.generated.json` + `api-map.generated.md`) |
| `pnpm api:inventory:tests` | Idem, incluindo arquivos de teste |
| `pnpm api:consumers` | Gera scan de consumidores de API (`api-consumers.generated.json`) |
| `pnpm api:consumers:tests` | Idem, incluindo testes |
| `pnpm api:lint` | Valida OpenAPI YAMLs com Redocly CLI + metadados `x-artificio-*` obrigatórios |
| `pnpm api:check` | Compara código × OpenAPI × consumidores (agregador — `api-drift.generated.md`) |
| `pnpm api:check --generate-allowlist` | Bootstrap da allowlist de divergências legadas |
| `pnpm api:traffic` | Importa HAR/JSON de tráfego observado (`api-traffic.generated.json`) |
| `pnpm api:diff` | Detecta breaking changes entre versões do OpenAPI (`api-diff.generated.md`) |
| `pnpm api:docs` | Gera documentação visual HTML (`{app}-api-docs.html`) |
| `pnpm api:generate-openapi` | Regenera OpenAPI YAMLs a partir do inventário |
| `pnpm verify:api` | Validação padrão de governança de API para desenvolvimento/PR |
| `pnpm verify:api:full` | Validação completa local, incluindo tráfego observado e docs HTML |

### Pipeline de validação (ordem recomendada)

```bash
pnpm api:inventory          # 1. Gerar inventário do código
pnpm api:consumers          # 2. Gerar scan de consumidores
pnpm api:lint               # 3. Validar OpenAPI
pnpm api:traffic            # 4. (Opcional) Importar tráfego observado
pnpm api:check              # 5. Comparar as 4 fontes + relatório
pnpm api:diff               # 6. (Opcional) Verificar breaking changes
pnpm api:docs               # 7. (Local) Gerar docs visual
```

Na rotina normal, use o agregador:

```bash
pnpm verify:api
```

Ele roda, em ordem:

1. `pnpm api:inventory`
2. `pnpm api:consumers`
3. `pnpm api:generate-openapi`
4. `pnpm api:lint`
5. `pnpm api:check`
6. `pnpm api:diff`

Para fechamento local completo da spec ou revisão manual da documentação visual:

```bash
pnpm verify:api:full
```

Esse modo adiciona `pnpm api:traffic` e `pnpm api:docs`.

## Hook local de pre-push

O repositório usa hooks nativos do Git em `.githooks/`. Após `pnpm install`, o script `prepare` configura automaticamente:

```bash
git config core.hooksPath .githooks
```

O hook `.githooks/pre-push` roda `pnpm verify:api` quando a branch tem mudanças em:

- `apps/**`
- `packages/**`
- `scripts/api/**`
- `docs/api/openapi/**`
- `docs/api/.api-allowlist.json`
- `package.json`
- `pnpm-lock.yaml`

Se `verify:api` regenerar arquivos versionados, o push é bloqueado até os artefatos serem revisados e commitados. O hook é uma proteção local de conveniência; a autoridade final continua sendo o job `api-governance` na PR.

## Metadados OpenAPI (`x-artificio-*`)

Toda operation no OpenAPI **deve** declarar:

```yaml
x-artificio-owner: accounts|mesas|glossario|links
x-artificio-scope: internal|public|cross-app|admin|cron|webhook
x-artificio-status: active|deprecated|legacy|orphan-suspect|provisional
x-artificio-auth: none|user|admin|service|csrf-cookie
x-artificio-consumers:       # Obrigatório se scope=cross-app
  - mesas-frontend
```

### Valores de scope

| Valor | Descrição | Exige consumidor? |
|-------|-----------|-------------------|
| `internal` | Saúde/monitoramento interno | ❌ |
| `public` | Dados públicos, leitura aberta | ❌ (mas suspeito se sem) |
| `cross-app` | Consumido por outro app do monorepo | ✅ Obrigatório |
| `admin` | Painel administrativo | ❌ |
| `cron` | Chamada por rotina agendada | ❌ |
| `webhook` | Chamada por serviço externo | ❌ |

### Valores de status

| Valor | Descrição |
|-------|-----------|
| `active` | Em uso ativo |
| `deprecated` | Será removida, mas ainda funciona |
| `legacy` | Código legado, sem previsão de remoção |
| `orphan-suspect` | Suspeita de órfã (sem consumidor conhecido) |
| `provisional` | Provisória, aguardando contrato definitivo |

### Valores de auth

| Valor | Descrição |
|-------|-----------|
| `none` | Sem autenticação |
| `user` | Usuário autenticado (cookie de sessão) |
| `admin` | Admin autenticado |
| `service` | Service-to-service (token interno) |
| `csrf-cookie` | CSRF token via cookie |

## Geração dos OpenAPI YAMLs

Os YAMLs em `docs/api/openapi/*.yaml` foram gerados automaticamente a partir do inventário:

```bash
npx tsx scripts/api/generate-openapi.ts
```

Esse script lê `docs/api/generated/api-inventory.generated.json` e aplica heurísticas de path para classificar cada rota com metadados `x-artificio-*`.

### Heurísticas de classificação

| Padrão de path | scope | auth |
|----------------|-------|------|
| `/health`, `/healthz` | `internal` | `none` |
| `/admin/**` | `admin` | `admin` |
| `accounts /api/auth/{me,refresh,logout}` | `cross-app` | `user` |
| `accounts /api/auth/google*` | `public` | `none` |
| `/auth/**` | `user` | `user` |
| `/gm/**`, `/profile/**`, `/me/**` | `user` | `user` |
| `/notifications/**` | `user` | `user` |
| `/changelog` | `public` | `none` |
| `/og/**` | `public` | `none` |
| Demais GET s/ admin | `public` | `none` |
| POST/PUT/PATCH/DELETE s/ admin | `user` | `user` |

## Manutenção da allowlist

O arquivo `docs/api/.api-allowlist.json` lista divergências legadas conhecidas entre código, OpenAPI e consumidores. Ele permite que `api:check` bloqueie APENAS divergências NOVAS, ignorando o legado existente.

### Bootstrap inicial

```bash
pnpm api:check --generate-allowlist
```

Isso gera a allowlist com TODAS as divergências atuais. Commit ela.

### Removendo entries

Conforme rotas forem documentadas no OpenAPI, as entries correspondentes devem ser removidas manualmente da allowlist. Quando estiver vazia, 100% das rotas estão documentadas.

### Interpretando o relatório

O relatório `docs/api/generated/api-drift.generated.md` mostra:

| Estado | Significado | Bloqueia? |
|--------|-------------|:---------:|
| ✅ OK | Rota documentada no código + OpenAPI + consumidor | ❌ |
| ⚠️ CODE_ONLY | Rota existe no código mas não no OpenAPI | ✅ se nova |
| 📄 CONTRACT_ONLY | Rota no OpenAPI mas não no código | ❌ |
| 🔍 CONSUMER_ONLY | Consumidor chama rota que não existe | ✅ se nova + high conf |
| 🕳️ UNUSED_ROUTE | Rota sem consumidor (justificada: admin, cron, etc) | ❌ |
| 👻 ORPHAN_SUSPECT | Rota sem consumidor e sem classificação | ❌ |

## Débitos conhecidos

- **Rotas factory não resolvidas (DEB-055-12):** accounts `PUT/GET /admin/secrets/:name` (via `createAdminSecretsRoutes`) e mesas correções via `createCorrectionHandler` — não estão no inventário estático.
- **Classificação heurística:** Os metadados `x-artificio-*` foram gerados por heurística de path e podem não refletir a intenção real. Revisar manualmente cada operation.
- **OpenAPI sem schemas de request/response:** Os YAMLs atuais têm `responses: { "200": { description: "OK" } }` mínimo. Schemas reais precisam ser adicionados em versões futuras.

## Breaking changes (`api:diff`)

O comando `pnpm api:diff` compara os OpenAPI YAMLs atuais contra a versão no branch `dev` (git), usando `openapi-diff` para classificar mudanças.

```bash
# Comparar todos os apps contra dev
pnpm api:diff

# Comparar app específico
pnpm api:diff --app accounts

# Comparar contra branch específico
pnpm api:diff --base main

# Comparar dois arquivos arbitrários
pnpm api:diff --old antigo.yaml --new novo.yaml
```

**No modo inicial**, `api:diff` gera relatório mas **não bloqueia** o CI. Breaking changes viram alerta no relatório `api-diff.generated.md`, mas o exit code é sempre 0.

## Docs visuais (`api:docs`)

O comando `pnpm api:docs` gera HTML estático self-contained para cada app usando Redocly CLI:

```bash
pnpm api:docs
# → docs/api/generated/accounts-api-docs.html  (52 KiB)
# → docs/api/generated/mesas-api-docs.html      (490 KiB)
# → docs/api/generated/glossario-api-docs.html  (168 KiB)
# → docs/api/generated/links-api-docs.html      (98 KiB)
```

Os HTMLs são **locais** — não são publicados em produção nesta fase. Abra-os diretamente no browser.

```bash
# App específico
pnpm api:docs --app accounts
```
