import { Router, Request, Response } from 'express';
import { sql, type Updateable, type Selectable } from 'kysely';
import { db } from '../db';
import type { TablesTable, TableSchedulesTable } from '../db/types';
import { authMiddleware } from '../middleware/auth';
import { resolveActorName } from '../services/actorNameResolver';
import crypto from 'crypto';
import {
  createTableSchema,
  updateTableSchema,
  CreateTableInput,
  UpdateTableInput,
  TableContact,
} from '../validators/tableValidators';
import { TableService } from '../services/tableService';
import { TableRepository } from '../repositories/tableRepository';
import { hydrateTableSystemFields, systemExistsInCatalog } from '../services/catalogClient';
import { BenchmarkService } from '../services/benchmarkService';
import { logActivity } from '../services/activityLogger';
import { notifyAdmins } from '../services/adminNotifications';
import { isValidEmail } from '../utils/validation';
import { triggerMetaScrape, triggerMetaScrapeOnPublish } from '../services/metaScrapeClient';

const router = Router();

const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://mesas.artificiorpg.com';

interface VttPlatformJson {
  id: string;
  name: string;
  slug: string;
  logo_filename: string | null;
  website_url: string | null;
}

/** Estreita erro de driver Postgres (pg) — código SQLSTATE + coluna, quando presentes. */
interface PgDriverError {
  code?: string;
  column?: string;
}

const getPgErrorCode = (error: unknown): string | undefined =>
  (error && typeof error === 'object' && 'code' in error)
    ? (error as PgDriverError).code
    : undefined;

const getPgErrorColumn = (error: unknown): string | undefined =>
  (error && typeof error === 'object' && 'column' in error)
    ? (error as PgDriverError).column
    : undefined;

// Achado Sonar (PR #145): tratamento de 23502/23503 duplicado entre POST e
// PUT /gm/tables. Extraido para reduzir duplicacao entre os dois handlers.
function mapPgConstraintErrorToStatus(error: unknown): { status: number; error: string } | null {
  const code = getPgErrorCode(error);
  if (code === '23502') {
    return { status: 400, error: `Campo obrigatório ausente: ${getPgErrorColumn(error) || 'desconhecido'}` };
  }
  if (code === '23503') {
    return { status: 400, error: 'Referência inválida nos dados enviados.' };
  }
  return null;
}

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// ============================================================================
// CONSTANTES
// ============================================================================

const METRIC_THROTTLE_WINDOWS = {
  view: 15 * 60 * 1000,
  click: 5 * 60 * 1000,
  contact: 30 * 60 * 1000,
  favorite: 24 * 60 * 60 * 1000,
} as const;

type MetricAction = keyof typeof METRIC_THROTTLE_WINDOWS;
type QuartileTag = 'q1' | 'q2' | 'q3' | 'q4';

function toQuartile(value: number, quartiles: { p25: number; p50: number; p75: number }): QuartileTag {
  if (value <= quartiles.p25) return 'q1';
  if (value <= quartiles.p50) return 'q2';
  if (value <= quartiles.p75) return 'q3';
  return 'q4';
}

function quartileLabel(quartile: QuartileTag): string {
  if (quartile === 'q1') return 'Abaixo da maioria';
  if (quartile === 'q2') return 'Na média da plataforma';
  if (quartile === 'q3') return 'Acima da maioria';
  return 'Entre as mais vistas';
}


