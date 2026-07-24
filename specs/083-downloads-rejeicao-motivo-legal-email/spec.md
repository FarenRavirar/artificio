# Spec 083 — Downloads: rejeição com motivo estruturado (categoria legal BR) + notificação por e-mail

## Origem

Pedido direto do mantenedor (2026-07-23): fluxo de aprovação hoje existe (spec 072/075), mas a reprovação só grava texto livre em `rejection_reason` e notifica só via feed in-app (`download_notification`, migration_018 — que já registra explicitamente "sem envio externo (email/push)" como decisão da época). O pedido evolui isso em dois eixos: (1) motivo de reprovação estruturado por categoria (incluindo enquadramento legal brasileiro), não só texto livre; (2) autor recebe e-mail explicando o motivo. Decisão do mantenedor (2026-07-23): a mesma infraestrutura de envio cobre também o e-mail de aprovação, já que o custo marginal de incluir é baixo frente a criar um segundo fluxo depois.

## Pré-requisito

Depende de:
- Spec 072 (`rejection_reason`, máquina de estados editorial, `POST /moderation/:id/reject`/`approve`, ações batch).
- Spec 075 (`emitNotification`/`download_notification`, painel de gestão `/gestao/moderacao`, `/gestao/links` como referência de UI admin).
- `packages/auth` (JWT/SSO) e o serviço `accounts.` (login central) — esta spec **exige mudança em `accounts.`** para expor e-mail do autor a `downloads` (ver Escopo). Mudança em `accounts.` segue a trava pétrea de AGENTS.md (SSO é sagrado: aprovação + smoke de login/me/logout + todos os consumidores).

## Objetivo

Quando um moderador reprova um material, o motivo precisa ser estruturado (categoria fixa + campo de texto complementar), auditável, e o autor precisa ser avisado por e-mail com o motivo em linguagem clara — não só descobrir ao acessar o painel dias depois. Aprovação ganha o mesmo canal de e-mail, reaproveitando a mesma infraestrutura de envio.

## Escopo

### Categoria de rejeição (config via admin)

- Nova tabela `download_rejection_category` (CRUD via admin, `role IN ('moderator','admin')` pode gerenciar): `id`, `slug` (imutável após criação, usado em auditoria/relatório), `label` (nome exibido ao moderador), `legal_basis` (referência normativa curta, ex.: "Lei 9.610/98 — Direitos Autorais", nullable para categorias não-jurídicas como "Link quebrado"), `email_template_key` (referencia qual bloco de texto o e-mail usa — ver Templates), `active` (soft-disable sem quebrar histórico), `created_at`/`updated_at`.
- Seed inicial (migration com `INSERT ... ON CONFLICT DO NOTHING`) cobrindo as categorias identificadas na pesquisa: violação de direitos autorais (Lei 9.610/98), plágio/atribuição indevida, link quebrado/inacessível, link malicioso/inseguro, conteúdo duplicado, conteúdo impróprio/faixa etária incorreta, spam/fora de escopo, violação de termos de uso de terceiros, dados pessoais indevidos (LGPD), metadados incompletos/inconsistentes, outro (com texto livre obrigatório).
- `download_material.rejection_reason` (TEXT, já existe) passa a ser só o campo de texto complementar; nova coluna `rejection_category_id` (FK para `download_rejection_category`, NOT NULL quando `editorial_state='rejected'`, NULL nos demais estados).
- `POST /moderation/:id/reject` e `PATCH /moderation/batch/reject` passam a exigir `rejection_category_id` (obrigatório) + `reason` (texto complementar, continua obrigatório — resolve ambiguidade "categoria X mas por quê especificamente").
- Reenvio (spec 072 T4.4, `POST /:id/submit`) já limpa `rejection_reason`; passa a limpar também `rejection_category_id`.
- Admin CRUD de categorias: `GET/POST/PATCH /admin/rejection-categories` (mesmo padrão de outras rotas admin da spec 075). Categoria com `active=false` continua utilizável em histórico (nunca deletada fisicamente — mesma regra de auditoria já usada em `download_material_version`), só some da lista ativa ao reprovar novo material.

