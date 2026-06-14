import { Router, Request, Response } from 'express';
import { sql } from 'kysely';
import { db } from '../db';
import { logDatabaseError } from '../middleware/requestLogger';
import { sanitizePublicImageUrl } from '../utils/publicImageUrl';

const router = Router();

type PublicTableContact = {
  channel: string;
  value: string;
  label: string | null;
  discord_server_url: string | null;
  sort_order: number;
};

// GET /api/v1/tables — Catálogo público, sem JWT
router.get('/', async (req: Request, res: Response) => {
  const {
    system,
    modality,
    type,
    audience,
    price_type,
    experience_level,
    state,
    city,
    featured,
    search,
    seal,
    sort,
    page = '1',
    limit = '12',
  } = req.query as Record<string, string>;

  // CORREÇÃO HP-04: Validar NaN em parseInt
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 12));
  const offset = (pageNum - 1) * limitNum;

  try {
    let query = db
      .selectFrom('tables as t')
      .leftJoin('gm_profiles as gm', 'gm.id', 't.gm_id')
      .leftJoin('users as u', 'u.id', 'gm.user_id')
      .leftJoin('profiles as p', 'p.user_id', 'u.id')
      .leftJoin('systems as s', 's.id', 't.system_id')
      // CORREÇÃO A-HIGH-01: JOIN com vtt_platforms para consistência com rota de detalhes
      .leftJoin('vtt_platforms as vtt', 'vtt.id', 't.vtt_platform_id')
      .select([
        't.id',
        't.slug',
        't.title',
        't.description',
        sql<string | null>`t.banner_url`.as('cover_url'),
        sql<Record<string, number> | null>`t.banner_crop_data`.as('cover_crop_data'),
        't.status',
        't.type',
        't.audience',
        't.modality',
        't.price_type',
        't.price_value',
        // CORREÇÃO DT-05: Documentação de campos de vagas
        // slots_total: Capacidade máxima da mesa (ex: 5 jogadores)
        // slots_filled: Jogadores já inscritos/confirmados (ex: 3 jogadores)
        // slots_open: Vagas abertas para recrutamento, controlado pelo mestre (ex: 2 vagas)
        //   - Pode ser menor que (slots_total - slots_filled) se mestre fechar recrutamento
        //   - Frontend deve usar slots_open para exibir "vagas disponíveis"
        //   - Fallback: se NULL, calcular como (slots_total - slots_filled)
        't.slots_total',
        't.slots_filled',
        't.slots_open', // REQ-02: Vagas abertas para recrutamento
        't.language',
        't.experience_level',
        't.starts_at',
        't.content_warnings',
        't.safety_tools',
        't.publisher_role',
        't.actual_gm_name',
        't.featured',
        't.created_at',
        't.is_ddal',
        't.is_covil', // CORREÇÃO A01: Retornar flag Covil do Lich
        't.ddal_code',
        't.ddal_name',
        't.ddal_tier',
        // CORREÇÃO DT-19: Retornar campos de cenário e estilos (REQ-28)
        't.setting_name',
        't.setting_styles',
        // CORREÇÃO DT-01: Retornar synopsis_narrative para cards
        't.synopsis_narrative',
        's.name as system_name',
        's.slug as system_slug',
        's.logo_filename as system_logo_filename',
        's.website_url as system_website_url',
        'gm.slug as gm_slug',
        sql<string | null>`COALESCE(gm.avatar_url, p.avatar_url)`.as('gm_avatar_url'),
        'gm.badges as gm_badges',
        sql<string>`COALESCE(gm.nickname, p.display_name)`.as('gm_display_name'),
        // CORREÇÃO A-HIGH-01: Retornar objeto vtt_platform para cards de catálogo
        sql<any>`
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
        't.game_platform_custom', // CORREÇÃO A-HIGH-01: Retornar custom VTT para cards
      ])
      .where('t.status', '=', 'active')
      .where('t.archived_at', 'is', null) // D-MESAS1: arquivadas somem do catalogo publico
      .orderBy('t.created_at', 'desc');

    if (system) query = query.where('s.slug', '=', system);
    if (modality) query = query.where('t.modality', '=', modality as any);
    if (type) query = query.where('t.type', '=', type as any);
    if (audience) query = query.where('t.audience', '=', audience as any);
    if (price_type) query = query.where('t.price_type', '=', price_type as any);
    if (experience_level) query = query.where('t.experience_level', '=', experience_level as any);
    if (featured === 'true') query = query.where('t.featured', '=', true);
    if (state) query = query.where('t.state', '=', state);
    if (city) query = query.where('t.city', 'ilike', `%${city}%`);

    if (seal === 'ddal') {
      query = query.where('t.is_ddal', '=', true);
    }

    // CORREÇÃO A02: Filtro Covil do Lich deve usar t.is_covil, não gm.badges
    if (seal === 'covil-do-lich' || seal === 'covil_do_lich') {
      query = query.where('t.is_covil', '=', true);
    }

    if (search) {
      const safeSearch = `%${search}%`;
      query = query.where(sql<boolean>`(
        t.title ILIKE ${safeSearch}
        OR t.description ILIKE ${safeSearch}
        OR s.name ILIKE ${safeSearch}
        OR COALESCE(gm.nickname, p.display_name) ILIKE ${safeSearch}
      )`);
    }

    // NOVO: Filtro de estilos de jogo
    const styles = req.query.styles as string | undefined;
    if (styles) {
      const styleArray = styles.split(',').filter(Boolean);
      if (styleArray.length > 0) {
        // Filtrar mesas que contenham QUALQUER um dos estilos selecionados
        query = query.where(sql<boolean>`t.setting_styles && ARRAY[${sql.join(styleArray.map(s => sql.lit(s)))}]::text[]`);
      }
    }

    // Aplicar ordenação
    if (sort === 'popular') {
      // CORREÇÃO UX-SENIOR-01: Ranking inteligente com score composto
      // Score = urgência (20pts) + featured (20pts) + frescor (decay) + engajamento
      query = query
        .clearOrderBy()
        .leftJoin('table_metrics as tm', 'tm.table_id', 't.id')
        .orderBy(
          sql<number>`(
            -- Urgência: mesas com poucas vagas sobem
            (CASE 
              WHEN t.slots_open <= 2 AND t.slots_open > 0 THEN 20
              WHEN t.slots_open <= 5 THEN 10
              ELSE 0
            END) +
            
            -- Featured: destaque manual
            (CASE WHEN t.featured THEN 20 ELSE 0 END) +
            
            -- Frescor: mesas recentes sobem (decay exponencial, max 20pts)
            (20 * EXP(-EXTRACT(EPOCH FROM (NOW() - t.created_at)) / 86400.0)) +
            
            -- Engajamento: contatos e visualizações
            (COALESCE(tm.contacts_count, 0) * 2) +
            (COALESCE(tm.views_count, 0) * 0.1)
          )`,
          'desc'
        )
        .orderBy('t.created_at', 'desc'); // Desempate por recência
    } else if (sort === 'recent') {
      // NOVO: Ordenação por mesas mais recentes
      query = query
        .clearOrderBy()
        .orderBy('t.created_at', 'desc');
    } else if (sort === 'price_asc') {
      query = query
        .clearOrderBy()
        .orderBy('t.price_value', 'asc')
        .orderBy('t.created_at', 'desc');
    } else if (sort === 'price_desc') {
      query = query
        .clearOrderBy()
        .orderBy('t.price_value', 'desc')
        .orderBy('t.created_at', 'desc');
    }
    // TODO: ending_soon e slots requerem campos end_date e slots_available no banco

    // CORREÇÃO BE-03: Contagem otimizada - usar query original sem SELECT complexos
    // Isso evita duplicar lógica de filtros e mantém type-safety do Kysely
    const countResult = await query
      .clearSelect()
      .clearOrderBy()
      .select(sql<number>`COUNT(DISTINCT t.id)`.as('count'))
      .executeTakeFirst();
    
    const totalCount = Number(countResult?.count ?? 0);

    // Aplicar limit/offset DEPOIS da contagem
    query = query.limit(limitNum).offset(offset);

    const tables = await query.execute();
    const publicTables = tables.map((table) => ({
      ...table,
      cover_url: sanitizePublicImageUrl(table.cover_url),
    }));

    let tablesWithContacts = publicTables as Array<typeof publicTables[number] & { contacts: PublicTableContact[] }>;

    if (tables.length > 0) {
      const tableIds = tables.map((table) => table.id);
      const contacts = await db
        .selectFrom('table_contacts')
        .select(['table_id', 'channel', 'value', 'label', 'discord_server_url', 'sort_order'])
        .where('table_id', 'in', tableIds)
        .orderBy('sort_order', 'asc')
        .execute();

      const contactsByTable = new Map<string, PublicTableContact[]>();

      for (const contact of contacts) {
        if (!contactsByTable.has(contact.table_id)) {
          contactsByTable.set(contact.table_id, []);
        }

        contactsByTable.get(contact.table_id)!.push({
          channel: contact.channel,
          value: contact.value,
          label: contact.label,
          discord_server_url: contact.discord_server_url,
          sort_order: contact.sort_order,
        });
      }

      tablesWithContacts = publicTables.map((table) => ({
        ...table,
        contacts: contactsByTable.get(table.id) ?? [],
      }));
    }

    res.json({
      data: tablesWithContacts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        hasMore: tables.length === limitNum,
        total: totalCount, // CORREÇÃO BE-03: totalCount já é número
      },
    });
  } catch (error: any) {
    // CORREÇÃO HP-03: Log com contexto de query params
    console.error('[GET /tables]', error, { 
      params: { system, modality, type, audience, price_type, experience_level, state, city, featured, search, seal, sort, page, limit }
    });
    res.status(500).json({ error: 'Erro ao buscar mesas.' });
  }
});

// GET /api/v1/tables/:slug — Mesa individual
router.get('/:slug', async (req: Request, res: Response) => {
  const { slug } = req.params;

  // CORREÇÃO A-HIGH-02: Validar formato do slug antes de usar em query
  if (!slug || slug.length > 200 || !/^[a-z0-9-]+$/i.test(slug)) {
    return res.status(400).json({ error: 'Slug inválido.' });
  }

  try {
    console.log('[DEBUG] GET /tables/:slug - Starting query with slug:', slug);
    const table = await db
      .selectFrom('tables as t')
      .leftJoin('gm_profiles as gm', 'gm.id', 't.gm_id')
      .leftJoin('users as u', 'u.id', 'gm.user_id')
      .leftJoin('profiles as p', 'p.user_id', 'u.id')
      .leftJoin('systems as s', 's.id', 't.system_id')
      .leftJoin('scenarios as sc', 'sc.id', 't.scenario_id') // CORREÇÃO DT-02: JOIN para retornar cenário
      // CORREÇÃO A01: JOIN com vtt_platforms para retornar dados de VTT
      .leftJoin('vtt_platforms as vtt', 'vtt.id', 't.vtt_platform_id')
      .leftJoin('communication_platforms as cp', 'cp.id', 't.communication_platform_id')
      .select([
        't.id',
        't.slug',
        't.title',
        't.description',
        sql<string | null>`t.banner_url`.as('cover_url'),
        sql<Record<string, number> | null>`t.banner_crop_data`.as('cover_crop_data'),
        't.status',
        't.type',
        't.audience',
        't.modality',
        't.price_type',
        't.price_value',
        't.price_frequency',
        't.slots_total',
        't.slots_filled',
        't.slots_open', // REQ-02: Vagas abertas para recrutamento
        't.language',
        't.experience_level',
        't.starts_at',
        't.schedule_day_status',
        't.schedule_time_status',
        't.schedule_day_hint',
        't.schedule_time_hint',
        't.city',
        't.state',
        't.content_warnings',
        't.safety_tools',
        't.publisher_role',
        't.actual_gm_name',
        't.featured',
        't.created_at',
        't.origin',
        't.is_ddal',
        't.is_covil', // CORREÇÃO A01: Retornar flag Covil do Lich
        't.ddal_code',
        't.ddal_name',
        't.ddal_tier',
        't.ddal_season',
        't.ddal_duration',
        't.ddal_format',
        't.ddal_org_code',
        't.ddal_setting',
        't.ddal_rules_notes',
        // CORREÇÃO: Retornar campos avançados (REQ-26)
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
        // Campos de cenário e estilos (REQ-28)
        't.setting_name',
        't.setting_styles',
        // REQ-28 Fase 7: Campos editoriais separados
        't.synopsis_narrative',
        't.benefits_text',
        't.table_gm_bio',
        // CORREÇÃO A01: Retornar campos de VTT Platform
        't.game_platform_custom',
        't.communication_platform_id',
        sql<string | null>`COALESCE(cp.name, t.communication_platform)`.as('communication_platform'),
        's.name as system_name',
        's.slug as system_slug',
        's.logo_filename as system_logo_filename',
        's.website_url as system_website_url',
        // CORREÇÃO DT-02: Retornar nome do cenário
        'sc.name as scenario_name',
        // CORREÇÃO A01: Retornar objeto vtt_platform completo
        sql<any>`
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
        'gm.slug as gm_slug',
        sql<string | null>`COALESCE(gm.avatar_url, p.avatar_url)`.as('gm_avatar_url'),
        'gm.badges as gm_badges',
        'u.id as gm_user_id', // CORREÇÃO DT-025: Adicionar user_id para verificação de ownership
        sql<string>`COALESCE(gm.nickname, p.display_name)`.as('gm_display_name'),
        'gm.bio_long as gm_bio_long', // CORREÇÃO REG-13: Renomeado para evitar conflito com t.gm_bio
      ])
      .where('t.slug', '=', slug)
      .executeTakeFirst();

    if (!table) {
      return res.status(404).json({ error: 'Mesa não encontrada.' });
    }

    // Validar expiração para mesas importadas
    if (table.origin === 'imported') {
      const limite5Dias = new Date(table.created_at);
      limite5Dias.setDate(limite5Dias.getDate() + 5);

      const limiteEvento = table.starts_at ? new Date(table.starts_at) : limite5Dias;
      const validadeFinal = limiteEvento < limite5Dias ? limiteEvento : limite5Dias;

      if (new Date() >= validadeFinal) {
        return res.status(404).json({ error: 'Mesa não encontrada ou expirada.' });
      }
    }

    const contacts = await db
      .selectFrom('table_contacts')
      .select(['channel', 'value', 'label', 'discord_server_url', 'sort_order'])
      .where('table_id', '=', table.id)
      .orderBy('sort_order', 'asc')
      .execute();

    // CORREÇÃO: Buscar schedules (REQ-27)
    const schedules = await db
      .selectFrom('table_schedules')
      .selectAll()
      .where('table_id', '=', table.id)
      .orderBy('sort_order', 'asc')
      .execute();

    // Buscar VTT platforms preferidas do mestre
    const gmVttPlatforms = table.gm_user_id ? await db
      .selectFrom('gm_profiles as gm')
      .innerJoin('vtt_platforms as vtt', (join) =>
        join.on(sql.raw('vtt.id = ANY(gm.preferred_vtt_platforms)'))
      )
      .select([
        'vtt.id',
        'vtt.name',
        'vtt.slug',
        'vtt.logo_filename',
        'vtt.website_url',
      ])
      .where('gm.user_id', '=', table.gm_user_id)
      .execute() : [];

    res.json({
      data: {
        ...table,
        cover_url: sanitizePublicImageUrl(table.cover_url),
        contacts,
        schedules,
        gm_vtt_platforms: gmVttPlatforms,
      },
    });
  } catch (error: any) {
    // Log detalhado de erro de banco de dados
    logDatabaseError(req, error, {
      route: 'GET /api/v1/tables/:slug',
      operation: 'fetch_table_details'
    });
    
    // CORREÇÃO A-CRIT-02: Detectar erro de migration pendente
    console.error('[GET /tables/:slug]', error, { 
      slug, 
      errorMessage: error.message,
      pgCode: error.code,
      stack: error.stack 
    });
    
    // Detectar erro de tabela inexistente (migration não executada)
    if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
      console.error('[MIGRATION PENDING] Database table does not exist. Check if migrations were executed.');
      return res.status(503).json({ 
        error: 'Serviço temporariamente indisponível. Tente novamente em alguns minutos.' 
      });
    }
    
    res.status(500).json({ error: 'Erro ao buscar mesa.' });
  }
});

