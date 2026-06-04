import { Router, Request, Response } from 'express';
import { optionalAuth } from '../middleware/auth';
import { strictRateLimiter } from '../middleware/rateLimit';
import { db } from '../db';
import { parseDevFeedbackInput } from '../validators/devFeedbackValidator';
import { uploadScreenshotToCloudinary, deleteFromCloudinary } from '../services/cloudinary';
import { notifyAdmins } from '../services/adminNotifications';
import { logActivity } from '../services/activityLogger';
import type { UserRole, DevFeedbackKind, DevFeedbackStatus } from '../db/types';

type CreatedDevFeedback = {
  id: string;
  kind: DevFeedbackKind;
  status: DevFeedbackStatus;
  created_at: Date;
};

const router = Router();

// POST /api/v1/dev-feedback - relato de problema ou sugestao (publico, anonimo permitido)
router.post('/', strictRateLimiter, optionalAuth, async (req: Request, res: Response) => {
  try {
    const parsed = parseDevFeedbackInput(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }
    const input = parsed.value;

    const userId = req.user?.userId ?? null;
    const reporterRole: string = req.user?.role ?? 'visitor';

    // Upload de screenshot e nao-fatal: falha grava o feedback sem imagem (FR-008).
    let screenshotUrl: string | null = null;
    let screenshotPublicId: string | null = null;
    if (input.screenshot) {
      try {
        const result = await uploadScreenshotToCloudinary(input.screenshot);
        screenshotUrl = result.secure_url;
        screenshotPublicId = result.public_id;
      } catch (error) {
        console.warn('[devFeedback] Falha no upload da captura de tela; gravando sem imagem.', error);
      }
    }

    let created: CreatedDevFeedback;
    try {
      created = await db
        .insertInto('dev_feedback')
        .values({
          user_id: userId,
          reporter_role: reporterRole,
          contact_email: input.contact_email,
          kind: input.kind,
          title: input.title,
          description: input.description,
          page_url: input.page_url,
          route_path: input.route_path,
          page_title: input.page_title,
          environment: input.environment,
          user_agent: input.user_agent,
          viewport: input.viewport,
          console_errors: JSON.stringify(input.console_errors),
          network_errors: JSON.stringify(input.network_errors),
          screenshot_url: screenshotUrl,
          screenshot_public_id: screenshotPublicId,
        })
        .returning(['id', 'kind', 'status', 'created_at'])
        .executeTakeFirstOrThrow();
    } catch (dbError) {
      // Persistencia falhou: remove screenshot orfao do Cloudinary antes de propagar.
      if (screenshotPublicId) {
        await deleteFromCloudinary(screenshotPublicId);
      }
      throw dbError;
    }

    // Notificacao e auditoria fora de transacao (regra reforcada do project-state).
    const kindLabel = input.kind === 'bug' ? 'Problema' : 'Sugestao';
    await notifyAdmins({
      type: 'dev_feedback',
      title: `Novo feedback de desenvolvimento (${kindLabel})`,
      message: `${input.title}${input.route_path ? ` — ${input.route_path}` : ''}`,
      action_url: '/gestao',
      metadata: {
        feedback_id: created.id,
        kind: input.kind,
        route_path: input.route_path,
      },
      excludeUserId: userId,
    });

    void logActivity({
      actorId: userId,
      actorRole: (req.user?.role as UserRole | undefined) ?? null,
      action: 'dev_feedback.created',
      entityType: 'dev_feedback',
      entityId: created.id,
      entityLabel: input.title,
      summary: `${kindLabel} reportado em ${input.route_path ?? 'pagina nao informada'}.`,
      metadata: {
        kind: input.kind,
        route_path: input.route_path,
        environment: input.environment,
        has_screenshot: Boolean(screenshotUrl),
        console_error_count: input.console_errors.length,
        network_error_count: input.network_errors.length,
      },
    });

    return res.status(201).json({ data: created });
  } catch (error: any) {
    console.error('[POST /dev-feedback]', error);
    return res.status(500).json({ error: 'Erro ao registrar feedback.' });
  }
});

export default router;
