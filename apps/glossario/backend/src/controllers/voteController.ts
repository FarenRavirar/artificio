import { Request, Response } from 'express';
import { db } from '../config/database';
import { notifyTermOwnerOnVote } from '../services/notificationService';

export const upsertVote = async (req: Request, res: Response) => {
  const { id: termId } = req.params;
  const { direction } = req.body;
  const userId = (req as any).user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }

  if (!['up', 'down'].includes(direction)) {
    return res.status(400).json({ error: 'Direção do voto inválida' });
  }
  const safeDirection = direction as 'up' | 'down';

  try {
    // Upsert do voto (insert ou update se já existir)
    await db.query(`
      INSERT INTO public.term_votes (term_id, user_id, direction)
      VALUES ($1, $2, $3)
      ON CONFLICT (term_id, user_id)
      DO UPDATE SET direction = EXCLUDED.direction
    `, [termId, userId, safeDirection]);

    try {
      await notifyTermOwnerOnVote({ termId: String(termId), actorId: String(userId), direction: safeDirection });
    } catch (notifyError) {
      console.error('[notifications] Falha ao gerar notificação de voto:', notifyError);
    }

    // A trigger term_votes_score_sync no banco atualiza o score automaticamente
    const termResult = await db.query('SELECT vote_score FROM public.terms WHERE id = $1', [termId]);

    res.json({
      message: 'Voto registrado',
      vote_score: termResult.rows[0]?.vote_score || 0
    });
  } catch (error) {
    console.error('Erro ao votar:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};