// POST /api/v1/tables/:slug/view — Registrar visualização
router.post('/:slug/view', async (req: Request, res: Response) => {
  const { slug } = req.params;

  try {
    // Buscar mesa pelo slug
    const table = await db
      .selectFrom('tables as t')
      .select(['t.id'])
      .where('t.slug', '=', slug)
      .where('t.status', '=', 'active')
      .executeTakeFirst();

    if (!table) {
      return res.status(404).json({ error: 'Mesa não encontrada.' });
    }

    // Incrementar contador de visualizações
    await db
      .insertInto('table_metrics')
      .values({
        table_id: table.id,
        views_count: 1,
      })
      .onConflict((oc) =>
        oc.column('table_id').doUpdateSet({
          views_count: sql`table_metrics.views_count + 1`,
          updated_at: sql`NOW()`,
        })
      )
      .execute();

    res.json({ success: true });
  } catch (error: any) {
    console.error('[POST /tables/:slug/view]', error);
    res.status(500).json({ error: 'Erro ao registrar visualização.' });
  }
});

// POST /api/v1/tables/:slug/click — Registrar clique (para CTR tracking e A/B test)
router.post('/:slug/click', async (req: Request, res: Response) => {
  const { slug } = req.params;
  const { variant } = req.body as { variant?: string };

  // CORREÇÃO UX-SENIOR-02: Validar formato do slug
  if (!slug || slug.length > 200 || !/^[a-z0-9-]+$/i.test(slug)) {
    return res.status(400).json({ error: 'Slug inválido.' });
  }

  try {
    // Buscar mesa pelo slug
    const table = await db
      .selectFrom('tables as t')
      .select(['t.id'])
      .where('t.slug', '=', slug)
      .where('t.status', '=', 'active')
      .executeTakeFirst();

    if (!table) {
      return res.status(404).json({ error: 'Mesa não encontrada.' });
    }

    // Incrementar contador de cliques em table_metrics
    await db
      .insertInto('table_metrics')
      .values({
        table_id: table.id,
        clicks_count: 1,
      })
      .onConflict((oc) =>
        oc.column('table_id').doUpdateSet({
          clicks_count: sql`table_metrics.clicks_count + 1`,
          updated_at: sql`NOW()`,
        })
      )
      .execute();

    // Registrar evento de clique para A/B test (se variant fornecida)
    if (variant && (variant === 'with_metrics' || variant === 'without_metrics')) {
      await db
        .insertInto('table_click_events')
        .values({
          table_id: table.id,
          variant,
        })
        .execute();
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error('[POST /tables/:slug/click]', error);
    res.status(500).json({ error: 'Erro ao registrar clique.' });
  }
});

export default router;
