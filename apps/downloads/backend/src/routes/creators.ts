import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { readRateLimiter, writeRateLimiter } from '../middleware/rateLimit';
import { sanitizeNullableUserMarkdown, sanitizeUserMarkdown } from '@artificio/content-editor/sanitize';
import { appendMaterialSlugSuffix, slugifyMaterialTitle } from '../services/materialSlug';

const router = Router();
const MAX_CREATOR_BIO_LENGTH = 2_000;
const MAX_CREATOR_SLUG_ATTEMPTS = 50;

const updateOwnProfileSchema = z.object({
  display_name: z.string().trim().min(1).max(120),
  bio: z.string().max(MAX_CREATOR_BIO_LENGTH).nullable(),
}).strict();

interface OwnCreatorProfile {
  slug: string;
  display_name: string;
  bio: string | null;
}

function toOwnCreatorProfile(creator: OwnCreatorProfile): OwnCreatorProfile {
  return {
    slug: creator.slug,
    display_name: creator.display_name,
    bio: sanitizeNullableUserMarkdown(creator.bio),
  };
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; constraint?: unknown };
  return candidate.code === '23505' && candidate.constraint === constraint;
}

async function updateCreatorProfile(
  userId: string,
  displayName: string,
  bio: string | null,
): Promise<OwnCreatorProfile> {
  return db
    .updateTable('download_creator')
    .set({ display_name: displayName, bio })
    .where('user_id', '=', userId)
    .returning(['slug', 'display_name', 'bio'])
    .executeTakeFirstOrThrow();
}

async function createCreatorProfile(
  userId: string,
  displayName: string,
  bio: string | null,
): Promise<OwnCreatorProfile> {
  const generated = slugifyMaterialTitle(displayName);
  const baseSlug = generated === 'material' ? 'criador' : generated;

  for (let attempt = 1; attempt <= MAX_CREATOR_SLUG_ATTEMPTS; attempt += 1) {
    const slug = attempt === 1 ? baseSlug : appendMaterialSlugSuffix(baseSlug, String(attempt));
    try {
      return await db
        .insertInto('download_creator')
        .values({ user_id: userId, slug, display_name: displayName, bio })
        .returning(['slug', 'display_name', 'bio'])
        .executeTakeFirstOrThrow();
    } catch (error) {
      if (!isUniqueViolation(error, 'idx_download_creator_slug')) throw error;
    }
  }

  throw new Error('Não foi possível gerar um endereço público único para o perfil.');
}

// Papel efetivo: admin/moderator vêm do accounts.; download_creator só pode
// acrescentar a capacidade de domínio publisher. Papel global local é legado.
// Usado pelo frontend so pra decidir se mostra o link de /gestao — o backend
// ja valida de verdade em cada rota /admin/* via requireRole, isso e so UX.
// Rota fixa precisa vir antes de "/:slug" (Express casaria "me" como slug).
router.get('/me', readRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const creator = await db
    .selectFrom('download_creator')
    .select(['slug', 'display_name', 'bio'])
    .where('user_id', '=', req.user!.userId)
    .executeTakeFirst();

  return res.json({
    role: req.user!.role,
    profile: creator ? toOwnCreatorProfile(creator) : null,
  });
});

// Spec 089 T9.2 — nome público e bio são editáveis; o slug nasce no primeiro
// salvamento e nunca entra no payload de atualização. Perfil ausente é criado
// aqui, sem transformar dados de conta SSO em campos públicos por inferência.
router.patch('/me', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const parsed = updateOwnProfileSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  const displayName = parsed.data.display_name;
  const trimmedBio = parsed.data.bio?.trim() || null;
  const bio = trimmedBio ? sanitizeUserMarkdown(trimmedBio) : null;
  const existing = await db
    .selectFrom('download_creator')
    .select(['slug', 'display_name', 'bio'])
    .where('user_id', '=', req.user!.userId)
    .executeTakeFirst();

  let profile: OwnCreatorProfile;
  if (existing) {
    profile = await updateCreatorProfile(req.user!.userId, displayName, bio);
  } else {
    try {
      profile = await createCreatorProfile(req.user!.userId, displayName, bio);
    } catch (error) {
      // Duas abas podem salvar o primeiro perfil ao mesmo tempo. O índice
      // parcial de user_id decide a corrida; a segunda requisição atualiza o
      // perfil que a primeira criou, sem gerar outro endereço.
      if (!isUniqueViolation(error, 'idx_download_creator_user')) throw error;
      profile = await updateCreatorProfile(req.user!.userId, displayName, bio);
    }
  }

  return res.json({ role: req.user!.role, profile: toOwnCreatorProfile(profile) });
});

// T4.1 (spec 073) — perfil publico de criador, sem sessao. Aceita creditos
// sem conta associada (T3.2): user_id nullable desde migration_013
// (DEB-073-01) — NAO expoe user_id/role no JSON. Credito sem conta (user_id
// null) nao tem material proprio vinculado por creator_id (que referencia
// sempre um user real), entao a lista de materiais fica vazia nesse caso.
router.get('/:slug', readRateLimiter, async (req: Request, res: Response) => {
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
    bio: sanitizeNullableUserMarkdown(creator.bio),
    materials,
  });
});

export default router;
