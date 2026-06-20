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
- Mexer em `apps/links` / `packages/media` (PR #74 separada).
- Backend mesas (`@artificio/mesas-backend`, `lint=none`).
- Mudar versões de plugins ESLint.

## Riscos e impacto em outros módulos

- glossario e mesas estão em produção; refatorar effects pode alterar
  comportamento. Mitigar com build + smoke + revisão por arquivo.
- `set-state-in-effect` muitas vezes vira estado derivado — risco de loop/render
  se mal feito. Validar cada caso.
