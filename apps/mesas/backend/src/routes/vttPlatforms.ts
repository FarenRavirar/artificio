import { Router } from 'express';
import { deliverPendingNotifications } from '../services/notificationOutboxDelivery.js';
import { enqueueNotification } from '../services/notificationOutbox.js';
import { sql } from 'kysely'; // CORREÇÃO G03: Import sql para queries case-insensitive
import { db } from '../db/index.js';
import { authMiddleware, requireRole } from '../middleware/auth.js'; // CORREÇÃO A02: Import middleware
import {
  slugifyPlatformName as slugify,
  normalizePlatformWebsiteUrl as normalizeWebsiteUrl,
  isPlatformUniqueViolation as isUniqueViolation,
  getPlatformErrorMessage as getErrorMessage,
  validateImpliesInput,
  impliesInsertValues,
  applyImpliesUpdate,
  IMPLIES_COLUMNS,
} from '../utils/platformUtils.js';
import { resolveActorName } from '../services/actorNameResolver.js';

const router = Router();

// Achado Sonar (PR #287): a enumeração de colunas era repetida em 5 pontos
// (select público, select do admin, returning do POST, e o par
// update/select do PUT). Acrescentar uma coluna exigia lembrar dos 5 — foi
// assim que os `implies_*` nasceram duplicados. Uma constante por forma de
// resposta; a pública omite is_active/timestamps de propósito (contrato
// menor para consumo anônimo).
const PUBLIC_COLUMNS = [
  'id',
  'name',
  'slug',
  'logo_filename',
  'website_url',
  'sort_order',
  // Requisitos implicados (migration_162, spec 096 R3): o catálogo público
  // alimenta a auto-marcação "com o porquê" no editor.
  ...IMPLIES_COLUMNS,
] as const;

const ADMIN_COLUMNS = [
  'id',
  'name',
  'slug',
  'logo_filename',
  'website_url',
  'is_active',
  'sort_order',
  'created_at',
  'updated_at',
  ...IMPLIES_COLUMNS,
] as const;

interface VttPlatformPayload {
  name?: string;
  slug?: string;
  logo_filename?: string | null;
  website_url?: string | null;
  sort_order?: number;
  is_active?: boolean;
  aliases?: string[];
  // Requisitos implicados (migration_162, spec 096 Fase 5): o admin edita os
  // flags que alimentam a auto-marcação no editor de anúncio. As colunas
  // existem em tabela exatamente porque o admin já edita o catálogo
  // (plan.md §Regras VTT → requisitos:486-487) — CRUD sem os flags
  // contradiria a premissa da migration.
  implies_pc?: boolean;
  implies_microphone?: boolean;
  implies_camera?: boolean;
}

// D2 (spec 093): slug de alias — mesmo padrão de scenarioSuggestionsAdmin.ts.
const aliasSlug = (alias: string): string =>
  alias.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Normaliza a lista de aliases recebida: trim, filtra vazio e dedup.
 *
 * Achado de review (PR #278): a dedup era por `t.toLowerCase()`, mas a constraint
 * do banco é `UNIQUE (vtt_platform_id, alias_slug)` (migration_159:23). "Roll 20"
 * e "Roll-20" são chaves distintas em lowercase e o MESMO slug `roll-20` — o
 * insert em lote estourava a unique. E alias só de pontuação ("---") produz slug
 * vazio, linha inútil que quebra o lookup do parser. Dedup e descarte passam a
 * usar o slug, que é o que o banco de fato restringe.
 *
 * Devolve o par {alias, alias_slug} já pronto para não recomputar o slug no
 * ponto de escrita (era feito em dois lugares, com risco de divergirem).
 */
function normalizeAliases(aliases: unknown): { alias: string; alias_slug: string }[] {
  if (!Array.isArray(aliases)) return [];
  const seen = new Set<string>();
  const out: { alias: string; alias_slug: string }[] = [];
  for (const a of aliases) {
    if (typeof a !== 'string') continue;
    const t = a.trim();
    if (!t || t.length > 100) continue;
    const slug = aliasSlug(t);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ alias: t, alias_slug: slug });
  }
  return out;
}

/**
 * Valida o campo `aliases` do corpo antes de qualquer escrita.
 *
 * Achado de review (PR #278): `normalizeAliases` descarta entrada inválida em
 * silêncio, então `aliases: "roll20"` (string, não array) virava `[]` e o
 * delete+insert do update APAGAVA todos os aliases da plataforma. Pedido
 * malformado não pode ter efeito destrutivo silencioso. `aliases: []` continua
 * sendo a limpeza explícita e legítima.
 */
