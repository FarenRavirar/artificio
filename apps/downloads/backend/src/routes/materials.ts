import { Router, type Request, type Response } from 'express';
import { sql } from 'kysely';
import { z } from 'zod';
import { db } from '../db';
import { authMiddleware } from '../middleware/auth';
import { writeRateLimiter } from '../middleware/rateLimit';
import {
  getCatalogMaterialTypeById,
  getCatalogNodeById,
  loadCatalogMaterialTypes,
  loadCatalogSystemsFlat,
  type FlatCatalogSystem,
} from '../services/catalogClient';

const router = Router();

const MAX_PAGE_SIZE = 60;
const DEFAULT_PAGE_SIZE = 20;

const SORT_OPTIONS = ['relevance', 'recent', 'popular', 'name'] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const listMaterialsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  system_id: z.string().trim().optional(),
  edition_id: z.string().trim().optional(),
  // Nome do query param fica retrocompatível; valor agora é ID Central.
  material_type: z.string().uuid().optional(),
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
  'download_material.id',
  'download_material.slug',
  'download_material.title',
  'download_material.summary',
  'download_material.description',
  'download_material.material_type',
  'download_material.material_type_id',
  'download_material.access_kind',
  'download_material.external_url',
  'download_material.system_id',
  'download_material.edition_id',
  'download_material.creator_id',
  'download_material.editorial_state',
  'download_material.created_at',
  'download_material.updated_at',
] as const;

const CARD_METADATA_FIELDS = [
  'download_material_metadata.cover_image_url',
  'download_material_metadata.credits',
  'download_material_metadata.scenario',
] as const;

const createMaterialSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  material_type_id: z.string().uuid(),
});

const FACETS_CACHE_TTL_MS = 30 * 1000;
let facetsCache: { data: MaterialFacetsResponse; expiresAt: number } | null = null;

interface FacetCount {
  id: string;
  count: number;
}

interface MaterialTypeFacet extends FacetCount {
  slug: string;
  name: string;
}

interface MaterialFacetsResponse {
  material_types: MaterialTypeFacet[];
  systems: FacetCount[];
  editions: FacetCount[];
}

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
  if (materialType) baseQuery = baseQuery.where('material_type_id', '=', materialType);
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

  // Fase 5: metadata e opcional. leftJoin preserva material publicado antigo
  // sem linha metadata; innerJoin faria esse material desaparecer do catálogo.
  let resultsQuery = baseQuery
    .leftJoin('download_material_metadata', 'download_material_metadata.material_id', 'download_material.id')
    .select([...PUBLIC_MATERIAL_FIELDS, ...CARD_METADATA_FIELDS]);

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
    resultsQuery = resultsQuery.orderBy('download_material.title', 'asc');
  } else {
    // 'relevance' sem busca textual de rank equivale a 'recent' (MVP —
    // ranking real de relevancia fica para quando houver motor de busca).
    resultsQuery = resultsQuery.orderBy('download_material.created_at', 'desc');
  }

  const materials = await resultsQuery
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .execute();

  return res.json({
    items: await enrichMaterialsWithTaxonomy(materials),
    page,
    page_size: pageSize,
    total: Number(count),
    total_pages: Math.max(1, Math.ceil(Number(count) / pageSize)),
  });
});

// Proxy público do vocabulário Central. Frontend não precisa conhecer host do
// Site; Downloads continua validando a mesma fonte canônica no POST.
router.get('/types', async (_req: Request, res: Response) => {
  try {
    // Achado real (review PR #205, Codex): o proxy confiava que todo item
    // remoto era selecionável. Filtrar aqui mantém tipos pending/rejeitados
    // fora do formulário mesmo se o contrato Central ampliar a resposta.
    const items = (await loadCatalogMaterialTypes()).filter((item) => item.status === 'active');
    res.json({ items });
  } catch (error) {
    console.error('[materials] material types unavailable', error);
    res.status(503).json({ error: 'Catálogo de tipos de material indisponível.' });
  }
});