### Resolução de e-mail do autor (mudança em `accounts.`)

- **Achado de investigação**: `downloads` não persiste e-mail — SSO é via `accounts.`, e-mail só existe no JWT de quem está autenticado na requisição atual, nunca do autor de um material de terceiros. Não existe hoje nenhuma rota server-to-server para resolver e-mail por `user_id`.
- Nova rota interna em `accounts.`: `GET /internal/users/:id` — autenticada por secret compartilhado via header (`X-Internal-Service-Secret`, env `INTERNAL_SERVICE_SECRET`, nunca exposta a frontend), retorna `{ id, email, display_name }` ou 404. Rate-limit próprio (não é rota pública). Auditoria de acesso (log de qual serviço consultou qual `user_id`, sem persistir em tabela nova — log estruturado basta, mesmo padrão de `moderationAuditLog`).
- `downloads/backend` ganha client HTTP fino (`services/accountsClient.ts`) chamando essa rota, com timeout curto (2s) e tratamento explícito de falha (ver Edge cases).
- Alternativa descartada nesta spec (registrar em `plan.md` o porquê): cache local de e-mail em `download_creator` foi rejeitado pelo mantenedor — e-mail pode mudar na conta Google e o cache ficaria stale sem mecanismo de invalidação: rota sob demanda é sempre a fonte corrente.

### Envio de e-mail (infraestrutura nova — Resend)

- Novo pacote `@artificio/email` (compartilhado — motivo: qualquer app pode precisar de e-mail transacional depois, não só downloads; evita reimplementação como aconteceu com `@artificio/media`) com client Resend fino: `sendEmail({ to, subject, react/html, tags })`.
- Variáveis novas: `RESEND_API_KEY` (secret), `EMAIL_FROM_ADDRESS` (ex.: `no-reply@artificiorpg.com` — **checar antes de configurar**: domínio precisa estar verificado no Resend, senão envio falha silenciosamente para alguns provedores de e-mail destino).
- Dois templates (React Email ou HTML simples — decisão em `plan.md`): `MaterialRejectedEmail` (categoria + motivo + link "Editar e reenviar") e `MaterialApprovedEmail` (link do material publicado).
- Envio é **assíncrono em relação à resposta HTTP** da rota de moderação: a rota nunca falha/atrasa por causa do e-mail (mesmo padrão já usado para `emitNotification`, que já é try/catch isolado). Diferença importante: **falha de e-mail precisa ficar visível em algum lugar**, diferente da notificação in-app que é best-effort silencioso hoje — ver Confiabilidade de envio.

### Confiabilidade de envio (sem caminho feliz)

- Nova tabela `download_email_log`: `id`, `user_id`, `material_id`, `kind` (`material_rejected`/`material_approved`), `to_email`, `status` (`sent`/`failed`/`skipped_no_email`), `provider_message_id` (nullable, id retornado pelo Resend em sucesso), `error_detail` (nullable), `attempts` (INT), `created_at`, `last_attempt_at`. Toda tentativa de envio grava uma linha, sucesso ou falha — isso é o que torna a falha auditável em vez de só um `console.error` perdido em log de container.
- Retry: 1 retentativa automática com backoff curto (ex.: 30s) se a chamada ao Resend falhar por erro transitório (timeout/5xx); se a segunda tentativa falhar, marca `status='failed'` e para — não fica em loop indefinido. Reenvio manual pelo admin é um botão em `/gestao/moderacao` (ou tela nova) que chama `POST /admin/email-log/:id/retry`.
- Se `accountsClient` não retornar e-mail (404, timeout, `INTERNAL_SERVICE_SECRET` divergente): grava `download_email_log` com `status='skipped_no_email'`, loga erro server-side, **mas não bloqueia a transição de estado do material** — moderação não pode ficar refém de e-mail. Painel de gestão mostra badge "e-mail não enviado" no material afetado.
- Idempotência: reenvio do mesmo material (rejeitado → editado → reenviado → rejeitado de novo) gera nova linha em `download_email_log`, nunca reaproveita/atualiza a antiga — histórico completo de todas as tentativas, mesmo padrão de "nunca apagar histórico" já usado em `download_material_version`.

