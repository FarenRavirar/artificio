# Tasks — Spec 083 (Downloads: rejeição estruturada + e-mail)

## F0 — Preparação

- [x] T0.1 — Confirmado specs 072/075 localmente verdes antes de tocar código novo (suíte pré-existente 93/93 no início desta rodada).
- [ ] T0.2 — Mantenedor precisa verificar domínio de envio no painel Resend (SPF/DKIM) antes do primeiro envio real — sem isso e-mail cai em spam/é rejeitado. Fora de controle do agente (ação externa ao repo).
- [x] T0.3 — `specs/backlog.md`/`specs/README.md` atualizados na criação da spec (2026-07-23) e novamente no fechamento desta rodada.

## F1 — Schema

- [x] T1.1-T1.3 — `migration_021_download_rejection_reason_email.sql` (migration única, consolidada por pedido do mantenedor — schema de uma mesma feature/sessão não se fatia em vários arquivos, ver AGENTS.md §Migrations 2.1): tabela `download_rejection_category` + seed de 11 categorias (copyright, plagiarism, broken_link, malicious_link, duplicate, inappropriate_content, spam_off_topic, third_party_terms, personal_data, incomplete_metadata, other); `rejection_category_id` (FK nullable) em `download_material`; tabela `download_email_log` (status/attempts/provider_message_id/error_detail).
- [x] T1.4 — `db/types.ts`: `DownloadRejectionCategoryTable`, `DownloadEmailLogTable`, `rejection_category_id` em `DownloadMaterialTable`, ambas registradas em `Database`.

## F2 — Backend: categoria (CRUD admin)

- [x] T2.1 — `routes/rejectionCategories.ts`: `GET /admin/rejection-categories` (filtro `active`, default só ativas), `POST` (valida slug único, regex `[a-z0-9_]+`), `PATCH /:id` (404 se não existe).
- [x] T2.2 — `slug` rejeitado explicitamente no PATCH (400 "imutável") antes mesmo de tocar o banco; `active=false` é soft-disable (nunca `DELETE`), preservando join histórico com material já reprovado.

## F3 — `accounts.` rota interna + client em downloads

- [x] T3.1 — `accounts.`: `GET /internal/users/:id` em `app.ts`, reusa `SERVICE_SECRET`/`X-Service-Token` já existente (mesmo mecanismo de `adminSecretsRoutes.ts`, WS3) em vez de criar segredo novo redundante. Sem fallback de sessão admin (só serviço-a-serviço). `findUserById` novo em `users.ts`.
- [x] T3.2 — `downloads/backend/services/accountsClient.ts`: `resolveUserEmail`, timeout 2s (`AbortController`), `undici` explícito (mesmo padrão de `linkChecker.ts`), nunca lança — retorna `null` e loga motivo (404/timeout/config ausente).
- [x] T3.3 — `.env.example` de `accounts` e `downloads/backend` documentam `SERVICE_SECRET` (reused, não `INTERNAL_SERVICE_SECRET` como o plano original previa — nome ajustado para reusar variável já existente no projeto).

## F4 — Pacote `@artificio/email`

- [x] T4.1 — `packages/email/src/client.ts`: `sendEmail({ to, subject, html, tags })` sobre `resend` (`^4.8.0`, instalado via `rtk pnpm add`), lança em erro do provider (chamador decide retry/log).
- [x] T4.2 — `packages/email/src/templates.ts`: `materialRejectedEmail`/`materialApprovedEmail`, HTML inline com `escapeHtml` (evita XSS via nome/título/motivo no e-mail), 4 testes puros (`templates.test.ts`, sem rede).

## F5 — Integração no fluxo de moderação

- [x] T5.1 — `POST /moderation/:id/reject` e `PATCH /moderation/batch/reject`: `rejection_category_id` obrigatório no schema zod, resolvido e validado (`active=true`) antes de tocar a máquina de estados; 400 se ausente/inválida.
- [x] T5.2 — `services/moderationEmail.ts`: `resolveUserEmail` → `sendEmail` → grava `download_email_log`; 1 retry com backoff 30s em falha; `skipped_no_email` quando accounts. não resolve e-mail; nunca lança (chamador roda best-effort, mesmo padrão de `emitNotification`).
- [x] T5.3 — `approve` individual e batch disparam `sendModerationEmail` com `kind: 'material_approved'`.
- [x] T5.4 — `POST /:id/submit` (reenvio) limpa `rejection_category_id` junto com `rejection_reason`.

## F6 — Admin UI

- [x] T6.1 — `GestaoModeracaoPage.tsx`: select de categoria (mostra `legal_basis` abaixo quando existir) + input de motivo, ambos obrigatórios antes de reprovar (individual e batch); botão "Reprovar" por item adicionado (antes só existia "Aprovar" individual).
- [x] T6.2 — `EmailLogPanel.tsx` + `useAdminEmailLog`/`useRetryEmailLog`: lista `failed`/`skipped_no_email`, botão "Reenviar" chama `POST /admin/email-log/:id/retry` (rota nova, atualiza a MESMA linha de log — não duplica).
- [x] T6.3 — Decisão registrada: badge por item na fila (`in_review`) não faz sentido — fila nunca tem log de e-mail ainda (reject/approve só dispara e-mail ao SAIR de `in_review`). `EmailLogPanel` já cobre o sinal por material (título implícito via `material_id`), critério de aceite 4 (falha não bloqueia moderação) atendido pelo comportamento best-effort, não por um badge redundante.

## F7 — Validação

- [x] T7.1 — `services/moderationEmail.test.ts` (4 testes): skipped_no_email sem e-mail resolvido, sent na 1ª tentativa, retry após falha com `vi.advanceTimersByTimeAsync`, sem retry quando já teve sucesso.
- [x] T7.2 — `apps/accounts/src/internalUsers.test.ts` (5 testes): 401 sem token, 401 com token errado, 200 + shape correto, 404 usuário inexistente, 401 quando `SERVICE_SECRET` não configurado no servidor.
- [x] T7.3 — `routes/rejectionCategories.test.ts` (7 testes): filtro ativo/inativo, slug imutável rejeitado antes do banco, soft-disable, 404, slug inválido (regex), 409 slug duplicado.
- [x] T7.4 — `pnpm verify:api`: exit 0, breaking=0 em todos os apps (accounts +1 rota non-breaking, downloads +6 rotas non-breaking).
- [x] T7.5 — `tsc --noEmit` limpo em accounts/downloads-backend/downloads-frontend/packages/email; `eslint` limpo nos 4; `vite build` downloads-frontend ok; `tsc` build downloads-backend e packages/email ok. Testes: accounts 13/13, downloads-backend 93/93 (76 pré-existentes + 17 novos), packages/email 4/4.
- [ ] T7.6 — Smoke manual em beta (reprovar/aprovar material real, confirmar e-mail ou log de falha) — depende de deploy + T0.2 (domínio Resend verificado), fora do escopo desta rodada local.
- [x] T7.7 — `specs/backlog.md`/`project-state.md`: backlog atualizado nesta rodada (ver entrada `BL-083-...`); `project-state.md` não tocado por não haver mudança de gate/fase de programa (spec aditiva ao fluxo de moderação já em produção, sem afetar gates A/B/D).
