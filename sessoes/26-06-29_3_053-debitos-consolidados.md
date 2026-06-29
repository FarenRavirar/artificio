# 2026-06-29 — Spec 053 débitos consolidados

## Objetivo

Fechar a spec 053: CI CJS, tema accounts, a11y/UI da gestão, doc herdado e decisão segura da ingestão VM.

## Escopo

- `specs/053-mesas-ui-ci-debitos-consolidados/`
- `apps/accounts/frontend`
- `apps/mesas/frontend`
- `packages/ui`
- CI/scripts locais necessários para smoke CJS

## Plano

- [x] Frente C: smoke CJS para packages shared.
- [x] Frente B: tema do accounts.
- [x] Ampliação B4: reestruturação visual do `accounts` conforme feedback do mantenedor.
- [x] Frente A: a11y/UI da gestão sobre estrutura atual.
- [x] Frente D: registrar doc herdado como promovido pela 053.
- [x] Frente E: resolver sem VM write não autorizado; transferida explicitamente para 052 Bloco A.
- [x] Validar com comandos reais proporcionais.

## Evidência parcial

- `pnpm smoke:cjs-exports -- --prove-regression` ✅
- `pnpm --filter @artificio/mesas-frontend test -- DiscordDraftPreview.test.tsx DiscordDraftReviewTable.test.tsx DraftEditorTab.test.tsx` ✅ (vitest executou 13 arquivos/141 testes do pacote)
- `pnpm run lint` ✅ (rerodado após ajuste de hook dependency)
- `pnpm run build` ✅
- `pnpm --filter @artificio/mesas-frontend build` ✅
- `pnpm verify:api` ✅ (3 warnings conhecidos de paths ambíguos; exit 0)
- `pnpm --filter @artificio/accounts lint` ✅
- `pnpm --filter @artificio/accounts build` ✅

## Evidência visual

- Referência do mantenedor inspecionada: `C:\Users\paulo\AppData\Local\Temp\codex-clipboard-e5a1e158-fa44-4cf8-b99f-d940a2eb3b13.png`.
- Tentativa de screenshot local com mock `/api/auth/me` falhou porque Playwright Chromium não está instalado (`Executable doesn't exist ... chromium_headless_shell`). Servidor mock foi encerrado em seguida.
- Sem browser instalado, validação visual final fica para beta/prod ou ambiente com browser; validação técnica local passou.

## Observações de escopo

- `.gitignore` já estava modificado antes da branch; não pertence à 053.
- `docs/api/generated/*` mudou por `verify:api` (linhas de consumidores + diff gerado sem mudança).
- `specs/backlog.md` e `project-state.md` não foram atualizados por instrução do mantenedor; atualização externa ficará com DeepSeek.

## Critério de conclusão

- Tasks da 053 atualizadas.
- Código local validado.
- Sem tocar VM/commit/push sem aprovação nominal.
- `.gitignore` pré-existente permanece fora do escopo.