### Auditoria e LGPD

- `logModerationAudit` (já existente) passa a registrar também `rejection_category_id`/`rejection_category_slug` no evento de `reject`, não só o texto livre.
- E-mail contém dado pessoal (endereço de e-mail, nome) tratado apenas para a finalidade de notificação transacional — não é marketing, não precisa de opt-in LGPD (base legal: execução de contrato/interesse legítimo, já coberto pelos termos de uso do submissão de material). Isso precisa estar documentado em `plan.md` como decisão registrada, não assumido implicitamente.
- `download_email_log.to_email` é dado pessoal — retenção segue a mesma política do restante do banco (sem TTL automático nesta spec; TTL de log é debito possível, registrar se não for feito).

## Fora de escopo

- Editor de template de e-mail pela UI admin (`email_template_key` é fixo no código nesta rodada; troca de copy exige deploy, não é dado editável em runtime).
- E-mail de outros eventos (denúncia resolvida, comentário removido, etc.) — só reject/approve nesta spec.
- Internacionalização do e-mail (só PT-BR).
- Webhook de status de entrega do Resend (bounce/complaint) — fica como débito explícito (ver `debitos.md`), pois exige endpoint público novo + validação de assinatura do provider, escopo maior que esta spec.
- Mudança de fila/worker dedicado para envio (roda inline no processo do backend downloads, mesmo padrão do link checker agendado da spec 082) — se o volume crescer a ponto de precisar de fila real (SQS/BullMQ), é decisão futura.

## Critérios de aceite

1. Reprovação (individual ou batch) exige categoria (`rejection_category_id`) e motivo complementar (`reason`); backend rejeita payload sem os dois com 400.
2. Categoria carrega enquadramento legal (`legal_basis`) quando aplicável, exibido ao moderador na tela de reprovação antes de confirmar.
3. Autor recebe e-mail com categoria + motivo em linguagem clara, dentro de tentativa registrada em `download_email_log`, mesmo se o envio falhar (log de tentativa existe de qualquer forma).
4. Falha ao resolver e-mail do autor (`accounts.` fora do ar, usuário sem e-mail) não impede a transição de estado do material — só marca `skipped_no_email` e sinaliza no painel.
5. Aprovação também dispara e-mail, mesma infraestrutura, mesmo comportamento de log/falha não-bloqueante.
6. Reenvio de material (rejeitado → editado → reenviado) limpa `rejection_category_id` junto com `rejection_reason`.
7. Categoria desativada (`active=false`) nunca aparece pra nova reprovação, mas não quebra a leitura de material já reprovado com aquela categoria no passado.
8. `accounts.` expõe rota interna server-to-server autenticada por secret, nunca acessível publicamente sem o header correto (teste de rota retorna 401/403 sem secret).
9. Reenvio manual de e-mail falhado (`POST /admin/email-log/:id/retry`) funciona e atualiza o log existente com nova tentativa.
10. Todo envio (sucesso ou falha) é auditável via `download_email_log` — nenhum envio "silencioso" sem rastro.

## Dependências

- Specs 072, 075.
- Mudança em `accounts.`: segue trava pétrea de `packages/auth`/SSO (aprovação nominal + SDD Completo + smoke de login/me/logout + todos os consumidores SSO, mesmo sendo só uma rota nova server-to-server — qualquer código em `accounts.`/auth entra nessa trava).
- Pacote novo `@artificio/email`: dependência nova (Resend SDK) — segue regra pétrea de "perguntar antes de instalar" já respondida nesta sessão (decisão do mantenedor 2026-07-23: Resend).
- Bloqueia: nenhuma spec depende desta para avançar: é aditiva ao fluxo de moderação já em produção.