function validateAliasesInput(aliases: unknown): string | null {
  if (!Array.isArray(aliases)) return 'Campo "aliases" deve ser uma lista.';
  for (const a of aliases) {
    if (typeof a !== 'string') return 'Campo "aliases" deve conter apenas strings.';
    if (a.trim().length > 100) return 'Alias excede 100 caracteres.';
  }
  return null;
}

const normalizeLogoFilename = (value?: string | null): string | null => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();

  if (!trimmed) return null;
  if (trimmed.length > 255) {
    throw new Error('Nome de arquivo de logo inválido (máximo 255 caracteres).');
  }

  return trimmed;
};



/**
 * GET /api/v1/vtt-platforms
 * Lista todas as plataformas VTT ativas
 * Público - não requer autenticação
 */
router.get('/', async (req, res) => {
  try {
    const platforms = await db
      .selectFrom('vtt_platforms')
      .select(PUBLIC_COLUMNS)
      .where('is_active', '=', true)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
      .execute();

    return res.json({ data: platforms });
  } catch (error) {
    console.error('[GET /vtt-platforms] Erro ao buscar plataformas:', error);
    return res.status(500).json({ error: 'Erro ao buscar plataformas VTT.' });
  }
});

/**
 * POST /api/v1/vtt-platforms/suggest
 * Mestre sugere nova VTT personalizada
 * CORREÇÃO A02: Protegido com authMiddleware
 */
router.post('/suggest', authMiddleware, async (req, res) => {
  const userId = req.user?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Autenticação necessária.' });
  }

  const { suggested_name, table_id } = req.body;

  if (!suggested_name || typeof suggested_name !== 'string' || suggested_name.trim().length === 0) {
    return res.status(400).json({ error: 'Nome da plataforma é obrigatório.' });
  }

  if (suggested_name.trim().length > 100) {
    return res.status(400).json({ error: 'Nome da plataforma muito longo (máximo 100 caracteres).' });
  }

  try {
    // CORREÇÃO G03: Validar se VTT já existe no banco
    const existingVtt = await db
      .selectFrom('vtt_platforms')
      .select('name')
      .where(sql`LOWER(name)`, '=', suggested_name.trim().toLowerCase())
      .executeTakeFirst();

    if (existingVtt) {
      return res.status(409).json({ 
        error: `A plataforma "${existingVtt.name}" já existe no sistema.` 
      });
    }

    // CORREÇÃO G03: Validar se já existe sugestão pendente
    const existingSuggestion = await db
      .selectFrom('vtt_platform_suggestions')
      .select('suggested_name')
      .where(sql`LOWER(suggested_name)`, '=', suggested_name.trim().toLowerCase())
      .where('status', '=', 'pending')
      .executeTakeFirst();

    if (existingSuggestion) {
      return res.status(409).json({ 
        error: `Já existe uma sugestão pendente para "${existingSuggestion.suggested_name}".` 
      });
    }

    const userName = await resolveActorName(userId, { logTag: 'vttPlatforms' });
    const admins = await db
      .selectFrom('users')
      .select('id')
      .where('role', '=', 'admin')
      .execute();

    const suggestion = await db.transaction().execute(async (trx) => {
      const created = await trx
        .insertInto('vtt_platform_suggestions')
        .values({
          suggested_name: suggested_name.trim(),
          suggested_by_user_id: userId,
          table_id: table_id || null,
          status: 'pending',
        })
        .returning(['id', 'suggested_name', 'created_at'])
        .executeTakeFirstOrThrow();

      if (admins.length > 0) {
        // T7.4b (spec 096): outbox na mesma transação, entrega fora dela.
        await enqueueNotification(
          {
            eventType: 'mesas.system.notice',
            subjectType: 'vtt_platform_suggestion',
            subjectId: created.id,
            canonicalPath: '/gestao',
            body: `${userName} sugeriu "${created.suggested_name}" como plataforma de jogo.`,
            snapshot: {
              legacy_type: 'system',
              title: 'Nova sugestão de plataforma',
              message: `${userName} sugeriu "${created.suggested_name}" como plataforma de jogo.`,
              suggestion_id: created.id,
              suggestion_kind: 'vtt_platform',
              table_id: table_id || null,
            },
            recipients: admins.map((admin) => admin.id),
          },
          trx,
        );
      }

      return created;
    });

    console.log(`[POST /vtt-platforms/suggest] Nova sugestão: "${suggested_name}" por user ${userId}`);

    // T7.4b (spec 096): entrega imediata pós-commit; o sweep periódico cobre o
    // que falhar aqui. Falha de entrega não afeta a resposta ao mestre.
    void deliverPendingNotifications().catch((error: unknown) => {
      console.error('[POST /vtt-platforms/suggest] Falha na entrega pós-commit do outbox:', error);
    });

    return res.status(201).json({ 
      data: suggestion,
      message: 'Sugestão enviada com sucesso! Será analisada pela equipe.' 
    });
  } catch (error) {
    console.error('[POST /vtt-platforms/suggest] Erro ao criar sugestão:', error);
    return res.status(500).json({ error: 'Erro ao enviar sugestão.' });
  }
});

