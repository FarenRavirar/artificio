# Plan — Spec 070 (Downloads-A)

## Fase 0 — Preparação

- Confirmar estado real da API central 062 (não assumir memória de spec antiga — reler estado vigente).
- Levantar padrão de schema/migration mais recente entre os apps (mesas é a referência técnica principal, D092).

## Fase 1 — Schema

- Migrations para todas as entidades de `061/spec.md` §F5/T5.1.
- Tipos Kysely gerados/escritos.
- Índices mínimos (slug, composto catálogo, moderação, trigram, criador).

## Fase 2 — API base

- Rotas de leitura pública (catálogo, ficha) sem sessão.
- Rotas de escrita autenticadas (criação/edição de material) com ownership.
- Middleware de auth reaproveitado de `@artificio/auth`.
- Consumo (nunca escrita) da API central 062.

## Fase 3 — Ownership e roles

- Roles mínimas: usuário comum, publicador, moderador, admin.
- Teste de integração de ownership.

## Fase 4 — Governança de API

- `pnpm verify:api`, bundle atualizado, sem breaking não intencional.

## Fase 5 — Validação

- lint + build + test locais.
- Sem commit até autorização nominal.

## Gate de saída

Tudo acima verde localmente libera spec 071 e 072 em paralelo.