function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp && typeof realIp === 'string') {
    return realIp.trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

function generateFingerprint(req: Request): string {
  const ip = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';
  const raw = `${ip}:${userAgent}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function shouldCountMetric(
  tableId: string,
  action: MetricAction,
  fingerprint: string
): Promise<boolean> {
  const windowMs = METRIC_THROTTLE_WINDOWS[action];
  const cutoff = new Date(Date.now() - windowMs);

  const recentEvent = await db
    .selectFrom('table_metric_events')
    .select('id')
    .where('table_id', '=', tableId)
    .where('action', '=', action)
    .where('fingerprint_hash', '=', fingerprint)
    .where('created_at', '>', cutoff)
    .executeTakeFirst();

  return !recentEvent;
}



// ============================================================================
// ROTAS DE GM PROFILE
// ============================================================================

// POST /api/v1/gm/profile — Cria perfil de mestre
router.post('/profile', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const {
    slug,
    nickname,
    bio_long,
    languages,
    specialties,
    badges,
    tagline,
    promo_badge_text,
    selling_points,
    closed_group_enabled,
    closed_group_systems,
    closed_group_description,
    closed_group_min_price_cents,
  } = req.body;

  if (!slug || typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug)) {
    return res.status(400).json({ error: 'Slug inválido. Use apenas letras minúsculas, números e hífens.' });
  }

  if (!nickname || typeof nickname !== 'string' || nickname.trim().length < 2 || nickname.trim().length > 40) {
    return res.status(400).json({ error: 'Nickname inválido. Use entre 2 e 40 caracteres.' });
  }

  const safeLanguages = Array.isArray(languages) ? languages.filter(v => typeof v === 'string') : [];
  const safeSpecialties = Array.isArray(specialties) ? specialties.filter(v => typeof v === 'string') : [];
  const safeBadges = Array.isArray(badges) ? badges.filter(v => typeof v === 'string') : [];
  const safeTagline = typeof tagline === 'string' ? tagline.trim().slice(0, 200) : null;
  const safePromoBadgeText = typeof promo_badge_text === 'string' ? promo_badge_text.trim().slice(0, 120) : null;
  const safeSellingPoints = Array.isArray(selling_points)
    ? selling_points.filter((point) => {
        if (!point || typeof point !== 'object') return false;
        const p = point as Record<string, unknown>;
        return (
          typeof p.icon === 'string' &&
          typeof p.title === 'string' &&
          typeof p.description === 'string'
        );
      })
    : [];
  const safeClosedGroupEnabled = typeof closed_group_enabled === 'boolean' ? closed_group_enabled : false;
  const safeClosedGroupSystems = Array.isArray(closed_group_systems)
    ? closed_group_systems.filter(
        (value) => typeof value === 'string' && /^[0-9a-fA-F-]{36}$/.test(value)
      )
    : [];
  const safeClosedGroupDescription = typeof closed_group_description === 'string' ? closed_group_description.trim() : null;
  const safeClosedGroupMinPriceCents =
    typeof closed_group_min_price_cents === 'number' && Number.isInteger(closed_group_min_price_cents) && closed_group_min_price_cents >= 0
      ? closed_group_min_price_cents
      : null;

  try {
    const existing = await db
      .selectFrom('gm_profiles')
      .select('id')
      .where('slug', '=', slug)
      .executeTakeFirst();

    if (existing) {
      return res.status(409).json({ error: 'Este slug de mestre já está em uso.' });
    }

    const [gmProfile] = await db
      .insertInto('gm_profiles')
      .values({
        user_id: userId,
        slug,
        nickname: nickname.trim(),
        bio_long: bio_long ?? null,
        languages: safeLanguages,
        specialties: safeSpecialties,
        badges: safeBadges,
        tagline: safeTagline,
        promo_badge_text: safePromoBadgeText,
        selling_points: safeSellingPoints,
        closed_group_enabled: safeClosedGroupEnabled,
        closed_group_systems: safeClosedGroupSystems,
        closed_group_description: safeClosedGroupDescription,
        closed_group_min_price_cents: safeClosedGroupMinPriceCents,
      })
      .returning([
        'id',
        'slug',
        'nickname',
        'bio_long',
        'avatar_url',
        'banner_url',
        'languages',
        'specialties',
        'badges',
        'tagline',
        'promo_badge_text',
        'selling_points',
        'closed_group_enabled',
        'closed_group_systems',
        'closed_group_description',
        'closed_group_min_price_cents',
        'created_at',
      ])
      .execute();

    await db
      .updateTable('users')
      .set({ role: 'gm' })
      .where('id', '=', userId)
      .where('role', '=', 'player')
      .execute();

    return res.status(201).json({ data: gmProfile });
  } catch (error) {
    console.error('[POST /gm/profile]', error);
    return res.status(500).json({ error: 'Erro ao criar perfil de mestre.' });
  }
});

// PUT /api/v1/gm/profile — Edita perfil do mestre logado
router.put('/profile', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const {
    nickname,
    bio_long,
    languages,
    specialties,
    badges,
    avatar_url,
    banner_url,
    tagline,
    promo_badge_text,
    selling_points,
    closed_group_enabled,
    closed_group_systems,
    closed_group_description,
    closed_group_min_price_cents,
    preferred_vtt_platforms,
    contact_methods,
  } = req.body;

  if (nickname !== undefined) {
    if (typeof nickname !== 'string' || nickname.trim().length < 2 || nickname.trim().length > 40) {
      return res.status(400).json({ error: 'Nickname inválido. Use entre 2 e 40 caracteres.' });
    }
  }

  const safeNickname = typeof nickname === 'string' ? nickname.trim() : undefined;
  const safeLanguages = Array.isArray(languages) ? languages.filter((v) => typeof v === 'string') : undefined;
  const safeSpecialties = Array.isArray(specialties) ? specialties.filter((v) => typeof v === 'string') : undefined;
  const safeBadges = Array.isArray(badges) ? badges.filter((v) => typeof v === 'string') : undefined;
  const safeTagline = typeof tagline === 'string' ? tagline.trim().slice(0, 200) : tagline === null ? null : undefined;
  const safePromoBadgeText =
    typeof promo_badge_text === 'string'
      ? promo_badge_text.trim().slice(0, 120)
      : promo_badge_text === null
        ? null
        : undefined;
  const safeSellingPoints = Array.isArray(selling_points)
    ? selling_points.filter((point) => {
        if (!point || typeof point !== 'object') return false;
        const p = point as Record<string, unknown>;
        return (
          typeof p.icon === 'string' &&
          typeof p.title === 'string' &&
          typeof p.description === 'string'
        );
      })
    : undefined;
  const safeClosedGroupEnabled = typeof closed_group_enabled === 'boolean' ? closed_group_enabled : undefined;
  const safeClosedGroupSystems = Array.isArray(closed_group_systems)
    ? closed_group_systems.filter(
        (value) => typeof value === 'string' && /^[0-9a-fA-F-]{36}$/.test(value)
      )
    : undefined;
  const safeClosedGroupDescription =
    typeof closed_group_description === 'string'
      ? closed_group_description.trim()
      : closed_group_description === null
        ? null
        : undefined;
  const safeClosedGroupMinPriceCents =
    typeof closed_group_min_price_cents === 'number' &&
    Number.isInteger(closed_group_min_price_cents) &&
    closed_group_min_price_cents >= 0
      ? closed_group_min_price_cents
      : closed_group_min_price_cents === null
        ? null
        : undefined;
  const safePreferredVttPlatforms = Array.isArray(preferred_vtt_platforms)
    ? preferred_vtt_platforms.filter(
        (value) => typeof value === 'string' && /^[0-9a-fA-F-]{36}$/.test(value)
      )
    : undefined;
  
  // DEBUG: Log para verificar o tipo de contact_methods
  console.log('[PUT /gm/profile] contact_methods type:', typeof contact_methods);
  console.log('[PUT /gm/profile] contact_methods value:', contact_methods);
  
  // Validação de contact_methods (array de contatos)
  // HOTFIX: Se vier como string, fazer parse
  let parsedContactMethods = contact_methods;
  if (typeof contact_methods === 'string') {
    try {
      parsedContactMethods = JSON.parse(contact_methods);
      console.log('[PUT /gm/profile] Parsed contact_methods from string');
    } catch (e) {
      console.error('[PUT /gm/profile] Failed to parse contact_methods:', e);
      parsedContactMethods = undefined;
    }
  }
  
  const safeContactMethods = Array.isArray(parsedContactMethods)
    ? parsedContactMethods
        .filter((contact) => contact && typeof contact === 'object')
        .map((contact) => {
          const channel = contact.channel;
          const value = typeof contact.value === 'string' ? contact.value.trim() : '';
          
          // Validar canal
          if (!['whatsapp', 'email', 'discord', 'form'].includes(channel)) {
            return null;
          }
          
          // Validar WhatsApp (formato internacional)
          if (channel === 'whatsapp') {
            const whatsappRegex = /^\+\d{1,3}\d{6,14}$/;
            if (!whatsappRegex.test(value)) {
              return null; // WhatsApp inválido
            }
          }
          
          // Validar Email
          if (channel === 'email') {
            if (!isValidEmail(value)) {
              return null; // Email inválido
            }
          }
          
          return {
            channel,
            value: value.slice(0, 500),
            label: typeof contact.label === 'string' ? contact.label.trim().slice(0, 100) : null,
            discord_server_url: typeof contact.discord_server_url === 'string' 
              ? contact.discord_server_url.trim().slice(0, 500) 
              : null,
          };
        })
        .filter((contact) => contact !== null)
    : undefined;

  try {
    const gmProfile = await db
      .selectFrom('gm_profiles')
      .select(['id'])
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!gmProfile) {
      return res.status(404).json({ error: 'Perfil de mestre não encontrado.' });
    }

    const [updated] = await db
      .updateTable('gm_profiles')
      .set({
        nickname: safeNickname,
        bio_long: bio_long ?? undefined,
        languages: safeLanguages,
        specialties: safeSpecialties,
        badges: safeBadges,
        avatar_url: avatar_url ?? undefined,
        banner_url: banner_url ?? undefined,
        tagline: safeTagline,
        promo_badge_text: safePromoBadgeText,
        selling_points: safeSellingPoints,
        closed_group_enabled: safeClosedGroupEnabled,
        closed_group_systems: safeClosedGroupSystems,
        closed_group_description: safeClosedGroupDescription,
        closed_group_min_price_cents: safeClosedGroupMinPriceCents,
        preferred_vtt_platforms: safePreferredVttPlatforms,
        contact_methods: safeContactMethods ? JSON.stringify(safeContactMethods) : undefined,
      })
      .where('id', '=', gmProfile.id)
      .returning([
        'id',
        'slug',
        'nickname',
        'bio_long',
        'avatar_url',
        'banner_url',
        'languages',
        'specialties',
        'badges',
        'tagline',
        'promo_badge_text',
        'selling_points',
        'closed_group_enabled',
        'closed_group_systems',
        'closed_group_description',
        'closed_group_min_price_cents',
        'updated_at',
      ])
      .execute();

    return res.json({ data: updated });
  } catch (error) {
    console.error('[PUT /gm/profile]', error);
    return res.status(500).json({ error: 'Erro ao atualizar perfil de mestre.' });
  }
});

// GET /api/v1/gm/me — Retorna perfil próprio do mestre logado
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    const gmProfile = await db
      .selectFrom('gm_profiles')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!gmProfile) {
      return res.status(404).json({ error: 'Perfil de mestre não encontrado.' });
    }

    const tablesCountRow = await db
      .selectFrom('tables')
      .select(({ fn }) => [fn.count<string>('id').as('count')])
      .where('gm_id', '=', gmProfile.id)
      .executeTakeFirst();

    const tablesCount = Number(tablesCountRow?.count ?? 0);

    return res.json({
      data: {
        ...gmProfile,
        tables_count: tablesCount,
        avg_rating: null,
      },
    });
  } catch (error) {
    console.error('[GET /gm/me]', error);
    return res.status(500).json({ error: 'Erro ao buscar perfil.' });
  }
});

// ============================================================================
// ROTAS DE MESAS (GM) - REFATORADAS COM SERVICE + REPOSITORY
// ============================================================================

// GET /api/v1/gm/tables/:id — Obtém mesa específica para edição
router.get('/tables/:id', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const userRole = req.user?.role;
  const { id } = req.params;

  try {
    // Mesa órfã (gm_id: null, spec 060) nunca bate findByIdAndGm — admin
    // carrega sem exigir gm_id, mesmo caminho do PUT abaixo (achado do
    // mantenedor 2026-07-08, 404 ao abrir edição de mesa importada).
    const tableData = userRole === 'admin'
      ? await TableRepository.findById(id)
      : await (async () => {
        const gmProfile = await db
          .selectFrom('gm_profiles')
          .select(['id'])
          .where('user_id', '=', userId)
          .executeTakeFirst();
        if (!gmProfile) return null;
        return TableRepository.findByIdAndGm(id, gmProfile.id);
      })();

    if (!tableData) {
      return res.status(404).json({ error: 'Mesa não encontrada ou sem permissão.' });
    }

    const contacts = await TableRepository.findContactsByTableId(id);
    const schedules = await TableRepository.findSchedulesByTableId(id);

    const responseData = {
      ...tableData,
      contacts,
      schedules,
      slots_available: (tableData.slots_total ?? 0) - (tableData.slots_filled ?? 0),
    };

    return res.json({ data: responseData });
  } catch (error) {
    console.error('[GET /gm/tables/:id]', error);
    return res.status(500).json({ error: 'Erro ao buscar mesa.' });
  }
});

// Achado Codex (PR #157): mesa que ja nasce publicada (status active na
// criacao) tambem precisa do scrape automatico, nao so a transicao via
// PATCH /status. Extraida do handler POST /tables (SonarQube: reduz
// Cognitive Complexity do handler).
function notifyTablePublishedOnCreate(
  newTable: { id: string; slug: string; title: string; status: string },
  userId: string,
  userRole: string,
  gmName: string
): void {
  if (newTable.status !== 'active') return;

  // Notifica admins quando a mesa ja nasce publicada (status active), exceto se quem criou e admin.
  if (userRole !== 'admin') {
    void notifyAdmins({
      type: 'table_published',
      title: 'Nova mesa publicada',
      message: `${gmName} publicou a mesa "${newTable.title}".`,
      action_url: `/mesas/${newTable.slug}`,
      metadata: { table_id: newTable.id, table_slug: newTable.slug },
      excludeUserId: userId,
    });
  }
  triggerMetaScrapeOnPublish(newTable.slug, newTable.status, null);
}

// POST /api/v1/gm/tables — Cria nova mesa
router.post('/tables', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const userRole = req.user!.role;

  const validation = createTableSchema.safeParse(req.body);

  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return res.status(400).json({
      error: firstError.message,
      field: firstError.path.join('.'),
    });
  }

  const data: CreateTableInput = validation.data;

  try {
    const gmProfile = await db
      .selectFrom('gm_profiles')
      .select(['id'])
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!gmProfile) {
      return res.status(403).json({ error: 'Perfil de mestre não encontrado. Crie seu perfil primeiro.' });
    }

    // Achado Codex (PR #145): migration_144 removeu a FK local de system_id —
    // sem esta checagem, system_id inexistente no catalogo central era
    // persistido silenciosamente (só validava formato UUID no schema Zod).
    if (data.system_id && !(await systemExistsInCatalog(data.system_id))) {
      return res.status(400).json({ error: 'Sistema inválido ou não encontrado no catálogo.' });
    }

    // Validações usando Service
    if (data.is_ddal && data.system_id) {
      const isEligible = await TableService.isDdalEligibleSystem(data.system_id);
      if (!isEligible) {
        return res.status(400).json({ error: 'Selo DDAL só permitido para D&D > 5e > 2024.' });
      }
    }

    const vttPlatformUuid = await TableService.validateVttPlatform(data.vtt_platform_id ?? null);
    const communicationPlatformResolved = await TableService.validateCommunicationPlatform(
      data.communication_platform_id ?? null,
      data.communication_platform ?? null
    );
    const slug = TableService.generateSlug(data.title);
    const tableData = TableService.prepareTableData(
      data,
      gmProfile.id,
      vttPlatformUuid,
      communicationPlatformResolved.id,
      communicationPlatformResolved.legacy,
      slug,
      userRole
    );

    // Persistência usando Repository
    const newTable = await TableRepository.createTableWithRelations(
      tableData,
      data.contacts,
      data.schedules
    );

    const gmName = await resolveActorName(userId, { logTag: 'gmPanel' });

    void logActivity({
      actorId: userId,
      actorRole: userRole,
      action: 'table.created',
      entityType: 'table',
      entityId: newTable.id,
      entityLabel: newTable.title,
      targetUserId: userId,
      summary: `${gmName} criou a mesa "${newTable.title}".`,
      metadata: {
        table_slug: newTable.slug,
        system_id: tableData.system_id ?? null,
        scenario_id: tableData.scenario_id ?? null,
      },
    });

    notifyTablePublishedOnCreate(newTable, userId, userRole, gmName);

    return res.status(201).json({ data: newTable });
  } catch (error) {
    console.error('[POST /gm/tables]', error);

    const message = getErrorMessage(error);
    if (message === 'Plataforma VTT inválida' || message === 'Plataforma de comunicação inválida') {
      return res.status(400).json({ error: message });
    }

    const pgError = mapPgConstraintErrorToStatus(error);
    if (pgError) {
      return res.status(pgError.status).json({ error: pgError.error });
    }

    return res.status(500).json({ error: 'Erro ao criar mesa.' });
  }
});

// PUT /api/v1/gm/tables/:id — Edita mesa própria
router.put('/tables/:id', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const userRole = req.user?.role;
  const { id } = req.params;

  const validation = updateTableSchema.safeParse(req.body);

  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return res.status(400).json({
      error: firstError.message,
      field: firstError.path.join('.'),
    });
  }

  const data: UpdateTableInput = validation.data;

  try {
    // Mesa via Discord sync (spec 060) nasce gm_id: null — nunca bate o filtro
    // gm_id abaixo. Achado do mantenedor 2026-07-08: editar mesa órfã pelo painel
    // do mestre dava 404 sempre. Admin edita qualquer mesa (órfã ou não) reusando
    // este mesmo form/validação, em vez de duplicar handler em adminTables.ts.
    let existingTable: { id: string; gm_id: string | null; system_id: string | null; slug: string; banner_url: string | null; status: string } | undefined;
    let updaterGmProfileId: string | null = null;
    if (userRole === 'admin') {
      existingTable = await db
        .selectFrom('tables')
        .select(['id', 'gm_id', 'system_id', 'slug', 'banner_url', 'status'])
        .where('id', '=', id)
        .executeTakeFirst();
    } else {
      const gmProfile = await db
        .selectFrom('gm_profiles')
        .select(['id'])
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!gmProfile) {
        return res.status(403).json({ error: 'Perfil de mestre não encontrado.' });
      }
      updaterGmProfileId = gmProfile.id;

      existingTable = await db
        .selectFrom('tables')
        .select(['id', 'gm_id', 'system_id', 'slug', 'banner_url', 'status'])
        .where('id', '=', id)
        .where('gm_id', '=', gmProfile.id)
        .executeTakeFirst();
    }

    if (!existingTable) {
      return res.status(404).json({ error: 'Mesa não encontrada ou sem permissão.' });
    }

    // Achado Codex (PR #145): mesma checagem do POST /gm/tables — system_id
    // sem FK local precisa validar existencia no catalogo central antes de
    // gravar (so entra na checagem quando o campo foi de fato enviado).
    if (data.system_id && !(await systemExistsInCatalog(data.system_id))) {
      return res.status(400).json({ error: 'Sistema inválido ou não encontrado no catálogo.' });
    }

    // Validações
    if (data.is_ddal && (data.system_id ?? existingTable.system_id)) {
      const systemId = data.system_id ?? existingTable.system_id;
      if (systemId) {
        const isEligible = await TableService.isDdalEligibleSystem(systemId);
        if (!isEligible) {
          return res.status(400).json({ error: 'Selo DDAL só permitido para D&D > 5e > 2024.' });
        }
      }
    }

    const hasVttPlatformField = Object.prototype.hasOwnProperty.call(data, 'vtt_platform_id');
    const vttPlatformUuid = hasVttPlatformField
      ? await TableService.validateVttPlatform(data.vtt_platform_id ?? null)
      : undefined;

    const hasCommunicationPlatformIdField = Object.prototype.hasOwnProperty.call(data, 'communication_platform_id');
    const hasCommunicationPlatformLegacyField = Object.prototype.hasOwnProperty.call(data, 'communication_platform');

    const communicationPlatformResolved = (hasCommunicationPlatformIdField || hasCommunicationPlatformLegacyField)
      ? await TableService.validateCommunicationPlatform(
          data.communication_platform_id ?? null,
          data.communication_platform ?? null
        )
      : null;

    // Preparar dados de atualização
    const updateData: Updateable<TablesTable> = {
      title: data.title,
      description: data.description,
      system_id: data.system_id,
      scenario_id: data.scenario_id,
      type: data.type,
      audience: data.audience,
      modality: data.modality,
      price_type: data.price_type,
      price_value: data.price_value,
      price_frequency: data.price_frequency,
      slots_total: data.slots_total,
      slots_filled: data.slots_filled,
      slots_open: data.slots_open,
      language: data.language,
      experience_level: data.experience_level,
      starts_at: data.starts_at ? new Date(data.starts_at) : undefined,
      schedule_day_status: data.schedule_day_status,
      schedule_time_status: data.schedule_time_status,
      schedule_day_hint: data.schedule_day_status === 'defined' ? data.schedule_day_hint : null,
      schedule_time_hint: data.schedule_time_status === 'defined' ? data.schedule_time_hint : null,
      city: data.city,
      state: data.state,
      content_warnings: data.content_warnings,
      safety_tools: data.safety_tools,
      publisher_role: data.publisher_role,
      actual_gm_name: data.publisher_role === 'announcer' ? data.actual_gm_name : null,
      is_ddal: data.is_ddal,
      ddal_code: data.is_ddal ? data.ddal_code : undefined,
      ddal_name: data.is_ddal ? data.ddal_name : undefined,
      ddal_tier: data.is_ddal ? data.ddal_tier : undefined,
      ddal_season: data.is_ddal ? data.ddal_season : undefined,
      ddal_duration: data.is_ddal ? data.ddal_duration : undefined,
      ddal_format: data.is_ddal ? data.ddal_format : undefined,
      ddal_org_code: data.is_ddal ? data.ddal_org_code : undefined,
      ddal_setting: data.is_ddal ? data.ddal_setting : undefined,
      ddal_rules_notes: data.is_ddal ? data.ddal_rules_notes : undefined,
      vtt_platform_id: vttPlatformUuid,
      game_platform_custom: hasVttPlatformField
        ? (data.vtt_platform_id === 'custom' ? data.game_platform_custom : null)
        : data.game_platform_custom,
      communication_platform_id: communicationPlatformResolved ? communicationPlatformResolved.id : undefined,
      communication_platform: communicationPlatformResolved ? communicationPlatformResolved.legacy : undefined,
      rules_notes: data.rules_notes,
      banner_url: data.banner_url,
      master_display_name: data.master_display_name,
      campaign_length: data.campaign_length,
      level_range: data.level_range,
      billing_text: data.billing_text,
      session_zero_free: data.session_zero_free,
      synopsis: data.synopsis,
      style_text: data.style_text,
      listing_excerpt: data.listing_excerpt,
      technical_requirements: data.technical_requirements,
      requires_pc: data.requires_pc,
      requires_camera: data.requires_camera,
      requires_microphone: data.requires_microphone,
      setting_name: data.setting_name,
      setting_styles: data.setting_styles,
      synopsis_narrative: data.synopsis_narrative,
      benefits_text: data.benefits_text,
      table_gm_bio: data.table_gm_bio,
    };

    const updated = await TableRepository.updateTableWithRelations(
      id,
      updaterGmProfileId,
      updateData,
      data.contacts,
      data.schedules
    );

    if (!updated) {
      return res.status(404).json({ error: 'Mesa não encontrada.' });
    }

    const gmName = await resolveActorName(userId, { logTag: 'gmPanel' });

    void logActivity({
      actorId: userId,
      actorRole: userRole,
      action: 'table.updated',
      entityType: 'table',
      entityId: updated.id,
      entityLabel: updated.title,
      targetUserId: userId,
      summary: `${gmName} editou a mesa "${updated.title}".`,
      metadata: {
        table_slug: updated.slug,
      },
    });

    // Achado do mantenedor (2026-07-13): trocar o banner de mesa ja publicada
    // nao atualizava o preview no WhatsApp/Facebook (scrape antigo em cache).
    // Dispara novo scrape so quando a imagem muda de fato e a mesa ja e publica.
    if (
      existingTable.status === 'active'
      && data.banner_url !== undefined
      && data.banner_url !== existingTable.banner_url
    ) {
      void triggerMetaScrape(`${SITE_URL}/mesas/${existingTable.slug}`);
    }

    return res.json({ data: updated });
  } catch (error) {
    console.error('[PUT /gm/tables/:id]', error);

    const message = getErrorMessage(error);
    if (message === 'Plataforma VTT inválida' || message === 'Plataforma de comunicação inválida') {
      return res.status(400).json({ error: message });
    }

    const pgError = mapPgConstraintErrorToStatus(error);
    if (pgError) {
      return res.status(pgError.status).json({ error: pgError.error });
    }

    return res.status(500).json({ error: 'Erro ao editar mesa.' });
  }
});

// GET /api/v1/gm/tables — Lista mesas do mestre
router.get('/tables', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    const gmProfile = await db
      .selectFrom('gm_profiles')
      .select('id')
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!gmProfile) return res.status(403).json({ error: 'Perfil de mestre não encontrado.' });

    // Achado Codex (PR #145): system_id agora referencia o catalogo central,
    // leftJoin('systems' LOCAL) sempre NULL pra mesas do fluxo novo — join
    // removido, hidratacao via hydrateTableSystemFields apos a query.
    const tables = await db
      .selectFrom('tables as t')
      .leftJoin('table_metrics as tm', 'tm.table_id', 't.id')
      .leftJoin('vtt_platforms as vtt', 'vtt.id', 't.vtt_platform_id')
      .leftJoin('communication_platforms as cp', 'cp.id', 't.communication_platform_id')
      .select([
        't.id',
        't.slug',
        't.title',
        't.description',
        sql<string | null>`COALESCE(t.banner_url, t.cover_url)`.as('image_url'),
        't.status',
        't.modality',
        't.system_id',
        't.type',
        't.audience',
        't.price_type',
        't.price_value',
        't.price_frequency',
        't.slots_total',
        't.slots_filled',
        't.slots_open',
        't.language',
        't.experience_level',
        't.starts_at',
        't.city',
        't.state',
        't.content_warnings',
        't.safety_tools',
        't.publisher_role',
        't.actual_gm_name',
        sql<boolean>`COALESCE(t.is_ddal, false)`.as('is_ddal'),
        sql<boolean>`COALESCE(t.is_covil, false)`.as('is_covil'),
        't.ddal_code',
        't.ddal_name',
        't.ddal_tier',
        't.created_at',
        't.updated_at',
        't.archived_at',
        't.published_at',
        't.master_display_name',
        't.campaign_length',
        't.level_range',
        't.billing_text',
        't.session_zero_free',
        't.synopsis',
        't.style_text',
        't.listing_excerpt',
        't.technical_requirements',
        't.requires_pc',
        't.requires_camera',
        't.requires_microphone',
        't.setting_name',
        't.setting_styles',
        't.synopsis_narrative',
        't.benefits_text',
        't.table_gm_bio',
        't.vtt_platform_id',
        't.game_platform_custom',
        sql<VttPlatformJson | null>`
          CASE WHEN vtt.id IS NOT NULL THEN
            json_build_object(
              'id', vtt.id,
              'name', vtt.name,
              'slug', vtt.slug,
              'logo_filename', vtt.logo_filename,
              'website_url', vtt.website_url
            )
          ELSE NULL
          END
        `.as('vtt_platform'),
        't.communication_platform_id',
        sql<string | null>`COALESCE(cp.name, t.communication_platform)`.as('communication_platform'),
        sql<number>`COALESCE(tm.views_count, 0)`.as('metrics_views'),
        sql<number>`COALESCE(tm.clicks_count, 0)`.as('metrics_clicks'),
        sql<number>`COALESCE(tm.contacts_count, 0)`.as('metrics_contacts'),
        sql<number>`COALESCE(tm.favorites_count, 0)`.as('metrics_favorites'),
      ])
      .where('t.gm_id', '=', gmProfile.id)
      .orderBy('t.created_at', 'desc')
      .execute();

    if (tables.length === 0) {
      return res.json({ data: [] });
    }

    const tableIds = tables.map((table) => table.id);
    const contacts = await db
      .selectFrom('table_contacts')
      .select(['table_id', 'channel', 'value', 'label', 'discord_server_url', 'sort_order'])
      .where('table_id', 'in', tableIds)
      .orderBy('sort_order', 'asc')
      .execute();

    const contactsByTable = new Map<string, TableContact[]>();
    for (const contact of contacts) {
      if (!contactsByTable.has(contact.table_id)) {
        contactsByTable.set(contact.table_id, []);
      }
      contactsByTable.get(contact.table_id)!.push(contact as TableContact);
    }

    const schedules = await db
      .selectFrom('table_schedules')
      .selectAll()
      .where('table_id', 'in', tableIds)
      .orderBy('sort_order', 'asc')
      .execute();

    const schedulesByTable = new Map<string, Selectable<TableSchedulesTable>[]>();
    for (const schedule of schedules) {
      if (!schedulesByTable.has(schedule.table_id)) {
        schedulesByTable.set(schedule.table_id, []);
      }
      schedulesByTable.get(schedule.table_id)!.push(schedule);
    }

    const tablesWithSystem = await hydrateTableSystemFields(tables);
    const tablesWithData = tablesWithSystem.map((table) => ({
      ...table,
      contacts: contactsByTable.get(table.id) ?? [],
      schedules: schedulesByTable.get(table.id) ?? [],
    }));

    return res.json({ data: tablesWithData });
  } catch (error) {
    console.error('[GET /gm/tables]', error);
    return res.status(500).json({ error: 'Erro ao buscar mesas.' });
  }
});

// PATCH /api/v1/gm/tables/:id/status — Altera status da mesa
router.patch('/tables/:id/status', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const userRole = req.user!.role;
  const { id } = req.params;
  const { status } = req.body;

  // LOG TEMPORÁRIO: Diagnóstico do erro 401
  console.log('[PATCH /tables/:id/status] Requisição recebida:', {
    userId,
    userRole,
    tableId: id,
    statusRequested: status,
    hasAuthHeader: !!req.headers.authorization,
    hasCookie: !!req.cookies?.artificio_session,
    timestamp: new Date().toISOString()
  });

  const validStatuses = ['active', 'full', 'cancelled', 'ended'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Status inválido. Valores: ${validStatuses.join(', ')}` });
  }

  try {
    const table = await db
      .selectFrom('tables')
      .select(['id', 'gm_id', 'status', 'title', 'published_at'])
      .where('id', '=', id)
      .executeTakeFirst();

    if (!table) {
      return res.status(404).json({ error: 'Mesa não encontrada.' });
    }

    // 1a publicacao (status -> active e ainda sem ancora) grava published_at.
    // Ancora da regra de auto-arquivamento (D-MESAS1); republicar nao reseta.
    const publishPatch =
      status === 'active' && !table.published_at ? { published_at: new Date() } : {};

    if (userRole === 'admin') {
      const result = await db
        .updateTable('tables')
        .set({ status, ...publishPatch })
        .where('id', '=', id)
        .returning(['id', 'slug', 'title', 'status'])
        .executeTakeFirst();

      if (result) {
        const actorName = await resolveActorName(userId, { logTag: 'gmPanel' });

        void logActivity({
          actorId: userId,
          actorRole: userRole,
          action: 'table.status_changed',
          entityType: 'table',
          entityId: result.id,
          entityLabel: result.title,
          targetUserId: null,
          summary: `${actorName} alterou status da mesa "${result.title}" de ${table.status} para ${result.status}.`,
          metadata: {
            table_slug: result.slug,
            from: table.status,
            to: result.status,
          },
        });

        // Achado Codex (PR #157): branch admin retornava antes do scrape que
        // so existia no branch GM abaixo — publicacao feita por admin nunca
        // disparava o refresh de OG.
        triggerMetaScrapeOnPublish(result.slug, result.status, table.status);
      }

      return res.json({ data: result });
    }

    const gmProfile = await db
      .selectFrom('gm_profiles')
      .select('id')
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!gmProfile || table.gm_id !== gmProfile.id) {
      return res.status(403).json({ error: 'Sem permissão.' });
    }

    const result = await db
      .updateTable('tables')
      .set({ status, ...publishPatch })
      .where('id', '=', id)
      .returning(['id', 'slug', 'title', 'status'])
      .executeTakeFirst();

    if (result) {
      const actorName = await resolveActorName(userId, { logTag: 'gmPanel' });

      void logActivity({
        actorId: userId,
        actorRole: userRole,
        action: 'table.status_changed',
        entityType: 'table',
        entityId: result.id,
        entityLabel: result.title,
        targetUserId: userId,
        summary: `${actorName} alterou status da mesa "${result.title}" de ${table.status} para ${result.status}.`,
        metadata: {
          table_slug: result.slug,
          from: table.status,
          to: result.status,
        },
      });

      // Notifica admins quando a mesa passa a publicada (draft/outro -> active). Ator e GM, nao admin.
      if (result.status === 'active' && table.status !== 'active') {
        void notifyAdmins({
          type: 'table_published',
          title: 'Nova mesa publicada',
          message: `${actorName} publicou a mesa "${result.title}".`,
          action_url: `/mesas/${result.slug}`,
          metadata: { table_id: result.id, table_slug: result.slug },
          excludeUserId: userId,
        });
        // Achado do mantenedor (2026-07-13): OG preview no WhatsApp/Facebook so
        // aparece apos scrape manual no Sharing Debugger. Dispara automatico na
        // 1a publicacao (draft/outro -> active) pra nao depender disso.
        triggerMetaScrapeOnPublish(result.slug, result.status, table.status);
      }
    }

    return res.json({ data: result });
  } catch (error) {
    console.error('[PATCH /gm/tables/:id/status]', error);
    return res.status(500).json({ error: 'Erro ao atualizar status.' });
  }
});

