# Plan — Spec 083 (Downloads: rejeição estruturada + e-mail)

## Fase 0 — Preparação e decisões registradas

- Confirmar specs 072/075 localmente verdes.
- Decisões já fechadas pelo mantenedor (2026-07-23), registrar aqui para não redecidir:
  - Provedor de e-mail: **Resend** (DX simples, free tier suficiente para volume atual, suporta templates React).
  - Categoria: **enum configurável via admin** (nova tabela, não enum de código) — permite adicionar categoria sem deploy.
  - Escopo de e-mail: **reject + approve juntos** (mesma infra, custo marginal baixo).
  - Resolução de e-mail do autor: **nova rota interna em `accounts.`** (não cache local) — e-mail sempre corrente, sem invalidação a gerenciar.
- Verificar domínio de envio: `EMAIL_FROM_ADDRESS` precisa de domínio verificado no Resend (SPF/DKIM) antes do primeiro envio real — sem isso, e-mails caem em spam ou são rejeitados por alguns provedores (Gmail/Outlook validam DMARC). Ação: mantenedor verifica domínio `artificiorpg.com` (ou subdomínio `mail.artificiorpg.com`) no painel Resend antes da Fase 5.

## Fase 1 — Schema: categoria + log de e-mail

- `apps/downloads/database/migration_021_download_rejection_category.sql`: cria `download_rejection_category` + seed das ~10 categorias identificadas na pesquisa (ver spec.md).
- `apps/downloads/database/migration_022_download_material_rejection_category.sql`: adiciona `rejection_category_id` a `download_material` (FK, nullable).
- `apps/downloads/database/migration_023_download_email_log.sql`: cria `download_email_log`.
- Atualizar `apps/downloads/backend/src/db/types.ts` com as 2 tabelas novas + coluna nova.

## Fase 2 — Backend: categoria (CRUD admin)

- `apps/downloads/backend/src/routes/rejectionCategories.ts`: `GET /admin/rejection-categories` (lista, `active` filtrável), `POST` (cria), `PATCH /:id` (edita label/legal_basis/active — `slug` imutável após criação, 400 se tentar mudar).
- Reuso de `requireRole(['moderator','admin'])`, `writeRateLimiter`, mesmo padrão de `materialMetadata.ts`.

## Fase 3 — Backend: `accounts.` rota interna + client em downloads

- `accounts.`: nova rota `GET /internal/users/:id`, middleware de secret compartilhado (novo, não reusa `authMiddleware` de sessão — é serviço-a-serviço). Rate-limit próprio, log de acesso (qual serviço, qual user_id, sem persistir).
- **Trava**: mudança em `accounts.`/SSO exige aprovação nominal + smoke login/me/logout + todos os consumidores SSO antes de mergear, mesmo sendo rota nova isolada — não é "só uma rota", é código em superfície sagrada.
- `apps/downloads/backend/src/services/accountsClient.ts`: `resolveUserEmail(userId): Promise<{ email: string; displayName: string } | null>` — timeout 2s, retorna `null` em qualquer falha (não lança), loga o motivo (404 vs timeout vs secret inválido) para diagnóstico.
- Variável nova: `ACCOUNTS_INTERNAL_URL`, `INTERNAL_SERVICE_SECRET` (mesmo valor nos dois serviços, via `.env`/secrets do Actions — nunca commitado).

## Fase 4 — Pacote `@artificio/email`

- `packages/email/`: client fino sobre Resend SDK (`resend` npm), export `sendEmail({ to, subject, html, tags })`.
- Decisão de template: HTML inline simples (string template) nesta rodada — **não** `react-email` (dependência adicional só se o volume de templates justificar; 2 templates não justifica nova stack de renderização). Registrar como escolha consciente, revisitar se a lista de templates crescer.
- `MaterialRejectedEmail(params)` e `MaterialApprovedEmail(params)`: funções puras que retornam `{ subject, html }`, testáveis sem rede.

## Fase 5 — Integração no fluxo de moderação

- `POST /moderation/:id/reject` e `PATCH /moderation/batch/reject`: schema zod exige `rejection_category_id` (validar que existe e `active=true`) + `reason`.
- Novo serviço `services/moderationEmail.ts`: orquestra resolveUserEmail → sendEmail → grava `download_email_log`, com retry (1x, backoff 30s) encapsulado. Chamado de forma assíncrona (não bloqueia resposta HTTP) a partir de `reject`/`approve`/batch — mesmo ponto onde `emitNotification` já é chamado hoje.
- Reenvio (`POST /:id/submit`) limpa `rejection_category_id` junto com `rejection_reason`.

## Fase 6 — Admin: UI de categoria + reenvio de e-mail falho

- `/gestao/moderacao`: tela de reprovação ganha select de categoria (mostra `legal_basis` quando existir) + textarea de motivo complementar — ambos obrigatórios antes de habilitar o botão "Reprovar".
- Nova aba/seção (ou extensão de `/gestao/moderacao`) listando `download_email_log` com status, botão "Reenviar" para `status='failed'`/`skipped_no_email` chamando `POST /admin/email-log/:id/retry`.
- Badge "e-mail não enviado" na fila/ficha do material quando o log mais recente daquele material está `failed`/`skipped_no_email`.

## Fase 7 — Validação

- Testes unitários: `moderationEmail.test.ts` (mock de `accountsClient`/`sendEmail`, cobre: sucesso, accounts fora do ar, Resend fora do ar com retry, usuário sem e-mail).
- Teste de rota interna de `accounts.`: sem secret → 401; secret errado → 401/403; secret certo → 200 com shape esperado.
- Teste de `rejectionCategories.ts`: slug imutável, categoria inativa não aparece em listagem ativa mas resolve em join histórico.
- `pnpm verify:api` (rotas novas em downloads e accounts).
- lint + build + test nos dois apps tocados (`downloads`, `accounts`).
- Smoke manual: reprovar material real em beta, confirmar e-mail chega (ou log de falha aparece), aprovar material real, confirmar e-mail chega.

## Gate de saída

Fluxo de reprovação/aprovação com motivo estruturado e e-mail funcionando localmente/beta libera consideração de webhook de bounce/complaint como spec futura (fora de escopo aqui, ver `debitos.md`).