/**
 * GET /api/v1/vtt-platforms/admin
 * Lista completa para administração
 */
router.get('/admin', authMiddleware, requireRole('admin'), async (_req, res) => {
  try {
    const platforms = await db
      .selectFrom('vtt_platforms')
      .select(ADMIN_COLUMNS)
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
      .execute();

    // D2 (spec 093): aliases em tabela — expostos no CRUD para edição no painel.
    const aliases = await db
      .selectFrom('vtt_platform_aliases')
      .select(['vtt_platform_id', 'alias'])
      .execute();
    const aliasMap = new Map<string, string[]>();
    for (const a of aliases) {
      const list = aliasMap.get(a.vtt_platform_id) ?? [];
      list.push(a.alias);
      aliasMap.set(a.vtt_platform_id, list);
    }

    return res.json({ data: platforms.map((p) => ({ ...p, aliases: aliasMap.get(p.id) ?? [] })) });
  } catch (error) {
    console.error('[GET /vtt-platforms/admin] Erro ao buscar plataformas:', error);
    return res.status(500).json({ error: 'Erro ao buscar plataformas VTT.' });
  }
});

/**
 * POST /api/v1/vtt-platforms/admin
 * Cria plataforma VTT
 */
router.post('/admin', authMiddleware, requireRole('admin'), async (req, res) => {
  const payload = req.body as VttPlatformPayload;
  const name = payload.name?.trim();

  if (!name || name.length < 2 || name.length > 100) {
    return res.status(400).json({ error: 'Nome da plataforma inválido (2-100 caracteres).' });
  }

  const slug = payload.slug?.trim() || slugify(name);
  if (!slug || slug.length < 2 || slug.length > 100) {
    return res.status(400).json({ error: 'Slug da plataforma inválido.' });
  }

  const sortOrder = Number.isInteger(payload.sort_order) ? Number(payload.sort_order) : 0;

  if (payload.aliases !== undefined) {
    const aliasError = validateAliasesInput(payload.aliases);
    if (aliasError) return res.status(400).json({ error: aliasError });
  }

  // Requisitos implicados (spec 096 Fase 5): validação ANTES da escrita —
  // flag que não é boolean derruba o pedido com 400 (mesma regra do aliases:
  // entrada malformada não pode ter efeito).
  const impliesError = validateImpliesInput(payload);
  if (impliesError) {
    return res.status(400).json({ error: impliesError });
  }

  try {
    const websiteUrl = normalizeWebsiteUrl(payload.website_url);
    const logoFilename = normalizeLogoFilename(payload.logo_filename);
    const aliases = normalizeAliases(payload.aliases);

    const created = await db.transaction().execute(async (trx) => {
      const platform = await trx
        .insertInto('vtt_platforms')
        .values({
          name,
          slug,
          logo_filename: logoFilename,
          website_url: websiteUrl,
          sort_order: sortOrder,
          is_active: payload.is_active ?? true,
          ...impliesInsertValues(payload),
        })
        .returning(ADMIN_COLUMNS)
        .executeTakeFirstOrThrow();

      if (aliases.length > 0) {
        await trx
          .insertInto('vtt_platform_aliases')
          .values(aliases.map((a) => ({
            vtt_platform_id: platform.id,
            alias: a.alias,
            alias_slug: a.alias_slug,
          })))
          .onConflict((oc) => oc.columns(['vtt_platform_id', 'alias_slug']).doNothing())
          .execute();
      }
      // O contrato da resposta é lista de strings — o par {alias, alias_slug} é
      // detalhe de persistência.
      return { ...platform, aliases: aliases.map((a) => a.alias) };
    });

    return res.status(201).json({ data: created });
  } catch (error) {
    console.error('[POST /vtt-platforms/admin] Erro ao criar plataforma:', error);

    const errorMessage = getErrorMessage(error);
    if (errorMessage === 'URL da plataforma inválida.' || errorMessage === 'Nome de arquivo de logo inválido (máximo 255 caracteres).') {
      return res.status(400).json({ error: errorMessage });
    }

    if (isUniqueViolation(error)) {
      return res.status(409).json({ error: 'Já existe plataforma com este nome ou slug.' });
    }

    return res.status(500).json({ error: 'Erro ao criar plataforma VTT.' });
  }
});

/**
 * PUT /api/v1/vtt-platforms/admin/:id
 * Atualiza plataforma VTT
 */
