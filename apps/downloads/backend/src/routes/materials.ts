import { Router, type Request, type Response } from 'express';
import { sql } from 'kysely';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import { getCatalogNodeById } from '../services/catalogClient';

const router = Router();

const MAX_PAGE_SIZE = 60;
const DEFAULT_PAGE_SIZE = 20;

const SORT_OPTIONS = ['relevance', 'recent', 'popular', 'name'] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const listMaterialsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  system_id: z.string().trim().optional(),
  edition_id: z.string().trim().optional(),
  material_type: z.string().trim().optional(),
  access_kind: z.enum(['external_link', 'managed_upload']).optional(),
  sort: z.enum(SORT_OPTIONS).optional(),
  page: z.coerce.number().int().min(1).optional(),
  page_size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
});

// Facetas do MVP (073/spec.md T4.3): apenas as colunas ja existentes em
// download_material (070) entram aqui. Genero/idioma/formato/licenca/barreiras
// vivem em download_material_metadata — ficam para quando a UI de filtro
// exigir o join (nao ha coluna de "popularidade" real ainda; 'popular'
// aproxima por download_count agregado quando existir metrica, spec 074).

const patchMaterialSchema = z.object({
  title: z.string().trim().min(1).optional(),
  summary: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  external_url: z.url().trim().nullable().optional(),
});

// Campos publicos da ficha; exclui storage_provider/storage_key (achado
// chatgpt-codex-connector P2 — vazamento de detalhes internos de storage).
const PUBLIC_MATERIAL_FIELDS = [
  'id',
  'slug',
  'title',
  'summary',
  'description',
  'material_type',
  'access_kind',
  'external_url',
  'system_id',
  'edition_id',
  'creator_id',
  'editorial_state',
  'created_at',
  'updated_at',
] as const;

// Campos editaveis por publicador; toda mudanca grava download_material_version
// por campo (D111 item 7 — historico desde o primeiro commit, incl. link).
const EDITABLE_FIELDS = [
  'title',
  'summary',
  'description',
  'external_url',
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

// T4.3 (spec 073) — listagem publica com busca/filtro/ordenacao/paginacao.
// Contrato de URL: q, system_id, edition_id, material_type, access_kind,
// sort, page, page_size. So material publicado aparece aqui (criterio de
// aceite 7 da 073).
router.get('/', async (req: Request, res: Response) => {
  const parsed = listMaterialsQuerySchema.safeParse(req.query ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Parâmetros de busca inválidos.', details: z.treeifyError(parsed.error) });
  }

  const { q, system_id: systemId, edition_id: editionId, material_type: materialType, access_kind: accessKind } = parsed.data;
  const sort: SortOption = parsed.data.sort ?? 'recent';
  const page = parsed.data.page ?? 1;
  const pageSize = parsed.data.page_size ?? DEFAULT_PAGE_SIZE;

  let baseQuery = db
    .selectFrom('download_material')
    .where('editorial_state', '=', 'published');

  if (systemId) baseQuery = baseQuery.where('system_id', '=', systemId);
  if (editionId) baseQuery = baseQuery.where('edition_id', '=', editionId);
  if (materialType) baseQuery = baseQuery.where('material_type', '=', materialType);
  if (accessKind) baseQuery = baseQuery.where('access_kind', '=', accessKind);
  if (q) {
    baseQuery = baseQuery.where((eb) =>
      eb.or([
        eb('title', 'ilike', `%${q}%`),
        eb('summary', 'ilike', `%${q}%`),
      ]),
    );
  }

  const { count } = await baseQuery
    .select(({ fn }) => [fn.countAll<number>().as('count')])
    .executeTakeFirstOrThrow();

  let resultsQuery = baseQuery.select(PUBLIC_MATERIAL_FIELDS);

  if (sort === 'popular') {
    resultsQuery = resultsQuery
      .leftJoin(
        db
          .selectFrom('download_metric_daily')
          .select(['material_id', ({ fn }) => fn.sum<number>('download_count').as('total_downloads')])
          .groupBy('material_id')
          .as('material_downloads'),
        (join) => join.onRef('material_downloads.material_id', '=', 'download_material.id'),
      )
      .orderBy(sql`coalesce(material_downloads.total_downloads, 0)`, 'desc')
      .orderBy('download_material.created_at', 'desc');
  } else if (sort === 'name') {
    resultsQuery = resultsQuery.orderBy('title', 'asc');
  } else {
    // 'relevance' sem busca textual de rank equivale a 'recent' (MVP —
    // ranking real de relevancia fica para quando houver motor de busca).
    resultsQuery = resultsQuery.orderBy('created_at', 'desc');
  }

  const materials = await resultsQuery
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .execute();

  return res.json({
    items: materials,
    page,
    page_size: pageSize,
    total: Number(count),
    total_pages: Math.max(1, Math.ceil(Number(count) / pageSize)),
  });
});

// T1.2 (spec 074) — "Meus materiais": todos os estados editoriais do proprio
// autor (draft/in_review/published/rejected/withdrawn), nao so published.
// Rota fixa "/mine" precisa vir antes de "/:slug" (Express casaria "mine"
// como slug senao).
router.get('/mine', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const materials = await db
    .selectFrom('download_material')
    .select(PUBLIC_MATERIAL_FIELDS)
    .where('creator_id', '=', req.user!.userId)
    .orderBy('updated_at', 'desc')
    .execute();

  return res.json(materials);
});

