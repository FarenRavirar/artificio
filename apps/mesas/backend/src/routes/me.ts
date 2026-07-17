import { Router, Request, Response } from 'express';
import { db } from '../db/index.js';
import { authMiddleware, optionalAuth } from '../middleware/auth.js';
import { flattenTree } from '../services/catalogClient.js';
import { getSystemCatalogProvider } from '../services/systemCatalogProvider.js';

const router = Router();

const sanitizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
};

const sanitizeNumberArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 6);
};

const getOnboardingCompleted = (preferences: { systems: string[] } | undefined): boolean => {
  return Array.isArray(preferences?.systems) && preferences.systems.length > 0;
};

// GET /api/v1/me — Perfil + preferências do usuário logado (ou null se anônimo)
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.json({ data: null }); // Usuário anônimo
  }

  try {
    const user = await db
      .selectFrom('users')
      .select(['id', 'email', 'role', 'privacy_public', 'created_at'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    const profile = await db
      .selectFrom('profiles')
      .select(['display_name', 'bio', 'languages', 'tags'])
      .where('user_id', '=', userId)
      .executeTakeFirst();

    const preferences = await db
      .selectFrom('user_preferences')
      .select(['systems', 'tags', 'languages', 'platforms', 'weekdays'])
      .where('user_id', '=', userId)
      .executeTakeFirst();

    const normalizedPreferences = {
      systems: preferences?.systems ?? [],
      tags: preferences?.tags ?? [],
      languages: preferences?.languages ?? [],
      platforms: preferences?.platforms ?? [],
      weekdays: preferences?.weekdays ?? [],
    };

    return res.json({
      data: {
        user,
        profile: profile ?? null,
        preferences: normalizedPreferences,
        onboarding_completed: getOnboardingCompleted(normalizedPreferences),
      },
    });
  } catch (error: unknown) {
    console.error('[GET /me]', error);
    return res.status(500).json({ error: 'Erro ao buscar dados do usuário.' });
  }
});

// GET /api/v1/me/options — Opções de taxonomia para onboarding
router.get('/options', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const [systemsTree, tags, platforms] = await Promise.all([
      getSystemCatalogProvider().loadTree(),
      db.selectFrom('tags').select(['id', 'name', 'slug']).orderBy('name', 'asc').execute(),
      db.selectFrom('platforms').select(['id', 'name', 'slug']).orderBy('name', 'asc').execute(),
    ]);
    const systemsFlat = flattenTree(systemsTree);

    return res.json({
      data: {
        systems: systemsFlat.map(({ children: _children, ...node }) => ({ ...node })),
        systems_tree: systemsTree,
        tags,
        platforms,
      },
    });
  } catch (error: unknown) {
    console.error('[GET /me/options]', error);
    return res.status(500).json({ error: 'Erro ao buscar opções de onboarding.' });
  }
});

// PUT /api/v1/me/preferences — Salva preferências e finaliza onboarding
router.put('/preferences', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Não autenticado.' });
  }

  const {
    display_name,
    bio,
    systems,
    tags,
    platforms,
    languages,
    weekdays,
  } = req.body;

  if (!display_name || typeof display_name !== 'string' || display_name.trim().length < 2) {
    return res.status(400).json({ error: 'Nome de exibição inválido.' });
  }

  const safeSystemsInput = sanitizeStringArray(systems);
  if (safeSystemsInput.length === 0) {
    return res.status(400).json({ error: 'Selecione ao menos 1 sistema favorito.' });
  }

  const safeTags = sanitizeStringArray(tags);
  const safePlatforms = sanitizeStringArray(platforms);
  const safeLanguages = sanitizeStringArray(languages);
  const safeWeekdays = sanitizeNumberArray(weekdays);

  try {
    const validIds = new Set((await getSystemCatalogProvider().loadFlat()).map((node) => node.id));
    const safeSystems = Array.from(new Set(safeSystemsInput.filter((id) => validIds.has(id))));

    if (safeSystems.length === 0) {
      return res.status(400).json({ error: 'Nenhum sistema válido foi selecionado.' });
    }

    await db.transaction().execute(async (trx) => {
      const profileExists = await trx
        .selectFrom('profiles')
        .select('id')
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (profileExists) {
        await trx
          .updateTable('profiles')
          .set({
            display_name: display_name.trim(),
            bio: typeof bio === 'string' ? bio.trim() : null,
            languages: safeLanguages,
          })
          .where('user_id', '=', userId)
          .execute();
      } else {
        await trx
          .insertInto('profiles')
          .values({
            user_id: userId,
            display_name: display_name.trim(),
            bio: typeof bio === 'string' ? bio.trim() : null,
            languages: safeLanguages,
          })
          .execute();
      }

      await trx
        .insertInto('user_preferences')
        .values({
          user_id: userId,
          systems: safeSystems,
          tags: safeTags,
          languages: safeLanguages,
          platforms: safePlatforms,
          weekdays: safeWeekdays,
        })
        .onConflict((oc) =>
          oc.column('user_id').doUpdateSet({
            systems: safeSystems,
            tags: safeTags,
            languages: safeLanguages,
            platforms: safePlatforms,
            weekdays: safeWeekdays,
          })
        )
        .execute();
    });

    return res.json({
      data: {
        onboarding_completed: true,
      },
    });
  } catch (error: unknown) {
    console.error('[PUT /me/preferences]', error);
    return res.status(500).json({ error: 'Erro ao salvar preferências.' });
  }
});

export default router;
