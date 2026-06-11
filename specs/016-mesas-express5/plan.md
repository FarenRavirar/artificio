# Plano — 016

## Arquitetura da solução
Migração de major contida no `apps/mesas/backend`:
1. Bump `express ^4.19.2 → ^5.x` + `@types/express ^4.17.21 → ^5.x` no `apps/mesas/backend/package.json`.
2. `pnpm install` (atualiza lock; `@types/express-serve-static-core` converge p/ v5 único).
3. Auditar/ajustar quebras 4→5 (ver requisitos): rotas path-to-regexp v8, getters de `req.query/params`, APIs removidas, `express-async-errors` (express 5 já captura async — possivelmente remover a dep).
4. Build + testes verdes sem cache.
5. Deploy beta → smoke → prod (aprovação por ação).

## Arquivos afetados
- `apps/mesas/backend/package.json` (deps)
- `apps/mesas/backend/src/**` (rotas/handlers que usem padrões express-4-only)
- `pnpm-lock.yaml`
- `errors.md` (fechar E004)
- **Não tocar** `packages/*` nem outros apps (já express 5).

## Contratos/interfaces tocados
Nenhum público novo. Auth SSO intacto. Rotas/status preservados.

## Impacto em consumidores
mesas-frontend consome a API por HTTP (sem mudança de contrato). Outros módulos não dependem do mesas-backend.

## Rollback
Revert do bump; `_deploy-module` snapshot/rollback de DB+containers.

## Validação
- `turbo build --filter=@artificio/mesas-backend` sem cache verde.
- `turbo test --filter=@artificio/mesas*`.
- Smoke local server (health/upload/auth redirect).
- Deploy mesasbeta verde + smoke 200/401/302; depois prod.
- Grep final: `"express": "^4` → 0 ocorrências.