// PATCH /api/v1/gm/tables/:id/archive — Arquiva/desarquiva mesa (dono ou admin). D-MESAS1.
// Arquivar tira do catalogo publico sem perder a mesa nem o status; reversivel.
router.patch('/tables/:id/archive', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const userRole = req.user!.role;
  const { id } = req.params;
  const archived = req.body?.archived !== false; // default = arquivar; { archived: false } = desarquivar

  try {
    const table = await db
      .selectFrom('tables')
      .select(['id', 'gm_id', 'title', 'archived_at'])
      .where('id', '=', id)
      .executeTakeFirst();

    if (!table) {
      return res.status(404).json({ error: 'Mesa não encontrada.' });
    }

    if (userRole !== 'admin') {
      const gmProfile = await db
        .selectFrom('gm_profiles')
        .select('id')
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!gmProfile || table.gm_id !== gmProfile.id) {
        return res.status(403).json({ error: 'Sem permissão.' });
      }
    }

    const result = await db
      .updateTable('tables')
      .set({ archived_at: archived ? new Date() : null })
      .where('id', '=', id)
      .returning(['id', 'slug', 'title', 'status', 'archived_at'])
      .executeTakeFirst();

    if (result) {
      const actorName = await resolveActorName(userId, { logTag: 'gmPanel' });
      void logActivity({
        actorId: userId,
        actorRole: userRole,
        action: archived ? 'table.archived' : 'table.unarchived',
        entityType: 'table',
        entityId: result.id,
        entityLabel: result.title,
        targetUserId: userRole === 'admin' ? null : userId,
        summary: `${actorName} ${archived ? 'arquivou' : 'desarquivou'} a mesa "${result.title}".`,
        metadata: { table_slug: result.slug, archived },
      });
    }

    return res.json({ data: result });
  } catch (error) {
    console.error('[PATCH /gm/tables/:id/archive]', error);
    return res.status(500).json({ error: 'Erro ao arquivar mesa.' });
  }
});