// Deve ficar antes de /:slug: Express interpretaria "facets" como slug.
// Retorna só valores que têm material publicado: sidebar não oferece filtro
// sem resultado (Nielsen) e o catálogo não vaza rascunho/retirado.
router.get('/facets', async (_req: Request, res: Response) => {
  if (facetsCache && facetsCache.expiresAt > Date.now()) {
    res.json(facetsCache.data);
    return;
  }

  try {
    const [materialTypeRows, systemRows, editionRows, centralTypes] = await Promise.all([
      db.selectFrom('download_material')
        .select(['material_type_id', ({ fn }) => fn.countAll<number>().as('count')])
        .where('editorial_state', '=', 'published')
        .groupBy('material_type_id')
        .orderBy('count', 'desc')
        .execute(),
      db.selectFrom('download_material')
        .select(['system_id', ({ fn }) => fn.countAll<number>().as('count')])
        .where('editorial_state', '=', 'published')
        .where('system_id', 'is not', null)
        .groupBy('system_id')
        .orderBy('count', 'desc')
        .execute(),
      db.selectFrom('download_material')
        .select(['edition_id', ({ fn }) => fn.countAll<number>().as('count')])
        .where('editorial_state', '=', 'published')
        .where('edition_id', 'is not', null)
        .groupBy('edition_id')
        .orderBy('count', 'desc')
        .execute(),
      loadCatalogMaterialTypes(),
    ]);

    const centralById = new Map(centralTypes.map((item) => [item.id, item]));
    const data: MaterialFacetsResponse = {
      material_types: materialTypeRows.flatMap((row) => {
        const type = centralById.get(row.material_type_id);
        return type ? [{ id: type.id, slug: type.slug, name: type.name, count: Number(row.count) }] : [];
      }),
      systems: systemRows.flatMap((row) => row.system_id ? [{ id: row.system_id, count: Number(row.count) }] : []),
      editions: editionRows.flatMap((row) => row.edition_id ? [{ id: row.edition_id, count: Number(row.count) }] : []),
    };
    facetsCache = { data, expiresAt: Date.now() + FACETS_CACHE_TTL_MS };
    res.json(data);
  } catch (error) {
    console.error('[materials] facets unavailable', error);
    res.status(503).json({ error: 'Facetas indisponíveis.' });
  }
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
    // Spec 084 — material de origem scraper grava creator_id = download_creator.id
    // (ator de sistema, sem user_id/SSO real); material humano continua
    // gravando creator_id = user_id do SSO. OR cobre os 2 casos no mesmo JOIN
    // sem mudar o contrato do fluxo humano ja existente.
    .leftJoin('download_creator', (join) =>
      join.on((eb) => eb.or([
        eb('download_creator.user_id', '=', eb.ref('download_material.creator_id')),
        eb('download_creator.id', '=', eb.ref('download_material.creator_id')),
      ])),
    )
    .select([...PUBLIC_MATERIAL_FIELDS, 'download_creator.slug as creator_slug'])
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
  const parsed = createMaterialSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'slug, title e material_type_id são obrigatórios.', details: z.treeifyError(parsed.error) });
  }

  let materialType;
  try {
    materialType = await getCatalogMaterialTypeById(parsed.data.material_type_id);
    // Achado real (review PR #205, Codex): existência não basta; um tipo pode
    // ficar pending/rejeitado entre a carga do formulário e o POST.
    if (!materialType || materialType.status !== 'active') {
      return res.status(400).json({ error: 'Tipo de material inexistente ou inativo.' });
    }
  } catch (error) {
    // Falha Central é indisponibilidade (503), não payload inválido (400).
    console.error('[materials] material type validation unavailable', error);
    return res.status(503).json({ error: 'Catálogo de tipos de material indisponível.' });
  }

  const created = await db
    .insertInto('download_material')
    .values({
      slug: parsed.data.slug,
      title: parsed.data.title,
      material_type_id: materialType.id,
      material_type: materialType.name,
      creator_id: req.user!.userId,
      editorial_state: 'draft',
      access_kind: 'external_link',
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return res.status(201).json(created);
});

interface MaterialWithTaxonomyIds {
  system_id: string | null;
  edition_id: string | null;
}

function taxonomyChainFor(material: MaterialWithTaxonomyIds, nodes: FlatCatalogSystem[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const leaf = material.edition_id ? byId.get(material.edition_id) : material.system_id ? byId.get(material.system_id) : undefined;
  if (!leaf) return [];

  const chain: FlatCatalogSystem[] = [];
  const visited = new Set<string>();
  let current: FlatCatalogSystem | undefined = leaf;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.unshift(current);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return chain;
}

async function enrichMaterialsWithTaxonomy<T extends MaterialWithTaxonomyIds>(materials: T[]) {
  if (!materials.some((material) => material.system_id || material.edition_id)) {
    return materials.map((material) => ({ ...material, taxonomy_chain: [] }));
  }

  try {
    // Uma leitura Central por página (cache TTL em catalogClient), nunca uma
    // chamada por card. A árvore achatada resolve toda cadeia em memória.
    const nodes = await loadCatalogSystemsFlat();
    return materials.map((material) => {
      const chain = taxonomyChainFor(material, nodes);
      return {
        ...material,
        taxonomy_chain: chain.map(({ id, name, name_pt, node_type, path_slug }) => ({ id, name, name_pt, node_type, path_slug })),
        system_name: chain.find((node) => node.node_type === 'system')?.name ?? null,
        edition_name: chain.find((node) => node.node_type === 'edition')?.name ?? null,
        variant_name: chain.find((node) => node.node_type === 'variant')?.name ?? null,
        system_path_slug: chain.at(-1)?.path_slug ?? null,
      };
    });
  } catch (error) {
    // Catálogo público continua útil durante falha transitória do Central;
    // IDs seguem no payload e nomes podem reaparecer na próxima leitura.
    // Achado real (review PR #205, Codex): o fallback devolvia shape menor que
    // o sucesso. Nulos explícitos mantêm contrato estável durante a falha.
    console.error('[materials] taxonomy enrichment unavailable', error);
    return materials.map((material) => ({
      ...material,
      taxonomy_chain: [],
      system_name: null,
      edition_name: null,
      variant_name: null,
      system_path_slug: null,
    }));
  }
}

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
