import { Router, Request, Response } from 'express';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { TableRepository } from '../repositories/tableRepository';

const router = Router();

// PUT /api/v1/admin/tables/:id — Ações administrativas (status, covil, etc.)
router.put('/tables/:id', authMiddleware, async (req: Request, res: Response) => {
  const userRole = (req as any).user.role;
  const { id } = req.params;
  const { status, is_covil } = req.body;

  if (userRole !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }

  try {
    const updateData: any = {};
    if (status !== undefined) {
      const validStatuses = ['active', 'full', 'cancelled', 'ended'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status inválido. Valores: ${validStatuses.join(', ')}` });
      }
      updateData.status = status;
    }

    if (is_covil !== undefined) {
      updateData.is_covil = is_covil;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Nenhum dado para atualizar.' });
    }

    const [result] = await db
      .updateTable('tables')
      .set(updateData)
      .where('id', '=', id)
      .returning(['id', 'slug', 'title', 'status', 'is_covil'])
      .execute();

    return res.json({ data: result });
  } catch (error: any) {
    console.error('[PUT /admin/tables/:id]', error);
    return res.status(500).json({ error: 'Erro ao atualizar mesa.' });
  }
});

// DELETE /api/v1/admin/tables/:id — Exclusão administrativa de mesa
router.delete('/tables/:id', authMiddleware, async (req: Request, res: Response) => {
  const userRole = (req as any).user.role;
  const { id } = req.params;

  if (userRole !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores.' });
  }

  try {
    const existingTable = await db
      .selectFrom('tables')
      .select(['id', 'title'])
      .where('id', '=', id)
      .executeTakeFirst();

    if (!existingTable) {
      return res.status(404).json({ error: 'Mesa não encontrada.' });
    }

    await TableRepository.deleteTableWithRelations(id);

    return res.json({ data: { message: `Mesa administrativa "${existingTable.title}" excluída.` } });
  } catch (error: any) {
    console.error('[DELETE /admin/tables/:id]', error);
    return res.status(500).json({ error: 'Erro ao excluir mesa.' });
  }
});

export default router;