// DELETE /api/v1/gm/tables/:id — Deleta mesa própria
router.delete('/tables/:id', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const userRole = req.user?.role;
  const { id } = req.params;

  try {
    const gmProfile = await db
      .selectFrom('gm_profiles')
      .select('id')
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!gmProfile) {
      return res.status(403).json({ error: 'Perfil de mestre não encontrado.' });
    }

    const existingTable = await db
      .selectFrom('tables')
      .select(['id', 'title', 'slug', 'gm_id'])
      .where('id', '=', id)
      .where('gm_id', '=', gmProfile.id)
      .executeTakeFirst();

    if (!existingTable) {
      return res.status(404).json({ error: 'Mesa não encontrada.' });
    }

    await TableRepository.deleteTableWithRelations(id);

    const gmName = await resolveActorName(userId, { logTag: 'gmPanel' });

    void logActivity({
      actorId: userId,
      actorRole: userRole,
      action: 'table.deleted',
      entityType: 'table',
      entityId: null,
      entityLabel: existingTable.title,
      targetUserId: userId,
      summary: `${gmName} excluiu a mesa "${existingTable.title}".`,
      metadata: {
        table_slug: existingTable.slug,
        previous_id: existingTable.id,
      },
    });

    return res.json({ data: { message: `Mesa "${existingTable.title}" deletada.` } });
  } catch (error) {
    console.error('[DELETE /gm/tables/:id]', error);
    return res.status(500).json({ error: 'Erro ao deletar mesa.' });
  }
});

