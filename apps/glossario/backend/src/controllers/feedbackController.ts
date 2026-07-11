import { Request, Response } from 'express';
import { db } from '../config/database';
import { parseFeedbackInput } from '../validators/feedbackValidator';
import {
  isCloudinaryConfigured,
  uploadScreenshotToCloudinary,
  deleteFromCloudinary,
} from '../services/cloudinary';
import type { AuthedRequest } from '../types/express';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUS = new Set(['new', 'triaged', 'in_progress', 'resolved', 'wont_fix', 'duplicate']);
const VALID_KIND = new Set(['bug', 'suggestion']);

/**
 * POST /api/feedback — relato de problema/sugestao (publico, anonimo permitido).
 * Spec 021. Upload de screenshot e nao-fatal: falha grava sem imagem (FR-006).
 */
export const submitFeedback = async (req: AuthedRequest, res: Response) => {
  try {
    const parsed = parseFeedbackInput(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }
    const input = parsed.value;

    const user = req.user;
    const userId: string | null = user?.id ?? null;
    const reporterRole: string = user?.role ?? 'visitor';

    let screenshotUrl: string | null = null;
    let screenshotPublicId: string | null = null;
    if (input.screenshot && isCloudinaryConfigured()) {
      try {
        const result = await uploadScreenshotToCloudinary(input.screenshot);
        screenshotUrl = result.secure_url;
        screenshotPublicId = result.public_id;
      } catch (error) {
        console.warn('[feedback] Falha no upload da captura; gravando sem imagem.', error);
      }
    }

    let created;
    try {
      const result = await db.query(
        `INSERT INTO public.dev_feedback
          (user_id, reporter_role, contact_email, kind, title, description,
           page_url, route_path, page_title, environment, user_agent, viewport,
           console_errors, network_errors, screenshot_url, screenshot_public_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,$16)
         RETURNING id, kind, status, created_at`,
        [
          userId,
          reporterRole,
          input.contact_email,
          input.kind,
          input.title,
          input.description,
          input.page_url,
          input.route_path,
          input.page_title,
          input.environment,
          input.user_agent,
          input.viewport,
          JSON.stringify(input.console_errors),
          JSON.stringify(input.network_errors),
          screenshotUrl,
          screenshotPublicId,
        ],
      );
      created = result.rows[0];
    } catch (dbError) {
      // Persistencia falhou: remove screenshot orfao antes de propagar.
      if (screenshotPublicId) await deleteFromCloudinary(screenshotPublicId);
      throw dbError;
    }

    return res.status(201).json({ data: created });
  } catch (error) {
    console.error('[POST /feedback]', error);
    return res.status(500).json({ error: 'Erro ao registrar feedback.' });
  }
};

/**
 * GET /api/admin/feedback?status=&kind=&archived= — lista para triagem (admin).
 */
export const listFeedback = async (req: Request, res: Response) => {
  try {
    const where: string[] = [];
    const params: unknown[] = [];

    const status = typeof req.query.status === 'string' ? req.query.status : '';
    if (VALID_STATUS.has(status)) {
      params.push(status);
      where.push(`f.status = $${params.length}`);
    }

    const kind = typeof req.query.kind === 'string' ? req.query.kind : '';
    if (VALID_KIND.has(kind)) {
      params.push(kind);
      where.push(`f.kind = $${params.length}`);
    }

    // Arquivados: por padrao escondidos. ?archived=true so arquivados; =all mostra tudo.
    const archived = typeof req.query.archived === 'string' ? req.query.archived : 'false';
    if (archived === 'true') {
      where.push('f.archived_at IS NOT NULL');
    } else if (archived !== 'all') {
      where.push('f.archived_at IS NULL');
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const result = await db.query(
      `SELECT f.*,
              COALESCE(NULLIF(TRIM(u.username), ''), split_part(u.email, '@', 1), 'Anonimo') AS reporter_name
         FROM public.dev_feedback f
         LEFT JOIN public.users u ON u.id = f.user_id
         ${whereSql}
        ORDER BY f.created_at DESC
        LIMIT 500`,
      params,
    );

    return res.json({ data: result.rows });
  } catch (error) {
    console.error('[GET /admin/feedback]', error);
    return res.status(500).json({ error: 'Erro ao listar feedbacks.' });
  }
};

/**
 * PATCH /api/admin/feedback/:id — status, notas e/ou arquivar.
 */
export const updateFeedback = async (req: AuthedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ error: 'Nao autenticado.' });

    const id = String(req.params.id ?? '');
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'ID invalido.' });

    const body = (req.body && typeof req.body === 'object') ? req.body as Record<string, unknown> : {};

    const sets: string[] = ['reviewed_by = $1', 'reviewed_at = NOW()', 'updated_at = NOW()'];
    const params: unknown[] = [adminId];

    if (typeof body.status === 'string') {
      if (!VALID_STATUS.has(body.status)) return res.status(400).json({ error: 'Status invalido.' });
      params.push(body.status);
      sets.push(`status = $${params.length}`);
    }

    if (typeof body.admin_notes === 'string') {
      const notes = body.admin_notes.trim();
      params.push(notes.length > 0 ? notes.slice(0, 4000) : null);
      sets.push(`admin_notes = $${params.length}`);
    }

    if (typeof body.archived === 'boolean') {
      sets.push(`archived_at = ${body.archived ? 'NOW()' : 'NULL'}`);
    }

    params.push(id);
    const result = await db.query(
      `UPDATE public.dev_feedback SET ${sets.join(', ')}
        WHERE id = $${params.length}
        RETURNING id, kind, title, status, admin_notes, updated_at, archived_at`,
      params,
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Feedback nao encontrado.' });
    return res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('[PATCH /admin/feedback/:id]', error);
    return res.status(500).json({ error: 'Erro ao atualizar feedback.' });
  }
};

/**
 * DELETE /api/admin/feedback/:id — remove registro + screenshot Cloudinary.
 */
export const deleteFeedback = async (req: AuthedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    if (!adminId) return res.status(401).json({ error: 'Nao autenticado.' });

    const id = String(req.params.id ?? '');
    if (!UUID_RE.test(id)) return res.status(400).json({ error: 'ID invalido.' });

    const found = await db.query(
      `SELECT id, screenshot_public_id FROM public.dev_feedback WHERE id = $1`,
      [id],
    );
    if (found.rows.length === 0) return res.status(404).json({ error: 'Feedback nao encontrado.' });

    const publicId: string | null = found.rows[0].screenshot_public_id ?? null;
    if (publicId) await deleteFromCloudinary(publicId);

    await db.query(`DELETE FROM public.dev_feedback WHERE id = $1`, [id]);
    return res.json({ data: { id } });
  } catch (error) {
    console.error('[DELETE /admin/feedback/:id]', error);
    return res.status(500).json({ error: 'Erro ao excluir feedback.' });
  }
};
