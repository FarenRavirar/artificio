# 055 — Plano

> Plano para DeepSeek implementar. Não implementar scanner próprio sofisticado antes de provar lacuna. Começar com inventário simples, determinístico e bloqueante o bastante para impedir esquecimento de agente.

## Estratégia

1. **Não confiar em Markdown manual.**
2. **Gerar inventário do código real.**
3. **Comparar com OpenAPI validado.**
4. **Comparar com consumidores.**
5. **CI bloqueia regressão nova.**
6. **Legado divergente vira relatório/débito, não bloqueio total imediato.**

## Fase 0 — Baseline read-only

Confirmar novamente, antes de codar:

- apps com Express:
  - `apps/accounts/src/app.ts`
  - `apps/glossario/backend/src/index.ts`
  - `apps/links/server/server.ts`
  - `apps/mesas/backend/src/server.ts`
- consumidores frontend/shared:
  - `apps/*/frontend/src`
  - `apps/site-admin/src`
  - `apps/links/src`
  - `packages/auth`
  - `packages/ui`, se houver cliente HTTP
- estado de `apps/mesas/MAPA_DE_API.md`.

Saída: nota curta em sessão. Sem editar código ainda.

## Fase 1 — Estrutura de contrato e docs

Criar:

```txt
docs/api/README.md
docs/api/openapi/
docs/api/generated/
```

Criar OpenAPI mínimo por app:

```txt
accounts.openapi.yaml
mesas.openapi.yaml
glossario.openapi.yaml
links.openapi.yaml
```

Regra: documentar paths/methods reais; payload/resposta só quando houver fonte confiável. Se não houver, usar schema mínimo honesto e registrar débito.

## Fase 2 — Inventário estático de rotas Express

Criar `scripts/api/inventory.ts`.

Objetivo:

- detectar `app.get/post/put/patch/delete`;
- detectar `router.get/post/put/patch/delete`;
- detectar montagem `app.use('/prefix', router)`;
- detectar subrouters quando possível;
- gerar JSON com:

```ts
{
  app: string;
  method: string;
  path: string;
  sourceFile: string;
  line?: number;
  confidence: "high" | "medium" | "low";
  kind: "express-route" | "mount" | "unknown";
}
```

Regras:

- não inventar payload;
- quando não conseguir resolver prefixo/subrouter, marcar `confidence: low`;
- excluir rotas de teste por padrão;
- permitir `--include-tests` só para diagnóstico.

Observação: pode começar com parser AST TypeScript (`typescript` compiler API) ou `ts-morph` se aprovado como devDependency. Se dependência nova for necessária, registrar antes na sessão. Não usar regex frágil como fonte final se AST for viável.

## Fase 3 — Scan de consumidores

Criar `scripts/api/consumers.ts`.

Detectar:

- `fetch(...)`;
- wrappers locais (`authGet`, `apiRequest`, `discordSyncApi`, etc.);
- literais `/api/...`;
- template literals com prefixo resolvível;
- envs como `VITE_API_URL`, `API_BASE`.

Gerar:

```ts
{
  consumer: string;
  app?: string;
  method?: string;
  path: string;
  sourceFile: string;
  line?: number;
  confidence: "high" | "medium" | "low";
}
```

Regra: baixa confiança não bloqueia no modo inicial, mas entra no relatório.

## Fase 4 — Lint OpenAPI

Adicionar Redocly CLI ou alternativa equivalente.

Comando:

```txt
pnpm api:lint
```

Valida todos os YAML em `docs/api/openapi/*.yaml`.

## Fase 5 — Comparador `api:check`

Criar `scripts/api/check-api.ts`.

Entrada:

- inventário de rotas;
- OpenAPI;
- consumidores;
- allowlist temporária de legado, se necessária.

Saída:

- `api-drift.generated.md`;
- exit code:
  - `0` se só divergência legada permitida;
  - `1` se houver erro novo bloqueante.

Bloqueios do modo inicial:

- rota nova sem OpenAPI;
- rota nova sem `x-artificio-owner`;
- rota nova sem `x-artificio-scope`;
- rota nova sem `x-artificio-status`;
- consumidor novo chamando rota inexistente;
- OpenAPI inválido.

## Fase 6 — Órfãs e duplicadas

Criar detecção heurística em `api:check`:

### Órfãs

Gerar `api-orphans.generated.md` com rotas:

- sem consumidor detectado;
- sem tráfego observado;
- sem teste conhecido;
- sem classificação `public/admin/cron/webhook/cross-app/legacy`.

Não falhar por legado no modo inicial.

### Duplicadas

Gerar alerta quando rota nova parece similar a rota existente.

Heurística inicial:

- normalizar path removendo `:id`, `v1`, plurais simples;
- comparar tokens do path;
- comparar método;
- comparar owner/scope;
- score >= limite => `DUPLICATE_SUSPECT`.

No modo inicial: alerta. No modo estrito: bloqueio se não houver justificativa.

## Fase 7 — Tráfego/testes observados

Começar simples. Não instalar plataforma pesada agora.

Opções aceitas:

- capturar chamadas de Playwright/HAR quando houver smoke;
- capturar chamadas de supertest;
- importar HAR manual local em `scripts/api/traffic.ts`;
- gerar `api-traffic.generated.json`.

Regra: tráfego complementa, não substitui inventário estático.

## Fase 8 — Docs visual

Adicionar Scalar como alvo inicial, se encaixar.

Comando:

```txt
pnpm api:docs
```

Pode gerar build estático local ou servir preview local. Não publicar em produção nesta spec.

## Fase 9 — CI

Plugar `pnpm api:check` no CI em modo inicial.

Importante:

- não tornar divergência legada bloqueante no primeiro PR;
- bloquear apenas erro novo claro;
- required check deve continuar `lint + build + test` ou incluir o novo passo nele, conforme menor risco.

## Fase 10 — Migração do `MAPA_DE_API.md`

Transformar o mapa manual em ponte para o gerado:

- ou substituir por aviso apontando para `docs/api/generated/api-map.generated.md`;
- ou manter com status `DEPRECATED`, sem obrigação manual.

Não manter duas fontes vivas.

## Validação final

Rodar:

```txt
pnpm api:inventory
pnpm api:consumers
pnpm api:lint
pnpm api:check
pnpm run lint
pnpm run build
```

Se `pnpm run test` for pesado demais, rodar teste pontual dos scripts e registrar. Para conclusão final de spec, seguir governança do repo.