// ============================================================================
// ROTAS DE MÉTRICAS
// ============================================================================

router.post('/tables/:slug/view', async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    const table = await db
      .selectFrom('tables')
      .select('id')
      .where('slug', '=', slug)
      .executeTakeFirst();

    if (!table) return res.sendStatus(404);

    const fingerprint = generateFingerprint(req);
    const shouldCount = await shouldCountMetric(table.id, 'view', fingerprint);

    if (!shouldCount) return res.sendStatus(202);

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto('table_metric_events')
        .values({ table_id: table.id, action: 'view', fingerprint_hash: fingerprint })
        .execute();

      await trx
        .insertInto('table_metrics')
        .values({ table_id: table.id, views_count: 1 })
        .onConflict((oc) =>
          oc.column('table_id').doUpdateSet({
            views_count: sql`table_metrics.views_count + 1`,
            updated_at: sql`NOW()`,
          })
        )
        .execute();
    });

    res.sendStatus(200);
  } catch (error) {
    console.error('[POST /tables/:slug/view]', error);
    res.sendStatus(500);
  }
});

router.post('/tables/:id/click', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const table = await db.selectFrom('tables').select('id').where('id', '=', id).executeTakeFirst();
    if (!table) return res.sendStatus(404);

    const fingerprint = generateFingerprint(req);
    const shouldCount = await shouldCountMetric(id, 'click', fingerprint);
    if (!shouldCount) return res.sendStatus(202);

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto('table_metric_events')
        .values({ table_id: id, action: 'click', fingerprint_hash: fingerprint })
        .execute();

      await trx
        .insertInto('table_metrics')
        .values({ table_id: id, clicks_count: 1 })
        .onConflict((oc) =>
          oc.column('table_id').doUpdateSet({
            clicks_count: sql`table_metrics.clicks_count + 1`,
            updated_at: sql`NOW()`,
          })
        )
        .execute();
    });

    res.sendStatus(200);
  } catch (error) {
    console.error('[POST /tables/:id/click]', error);
    res.sendStatus(500);
  }
});

