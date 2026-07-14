# Tasks — 077 mesas dedupe mesas ativas

Execução: Codex. Ordem estrita — Fase 0 completa (com evidência) antes de
qualquer task de código de feature.

## Fase 0 — Investigação (bloqueia tudo abaixo)

- [x] Atualizar `specs/backlog.md` e `project-state.md` (abertura da spec).
- [x] Confirmar schema real de `tables` (campos usáveis pra hash/score) —
      registrar evidência (arquivo:linha) em `sessoes/`.
- [x] Levantar volume real de mesas ativas (`count(*)`, read-only) —
      registrar número e se full-scan síncrono é viável.
- [x] Escrever teste exploratório do algoritmo de score contra amostra real
      de `tables` — registrar quantos pares candidatos aparecem hoje.
- [x] Propor e registrar em `plan.md`: tabela nova vs. extensão de
      `discord_duplicate_candidates`.
- [x] Propor e registrar em `plan.md`: gatilho sob demanda vs. automático.
- [x] Levar decisões ao mantenedor e obter aprovação explícita antes de
      migration/rota nova.

## Fase 1+ — Implementação (só após Fase 0 aprovada)

- [x] Migration: tabela de candidatos mesa×mesa (ou ajuste decidido).
- [x] Backend: serviço de comparação/score mesa×mesa.
- [x] Backend: rota `GET /admin/tables/duplicates`.
- [x] Backend: rota `PATCH /admin/table-duplicate-candidates/:id`.
- [x] Backend: estender detecção draft×mesa ativa (não só draft×draft).
- [x] Frontend: badge de duplicata em `DiscordDraftReviewTable.tsx`.
- [x] Frontend: tela/aba de gestão de duplicatas com link direto pras duas
      pontas (mesa pública + admin + draft).

## Fase 2 — Testes e validação

- [x] Teste unitário do serviço de score (par idêntico, par parecido só no
      sistema, par sem relação).
- [x] Teste de rota (`GET`/`PATCH`) cobrindo `requireAdmin` e payload
      inválido.
- [x] `pnpm run lint` + `pnpm run build` (backend + frontend mesas).
- [ ] Smoke manual real: par de mesas ativas semelhantes aparece como
      candidato na tela de gestão (não fechar só com teste unitário).
- [ ] Atualizar `specs/backlog.md` e `project-state.md` (fechamento/status).
