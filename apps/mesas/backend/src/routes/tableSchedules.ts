import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { db } from '../db';
import type { NewTableSchedule, TableScheduleUpdate } from '../db/types';

const router = Router();

/**
 * GET /api/v1/tables/:tableId/schedules
 * Listar todos os horários de uma mesa
 * Público (não requer autenticação)
 */
router.get('/:tableId/schedules', async (req, res) => {
  try {
    const { tableId } = req.params;
    
    const schedules = await db
      .selectFrom('table_schedules')
      .selectAll()
      .where('table_id', '=', tableId)
      .orderBy('sort_order', 'asc')
      .orderBy('day_of_week', 'asc')
      .orderBy('start_time', 'asc')
      .execute();
    
    res.json({ data: schedules });
  } catch (error) {
    console.error('Error fetching table schedules:', error);
    res.status(500).json({ error: 'Erro ao buscar horários da mesa' });
  }
});

/**
 * POST /api/v1/tables/:tableId/schedules
 * Criar novo horário para uma mesa
 * Requer autenticação: gm (owner) ou admin
 */
router.post('/:tableId/schedules', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tableId } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    const input: Partial<NewTableSchedule> = req.body;
    
    // Verificar se mesa existe
    const table = await db
      .selectFrom('tables')
      .select('gm_id')
      .where('id', '=', tableId)
      .executeTakeFirst();
    
    if (!table) {
      return res.status(404).json({ error: 'Mesa não encontrada' });
    }
    
    // Verificar ownership (gm owner ou admin)
    const gmProfile = await db
      .selectFrom('gm_profiles')
      .select('id')
      .where('user_id', '=', userId)
      .executeTakeFirst();
    
    const isOwner = gmProfile?.id === table.gm_id;
    const isAdmin = userRole === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para editar esta mesa' });
    }
    
    // Validações
    if (!input.day_of_week || !input.start_time || !input.frequency) {
      return res.status(400).json({ 
        error: 'Campos obrigatórios: day_of_week, start_time, frequency' 
      });
    }
    
    const validDays = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
    if (!validDays.includes(input.day_of_week)) {
      return res.status(400).json({ 
        error: 'day_of_week inválido. Valores aceitos: ' + validDays.join(', ') 
      });
    }
    
    const validFrequencies = ['semanal', 'quinzenal', 'mensal', 'avulsa'];
    if (!validFrequencies.includes(input.frequency)) {
      return res.status(400).json({ 
        error: 'frequency inválido. Valores aceitos: ' + validFrequencies.join(', ') 
      });
    }
    
    // Validar end_time > start_time (se preenchido)
    if (input.end_time && input.end_time <= input.start_time) {
      return res.status(400).json({ 
        error: 'end_time deve ser maior que start_time' 
      });
    }
    
    // Inserir
    const [schedule] = await db
      .insertInto('table_schedules')
      .values({
        table_id: tableId,
        day_of_week: input.day_of_week,
        start_time: input.start_time,
        end_time: input.end_time ?? null,
        frequency: input.frequency,
        slots_per_session: input.slots_per_session ?? null,
        is_ongoing: input.is_ongoing ?? false,
        notes: input.notes ?? null,
        sort_order: input.sort_order ?? 0
      })
      .returningAll()
      .execute();
    
    res.status(201).json({ data: schedule });
  } catch (error) {
    console.error('Error creating table schedule:', error);
    res.status(500).json({ error: 'Erro ao criar horário' });
  }
});

/**
 * PUT /api/v1/tables/:tableId/schedules/:id
 * Atualizar horário existente
 * Requer autenticação: gm (owner) ou admin
 */
router.put('/:tableId/schedules/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tableId, id } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    const input: Partial<TableScheduleUpdate> = req.body;
    
    // Verificar ownership
    const table = await db
      .selectFrom('tables')
      .select('gm_id')
      .where('id', '=', tableId)
      .executeTakeFirst();
    
    if (!table) {
      return res.status(404).json({ error: 'Mesa não encontrada' });
    }
    
    const gmProfile = await db
      .selectFrom('gm_profiles')
      .select('id')
      .where('user_id', '=', userId)
      .executeTakeFirst();
    
    const isOwner = gmProfile?.id === table.gm_id;
    const isAdmin = userRole === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para editar esta mesa' });
    }
    
    // Verificar se schedule existe e pertence à mesa
    const existingSchedule = await db
      .selectFrom('table_schedules')
      .select('id')
      .where('id', '=', id)
      .where('table_id', '=', tableId)
      .executeTakeFirst();
    
    if (!existingSchedule) {
      return res.status(404).json({ error: 'Horário não encontrado' });
    }
    
    // Validações (se campos forem fornecidos)
    if (input.day_of_week) {
      const validDays = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
      if (!validDays.includes(input.day_of_week)) {
        return res.status(400).json({ error: 'day_of_week inválido' });
      }
    }
    
    if (input.frequency) {
      const validFrequencies = ['semanal', 'quinzenal', 'mensal', 'avulsa'];
      if (!validFrequencies.includes(input.frequency)) {
        return res.status(400).json({ error: 'frequency inválido' });
      }
    }
    
    // Construir update dinâmico
    const updateData: Partial<TableScheduleUpdate> = {};
    
    if (input.day_of_week !== undefined) updateData.day_of_week = input.day_of_week;
    if (input.start_time !== undefined) updateData.start_time = input.start_time;
    if (input.end_time !== undefined) updateData.end_time = input.end_time;
    if (input.frequency !== undefined) updateData.frequency = input.frequency;
    if (input.slots_per_session !== undefined) updateData.slots_per_session = input.slots_per_session;
    if (input.is_ongoing !== undefined) updateData.is_ongoing = input.is_ongoing;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.sort_order !== undefined) updateData.sort_order = input.sort_order;
    
    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }
    
    const [updated] = await db
      .updateTable('table_schedules')
      .set(updateData)
      .where('id', '=', id)
      .returningAll()
      .execute();
    
    res.json({ data: updated });
  } catch (error) {
    console.error('Error updating table schedule:', error);
    res.status(500).json({ error: 'Erro ao atualizar horário' });
  }
});

/**
 * DELETE /api/v1/tables/:tableId/schedules/:id
 * Deletar horário
 * Requer autenticação: gm (owner) ou admin
 */
router.delete('/:tableId/schedules/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tableId, id } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Verificar ownership
    const table = await db
      .selectFrom('tables')
      .select('gm_id')
      .where('id', '=', tableId)
      .executeTakeFirst();
    
    if (!table) {
      return res.status(404).json({ error: 'Mesa não encontrada' });
    }
    
    const gmProfile = await db
      .selectFrom('gm_profiles')
      .select('id')
      .where('user_id', '=', userId)
      .executeTakeFirst();
    
    const isOwner = gmProfile?.id === table.gm_id;
    const isAdmin = userRole === 'admin';
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Sem permissão para editar esta mesa' });
    }
    
    // Deletar
    const result = await db
      .deleteFrom('table_schedules')
      .where('id', '=', id)
      .where('table_id', '=', tableId)
      .returning('id')
      .execute();
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Horário não encontrado' });
    }
    
    res.json({ message: 'Horário deletado com sucesso' });
  } catch (error) {
    console.error('Error deleting table schedule:', error);
    res.status(500).json({ error: 'Erro ao deletar horário' });
  }
});

export default router;
