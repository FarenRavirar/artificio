# 055 — Governança executável de APIs: inventário automático, OpenAPI validado e detecção de rotas órfãs/duplicadas

- **Módulo/Pacote:** transversal — `apps/accounts`, `apps/mesas/backend`, `apps/glossario/backend`, `apps/links/server`, frontends consumidores, CI, `docs/api/`, scripts `scripts/api/`.
- **Gate relacionado:** D (todos os projetos em produção) + governança transversal.
- **Tipo:** **SDD Completo**. Toca governança, CI, contratos de API, documentação operacional e múltiplos apps.
- **Origem:** mantenedor 2026-06-27 — `MAPA_DE_API.md` manual nunca é lembrado por agentes; governança em Markdown/AGENTS não é suficiente. Precisa de mecanismo executável e bloqueante.
- **Autor do plano:** Claude Code. **Implementação:** DeepSeek, em sessão futura, sem commit/push/PR sem autorização nominal.
- **Status:** fechável em modo inicial (2026-06-28). Implementada e validada; débitos remanescentes aceitos para evolução/mode estrito.

---

## Problema

O projeto já provou que documentação manual não segura agentes nem mudanças longas:

- agentes podem esquecer contexto, pular governança ou não lembrar de ler `MAPA_DE_API.md`;
- mapa manual fica obsoleto;
- rota nova pode ser criada sem contrato;
- rota antiga pode continuar documentada depois de removida;
- frontend pode chamar endpoint inexistente;
- apps precisam se conectar entre si, mas contratos cross-app hoje dependem demais de memória e busca manual;
- rotas mal declaradas ou duplicadas passam despercebidas até runtime/review humano.

Logo, a solução não pode depender de “leia o Markdown”. A governança precisa estar no **caminho obrigatório de validação**.

## Princípio central

**Documentação é visualização. Contrato e CI são a trava.**

Fonte operacional:

```txt
Código Express real
  + OpenAPI validado
  + scan de consumidores
  + tráfego/testes observados
  + CI bloqueante
= governança de API
```

O agente pode esquecer o contexto. O repositório não pode aceitar uma mudança inconsistente.

## Escopo

Criar um fluxo que:

1. gere inventário automático das rotas Express reais;
2. compare inventário contra OpenAPI;
3. compare consumidores frontend/shared contra rotas/contratos;
4. detecte rotas novas sem dono/classificação;
5. detecte rotas possivelmente duplicadas ou desnecessárias;
6. detecte rotas possivelmente órfãs;
7. gere mapa derivado, não editado à mão;
8. rode em CI em modo inicial;
9. crie caminho para modo estrito.

## Estado real das APIs (investigação inicial)

Stack real:

- `apps/accounts/src/app.ts` — Express 5 direto.
- `apps/glossario/backend/src/index.ts` — Express 5 + routers.
- `apps/links/server/server.ts` — Express 5.
- `apps/mesas/backend/src/server.ts` — Express 5 + muitos routers.

Não há Next App Router, `pages/api`, Nest, Fastify ou Hono como fonte real das APIs.

Consequência:

- `next-openapi-gen` e `next-swagger-doc` **não são ferramenta principal**.
- `tsoa` não encaixa como retrofit principal porque não há arquitetura controller/decorator.
- `ts-rest` pode ser adotado para APIs novas/refatoradas, mas não resolve inventário legado sozinho.
- A primeira entrega deve priorizar inventário + comparação + OpenAPI mínimo validado.

## Modelo alvo

### Arquivos gerados

```txt
docs/api/generated/api-inventory.generated.json
docs/api/generated/api-map.generated.md
docs/api/generated/api-consumers.generated.json
docs/api/generated/api-drift.generated.md
docs/api/generated/api-orphans.generated.md
docs/api/generated/api-traffic.generated.json
```

Arquivos em `generated/` são derivados. Não são editados à mão.

### Contratos OpenAPI

```txt
docs/api/openapi/accounts.openapi.yaml
docs/api/openapi/mesas.openapi.yaml
docs/api/openapi/glossario.openapi.yaml
docs/api/openapi/links.openapi.yaml
```

OpenAPI é fonte técnica de contrato. Markdown é visualização derivada.

### Scripts esperados

```txt
pnpm api:inventory
pnpm api:consumers
pnpm api:lint
pnpm api:diff
pnpm api:traffic
pnpm api:check
pnpm api:docs
```

`api:check` é o comando agregador para CI.

## Classificação obrigatória de rotas

Toda rota no OpenAPI deve declarar metadados `x-artificio-*`:

```yaml
x-artificio-owner: mesas
x-artificio-scope: internal | public | cross-app | admin | cron | webhook
x-artificio-status: active | deprecated | legacy | orphan-suspect | provisional
x-artificio-auth: none | user | admin | service | csrf-cookie
x-artificio-consumers:
  - mesas-frontend
```

Regras:

- rota nova sem `owner` falha;
- rota nova sem `scope` falha;
- rota nova sem `status` falha;
- rota `cross-app` sem consumidores declarados falha;
- rota `public` sem decisão explícita falha ou alerta, conforme modo;
- rota `provisional` pode existir no modo inicial, mas não pode virar `stable/active` sem contrato mínimo.