router.put('/admin/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const payload = req.body as VttPlatformPayload;

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

  if (payload.logo_filename !== undefined) {
    try {
      updateData.logo_filename = normalizeLogoFilename(payload.logo_filename);
    } catch (error) {
      return res.status(400).json({ error: getErrorMessage(error) });
    }
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

  if (payload.is_active !== undefined) {
    if (typeof payload.is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active deve ser boolean.' });
    }
    updateData.is_active = payload.is_active;
  }

  // Requisitos implicados (spec 096 Fase 5): validação ANTES da escrita,
  // mesmo padrão dos demais campos — só entra no updateData se definido
  // (mantém o PUT parcial, ex. handleToggleActive que envia só is_active).
  const impliesUpdateError = validateImpliesInput(payload);
  if (impliesUpdateError) {
    return res.status(400).json({ error: impliesUpdateError });
  }
  applyImpliesUpdate(payload, updateData);

  const hasAliases = payload.aliases !== undefined;

  // Validar ANTES da transação: o bloco de aliases faz delete + insert, então
  // entrada malformada silenciosamente normalizada para [] apagaria todos os
  // aliases da plataforma (achado de review, PR #278).
  if (hasAliases) {
    const aliasError = validateAliasesInput(payload.aliases);
    if (aliasError) return res.status(400).json({ error: aliasError });
  }

  const nextAliases = hasAliases ? normalizeAliases(payload.aliases) : null;

  if (Object.keys(updateData).length === 0 && !hasAliases) {
    return res.status(400).json({ error: 'Nenhum campo válido para atualização.' });
  }

  try {
    const updated = await db.transaction().execute(async (trx) => {
      const platform = Object.keys(updateData).length > 0
        ? await trx
            .updateTable('vtt_platforms')
            .set(updateData)
            .where('id', '=', id)
            .returning(ADMIN_COLUMNS)
            .executeTakeFirst()
        : await trx
            .selectFrom('vtt_platforms')
            .select(ADMIN_COLUMNS)
            .where('id', '=', id)
            .executeTakeFirst();

      if (!platform) return null;

      // D2 (spec 093): substitui os aliases da plataforma (delete + insert).
      if (hasAliases) {
        await trx.deleteFrom('vtt_platform_aliases').where('vtt_platform_id', '=', id).execute();
        if (nextAliases && nextAliases.length > 0) {
          await trx
            .insertInto('vtt_platform_aliases')
            .values(nextAliases.map((a) => ({
              vtt_platform_id: id,
              alias: a.alias,
              alias_slug: a.alias_slug,
            })))
            .execute();
        }
      }

      // Ambos os ramos devolvem lista de strings: o contrato da resposta é o
      // texto do alias, não o par {alias, alias_slug} usado na persistência.
      const currentAliases: string[] = hasAliases
        ? (nextAliases ?? []).map((a) => a.alias)
        : (await trx
            .selectFrom('vtt_platform_aliases')
            .select('alias')
            .where('vtt_platform_id', '=', id)
            .execute()).map((a) => a.alias);

      return { ...platform, aliases: currentAliases };
    });

    if (!updated) {
      return res.status(404).json({ error: 'Plataforma VTT não encontrada.' });
    }

    return res.json({ data: updated });
  } catch (error) {
    console.error('[PUT /vtt-platforms/admin/:id] Erro ao atualizar plataforma:', error);

    if (isUniqueViolation(error)) {
      return res.status(409).json({ error: 'Já existe plataforma com este nome ou slug.' });
    }

    return res.status(500).json({ error: 'Erro ao atualizar plataforma VTT.' });
  }
});

/**
 * DELETE /api/v1/vtt-platforms/admin/:id
 * Remove plataforma não utilizada
 */
router.delete('/admin/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  const { id } = req.params;

  try {
    const inUse = await db
      .selectFrom('tables')
      .select('id')
      .where('vtt_platform_id', '=', id)
      .limit(1)
      .executeTakeFirst();

    if (inUse) {
      return res.status(409).json({
        error: 'Esta plataforma está vinculada a mesas. Desative-a em vez de remover.',
      });
    }

    const deleted = await db
      .deleteFrom('vtt_platforms')
      .where('id', '=', id)
      .returning(['id', 'name'])
      .executeTakeFirst();

    if (!deleted) {
      return res.status(404).json({ error: 'Plataforma VTT não encontrada.' });
    }

    return res.json({ data: deleted });
  } catch (error) {
    console.error('[DELETE /vtt-platforms/admin/:id] Erro ao remover plataforma:', error);
    return res.status(500).json({ error: 'Erro ao remover plataforma VTT.' });
  }
});

export default router;

