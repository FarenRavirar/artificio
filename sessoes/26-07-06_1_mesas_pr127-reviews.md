# Sessao 26-07-06 — mesas PR #127 reviews

## Objetivo
Corrigir localmente os reviews colados pelo mantenedor na PR #127.

## Escopo
`apps/mesas` backend/frontend. Sem commit, sem push, sem comentario no GitHub.

## Plano
- Corrigir carregamento de detalhe/content_raw no preview.
- Unificar mapeamento de sync insert/update.
- Ajustar parse/import/catalogos/selects conforme reviews.
- Rodar validacao pontual e, se viavel, lint/build.

## Evidencia
- `pnpm --filter mesas-backend test -- --runInBand` — 42 files / 386 tests OK.
- `pnpm --filter mesas-frontend test -- --runInBand` — 14 files / 149 tests OK.
- `pnpm verify:api` — OK, 3 warnings conhecidas de ambiguous paths.
- `pnpm run lint` — OK.
- `pnpm run build` — OK.
- Sem commit, push ou comentario no GitHub.
