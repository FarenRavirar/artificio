import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import { sendEmail, materialApprovedEmail, materialRejectedEmail } from '@artificio/email';
import { resolveUserEmail } from '../services/accountsClient';

const router = Router();

// T6.2 (spec 083) — lista tentativas de envio, mais recentes primeiro. Admin
// usa para achar materiais com e-mail failed/skipped_no_email.
router.get('/', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), async (req: Request, res: Response) => {
  const statusFilter = typeof req.query.status === 'string' ? req.query.status : undefined;

  let query = db.selectFrom('download_email_log').selectAll().orderBy('created_at', 'desc').limit(200);
  if (statusFilter) {
    query = query.where('status', '=', statusFilter as 'sent' | 'failed' | 'skipped_no_email' | 'sending');
  }

  const items = await query.execute();
  return res.json({ items });
});

function frontendUrl(): string {
  return process.env.FRONTEND_URL ?? process.env.PUBLIC_SITE_URL ?? 'https://downloads.artificiorpg.com';
}

// T6.2 (spec 083) — reenvio manual do MESMO evento falho: atualiza a linha
// existente (attempts++/status/last_attempt_at), nunca cria linha nova para
// o mesmo log (reenvio de evento NOVO, ex.: material reenviado e reprovado
// de novo, ja cria linha propria em moderationEmail.ts).
router.post('/:id/retry', writeRateLimiter, authMiddleware, requireRole(['moderator', 'admin']), async (req: Request, res: Response) => {
  const log = await db
    .selectFrom('download_email_log')
    .selectAll()
    .where('id', '=', req.params.id)
    .executeTakeFirst();

  if (!log) {
    return res.status(404).json({ error: 'Log de e-mail não encontrado.' });
  }

  if (log.status === 'sent') {
    return res.status(409).json({ error: 'Este e-mail já foi enviado com sucesso.' });
  }

  if (log.status === 'sending') {
    return res.status(409).json({ error: 'Reenvio já em andamento para este log.' });
  }

  if (!log.material_id) {
    return res.status(409).json({ error: 'Log sem material associado — não é possível remontar o e-mail.' });
  }

  // Achado de review PR #193 (codeRabbit): checar material ANTES do claim —
  // se o claim acontecesse primeiro e o material nao existisse mais, o log
  // ficaria travado em 'sending' pra sempre (nenhum caminho reverte pra
  // failed/skipped_no_email nesse caso).
  const material = await db
    .selectFrom('download_material')
    .select(['id', 'title', 'slug', 'creator_id', 'rejection_reason', 'rejection_category_id'])
    .where('id', '=', log.material_id)
    .executeTakeFirst();

  if (!material) {
    return res.status(409).json({ error: 'Material associado não existe mais.' });
  }

  // Claim atomico (achado de review PR #192): so segue se ESTE request
  // transicionar failed/skipped_no_email -> sending. Retry concorrente do
  // mesmo log perde o WHERE (0 linhas afetadas) e retorna 409 sem enviar
  // e-mail duplicado.
  const claimed = await db
    .updateTable('download_email_log')
    .set({ status: 'sending', last_attempt_at: new Date() })
    .where('id', '=', log.id)
    .where('status', '!=', 'sending')
    .where('status', '!=', 'sent')
    .returningAll()
    .executeTakeFirst();

  if (!claimed) {
    return res.status(409).json({ error: 'Reenvio já em andamento ou concluído para este log.' });
  }

  const resolved = await resolveUserEmail(log.user_id);
  if (!resolved) {
    await db
      .updateTable('download_email_log')
      .set({ status: 'skipped_no_email', attempts: log.attempts + 1, last_attempt_at: new Date() })
      .where('id', '=', log.id)
      .execute();
    return res.status(409).json({ error: 'Não foi possível resolver e-mail do autor via accounts. novamente.' });
  }

  let built: { subject: string; html: string };
  if (log.kind === 'material_approved') {
    built = materialApprovedEmail({
      authorName: resolved.displayName,
      materialTitle: material.title,
      publicUrl: `${frontendUrl()}/materiais/${material.slug}`,
    });
  } else {
    const category = material.rejection_category_id
      ? await db
          .selectFrom('download_rejection_category')
          .select(['label', 'legal_basis'])
          .where('id', '=', material.rejection_category_id)
          .executeTakeFirst()
      : null;

    built = materialRejectedEmail({
      authorName: resolved.displayName,
      materialTitle: material.title,
      categoryLabel: category?.label ?? 'Não especificada',
      legalBasis: category?.legal_basis ?? null,
      reason: material.rejection_reason ?? '',
      editUrl: `${frontendUrl()}/painel/materiais/${material.id}/editar`,
    });
  }

  try {
    const sent = await sendEmail({ to: resolved.email, subject: built.subject, html: built.html, tags: { kind: log.kind, materialId: material.id } });
    const updated = await db
      .updateTable('download_email_log')
      .set({
        status: 'sent',
        to_email: resolved.email,
        provider_message_id: sent.messageId,
        error_detail: null,
        attempts: log.attempts + 1,
        last_attempt_at: new Date(),
      })
      .where('id', '=', log.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return res.json(updated);
  } catch (error: unknown) {
    const updated = await db
      .updateTable('download_email_log')
      .set({
        status: 'failed',
        to_email: resolved.email,
        error_detail: error instanceof Error ? error.message : String(error),
        attempts: log.attempts + 1,
        last_attempt_at: new Date(),
      })
      .where('id', '=', log.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    return res.status(502).json(updated);
  }
});

export default router;
