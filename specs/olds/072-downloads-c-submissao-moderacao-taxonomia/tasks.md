# Tasks — Spec 072 (Downloads-C)

## F0 — Preparação

- [x] T0.1 — Reler T3.1–T3.4/T4.4 de `061/spec.md` como contrato.

## F1 — Taxonomia

- [x] T1.1 — Campos obrigatórios de publicação. Já cobertos por `download_material` (070): slug/title/material_type/creator_id.
- [x] T1.2 — Campos condicionais. Já cobertos por `download_material_metadata` (070, migration 002): scenario/genre/language/file_format/vtt_platform/access_barriers/license_kind/license_url/credits/target_audience/age_rating/content_warnings/tags.
- [x] T1.3 — Campos opcionais/privados. Idem T1.2 (colunas nullable na mesma tabela).
- [x] T1.4 — Validação cruzada (edição exige sistema, etc.). `vtt_platform` só aceito com `system_id` presente. `PUT /api/v1/material-metadata/:materialId` (DEB-072-02 fechado, 2026-07-12).

## F2 — Submissão

- [x] T2.1 — Rota de escolha de origem (link externo/upload). Já coberto: `access_kind` em `download_material` (070) + `POST /api/v1/materials`.
- [x] T2.2 — Rota de metadados. `PUT/GET /api/v1/material-metadata/:materialId` (`src/routes/materialMetadata.ts`, DEB-072-01 fechado, 2026-07-12), upsert com ownership (dono ou moderador/admin).
- [x] T2.3 — Rota de prova (D100). Ver F3.
- [x] T2.4 — Rota de revisão/confirmação. `POST /api/v1/moderation/:id/submit` (draft→in_review), `POST /api/v1/moderation/:id/approve`, `POST /api/v1/moderation/:id/reject`. `src/routes/moderation.ts`.
- [x] T2.5 — Persistência de rascunho de submissão. Já coberto: `POST /api/v1/materials` cria sempre em `draft` (070); PATCH edita campos do rascunho preservando histórico via `download_material_version`.

## F3 — Prova

- [x] T3.1 — `download_evidence`: URL, captura, licença/base jurídica. Já existe (070, migration 004). Aprovação (`POST /api/v1/moderation/:id/approve`) agora **exige** `download_evidence` registrada — nunca aprova sem prova (critério de aceite 4).
- [x] T3.2 — Sem expurgo automático por prazo. Confirmado: tabela sem coluna de TTL/expiração (070, comentário na migration).

## F4 — Moderação

- [x] T4.1 — Máquina de estados editoriais. `src/services/editorialStateMachine.ts` (`assertValidTransition`/`canTransition`): draft→in_review→published|rejected; published→withdrawn; rejected→in_review (reenvio). 15 testes (`editorialStateMachine.test.ts`).
- [x] T4.2 — Fila com motivo estruturado obrigatório em reprovação. `GET /api/v1/moderation/queue` + `POST /api/v1/moderation/:id/reject` (schema zod exige `reason` não vazio; migration 011 adiciona `download_material.rejection_reason`).
- [x] T4.3 — Ações batch (aprovar/reprovar/arquivar múltiplos). `PATCH /api/v1/moderation/batch/:action` (`src/routes/moderation.ts`), mesmo contrato de `apps/mesas` — cada item processado independentemente, resultado agregado por id.
- [x] T4.4 — Reenvio após reprovação preservando dados + motivo. `POST /api/v1/moderation/:id/submit` permite `rejected→in_review`; título/summary/description preservados (só o rascunho é editado via PATCH normal), `rejection_reason` limpo ao reenviar.
- [x] T4.5 — Flag de auto-publicação existente, desligada por kill switch (sem critério de liberação). `download_material.auto_publish_enabled BOOLEAN DEFAULT FALSE` (migration 011). Nenhuma rota liga/usa o flag nesta rodada — critério de acionamento é decisão futura (D111 item 3).

## F5 — Denúncia

- [x] T5.1 — Canais e categorias. `POST /api/v1/reports` (`src/routes/reports.ts`), categorias enum (`copyright_violation`, `malicious_link`, `inappropriate_content`, `broken_link`, `other`).
- [x] T5.2 — Prioridade P0–P3 e contenção proporcional. `download_report.priority` (070) + `GET /api/v1/reports` ordena por prioridade. **Contenção automática (decisão nominal do mantenedor, 2026-07-12, DEB-072-03 fechado): 1 denúncia P0 em material `published` transiciona automaticamente para `withdrawn`** (`POST /api/v1/reports`).
- [x] T5.3 — Contraditório e recurso. `PATCH /api/v1/reports/:id` registra decisão (`case_state` + `resolution_note`) só para moderador/admin (critério de aceite 5). **Fluxo de UI de contestação pelo autor fica na spec 073/074** (já delimitado no `spec.md` como fora de escopo).
- [x] T5.4 — Abuso, retirada voluntária. **Denúncia agora exige conta `accounts.` (revogado anonimato, decisão nominal 2026-07-12, ver critério de aceite 5 atualizado).** Retirada voluntária: `DELETE /api/v1/reports/:id` (só denunciante, só `case_state='open'`). Detecção de abuso: `GET /api/v1/reports/abuse-check/:userId`, `src/services/reportAbuseGuard.ts` (3 denúncias seguidas "dismissed" = sinal de abuso, moderador decide). DEB-072-04 fechado. **Abandono/reivindicação de material continua não implementado** — sem critério de elegibilidade definido, novo débito DEB-072-05.

## F6 — Comentário e avaliação

- [x] T6.1 — Comentário exige conta `accounts.`; retirada só por denúncia. `download_comment` (migration 011) + `POST/GET /api/v1/comments`, `DELETE /api/v1/comments/:id` (só moderador/admin, nunca autoexclusão livre).
- [x] T6.2 — Guard de avaliação: bloqueia conta sem download prévio do material. `src/services/ratingGuard.ts` (`assertCanRate`), checker injetável — a query real de "baixou ou não" fica pra spec 074 (métrica por usuário ainda não existe, só agregado em `download_metric_daily`).

## F7 — Validação

- [x] T7.1 — lint + build + test locais. Verde: 44 testes (após fechar débitos DEB-072-01 a 04), `pnpm --filter @artificio/downloads-backend lint/build/test`, `pnpm verify:api` exit 0 (2026-07-12).
- [x] T7.2 — Teste completo da máquina de estados (transições válidas/inválidas). `src/services/editorialStateMachine.test.ts`, 15 casos (5 válidas + 10 inválidas).
