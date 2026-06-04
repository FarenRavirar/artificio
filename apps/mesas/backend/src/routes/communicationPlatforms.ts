import { Router, Request, Response } from 'express';
import { db } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

interface CommunicationPlatformPayload {
  name?: string;
  slug?: string;
  website_url?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

const slugify = (value: string): string => (
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
);

const normalizeWebsiteUrl = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.toString();
  } catch {
    throw new Error('URL da plataforma inválida.');
  }
};

// GET /api/v1/communication-platforms — Catálogo público (somente ativos)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const platforms = await db
      .selectFrom('communication_platforms')
      .select(['id', 'name', 'slug', 'website_url', 'sort_order'])
      .where('is_active', '=', true)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
      .execute();

    return res.json({ data: platforms });
  } catch (error) {
    console.error('[GET /communication-platforms]', error);
    return res.status(500).json({ error: 'Erro ao buscar plataformas de comunicação.' });
  }
});

// GET /api/v1/communication-platforms/admin — Lista completa para administração
router.get('/admin', authMiddleware, requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const platforms = await db
      .selectFrom('communication_platforms')
      .select(['id', 'name', 'slug', 'website_url', 'is_active', 'sort_order', 'created_at', 'updated_at'])
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
      .execute();

    return res.json({ data: platforms });
  } catch (error) {
    console.error('[GET /communication-platforms/admin]', error);
    return res.status(500).json({ error: 'Erro ao buscar plataformas de comunicação.' });
  }
});

// POST /api/v1/communication-platforms/admin — Cria plataforma
router.post('/admin', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const payload = req.body as CommunicationPlatformPayload;
  const name = payload.name?.trim();

  if (!name || name.length < 2 || name.length > 100) {
    return res.status(400).json({ error: 'Nome da plataforma inválido (2-100 caracteres).' });
  }

  const slug = (payload.slug?.trim() || slugify(name));
  if (!slug || slug.length < 2 || slug.length > 100) {
    return res.status(400).json({ error: 'Slug da plataforma inválido.' });
  }

  const sortOrder = Number.isInteger(payload.sort_order) ? Number(payload.sort_order) : 0;

  try {
    const websiteUrl = normalizeWebsiteUrl(payload.website_url);

    const created = await db
      .insertInto('communication_platforms')
      .values({
        name,
        slug,
        website_url: websiteUrl,
        sort_order: sortOrder,
        is_active: payload.is_active ?? true,
      })
      .returning(['id', 'name', 'slug', 'website_url', 'is_active', 'sort_order', 'created_at', 'updated_at'])
      .executeTakeFirst();

    return res.status(201).json({ data: created });
  } catch (error: any) {
    console.error('[POST /communication-platforms/admin]', error);

    if (error.message === 'URL da plataforma inválida.') {
      return res.status(400).json({ error: error.message });
    }

    if (error.code === '23505') {
      return res.status(409).json({ error: 'Já existe plataforma com este nome ou slug.' });
    }

    return res.status(500).json({ error: 'Erro ao criar plataforma de comunicação.' });
  }
});

// PUT /api/v1/communication-platforms/admin/:id — Atualiza plataforma
router.put('/admin/:id', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const payload = req.body as CommunicationPlatformPayload;

  const updateData: Record<string, unknown> = {};

  if (payload.name !== undefined) {
    const name = payload.name?.trim();
    if (!name || name.length < 2 || name.length > 100) {
      return res.status(400).json({ error: 'Nome da plataforma inválido (2-100 caracteres).' });
    }
    updateData.name = name;
  }

  if (payload.slug !== undefined) {
    const slug = payload.slug.trim();
    if (!slug || slug.length < 2 || slug.length > 100) {
      return res.status(400).json({ error: 'Slug da plataforma inválido.' });
    }
    updateData.slug = slug;
  }

  if (payload.website_url !== undefined) {
    try {
      updateData.website_url = normalizeWebsiteUrl(payload.website_url);
    } catch (error: any) {
      return res.status(400).json({ error: error.message });
    }
  }

  if (payload.sort_order !== undefined) {
    if (!Number.isInteger(payload.sort_order)) {
      return res.status(400).json({ error: 'sort_order deve ser inteiro.' });
    }
    updateData.sort_order = payload.sort_order;
  }

  if (payload.is_active !== undefined) {
    updateData.is_active = payload.is_active;
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'Nenhum campo válido para atualização.' });
  }

  try {
    const updated = await db
      .updateTable('communication_platforms')
      .set(updateData)
      .where('id', '=', id)
      .returning(['id', 'name', 'slug', 'website_url', 'is_active', 'sort_order', 'created_at', 'updated_at'])
      .executeTakeFirst();

    if (!updated) {
      return res.status(404).json({ error: 'Plataforma de comunicação não encontrada.' });
    }

    return res.json({ data: updated });
  } catch (error: any) {
    console.error('[PUT /communication-platforms/admin/:id]', error);

    if (error.code === '23505') {
      return res.status(409).json({ error: 'Já existe plataforma com este nome ou slug.' });
    }

    return res.status(500).json({ error: 'Erro ao atualizar plataforma de comunicação.' });
  }
});

// DELETE /api/v1/communication-platforms/admin/:id — Remove plataforma não utilizada
router.delete('/admin/:id', authMiddleware, requireRole('admin'), async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const inUse = await db
      .selectFrom('tables')
      .select('id')
      .where('communication_platform_id', '=', id)
      .limit(1)
      .executeTakeFirst();

    if (inUse) {
      return res.status(409).json({
        error: 'Esta plataforma está vinculada a mesas. Desative-a em vez de remover.',
      });
    }

    const deleted = await db
      .deleteFrom('communication_platforms')
      .where('id', '=', id)
      .returning(['id', 'name'])
      .executeTakeFirst();

    if (!deleted) {
      return res.status(404).json({ error: 'Plataforma de comunicação não encontrada.' });
    }

    return res.json({ data: deleted });
  } catch (error) {
    console.error('[DELETE /communication-platforms/admin/:id]', error);
    return res.status(500).json({ error: 'Erro ao remover plataforma de comunicação.' });
  }
});

export default router;
