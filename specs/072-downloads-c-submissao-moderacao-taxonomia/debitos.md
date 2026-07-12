# Débitos — Spec 072 (Downloads-C)

Achados internos de investigação, lint, build ou auditoria. Vazio por definição no momento da abertura.

## DEB-072-01 — 🟢 Fechado (2026-07-12): Rota dedicada de escrita de `download_material_metadata` (T2.2)

`PUT /api/v1/material-metadata/:materialId` (upsert) + `GET /api/v1/material-metadata/:materialId`. `src/routes/materialMetadata.ts`. Ownership igual `materials.ts` (dono ou moderador/admin).

## DEB-072-02 — 🟢 Fechado (2026-07-12): Validação cruzada de taxonomia (T1.4)

Regra mínima implementada: `vtt_platform` só aceito se o material já tem `system_id`. Validação embutida em `PUT /api/v1/material-metadata/:materialId`. Mais regras cruzadas entram quando o formulário real (spec 074) expuser outros campos condicionais.

## DEB-072-03 — 🟢 Fechado (2026-07-12): Contenção proporcional automática de denúncia (T5.2)

**Decisão nominal do mantenedor (2026-07-12):** 1 denúncia P0 em material `published` já transiciona automaticamente para `withdrawn` (via máquina de estados). Implementado em `POST /api/v1/reports` (`src/routes/reports.ts`). Moderador revisa depois; falso positivo custa reaparecer manualmente, risco de manter no ar custa mais.

## DEB-072-04 — 🟢 Fechado (2026-07-12): Abuso de denúncia, retirada voluntária, abandono/reivindicação (T5.4)

**Mudança de escopo (decisão nominal do mantenedor, 2026-07-12): denúncia deixou de ser anônima — exige conta `accounts.`** (revoga critério de aceite 5 original do `spec.md`, que permitia denúncia sem login). Isso habilita rastreio de abuso por usuário.
- Retirada voluntária: `DELETE /api/v1/reports/:id`, só o próprio denunciante, só enquanto `case_state = 'open'`.
- Detecção de abuso: `GET /api/v1/reports/abuse-check/:userId` (moderador/admin) — `src/services/reportAbuseGuard.ts`, regra decidida nominalmente: 3 denúncias consecutivas do mesmo usuário terminadas "dismissed" marca como abusivo (só sinal, nunca bane sozinho).
- Abandono/reivindicação de material (criador some, outro usuário quer assumir) **não implementado** — sem critério definido nesta rodada, sem consumidor de UI; registrado como novo débito em aberto (ver abaixo).

## DEB-072-05 — Abandono/reivindicação de material (T5.4, parcial)

Fluxo de "criador abandonou o material, outro usuário quer reivindicar posse" não implementado — não tem critério de elegibilidade definido (ex.: tempo de inatividade do creator) nem consumidor de UI ainda. Fica para quando houver decisão de produto específica.