router.post('/tables/:id/contact', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const table = await db.selectFrom('tables').select('id').where('id', '=', id).executeTakeFirst();
    if (!table) return res.sendStatus(404);

    const fingerprint = generateFingerprint(req);
    const shouldCount = await shouldCountMetric(id, 'contact', fingerprint);
    if (!shouldCount) return res.sendStatus(202);

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto('table_metric_events')
        .values({ table_id: id, action: 'contact', fingerprint_hash: fingerprint })
        .execute();

      await trx
        .insertInto('table_metrics')
        .values({ table_id: id, contacts_count: 1 })
        .onConflict((oc) =>
          oc.column('table_id').doUpdateSet({
            contacts_count: sql`table_metrics.contacts_count + 1`,
            updated_at: sql`NOW()`,
          })
        )
        .execute();
    });

    res.sendStatus(200);
  } catch (error) {
    console.error('[POST /tables/:id/contact]', error);
    res.sendStatus(500);
  }
});

router.post('/tables/:id/favorite', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const table = await db.selectFrom('tables').select('id').where('id', '=', id).executeTakeFirst();
    if (!table) return res.sendStatus(404);

    const fingerprint = generateFingerprint(req);
    const shouldCount = await shouldCountMetric(id, 'favorite', fingerprint);
    if (!shouldCount) return res.sendStatus(202);

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto('table_metric_events')
        .values({ table_id: id, action: 'favorite', fingerprint_hash: fingerprint })
        .execute();

      await trx
        .insertInto('table_metrics')
        .values({ table_id: id, favorites_count: 1 })
        .onConflict((oc) =>
          oc.column('table_id').doUpdateSet({
            favorites_count: sql`table_metrics.favorites_count + 1`,
            updated_at: sql`NOW()`,
          })
        )
        .execute();
    });

    res.sendStatus(200);
  } catch (error) {
    console.error('[POST /tables/:id/favorite]', error);
    res.sendStatus(500);
  }
});

