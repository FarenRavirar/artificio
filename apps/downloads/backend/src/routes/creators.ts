import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// T1.x (spec 075) — role real do usuario logado no dominio downloads
// (moderator/admin vem de download_creator.role; SSO so tem user|admin).
// Usado pelo frontend so pra decidir se mostra o link de /gestao — o backend
// ja valida de verdade em cada rota /admin/* via requireRole, isso e so UX.
// Rota fixa precisa vir antes de "/:slug" (Express casaria "me" como slug).
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  return res.json({ role: req.user!.role });
});

// T4.1 (spec 073) — perfil publico de criador, sem sessao. Aceita creditos
// sem conta associada (T3.2): user_id nullable desde migration_013
// (DEB-073-01) — NAO expoe user_id/role no JSON. Credito sem conta (user_id
// null) nao tem material proprio vinculado por creator_id (que referencia
// sempre um user real), entao a lista de materiais fica vazia nesse caso.
router.get('/:slug', async (req: Request, res: Response) => {
  const creator = await db
    .selectFrom('download_creator')
    .select(['id', 'user_id', 'slug', 'display_name', 'bio'])
    .where('slug', '=', req.params.slug)
    .executeTakeFirst();

  if (!creator) {
    return res.status(404).json({ error: 'Criador não encontrado.' });
  }

  const materials = creator.user_id
    ? await db
        .selectFrom('download_material')
        .select(['id', 'slug', 'title', 'summary', 'material_type'])
        .where('creator_id', '=', creator.user_id)
        .where('editorial_state', '=', 'published')
        .orderBy('created_at', 'desc')
        .execute()
    : [];

  return res.json({
    id: creator.id,
    slug: creator.slug,
    display_name: creator.display_name,
    bio: creator.bio,
    materials,
  });
});

export default router;