// T2.3/criterio de aceite 2 e 3 (spec 074) — historico completo por campo,
// so para o proprio autor ou moderador/admin (serie completa nao vaza para
// usuario comum; ficha publica mostra so "atualizado em X").
router.get('/:id/history', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const material = await db
    .selectFrom('download_material')
    .select(['id', 'creator_id'])
    .where('id', '=', req.params.id)
    .executeTakeFirst();

  if (!material) {
    return res.status(404).json({ error: 'Material não encontrado.' });
  }

  const isOwner = material.creator_id === req.user!.userId;
  const canViewAny = req.user!.role === 'moderator' || req.user!.role === 'admin';

  if (!isOwner && !canViewAny) {
    return res.status(403).json({ error: 'Você não tem permissão para ver o histórico deste material.' });
  }

  const history = await db
    .selectFrom('download_material_version')
    .selectAll()
    .where('material_id', '=', req.params.id)
    .orderBy('changed_at', 'desc')
    .execute();

  return res.json(history);
});

// T2.1 — leitura publica de ficha, sem sessao. Fluxo completo de descoberta
// (busca/filtro/facetas) fica na spec 073; aqui so a leitura por slug.
router.get('/:slug', async (req: Request, res: Response) => {
  const material = await db
    .selectFrom('download_material')
    .leftJoin('download_creator', 'download_creator.user_id', 'download_material.creator_id')
    .select([...PUBLIC_MATERIAL_FIELDS.map((field) => `download_material.${field}` as const), 'download_creator.slug as creator_slug'])
    .where('download_material.slug', '=', req.params.slug)
    .where('download_material.editorial_state', '=', 'published')
    .executeTakeFirst();

  if (!material) {
    return res.status(404).json({ error: 'Material não encontrado.' });
  }

  // DEB-073-02 — destino opaco desacoplado do slug (download_destination,
  // migration_014). Get-or-create: primeiro acesso publico a ficha cria o
  // destino, se ainda nao existir; id sobrevive a troca futura de slug.
  const destination = await db
    .selectFrom('download_destination')
    .select('id')
    .where('material_id', '=', material.id)
    .executeTakeFirst()
    ?? await db
      .insertInto('download_destination')
      .values({ material_id: material.id })
      .onConflict((oc) => oc.column('material_id').doNothing())
      .returning('id')
      .executeTakeFirst()
    ?? await db
      .selectFrom('download_destination')
      .select('id')
      .where('material_id', '=', material.id)
      .executeTakeFirstOrThrow();

  // T-relacionados (spec 075) — nome legivel de sistema/edicao pra ficha
  // linkar ao catalogo filtrado; fail-soft (nao derruba a ficha se catalogo
  // central estiver fora do ar).
  const [systemNode, editionNode] = await Promise.all([
    material.system_id ? getCatalogNodeById(material.system_id) : Promise.resolve(null),
    material.edition_id ? getCatalogNodeById(material.edition_id) : Promise.resolve(null),
  ]);

  return res.json({
    ...material,
    destination_id: destination.id,
    system_name: systemNode?.name ?? null,
    edition_name: editionNode?.name ?? null,
  });
});

// T2.2 — criacao autenticada. Estado editorial sempre nasce 'draft'; fila de
// moderacao completa fica na spec 072.
router.post('/', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const { slug, title, material_type: materialType } = req.body ?? {};

  if (typeof slug !== 'string' || typeof title !== 'string' || typeof materialType !== 'string') {
    return res.status(400).json({ error: 'slug, title e material_type são obrigatórios.' });
  }

  const created = await db
    .insertInto('download_material')
    .values({
      slug,
      title,
      material_type: materialType,
      creator_id: req.user!.userId,
      editorial_state: 'draft',
      access_kind: 'external_link',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return res.status(201).json(created);
});

// T2.2 + Ownership (T3.2) — publicador so edita o proprio material; moderador
// e admin editam qualquer um (autorizacao fina fica na spec 072).
router.patch('/:id', writeRateLimiter, authMiddleware, async (req: Request, res: Response) => {
  const material = await db
    .selectFrom('download_material')
    .selectAll()
    .where('id', '=', req.params.id)
    .executeTakeFirst();

  if (!material) {
    return res.status(404).json({ error: 'Material não encontrado.' });
  }

  const isOwner = material.creator_id === req.user!.userId;
  const canEditAny = req.user!.role === 'moderator' || req.user!.role === 'admin';

  if (!isOwner && !canEditAny) {
    return res.status(403).json({ error: 'Você não tem permissão para editar este material.' });
  }

  const parsed = patchMaterialSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payload inválido.', details: z.treeifyError(parsed.error) });
  }

  const patch = parsed.data;
  const changes = EDITABLE_FIELDS.filter((field) => field in patch) as EditableField[];

  if (changes.length === 0) {
    return res.status(400).json({ error: 'Nenhum campo editável enviado.' });
  }

  const updated = await db.transaction().execute(async (trx) => {
    for (const field of changes) {
      const oldValue = material[field];
      const newValue = patch[field];
      if (oldValue === newValue) continue;

      await trx
        .insertInto('download_material_version')
        .values({
          material_id: material.id,
          field_name: field,
          old_value: oldValue !== null && oldValue !== undefined ? String(oldValue) : null,
          new_value: newValue !== null && newValue !== undefined ? String(newValue) : null,
          changed_by: req.user!.userId,
        })
        .execute();
    }

    return trx
      .updateTable('download_material')
      .set(Object.fromEntries(changes.map((field) => [field, patch[field]])))
      .set({ updated_at: new Date() })
      .where('id', '=', material.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  });

  return res.json(updated);
});

export default router;