// GET /api/v1/gm/insights — Dashboard de insights agregados
router.get('/insights', authMiddleware, async (req: Request, res: Response) => {
  const userId = req.user!.userId;

  try {
    // Verificar se usuário tem perfil GM
    const gmProfile = await db
      .selectFrom('gm_profiles')
      .select('id')
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!gmProfile) {
      return res.status(404).json({ error: 'Perfil de mestre não encontrado.' });
    }

    // Achado Codex (PR #145): system_id agora referencia o catalogo central,
    // leftJoin('systems' LOCAL) sempre NULL pra mesas do fluxo novo — join
    // removido, hidratacao via hydrateTableSystemFields apos a query.
    const rawTables = await db
      .selectFrom('tables as t')
      .leftJoin('table_metrics as tm', 'tm.table_id', 't.id')
      .select([
        't.id',
        't.slug',
        't.title',
        't.status',
        't.system_id',
        sql<number>`COALESCE(tm.views_count, 0)`.as('views'),
        sql<number>`COALESCE(tm.clicks_count, 0)`.as('clicks'),
        sql<number>`COALESCE(tm.contacts_count, 0)`.as('contacts'),
        sql<number>`COALESCE(tm.favorites_count, 0)`.as('favorites'),
      ])
      .where('t.gm_id', '=', gmProfile.id)
      .where('t.status', 'in', ['active', 'full'])
      .execute();
    const tables = await hydrateTableSystemFields(rawTables);

    // Buscar breakdown de cliques por variant
    const clickBreakdowns = await db
      .selectFrom('table_click_events as tce')
      .innerJoin('tables as t', 't.id', 'tce.table_id')
      .select([
        'tce.table_id',
        'tce.variant',
        sql<number>`COUNT(*)`.as('count'),
      ])
      .where('t.gm_id', '=', gmProfile.id)
      .groupBy(['tce.table_id', 'tce.variant'])
      .execute();

    // Tendência temporal (últimos 7 dias) para fallback transparente
    const recentViewsCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const recentViews = await db
      .selectFrom('table_metric_events as tme')
      .innerJoin('tables as t', 't.id', 'tme.table_id')
      .select([
        'tme.table_id',
        sql<number>`COUNT(*)`.as('count'),
      ])
      .where('t.gm_id', '=', gmProfile.id)
      .where('tme.action', '=', 'view')
      .where('tme.created_at', '>', recentViewsCutoff)
      .groupBy('tme.table_id')
      .execute();

    const recentViewsMap = new Map<string, number>();
    for (const row of recentViews) {
      recentViewsMap.set(row.table_id, Number(row.count));
    }

    // Benchmarks dinâmicos de plataforma (global)
    const benchmarks = await BenchmarkService.getPlatformBenchmarks('global');

    // Mapear breakdown por mesa
    const breakdownMap = new Map<string, Record<string, number>>();
    for (const row of clickBreakdowns) {
      if (!breakdownMap.has(row.table_id)) {
        breakdownMap.set(row.table_id, {});
      }
      breakdownMap.get(row.table_id)![row.variant || 'unknown'] = Number(row.count);
    }

    // Calcular métricas e enriquecer dados
    let totalViews = 0;
    let totalClicks = 0;
    let totalContacts = 0;
    let totalFavorites = 0;

    const enrichedTables = tables.map((table) => {
      const views = Number(table.views);
      const clicks = Number(table.clicks);
      const contacts = Number(table.contacts);
      const favorites = Number(table.favorites);

      totalViews += views;
      totalClicks += clicks;
      totalContacts += contacts;
      totalFavorites += favorites;

      const ctr = views > 0 ? (clicks / views) * 100 : 0;
      const breakdown = breakdownMap.get(table.id) || {};
      const viewsLast7d = recentViewsMap.get(table.id) || 0;

      const benchmarkPosition = benchmarks.available && benchmarks.metrics
        ? {
            views_quartile: toQuartile(views, benchmarks.metrics.views),
            clicks_quartile: toQuartile(clicks, benchmarks.metrics.clicks),
            contacts_quartile: toQuartile(contacts, benchmarks.metrics.contacts),
            ctr_quartile: toQuartile(ctr, benchmarks.metrics.ctr),
          }
        : null;

      return {
        id: table.id,
        slug: table.slug,
        title: table.title,
        status: table.status,
        system_name: table.system_name,
        views,
        clicks,
        contacts,
        favorites,
        ctr: Math.round(ctr * 10) / 10,
        click_breakdown: {
          refactored_v4: breakdown.refactored_v4 || 0,
          cta_entrar: breakdown.cta_entrar || 0,
          link_vtt: breakdown.link_vtt || 0,
        },
        benchmark_position: benchmarkPosition
          ? {
              ...benchmarkPosition,
              views_label: quartileLabel(benchmarkPosition.views_quartile),
            }
          : null,
        trend: {
          views_last_7d: viewsLast7d,
        },
      };
    });

    // Calcular taxas agregadas
    const overallCtr = totalViews > 0 ? (totalClicks / totalViews) * 100 : 0;
    const contactRate = totalClicks > 0 ? (totalContacts / totalClicks) * 100 : 0;

    // Recomendações de funil com benchmark relativo
    const recommendations: Array<{
      severity: 'high' | 'medium' | 'low';
      table_slug: string;
      table_title: string;
      message: string;
    }> = [];

    for (const table of enrichedTables) {
      if (benchmarks.available && table.benchmark_position) {
        const topViews = table.benchmark_position.views_quartile === 'q3' || table.benchmark_position.views_quartile === 'q4';
        const topClicks = table.benchmark_position.clicks_quartile === 'q3' || table.benchmark_position.clicks_quartile === 'q4';
        const lowClicks = table.benchmark_position.clicks_quartile === 'q1';
        const lowContacts = table.benchmark_position.contacts_quartile === 'q1';
        const lowViews = table.benchmark_position.views_quartile === 'q1';
        const topCtr = table.benchmark_position.ctr_quartile === 'q4';

        if (topViews && lowClicks) {
          recommendations.push({
            severity: 'high',
            table_slug: table.slug,
            table_title: table.title,
            message: 'Sua mesa recebe visualizações, mas poucos cliques em relação à plataforma. Revise capa e título para melhorar o primeiro impacto.',
          });
        } else if (topClicks && lowContacts) {
          recommendations.push({
            severity: 'high',
            table_slug: table.slug,
            table_title: table.title,
            message: 'Sua mesa gera interesse, mas converte pouco em contato. Ajuste CTA, preço e instruções de contato.',
          });
        } else if (lowViews) {
          recommendations.push({
            severity: 'medium',
            table_slug: table.slug,
            table_title: table.title,
            message: 'Sua mesa está abaixo da maioria em visualizações. Reforce divulgação em comunidades de RPG e revise tags/sistema.',
          });
        } else if (topCtr && table.contacts > 0) {
          recommendations.push({
            severity: 'low',
            table_slug: table.slug,
            table_title: table.title,
            message: 'Sua mesa está com boa taxa de clique em relação à plataforma. Continue com a mesma linha de apresentação.',
          });
        }
      } else {
        if (table.trend.views_last_7d > 0) {
          recommendations.push({
            severity: 'low',
            table_slug: table.slug,
            table_title: table.title,
            message: `Sua mesa ganhou ${table.trend.views_last_7d} visualização(ões) nos últimos 7 dias. Os benchmarks comparativos aparecem conforme a base cresce.`,
          });
        } else {
          recommendations.push({
            severity: 'low',
            table_slug: table.slug,
            table_title: table.title,
            message: 'Sua mesa ainda não teve visualizações recentes. Compartilhe o link em comunidades de RPG para ganhar tração inicial.',
          });
        }
      }
    }

    // Evita estado estranho sem mensagem quando há mesas ativas
    if (recommendations.length === 0 && enrichedTables.length > 0) {
      recommendations.push({
        severity: 'low',
        table_slug: enrichedTables[0].slug,
        table_title: enrichedTables[0].title,
        message: 'Seus indicadores estão estáveis em relação à plataforma. Continue monitorando e fazendo ajustes graduais.',
      });
    }

    const normalizedBenchmarks = benchmarks.metrics
      ? {
          views: {
            p25: Math.round(benchmarks.metrics.views.p25 * 10) / 10,
            p50: Math.round(benchmarks.metrics.views.p50 * 10) / 10,
            p75: Math.round(benchmarks.metrics.views.p75 * 10) / 10,
          },
          clicks: {
            p25: Math.round(benchmarks.metrics.clicks.p25 * 10) / 10,
            p50: Math.round(benchmarks.metrics.clicks.p50 * 10) / 10,
            p75: Math.round(benchmarks.metrics.clicks.p75 * 10) / 10,
          },
          contacts: {
            p25: Math.round(benchmarks.metrics.contacts.p25 * 10) / 10,
            p50: Math.round(benchmarks.metrics.contacts.p50 * 10) / 10,
            p75: Math.round(benchmarks.metrics.contacts.p75 * 10) / 10,
          },
          ctr: {
            p25: Math.round(benchmarks.metrics.ctr.p25 * 10) / 10,
            p50: Math.round(benchmarks.metrics.ctr.p50 * 10) / 10,
            p75: Math.round(benchmarks.metrics.ctr.p75 * 10) / 10,
          },
        }
      : null;

    res.json({
      overview: {
        total_views: totalViews,
        total_clicks: totalClicks,
        total_contacts: totalContacts,
        total_favorites: totalFavorites,
        ctr: Math.round(overallCtr * 10) / 10,
        contact_rate: Math.round(contactRate * 10) / 10,
      },
      benchmarks: {
        ...benchmarks,
        metrics: normalizedBenchmarks,
      },
      tables: enrichedTables,
      recommendations,
    });
  } catch (error) {
    console.error('[GET /gm/insights]', error);
    res.status(500).json({ error: 'Erro ao buscar insights.' });
  }
});

export default router;
