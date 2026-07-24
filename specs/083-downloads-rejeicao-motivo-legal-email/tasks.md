# Tasks — Spec 083 (Downloads: rejeição estruturada + e-mail)

## F0 — Preparação

- [ ] T0.1 — Confirmar specs 072/075 localmente verdes (rodar suíte atual antes de tocar código novo).
- [ ] T0.2 — Mantenedor verifica domínio de envio no painel Resend (SPF/DKIM) antes da Fase 5 — sem isso e-mail real cai em spam/é rejeitado.
- [ ] T0.3 — Atualizar `specs/backlog.md`/`project-state.md` ao abrir esta spec (regra do `specs/README.md`).

## F1 — Schema

- [ ] T1.1 — `migration_021_download_rejection_category.sql`: tabela + seed de categorias (direitos autorais, plágio, link quebrado, link malicioso, duplicado, conteúdo impróprio/faixa etária, spam/fora de escopo, violação de termos de terceiros, dados pessoais/LGPD, metadados incompletos, outro).
- [ ] T1.2 — `migration_022_download_material_rejection_category.sql`: `rejection_category_id` em `download_material`.
- [ ] T1.3 — `migration_023_download_email_log.sql`: tabela `download_email_log`.
- [ ] T1.4 — Atualizar `db/types.ts` com as tabelas/coluna novas.

## F2 — Backend: categoria (CRUD admin)

- [ ] T2.1 — `routes/rejectionCategories.ts`: `GET/POST/PATCH /admin/rejection-categories`.
- [ ] T2.2 — Validação: `slug` imutável em PATCH (400 se body tentar mudar); `active=false` não bloqueia leitura histórica.

## F3 — `accounts.` rota interna + client em downloads

- [ ] T3.1 — `accounts.`: `GET /internal/users/:id` com middleware de secret compartilhado + rate-limit próprio + log de acesso. **Requer aprovação nominal + smoke SSO completo antes de mergear** (trava pétrea packages/auth).
- [ ] T3.2 — `downloads/backend/services/accountsClient.ts`: `resolveUserEmail`, timeout 2s, retorna `null` em qualquer falha, log do motivo.
- [ ] T3.3 — Variáveis novas documentadas (`.env.example` de ambos os apps): `ACCOUNTS_INTERNAL_URL`, `INTERNAL_SERVICE_SECRET`.

## F4 — Pacote `@artificio/email`

- [ ] T4.1 — `packages/email/`: client Resend fino, `sendEmail({ to, subject, html, tags })`.
- [ ] T4.2 — `MaterialRejectedEmail`/`MaterialApprovedEmail`: funções puras (subject + html), testáveis sem rede.

## F5 — Integração no fluxo de moderação

- [ ] T5.1 — `POST /moderation/:id/reject` e `PATCH /moderation/batch/reject`: exige `rejection_category_id` válido/ativo + `reason`.
- [ ] T5.2 — `services/moderationEmail.ts`: resolveUserEmail → sendEmail → grava `download_email_log`, 1 retry com backoff 30s, nunca bloqueia resposta HTTP da rota de moderação.
- [ ] T5.3 — `approve` (individual e batch) também dispara e-mail via `moderationEmail.ts`.
- [ ] T5.4 — Reenvio (`POST /:id/submit`) limpa `rejection_category_id` junto com `rejection_reason`.

## F6 — Admin UI

- [ ] T6.1 — Tela de reprovação em `/gestao/moderacao`: select de categoria (exibe `legal_basis`) + textarea motivo, ambos obrigatórios.
- [ ] T6.2 — Listagem de `download_email_log` com botão "Reenviar" (`POST /admin/email-log/:id/retry`) para status `failed`/`skipped_no_email`.
- [ ] T6.3 — Badge "e-mail não enviado" na fila/ficha do material quando log mais recente está falho/skip.

## F7 — Validação

- [ ] T7.1 — `moderationEmail.test.ts`: sucesso, accounts fora do ar, Resend fora do ar com retry, usuário sem e-mail.
- [ ] T7.2 — Teste de rota interna `accounts.`: sem secret (401), secret errado (401/403), secret certo (200 + shape).
- [ ] T7.3 — Teste `rejectionCategories.ts`: slug imutável, inativa não lista mas resolve em histórico.
- [ ] T7.4 — `pnpm verify:api` (downloads + accounts).
- [ ] T7.5 — lint + build + test nos dois apps tocados.
- [ ] T7.6 — Smoke manual em beta: reprovar material real (e-mail chega ou log de falha aparece), aprovar material real (e-mail chega).
- [ ] T7.7 — Atualizar `specs/backlog.md`/`project-state.md` ao fechar esta spec.
