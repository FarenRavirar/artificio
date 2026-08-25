import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  slugifyPlatformName as slugify,
  normalizePlatformWebsiteUrl as normalizeWebsiteUrl,
  isPlatformUniqueViolation as isUniqueViolation,
  getPlatformErrorMessage as getErrorMessage,
} from '../utils/platformUtils.js';

const router = Router();

interface CommunicationPlatformPayload {
  name?: string;
  slug?: string;
  website_url?: string | null;
  sort_order?: number;
  is_active?: boolean;
  // Requisitos implicados (migration_162, spec 096 Fase 5): o admin edita os
  // flags que alimentam a auto-marcação no editor de anúncio. As colunas
  // existem em tabela exatamente porque o admin já edita o catálogo
  // (plan.md §Regras VTT → requisitos:486-487).
  implies_pc?: boolean;
  implies_microphone?: boolean;
  implies_camera?: boolean;
}

// GET /api/v1/communication-platforms — Catálogo público (somente ativos)
router.get('/', async (_req: Request, res: Response) => {
  try {
    const platforms = await db
      .selectFrom('communication_platforms')
      .select([
        'id',
        'name',
        'slug',
        'website_url',
        'sort_order',
        // Requisitos implicados (migration_162, spec 096 R3): o catálogo
        // público alimenta a auto-marcação "com o porquê" no editor.
        'implies_pc',
        'implies_microphone',
        'implies_camera',
      ])
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
      .select([
        'id',
        'name',
        'slug',
        'website_url',
        'is_active',
        'sort_order',
        'created_at',
        'updated_at',
        // Requisitos implicados (migration_162, spec 096 Fase 5): expostos
        // no CRUD para o admin editar.
        'implies_pc',
        'implies_microphone',
        'implies_camera',
      ])
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

  // Requisitos implicados (spec 096 Fase 5): validação ANTES da escrita —
  // flag que não é boolean derruba o pedido com 400 (entrada malformada não
  // pode ter efeito).
  if (payload.implies_pc !== undefined && typeof payload.implies_pc !== 'boolean') {
    return res.status(400).json({ error: 'implies_pc deve ser boolean.' });
  }
  if (payload.implies_microphone !== undefined && typeof payload.implies_microphone !== 'boolean') {
    return res.status(400).json({ error: 'implies_microphone deve ser boolean.' });
  }
  if (payload.implies_camera !== undefined && typeof payload.implies_camera !== 'boolean') {
    return res.status(400).json({ error: 'implies_camera deve ser boolean.' });
  }

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
        implies_pc: payload.implies_pc ?? false,
        implies_microphone: payload.implies_microphone ?? false,
        implies_camera: payload.implies_camera ?? false,
      })
      .returning([
        'id',
        'name',
        'slug',
        'website_url',
        'is_active',
        'sort_order',
        'created_at',
        'updated_at',
        'implies_pc',
        'implies_microphone',
        'implies_camera',
      ])
      .executeTakeFirst();

    return res.status(201).json({ data: created });
  } catch (error) {
    console.error('[POST /communication-platforms/admin]', error);

    const message = getErrorMessage(error);
    if (message === 'URL da plataforma inválida.') {
      return res.status(400).json({ error: message });
    }

    if (isUniqueViolation(error)) {
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
    } catch (error) {
      return res.status(400).json({ error: getErrorMessage(error) });
    }
  }

  if (payload.sort_order !== undefined) {
    if (!Number.isInteger(payload.sort_order)) {
      return res.status(400).json({ error: 'sort_order deve ser inteiro.' });
    }
    updateData.sort_order = payload.sort_order;
  }

  // Alinhamento com vttPlatforms.ts PUT (achado lateral Fase 5, spec 096):
  // is_active sem validação de tipo aceitava qualquer valor no update.
  if (payload.is_active !== undefined) {
    if (typeof payload.is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active deve ser boolean.' });
    }
    updateData.is_active = payload.is_active;
  }

  // Requisitos implicados (spec 096 Fase 5): validação ANTES da escrita,
  // mesmo padrão dos demais campos — só entra no updateData se definido
  // (mantém o PUT parcial, ex. handleToggleActive que envia só is_active).
  if (payload.implies_pc !== undefined) {
    if (typeof payload.implies_pc !== 'boolean') {
      return res.status(400).json({ error: 'implies_pc deve ser boolean.' });
    }
    updateData.implies_pc = payload.implies_pc;
  }
  if (payload.implies_microphone !== undefined) {
    if (typeof payload.implies_microphone !== 'boolean') {
      return res.status(400).json({ error: 'implies_microphone deve ser boolean.' });
    }
    updateData.implies_microphone = payload.implies_microphone;
  }
  if (payload.implies_camera !== undefined) {
    if (typeof payload.implies_camera !== 'boolean') {
      return res.status(400).json({ error: 'implies_camera deve ser boolean.' });
    }
    updateData.implies_camera = payload.implies_camera;
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'Nenhum campo válido para atualização.' });
  }

  try {
    const updated = await db
      .updateTable('communication_platforms')
      .set(updateData)
      .where('id', '=', id)
      .returning([
        'id',
        'name',
        'slug',
        'website_url',
        'is_active',
        'sort_order',
        'created_at',
        'updated_at',
        'implies_pc',
        'implies_microphone',
        'implies_camera',
      ])
      .executeTakeFirst();

    if (!updated) {
      return res.status(404).json({ error: 'Plataforma de comunicação não encontrada.' });
    }

    return res.json({ data: updated });
  } catch (error) {
    console.error('[PUT /communication-platforms/admin/:id]', error);

    if (isUniqueViolation(error)) {
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
