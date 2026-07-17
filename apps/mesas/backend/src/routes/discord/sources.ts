import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { requireAdmin } from '../../middleware/auth.js';

const router = Router();

const createSourceSchema = z.object({
  // REV-050: validar guild_id e channel_id como snowflake Discord (dígitos)
  guild_id: z.string().regex(/^\d{5,30}$/, 'Servidor Discord inválido.'),
  channel_id: z.string().regex(/^\d{5,30}$/, 'Canal Discord inválido.'),
  channel_name: z.string().optional(),
  channel_type: z.enum(['text', 'announcement', 'forum']).optional(),
  enabled: z.boolean().optional(),
});

const updateSourceSchema = z.object({
  channel_name: z.string().optional(),
  channel_type: z.enum(['text', 'announcement', 'forum']).optional(),
  enabled: z.boolean().optional(),
});

// GET /sources
router.get('/', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const sources = await db
      .selectFrom('discord_import_sources')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute();
    return res.json({ data: sources });
  } catch (error: unknown) {
    console.error('[GET /admin/discord/sources]', error);
    return res.status(500).json({ error: 'Erro ao listar fontes.' });
  }
});

// POST /sources
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  const parsed = createSourceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: z.flattenError(parsed.error) });
  }
  try {
    const existing = await db
      .selectFrom('discord_import_sources')
      .select('id')
      .where('channel_id', '=', parsed.data.channel_id)
      .executeTakeFirst();
    if (existing) {
      return res.status(409).json({ error: 'Canal já cadastrado.' });
    }
    const [source] = await db
      .insertInto('discord_import_sources')
      .values({
        ...parsed.data,
        channel_type: parsed.data.channel_type ?? 'text',
      })
      .returningAll()
      .execute();
    return res.status(201).json({ data: source });
  } catch (error: unknown) {
    console.error('[POST /admin/discord/sources]', error);
    return res.status(500).json({ error: 'Erro ao criar fonte.' });
  }
});

// PATCH /sources/:id
router.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const parsed = updateSourceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Dados inválidos.', details: z.flattenError(parsed.error) });
  }
  if (Object.keys(parsed.data).length === 0) {
    return res.status(400).json({ error: 'Nenhum dado para atualizar.' });
  }
  try {
    const [source] = await db
      .updateTable('discord_import_sources')
      .set({ ...parsed.data, updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .execute();
    if (!source) return res.status(404).json({ error: 'Fonte não encontrada.' });
    return res.json({ data: source });
  } catch (error: unknown) {
    console.error('[PATCH /admin/discord/sources/:id]', error);
    return res.status(500).json({ error: 'Erro ao atualizar fonte.' });
  }
});

// DELETE /sources/:id
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const source = await db
      .selectFrom('discord_import_sources')
      .select('id')
      .where('id', '=', id)
      .executeTakeFirst();
    if (!source) return res.status(404).json({ error: 'Fonte não encontrada.' });
    await db.deleteFrom('discord_import_sources').where('id', '=', id).execute();
    return res.json({ data: { message: 'Fonte removida.' } });
  } catch (error: unknown) {
    console.error('[DELETE /admin/discord/sources/:id]', error);
    return res.status(500).json({ error: 'Erro ao remover fonte.' });
  }
});

export default router;
