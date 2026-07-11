import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { publicRateLimiter } from '../middleware/rateLimit';
import { db } from '../db';
import type { NewTableSchedule, TableScheduleUpdate } from '../db/types';

const router = Router();

const VALID_DAYS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
const VALID_FREQUENCIES = ['semanal', 'quinzenal', 'mensal', 'avulsa'];

type OwnershipResult =
  | { ok: true }
  | { ok: false; status: 404 | 403; error: string };

// Achado Sonar (PR #145): checagem de ownership (buscar mesa -> buscar
// gm_profile -> comparar isOwner/isAdmin) duplicada em POST/PUT/DELETE.
// Extraido para reduzir complexidade cognitiva de cada handler e a
// duplicacao entre eles.
async function checkTableOwnership(tableId: string, userId: string, userRole: string | undefined): Promise<OwnershipResult> {
  const table = await db
    .selectFrom('tables')
    .select('gm_id')
    .where('id', '=', tableId)
    .executeTakeFirst();

  if (!table) {
    return { ok: false, status: 404, error: 'Mesa não encontrada' };
  }

  const gmProfile = await db
    .selectFrom('gm_profiles')
    .select('id')
    .where('user_id', '=', userId)
    .executeTakeFirst();

  const isOwner = gmProfile?.id === table.gm_id;
  const isAdmin = userRole === 'admin';

  if (!isOwner && !isAdmin) {
    return { ok: false, status: 403, error: 'Sem permissão para editar esta mesa' };
  }

  return { ok: true };
}

function validateScheduleFields(input: { day_of_week?: string; frequency?: string }): string | null {
  if (input.day_of_week && !VALID_DAYS.includes(input.day_of_week)) {
    return 'day_of_week inválido. Valores aceitos: ' + VALID_DAYS.join(', ');
  }
  if (input.frequency && !VALID_FREQUENCIES.includes(input.frequency)) {
    return 'frequency inválido. Valores aceitos: ' + VALID_FREQUENCIES.join(', ');
  }
  return null;
}

function buildScheduleUpdateData(input: Partial<TableScheduleUpdate>): Partial<TableScheduleUpdate> {
  const updateData: Partial<TableScheduleUpdate> = {};
  const fields: Array<keyof TableScheduleUpdate> = [
    'day_of_week', 'start_time', 'end_time', 'frequency',
    'slots_per_session', 'is_ongoing', 'notes', 'sort_order',
  ];
  for (const field of fields) {
    if (input[field] !== undefined) {
      (updateData as Record<string, unknown>)[field] = input[field];
    }
  }
  return updateData;
}

/**
 * GET /api/v1/tables/:tableId/schedules
 * Listar todos os horários de uma mesa
 * Público (não requer autenticação)
 */
router.get('/:tableId/schedules', publicRateLimiter, async (req, res) => {
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
router.post('/:tableId/schedules', publicRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tableId } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    const input: Partial<NewTableSchedule> = req.body;

    const ownership = await checkTableOwnership(tableId, userId, userRole);
    if (!ownership.ok) {
      return res.status(ownership.status).json({ error: ownership.error });
    }

    if (!input.day_of_week || !input.start_time || !input.frequency) {
      return res.status(400).json({
        error: 'Campos obrigatórios: day_of_week, start_time, frequency'
      });
    }

    const fieldError = validateScheduleFields(input);
    if (fieldError) {
      return res.status(400).json({ error: fieldError });
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
router.put('/:tableId/schedules/:id', publicRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tableId, id } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    const input: Partial<TableScheduleUpdate> = req.body;

    const ownership = await checkTableOwnership(tableId, userId, userRole);
    if (!ownership.ok) {
      return res.status(ownership.status).json({ error: ownership.error });
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

    const fieldError = validateScheduleFields(input);
    if (fieldError) {
      return res.status(400).json({ error: fieldError });
    }

    const updateData = buildScheduleUpdateData(input);

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
router.delete('/:tableId/schedules/:id', publicRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  try {
    const { tableId, id } = req.params;
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const ownership = await checkTableOwnership(tableId, userId, userRole);
    if (!ownership.ok) {
      return res.status(ownership.status).json({ error: ownership.error });
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
