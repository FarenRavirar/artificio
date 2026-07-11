import { Request, Response } from 'express';
import { db } from '../config/database';
import { notifyTermOwnerOnComment } from '../services/notificationService';
import type { AuthedRequest } from '../types/express';

export const getCommentsByTerm = async (req: Request, res: Response) => {
  const { id: termId } = req.params;

  try {
    const result = await db.query(`
      SELECT
        c.id,
        c.body,
        c.parent_id,
        c.created_at,
        c.deleted,
        u.username as author_name,
        u.id as user_id
      FROM public.term_comments c
      JOIN public.users u ON c.user_id = u.id
      WHERE c.term_id = $1
      ORDER BY c.created_at ASC
    `, [termId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar comentários:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const createComment = async (req: AuthedRequest, res: Response) => {
  const { id: termId } = req.params;
  const { body, parent_id } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  if (!body || body.trim().length === 0) {
    return res.status(400).json({ error: 'O corpo do comentário não pode estar vazio' });
  }

  try {
    const result = await db.query(`
      INSERT INTO public.term_comments (term_id, user_id, body, parent_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id, body, parent_id, created_at
    `, [termId, userId, body.trim(), parent_id || null]);

    const createdComment = result.rows[0];
    try {
      await notifyTermOwnerOnComment({
        termId: String(termId),
        actorId: String(userId),
        commentId: String(createdComment.id),
        body: String(createdComment.body ?? body),
      });
    } catch (notifyError) {
      console.error('[notifications] Falha ao gerar notificação de comentário:', notifyError);
    }

    res.status(201).json(createdComment);
  } catch (error) {
    console.error('Erro ao criar comentário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

export const deleteComment = async (req: AuthedRequest, res: Response) => {
  const { id: commentId } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  try {
    // Verificar se o comentário existe e se o usuário tem permissão
    const findResult = await db.query('SELECT user_id FROM public.term_comments WHERE id = $1', [commentId]);

    if (findResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comentário não encontrado' });
    }

    const commentOwnerId = findResult.rows[0].user_id;

    if (userId !== commentOwnerId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para deletar este comentário' });
    }

    // Soft delete (definir deleted = true)
    await db.query('UPDATE public.term_comments SET deleted = true, body = \'[Este comentário foi removido pelo autor ou moderador]\' WHERE id = $1', [commentId]);

    res.json({ message: 'Comentário removido' });
  } catch (error) {
    console.error('Erro ao deletar comentário:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