## Detecção de divergência

Comparações obrigatórias:

```txt
Código Express real vs OpenAPI
OpenAPI vs consumidores frontend/shared
Consumidores vs Código Express real
Tráfego/testes observados vs OpenAPI
```

Estados gerados:

- `OK`
- `CODE_ONLY` — existe no código, falta no OpenAPI.
- `CONTRACT_ONLY` — existe no OpenAPI, não existe no código.
- `CONSUMER_ONLY` — frontend/shared chama rota não encontrada no contrato/código.
- `UNUSED_ROUTE` — rota existe, mas não tem consumidor/tráfego/teste conhecido.
- `ORPHAN_SUSPECT` — rota sem consumidor, sem tráfego, sem teste e sem classificação externa/admin/cron/webhook.
- `DUPLICATE_SUSPECT` — rota nova parece duplicar rota existente.
- `BREAKING_CHANGE` — método/path/schema removido ou alterado de forma incompatível.
- `UNCERTAIN` — scanner não conseguiu confirmar.

## Rotas órfãs

Uma rota é suspeita de órfã quando:

```txt
existe no código
e/ou existe no OpenAPI
mas não aparece em consumidores
nem em tráfego/testes observados
nem está marcada como public/admin/cron/webhook/cross-app/legacy
```

Regra: **não remover automaticamente**. Gerar relatório e débito acionável.

## Rotas duplicadas/desnecessárias

Para rota nova, `api:check` deve comparar com rotas existentes por:

- mesmo método;
- path parecido;
- substantivos parecidos;
- mesmo owner;
- mesmo consumidor;
- schemas parecidos, quando houver;
- prefixo equivalente (`/api/v1/admin/discord/import/file` vs `/api/v1/admin/import-json`, por exemplo).

No modo inicial, isso gera alerta forte. No modo estrito, pode bloquear rota nova sem justificativa em `Impacto em API`.

## Cross-app

Rotas entre projetos são contrato de suite, não detalhe interno.

Exemplos:

- `accounts` → `GET /api/auth/me`
- `accounts` → `POST /api/auth/logout`
- apps consumidores → sessão SSO/cookie

Toda rota `cross-app` precisa:

- owner;
- consumidores;
- auth;
- estabilidade;
- regra de breaking change.

## Modo inicial

CI falha quando:

- OpenAPI inválido;
- script quebra;
- inventário não gera;
- rota nova aparece sem classificação mínima;
- consumidor chama rota inexistente claramente;
- documentação visual não renderiza quando o comando for exigido;
- diff técnico falha.

CI **não falha ainda** para:

- divergências legadas já existentes;
- rotas órfãs suspeitas herdadas;
- payload/resposta incompletos.

Esses viram relatório/débito.

## Modo estrito

Depois da estabilização:

- rota `CODE_ONLY` nova bloqueia PR;
- rota `CONTRACT_ONLY` bloqueia PR salvo `deprecated/legacy` justificado;
- `CONSUMER_ONLY` bloqueia PR;
- `BREAKING_CHANGE` bloqueia sem aprovação explícita;
- `DUPLICATE_SUSPECT` bloqueia rota nova sem justificativa;
- rota `provisional` antiga bloqueia até ganhar contrato ou virar débito aprovado.

## Critérios de aceite

1. `MAPA_DE_API.md` deixa de ser fonte manual; mapa novo é gerado em `docs/api/generated/api-map.generated.md`.
2. Inventário automático cobre `accounts`, `mesas`, `glossario`, `links`.
3. OpenAPI mínimo existe e passa lint.
4. `api:check` compara código, OpenAPI e consumidores.
5. Rotas novas sem classificação são barradas no modo inicial.
6. Relatório de órfãs e duplicadas é gerado.
7. CI roda `api:check` em PR.
8. README operacional explica fluxo para humanos e agentes.
9. Nenhum endpoint, payload, auth ou resposta muda por esta spec.
10. Débitos de cobertura incompleta ficam registrados em `debitos.md` e `specs/backlog.md`.

## Fora de escopo

- Reescrever APIs existentes para `ts-rest`.
- Alterar comportamento de endpoint.
- Alterar auth/SSO.
- Remover rota órfã automaticamente.
- Inventar payload/resposta no OpenAPI.
- Publicar docs privadas em rota pública.
- Endurecer CI para todo legado antes dos relatórios estabilizarem.

## Impacto em API

- [ ] Cria endpoint
- [ ] Altera endpoint
- [ ] Remove endpoint
- [ ] Move endpoint
- [ ] Altera consumidor de API
- [ ] Altera payload
- [ ] Altera resposta
- [ ] Altera autenticação
- [x] Não altera API

Verificações obrigatórias após implementação:

- [ ] `pnpm api:inventory`
- [ ] `pnpm api:consumers`
- [ ] `pnpm api:lint`
- [ ] `pnpm api:diff`
- [ ] `pnpm api:check`
- [ ] documentação visual conferida
- [ ] divergências registradas
