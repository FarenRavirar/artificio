# Débitos — Spec 074 (Downloads-E)

Achados internos de investigação, lint, build ou auditoria.

## DEB-074-01 — Organizações/Notificações são escopo mínimo inventado, sem spec própria

🟡 Aberto (2026-07-12). Autorizado nominalmente pelo mantenedor: nenhuma spec do pacote 070-076 nem `decisions.md` define o domínio de "organização" (grupo de creators?) ou "notificação" (que eventos? envio externo?) do painel (T1.6/T1.7 de `061/spec.md`). Implementado escopo mínimo funcional: `download_organization`/`download_organization_member` (migration_017, organização = grupo com dono admin automático) e `download_notification` (migration_018, feed interno só-leitura, sem envio externo/email/push e **sem emissão automática** — nenhuma rota existente (`moderation.ts`/`reports.ts`) grava notificação ainda). Se o domínio real divergir da suposição feita aqui, migration/rota precisam revisão.

## DEB-074-02 — "Minhas denúncias" sem rota de backend (placeholder)

🟢 Fechado (2026-07-12). `GET /api/v1/reports/mine` (rota fixa antes de `/:id`) filtra por `reporter_user_id = req.user.userId`. `DenunciasPage.tsx` consome via novo hook `useMyReports.ts`, exibe categoria/estado/nota de resolução.

## DEB-074-03 — Sem UI de "adicionar à coleção" na ficha de material

🟢 Fechado (2026-07-12). `AddToCollectionButton.tsx` (novo) reusa `POST /collections/:id/items` (já existia sem UI); dropdown lista as coleções do usuário logado, integrado a `MaterialPage.tsx` ao lado do botão de favorito.

## DEB-074-04 — Notificação emitida por eventos existentes ainda não implementada

🟢 Fechado (2026-07-12). Novo helper `services/notify.ts` (`emitNotification`), chamado em `moderation.ts` (`/approve`, `/reject`, `/batch/:action` — approve/reject) e `reports.ts` (`PATCH /:id` quando `case_state` vira `resolved`/`dismissed`). `NotificacoesPage` agora recebe eventos reais. Teste `moderation.notify.test.ts` cobre a emissão.
